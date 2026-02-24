import { Router, Request, Response } from "express";
import { eventBus } from "../utils/event-bus";

const router = Router();

router.get("/events", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const handler = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  eventBus.on("sse", handler);

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 30000);

  req.on("close", () => {
    eventBus.off("sse", handler);
    clearInterval(heartbeat);
  });
});

export default router;
