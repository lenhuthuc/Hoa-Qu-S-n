"use client";

import { useEffect, useRef } from "react";

type SSEHandler = (data: unknown) => void;

// event name → handler
type SSEHandlers = Record<string, SSEHandler>;

/**
 * Connects to /api/sse and dispatches incoming events to handlers.
 * Reconnects automatically on error (EventSource spec does this natively,
 * but we force-close & reopen on auth errors to pick up a refreshed token).
 */
export function useSSE(handlers: SSEHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/sse`;
    let es: EventSource;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;

      // Đọc token mới nhất mỗi lần connect (tránh dùng token cũ đã hết hạn)
      const token = typeof window !== "undefined" ? localStorage.getItem("hqs_token") : null;
      if (!token) return; // chưa đăng nhập → không kết nối

      es = new EventSource(`${url}?token=${encodeURIComponent(token)}`, { withCredentials: true });

      es.onerror = () => {
        es.close();
        if (!closed) retryTimer = setTimeout(connect, 5000);
      };

      Object.keys(handlersRef.current).forEach((event) => {
        es.addEventListener(event, (e: MessageEvent) => {
          try {
            handlersRef.current[event]?.(JSON.parse(e.data));
          } catch {}
        });
      });
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, []);
}
