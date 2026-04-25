import { createServerFn } from "@tanstack/react-start";
// The AI's persona, schema, and formatting guidance live in analysis.md at the
// project root and are bundled at build time via Vite's `?raw` loader so this
// works in both Node and edge (Cloudflare Workers) runtimes — no fs needed.
import analysisPrompt from "../../analysis.md?raw";

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };
type Payload = { messages: ChatMsg[]; tradesContext: string };

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export const chatWithAI = createServerFn({ method: "POST" })
  .inputValidator((input: Payload) => {
    if (!input || !Array.isArray(input.messages)) throw new Error("invalid payload");
    return input;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { content: "AI is not configured. Please set GEMINI_API_KEY in your environment." };
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

    // Gemini uses "user" and "model" roles (not "assistant"), and system prompt
    // goes in a top-level systemInstruction field.
    const contents = data.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents,
        generationConfig: { temperature: 0.3 },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429)
        return { content: "Rate limit reached. Please try again in a moment." };
      if (res.status === 401 || res.status === 403 || /API_KEY_INVALID/i.test(t))
        return {
          content:
            "Gemini auth failed — your GEMINI_API_KEY is invalid. Get a fresh key at https://aistudio.google.com/apikey.",
        };
      return { content: `Gemini error (${res.status}): ${t.slice(0, 300)}` };
    }

    const json = (await res.json()) as GeminiResponse;
    const content =
      json.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .filter((t): t is string => Boolean(t))
        .join("\n") || "No response.";
    return { content };
  });
