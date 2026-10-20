export interface ShortLinkKvEntry {
  code: string;
  destinationUrl: string;
  status: 'active' | 'disabled' | 'unactivated' | 'pending_approval';
  targetType: 'card' | 'company' | 'branch' | 'external';
  targetId: string;
  tenantId: string;
  source?: string;
  cachedAt?: number;
}

export interface EdgeWorkerEnv {
  SHORTLINK_KV: {
    get: (key: string) => Promise<string | null>;
    put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
  };
  ANALYTICS_ENDPOINT: string;
  ORIGIN_BASE_URL: string;
}

export interface ExecutionContext {
  waitUntil: (promise: Promise<unknown>) => void;
}

const CACHE_MAX_AGE_MS = 60 * 1000; // 60 seconds per ADR-0003

/**
 * HTML content for neutral inactive page.
 * Strictly contains NO personal data (person name, email, phone, company internal IDs).
 */
export const NEUTRAL_INACTIVE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Card Inactive | OneBridge Grid</title>
  <style>
    :root {
      --bg: #FAF7F2;
      --card-bg: #FFFFFF;
      --text: #1B2A4A;
      --muted: #6B7280;
      --border: #E5E7EB;
      --accent: #F68713;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 40px 32px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 4px 12px rgba(27, 42, 74, 0.05);
    }
    .icon {
      width: 56px;
      height: 56px;
      margin: 0 auto 20px;
      background: #F3F4F6;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--muted);
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 12px;
      color: var(--text);
    }
    p {
      font-size: 14px;
      line-height: 1.5;
      color: var(--muted);
      margin-bottom: 24px;
    }
    .footer {
      font-size: 11px;
      color: #9CA3AF;
      letter-spacing: 0.5px;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    </div>
    <h1>Card or Link Inactive</h1>
    <p>This OneBridge Grid card or link is currently inactive, disabled, or not yet activated. Please contact the company or cardholder directly for assistance.</p>
    <div class="footer">ONEBRIDGE GRID &bull; DIGITAL BUSINESS IDENTITY</div>
  </div>
</body>
</html>`;

export async function handleShortLinkRequest(
  request: Request,
  env: EdgeWorkerEnv,
  ctx?: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  // Matches /r/<8 char code> or /<8 char code>
  const match = /^\/(?:r\/)?([0-9a-zA-Z]{8})$/.exec(url.pathname);

  if (!match) {
    return new Response(NEUTRAL_INACTIVE_HTML, {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const code = match[1];
  const kvKey = `link:${code}`;

  let entry: ShortLinkKvEntry | null = null;

  // 1. Read from fast edge KV cache
  try {
    const raw = await env.SHORTLINK_KV.get(kvKey);
    if (raw) {
      entry = JSON.parse(raw);
    }
  } catch {
    // If KV fails, fallback to origin below
  }

  // 2. Check if cached entry is stale (> 60 seconds) or missing
  const now = Date.now();
  const isStale = !entry || (entry.cachedAt && now - entry.cachedAt > CACHE_MAX_AGE_MS);

  if (isStale) {
    try {
      const originRes = await fetch(`${env.ORIGIN_BASE_URL}/links/${code}`);
      if (originRes.ok) {
        const fresh = await originRes.json() as ShortLinkKvEntry;
        fresh.cachedAt = now;
        entry = fresh;

        // Populate / refresh KV cache asynchronously
        const putPromise = env.SHORTLINK_KV.put(kvKey, JSON.stringify(fresh), {
          expirationTtl: 86400,
        }).catch(() => {});

        if (ctx) {
          ctx.waitUntil(putPromise);
        }
      }
    } catch {
      // If origin is down, retain stale entry if available (AC-2)
    }
  }

  // 3. If still no entry, return 404 neutral inactive page
  if (!entry) {
    return new Response(NEUTRAL_INACTIVE_HTML, {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // 4. If status is disabled, unactivated, or pending approval -> neutral inactive page (AC-3)
  if (entry.status !== 'active') {
    return new Response(NEUTRAL_INACTIVE_HTML, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // 5. Send asynchronous non-blocking analytics event to POST /analytics/events (AC-8)
  const analyticsPromise = sendScanAnalytics(request, entry, env).catch(() => {});
  if (ctx) {
    ctx.waitUntil(analyticsPromise);
  }

  // 6. Return 302 redirect immediately (AC-2: < 100ms)
  return new Response(null, {
    status: 302,
    headers: {
      Location: entry.destinationUrl,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

export function parseDeviceType(userAgent: string): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
  if (!userAgent || userAgent === 'unknown') return 'unknown';
  const ua = userAgent.toLowerCase();
  if (/(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(ip|ap|wp))))/i.test(ua)) {
    return 'tablet';
  }
  if (/(mobi|ipod|phone|blackberry|opera mini|fennec|minimo|symbian|psp|nintendo ds)/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

async function sendScanAnalytics(
  request: Request,
  entry: ShortLinkKvEntry,
  env: EdgeWorkerEnv
): Promise<void> {
  const userAgent = request.headers.get('User-Agent') || '';
  const deviceType = parseDeviceType(userAgent);

  const eventPayload = [
    {
      eventId: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      eventType: 'qr_scanned',
      timestamp: new Date().toISOString(),
      tenantId: entry.tenantId,
      properties: {
        code: entry.code,
        targetType: entry.targetType,
        targetId: entry.targetId,
        source: entry.source || 'default',
        deviceType,
      },
    },
  ];

  await fetch(env.ANALYTICS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventPayload),
  });
}

export default {
  fetch(request: Request, env: EdgeWorkerEnv, ctx?: ExecutionContext): Promise<Response> {
    return handleShortLinkRequest(request, env, ctx);
  },
};
