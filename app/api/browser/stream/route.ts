import { browserEvents, isBrowserOpen } from "@/lib/browser-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();
  let cleanedUp = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (obj: Record<string, unknown>) => {
        if (cleanedUp) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          cleanup();
        }
      };

      send({ type: "status", status: isBrowserOpen() ? "open" : "closed" });

      const onFrame = (data: string) => send({ type: "frame", data });
      const onOpen = () => send({ type: "status", status: "open" });
      const onClose = () => send({ type: "status", status: "closed" });

      browserEvents.on("frame", onFrame);
      browserEvents.on("open", onOpen);
      browserEvents.on("close", onClose);

      const heartbeat = setInterval(() => {
        if (cleanedUp) { clearInterval(heartbeat); return; }
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          cleanup();
        }
      }, 15000);

      function cleanup() {
        if (cleanedUp) return;
        cleanedUp = true;
        clearInterval(heartbeat);
        browserEvents.off("frame", onFrame);
        browserEvents.off("open", onOpen);
        browserEvents.off("close", onClose);
      }

      // Store cleanup ref for cancel
      Object.assign(controller, { _cleanup: cleanup });
    },
    cancel(controller) {
      cleanedUp = true;
      const c = (controller as unknown as { _cleanup?: () => void })?._cleanup;
      if (c) c();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
