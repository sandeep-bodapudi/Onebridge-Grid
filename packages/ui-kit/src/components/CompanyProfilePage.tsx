import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Download,
  FileText,
  Globe,
  MapPin,
  Navigation,
  Play,
  SearchX,
  Send,
  WifiOff,
  X,
} from 'lucide-react';
import { KeystoneTag } from './KeystoneTag';
import { avatarColour, initialsOf } from './AppShell';

/* ------------------------------------------------------------------ */
/* Data shapes (mirror PublicCompanyProfile in api-contracts)          */
/* ------------------------------------------------------------------ */

export interface CompanyProfileData {
  status: 'active' | 'lapsed';
  company: {
    id?: string;
    name: string;
    slug: string;
    businessId: string;
    verifiedBadge: boolean;
    logo?: string;
    brandColours?: { band: string; accent?: string; text: string };
    industry?: string;
    city?: string;
    about?: string;
    website?: string;
    gstin?: string;
    socialLinks?: Record<string, string>;
  };
  seoIndexable: boolean;
  /** False when nobody can receive an enquiry yet (N02 free profile without people); enquiry buttons are hidden. */
  acceptsEnquiries?: boolean;
  focusBranchId?: string;
  branches: Array<{ id: string; name: string; address?: string; directionsUrl?: string }>;
  people: Array<{ name: string; designation: string; branchName?: string; photoUrl?: string; cardUrl: string }>;
  products: Array<{ id: string; name: string; category?: string; description?: string; price?: string; priceOnRequest?: boolean; imageUrl?: string }>;
  services: Array<{ id: string; name: string; description?: string }>;
  portfolio: Array<{ id: string; title: string; client?: string; description?: string; imageUrls?: string[]; videoUrl?: string }>;
  clientLogos: Array<{ id: string; name: string; imageUrl?: string }>;
  documents: Array<{ id: string; title: string; sizeBytes?: number; downloadUrl: string }>;
}

export interface CompanyEnquiryData {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  message?: string;
  productId?: string;
  branchId?: string;
  consent: boolean;
}

