import React, { useState, useEffect } from 'react';
import { KeystoneBadge } from './KeystoneBadge';
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
  state?: 'ready' | 'loading' | 'unactivated' | 'inactive' | 'offboarded';
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
    sharebackSubtitle: 'Leave your contact details with this cardholder',
    namePlaceholder: 'Your name',
    phonePlaceholder: 'Mobile number',
    emailPlaceholder: 'Email address (optional)',
    companyPlaceholder: 'Company name (optional)',
    notePlaceholder: 'Add a quick note (optional)',
    consentCheckbox: 'I agree to share my details with this company',
    privacyNoticeLink: 'Privacy Notice',
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
    movedOnTitle: (name: string) => `${name} has moved on`,
    movedOnBody: (successor?: string) => successor ? `${successor} can help you.` : 'Please contact the company directly.',
    messageSuccessor: (successor: string) => `Message ${successor}`,
  },
  hi: {
    saveContact: 'संपर्क सहेजें',
    whatsapp: 'व्हाट्सएप',
    call: 'कॉल करें',
    email: 'ईमेल',
    directions: 'दिशा-निर्देश',
    verifiedChip: 'सत्यापित व्यवसाय',
    sharebackTitle: 'अपना विवरण साझा करें',
    sharebackSubtitle: 'इस कार्डधारक के साथ अपना संपर्क विवरण साझा करें',
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
    movedOnTitle: (name: string) => `${name} जा चुके हैं`,
    movedOnBody: (successor?: string) => successor ? `${successor} आपकी सहायता कर सकते हैं।` : 'कृपया सीधे कंपनी से संपर्क करें।',
    messageSuccessor: (successor: string) => `${successor} को संदेश भेजें`,
  },
};

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
  const t = copy[lang];

  // Shareback form state
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    note: '',
    consent: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sharebackStatus, setSharebackStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (sharebackStatus === 'success') {
      const timer = setTimeout(() => {
        setSharebackStatus('idle');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [sharebackStatus]);

  const handleSharebackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setFormError(t.offlineError);
      return;
    }

    if (!form.name.trim()) {
      setFormError(t.nameRequired);
      return;
    }

    if (!form.phone.trim() || form.phone.trim().length < 8) {
      setFormError(t.phoneRequired);
      return;
    }

    if (!form.consent) {
      setFormError(t.consentRequired);
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
          setIsSubmitting(false);
          return;
        }
      }
      setSharebackStatus('success');
      setForm({
        name: '',
        phone: '',
        email: '',
        company: '',
        note: '',
        consent: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t.sharebackError;
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resolve active state
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

  // keystone-dark is a dark card in every system theme: use the full dark theme.
  const isDark = theme === 'dark' || data?.templateId === 'keystone-dark';
  const containerThemeClass = isDark
    ? 'theme-dark bg-charcoal-deep text-sand'
    : 'bg-sand text-charcoal dark:bg-charcoal-deep dark:text-sand';
  const cardFrameClass = isDark
    ? 'bg-charcoal border-sand-border/20 text-sand'
    : 'bg-sand-paper border-sand-border text-charcoal dark:bg-charcoal dark:border-sand-border/20 dark:text-sand';

  // 1. Loading Skeleton State
  if (effectiveState === 'loading') {
    return (
      <div
        className={`min-h-screen flex flex-col items-center p-4 font-body ${containerThemeClass}`}
        data-testid="visitor-card-skeleton"
      >
        <div className={`w-full max-w-md ${cardFrameClass} border rounded-22 overflow-hidden shadow-sm animate-pulse`}>
          {/* Arch header skeleton */}
          <div className="h-44 bg-sand border-b border-sand-border relative flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-sand-border/40" />
            <div className="absolute -bottom-10 w-24 h-24 rounded-full bg-sand-border/60 border-4 border-sand-paper" />
          </div>
          <div className="pt-14 p-6 flex flex-col items-center space-y-3">
            <div className="h-6 w-40 bg-sand-border/50 rounded-md" />
            <div className="h-4 w-32 bg-sand-border/40 rounded-md" />
            <div className="h-3 w-48 bg-sand-border/30 rounded-md" />
            <div className="w-full h-14 bg-sand-border/40 rounded-arch mt-4" />
            <div className="w-full h-12 bg-sand-border/30 rounded-arch" />
            <div className="w-full h-28 bg-sand-border/20 rounded-2xl mt-4" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Unactivated State (Zero personal data)
  if (effectiveState === 'unactivated') {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 font-body ${containerThemeClass}`}>
        <div className={`w-full max-w-md ${cardFrameClass} border rounded-22 p-8 text-center shadow-sm`}>
          <div className="w-16 h-16 rounded-arch bg-sand border border-sand-border flex items-center justify-center mx-auto mb-5 text-deep-orange">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">{t.cardUnactivatedTitle}</h1>
          <p className="text-sm opacity-75 leading-relaxed mb-6">{t.cardUnactivatedBody}</p>
          <div className="pt-4 border-t border-sand-border/40 text-xs opacity-50">OneBridge Grid</div>
        </div>
      </div>
    );
  }

  // 3. Inactive or Lost State (Zero personal data)
  if (effectiveState === 'inactive') {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 font-body ${containerThemeClass}`}>
        <div className={`w-full max-w-md ${cardFrameClass} border rounded-22 p-8 text-center shadow-sm`}>
          <div className="w-16 h-16 rounded-arch bg-sand border border-sand-border flex items-center justify-center mx-auto mb-5 text-charcoal/60">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">{t.cardInactiveTitle}</h1>
          <p className="text-sm opacity-75 leading-relaxed mb-6">
            {t.cardInactiveBody(resolvedCompanyName)}
          </p>
          <div className="pt-4 border-t border-sand-border/40 text-xs opacity-50">OneBridge Grid</div>
        </div>
      </div>
    );
  }

  // 4. Offboarded State
  if (effectiveState === 'offboarded') {
    const personName = effectiveOffboardedDetails?.personName || 'Employee';
    const successorName = effectiveOffboardedDetails?.successorName;
    const successorUrl = effectiveOffboardedDetails?.successorMessageUrl || effectiveOffboardedDetails?.redirectUrl;

    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 font-body ${containerThemeClass}`}>
        <div className={`w-full max-w-md ${cardFrameClass} border rounded-22 p-8 text-center shadow-sm`}>
          <div className="w-16 h-16 rounded-arch bg-sand border border-sand-border flex items-center justify-center mx-auto mb-5 text-deep-orange">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">{t.movedOnTitle(personName)}</h1>
          <p className="text-sm opacity-75 leading-relaxed mb-6">
            {t.movedOnBody(successorName)}
          </p>
          {successorName && successorUrl && (
            <a
              href={successorUrl}
              className="inline-flex items-center justify-center w-full min-h-[44px] h-12 bg-bridge-orange text-charcoal font-bold rounded-arch shadow-sm hover:opacity-95 transition-opacity"
            >
              {t.messageSuccessor(successorName)}
            </a>
          )}
          <div className="pt-6 border-t border-sand-border/40 text-xs opacity-50 mt-6">
            {resolvedCompanyName} • OneBridge Grid
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const bandColour = data.company?.brandColours?.band || '#1B2A4A';
  const templateStyle = getTemplateStyle(data.templateId, bandColour, data.company?.brandColours?.text);
  const person = data.person || { name: 'Cardholder', designation: '' };
  const company = data.company;
  const branch = data.branch;

  return (
    <div className={`min-h-screen flex flex-col items-center p-3 sm:p-4 font-body ${containerThemeClass}`}>
      {/* Top Banner if slow connection */}
      {isSlowConnection && (
        <div className="w-full max-w-md mb-2 p-2 bg-sand-paper border border-bridge-warning rounded-lg text-xs text-charcoal flex items-center justify-center space-x-2">
          <span>⚠️</span>
          <span>{t.slowConnection}</span>
        </div>
      )}

      {/* Main Card Frame */}
      <div
        data-testid="card-frame"
        data-template={data.templateId}
        className={`w-full max-w-md ${cardFrameClass} border rounded-22 overflow-hidden shadow-sm relative ${templateStyle.frameClass}`}
      >
        {/* Top bar with language toggle */}
        <div className="absolute top-3 right-3 z-20">
          <button
            data-testid="language-toggle"
            onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
            className={`px-3 py-2 ${isDark ? 'bg-charcoal/90 border-sand-border/30 text-sand hover:bg-charcoal' : 'bg-sand/90 border-sand-border text-charcoal hover:bg-sand dark:bg-charcoal/90 dark:border-sand-border/30 dark:text-sand'} backdrop-blur-sm border rounded-full text-xs font-bold transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center`}
            aria-label={lang === 'en' ? 'Switch to Hindi' : 'Switch to English'}
          >
            {lang === 'en' ? 'हिन्दी' : 'EN'}
          </button>
        </div>

        {/* Arch header (Reference Screen 1) */}
        <div
          data-testid="arch-header"
          className={`relative pt-8 pb-12 px-14 flex flex-col items-center justify-center ${templateStyle.headerClass}`}
          style={templateStyle.headerStyle}
        >
          {/* Keystone Badge at the Crown */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
            <KeystoneBadge verified={data.verifiedBadge} language={lang} />
          </div>

          {/* Company Logo in Arch Header */}
          {company?.logoUrl ? (
            <img
              src={company.logoUrl}
              alt={`${company.name} logo`}
              className="max-h-12 max-w-[140px] object-contain mb-2 filter drop-shadow-sm"
            />
          ) : (
            <div
              data-testid="company-name"
              className={`${templateStyle.companyNameClass} max-w-full line-clamp-2 break-words text-center mb-2`}
              style={templateStyle.companyNameStyle}
              title={company?.name}
            >
              {company?.name}
            </div>
          )}

          {/* Arch Frame for Photo */}
          <div className="absolute -bottom-12 w-24 h-24 rounded-full border-4 border-sand-paper overflow-hidden bg-sand shadow-sm flex items-center justify-center">
            {person.photoUrl ? (
              <img
                src={person.photoUrl}
                alt={person.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl font-bold text-charcoal/60">
                {person.name.charAt(0)}
              </span>
            )}
          </div>
        </div>

        {templateStyle.stripeColour ? (
          <div aria-hidden="true" className="h-4" style={{ backgroundColor: templateStyle.stripeColour }} />
        ) : null}

        {/* Card Body */}
        <div className="pt-16 px-6 pb-6 text-center">
          {/* Verified chip */}
          {data.verifiedBadge && (
            <div
              data-testid="verified-chip"
              className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-sand border border-sand-border text-deep-orange text-xs font-bold mb-2"
            >
              <span>✓</span>
              <span>{t.verifiedChip}</span>
            </div>
          )}

          {/* Cardholder Name & Designation */}
          <h1 className={`text-2xl font-extrabold ${isDark ? 'text-sand' : 'text-charcoal dark:text-sand'} tracking-tight leading-tight`}>
            {person.name}
          </h1>
          <p className={`text-sm font-bold ${isDark ? 'text-sand/80' : 'text-charcoal/80 dark:text-sand/80'} mt-0.5`}>
            {person.designation}
          </p>

          {/* Company & Branch */}
          <p className={`text-xs ${isDark ? 'text-sand/60' : 'text-charcoal/60 dark:text-sand/60'} mt-1 font-medium`}>
            <span>{company?.name}</span>
            {branch?.name && (
              <>
                <span> • </span>
                <span>{branch.name}</span>
              </>
            )}
          </p>

          {/* Primary Action Buttons (Reference Screen 1) */}
          <div className="mt-6 flex flex-col space-y-2.5">
            {/* Save Contact (Primary Orange, Charcoal Text) */}
            <a
              href={data.actions.saveContactUrl}
              onClick={() => onSaveContact?.({ cardId: data.cardId, slug: data.slug })}
              className="w-full min-h-[44px] h-14 bg-bridge-orange text-charcoal font-extrabold text-base rounded-arch flex items-center justify-center shadow-sm hover:opacity-95 transition-opacity"
            >
              {t.saveContact}
            </a>

            {/* WhatsApp (Outline Button) */}
            {data.actions.whatsappUrl && (
              <a
                href={data.actions.whatsappUrl}
                onClick={() => onCtaClick?.('whatsapp')}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full min-h-[44px] h-12 border-2 ${isDark ? 'border-sand-border/30 bg-charcoal text-sand hover:bg-charcoal-deep' : 'border-sand-border bg-sand-paper text-charcoal hover:bg-sand/40 dark:bg-charcoal dark:border-sand-border/30 dark:text-sand dark:hover:bg-charcoal-deep'} font-bold text-sm rounded-arch flex items-center justify-center transition-colors`}
              >
                <span className="mr-2">💬</span>
                {t.whatsapp}
              </a>
            )}
          </div>

          {/* Secondary Action Row: Call, Email, Directions */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {data.actions.callUrl ? (
              <a
                href={data.actions.callUrl}
                onClick={() => onCtaClick?.('call')}
                className={`min-h-[44px] py-2 px-1 border ${isDark ? 'border-sand-border/30 text-sand bg-sand/10 hover:bg-sand/20' : 'border-sand-border text-charcoal bg-sand/30 hover:bg-sand/60 dark:border-sand-border/30 dark:text-sand dark:bg-sand/10'} rounded-xl text-xs font-bold flex flex-col items-center justify-center transition-colors`}
              >
                <span className="text-sm mb-0.5">📞</span>
                <span>{t.call}</span>
              </a>
            ) : (
              <div />
            )}

            {data.actions.emailUrl ? (
              <a
                href={data.actions.emailUrl}
                onClick={() => onCtaClick?.('email')}
                className={`min-h-[44px] py-2 px-1 border ${isDark ? 'border-sand-border/30 text-sand bg-sand/10 hover:bg-sand/20' : 'border-sand-border text-charcoal bg-sand/30 hover:bg-sand/60 dark:border-sand-border/30 dark:text-sand dark:bg-sand/10'} rounded-xl text-xs font-bold flex flex-col items-center justify-center transition-colors`}
              >
                <span className="text-sm mb-0.5">✉️</span>
                <span>{t.email}</span>
              </a>
            ) : (
              <div />
            )}

            {data.actions.directionsUrl ? (
              <a
                href={data.actions.directionsUrl}
                onClick={() => onCtaClick?.('directions')}
                target="_blank"
                rel="noopener noreferrer"
                className={`min-h-[44px] py-2 px-1 border ${isDark ? 'border-sand-border/30 text-sand bg-sand/10 hover:bg-sand/20' : 'border-sand-border text-charcoal bg-sand/30 hover:bg-sand/60 dark:border-sand-border/30 dark:text-sand dark:bg-sand/10'} rounded-xl text-xs font-bold flex flex-col items-center justify-center transition-colors`}
              >
                <span className="text-sm mb-0.5">📍</span>
                <span>{t.directions}</span>
              </a>
            ) : (
              <div />
            )}
          </div>

          {/* Share-Back Panel Container (AC-8 per Reference Screen 1, F13 interactive) */}
          <div
            data-testid="shareback-panel"
            className={`mt-8 pt-6 border-t-2 ${isDark ? 'border-sand-border/30 bg-sand/5 text-sand' : 'border-sand-border bg-sand/20 text-charcoal dark:border-sand-border/30 dark:bg-sand/5 dark:text-sand'} text-left rounded-arch p-4`}
          >
            {sharebackStatus === 'success' ? (
              <div
                data-testid="shareback-success"
                className="p-4 rounded-22 border border-success/30 bg-success/10 text-center transition-opacity duration-150 animate-arc-success"
              >
                <div className="w-12 h-12 mx-auto mb-2 relative flex items-center justify-center text-success">
                  <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                    <path
                      d="M 8 36 A 16 16 0 0 1 40 36"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 16 24 L 22 30 L 32 18"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h2 className={`text-base font-extrabold ${isDark ? 'text-sand' : 'text-charcoal dark:text-sand'} mb-1`}>
                  {t.sharebackSuccessTitle}
                </h2>
                <p className="text-xs opacity-80 mb-3">
                  {t.sharebackSuccessBody(person.name)}
                </p>
                <button
                  type="button"
                  data-testid="shareback-dismiss"
                  onClick={() => setSharebackStatus('idle')}
                  className={`min-h-[44px] px-4 py-2 ${isDark ? 'bg-charcoal border-sand-border/30 text-sand' : 'bg-sand-paper border-sand-border text-charcoal dark:bg-charcoal dark:border-sand-border/30 dark:text-sand'} border text-xs font-bold rounded-arch hover:opacity-80 transition-opacity`}
                >
                  {t.sendAnother}
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <h2 className="text-base font-extrabold">{t.sharebackTitle}</h2>
                </div>
                <p className="text-xs opacity-70 mb-3">{t.sharebackSubtitle}</p>

                <form onSubmit={handleSharebackSubmit} noValidate className="space-y-3">
                  {formError && (
                    <div
                      role="alert"
                      className="p-2.5 rounded-lg border border-error/40 bg-error/10 text-error text-xs font-medium flex items-center space-x-2"
                    >
                      <span aria-hidden="true">⚠️</span>
                      <span>{formError}</span>
                    </div>
                  )}

                  <div>
                    <label htmlFor="shareback-name" className="block text-xs font-bold mb-1 opacity-90">
                      {t.namePlaceholder} <span className="text-error" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="shareback-name"
                      name="name"
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder={t.namePlaceholder}
                      className={`w-full min-h-[44px] text-xs p-2.5 rounded-lg border ${
                        isDark
                          ? 'border-sand-border/30 bg-charcoal text-sand focus:border-bridge-orange'
                          : 'border-sand-border bg-sand-paper text-charcoal focus:border-bridge-orange dark:border-sand-border/30 dark:bg-charcoal dark:text-sand'
                      } outline-none`}
                      aria-required="true"
                    />
                  </div>

                  <div>
                    <label htmlFor="shareback-phone" className="block text-xs font-bold mb-1 opacity-90">
                      {t.phonePlaceholder} <span className="text-error" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="shareback-phone"
                      name="phone"
                      type="tel"
                      required
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder={t.phonePlaceholder}
                      className={`w-full min-h-[44px] text-xs p-2.5 rounded-lg border ${
                        isDark
                          ? 'border-sand-border/30 bg-charcoal text-sand focus:border-bridge-orange'
                          : 'border-sand-border bg-sand-paper text-charcoal focus:border-bridge-orange dark:border-sand-border/30 dark:bg-charcoal dark:text-sand'
                      } outline-none`}
                      aria-required="true"
                    />
                  </div>

                  <div>
                    <label htmlFor="shareback-email" className="block text-xs font-bold mb-1 opacity-90">
                      {t.emailPlaceholder}
                    </label>
                    <input
                      id="shareback-email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder={t.emailPlaceholder}
                      className={`w-full min-h-[44px] text-xs p-2.5 rounded-lg border ${
                        isDark
                          ? 'border-sand-border/30 bg-charcoal text-sand focus:border-bridge-orange'
                          : 'border-sand-border bg-sand-paper text-charcoal focus:border-bridge-orange dark:border-sand-border/30 dark:bg-charcoal dark:text-sand'
                      } outline-none`}
                    />
                  </div>

                  <div>
                    <label htmlFor="shareback-company" className="block text-xs font-bold mb-1 opacity-90">
                      {t.companyPlaceholder}
                    </label>
                    <input
                      id="shareback-company"
                      name="company"
                      type="text"
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                      placeholder={t.companyPlaceholder}
                      className={`w-full min-h-[44px] text-xs p-2.5 rounded-lg border ${
                        isDark
                          ? 'border-sand-border/30 bg-charcoal text-sand focus:border-bridge-orange'
                          : 'border-sand-border bg-sand-paper text-charcoal focus:border-bridge-orange dark:border-sand-border/30 dark:bg-charcoal dark:text-sand'
                      } outline-none`}
                    />
                  </div>

                  <div>
                    <label htmlFor="shareback-note" className="block text-xs font-bold mb-1 opacity-90">
                      {t.notePlaceholder}
                    </label>
                    <input
                      id="shareback-note"
                      name="note"
                      type="text"
                      value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                      placeholder={t.notePlaceholder}
                      className={`w-full min-h-[44px] text-xs p-2.5 rounded-lg border ${
                        isDark
                          ? 'border-sand-border/30 bg-charcoal text-sand focus:border-bridge-orange'
                          : 'border-sand-border bg-sand-paper text-charcoal focus:border-bridge-orange dark:border-sand-border/30 dark:bg-charcoal dark:text-sand'
                      } outline-none`}
                    />
                  </div>

                  <div className="pt-1">
                    <label className="flex items-start space-x-2 text-xs cursor-pointer">
                      <input
                        id="shareback-consent"
                        name="consent"
                        type="checkbox"
                        required
                        checked={form.consent}
                        onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                        className="mt-0.5 h-4 w-4 rounded border-sand-border text-bridge-orange focus:ring-bridge-orange"
                        aria-required="true"
                        aria-label={t.consentCheckbox}
                      />
                      <span className="opacity-90 leading-tight">
                        {t.consentCheckbox}{' '}
                        <a
                          href={privacyNoticeUrl || '/privacy'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-bold text-deep-orange hover:opacity-80"
                        >
                          {t.privacyNoticeLink}
                        </a>
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full min-h-[44px] h-12 bg-bridge-orange text-charcoal font-bold text-xs rounded-arch shadow-sm hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center cursor-pointer"
                  >
                    {isSubmitting ? t.sendingShareback : t.sendShareback}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Sections List */}
          {data.sections && data.sections.length > 0 && (
            <div className="mt-6 space-y-4 text-left">
              {data.sections.map((section, idx) => {
                if (section.type === 'about' && section.content?.text) {
                  return (
                    <div key={idx} className={`p-4 ${isDark ? 'bg-sand/10 border-sand-border/30 text-sand' : 'bg-sand/20 border-sand-border text-charcoal dark:bg-sand/10 dark:border-sand-border/30 dark:text-sand'} border rounded-xl`}>
                      <h2 className="text-xs font-extrabold uppercase tracking-wider opacity-60 mb-1">About</h2>
                      <p className="text-xs opacity-80 leading-relaxed">{String(section.content.text)}</p>
                    </div>
                  );
                }
                if (section.type === 'products' && Array.isArray(section.content?.items)) {
                  return (
                    <div key={idx} className={`p-4 ${isDark ? 'bg-sand/10 border-sand-border/30 text-sand' : 'bg-sand/20 border-sand-border text-charcoal dark:bg-sand/10 dark:border-sand-border/30 dark:text-sand'} border rounded-xl`}>
                      <h2 className="text-xs font-extrabold uppercase tracking-wider opacity-60 mb-2">Products</h2>
                      <ul className="space-y-2">
                        {(section.content.items as Array<{ name?: string; description?: string }>).map((item, itemIdx) => (
                          <li key={itemIdx} className="text-xs">
                            <span className="font-bold">{item.name}</span>
                            {item.description && <span className="opacity-70"> — {item.description}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}

          {/* Business ID Footer */}
          <div className="mt-8 pt-4 border-t border-sand-border/40 text-center">
            <p className="text-[11px] opacity-50 font-medium">
              {company?.businessId} • OneBridge Grid
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
