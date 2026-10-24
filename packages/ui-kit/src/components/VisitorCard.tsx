import React, { useEffect, useId, useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  ExternalLink,
  Globe,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Power,
  SearchX,
  Send,
  UserPlus,
  UserRoundX,
  WifiOff,
  X,
} from 'lucide-react';
import { KeystoneTag } from './KeystoneTag';
import { avatarColour } from './AppShell';
import { getTemplateStyle } from './visitor-card-templates';

export interface PublicCardPerson {
  name: string;
  designation: string;
  photoUrl?: string;
  phone?: string;
  email?: string;
  bio?: string;
}

export interface PublicCardCompany {
  id: string;
  businessId: string;
  name: string;
  logoUrl?: string;
  brandColours?: {
    band: string;
    accent?: string;
    text: string;
  };
}

export interface PublicCardBranch {
  id: string;
  name: string;
  address?: string;
  mapPin?: { lat: number; lng: number };
}

export interface PublicCardSection {
  type: string;
  order: number;
  content: Record<string, unknown>;
}

export interface PublicCardActions {
  saveContactUrl: string;
  whatsappUrl?: string;
  callUrl?: string;
  emailUrl?: string;
  directionsUrl?: string;
}

export interface PublicCardOffboardedDetails {
  personName?: string;
  successorName?: string;
  successorMessageUrl?: string;
  redirectUrl?: string;
}

export interface VisitorCardData {
  cardId: string;
  slug: string;
  status: 'published' | 'draft' | 'pending_approval' | 'inactive' | 'unactivated' | 'offboarded';
  templateId: string;
  language: 'en' | 'hi';
  verifiedBadge: boolean;
  person?: PublicCardPerson;
  company: PublicCardCompany;
  branch?: PublicCardBranch;
  sections: PublicCardSection[];
  actions: PublicCardActions;
  offboardedDetails?: PublicCardOffboardedDetails;
}

export interface SharebackSubmitData {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  note?: string;
  consent: boolean;
  source?: 'qr' | 'nfc' | 'link';
  sourceTag?: string;
  turnstileToken?: string;
}

export interface VisitorCardProps {
  data?: VisitorCardData;
  state?: 'ready' | 'loading' | 'unactivated' | 'inactive' | 'offboarded' | 'plan_lapsed' | 'not_found';
  companyName?: string;
  offboardedDetails?: PublicCardOffboardedDetails;
  isSlowConnection?: boolean;
  theme?: 'light' | 'dark' | 'system';
  privacyNoticeUrl?: string;
  source?: 'qr' | 'nfc' | 'link';
  sourceTag?: string;
  onSaveContact?: (data: { cardId: string; slug: string }) => void;
  onCtaClick?: (cta: 'whatsapp' | 'call' | 'email' | 'directions') => void;
  onSharebackSubmit?: (data: SharebackSubmitData) => Promise<{ success: boolean; message?: string } | void>;
}

const copy = {
  en: {
    saveContact: 'Save contact',
    whatsapp: 'WhatsApp',
    call: 'Call',
    email: 'Email',
    directions: 'Directions',
    verifiedChip: 'Verified business',
    sharebackTitle: 'Share your details',
    sharebackSubtitle: 'Get a call back. No app or login needed.',
    sharebackTrigger: 'Share your details back',
    website: 'Website',
    namePlaceholder: 'Your name',
    phonePlaceholder: 'Mobile number',
    emailPlaceholder: 'Email address (optional)',
    companyPlaceholder: 'Company name (optional)',
    notePlaceholder: 'Add a quick note (optional)',
    consentCheckbox: 'I agree to share my details with this company',
    privacyNoticeLink: 'Privacy notice',
    sendShareback: 'Send contact',
    sendingShareback: 'Sending...',
    sharebackSuccessTitle: 'Details shared',
    sharebackSuccessBody: (name: string) => `Your details have been shared with ${name}.`,
    sendAnother: 'Send another response',
    dismiss: 'Dismiss',
    offlineError: 'You are currently offline. Please reconnect to send your details.',
    sharebackError: 'Failed to share details. Please try again.',
    nameRequired: 'Please enter your name.',
    phoneRequired: 'Please enter a valid mobile number.',
    consentRequired: 'You must agree to share your details.',
    switchToHindi: 'Switch to Hindi (हिंदी)',
    switchToEnglish: 'Switch to English',
    slowConnection: 'Slow connection. Showing cached card.',
    cardInactiveTitle: 'This card is inactive',
    cardInactiveBody: (co: string) => `Please contact ${co} directly. No personal details are shown.`,
    cardUnactivatedTitle: 'This card is not active yet',
    cardUnactivatedBody: 'If this is your card, tap it on your own phone while signed in to activate it.',
    cardNotFoundTitle: 'This card link does not exist',
    cardNotFoundBody: 'Check the link, or scan the QR code again. If someone shared it with you, ask them for a new link.',
    cardPlanLapsedTitle: "This company's plan has lapsed",
    cardPlanLapsedBody: 'Please contact the company directly. No personal details are shown.',
    movedOnTitle: (name: string) => `${name} has moved on`,
    movedOnBody: (successor?: string) => (successor ? `${successor} can help you.` : 'Please contact the company directly.'),
    messageSuccessor: (successor: string) => `Message ${successor}`,
    about: 'About',
    products: 'Products',
    services: 'Services',
    links: 'Links',
    facility: 'Head works & plant',
    closeSheet: 'Close',
    madeWith: 'Made with OneBridge Grid',
  },
  hi: {
    saveContact: 'संपर्क सहेजें',
    whatsapp: 'व्हाट्सएप',
    call: 'कॉल करें',
    email: 'ईमेल',
    directions: 'दिशा-निर्देश',
    verifiedChip: 'सत्यापित व्यवसाय',
    sharebackTitle: 'अपना विवरण साझा करें',
    sharebackSubtitle: 'इस कार्डधारक के साथ अपना संपर्क विवरण साझा करें। किसी ऐप की आवश्यकता नहीं है।',
    sharebackTrigger: 'अपना विवरण भेजें',
    website: 'वेबसाइट',
    namePlaceholder: 'आपका नाम',
    phonePlaceholder: 'मोबाइल नंबर',
    emailPlaceholder: 'ईमेल पता (वैकल्पिक)',
    companyPlaceholder: 'कंपनी का नाम (वैकल्पिक)',
    notePlaceholder: 'संक्षिप्त विवरण लिखें (वैकल्पिक)',
    consentCheckbox: 'मैं इस कंपनी के साथ अपना विवरण साझा करने के लिए सहमत हूँ',
    privacyNoticeLink: 'गोपनीयता सूचना',
    sendShareback: 'विवरण भेजें',
    sendingShareback: 'भेजा जा रहा है...',
    sharebackSuccessTitle: 'विवरण साझा किया गया',
    sharebackSuccessBody: (name: string) => `आपका विवरण ${name} के साथ साझा कर दिया गया है।`,
    sendAnother: 'एक और विवरण भेजें',
    dismiss: 'बंद करें',
    offlineError: 'आप ऑफ़लाइन हैं। विवरण भेजने के लिए कृपया इंटरनेट से जुड़ें।',
    sharebackError: 'विवरण भेजने में विफल। कृपया पुनः प्रयास करें।',
    nameRequired: 'कृपया अपना नाम दर्ज करें।',
    phoneRequired: 'कृपया मान्य मोबाइल नंबर दर्ज करें।',
    consentRequired: 'विवरण साझा करने के लिए सहमति आवश्यक है।',
    switchToHindi: 'हिंदी में देखें',
    switchToEnglish: 'अंग्रेज़ी में देखें (English)',
    slowConnection: 'धीमा इंटरनेट कनेक्शन। सहेजा गया कार्ड दिखाया जा रहा है।',
    cardInactiveTitle: 'यह कार्ड निष्क्रिय है',
    cardInactiveBody: (co: string) => `कृपया सीधे ${co} से संपर्क करें। कोई व्यक्तिगत विवरण नहीं दिखाया गया है।`,
    cardUnactivatedTitle: 'यह कार्ड अभी सक्रिय नहीं है',
    cardUnactivatedBody: 'यदि यह आपका कार्ड है, तो इसे सक्रिय करने के लिए लॉग इन करते हुए अपने फ़ोन पर टैप करें।',
    cardNotFoundTitle: 'यह कार्ड लिंक मौजूद नहीं है',
    cardNotFoundBody: 'लिंक जांचें या QR कोड फिर से स्कैन करें।',
    cardPlanLapsedTitle: 'कंपनी की योजना समाप्त हो गई है',
    cardPlanLapsedBody: 'कृपया सीधे कंपनी से संपर्क करें। कोई व्यक्तिगत विवरण नहीं दिखाया गया है।',
    movedOnTitle: (name: string) => `${name} जा चुके हैं`,
    movedOnBody: (successor?: string) => (successor ? `${successor} आपकी सहायता कर सकते हैं।` : 'कृपया सीधे कंपनी से संपर्क करें।'),
    messageSuccessor: (successor: string) => `${successor} को संदेश भेजें`,
    about: 'परिचय',
    products: 'उत्पाद',
    services: 'सेवाएं',
    links: 'लिंक',
    facility: 'शाखा व कार्यालय',
    closeSheet: 'बंद करें',
    madeWith: 'OneBridge Grid द्वारा निर्मित',
  },
};

type Copy = (typeof copy)['en'];

/** Square-noded span between two points; animates on success (fades under reduced motion). */
const ConnectionSpan: React.FC<{ from: string; to: string }> = ({ from, to }) => (
  <div className="flex items-center gap-2 w-full" aria-hidden="true">
    <span className="w-10 h-10 shrink-0 rounded-control bg-charcoal text-warm-paper dark:bg-warm-paper dark:text-charcoal flex items-center justify-center text-sm font-bold">
      {from}
    </span>
    <span className="relative flex-1 h-[2px] bg-sand-border dark:bg-sand-border/40 overflow-hidden">
      <span className="absolute inset-0 bg-bridge-orange animate-span-fill" />
    </span>
    <span className="w-10 h-10 shrink-0 rounded-control bg-bridge-orange text-charcoal flex items-center justify-center text-sm font-bold">
      {to}
    </span>
  </div>
);

const ICONS = {
  call: <Phone className="w-5 h-5" aria-hidden="true" />,
  email: <Mail className="w-5 h-5" aria-hidden="true" />,
  directions: <MapPin className="w-5 h-5" aria-hidden="true" />,
  website: <Globe className="w-5 h-5" aria-hidden="true" />,
};

const StatePage: React.FC<{
  icon: React.ReactNode;
  title: string;
  body: string;
  footer: string;
  children?: React.ReactNode;
  themeClass: string;
}> = ({ icon, title, body, footer, children, themeClass }) => (
  <div className={`min-h-screen flex flex-col items-center justify-center px-4 py-10 font-body ${themeClass}`}>
    <div className="w-full max-w-[400px] text-center space-y-4">
      <div className="w-14 h-14 mx-auto rounded-control border border-sand-border dark:border-sand-border/30 bg-sand/60 dark:bg-charcoal flex items-center justify-center text-charcoal/70 dark:text-sand/80">
        {icon}
      </div>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-sm text-charcoal/75 dark:text-sand/80 leading-relaxed">{body}</p>
      {children}
      <div className="pt-6">
        <div className="flex items-center" aria-hidden="true">
          <span className="w-1 h-1 bg-charcoal/40 dark:bg-sand/40" />
          <span className="flex-1 h-px bg-charcoal/20 dark:bg-sand/20" />
          <span className="w-1 h-1 bg-charcoal/40 dark:bg-sand/40" />
        </div>
        <p className="pt-3 text-xs text-charcoal/60 dark:text-sand/60">{footer}</p>
      </div>
    </div>
  </div>
);

