'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../api-client';

export type RealtimeFrame = { type: string; conversationId?: string; [key: string]: unknown };
export type RealtimeStatus = 'connecting' | 'online' | 'offline';

/**
 * N08 realtime connection for one inbox (personal, or a company with asCompany).
 * Reconnects with backoff; after every (re)connect it emits { type: 'connected' }
 * so the page can reload anything it missed.
 */
export function useRealtime(asCompany: string | undefined, onFrame: (frame: RealtimeFrame) => void) {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const socket = useRef<WebSocket | null>(null);
  const handler = useRef(onFrame);
  handler.current = onFrame;

  useEffect(() => {
    let stopped = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const retryLater = () => {
      if (stopped) return;
      setStatus('offline');
      attempt += 1;
      timer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5)));
    };

    async function connect() {
      if (stopped) return;
      setStatus('connecting');
      try {
        const ws = await apiClient.openRealtime(asCompany);
        if (stopped) return ws.close();
        socket.current = ws;
        ws.onopen = () => {
          attempt = 0;
          setStatus('online');
          handler.current({ type: 'connected' });
        };
        ws.onmessage = (e) => {
          try {
            handler.current(JSON.parse(String(e.data)) as RealtimeFrame);
          } catch {
            // Ignore frames that are not JSON.
          }
        };
        ws.onclose = () => {
          socket.current = null;
          retryLater();
        };
      } catch {
        retryLater();
      }
    }

    void connect();
    const onOnline = () => {
      if (socket.current) return;
      clearTimeout(timer);
      void connect();
    };
    window.addEventListener('online', onOnline);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener('online', onOnline);
      socket.current?.close();
      socket.current = null;
    };
  }, [asCompany]);

  const lastTyping = useRef(0);
  /** Sends "typing" at most every 3 seconds. */
  const sendTyping = useCallback((conversationId: string) => {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || Date.now() - lastTyping.current < 3000) return;
    lastTyping.current = Date.now();
    ws.send(JSON.stringify({ type: 'typing', conversationId }));
  }, []);

  return { status, sendTyping };
}
