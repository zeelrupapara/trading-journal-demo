import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTrades } from "@/lib/trades";
import { aiContext } from "@/lib/stats";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { CsvImport } from "@/components/app/CsvImport";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Sparkles, Bot, User, Plus, MessageSquare, Brain } from "lucide-react";
import { streamChat } from "@/lib/ai-chat";
import { Markdown } from "@/components/app/Markdown";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/ai")({
  component: AIPage,
});

type Msg = { role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; messages: Msg[]; updated: number };

const CHAT_KEY = "qj_chats";

const SUGGESTIONS = [
  "Summarize my last 30 days",
  "Which symbol is my most profitable?",
  "What's my average R:R per strategy?",
  "Worst day of the week?",
  "How could I improve my edge?",
];

function loadChats(): Conversation[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupt cache → fall through to empty list
  }
  return [];
}

function AIPage() {
  const { trades } = useTrades();
  const [chats, setChats] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = loadChats();
    setChats(c);
    if (c.length > 0) setActiveId(c[0].id);
  }, []);

  const persist = (next: Conversation[]) => {
    setChats(next);
    localStorage.setItem(CHAT_KEY, JSON.stringify(next));
  };

  const active = chats.find((c) => c.id === activeId) || null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [active?.messages.length, busy]);

  const newChat = () => {
    const c: Conversation = {
      id: `c-${Date.now()}`,
      title: "New conversation",
      messages: [],
      updated: Date.now(),
    };
    persist([c, ...chats]);
    setActiveId(c.id);
  };

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    let conv = active;
    if (!conv) {
      conv = { id: `c-${Date.now()}`, title: text.slice(0, 40), messages: [], updated: Date.now() };
      const next = [conv, ...chats];
      persist(next);
      setActiveId(conv.id);
    }
    const userMsg: Msg = { role: "user", content: text };
    const updated: Conversation = {
      ...conv,
      title: conv.messages.length === 0 ? text.slice(0, 40) : conv.title,
      messages: [...conv.messages, userMsg],
      updated: Date.now(),
    };
    let nextChats = chats.map((c) => (c.id === updated.id ? updated : c));
    if (!nextChats.find((c) => c.id === updated.id)) nextChats = [updated, ...chats];
    persist(nextChats);
    setInput("");
    setBusy(true);

    // Helper that mutates the active conversation's last assistant message in
    // place. Used while the Gemini stream is still flowing.
    const upsertAssistant = (content: string, isFirst: boolean) => {
      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== updated.id) return c;
          if (isFirst) {
            return {
              ...c,
              messages: [...c.messages, { role: "assistant", content }],
              updated: Date.now(),
            };
          }
          const msgs = [...c.messages];
          msgs[msgs.length - 1] = { role: "assistant", content };
          return { ...c, messages: msgs, updated: Date.now() };
        }),
      );
    };

    try {
      // Pre-aggregated context — way smaller than dumping all trades raw, and
      // means the model isn't recomputing what the dashboard already knows.
      const ctx = JSON.stringify(aiContext(trades));
      let collected = "";
      let firstChunk = true;
      for await (const chunk of streamChat({
        messages: updated.messages,
        tradesContext: ctx,
      })) {
        if (!chunk) continue;
        collected += chunk;
        upsertAssistant(collected, firstChunk);
        if (firstChunk) {
          // Hide the typing dots once real text starts arriving so the user
          // sees the response replacing the placeholder, not on top of it.
          setBusy(false);
          firstChunk = false;
        }
      }
      if (firstChunk) upsertAssistant("No response.", true);

      // One write to localStorage at the end — no need to thrash on every chunk.
      setChats((prev) => {
        try {
          window.localStorage.setItem(CHAT_KEY, JSON.stringify(prev));
        } catch {
          // Quota / private mode — non-fatal.
        }
        return prev;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "request failed";
      upsertAssistant("Error: " + msg, true);
      setChats((prev) => {
        try {
          window.localStorage.setItem(CHAT_KEY, JSON.stringify(prev));
        } catch {
          // ignore
        }
        return prev;
      });
    } finally {
      setBusy(false);
    }
  };

  if (trades.length === 0) {
    return (
      <>
        <PageHeader
          title="AI Analytics Chat"
          subtitle="Ask anything about your trades — powered by Gemini"
        />
        <EmptyState
          icon={<Brain className="h-5 w-5" />}
          title="No data found"
          description="The AI analyst needs your trade data to answer questions like 'why am I losing on Mondays?' or 'which strategy has the best R:R?'. Import a CSV to start chatting."
          action={<CsvImport variant="hero" />}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="AI Analytics Chat"
        subtitle="Ask anything about your trades — powered by Gemini"
        actions={
          <Button size="sm" variant="outline" onClick={newChat}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Chat
          </Button>
        }
      />
      <div className="flex-1 flex min-h-0">
        {/* Recent chats */}
        <div className="w-72 shrink-0 border-r border-border p-4 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3 flex items-center justify-between">
            Recent Chats
            <button onClick={newChat} className="text-muted-foreground hover:text-primary">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {chats.length === 0 && (
              <p className="text-xs text-muted-foreground py-8 text-center">No conversations yet</p>
            )}
            {chats.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-md transition-colors group",
                  activeId === c.id ? "bg-accent/60" : "hover:bg-accent/30",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {c.messages.length} message{c.messages.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-8">
            {!active || active.messages.length === 0 ? (
              <div className="max-w-2xl mx-auto pt-12 text-center">
                <div className="h-12 w-12 mx-auto rounded-lg bg-secondary border border-border flex items-center justify-center mb-4">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Ask about your trades</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  I have full context on all {trades.length} trades in your journal.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-xl mx-auto">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left px-4 py-3 rounded-md border border-border bg-card/50 hover:bg-accent/40 text-sm transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-6">
                {active.messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn("flex gap-3", m.role === "user" ? "flex-row-reverse" : "")}
                  >
                    <div
                      className={cn(
                        "h-7 w-7 rounded-md flex items-center justify-center shrink-0",
                        m.role === "user"
                          ? "bg-secondary border border-border"
                          : "bg-primary/20 border border-primary/30",
                      )}
                    >
                      {m.role === "user" ? (
                        <User className="h-3.5 w-3.5" />
                      ) : (
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-4 py-3 text-sm",
                        m.role === "user"
                          ? "bg-secondary border border-border"
                          : "bg-card border border-border",
                      )}
                    >
                      {m.role === "assistant" ? (
                        <Markdown content={m.content} />
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                      )}
                    </div>
                  </div>
                ))}
                {busy && (
                  <div className="flex gap-3">
                    <div className="h-7 w-7 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="bg-card border border-border rounded-lg px-4 py-3 text-sm">
                      <span className="inline-flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse"
                          style={{ animationDelay: "150ms" }}
                        />
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse"
                          style={{ animationDelay: "300ms" }}
                        />
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border p-4">
            <div className="max-w-3xl mx-auto">
              {active && active.messages.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {SUGGESTIONS.slice(0, 3).map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      disabled={busy}
                      className="text-xs px-3 py-1.5 rounded-full bg-secondary/60 hover:bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="relative"
              >
                <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                <Input
                  placeholder="Ask about your trades..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={busy}
                  className="pl-10 pr-12 bg-input/50 h-12"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={busy || !input.trim()}
                  className="absolute right-1.5 top-1.5 h-9 w-9"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
