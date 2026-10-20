import { cardsServiceUrl } from '../../../lib/cards-service';
import { NextRequest, NextResponse } from 'next/server';


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, ...sharebackData } = body;

    if (!slug) {
      return NextResponse.json(
        {
          type: 'https://tools.ietf.org/html/rfc7807',
          title: 'Bad Request',
          status: 400,
          detail: 'Card slug is required',
        },
        { status: 400, headers: { 'Content-Type': 'application/problem+json' } }
      );
    }

    const clientIp =
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      '127.0.0.1';

    const idempotencyKey = req.headers.get('idempotency-key') || req.headers.get('Idempotency-Key');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-forwarded-for': clientIp,
    };
    if (idempotencyKey) {
      headers['idempotency-key'] = idempotencyKey;
    }

    const res = await fetch(`${cardsServiceUrl()}/public/c/${slug}/shareback`, {
      method: 'POST',
      headers,
      body: JSON.stringify(sharebackData),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || (res.ok ? 'application/json' : 'application/problem+json'),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit share-back';
    return NextResponse.json(
      {
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Internal Server Error',
        status: 500,
        detail: message,
      },
      { status: 500, headers: { 'Content-Type': 'application/problem+json' } }
    );
  }
}
