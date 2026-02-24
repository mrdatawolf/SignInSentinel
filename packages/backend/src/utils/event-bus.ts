import { EventEmitter } from "events";

export const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);

export function emitSSE(type: string, payload: unknown) {
  eventBus.emit("sse", {
    type,
    timestamp: new Date().toISOString(),
    payload,
  });
}
