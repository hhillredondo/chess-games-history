import { describe, expect, it } from "vitest";

import {
  COACH_MAX_CONTEXT_CHARS,
  COACH_MAX_HISTORY,
  COACH_MAX_MESSAGE_CHARS,
  COACH_MAX_TOTAL_MESSAGE_CHARS,
  parseCoachBody,
} from "@/lib/coach/request";

/**
 * The coach Function URL is unauthenticated, so these size caps are the only
 * bound on how many input tokens a stranger can bill to the project's Anthropic
 * key. Each assertion here corresponds to a way that bill could be run up.
 */

const userMessage = (content: string) => ({ role: "user", content });
const validBody = (over: Record<string, unknown> = {}) => ({
  context: "summary",
  messages: [userMessage("hi")],
  ...over,
});

describe("parseCoachBody size limits", () => {
  it("accepts a well-formed body", () => {
    const { context, messages } = parseCoachBody(validBody());
    expect(context).toBe("summary");
    expect(messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("rejects an oversized context", () => {
    const context = "x".repeat(COACH_MAX_CONTEXT_CHARS + 1);
    expect(() => parseCoachBody(validBody({ context }))).toThrow(/context/i);
  });

  it("accepts a context exactly at the limit", () => {
    const context = "x".repeat(COACH_MAX_CONTEXT_CHARS);
    expect(() => parseCoachBody(validBody({ context }))).not.toThrow();
  });

  it("rejects a single oversized message", () => {
    const messages = [userMessage("x".repeat(COACH_MAX_MESSAGE_CHARS + 1))];
    expect(() => parseCoachBody(validBody({ messages }))).toThrow(/message/i);
  });

  it("rejects too many messages", () => {
    const messages = Array.from({ length: COACH_MAX_HISTORY + 1 }, () => userMessage("hi"));
    expect(() => parseCoachBody(validBody({ messages }))).toThrow(/messages/i);
  });

  it("rejects many individually-legal messages that are oversized in aggregate", () => {
    const each = "x".repeat(COACH_MAX_MESSAGE_CHARS);
    const count = Math.floor(COACH_MAX_TOTAL_MESSAGE_CHARS / COACH_MAX_MESSAGE_CHARS) + 1;
    const messages = Array.from({ length: count }, () => userMessage(each));
    expect(count).toBeLessThanOrEqual(COACH_MAX_HISTORY);
    expect(() => parseCoachBody(validBody({ messages }))).toThrow(/exceeds/i);
  });
});
