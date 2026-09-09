import type Anthropic from "@anthropic-ai/sdk";

import { COACH_SYSTEM_PROMPT } from "./prompt";
import type { CoachMessage } from "./types";

/**
 * Claude model used for coaching. Haiku is fast and cheap (~1/4 cost of Sonnet)
 * and sufficient for game analysis and coaching advice.
 */
export const COACH_MODEL = "claude-haiku-4-5-20251001";

/**
 * Maximum response length. The system prompt caps responses at ~700 words, so
 * 2048 tokens leaves plenty of headroom without enabling rambling.
 */
export const COACH_MAX_TOKENS = 2048;

/** Hard cap on conversation history to keep request sizes bounded. */
export const COACH_MAX_HISTORY = 20;

/**
 * Hard caps on inbound size. The coach Function URL is unauthenticated, so these
 * are the only thing standing between a stranger and an unbounded Anthropic bill:
 * without them a caller could POST megabytes of `context` and have it billed as
 * input tokens on every turn.
 */
export const COACH_MAX_CONTEXT_CHARS = 24_000;
export const COACH_MAX_MESSAGE_CHARS = 8_000;
export const COACH_MAX_TOTAL_MESSAGE_CHARS = 40_000;

/**
 * Build the Anthropic `messages.stream` parameters from the client payload.
 *
 * The persona prompt + analytics context are both marked with
 * `cache_control: { type: "ephemeral" }`. Because the context block is
 * identical across every turn of a single coaching session, the second
 * message onward hits the prompt cache and reads ~10% of the normal token cost.
 */
export function buildCoachRequest(
  context: string,
  messages: CoachMessage[]
): Anthropic.Messages.MessageCreateParamsStreaming {
  const trimmed = messages.slice(-COACH_MAX_HISTORY).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  return {
    model: COACH_MODEL,
    max_tokens: COACH_MAX_TOKENS,
    stream: true,
    system: [
      {
        type: "text",
        text: COACH_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: `User analytics summary:\n\n${context}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: trimmed,
  };
}

/** Validate the inbound JSON payload. Throws a user-facing error on failure. */
export function parseCoachBody(raw: unknown): {
  context: string;
  messages: CoachMessage[];
} {
  if (!raw || typeof raw !== "object") {
    throw new Error("Request body must be a JSON object.");
  }
  const body = raw as Record<string, unknown>;

  const context = body.context;
  if (typeof context !== "string" || context.trim().length === 0) {
    throw new Error("Missing 'context' (analytics summary).");
  }
  if (context.length > COACH_MAX_CONTEXT_CHARS) {
    throw new Error(`'context' exceeds ${COACH_MAX_CONTEXT_CHARS} characters.`);
  }

  const rawMessages = body.messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    throw new Error("Missing 'messages' (non-empty array).");
  }
  if (rawMessages.length > COACH_MAX_HISTORY) {
    throw new Error(`'messages' exceeds ${COACH_MAX_HISTORY} entries.`);
  }

  let totalChars = 0;
  const messages: CoachMessage[] = [];
  for (const m of rawMessages) {
    if (!m || typeof m !== "object") {
      throw new Error("Each message must be an object with role + content.");
    }
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") {
      throw new Error("Message role must be 'user' or 'assistant'.");
    }
    if (typeof content !== "string" || content.length === 0) {
      throw new Error("Message content must be a non-empty string.");
    }
    if (content.length > COACH_MAX_MESSAGE_CHARS) {
      throw new Error(`A message exceeds ${COACH_MAX_MESSAGE_CHARS} characters.`);
    }
    totalChars += content.length;
    if (totalChars > COACH_MAX_TOTAL_MESSAGE_CHARS) {
      throw new Error(`Conversation exceeds ${COACH_MAX_TOTAL_MESSAGE_CHARS} characters.`);
    }
    messages.push({ role, content });
  }

  if (messages[messages.length - 1]!.role !== "user") {
    throw new Error("Last message must be from the user.");
  }

  return { context, messages };
}

/** Serialise an SSE event line-pair for either handler to emit. */
export function sseEvent(type: string, data: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}
