import { useEffect, useRef, useCallback } from "react";
import type { SSEEvent } from "@signin-sentinel/shared";
import { api } from "../services/api";

export function useSSE(onEvent: (event: SSEEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const url = api.getEventSourceUrl();
    const es = new EventSource(url);

    es.onmessage = (e) => {
      try {
        const data: SSEEvent = JSON.parse(e.data);
        onEventRef.current(data);
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      console.warn("SSE connection error, will auto-reconnect");
    };

    return () => {
      es.close();
    };
  }, []);
}
