"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

import { buildCoachContext } from "@/lib/analytics/coach-context";
import type { CoachMessage } from "@/lib/coach/types";
import type { UnifiedGame } from "@/lib/types/unified-game";

interface CoachViewProps {
  games: UnifiedGame[];
  chesscom: string;
  lichess: string;
}

const INITIAL_USER_PROMPT =
  "Please produce my initial coaching report. Lead with a one-sentence headline, then 3–5 specific observations, then 3 concrete recommendations ranked by expected impact.";

export default function CoachView({ games, chesscom, lichess }: Readonly<CoachViewProps>) {
  const context = useMemo(
    () =>
      buildCoachContext(games, {
        chesscomUsername: chesscom || undefined,
        lichessUsername: lichess || undefined,
      }),
    [games, chesscom, lichess]
  );

  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [streaming, setStreaming] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [showContext, setShowContext] = useState(false);

  // Single in-flight request cancel handle
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (userContent: string) => {
      setError(null);
      const nextMessages: CoachMessage[] = [
        ...messages,
        { role: "user", content: userContent },
      ];
      setMessages(nextMessages);
      setStreaming("");
      setLoading(true);

      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;

      let accumulated = "";
      try {
        const res = await fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context, messages: nextMessages }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          throw new Error(
            `Coach API error (${res.status})${detail ? `: ${detail}` : ""}`
          );
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // SSE framing: events are separated by a blank line, fields by '\n'.
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sep: number;
          while ((sep = buffer.indexOf("\n\n")) >= 0) {
            const raw = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const parsed = parseSseBlock(raw);
            if (!parsed) continue;
            if (parsed.event === "delta") {
              const data = safeJson<{ text?: string }>(parsed.data);
              if (data?.text) {
                accumulated += data.text;
                setStreaming(accumulated);
              }
            } else if (parsed.event === "error") {
              const data = safeJson<{ message?: string }>(parsed.data);
              throw new Error(data?.message ?? "Coach API returned an error.");
            }
          }
        }

        setMessages([...nextMessages, { role: "assistant", content: accumulated }]);
        setStreaming("");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        // Keep streamed-so-far text as a pseudo-assistant message, so the user
        // doesn't lose partial advice on network hiccups.
        if (accumulated) {
          setMessages([
            ...nextMessages,
            { role: "assistant", content: accumulated },
          ]);
          setStreaming("");
        } else {
          // Remove the optimistic user turn so the user can edit + retry
          setMessages(messages);
        }
      } finally {
        setLoading(false);
      }
    },
    [context, messages]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || loading) return;
      setInput("");
      void sendMessage(trimmed);
    },
    [input, loading, sendMessage]
  );

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setStreaming("");
    setError(null);
    setInput("");
    setLoading(false);
  }, []);

  if (games.length === 0) {
    return (
      <p className="p-8 text-center opacity-70">
        No games in the current filter. Adjust filters to get coaching on a
        specific slice of your history.
      </p>
    );
  }

  const hasConversation = messages.length > 0 || streaming.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">AI Chess Coach</h1>
        <p className="text-sm opacity-70">
          Advice grounded in {games.length.toLocaleString()} of your own games.
          Ask follow-ups after the initial report.
        </p>
      </header>

      {!hasConversation && (
        <button
          type="button"
          onClick={() => {
            if (loading) return;
            void sendMessage(INITIAL_USER_PROMPT);
          }}
          disabled={loading}
          className="self-start rounded-xl border-2 border-[var(--foreground)] px-5 py-3 font-mono text-sm hover:opacity-80 disabled:opacity-40"
        >
          {loading ? "Thinking…" : "Get coaching advice"}
        </button>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border-2 border-red-500 px-4 py-3 text-sm"
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {hasConversation && (
        <div className="flex flex-col gap-6">
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} content={m.content} />
          ))}
          {streaming && <Bubble role="assistant" content={streaming} streaming />}
        </div>
      )}

      {hasConversation && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <label htmlFor="coach-input" className="sr-only">
            Ask a follow-up question
          </label>
          <textarea
            id="coach-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            rows={2}
            placeholder="Ask a follow-up… (Shift+Enter for newline)"
            disabled={loading}
            className="w-full resize-y rounded-lg border-2 border-[var(--foreground)] bg-[var(--background)] px-3 py-2 font-mono text-sm disabled:opacity-60"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading || input.trim().length === 0}
              className="rounded-lg border-2 border-[var(--foreground)] px-4 py-2 font-mono text-sm hover:opacity-80 disabled:opacity-40"
            >
              {loading ? "Thinking…" : "Send"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={loading && streaming.length === 0}
              className="rounded-lg border-2 border-[var(--foreground)] px-4 py-2 font-mono text-sm opacity-70 hover:opacity-100 disabled:opacity-40"
            >
              Start over
            </button>
          </div>
        </form>
      )}

      <details
        open={showContext}
        onToggle={(e) => setShowContext((e.target as HTMLDetailsElement).open)}
        className="mt-4 rounded-lg border-2 border-[var(--foreground)] p-4 text-sm"
      >
        <summary className="cursor-pointer font-mono opacity-70 hover:opacity-100">
          View analytics summary sent to the coach ({context.length.toLocaleString()} chars)
        </summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed opacity-80">
          {context}
        </pre>
      </details>
    </div>
  );
}

function Bubble({
  role,
  content,
  streaming,
}: Readonly<{ role: "user" | "assistant"; content: string; streaming?: boolean }>) {
  const isUser = role === "user";
  return (
    <div
      className={`rounded-xl border-2 p-4 ${
        isUser
          ? "self-end max-w-[85%] border-[var(--foreground)] bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]"
          : "border-[var(--foreground)]"
      }`}
    >
      <div className="mb-1 font-mono text-xs uppercase opacity-60">
        {isUser ? "You" : "Coach"}
        {streaming ? " · streaming" : ""}
      </div>
      {isUser ? (
        <p className="whitespace-pre-wrap text-sm">{content}</p>
      ) : (
        <div className="prose-coach text-sm leading-relaxed">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

function safeJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
