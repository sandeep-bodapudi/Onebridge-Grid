/**
 * F26: public company profile. The organization owns the company's own
 * details (name, about, website, social links); this holds what only the
 * public page needs: catalogue, services, portfolio, client logos,
 * documents, the people directory, enquiry routing and the SEO setting.
 */

export interface CatalogueItemProps {
  id: string;
  name: string;
  category?: string;
  description?: string;
  price?: string;
  priceOnRequest?: boolean;
  imageUrl?: string;
}

export interface CompanyServiceItemProps {
  id: string;
  name: string;
  description?: string;
}

export interface PortfolioItemProps {
  id: string;
  title: string;
  client?: string;
  description?: string;
  imageUrls?: string[];
  videoUrl?: string;
}

export interface ClientLogoProps {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface CompanyDocumentProps {
  id: string;
  title: string;
  url: string;
  sizeBytes?: number;
}

export interface CompanyProfileProps {
  tenantId: string;
  seoIndexable: boolean;
  products: CatalogueItemProps[];
  services: CompanyServiceItemProps[];
  portfolio: PortfolioItemProps[];
  clientLogos: ClientLogoProps[];
  documents: CompanyDocumentProps[];
  directory: { enabled: boolean; seatIds: string[] };
  enquiryRouting: { defaultSeatId?: string; branchSeats: Record<string, string> };
  updatedAt: string;
}

export class InvalidCompanyProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCompanyProfileError';
  }
}

export class CatalogueLimitError extends Error {
  constructor(public readonly limit: number) {
    super(
      limit === FREE_CATALOGUE_LIMIT
        ? `The free profile includes ${limit} catalogue items. Remove some or upgrade to Starter for more.`
        : `The Starter plan includes ${limit} catalogue items. Remove some or upgrade to Business for unlimited items.`
    );
    this.name = 'CatalogueLimitError';
  }
}

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const STARTER_CATALOGUE_LIMIT = 50;

export const FREE_CATALOGUE_LIMIT = 10;

/** Catalogue items allowed on a plan: 10 on the free profile (N02), 50 on Starter, unlimited (null) on Business and above. */
export function catalogueLimitFor(plan: string | undefined): number | null {
  if (plan === 'free') return FREE_CATALOGUE_LIMIT;
  return !plan || plan === 'starter' ? STARTER_CATALOGUE_LIMIT : null;
}

export function emptyCompanyProfile(tenantId: string, now: string): CompanyProfileProps {
  return {
    tenantId,
    seoIndexable: true,
    products: [],
    services: [],
    portfolio: [],
    clientLogos: [],
    documents: [],
    directory: { enabled: true, seatIds: [] },
    enquiryRouting: { branchSeats: {} },
    updatedAt: now,
  };
}

const VIDEO_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'vimeo.com', 'player.vimeo.com', 'www.vimeo.com'];

function httpsUrl(value: unknown, what: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new InvalidCompanyProfileError(`${what} must be a link`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new InvalidCompanyProfileError(`${what} is not a valid link`);
  }
  if (url.protocol !== 'https:') throw new InvalidCompanyProfileError(`${what} must start with https://`);
  return url.toString();
}

function text(value: unknown, max: number, what: string, required = false): string | undefined {
  if (value === undefined || value === null || value === '') {
    if (required) throw new InvalidCompanyProfileError(`${what} is required`);
    return undefined;
  }
  if (typeof value !== 'string') throw new InvalidCompanyProfileError(`${what} must be text`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new InvalidCompanyProfileError(`${what} is required`);
  if (trimmed.length > max) throw new InvalidCompanyProfileError(`${what} must be ${max} characters or fewer`);
  return trimmed || undefined;
}

function id(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(value) ? value : fallback;
}

/** Only YouTube and Vimeo may be embedded (the page's frame policy allows nothing else). */
export function embeddableVideoUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !VIDEO_HOSTS.includes(url.hostname)) return null;
    if (url.hostname === 'youtu.be') {
      const vid = url.pathname.slice(1);
      return /^[\w-]{6,20}$/.test(vid) ? `https://www.youtube-nocookie.com/embed/${vid}` : null;
    }
    if (url.hostname.endsWith('youtube.com')) {
      const vid = url.searchParams.get('v') || (url.pathname.startsWith('/embed/') ? url.pathname.split('/')[2] : '');
      return vid && /^[\w-]{6,20}$/.test(vid) ? `https://www.youtube-nocookie.com/embed/${vid}` : null;
    }
    const vimeoId = url.pathname.split('/').filter(Boolean).pop() ?? '';
    return /^\d{5,12}$/.test(vimeoId) ? `https://player.vimeo.com/video/${vimeoId}` : null;
  } catch {
    return null;
  }
}

