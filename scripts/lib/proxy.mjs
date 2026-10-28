/**
 * The one-port router's proxying, shared by demo-server.mjs (hosted prototype) and prod-api.mjs
 * (VPS). Services listen on 127.0.0.1; the router forwards /<service>/... to them.
 */
import http from 'node:http';

const CRLF = '\r\n';

/** The visitor's address: the proxy in front (Caddy) sets X-Forwarded-For; otherwise the socket. */
function forwardedFor(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '');
}

export function proxy(req, res, port, upstreamPath, unavailableDetail = 'The service is starting. Try again in a moment.') {
  const headers = { ...req.headers, host: `127.0.0.1:${port}` };
  headers['x-forwarded-for'] = forwardedFor(req);
  const upstream = http.request({ host: '127.0.0.1', port, path: upstreamPath, method: req.method, headers }, (up) => {
    res.writeHead(up.statusCode || 502, up.headers);
    up.pipe(res);
  });
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/problem+json' });
    res.end(JSON.stringify({ title: 'Bad Gateway', status: 502, detail: unavailableDetail }));
  });
  req.pipe(upstream);
}

/** WebSocket upgrades (N08 /messaging/realtime): forwards the handshake, then pipes both sockets. */
export function proxyUpgrade(req, socket, head, port, upstreamPath) {
  const headers = { ...req.headers, host: `127.0.0.1:${port}` };
  headers['x-forwarded-for'] = forwardedFor(req);
  const upstream = http.request({ host: '127.0.0.1', port, path: upstreamPath, method: req.method, headers });
  upstream.on('upgrade', (res, upSocket, upHead) => {
    const lines = [`HTTP/1.1 ${res.statusCode} ${res.statusMessage}`];
    for (let i = 0; i < res.rawHeaders.length; i += 2) lines.push(`${res.rawHeaders[i]}: ${res.rawHeaders[i + 1]}`);
    socket.write(`${lines.join(CRLF)}${CRLF}${CRLF}`);
    if (upHead && upHead.length) socket.write(upHead);
    if (head && head.length) upSocket.write(head);
    upSocket.pipe(socket).pipe(upSocket);
    upSocket.on('error', () => socket.destroy());
    socket.on('error', () => upSocket.destroy());
  });
  upstream.on('response', (res) => {
    // The service refused the upgrade (bad ticket or origin): pass its status on.
    socket.end(`HTTP/1.1 ${res.statusCode} ${res.statusMessage}${CRLF}${CRLF}`);
  });
  upstream.on('error', () => socket.destroy());
  upstream.end();
}

/** True when every port answers below 500 within 2 seconds. */
export async function servicesAnswer(ports) {
  const checks = await Promise.all(
    ports.map(
      (port) =>
        new Promise((resolve) => {
          const r = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 2000 }, (res) => {
            res.resume();
            resolve(res.statusCode !== undefined && res.statusCode < 500);
          });
          r.on('error', () => resolve(false));
          r.on('timeout', () => {
            r.destroy();
            resolve(false);
          });
        })
    )
  );
  return checks;
}
