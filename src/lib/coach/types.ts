export type CoachRole = "user" | "assistant";

export interface CoachMessage {
  role: CoachRole;
  content: string;
}

/**
 * Payload posted to `/api/coach`. The client computes the analytics summary
 * locally (we already hold every game in memory) and sends it as `context`.
 */
export interface CoachRequestBody {
  /**
   * Pre-serialised analytics summary for the current filtered game set. Built
   * by `buildCoachContext()` in `src/lib/analytics/coach-context.ts`.
   */
  context: string;
  /**
   * Conversation history. For the initial request this will typically be a
   * single user message like "Give me your top 3 recommendations".
   */
  messages: CoachMessage[];
}

/**
 * SSE event types streamed back to the client. Kept deliberately minimal — one
 * `delta` event per text chunk, then a single terminal `done` or `error`.
 */
export type CoachStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };
