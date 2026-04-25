// Client-side helper for the streaming AI chat. The actual Gemini call happens
// in the server route at `src/routes/api/chat.ts`; this just unwraps the
// response body into an async iterable of UTF-8 text chunks.

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };
type Payload = { messages: ChatMsg[]; tradesContext: string };

export async function* streamChat(payload: Payload): AsyncGenerator<string, void, void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.body) {
    yield `Error: empty response (HTTP ${res.status})`;
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) yield decoder.decode(value, { stream: true });
  }
}
