import { createServerFn } from "@tanstack/react-start";

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };
type Payload = { messages: ChatMsg[]; tradesContext: string };

export const chatWithAI = createServerFn({ method: "POST" })
  .inputValidator((input: Payload) => {
    if (!input || !Array.isArray(input.messages)) throw new Error("invalid payload");
    return input;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { content: "AI is not configured. Please set LOVABLE_API_KEY." };
    }

    const system = `You are an institutional-grade trading analyst inside QuantJournal.
Analyze the user's trading journal data and answer questions concisely.
Use markdown tables and bullet points when helpful. Be direct and quantitative.

Today's date: ${new Date().toISOString().slice(0, 10)}

The user's trade journal data (JSON):
${data.tradesContext}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, ...data.messages],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) return { content: "Rate limit reached. Please try again in a moment." };
      if (res.status === 402) return { content: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." };
      return { content: `AI error (${res.status}): ${t.slice(0, 200)}` };
    }

    const json = await res.json() as any;
    const content = json?.choices?.[0]?.message?.content || "No response.";
    return { content };
  });
