import { NextRequest } from 'next/server';
import { isBotUserAgent } from '@onebridge/shared';

const CARDS_SERVICE_URL = process.env.CARDS_SERVICE_URL || 'http://localhost:4002';

export async function POST(request: NextRequest) {
  const userAgent = request.headers.get('user-agent');

  if (isBotUserAgent(userAgent)) {
    return Response.json(
      { ignored: true, reason: 'bot_filtered' },
      { status: 200 }
    );
  }

  try {
    const event = await request.json();
    const payload = Array.isArray(event) ? event : [event];

    await fetch(`${CARDS_SERVICE_URL}/analytics/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return Response.json({ success: true }, { status: 202 });
  } catch {
    return Response.json(
      {
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Bad Request',
        status: 400,
        detail: 'Invalid analytics event payload',
      },
      {
        status: 400,
        headers: { 'Content-Type': 'application/problem+json' },
      }
    );
  }
}
