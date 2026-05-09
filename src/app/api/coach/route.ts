import Anthropic from "@anthropic-ai/sdk";
import { type NextRequest, NextResponse } from "next/server";

import { buildCoachRequest, parseCoachBody, sseEvent } from "@/lib/coach/request";

/**
 * Dev-mode Next.js Route Handler for the AI chess coach. In production the
 * Lambda at `src/lambda/coach-handler.ts` handles `/api/coach` via CloudFront —
 * this file exists so `npm run dev` and static-export builds work without the
 * full AWS stack.
 */
export const dynamic = "force-static";

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

export async function POST(request: NextRequest) {
  // During `next build --output=export` this handler is pre-rendered. Return a
  // harmless placeholder; at runtime the Lambda is what actually serves /api/coach.
  if (process.env.NEXT_EXPORT === "1") {
    return NextResponse.json({ error: "Static export placeholder." }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body is not valid JSON." }, { status: 400 });
  }

  let context: string;
  let messages: ReturnType<typeof parseCoachBody>["messages"];
  try {
    ({ context, messages } = parseCoachBody(raw));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const anthropicStream = client().messages.stream(
          buildCoachRequest(context, messages)
        );
        for await (const chunk of anthropicStream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta" &&
            chunk.delta.text
          ) {
            controller.enqueue(encoder.encode(sseEvent("delta", { text: chunk.delta.text })));
          }
        }
        controller.enqueue(encoder.encode(sseEvent("done", {})));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Coach API failed";
        controller.enqueue(encoder.encode(sseEvent("error", { message: msg })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
