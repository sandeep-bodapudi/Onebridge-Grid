import React, { useEffect, useId, useMemo, useState } from 'react';
import { Check, ImagePlus, Lock, Unlock, WifiOff, AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from './ActionButton';
import { Button } from './Button';
import { Input } from './Input';
import { Skeleton } from './Skeleton';
import { SpanLine } from './SpanLine';

export interface BrandColoursState {
  band: string;
  accent: string;
  text: string;
}

export interface BrandKitState {
  logo?: string | null;
  brandColours: BrandColoursState;
  coverImage?: string | null;
}

export interface FieldLocksState {
  lockedFields: string[];
}

export const LOCKABLE_FIELDS = [
  { key: 'title', labelEn: 'Job title', labelHi: 'पद का नाम' },
  { key: 'departmentId', labelEn: 'Department', labelHi: 'विभाग' },
  { key: 'branchId', labelEn: 'Branch', labelHi: 'शाखा / स्थान' },
  { key: 'phone', labelEn: 'Work phone number', labelHi: 'कार्य फोन नंबर' },
  { key: 'email', labelEn: 'Work email', labelHi: 'कार्य ईमेल पता' },
  { key: 'bio', labelEn: 'About me', labelHi: 'पेशेवर विवरण' },
  { key: 'socialLinks', labelEn: 'Social links', labelHi: 'सोशल प्रोफाइल लिंक' },
  { key: 'logo', labelEn: 'Company logo', labelHi: 'कंपनी का लोगो' },
  { key: 'brandColours', labelEn: 'Brand colours', labelHi: 'ब्रांड रंग पैलेट' },
] as const;

export interface BrandKitLabels {
  title: string;
  subtitle: string;
  logoSectionTitle: string;
  logoSectionDesc: string;
  uploadLogoBtn: string;
  uploadingText: string;
  uploadFormatHint: string;
  removeLogoBtn: string;
  coloursSectionTitle: string;
  coloursSectionDesc: string;
  bandColourLabel: string;
  accentColourLabel: string;
  textColourLabel: string;
  contrastEvaluationTitle: string;
  contrastPass: string;
  contrastFail: string;
  contrastWarningNotice: string;
  autoPickRecommendation: string;
  applyAutoPickBtn: string;
  coverImageLabel: string;
  coverImagePlaceholder: string;
  fieldLocksTitle: string;
  fieldLocksDesc: string;
  lockWarningEmployee: string;
  lockedFieldTooltip: string;
  lockedBadge: string;
  unlockedBadge: string;
  previewTitle: string;
  previewCardName: string;
  previewCardTitle: string;
  previewCardCompany: string;
  saveChangesBtn: string;
  savingBtn: string;
  resetBtn: string;
  unsavedChangesBanner: string;
  offlineBanner: string;
  errorBanner: string;
  emptyTitle: string;
}

export const defaultBrandKitLabelsEn: BrandKitLabels = {
  title: 'Brand kit',
  subtitle: 'Your logo and colours on every card, and which card details employees may change.',
  logoSectionTitle: 'Company logo',
  logoSectionDesc: 'Shown on every card and on printed QR standees.',
  uploadLogoBtn: 'Upload logo',
  uploadingText: 'Uploading...',
  uploadFormatHint: 'PNG, SVG or WebP, up to 5 MB.',
  removeLogoBtn: 'Remove logo',
  coloursSectionTitle: 'Brand colours',
  coloursSectionDesc: 'The header colour and the text on it must be easy to read for every visitor.',
  bandColourLabel: 'Header colour',
  accentColourLabel: 'Accent colour',
  textColourLabel: 'Header text colour',
  contrastEvaluationTitle: 'Readability',
  contrastPass: 'Easy to read (WCAG AA pass)',
  contrastFail: 'Hard to read',
  contrastWarningNotice: 'Text contrast is below 4.5:1, so some visitors will struggle to read the name on the card.',
  autoPickRecommendation: 'Recommended text colour:',
  applyAutoPickBtn: 'Apply recommended text colour',
  coverImageLabel: 'Header cover image URL',
  coverImagePlaceholder: 'https://cdn.example.com/cover.jpg',
  fieldLocksTitle: 'What employees can change',
  fieldLocksDesc: 'Locked details come from the company and stay the same on every card.',
  lockWarningEmployee: 'Some fields are locked by your organization administrator and cannot be modified.',
  lockedFieldTooltip: 'Locked by organization policy. Employees cannot modify this field on their cards.',
  lockedBadge: 'Locked',
  unlockedBadge: 'Employees can edit',
  previewTitle: 'Card preview',
  previewCardName: 'Your name',
  previewCardTitle: 'Your job title',
  previewCardCompany: 'Your company',
  saveChangesBtn: 'Save brand kit',
  savingBtn: 'Saving...',
  resetBtn: 'Discard changes',
  unsavedChangesBanner: 'You have unsaved changes.',
  offlineBanner: 'You are currently offline. Changes will be saved once connectivity is restored.',
  errorBanner: 'Could not save the brand kit. Check the details and try again.',
  emptyTitle: 'No brand kit set up yet.',
};

export const defaultBrandKitLabelsHi: BrandKitLabels = {
  title: 'ब्रांड किट और कार्ड लॉक',
  subtitle: 'अपनी कंपनी के रंग, सत्यापित लोगो कॉन्फ़िगर करें और नियंत्रित करें कि कर्मचारी कौन से फ़ील्ड संपादित कर सकते हैं।',
  logoSectionTitle: 'कंपनी लोगो',
  logoSectionDesc: 'कर्मचारी डिजिटल कार्ड, एनएफसी चिप्स और प्रिंट सामग्री पर दिखाई देता है।',
  uploadLogoBtn: 'लोगो अपलोड करें',
  uploadingText: 'अपलोड और स्कैन हो रहा है...',
  uploadFormatHint: 'पीएनजी, एसवीजी या वेबपी अधिकतम 5 एमबी।',
  removeLogoBtn: 'लोगो हटाएं',
  coloursSectionTitle: 'ब्रांड रंग',
  coloursSectionDesc: 'आपके डिजिटल कार्ड पर लागू रंग। WCAG 2.1 AA पठनीयता मानकों को पूरा करना चाहिए।',
  bandColourLabel: 'शीर्ष बैंड रंग',
  accentColourLabel: 'एक्शन एक्सेंट रंग',
  textColourLabel: 'बैंड टेक्स्ट रंग',
  contrastEvaluationTitle: 'कंट्रास्ट जांच',
  contrastPass: 'पठनीय (पास)',
  contrastFail: 'कम कंट्रास्ट चेतावनी',
  contrastWarningNotice: 'टेक्स्ट कंट्रास्ट 4.5:1 से कम है। आगंतुकों को पढ़ने में कठिनाई हो सकती है।',
  autoPickRecommendation: 'सुझाया गया पठनीय टेक्स्ट रंग:',
  applyAutoPickBtn: 'सुझाया गया टेक्स्ट रंग लागू करें',
  coverImageLabel: 'कवर इमेज यूआरएल',
  coverImagePlaceholder: 'https://cdn.example.com/cover.jpg',
  fieldLocksTitle: 'कर्मचारी फ़ील्ड लॉक',
  fieldLocksDesc: 'लॉक किए गए फ़ील्ड कर्मचारियों द्वारा नहीं बदले जा सकते।',
  lockWarningEmployee: 'कुछ फ़ील्ड व्यवस्थापक द्वारा लॉक किए गए हैं और बदले नहीं जा सकते।',
  lockedFieldTooltip: 'संगठन नीति द्वारा लॉक किया गया। कर्मचारी इस फ़ील्ड को अपने कार्ड पर नहीं बदल सकते।',
  lockedBadge: 'लॉक किया गया',
  unlockedBadge: 'अनलॉक',
  previewTitle: 'लाइव डिजिटल कार्ड पूर्वावलोकन',
  previewCardName: 'विक्रम मल्होत्रा',
  previewCardTitle: 'व्यवसाय विकास प्रमुख',
  previewCardCompany: 'एपेक्स सॉल्यूशंस प्रा. लि.',
  saveChangesBtn: 'ब्रांड किट सहेजें',
  savingBtn: 'सहेजा जा रहा है...',
  resetBtn: 'बदलाव रद्द करें',
  unsavedChangesBanner: 'आपके पास बिना सहेजे बदलाव हैं।',
  offlineBanner: 'आप ऑफ़लाइन हैं। नेटवर्क वापस आने पर बदलाव सहेजे जाएंगे।',
  errorBanner: 'बदलाव सहेजने में विफल। कृपया पुन: प्रयास करें।',
  emptyTitle: 'अभी तक कोई ब्रांड किट कॉन्फ़िगर नहीं की गई है।',
};

// Pure client-side WCAG 2.1 AA relative luminance & contrast calculations
const CHARCOAL = '#393536';
const WARM_PAPER = '#FAF7F2';

function parseHex(hex: string): [number, number, number] | null {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : [r, g, b];
  }
  return null;
}

function sRgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function getRelativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  return 0.2126 * sRgbToLinear(rgb[0]) + 0.7152 * sRgbToLinear(rgb[1]) + 0.0722 * sRgbToLinear(rgb[2]);
}

export function calculateContrast(hex1: string, hex2: string): {
  ratio: number;
  isAccessible: boolean;
  autoPickColor: string;
  autoPickRatio: number;
} {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);

  const charcoalRatio = (Math.max(l1, getRelativeLuminance(CHARCOAL)) + 0.05) / (Math.min(l1, getRelativeLuminance(CHARCOAL)) + 0.05);
  const paperRatio = (Math.max(l1, getRelativeLuminance(WARM_PAPER)) + 0.05) / (Math.min(l1, getRelativeLuminance(WARM_PAPER)) + 0.05);

  const autoPickColor = charcoalRatio >= paperRatio ? CHARCOAL : WARM_PAPER;
  const autoPickRatio = Math.max(charcoalRatio, paperRatio);

  return {
    ratio: Math.round(ratio * 10) / 10,
    isAccessible: ratio >= 4.5,
    autoPickColor,
    autoPickRatio: Math.round(autoPickRatio * 10) / 10,
  };
}

export interface BrandKitManagerProps {
  initialBrandKit?: BrandKitState;
  initialLocks?: FieldLocksState;
  userRole?: 'owner' | 'admin' | 'employee';
  isLoading?: boolean;
  error?: string | null;
  isOffline?: boolean;
  /** A real card from the company, shown in the preview instead of placeholder text. */
  previewPerson?: { name?: string; designation?: string; companyName?: string };
  onSaveBrandKit?: (brandKit: BrandKitState, acceptAutoPick?: boolean) => Promise<void>;
  onSaveLocks?: (locks: FieldLocksState) => Promise<void>;
  onUploadLogo?: (file: File) => Promise<{ url: string; key: string }>;
  labels?: Partial<BrandKitLabels>;
  className?: string;
}

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

const ColourField: React.FC<{
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}> = ({ id, label, value, disabled, onChange }) => {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const invalid = !HEX_PATTERN.test(text);
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={HEX_PATTERN.test(value) ? value : '#000000'}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="w-11 h-11 shrink-0 rounded-control border border-sand-border dark:border-sand-border/30 bg-transparent p-1 cursor-pointer disabled:cursor-not-allowed"
        />
        <Input
          id={id}
          value={text}
          disabled={disabled}
          hasError={invalid}
          aria-invalid={invalid || undefined}
          maxLength={7}
          className="font-mono uppercase"
          onChange={(e) => {
            const next = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
            setText(next);
            if (HEX_PATTERN.test(next)) onChange(next.toUpperCase());
          }}
        />
      </div>
      {invalid ? <p className="text-sm text-error">Enter a colour code like #1B2A4A.</p> : null}
    </div>
  );
};

export const BrandKitManager: React.FC<BrandKitManagerProps> = ({
  initialBrandKit = {
    logo: null,
    brandColours: { band: '#1B2A4A', accent: '#F68713', text: '#FFFFFF' },
    coverImage: null,
  },
  initialLocks = { lockedFields: [] },
  userRole = 'admin',
  isLoading = false,
  error = null,
  isOffline = false,
  previewPerson,
  onSaveBrandKit,
  onSaveLocks,
  onUploadLogo,
  labels: customLabels,
  className,
}) => {
  const labels: BrandKitLabels = { ...defaultBrandKitLabelsEn, ...customLabels };
  const isEmployee = userRole === 'employee';
  const isHindi = labels.title !== defaultBrandKitLabelsEn.title && /[ऀ-ॿ]/.test(labels.title);

  const [brandKit, setBrandKit] = useState<BrandKitState>(initialBrandKit);
  const [locks, setLocks] = useState<FieldLocksState>(initialLocks);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileInputId = useId();
  const idPrefix = useId();

  // Follow the loaded values when the host finishes fetching them.
  const initialKey = JSON.stringify(initialBrandKit);
  const initialLocksKey = JSON.stringify(initialLocks);
  useEffect(() => {
    setBrandKit(initialBrandKit);
  }, [initialKey]);
  useEffect(() => {
    setLocks(initialLocks);
  }, [initialLocksKey]);

  const contrast = useMemo(
    () => calculateContrast(brandKit.brandColours.band, brandKit.brandColours.text),
    [brandKit.brandColours.band, brandKit.brandColours.text]
  );

  const kitChanged =
    brandKit.logo !== initialBrandKit.logo ||
    brandKit.brandColours.band !== initialBrandKit.brandColours.band ||
    brandKit.brandColours.accent !== initialBrandKit.brandColours.accent ||
    brandKit.brandColours.text !== initialBrandKit.brandColours.text ||
    (brandKit.coverImage || null) !== (initialBrandKit.coverImage || null);
  const locksChanged = (() => {
    const a = new Set(initialLocks.lockedFields);
    const b = new Set(locks.lockedFields);
    return a.size !== b.size || [...a].some((f) => !b.has(f));
  })();
  const hasUnsavedChanges = kitChanged || locksChanged;

  const setColour = (key: keyof BrandColoursState, value: string) => {
    setSaveSuccess(false);
    setBrandKit((prev) => ({ ...prev, brandColours: { ...prev.brandColours, [key]: value } }));
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('This file is larger than 5 MB. Choose a smaller logo.');
      return;
    }
    if (!['image/png', 'image/svg+xml', 'image/webp'].includes(file.type)) {
      setUploadError('Use a PNG, SVG or WebP file.');
      return;
    }
    setUploadError(null);
    setIsUploading(true);
    try {
      if (onUploadLogo) {
        const result = await onUploadLogo(file);
        setBrandKit((prev) => ({ ...prev, logo: result.url }));
      } else {
        setBrandKit((prev) => ({ ...prev, logo: URL.createObjectURL(file) }));
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Could not upload the logo. Try again.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const toggleFieldLock = (fieldKey: string) => {
    if (isEmployee) return;
    setSaveSuccess(false);
    setLocks((prev) => ({
      lockedFields: prev.lockedFields.includes(fieldKey)
        ? prev.lockedFields.filter((f) => f !== fieldKey)
        : [...prev.lockedFields, fieldKey],
    }));
  };

  const handleApplyAutoPick = () => {
    setColour('text', contrast.autoPickColor);
  };

  const handleSave = async () => {
    if (!contrast.isAccessible) return;
    setIsSaving(true);
    setActionError(null);
    setSaveSuccess(false);
    try {
      // Contrast is already fixed in the browser, so the server never needs to auto-pick.
      if (kitChanged && onSaveBrandKit) await onSaveBrandKit(brandKit, false);
      if (locksChanged && onSaveLocks) await onSaveLocks(locks);
      if (!kitChanged && !locksChanged && onSaveBrandKit) await onSaveBrandKit(brandKit, false);
      setSaveSuccess(true);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : labels.errorBanner);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setBrandKit(initialBrandKit);
    setLocks(initialLocks);
    setActionError(null);
  };

  if (isLoading) {
    return (
      <div className={cn('grid lg:grid-cols-[minmax(0,1fr)_360px] gap-8', className)} aria-busy="true">
        <div className="space-y-4">
          <div className="h-7 w-1/3 bg-sand dark:bg-charcoal animate-pulse motion-reduce:animate-none rounded-control" />
          <Skeleton height={120} />
          <Skeleton height={200} />
        </div>
        <Skeleton height={420} />
      </div>
    );
  }

  const previewName = previewPerson?.name || labels.previewCardName;
  const previewTitle = previewPerson?.designation || labels.previewCardTitle;
  const previewCompany = previewPerson?.companyName || labels.previewCardCompany;

  return (
    <div className={cn('text-charcoal dark:text-warm-paper', className)}>
      <div className="mb-6">
        <h2 className="text-2xl md:text-[28px] md:leading-9 font-bold tracking-tight">{labels.title}</h2>
        <p className="text-sm text-charcoal/70 dark:text-warm-paper/70 max-w-2xl">{labels.subtitle}</p>
      </div>

      <div className="space-y-3 mb-6">
        {isOffline ? (
          <div role="status" className="flex items-center gap-3 px-4 py-3 rounded-panel border border-warning/40 bg-warning/10 text-sm">
            <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
            {labels.offlineBanner}
          </div>
        ) : null}
        {error || actionError ? (
          <div role="alert" className="flex items-center gap-3 px-4 py-3 rounded-panel border border-error/40 bg-error/10 text-sm">
            <AlertTriangle className="w-4 h-4 text-error shrink-0" aria-hidden="true" />
            {actionError || error}
          </div>
        ) : null}
        {isEmployee ? (
          <div role="note" className="flex items-center gap-3 px-4 py-3 rounded-panel border border-sand-border dark:border-sand-border/30 bg-sand/40 dark:bg-charcoal text-sm">
            <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
            {labels.lockWarningEmployee}
          </div>
        ) : null}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-8 items-start">
        <div className="space-y-8 min-w-0">
          {/* Logo */}
          <section className="space-y-3" aria-labelledby={`${idPrefix}-logo`}>
            <div>
              <h3 id={`${idPrefix}-logo`} className="text-base font-bold">
                {labels.logoSectionTitle}
              </h3>
              <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">{labels.logoSectionDesc}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-24 h-24 shrink-0 rounded-panel border border-dashed border-sand-border dark:border-sand-border/30 bg-warm-paper dark:bg-charcoal flex items-center justify-center overflow-hidden">
                {brandKit.logo ? (
                  <img src={brandKit.logo} alt={`${labels.logoSectionTitle} preview`} className="max-w-full max-h-full object-contain p-2" />
                ) : (
                  <ImagePlus className="w-7 h-7 text-charcoal/40 dark:text-warm-paper/40" aria-hidden="true" />
                )}
              </div>
              {!isEmployee ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <label
                      htmlFor={fileInputId}
                      className={cn(
                        'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-control border border-sand-border dark:border-sand-border/30 bg-warm-paper dark:bg-charcoal text-sm font-bold cursor-pointer hover:bg-sand dark:hover:bg-charcoal-deep',
                        isUploading && 'opacity-50 pointer-events-none'
                      )}
                    >
                      <ImagePlus className="w-4 h-4" aria-hidden="true" />
                      {isUploading ? labels.uploadingText : labels.uploadLogoBtn}
                    </label>
                    <input
                      id={fileInputId}
                      type="file"
                      accept="image/png,image/svg+xml,image/webp"
                      className="sr-only"
                      onChange={handleLogoFileChange}
                      disabled={isUploading}
                    />
                    {brandKit.logo ? (
                      <Button variant="ghost" onClick={() => setBrandKit((prev) => ({ ...prev, logo: null }))} className="gap-2">
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                        {labels.removeLogoBtn}
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-charcoal/60 dark:text-warm-paper/60">{labels.uploadFormatHint}</p>
                  {uploadError ? <p className="text-sm text-error" role="alert">{uploadError}</p> : null}
                </div>
              ) : null}
            </div>
          </section>

          <SpanLine className="my-0 opacity-30" />

          {/* Colours */}
          <section className="space-y-4" aria-labelledby={`${idPrefix}-colours`}>
            <div>
              <h3 id={`${idPrefix}-colours`} className="text-base font-bold">
                {labels.coloursSectionTitle}
              </h3>
              <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">{labels.coloursSectionDesc}</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <ColourField
                id={`${idPrefix}-band`}
                label={labels.bandColourLabel}
                value={brandKit.brandColours.band}
                disabled={isEmployee}
                onChange={(v) => setColour('band', v)}
              />
              <ColourField
                id={`${idPrefix}-text`}
                label={labels.textColourLabel}
                value={brandKit.brandColours.text}
                disabled={isEmployee}
                onChange={(v) => setColour('text', v)}
              />
              <ColourField
                id={`${idPrefix}-accent`}
                label={labels.accentColourLabel}
                value={brandKit.brandColours.accent}
                disabled={isEmployee}
                onChange={(v) => setColour('accent', v)}
              />
            </div>

            <div
              className={cn(
                'flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-panel border',
                contrast.isAccessible ? 'border-success/40 bg-success/10' : 'border-error/40 bg-error/10'
              )}
              role="status"
            >
              <div className="flex items-start gap-3">
                {contrast.isAccessible ? (
                  <Check className="w-5 h-5 text-success shrink-0" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-error shrink-0" aria-hidden="true" />
                )}
                <div className="text-sm">
                  <div className="font-bold">
                    {contrast.isAccessible ? labels.contrastPass : labels.contrastFail}
                    <span className="font-normal text-charcoal/70 dark:text-warm-paper/70"> · contrast {contrast.ratio}:1</span>
                  </div>
                  {!contrast.isAccessible ? <p>{labels.contrastWarningNotice}</p> : null}
                </div>
              </div>
              {!contrast.isAccessible && !isEmployee ? (
                <Button variant="secondary" onClick={handleApplyAutoPick} className="gap-2 shrink-0">
                  <span
                    aria-hidden="true"
                    className="w-4 h-4 rounded-[2px] border border-sand-border"
                    style={{ backgroundColor: contrast.autoPickColor }}
                  />
                  {labels.applyAutoPickBtn}
                </Button>
              ) : null}
            </div>
          </section>

          <SpanLine className="my-0 opacity-30" />

          {/* Field locks */}
          <section className="space-y-3" aria-labelledby={`${idPrefix}-locks`}>
            <div>
              <h3 id={`${idPrefix}-locks`} className="text-base font-bold">
                {labels.fieldLocksTitle}
              </h3>
              <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">{labels.fieldLocksDesc}</p>
            </div>
            <ul className="rounded-panel border border-sand-border dark:border-sand-border/30 divide-y divide-sand-border dark:divide-sand-border/30 overflow-hidden">
              {LOCKABLE_FIELDS.map((field) => {
                const isLocked = locks.lockedFields.includes(field.key);
                const fieldLabel = isHindi ? field.labelHi : field.labelEn;
                return (
                  <li
                    key={field.key}
                    data-testid={`field-row-${field.key}`}
                    title={isLocked ? labels.lockedFieldTooltip : undefined}
                    className="flex items-center justify-between gap-3 px-4 min-h-[52px] bg-warm-paper dark:bg-charcoal"
                  >
                    <span className="text-sm font-semibold">{fieldLabel}</span>
                    {isEmployee ? (
                      <span
                        data-testid={`lock-status-${field.key}`}
                        title={isLocked ? labels.lockedFieldTooltip : undefined}
                        className="inline-flex items-center gap-1.5 text-sm text-charcoal/70 dark:text-warm-paper/70"
                      >
                        {isLocked ? <Lock className="w-4 h-4" aria-hidden="true" /> : <Unlock className="w-4 h-4" aria-hidden="true" />}
                        {isLocked ? labels.lockedBadge : labels.unlockedBadge}
                      </span>
                    ) : (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isLocked}
                        aria-label={`${fieldLabel}: ${isLocked ? labels.lockedBadge : labels.unlockedBadge}`}
                        data-testid={`lock-status-${field.key}`}
                        title={isLocked ? labels.lockedFieldTooltip : undefined}
                        onClick={() => toggleFieldLock(field.key)}
                        className={cn(
                          'inline-flex items-center gap-2 min-h-[44px] px-3 rounded-control text-sm font-semibold transition-colors',
                          isLocked
                            ? 'bg-charcoal text-warm-paper dark:bg-warm-paper dark:text-charcoal'
                            : 'text-charcoal/70 hover:bg-sand dark:text-warm-paper/70 dark:hover:bg-charcoal-deep'
                        )}
                      >
                        {isLocked ? <Lock className="w-4 h-4" aria-hidden="true" /> : <Unlock className="w-4 h-4" aria-hidden="true" />}
                        {isLocked ? labels.lockedBadge : labels.unlockedBadge}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* Preview */}
        <aside className="lg:sticky lg:top-0 space-y-3" aria-label={labels.previewTitle}>
          <h3 className="text-sm font-bold text-charcoal/70 dark:text-warm-paper/70">{labels.previewTitle}</h3>
          <div className="rounded-sheet border border-sand-border dark:border-sand-border/30 bg-warm-paper dark:bg-charcoal overflow-hidden shadow-overlay max-w-[340px]">
            <div data-testid="preview-header-band" className="relative px-5 pt-5 pb-6" style={{ backgroundColor: brandKit.brandColours.band }}>
              <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[5px] bg-bridge-orange" />
              <div className="flex items-center justify-between mb-5">
                {brandKit.logo ? (
                  <img src={brandKit.logo} alt="" className="max-h-7 max-w-[120px] object-contain" />
                ) : (
                  <span className="text-xs font-semibold" style={{ color: brandKit.brandColours.text, opacity: 0.8 }}>
                    {previewCompany}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0"
                  style={{ backgroundColor: brandKit.brandColours.text, color: brandKit.brandColours.band }}
                >
                  {previewName.charAt(0)}
                </span>
                <div className="min-w-0">
                  <div data-testid="preview-card-name" className="text-xl font-bold leading-tight break-words" style={{ color: brandKit.brandColours.text }}>
                    {previewName}
                  </div>
                  <div className="text-sm" style={{ color: brandKit.brandColours.text, opacity: 0.85 }}>
                    {previewTitle}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 p-3 bg-white" aria-hidden="true">
              {['Call', 'Email', 'Directions'].map((label) => (
                <div key={label} className="py-3 text-center text-xs font-bold rounded-xl bg-[#F4EFE6] text-charcoal">
                  <span className="block w-4 h-[3px] mx-auto mb-1.5" style={{ backgroundColor: brandKit.brandColours.accent }} />
                  {label}
                </div>
              ))}
            </div>
            <div className="p-3 pt-1 bg-white">
              <div className="h-11 rounded-[14px] bg-bridge-orange text-[#241A10] text-sm font-extrabold flex items-center justify-center" aria-hidden="true">
                Save contact
              </div>
            </div>
          </div>
        </aside>
      </div>

      {!isEmployee ? (
        <div className="sticky bottom-20 md:bottom-0 z-20 mt-8 -mx-4 md:-mx-8 px-4 md:px-8 py-3 border-t border-sand-border dark:border-sand-border/30 bg-warm-paper/95 dark:bg-charcoal-deep/95 backdrop-blur-sm flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/70" role="status">
            {saveSuccess && !hasUnsavedChanges ? 'Saved. New visits to your cards use these settings.' : hasUnsavedChanges ? labels.unsavedChangesBanner : 'All changes saved.'}
          </p>
          <div className="flex gap-2">
            {hasUnsavedChanges ? (
              <Button variant="ghost" onClick={handleReset} disabled={isSaving}>
                {labels.resetBtn}
              </Button>
            ) : null}
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!contrast.isAccessible || isSaving || !hasUnsavedChanges}
              data-testid="save-brand-kit"
            >
              {isSaving ? labels.savingBtn : labels.saveChangesBtn}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
