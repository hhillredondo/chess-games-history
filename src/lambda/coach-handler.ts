import Anthropic from "@anthropic-ai/sdk";

import { buildCoachRequest, parseCoachBody, sseEvent } from "../lib/coach/request";

/**
 * Lambda streaming handler for the AI chess coach.
 *
 * Uses AWS Lambda response streaming (exposed globally as `awslambda.streamifyResponse`)
 * so SSE tokens flow to the client as Claude emits them, rather than waiting for the
 * full completion. This matches the browser's EventSource-style consumption and keeps
 * perceived latency low for multi-paragraph coaching advice.
 *
 * The API key is read from the ANTHROPIC_API_KEY env var, which CDK populates from an
 * SSM Parameter Store entry at deploy time.
 */

// `awslambda` is a runtime-injected global on Node.js Lambdas; no types ship
// in aws-lambda. The shape below only covers the features we actually call.
type LambdaEvent = { body?: string; isBase64Encoded?: boolean; requestContext?: { http?: { method?: string } } };
type LambdaContext = Record<string, unknown>;
type StreamifyHandler = (
  event: LambdaEvent,
  responseStream: NodeJS.WritableStream & { setContentType: (type: string) => void },
  context: LambdaContext
) => Promise<void>;

declare const awslambda: {
  streamifyResponse: (handler: StreamifyHandler) => StreamifyHandler;
  HttpResponseStream: {
    from: (
      stream: NodeJS.WritableStream,
      metadata: { statusCode: number; headers?: Record<string, string> }
    ) => NodeJS.WritableStream & { setContentType: (type: string) => void };
  };
};

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY env var is not set.");
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

function parseEventBody(event: { body?: string; isBase64Encoded?: boolean }): unknown {
  if (!event.body) return undefined;
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Request body is not valid JSON.");
  }
}

export const handler = awslambda.streamifyResponse(async (event, responseStream) => {
  const method = event?.requestContext?.http?.method;

  if (method === "OPTIONS") {
    const preflight = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
    preflight.end();
    return;
  }

  if (method !== "POST") {
    const err = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
    err.write(JSON.stringify({ error: "Method Not Allowed. Use POST." }));
    err.end();
    return;
  }

  let parsed: unknown;
  try {
    parsed = parseEventBody(event);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid body";
    const err = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
    err.write(JSON.stringify({ error: msg }));
    err.end();
    return;
  }

  let context: string;
  let messages: ReturnType<typeof parseCoachBody>["messages"];
  try {
    ({ context, messages } = parseCoachBody(parsed));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid request";
    const err = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
    err.write(JSON.stringify({ error: msg }));
    err.end();
    return;
  }

  const sseStream = awslambda.HttpResponseStream.from(responseStream, {
    statusCode: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
    },
  });

  try {
    const stream = client().messages.stream(buildCoachRequest(context, messages));
    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta.type === "text_delta" &&
        chunk.delta.text
      ) {
        sseStream.write(sseEvent("delta", { text: chunk.delta.text }));
      }
    }
    sseStream.write(sseEvent("done", {}));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Coach API failed";
    sseStream.write(sseEvent("error", { message: msg }));
  } finally {
    sseStream.end();
  }
});