export const VisitorCard: React.FC<VisitorCardProps> = ({
  data,
  state = 'ready',
  companyName,
  offboardedDetails: propOffboardedDetails,
  isSlowConnection = false,
  theme = 'light',
  privacyNoticeUrl,
  source,
  sourceTag,
  onSaveContact,
  onCtaClick,
  onSharebackSubmit,
}) => {
  const [lang, setLang] = useState<'en' | 'hi'>(data?.language || 'en');
  const t: Copy = copy[lang];
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', company: '', note: '', consent: false });
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string; consent?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sharebackStatus, setSharebackStatus] = useState<'idle' | 'success'>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetTitleId = useId();

  useEffect(() => {
    if (!sheetOpen) return;
    sheetRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSheetOpen(false);
        return;
      }
      if (e.key === 'Tab' && sheetRef.current) {
        const items = sheetRef.current.querySelectorAll<HTMLElement>('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])');
        if (items.length === 0) return;
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
      triggerRef.current?.focus();
    };
  }, [sheetOpen]);

  const validate = (f: typeof form) => ({
    name: f.name.trim() ? undefined : t.nameRequired,
    phone: f.phone.replace(/\D/g, '').length >= 8 ? undefined : t.phoneRequired,
    consent: f.consent ? undefined : t.consentRequired,
  });

  const handleSharebackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setFormError(t.offlineError);
      return;
    }
    const errs = validate(form);
    setFieldErrors(errs);
    const firstError = errs.name || errs.phone || errs.consent;
    if (firstError) {
      setFormError(firstError);
      return;
    }
    setIsSubmitting(true);
    try {
      if (onSharebackSubmit) {
        const res = await onSharebackSubmit({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          company: form.company.trim() || undefined,
          note: form.note.trim() || undefined,
          consent: form.consent,
          source,
          sourceTag,
        });
        if (res && res.success === false) {
          setFormError(res.message || t.sharebackError);
          return;
        }
      }
      setSharebackStatus('success');
      setForm({ name: '', phone: '', email: '', company: '', note: '', consent: false });
      setFieldErrors({});
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t.sharebackError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const effectiveState =
    state !== 'ready'
      ? state
      : data?.status === 'inactive' || data?.status === 'draft' || data?.status === 'pending_approval'
        ? 'inactive'
        : data?.status === 'unactivated'
          ? 'unactivated'
          : data?.status === 'offboarded'
            ? 'offboarded'
            : 'ready';

  const resolvedCompanyName = companyName || data?.company?.name || 'OneBridge';
  const effectiveOffboardedDetails = propOffboardedDetails || data?.offboardedDetails;
  const isDark = theme === 'dark' || data?.templateId === 'keystone-dark';
  const themeClass = isDark ? 'theme-dark bg-charcoal-deep text-sand' : 'bg-warm-paper text-charcoal dark:bg-charcoal-deep dark:text-sand';

  if (effectiveState === 'loading') {
    return (
      <div className={`min-h-screen flex flex-col items-center font-body ${themeClass}`} data-testid="visitor-card-skeleton" aria-busy="true">
        <div className="w-full max-w-[440px] animate-pulse motion-reduce:animate-none">
          <div className="h-56 bg-sand dark:bg-charcoal" />
          <div className="grid grid-cols-3 gap-px bg-sand-border dark:bg-sand-border/20">
            <div className="h-16 bg-warm-paper dark:bg-charcoal-deep" />
            <div className="h-16 bg-warm-paper dark:bg-charcoal-deep" />
            <div className="h-16 bg-warm-paper dark:bg-charcoal-deep" />
          </div>
          <div className="p-4 space-y-3">
            <div className="h-20 bg-sand/60 dark:bg-charcoal rounded-panel" />
            <div className="h-28 bg-sand/60 dark:bg-charcoal rounded-panel" />
          </div>
        </div>
      </div>
    );
  }

  if (effectiveState === 'unactivated') {
    return (
      <StatePage
        themeClass={themeClass}
        icon={<Power className="w-6 h-6" aria-hidden="true" />}
        title={t.cardUnactivatedTitle}
        body={t.cardUnactivatedBody}
        footer="OneBridge Grid"
      />
    );
  }

  if (effectiveState === 'inactive') {
    return (
      <StatePage
        themeClass={themeClass}
        icon={<Ban className="w-6 h-6" aria-hidden="true" />}
        title={t.cardInactiveTitle}
        body={t.cardInactiveBody(resolvedCompanyName)}
        footer="OneBridge Grid"
      />
    );
  }

  if (effectiveState === 'offboarded') {
    const personName = effectiveOffboardedDetails?.personName || 'This person';
    const successorName = effectiveOffboardedDetails?.successorName;
    const successorUrl = effectiveOffboardedDetails?.successorMessageUrl || effectiveOffboardedDetails?.redirectUrl;
    return (
      <StatePage
        themeClass={themeClass}
        icon={<UserRoundX className="w-6 h-6" aria-hidden="true" />}
        title={t.movedOnTitle(personName)}
        body={t.movedOnBody(successorName)}
        footer={`${resolvedCompanyName} · OneBridge Grid`}
      >
        {successorName && successorUrl ? (
          <a
            href={successorUrl}
            className="inline-flex items-center justify-center gap-2 w-full min-h-[52px] bg-bridge-orange text-charcoal font-bold rounded-control"
          >
            <MessageCircle className="w-5 h-5" aria-hidden="true" />
            {t.messageSuccessor(successorName)}
          </a>
        ) : null}
      </StatePage>
    );
  }

  if (effectiveState === 'not_found') {
    return (
      <StatePage
        themeClass={themeClass}
        icon={<SearchX className="w-6 h-6" aria-hidden="true" />}
        title={t.cardNotFoundTitle}
        body={t.cardNotFoundBody}
        footer="OneBridge Grid"
      />
    );
  }

  if (effectiveState === 'plan_lapsed') {
    return (
      <StatePage
        themeClass={themeClass}
        icon={<Lock className="w-6 h-6" aria-hidden="true" />}
        title={t.cardPlanLapsedTitle}
        body={t.cardPlanLapsedBody}
        footer="OneBridge Grid"
      />
    );
  }

  if (!data) return null;

  const bandColour = data.company?.brandColours?.band || '#1B2A4A';
  const style = getTemplateStyle(data.templateId, bandColour, data.company?.brandColours?.text);
  const person = data.person || { name: 'Cardholder', designation: '' };
  const company = data.company;
  const branch = data.branch;
  const linkItems = (data.sections.find((x) => (x.type === 'links' || x.type === 'social_links') && Array.isArray(x.content?.items))?.content?.items ??
    []) as Array<{ url?: string }>;
  const websiteUrl = linkItems.find((l) => typeof l.url === 'string' && /^https?:\/\//.test(l.url))?.url;
  const initials = person.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  const tiles = [
    data.actions.callUrl ? { key: 'call' as const, href: data.actions.callUrl, label: t.call, external: false } : null,
    data.actions.emailUrl ? { key: 'email' as const, href: data.actions.emailUrl, label: t.email, external: false } : null,
    data.actions.directionsUrl ? { key: 'directions' as const, href: data.actions.directionsUrl, label: t.directions, external: true } : null,
    websiteUrl ? { key: 'website' as const, href: websiteUrl, label: t.website, external: true } : null,
  ].filter(Boolean) as Array<{ key: 'call' | 'email' | 'directions' | 'website'; href: string; label: string; external: boolean }>;

  const sectionTitle = 'text-[13px] font-extrabold uppercase tracking-[0.04em] text-charcoal/60 dark:text-sand/60 mb-2.5';
  const sectionBox = '';
  const firstName = person.name.split(/\s+/)[0] || person.name;

  const PLACE_TYPES = ['facility', 'branch', 'company_info', 'branch_map'];

  const renderSection = (section: PublicCardSection, idx: number) => {
    const c = section.content || {};
    if (section.type === 'about' && c.text && c.text !== person.bio) {
      return (
        <section key={idx} className={sectionBox}>
          <h2 className={sectionTitle}>{t.about}</h2>
          <p className="text-sm leading-relaxed text-charcoal/85 dark:text-sand/85">{String(c.text)}</p>
        </section>
      );
    }
    if ((section.type === 'products' || section.type === 'services') && Array.isArray(c.items)) {
      const items = c.items as Array<{ name?: string; description?: string; price?: string }>;
      return (
        <section key={idx} className={sectionBox}>
          <h2 className={sectionTitle}>{section.type === 'products' ? t.products : t.services}</h2>
          <ul className="grid gap-2">
            {items.map((item, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-3 px-3.5 py-3 rounded-xl border border-[#ECE4D6] dark:border-sand-border/20 bg-white dark:bg-charcoal"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{item.name}</div>
                  {item.description ? <div className="text-sm text-charcoal/70 dark:text-sand/70">{item.description}</div> : null}
                </div>
                {item.price ? <span className="text-sm font-extrabold shrink-0">{item.price}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      );
    }
    if (PLACE_TYPES.includes(section.type)) {
      // Company info and branch map describe the same place: show one block, at the first of them.
      if (data.sections.find((x) => PLACE_TYPES.includes(x.type)) !== section) return null;
      const placeSections = data.sections.filter((x) => PLACE_TYPES.includes(x.type)).map((x) => x.content || {});
      const address = (placeSections.map((x) => x.address).find(Boolean) as string | undefined) || branch?.address;
      const gstin = placeSections.map((x) => x.gstin).find(Boolean) as string | undefined;
      if (!address && !gstin) return null;
      return (
        <section key={idx} className={sectionBox}>
          <h2 className={sectionTitle}>{t.facility}</h2>
          {address ? <p className="text-sm leading-relaxed text-charcoal/85 dark:text-sand/85">{address}</p> : null}
          {gstin ? <p className="mt-1 text-sm font-mono">GSTIN: {gstin}</p> : null}
        </section>
      );
    }
    if ((section.type === 'links' || section.type === 'social_links') && Array.isArray(c.items)) {
      const links = c.items as Array<{ title?: string; url?: string }>;
      return (
        <section key={idx} className={sectionBox}>
          <h2 className={sectionTitle}>{t.links}</h2>
          <ul className="grid gap-2">
            {links.map((link, i) => (
              <li key={i}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 min-h-[48px] px-3 rounded-panel border border-sand-border dark:border-sand-border/20 bg-warm-paper dark:bg-charcoal text-sm font-semibold hover:border-charcoal dark:hover:border-sand"
                >
                  <span className="truncate">{link.title || link.url}</span>
                  <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      );
    }
    return null;
  };

  return (
    <div className={`min-h-screen flex flex-col items-center font-body ${themeClass}`}>
      <article
        data-testid="card-frame"
        data-template={data.templateId}
        className={`relative w-full max-w-[440px] min-h-screen sm:min-h-0 sm:my-6 sm:rounded-sheet sm:border border-sand-border dark:border-sand-border/20 overflow-hidden bg-warm-paper dark:bg-charcoal-deep ${style.frameClass}`}
      >
        {isSlowConnection ? (
          <div role="status" className="flex items-center justify-center gap-2 px-4 py-2 bg-warning/15 text-sm">
            <WifiOff className="w-4 h-4" aria-hidden="true" />
            {t.slowConnection}
          </div>
        ) : null}

        <header data-testid="card-header" className={`relative px-5 pt-5 pb-6 ${style.headerClass}`} style={style.headerStyle}>
          <div className={`flex items-center justify-between gap-3 min-h-[44px] ${style.textClass}`} style={style.textStyle}>
            {company?.logoUrl ? (
              <img src={company.logoUrl} alt={`${company.name} logo`} className="max-h-8 max-w-[140px] object-contain" />
            ) : (
              <span className="text-xs font-bold tracking-[0.08em] uppercase opacity-90">{company?.name}</span>
            )}
            <button
              data-testid="language-toggle"
              type="button"
              onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
              className="min-h-[44px] min-w-[44px] px-3 rounded-lg bg-black/15 text-current text-xs font-bold hover:bg-black/25"
              aria-label={lang === 'en' ? t.switchToHindi : t.switchToEnglish}
            >
              {lang === 'en' ? 'हिन्दी' : 'EN'}
            </button>
          </div>

          <div
            className="mt-5 w-[84px] h-[84px] rounded-[22px] overflow-hidden flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
            style={{ background: person.photoUrl ? undefined : avatarColour(person.name) }}
          >
            {person.photoUrl ? (
              <img src={person.photoUrl} alt={person.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[28px] font-extrabold text-[#241A10]" aria-hidden="true">
                {initials}
              </span>
            )}
          </div>

          <div className={`mt-4 ${style.textClass}`} style={style.textStyle}>
            <h1 className="text-[30px] leading-[1.05] font-bold tracking-[-0.03em] break-words">{person.name}</h1>
            {person.designation ? <p className="text-[15px] mt-1 opacity-90">{person.designation}</p> : null}
            <div className="flex flex-wrap items-center gap-2 mt-3 text-[13px] font-semibold">
              {data.verifiedBadge ? (
                <span data-testid="verified-tag" className="inline-flex">
                  <KeystoneTag label={lang === 'hi' ? 'सत्यापित' : 'Verified'} aria-label={t.verifiedChip} role="img" className="bg-bridge-orange text-[#241A10] dark:bg-bridge-orange dark:border-0 text-[11px] px-2 py-0.5 [&_svg]:fill-[#241A10]" />
                </span>
              ) : null}
              <span className="opacity-90">
                {company?.name}
                {branch?.name ? ` · ${branch.name}` : ''}
              </span>
            </div>
          </div>
          {/* The span deck: a solid line along the base of the band */}
          <span
            aria-hidden="true"
            data-span-line="true"
            className={`absolute inset-x-0 bottom-0 h-[5px] ${data.templateId === 'bridge-orange' ? 'bg-charcoal' : 'bg-bridge-orange'}`}
          />
        </header>

        {style.stripeColour ? <div aria-hidden="true" className="h-1" style={{ backgroundColor: style.stripeColour }} /> : null}

        {tiles.length > 0 ? (
          <nav
            aria-label="Quick contact actions"
            className="grid gap-2 p-4 bg-white dark:bg-charcoal-deep"
            style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}
          >
            {tiles.map((tile) => (
              <a
                key={tile.key}
                href={tile.href}
                onClick={() => (tile.key === 'website' ? undefined : onCtaClick?.(tile.key))}
                target={tile.external ? '_blank' : undefined}
                rel={tile.external ? 'noopener noreferrer' : undefined}
                className="min-h-[64px] flex flex-col items-center justify-center gap-1.5 rounded-xl bg-[#F4EFE6] dark:bg-charcoal text-xs font-bold hover:bg-[#ECE4D6] dark:hover:bg-white/10 transition-colors"
              >
                {ICONS[tile.key]}
                {tile.label}
              </a>
            ))}
          </nav>
        ) : null}

        <div className="px-[18px] pt-2 pb-32 space-y-[18px]">
          {person.bio ? (
            <section>
              <h2 className={sectionTitle}>{t.about}</h2>
              <p className="text-sm leading-relaxed text-charcoal/85 dark:text-sand/85">{person.bio}</p>
            </section>
          ) : null}

          {data.sections?.filter((x) => !PLACE_TYPES.includes(x.type)).map(renderSection)}

          <section data-testid="shareback-panel" aria-label={t.sharebackTitle}>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => {
                setSharebackStatus('idle');
                setFormError(null);
                setSheetOpen(true);
              }}
              aria-haspopup="dialog"
              className="w-full flex items-center gap-3 p-3.5 rounded-[14px] bg-[#2A2627] text-warm-paper text-left hover:bg-[#1E1E1E] transition-colors"
            >
              <span className="w-[38px] h-[38px] rounded-[10px] bg-bridge-orange inline-flex items-center justify-center shrink-0">
                <Send className="w-[18px] h-[18px] text-[#241A10]" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">{lang === 'en' ? `Share your details with ${firstName}` : t.sharebackTrigger}</span>
                <span className="block text-xs opacity-70">{t.sharebackSubtitle}</span>
              </span>
            </button>
          </section>

          {data.sections?.filter((x) => PLACE_TYPES.includes(x.type)).map(renderSection)}

          <footer className="pt-4 flex justify-center">
            <span className="font-mono text-[11px] text-charcoal/60 dark:text-sand/60 border border-sand-border dark:border-sand-border/30 rounded-md px-2 py-1">
              {company?.businessId ? (
                <>
                  <span>{company.businessId}</span>
                  {' · '}
                </>
              ) : null}
              {t.madeWith}
            </span>
          </footer>
        </div>

        <div
          data-testid="visitor-action-bar"
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] z-30 flex gap-2 px-3.5 pt-6 bg-gradient-to-t from-warm-paper from-70% to-transparent dark:from-charcoal-deep"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <a
            href={data.actions.saveContactUrl}
            onClick={() => onSaveContact?.({ cardId: data.cardId, slug: data.slug })}
            className="flex-1 min-h-[52px] bg-bridge-orange text-charcoal font-extrabold text-[15px] rounded-[14px] flex items-center justify-center gap-2 hover:bg-[#E5790C] shadow-[0_8px_24px_rgba(246,135,19,0.35)]"
          >
            <UserPlus className="w-5 h-5" aria-hidden="true" />
            {t.saveContact}
          </a>
          {data.actions.whatsappUrl ? (
            <a
              href={data.actions.whatsappUrl}
              onClick={() => onCtaClick?.('whatsapp')}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.whatsapp}
              className="w-[52px] min-h-[52px] rounded-[14px] bg-[#2A2627] text-warm-paper flex items-center justify-center hover:bg-[#1E1E1E] shrink-0"
            >
              <MessageCircle className="w-5 h-5" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </article>

      {sheetOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/60"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSheetOpen(false);
          }}
        >
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={sheetTitleId}
            tabIndex={-1}
            className="w-full max-w-[440px] max-h-[92vh] overflow-y-auto bg-warm-paper dark:bg-charcoal text-charcoal dark:text-sand rounded-t-sheet shadow-sheet focus:outline-none"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
          >
            <div className="sticky top-0 flex items-center justify-between gap-3 px-5 py-3 bg-warm-paper dark:bg-charcoal border-b border-sand-border dark:border-sand-border/20">
              <h2 id={sheetTitleId} className="text-base font-bold">
                {t.sharebackTitle}
              </h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="w-11 h-11 flex items-center justify-center rounded-control hover:bg-sand dark:hover:bg-charcoal-deep"
                aria-label={t.closeSheet}
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {sharebackStatus === 'success' ? (
              <div data-testid="shareback-success" className="px-5 py-6 space-y-4 text-center" role="status">
                <ConnectionSpan from="✓" to={initials || '•'} />
                <h3 className="text-lg font-bold">{t.sharebackSuccessTitle}</h3>
                <p className="text-sm text-charcoal/75 dark:text-sand/75">{t.sharebackSuccessBody(person.name)}</p>
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSheetOpen(false)}
                    className="min-h-[48px] rounded-control bg-charcoal text-warm-paper dark:bg-sand dark:text-charcoal text-sm font-bold"
                  >
                    {t.dismiss}
                  </button>
                  <button
                    type="button"
                    data-testid="shareback-dismiss"
                    onClick={() => setSharebackStatus('idle')}
                    className="min-h-[44px] text-sm font-semibold underline underline-offset-2"
                  >
                    {t.sendAnother}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSharebackSubmit} noValidate className="px-5 pt-4 space-y-4">
                <p className="text-sm text-charcoal/75 dark:text-sand/75">{t.sharebackSubtitle}</p>
                {formError ? (
                  <div role="alert" className="flex items-start gap-2 px-3 py-3 rounded-panel border border-error/40 bg-error/10 text-sm">
                    <AlertTriangle className="w-4 h-4 text-error shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{formError}</span>
                  </div>
                ) : null}
                {(
                  [
                    { key: 'name', label: t.namePlaceholder, type: 'text', autoComplete: 'name', required: true },
                    { key: 'phone', label: t.phonePlaceholder, type: 'tel', autoComplete: 'tel', required: true },
                    { key: 'email', label: t.emailPlaceholder, type: 'email', autoComplete: 'email' },
                    { key: 'company', label: t.companyPlaceholder, type: 'text', autoComplete: 'organization' },
                    { key: 'note', label: t.notePlaceholder, type: 'text' },
                  ] as const
                ).map((f) => {
                  const err = (fieldErrors as Record<string, string | undefined>)[f.key];
                  return (
                    <div key={f.key} className="space-y-1">
                      <label htmlFor={`shareback-${f.key}`} className="block text-sm font-semibold">
                        {f.label}
                        {'required' in f && f.required ? (
                          <span className="text-error" aria-hidden="true">
                            {' '}
                            *
                          </span>
                        ) : null}
                      </label>
                      <input
                        id={`shareback-${f.key}`}
                        name={f.key}
                        type={f.type}
                        autoComplete={'autoComplete' in f ? f.autoComplete : undefined}
                        inputMode={f.key === 'phone' ? 'tel' : undefined}
                        required={'required' in f && f.required}
                        aria-required={'required' in f && f.required ? true : undefined}
                        aria-invalid={err ? true : undefined}
                        value={form[f.key]}
                        onChange={(e) => {
                          setForm({ ...form, [f.key]: e.target.value });
                          if (err) setFieldErrors({ ...fieldErrors, [f.key]: undefined });
                        }}
                        onBlur={() => {
                          if (f.key === 'name' || f.key === 'phone') {
                            const errs = validate(form);
                            setFieldErrors((prev) => ({ ...prev, [f.key]: form[f.key] ? errs[f.key] : prev[f.key as 'name' | 'phone'] }));
                          }
                        }}
                        className={`w-full min-h-[48px] px-3 text-base rounded-control border bg-warm-paper dark:bg-charcoal-deep text-charcoal dark:text-sand focus:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange ${err ? 'border-error' : 'border-sand-border dark:border-sand-border/30'}`}
                      />
                    </div>
                  );
                })}
                <label className="flex items-start gap-3 text-sm cursor-pointer min-h-[44px]">
                  <input
                    id="shareback-consent"
                    name="consent"
                    type="checkbox"
                    required
                    checked={form.consent}
                    onChange={(e) => {
                      setForm({ ...form, consent: e.target.checked });
                      if (fieldErrors.consent) setFieldErrors({ ...fieldErrors, consent: undefined });
                    }}
                    className="mt-0.5 w-5 h-5 shrink-0 accent-charcoal"
                    aria-required="true"
                    aria-label={t.consentCheckbox}
                  />
                  <span className="leading-snug">
                    {t.consentCheckbox}.{' '}
                    <a href={privacyNoticeUrl || '/privacy'} target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                      {t.privacyNoticeLink}
                    </a>
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[56px] rounded-control bg-bridge-orange text-charcoal text-base font-bold disabled:opacity-60 hover:bg-[#E5790C]"
                >
                  {isSubmitting ? t.sendingShareback : t.sendShareback}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
