import { NextRequest } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import crypto from 'node:crypto';

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATION_SIGNING_SECRET || 'dev-secret-minimum-32-characters-for-testing';

  const signature = request.headers.get('x-signature') || request.headers.get('x-revalidate-signature');
  const timestamp = request.headers.get('x-timestamp');

  if (!signature || !timestamp) {
    return new Response(
      JSON.stringify({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Unauthorized',
        status: 401,
        detail: 'Missing required revalidation authentication headers (X-Signature and X-Timestamp)',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/problem+json' },
      }
    );
  }

  const ts = parseInt(timestamp, 10);
  const now = Date.now();
  // 5 minute tolerance per ADR-0003
  if (isNaN(ts) || Math.abs(now - ts) > 5 * 60 * 1000) {
    return new Response(
      JSON.stringify({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Unauthorized',
        status: 401,
        detail: 'Revalidation timestamp is expired or outside 5 minute tolerance window',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/problem+json' },
      }
    );
  }

  const rawBody = await request.text();

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return new Response(
      JSON.stringify({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid HMAC signature',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/problem+json' },
      }
    );
  }

  let body: { path?: string; tag?: string; slug?: string } = {};
  try {
    body = JSON.parse(rawBody);
  } catch {
    // If not json, ignore
  }

  if (body.path) {
    revalidatePath(body.path);
  }
  if (body.slug) {
    revalidatePath(`/c/${body.slug}`);
    revalidateTag(`card-${body.slug}`);
  }
  if (body.tag) {
    revalidateTag(body.tag);
  }

  return Response.json({
    revalidated: true,
    path: body.path || (body.slug ? `/c/${body.slug}` : undefined),
    tag: body.tag,
    timestamp: now,
  });
}
