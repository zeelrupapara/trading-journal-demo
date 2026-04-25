import { createServerFn } from "@tanstack/react-start";
// The AI's persona, schema, and formatting guidance live in analysis.md at the
// project root and are bundled at build time via Vite's `?raw` loader so this
// works in any runtime — no fs needed.
import analysisPrompt from "../../analysis.md?raw";

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };
type Payload = { messages: ChatMsg[]; tradesContext: string };

export type AiChunk = { content: string };

type GeminiStreamFrame = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const oneShotStream = (text: string): ReadableStream<AiChunk> =>
  new ReadableStream<AiChunk>({
    start(c) {
      c.enqueue({ content: text });
      c.close();
    },
  });

/**
 * Streaming AI chat. Returns a `ReadableStream<AiChunk>` instead of a single
 * JSON blob — Gemini's full answer can take 15–30s on large contexts and any
 * serverless gateway (Netlify, Cloudflare) will kill an idle connection well
 * before then. Streaming keeps bytes flowing so the gateway never times out
 * and the user sees progressive output.
 */
export const chatWithAI = createServerFn({ method: "POST" })
  .inputValidator((input: Payload) => {
    if (!input || !Array.isArray(input.messages)) throw new Error("invalid payload");
    return input;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return oneShotStream("AI is not configured. Please set GEMINI_API_KEY in your environment.");
    }

    const now = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const daysAgo = (n: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() - n);
      return iso(d);
    };
    const referenceDates = [
      `Today: ${iso(now)}`,
      `Yesterday: ${daysAgo(1)}`,
      `7 days ago: ${daysAgo(7)}`,
      `30 days ago: ${daysAgo(30)}`,
      `90 days ago: ${daysAgo(90)}`,
      `Start of this month: ${iso(new Date(now.getFullYear(), now.getMonth(), 1))}`,
      `Start of this year: ${iso(new Date(now.getFullYear(), 0, 1))}`,
    ].join("\n");

    const systemText = `${analysisPrompt}

---

Reference dates (authoritative — use these, not your training cutoff):
${referenceDates}

The user's trade journal data (JSON):
${data.tradesContext}`;

    // Gemini uses "user" / "model" roles (not "assistant"); system prompt goes
    // in a top-level systemInstruction.
    const contents = data.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents,
        generationConfig: { temperature: 0.3 },
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const t = await upstream.text().catch(() => "");
      if (upstream.status === 429) return oneShotStream("Rate limit reached. Please try again in a moment.");
      if (upstream.status === 401 || upstream.status === 403 || /API_KEY_INVALID/i.test(t)) {
        return oneShotStream(
          "Gemini auth failed — your GEMINI_API_KEY is invalid. Get a fresh key at https://aistudio.google.com/apikey.",
        );
      }
      return oneShotStream(`Gemini error (${upstream.status}): ${t.slice(0, 300)}`);
    }

    // Translate Gemini's SSE frames ("data: {json}\n\n") into typed AiChunks.
    return new ReadableStream<AiChunk>({
      async start(controller) {
        const reader = upstream.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            // SSE frames are separated by blank lines.
            const frames = buffer.split("\n\n");
            buffer = frames.pop() ?? "";
            for (const frame of frames) {
              const line = frame.trim();
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const parsed = JSON.parse(payload) as GeminiStreamFrame;
                const text =
                  parsed.candidates?.[0]?.content?.parts
                    ?.map((p) => p.text)
                    .filter((t): t is string => Boolean(t))
                    .join("") ?? "";
                if (text) controller.enqueue({ content: text });
              } catch {
                // Ignore malformed frames — Gemini occasionally emits keepalives.
              }
            }
          }
        } catch (e) {
          controller.enqueue({
            content: `\n\n_(stream error: ${e instanceof Error ? e.message : "unknown"})_`,
          });
        } finally {
          controller.close();
        }
      },
    });
  });
