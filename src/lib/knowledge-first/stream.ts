import type { KnowledgeAnswer } from "./types.ts";

// Validate the full answer before any factual text is streamed to the browser.
// Status events keep the connection responsive while retrieval/research runs.
export function knowledgeResponse(work: () => Promise<KnowledgeAnswer>, streaming: boolean) {
  if (!streaming) return work().then((answer) => Response.json(answer, { headers: { "Cache-Control": "no-store" } }));
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`));
      send("status", { message: "Checking authorized knowledge and sources…" });
      const heartbeat = setInterval(() => send("status", { message: "Reviewing source support…" }), 10000);
      try {
        const result = await work();
        send("metadata", result.metadata);
        for (const text of result.answer.match(/[\s\S]{1,160}(?:\s|$)/g) ?? [result.answer]) send("delta", { text });
        send("complete", result);
      } catch { send("error", { error: "The assistant could not verify workspace information. Please try again." }); }
      finally { clearInterval(heartbeat); controller.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
