import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import type { MessagingService } from '../application/messaging.service.js';
import type { Socket } from '../application/realtime-hub.js';

const PING_INTERVAL_MS = 25_000;
const MAX_FRAME_BYTES = 4 * 1024;

/**
 * N08 WebSocket endpoint at /realtime?ticket=<t>. Server frames are
 * RealtimeEvent; the client may send { type: 'typing', conversationId } and
 * { type: 'ping' }. Messages themselves are sent over HTTP (retries, idempotency).
 */
export function attachRealtime(server: HttpServer, messaging: MessagingService, allowedOrigins: string[]): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES });

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname !== '/realtime') return; // Not ours; other handlers may take it.
    const origin = req.headers.origin;
    // Browsers always send Origin; refuse pages from other sites (cross-site WebSocket hijacking).
    if (origin && !allowedOrigins.includes(origin.toLowerCase())) {
      socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }
    const scope = messaging.hub.redeem(url.searchParams.get('ticket') || '');
    if (!scope) {
      socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n');
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const client: Socket = { scope, send: (frame) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(frame)) };
      let alive = true;
      ws.on('pong', () => (alive = true));
      const timer = setInterval(() => {
        if (!alive) return ws.terminate();
        alive = false;
        ws.ping();
      }, PING_INTERVAL_MS);
      ws.on('message', (data) => {
        let frame: { type?: string; conversationId?: string };
        try {
          frame = JSON.parse(String(data));
        } catch {
          return;
        }
        if (frame.type === 'typing' && typeof frame.conversationId === 'string') void messaging.typing(scope, frame.conversationId).catch(() => undefined);
        else if (frame.type === 'ping') client.send({ type: 'pong' });
      });
      ws.on('close', () => {
        clearInterval(timer);
        void messaging.disconnected(client).catch(() => undefined);
      });
      void messaging.connected(client).catch(() => undefined);
    });
  });

  return wss;
}