export interface CompanyProfilePageProps {
  data?: CompanyProfileData;
  state?: 'ready' | 'loading' | 'not_found';
  privacyNoticeUrl?: string;
  onEnquirySubmit?: (data: CompanyEnquiryData) => Promise<{ success: boolean; message?: string } | void>;
  onDocumentClick?: (documentId: string) => void;
  /** Extra hero buttons, such as Follow (N04). */
  heroActions?: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

const copy = {
  en: {
    verified: 'Verified',
    verifiedLabel: 'Verified business',
    notVerified: 'Not verified yet',
    enquire: 'Send an enquiry',
    enquireShort: 'Enquire',
    website: 'Website',
    directions: 'Directions',
    about: 'About',
    products: 'Products',
    services: 'Services',
    work: 'Our work',
    clients: 'Clients',
    people: 'People',
    branches: 'Branches',
    documents: 'Documents',
    all: 'All',
    priceOnRequest: 'Price on request',
    playVideo: 'Play video',
    viewCard: 'View card',
    download: 'Download',
    scannedHere: 'You scanned this branch',
    lapsed: 'This page is showing basic details only.',
    madeWith: 'Website by OneBridge Grid',
    contactTitle: 'Talk to us',
    contactBody: (company: string) => `Tell ${company} what you need and the right person will call you back.`,
    sheetTitle: 'Send an enquiry',
    sheetSubtitle: (company: string) => `${company} will get your details and call you back.`,
    about_item: 'About',
    name: 'Your name',
    phone: 'Mobile number',
    email: 'Email (optional)',
    yourCompany: 'Your company (optional)',
    message: 'What do you need?',
    branch: 'Nearest branch',
    anyBranch: 'Any branch',
    consent: 'I agree to share my details with this company',
    privacy: 'Privacy notice',
    send: 'Send enquiry',
    sending: 'Sending…',
    close: 'Close',
    nameRequired: 'Enter your name.',
    phoneRequired: 'Enter a mobile number with at least 8 digits.',
    consentRequired: 'Tick the box to agree to share your details.',
    offline: 'You are offline. Connect to the internet and try again.',
    failed: 'Could not send your enquiry. Try again.',
    successTitle: 'Enquiry sent',
    successBody: (company: string) => `${company} has your details and will be in touch.`,
    done: 'Done',
    notFoundTitle: 'Company page not found',
    notFoundBody: 'Check the link or scan the code again.',
    switchLang: 'Switch to Hindi (हिंदी)',
  },
  hi: {
    verified: 'सत्यापित',
    verifiedLabel: 'सत्यापित व्यवसाय',
    notVerified: 'अभी सत्यापित नहीं',
    enquire: 'पूछताछ भेजें',
    enquireShort: 'पूछें',
    website: 'वेबसाइट',
    directions: 'रास्ता',
    about: 'परिचय',
    products: 'उत्पाद',
    services: 'सेवाएँ',
    work: 'हमारा काम',
    clients: 'ग्राहक',
    people: 'टीम',
    branches: 'शाखाएँ',
    documents: 'दस्तावेज़',
    all: 'सभी',
    priceOnRequest: 'कीमत पूछें',
    playVideo: 'वीडियो चलाएँ',
    viewCard: 'कार्ड देखें',
    download: 'डाउनलोड',
    scannedHere: 'आपने इस शाखा का कोड स्कैन किया',
    lapsed: 'यह पेज अभी केवल बुनियादी जानकारी दिखा रहा है।',
    madeWith: 'वेबसाइट: OneBridge Grid',
    contactTitle: 'हमसे बात करें',
    contactBody: (company: string) => `${company} को बताएँ कि आपको क्या चाहिए, सही व्यक्ति आपको कॉल करेगा।`,
    sheetTitle: 'पूछताछ भेजें',
    sheetSubtitle: (company: string) => `${company} को आपका विवरण मिलेगा और वे आपको कॉल करेंगे।`,
    about_item: 'विषय',
    name: 'आपका नाम',
    phone: 'मोबाइल नंबर',
    email: 'ईमेल (वैकल्पिक)',
    yourCompany: 'आपकी कंपनी (वैकल्पिक)',
    message: 'आपको क्या चाहिए?',
    branch: 'नज़दीकी शाखा',
    anyBranch: 'कोई भी शाखा',
    consent: 'मैं इस कंपनी के साथ अपना विवरण साझा करने के लिए सहमत हूँ',
    privacy: 'गोपनीयता सूचना',
    send: 'पूछताछ भेजें',
    sending: 'भेजा जा रहा है…',
    close: 'बंद करें',
    nameRequired: 'अपना नाम लिखें।',
    phoneRequired: 'कम से कम 8 अंकों का मोबाइल नंबर लिखें।',
    consentRequired: 'विवरण साझा करने के लिए सहमति दें।',
    offline: 'आप ऑफ़लाइन हैं। इंटरनेट से जुड़कर फिर कोशिश करें।',
    failed: 'पूछताछ नहीं भेजी जा सकी। फिर कोशिश करें।',
    successTitle: 'पूछताछ भेज दी गई',
    successBody: (company: string) => `${company} को आपका विवरण मिल गया है।`,
    done: 'ठीक है',
    notFoundTitle: 'कंपनी पेज नहीं मिला',
    notFoundBody: 'लिंक जाँचें या कोड फिर से स्कैन करें।',
    switchLang: 'Switch to English',
  },
};
type Copy = (typeof copy)['en'];

/** YouTube and Vimeo only; anything else is not embedded. */
export function videoEmbedUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.replace(/^(www|m)\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1);
      return /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1` : null;
    }
    if (host === 'youtube.com') {
      const id = url.searchParams.get('v') || (url.pathname.startsWith('/embed/') ? url.pathname.split('/')[2] : '');
      return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1` : null;
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = url.pathname.split('/').filter(Boolean).pop() ?? '';
      return /^\d{5,12}$/.test(id) ? `https://player.vimeo.com/video/${id}?autoplay=1` : null;
    }
    return null;
  } catch {
    return null;
  }
}

function formatSize(bytes?: number): string | null {
  if (!bytes) return null;
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Dark or light text for a fill colour, by relative brightness (hex only; anything else gets dark text). */
export function readableOn(hex: string): string {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim());
  if (!m) return '#241A10';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#241A10' : '#FFFFFF';
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export const CompanyProfilePage: React.FC<CompanyProfilePageProps> = ({
  data,
  state = 'ready',
  privacyNoticeUrl,
  onEnquirySubmit,
  onDocumentClick,
  heroActions,
}) => {
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const t: Copy = copy[lang];
  const [category, setCategory] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ productId?: string } | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', company: '', message: '', branchId: '', consent: false });
  const [errors, setErrors] = useState<{ name?: string; phone?: string; consent?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!sheet) return;
    sheetRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSheet(null);
        return;
      }
      if (e.key === 'Tab' && sheetRef.current) {
        const items = sheetRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea');
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      lastTrigger.current?.focus();
    };
  }, [sheet]);

  const categories = useMemo(
    () => Array.from(new Set((data?.products ?? []).map((p) => p.category).filter((c): c is string => Boolean(c)))),
    [data?.products]
  );

  if (state === 'loading') {
    return (
      <div className="min-h-screen w-full bg-warm-paper" aria-busy="true" data-testid="company-skeleton">
        <div className="h-72 bg-charcoal animate-pulse motion-reduce:animate-none" />
        <div className="max-w-[760px] mx-auto p-5 space-y-4">
          <div className="h-24 rounded-2xl bg-sand animate-pulse motion-reduce:animate-none" />
          <div className="h-40 rounded-2xl bg-sand animate-pulse motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  if (state === 'not_found' || !data) {
    return (
      <main className="min-h-screen w-full flex items-center justify-center bg-warm-paper p-6 text-charcoal">
        <div className="text-center max-w-sm space-y-3">
          <span className="mx-auto w-14 h-14 rounded-2xl bg-sand flex items-center justify-center">
            <SearchX className="w-6 h-6" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-bold">{t.notFoundTitle}</h1>
          <p className="text-sm text-charcoal/70">{t.notFoundBody}</p>
        </div>
      </main>
    );
  }

  const { company } = data;
  const lapsed = data.status === 'lapsed';
  const canEnquire = !lapsed && data.acceptsEnquiries !== false;
  const focusBranch = data.branches.find((b) => b.id === data.focusBranchId);
  const primaryBranch = focusBranch ?? data.branches[0];
  const band = company.brandColours?.band || '#272425';
  const bandText = company.brandColours?.text || '#FFFFFF';
  const products = category ? data.products.filter((p) => p.category === category) : data.products;
  const sheetProduct = sheet?.productId ? data.products.find((p) => p.id === sheet.productId) : undefined;

  const nav = [
    { id: 'products', label: t.products, show: data.products.length > 0 },
    { id: 'services', label: t.services, show: data.services.length > 0 },
    { id: 'work', label: t.work, show: data.portfolio.length > 0 },
    { id: 'people', label: t.people, show: data.people.length > 0 },
    { id: 'branches', label: t.branches, show: data.branches.length > 0 },
    { id: 'documents', label: t.documents, show: data.documents.length > 0 },
  ].filter((n) => n.show);

  const openSheet = (e: React.MouseEvent<HTMLElement>, productId?: string) => {
    lastTrigger.current = e.currentTarget;
    setSent(false);
    setFormError(null);
    setErrors({});
    setForm((f) => ({ ...f, branchId: f.branchId || data.focusBranchId || '' }));
    setSheet({ productId });
  };

  const validate = (f: typeof form) => ({
    name: f.name.trim() ? undefined : t.nameRequired,
    phone: f.phone.replace(/\D/g, '').length >= 8 ? undefined : t.phoneRequired,
    consent: f.consent ? undefined : t.consentRequired,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setFormError(t.offline);
      return;
    }
    const errs = validate(form);
    setErrors(errs);
    const first = errs.name || errs.phone || errs.consent;
    if (first) {
      setFormError(first);
      return;
    }
    setSubmitting(true);
    try {
      const res = await onEnquirySubmit?.({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        company: form.company.trim() || undefined,
        message: form.message.trim() || undefined,
        productId: sheet?.productId,
        branchId: form.branchId || undefined,
        consent: true,
      });
      if (res && res.success === false) {
        setFormError(res.message || t.failed);
        return;
      }
      setSent(true);
      setForm({ name: '', phone: '', email: '', company: '', message: '', branchId: form.branchId, consent: false });
    } catch {
      setFormError(t.failed);
    } finally {
      setSubmitting(false);
    }
  };

  const field = (key: 'name' | 'phone' | 'email' | 'company', label: string, type: string, autoComplete: string, required = false) => {
    const err = (errors as Record<string, string | undefined>)[key];
    return (
      <div className="space-y-1">
        <label htmlFor={`enquiry-${key}`} className="block text-sm font-semibold">
          {label}
          {required ? <span className="text-error" aria-hidden="true"> *</span> : null}
        </label>
        <input
          id={`enquiry-${key}`}
          type={type}
          autoComplete={autoComplete}
          inputMode={key === 'phone' ? 'tel' : undefined}
          aria-required={required || undefined}
          aria-invalid={err ? true : undefined}
          value={form[key]}
          onChange={(e) => {
            setForm({ ...form, [key]: e.target.value });
            if (err) setErrors({ ...errors, [key]: undefined });
          }}
          onBlur={() => {
            if ((key === 'name' || key === 'phone') && form[key]) setErrors((p) => ({ ...p, [key]: validate(form)[key] }));
          }}
          className={`w-full min-h-[48px] px-3 text-base rounded-control border bg-white text-charcoal focus:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange ${err ? 'border-error' : 'border-sand-border'}`}
        />
      </div>
    );
  };

  const accent = company.brandColours?.accent || '#F68713';
  const accentText = readableOn(accent);
  const sectionPad = 'scroll-mt-32 py-14 sm:py-20';
  const wrap = 'max-w-[1120px] mx-auto px-4 sm:px-6';
  const h2 = 'text-[28px] sm:text-[36px] leading-tight font-bold tracking-[-0.03em]';
  const facts = [
    { label: t.products, value: data.products.length },
    { label: t.branches, value: data.branches.length },
    { label: t.people, value: data.people.length },
  ].filter((f) => f.value > 0);
  const logoTile = (size: string, pad: string) => (
    <span className={`${size} rounded-[22%] bg-white overflow-hidden flex items-center justify-center shrink-0 shadow-[0_10px_30px_rgba(0,0,0,0.18)]`}>
      {company.logo ? (
        <img src={company.logo} alt={`${company.name} logo`} className={`w-full h-full object-contain ${pad}`} />
      ) : (
        <span className="font-bold text-[#2B2728]" aria-hidden="true">
          {initialsOf(company.name)}
        </span>
      )}
    </span>
  );

  return (
    <div className="min-h-screen w-full bg-[#FAF7F2] text-[#2B2728] font-body" lang={lang}>
      {/* Site header: the company's own top bar */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-[#E9E1D3]">
        <div className={`${wrap} h-16 flex items-center gap-3`}>
          <a href="#about" className="flex items-center gap-2.5 min-h-[44px] min-w-0 font-bold">
            {logoTile('w-9 h-9 text-xs', 'p-1')}
            <span className="truncate">{company.name}</span>
          </a>
          {nav.length > 0 ? (
            <nav aria-label="Page sections" className="hidden lg:flex items-center ml-6">
              {nav.map((n) => (
                <a key={n.id} href={`#${n.id}`} className="min-h-[44px] px-3 inline-flex items-center text-sm font-semibold text-[#5E5758] hover:text-[#2B2728]">
                  {n.label}
                </a>
              ))}
            </nav>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              data-testid="language-toggle"
              onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
              aria-label={t.switchLang}
              className="min-h-[44px] min-w-[44px] px-3 rounded-control border border-[#E3D9C8] text-xs font-bold hover:bg-[#F4EFE6]"
            >
              {lang === 'en' ? 'हिन्दी' : 'EN'}
            </button>
            {canEnquire ? (
              <button
                type="button"
                onClick={(e) => openSheet(e)}
                className="hidden sm:inline-flex min-h-[44px] px-4 rounded-control text-sm font-bold items-center gap-2 hover:opacity-90"
                style={{ background: accent, color: accentText }}
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                {t.enquire}
              </button>
            ) : null}
          </div>
        </div>
        {nav.length > 1 ? (
          <nav aria-label="Page sections, scrolling" className="lg:hidden border-t border-[#F0E9DD]">
            <ul className="max-w-[1120px] mx-auto px-2 flex gap-1 overflow-x-auto">
              {nav.map((n) => (
                <li key={n.id} className="shrink-0">
                  <a href={`#${n.id}`} className="min-h-[44px] px-3 inline-flex items-center text-sm font-semibold text-[#5E5758] hover:text-[#2B2728]">
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>

      {/* Hero, in the company's colours */}
      <header id="about" className="relative overflow-hidden scroll-mt-32" style={{ background: band, color: bandText }} data-testid="company-hero">
        <div className={`${wrap} grid lg:grid-cols-[1.5fr_1fr] gap-10 items-center pt-12 pb-14 sm:pt-16 sm:pb-20`}>
          <div className="ob-rise min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
              {company.verifiedBadge ? (
                <span data-testid="verified-tag" className="inline-flex">
                  <KeystoneTag
                    label={t.verified}
                    aria-label={t.verifiedLabel}
                    role="img"
                    className="bg-white text-[#10233A] border-0 text-[11px] px-2 py-0.5 [&_svg]:fill-[#3B6AA0]"
                  />
                </span>
              ) : (
                <span data-testid="not-verified-tag" className="rounded-md border border-current px-2 py-0.5 text-[11px] font-bold opacity-75">
                  {t.notVerified}
                </span>
              )}
              {[company.industry, company.city].filter(Boolean).length ? (
                <span className="opacity-90">{[company.industry, company.city].filter(Boolean).join(', ')}</span>
              ) : null}
            </div>
            <h1 className="mt-4 text-[40px] sm:text-[56px] lg:text-[64px] leading-[0.98] font-bold tracking-[-0.045em] break-words">{company.name}</h1>
            {company.about ? <p className="mt-5 text-[17px] leading-relaxed opacity-90 max-w-[56ch]">{company.about}</p> : null}
            <div className="mt-8 flex flex-wrap gap-2.5">
              {canEnquire ? (
                <button
                  type="button"
                  onClick={(e) => openSheet(e)}
                  className="min-h-[52px] px-6 rounded-[14px] font-bold text-[15px] inline-flex items-center gap-2 shadow-[0_10px_30px_rgba(0,0,0,0.2)] hover:opacity-90"
                  style={{ background: accent, color: accentText }}
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  {t.enquire}
                </button>
              ) : null}
              {primaryBranch?.directionsUrl ? (
                <a
                  href={primaryBranch.directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[52px] px-5 rounded-[14px] bg-white/10 border border-white/25 font-bold text-sm inline-flex items-center gap-2 hover:bg-white/20"
                >
                  <Navigation className="w-4 h-4" aria-hidden="true" />
                  {t.directions}
                </a>
              ) : null}
              {company.website ? (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[52px] px-5 rounded-[14px] bg-white/10 border border-white/25 font-bold text-sm inline-flex items-center gap-2 hover:bg-white/20"
                >
                  <Globe className="w-4 h-4" aria-hidden="true" />
                  {t.website}
                </a>
              ) : null}
              {heroActions}
            </div>
          </div>
          <div className="ob-rise ob-rise-1 flex lg:flex-col items-center lg:items-end gap-6">
            <span className="hidden lg:flex">{logoTile('w-40 h-40 text-4xl', 'p-5')}</span>
            {facts.length ? (
              <dl className="flex gap-8 lg:gap-10">
                {facts.map((f) => (
                  <div key={f.label} className="flex flex-col">
                    <dt className="order-2 text-xs font-semibold opacity-75">{f.label}</dt>
                    <dd className="order-1 text-3xl font-bold tracking-tight tabular-nums">{f.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </div>
        <span aria-hidden="true" data-span-line="true" className="absolute inset-x-0 bottom-0 h-[6px]" style={{ background: accent }} />
      </header>

      {lapsed ? (
        <div className={`${wrap} mt-4`}>
          <div role="status" className="px-4 py-3 rounded-xl bg-[#EFE8DC] text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            {t.lapsed}
          </div>
        </div>
      ) : null}

      <main className="pb-28 lg:pb-0">
        {data.products.length > 0 ? (
          <section id="products" aria-labelledby="products-title" className={`${sectionPad} bg-[#FAF7F2]`}>
            <div className={wrap}>
              <h2 id="products-title" className={h2}>
                {t.products}
              </h2>
              {categories.length > 1 ? (
                <div role="group" aria-label="Filter by category" className="mt-6 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {[null, ...categories].map((c) => (
                    <button
                      key={c ?? 'all'}
                      type="button"
                      aria-pressed={category === c}
                      onClick={() => setCategory(c)}
                      className={`shrink-0 min-h-[40px] px-4 rounded-full text-sm font-bold border ${
                        category === c ? 'bg-[#2B2728] text-[#FAF7F2] border-[#2B2728]' : 'bg-white border-[#E3D9C8] hover:border-[#2B2728]/40'
                      }`}
                    >
                      {c ?? t.all}
                    </button>
                  ))}
                </div>
              ) : null}
              <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((p) => (
                  <li key={p.id} className="rounded-[20px] bg-white border border-[#E9E1D3] overflow-hidden flex flex-col hover:shadow-[0_14px_40px_rgba(43,39,40,0.10)] transition-shadow">
                    {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full aspect-[4/3] object-cover bg-[#EFE8DC]" loading="lazy" /> : null}
                    <div className="p-5 flex flex-col gap-1.5 flex-1">
                      {p.category ? <span className="text-xs font-semibold text-[#6B6466]">{p.category}</span> : null}
                      <h3 className="text-lg font-bold leading-snug">{p.name}</h3>
                      {p.description ? <p className="text-sm text-[#5E5758] leading-relaxed">{p.description}</p> : null}
                      <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                        <span className="text-base font-bold">{p.priceOnRequest || !p.price ? t.priceOnRequest : p.price}</span>
                        {canEnquire ? (
                          <button
                            type="button"
                            onClick={(e) => openSheet(e, p.id)}
                            aria-label={`${t.enquireShort}: ${p.name}`}
                            className="min-h-[44px] px-4 rounded-xl text-sm font-bold hover:opacity-90"
                            style={{ background: band, color: bandText }}
                          >
                            {t.enquireShort}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {data.services.length > 0 ? (
          <section id="services" aria-labelledby="services-title" className={`${sectionPad} bg-white`}>
            <div className={wrap}>
              <h2 id="services-title" className={h2}>
                {t.services}
              </h2>
              <ul className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-x-10">
                {data.services.map((s) => (
                  <li key={s.id} className="py-5 border-t border-[#E9E1D3] flex gap-4">
                    <span aria-hidden="true" className="mt-2 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: accent }} />
                    <div>
                      <h3 className="text-lg font-bold">{s.name}</h3>
                      {s.description ? <p className="text-[15px] text-[#5E5758] mt-1 leading-relaxed">{s.description}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {data.portfolio.length > 0 ? (
          <section id="work" aria-labelledby="work-title" className={`${sectionPad} bg-[#FAF7F2]`}>
            <div className={wrap}>
              <h2 id="work-title" className={h2}>
                {t.work}
              </h2>
              <ul className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
                {data.portfolio.map((w) => {
                  const embed = videoEmbedUrl(w.videoUrl);
                  const cover = w.imageUrls?.[0];
                  return (
                    <li key={w.id} className="rounded-[20px] bg-white border border-[#E9E1D3] overflow-hidden">
                      {playing === w.id && embed ? (
                        <iframe src={embed} title={w.title} className="w-full aspect-video" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
                      ) : embed ? (
                        <button
                          type="button"
                          onClick={() => setPlaying(w.id)}
                          className="relative w-full aspect-video bg-[#2B2728] flex items-center justify-center group"
                          aria-label={`${t.playVideo}: ${w.title}`}
                        >
                          {cover ? <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" loading="lazy" /> : null}
                          <span
                            className="relative w-16 h-16 rounded-full flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform motion-reduce:transition-none"
                            style={{ background: accent }}
                          >
                            <Play className="w-6 h-6 ml-0.5" style={{ color: accentText }} aria-hidden="true" />
                          </span>
                        </button>
                      ) : cover ? (
                        <img src={cover} alt="" className="w-full aspect-video object-cover bg-[#EFE8DC]" loading="lazy" />
                      ) : null}
                      {w.imageUrls && w.imageUrls.length > 1 ? (
                        <div className="flex gap-1 px-1 pt-1 overflow-x-auto">
                          {w.imageUrls.slice(1).map((src) => (
                            <img key={src} src={src} alt="" className="h-14 w-20 object-cover rounded-md bg-[#EFE8DC] shrink-0" loading="lazy" />
                          ))}
                        </div>
                      ) : null}
                      <div className="p-5">
                        <h3 className="text-lg font-bold leading-snug">{w.title}</h3>
                        {w.client ? <p className="text-sm font-semibold text-[#6B6466] mt-0.5">{w.client}</p> : null}
                        {w.description ? <p className="text-[15px] text-[#5E5758] mt-2 leading-relaxed">{w.description}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        ) : null}

        {data.clientLogos.length > 0 ? (
          <section aria-labelledby="clients-title" className="py-12 bg-white border-y border-[#F0E9DD]">
            <div className={wrap}>
              <h2 id="clients-title" className="text-sm font-semibold text-[#6B6466]">
                {t.clients}
              </h2>
              <ul className="mt-5 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {data.clientLogos.map((c) => (
                  <li key={c.id} className="h-20 rounded-2xl bg-[#FAF7F2] flex items-center justify-center p-3 text-center">
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt={c.name} className="max-h-10 max-w-full object-contain" loading="lazy" />
                    ) : (
                      <span className="text-xs font-bold text-[#5E5758] leading-tight">{c.name}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {data.people.length > 0 ? (
          <section id="people" aria-labelledby="people-title" className={`${sectionPad} bg-[#FAF7F2]`}>
            <div className={wrap}>
              <h2 id="people-title" className={h2}>
                {t.people}
              </h2>
              <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {data.people.map((p) => (
                  <li key={p.cardUrl}>
                    <a href={p.cardUrl} className="h-full rounded-[20px] bg-white border border-[#E9E1D3] p-5 flex flex-col gap-3 hover:shadow-[0_14px_40px_rgba(43,39,40,0.10)] transition-shadow">
                      <span
                        className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 text-lg font-bold text-[#241A10]"
                        style={{ background: p.photoUrl ? undefined : avatarColour(p.name) }}
                      >
                        {p.photoUrl ? <img src={p.photoUrl} alt="" className="w-full h-full object-cover" /> : <span aria-hidden="true">{initialsOf(p.name)}</span>}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-bold text-lg leading-snug">{p.name}</span>
                        <span className="block text-sm text-[#5E5758]">{p.designation}</span>
                        {p.branchName ? <span className="block text-sm text-[#6B6466]">{p.branchName}</span> : null}
                      </span>
                      <span className="mt-auto text-sm font-bold underline underline-offset-4">{t.viewCard}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {data.branches.length > 0 ? (
          <section id="branches" aria-labelledby="branches-title" className={`${sectionPad} bg-white`}>
            <div className={wrap}>
              <h2 id="branches-title" className={h2}>
                {t.branches}
              </h2>
              <ul className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...data.branches]
                  .sort((a, b) => Number(b.id === data.focusBranchId) - Number(a.id === data.focusBranchId))
                  .map((b) => {
                    const focused = b.id === data.focusBranchId;
                    return (
                      <li
                        key={b.id}
                        data-focused={focused || undefined}
                        className={`rounded-[20px] bg-[#FAF7F2] border p-5 flex items-start gap-4 ${focused ? 'border-[#2B2728] ring-1 ring-[#2B2728]' : 'border-[#E9E1D3]'}`}
                      >
                        <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: band, color: bandText }}>
                          <MapPin className="w-5 h-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          {focused ? (
                            <span className="inline-block mb-1.5 text-xs font-bold rounded px-1.5 py-0.5" style={{ background: accent, color: accentText }}>
                              {t.scannedHere}
                            </span>
                          ) : null}
                          <h3 className="text-lg font-bold">{b.name}</h3>
                          {b.address ? <p className="text-[15px] text-[#5E5758] mt-0.5">{b.address}</p> : null}
                        </div>
                        {b.directionsUrl ? (
                          <a
                            href={b.directionsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${t.directions}: ${b.name}`}
                            className="min-h-[44px] px-3 rounded-xl bg-white border border-[#E3D9C8] text-sm font-bold inline-flex items-center gap-1.5 hover:bg-[#F4EFE6] shrink-0"
                          >
                            <Navigation className="w-4 h-4" aria-hidden="true" />
                            {t.directions}
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
              </ul>
            </div>
          </section>
        ) : null}

        {data.documents.length > 0 ? (
          <section id="documents" aria-labelledby="documents-title" className={`${sectionPad} bg-[#FAF7F2]`}>
            <div className={wrap}>
              <h2 id="documents-title" className={h2}>
                {t.documents}
              </h2>
              <ul className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.documents.map((d) => (
                  <li key={d.id}>
                    <a
                      href={d.downloadUrl}
                      onClick={() => onDocumentClick?.(d.id)}
                      className="rounded-[18px] bg-white border border-[#E9E1D3] p-4 flex items-center gap-4 min-h-[72px] hover:shadow-[0_10px_30px_rgba(43,39,40,0.08)] transition-shadow"
                    >
                      <span className="w-11 h-11 rounded-xl bg-[#EFE8DC] flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold truncate">{d.title}</span>
                        <span className="block text-sm text-[#6B6466]">{['PDF', formatSize(d.sizeBytes)].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className="text-sm font-bold inline-flex items-center gap-1 shrink-0">
                        <Download className="w-4 h-4" aria-hidden="true" />
                        {t.download}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {canEnquire ? (
          <section aria-labelledby="contact-title" className="py-16 sm:py-20" style={{ background: band, color: bandText }}>
            <div className={`${wrap} flex flex-col md:flex-row md:items-center md:justify-between gap-6`}>
              <div>
                <h2 id="contact-title" className="text-[28px] sm:text-[40px] leading-tight font-bold tracking-[-0.03em]">
                  {t.contactTitle}
                </h2>
                <p className="mt-2 text-[17px] opacity-90 max-w-[48ch]">{t.contactBody(company.name)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => openSheet(e)}
                className="shrink-0 min-h-[56px] px-7 rounded-[16px] font-bold text-base inline-flex items-center gap-2 hover:opacity-90"
                style={{ background: accent, color: accentText }}
              >
                <Send className="w-5 h-5" aria-hidden="true" />
                {t.enquire}
              </button>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="bg-[#1B191A] text-[#FAF7F2]">
        <div className={`${wrap} py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`}>
          <div className="flex items-center gap-3">
            {logoTile('w-10 h-10 text-xs', 'p-1')}
            <div>
              <p className="font-bold">{company.name}</p>
              <p className="text-sm text-[#B9B1AC] inline-flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
                {[company.businessId, company.gstin ? `GSTIN ${company.gstin}` : null].filter(Boolean).join(', ')}
              </p>
            </div>
          </div>
          <p className="text-sm text-[#B9B1AC]">{t.madeWith}</p>
        </div>
      </footer>

      {canEnquire ? (
        <div
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 px-4 pt-6 bg-gradient-to-t from-[#FAF7F2] from-70% to-transparent pointer-events-none"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-[760px] mx-auto pointer-events-auto">
            <button
              type="button"
              data-testid="enquiry-bar"
              onClick={(e) => openSheet(e)}
              className="w-full min-h-[52px] font-bold text-[15px] rounded-[14px] flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:opacity-90"
              style={{ background: accent, color: accentText }}
            >
              <Send className="w-5 h-5" aria-hidden="true" />
              {t.enquire}
            </button>
          </div>
        </div>
      ) : null}

      {sheet ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-charcoal/60"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSheet(null);
          }}
        >
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="w-full max-w-[480px] max-h-[92vh] overflow-y-auto bg-warm-paper text-charcoal rounded-t-sheet sm:rounded-sheet shadow-sheet focus:outline-none"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-3 bg-warm-paper border-b border-sand-border">
              <h2 id={titleId} className="text-base font-bold">
                {t.sheetTitle}
              </h2>
              <button
                type="button"
                onClick={() => setSheet(null)}
                aria-label={t.close}
                className="w-11 h-11 flex items-center justify-center rounded-control hover:bg-sand"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {sent ? (
              <div role="status" data-testid="enquiry-success" className="px-5 py-8 text-center space-y-3">
                <span className="mx-auto w-14 h-14 rounded-2xl bg-bridge-orange flex items-center justify-center">
                  <Send className="w-6 h-6 text-[#241A10]" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-bold">{t.successTitle}</h3>
                <p className="text-sm text-charcoal/75">{t.successBody(company.name)}</p>
                <button
                  type="button"
                  onClick={() => setSheet(null)}
                  className="w-full min-h-[48px] mt-2 rounded-control bg-charcoal text-warm-paper text-sm font-bold"
                >
                  {t.done}
                </button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="px-5 pt-4 space-y-4">
                <p className="text-sm text-charcoal/75">{t.sheetSubtitle(company.name)}</p>
                {sheetProduct ? (
                  <p data-testid="enquiry-product" className="text-sm rounded-xl bg-white border border-sand-border px-3 py-2.5">
                    <span className="text-charcoal/60">{t.about_item}: </span>
                    <span className="font-bold">{sheetProduct.name}</span>
                  </p>
                ) : null}
                {formError ? (
                  <div role="alert" className="flex items-start gap-2 px-3 py-3 rounded-panel border border-error/40 bg-error/10 text-sm">
                    {typeof navigator !== 'undefined' && navigator.onLine === false ? (
                      <WifiOff className="w-4 h-4 text-error shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-error shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <span>{formError}</span>
                  </div>
                ) : null}
                {field('name', t.name, 'text', 'name', true)}
                {field('phone', t.phone, 'tel', 'tel', true)}
                {field('email', t.email, 'email', 'email')}
                {field('company', t.yourCompany, 'text', 'organization')}
                {data.branches.length > 1 ? (
                  <div className="space-y-1">
                    <label htmlFor="enquiry-branch" className="block text-sm font-semibold">
                      {t.branch}
                    </label>
                    <select
                      id="enquiry-branch"
                      value={form.branchId}
                      onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                      className="w-full min-h-[48px] px-3 text-base rounded-control border border-sand-border bg-white focus:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange"
                    >
                      <option value="">{t.anyBranch}</option>
                      {data.branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="space-y-1">
                  <label htmlFor="enquiry-message" className="block text-sm font-semibold">
                    {t.message}
                  </label>
                  <textarea
                    id="enquiry-message"
                    rows={3}
                    maxLength={1000}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full px-3 py-2.5 text-base rounded-control border border-sand-border bg-white focus:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange"
                  />
                </div>
                <label className="flex items-start gap-3 text-sm cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(e) => {
                      setForm({ ...form, consent: e.target.checked });
                      if (errors.consent) setErrors({ ...errors, consent: undefined });
                    }}
                    aria-required="true"
                    aria-invalid={errors.consent ? true : undefined}
                    className="mt-0.5 w-5 h-5 shrink-0 accent-charcoal"
                  />
                  <span className="leading-snug">
                    {t.consent}.{' '}
                    <a href={privacyNoticeUrl || '/privacy'} target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                      {t.privacy}
                    </a>
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[56px] rounded-control bg-bridge-orange text-charcoal text-base font-bold disabled:opacity-60 hover:bg-[#E5790C]"
                >
                  {submitting ? t.sending : t.send}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