/**
 * Validates and normalises settings sent by an admin. Throws
 * InvalidCompanyProfileError for bad items and CatalogueLimitError when the
 * plan's catalogue limit is exceeded.
 */
export function validateCompanyProfile(
  input: Partial<Omit<CompanyProfileProps, 'tenantId' | 'updatedAt'>>,
  plan: string | undefined
): Omit<CompanyProfileProps, 'tenantId' | 'updatedAt'> {
  const list = <T,>(value: unknown, what: string, max = 500): T[] => {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new InvalidCompanyProfileError(`${what} must be a list`);
    if (value.length > max) throw new InvalidCompanyProfileError(`${what} can have at most ${max} items`);
    return value as T[];
  };

  const products = list<Record<string, unknown>>(input.products, 'Products', 2000).map((p, i) => ({
    id: id(p.id, `p${i + 1}`),
    name: text(p.name, 120, 'Product name', true) as string,
    category: text(p.category, 60, 'Category'),
    description: text(p.description, 500, 'Product description'),
    price: p.priceOnRequest ? undefined : text(p.price, 40, 'Price'),
    priceOnRequest: Boolean(p.priceOnRequest) || undefined,
    imageUrl: httpsUrl(p.imageUrl, 'Product image'),
  }));
  const limit = catalogueLimitFor(plan);
  if (limit !== null && products.length > limit) throw new CatalogueLimitError(limit);

  const services = list<Record<string, unknown>>(input.services, 'Services', 200).map((s, i) => ({
    id: id(s.id, `s${i + 1}`),
    name: text(s.name, 120, 'Service name', true) as string,
    description: text(s.description, 500, 'Service description'),
  }));

  const portfolio = list<Record<string, unknown>>(input.portfolio, 'Portfolio', 100).map((w, i) => {
    const videoUrl = httpsUrl(w.videoUrl, 'Video link');
    if (videoUrl && !embeddableVideoUrl(videoUrl)) {
      throw new InvalidCompanyProfileError('Videos must be a YouTube or Vimeo link');
    }
    const images = list<unknown>(w.imageUrls, 'Images', 8).map((u) => httpsUrl(u, 'Image') as string).filter(Boolean);
    return {
      id: id(w.id, `w${i + 1}`),
      title: text(w.title, 120, 'Project title', true) as string,
      client: text(w.client, 120, 'Client'),
      description: text(w.description, 800, 'Project description'),
      imageUrls: images.length ? images : undefined,
      videoUrl,
    };
  });

  const clientLogos = list<Record<string, unknown>>(input.clientLogos, 'Clients', 60).map((c, i) => ({
    id: id(c.id, `c${i + 1}`),
    name: text(c.name, 80, 'Client name', true) as string,
    imageUrl: httpsUrl(c.imageUrl, 'Client logo'),
  }));

  const documents = list<Record<string, unknown>>(input.documents, 'Documents', 50).map((d, i) => {
    const url = httpsUrl(d.url, 'Document link');
    if (!url) throw new InvalidCompanyProfileError('Document link is required');
    if (!new URL(url).pathname.toLowerCase().endsWith('.pdf')) throw new InvalidCompanyProfileError('Documents must be PDF files');
    const size = d.sizeBytes === undefined || d.sizeBytes === null ? undefined : Number(d.sizeBytes);
    if (size !== undefined && (!Number.isFinite(size) || size < 0)) throw new InvalidCompanyProfileError('Document size is not valid');
    if (size !== undefined && size > MAX_DOCUMENT_BYTES) throw new InvalidCompanyProfileError('Documents must be 25 MB or smaller');
    return { id: id(d.id, `d${i + 1}`), title: text(d.title, 120, 'Document title', true) as string, url, sizeBytes: size };
  });

  const directoryIn = (input.directory ?? {}) as Partial<CompanyProfileProps['directory']>;
  const routingIn = (input.enquiryRouting ?? {}) as Partial<CompanyProfileProps['enquiryRouting']>;
  const branchSeats: Record<string, string> = {};
  for (const [branchId, seatId] of Object.entries(routingIn.branchSeats ?? {})) {
    if (typeof seatId === 'string' && seatId) branchSeats[branchId] = seatId;
  }

  return {
    seoIndexable: input.seoIndexable === undefined ? true : Boolean(input.seoIndexable),
    products,
    services,
    portfolio,
    clientLogos,
    documents,
    directory: {
      enabled: directoryIn.enabled === undefined ? true : Boolean(directoryIn.enabled),
      seatIds: Array.isArray(directoryIn.seatIds) ? directoryIn.seatIds.filter((s): s is string => typeof s === 'string') : [],
    },
    enquiryRouting: {
      defaultSeatId: typeof routingIn.defaultSeatId === 'string' && routingIn.defaultSeatId ? routingIn.defaultSeatId : undefined,
      branchSeats,
    },
  };
}
