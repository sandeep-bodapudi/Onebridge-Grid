import { NextResponse } from 'next/server';
import { cardsServiceUrl } from '../../../../lib/cards-service';

/** Counts the download in the cards service, then sends the visitor to the PDF. */
export async function GET(_req: Request, { params }: { params: { company: string; documentId: string } }) {
  const company = encodeURIComponent(params.company);
  const documentId = encodeURIComponent(params.documentId);
  try {
    const res = await fetch(`${cardsServiceUrl()}/public/o/${company}/documents/${documentId}`, {
      redirect: 'manual',
      cache: 'no-store',
    });
    const location = res.headers.get('location');
    if (res.status === 302 && location && location.startsWith('https://')) {
      return NextResponse.redirect(location, { status: 302, headers: { 'Cache-Control': 'no-store' } });
    }
  } catch {
    // fall through to not found
  }
  return new NextResponse('Document not found', { status: 404 });
}
