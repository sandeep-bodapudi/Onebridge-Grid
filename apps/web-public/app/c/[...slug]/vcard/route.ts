import { NextRequest } from 'next/server';

const CARDS_SERVICE_URL = process.env.CARDS_SERVICE_URL || 'http://localhost:4002';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const slugPath = params.slug.join('/');

  try {
    const res = await fetch(`${CARDS_SERVICE_URL}/public/c/${slugPath}/vcard`);

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          type: 'https://tools.ietf.org/html/rfc7807',
          title: 'Not Found',
          status: 404,
          detail: `vCard for slug '${slugPath}' not found or inactive`,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/problem+json' },
        }
      );
    }

    const vcardText = await res.text();
    const contentDisposition = res.headers.get('content-disposition') || `attachment; filename="${params.slug[params.slug.length - 1] || 'contact'}.vcf"`;

    return new Response(vcardText, {
      status: 200,
      headers: {
        'Content-Type': 'text/vcard; charset=utf-8',
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  } catch {
    return new Response(
      JSON.stringify({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Service Unavailable',
        status: 503,
        detail: 'Cards service temporarily unavailable',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/problem+json' },
      }
    );
  }
}
