import React, { useState, useId, useMemo } from 'react';
import { cn, ActionButton } from './ActionButton';
import { StatusChip } from './index';

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
  { key: 'title', labelEn: 'Job title / Designation', labelHi: 'पद का नाम' },
  { key: 'departmentId', labelEn: 'Department', labelHi: 'विभाग' },
  { key: 'branchId', labelEn: 'Branch / Location', labelHi: 'शाखा / स्थान' },
  { key: 'phone', labelEn: 'Work phone number', labelHi: 'कार्य फोन नंबर' },
  { key: 'email', labelEn: 'Work email address', labelHi: 'कार्य ईमेल पता' },
  { key: 'bio', labelEn: 'Professional bio', labelHi: 'पेशेवर विवरण' },
  { key: 'socialLinks', labelEn: 'Social profile links', labelHi: 'सोशल प्रोफाइल लिंक' },
  { key: 'logo', labelEn: 'Company logo', labelHi: 'कंपनी का लोगो' },
  { key: 'brandColours', labelEn: 'Brand colour palette', labelHi: 'ब्रांड रंग पैलेट' },
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
  title: 'Brand kit and card locks',
  subtitle: 'Configure your company colours, verified logo, and control which card fields employees can edit.',
  logoSectionTitle: 'Company logo',
  logoSectionDesc: 'Appears at the top of employee digital cards, NFC chips, and printed materials.',
  uploadLogoBtn: 'Upload logo',
  uploadingText: 'Uploading & scanning...',
  uploadFormatHint: 'PNG, SVG, or WebP up to 5 MB. Automatically checked for security.',
  removeLogoBtn: 'Remove logo',
  coloursSectionTitle: 'Brand colours',
  coloursSectionDesc: 'Colours applied to your digital cards and QR profiles. Must pass WCAG 2.1 AA accessibility contrast.',
  bandColourLabel: 'Header band colour',
  accentColourLabel: 'Interactive accent colour',
  textColourLabel: 'Band text colour',
  contrastEvaluationTitle: 'Contrast check',
  contrastPass: 'WCAG AA Pass',
  contrastFail: 'Low contrast warning',
  contrastWarningNotice: 'Text contrast is below 4.5:1. Visitors will have trouble reading this card.',
  autoPickRecommendation: 'Recommended readable text colour:',
  applyAutoPickBtn: 'Apply recommended text colour',
  coverImageLabel: 'Header cover image URL',
  coverImagePlaceholder: 'https://cdn.example.com/cover.jpg',
  fieldLocksTitle: 'Field-level employee locks',
  fieldLocksDesc: 'Locked fields cannot be altered by employees when managing their individual cards.',
  lockWarningEmployee: 'Some fields are locked by your organization administrator and cannot be modified.',
  lockedFieldTooltip: 'Locked by organization policy. Employees cannot modify this field on their cards.',
  lockedBadge: 'Locked',
  unlockedBadge: 'Unlocked',
  previewTitle: 'Live digital card preview',
  previewCardName: 'Vikram Malhotra',
  previewCardTitle: 'Head of Business Development',
  previewCardCompany: 'Apex Solutions Pvt Ltd',
  saveChangesBtn: 'Save brand kit',
  savingBtn: 'Saving...',
  resetBtn: 'Discard changes',
  unsavedChangesBanner: 'You have unsaved branding or field lock changes.',
  offlineBanner: 'You are currently offline. Changes will be saved once connectivity is restored.',
  errorBanner: 'Unable to save branding changes. Please check details and try again.',
  emptyTitle: 'No brand kit configured yet.',
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
  onSaveBrandKit?: (brandKit: BrandKitState, acceptAutoPick?: boolean) => Promise<void>;
  onSaveLocks?: (locks: FieldLocksState) => Promise<void>;
  onUploadLogo?: (file: File) => Promise<{ url: string; key: string }>;
  labels?: Partial<BrandKitLabels>;
  className?: string;
}

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
  onSaveBrandKit,
  onSaveLocks,
  onUploadLogo,
  labels: customLabels,
  className,
}) => {
  const labels: BrandKitLabels = { ...defaultBrandKitLabelsEn, ...customLabels };
  const isEmployee = userRole === 'employee';

  const [brandKit, setBrandKit] = useState<BrandKitState>(initialBrandKit);
  const [locks, setLocks] = useState<FieldLocksState>(initialLocks);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fileInputId = useId();

  // Evaluate contrast between Band and Text
  const contrast = useMemo(() => {
    return calculateContrast(brandKit.brandColours.band, brandKit.brandColours.text);
  }, [brandKit.brandColours.band, brandKit.brandColours.text]);

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    const kitChanged =
      brandKit.logo !== initialBrandKit.logo ||
      brandKit.brandColours.band !== initialBrandKit.brandColours.band ||
      brandKit.brandColours.accent !== initialBrandKit.brandColours.accent ||
      brandKit.brandColours.text !== initialBrandKit.brandColours.text ||
      brandKit.coverImage !== initialBrandKit.coverImage;

    const initialSet = new Set(initialLocks.lockedFields);
    const currentSet = new Set(locks.lockedFields);
    const locksChanged =
      initialSet.size !== currentSet.size ||
      [...initialSet].some((f) => !currentSet.has(f));

    return kitChanged || locksChanged;
  }, [brandKit, locks, initialBrandKit, initialLocks]);

  // Handle Logo File Selection
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (<= 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Logo file size exceeds 5 MB limit.');
      return;
    }

    // Validate type (PNG, SVG, WebP)
    const validTypes = ['image/png', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Allowed formats: PNG, SVG, WebP.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      if (onUploadLogo) {
        const result = await onUploadLogo(file);
        setBrandKit((prev) => ({ ...prev, logo: result.url }));
      } else {
        // Local preview simulation
        const fakeUrl = URL.createObjectURL(file);
        setBrandKit((prev) => ({ ...prev, logo: fakeUrl }));
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Logo upload failed');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Toggle field locks
  const toggleFieldLock = (fieldKey: string) => {
    if (isEmployee) return;
    setLocks((prev) => {
      const exists = prev.lockedFields.includes(fieldKey);
      return {
        lockedFields: exists
          ? prev.lockedFields.filter((f) => f !== fieldKey)
          : [...prev.lockedFields, fieldKey],
      };
    });
  };

  // Apply auto-pick text colour
  const applyAutoPick = () => {
    setBrandKit((prev) => ({
      ...prev,
      brandColours: {
        ...prev.brandColours,
        text: contrast.autoPickColor,
      },
    }));
  };

  // Save changes
  const handleSave = async () => {
    if (!contrast.isAccessible) {
      setActionError(labels.contrastWarningNotice);
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setSaveSuccess(false);

    try {
      if (onSaveBrandKit) {
        await onSaveBrandKit(brandKit, false);
      }
      if (onSaveLocks) {
        await onSaveLocks(locks);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : labels.errorBanner);
    } finally {
      setIsSaving(false);
    }
  };

  // Discard changes
  const handleReset = () => {
    setBrandKit(initialBrandKit);
    setLocks(initialLocks);
    setUploadError(null);
    setActionError(null);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn('space-y-24 p-24 bg-white dark:bg-charcoal rounded-22 shadow-md animate-pulse', className)}>
        <div className="h-8 bg-sand/40 rounded-12 w-1/3"></div>
        <div className="h-4 bg-sand/30 rounded-12 w-2/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-24 pt-16">
          <div className="h-48 bg-sand/30 rounded-16"></div>
          <div className="h-48 bg-sand/30 rounded-16"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-24', className)}>
      {/* Offline banner */}
      {isOffline && (
        <div className="p-12 bg-warning/15 border border-warning/30 text-deep-orange rounded-16 text-sm font-bold flex items-center gap-8">
          <span aria-hidden="true">⚠️</span>
          <span>{labels.offlineBanner}</span>
        </div>
      )}

      {/* Global / action error */}
      {(error || actionError) && (
        <div className="p-12 bg-error/15 border border-error/30 text-error rounded-16 text-sm font-bold flex items-center justify-between">
          <span>{error || actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-error underline min-h-[44px] min-w-[44px] inline-flex items-center justify-center font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Success notification */}
      {saveSuccess && (
        <div className="p-12 bg-success/15 border border-success/30 text-success rounded-16 text-sm font-bold">
          Brand kit and field locks saved successfully.
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-16 border-b border-sand-border pb-16">
        <div>
          <h2 className="text-xl font-extrabold text-charcoal dark:text-warm-paper">{labels.title}</h2>
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/70 mt-4">{labels.subtitle}</p>
        </div>

        {/* Action Controls for Admin/Owner */}
        {!isEmployee && (
          <div className="flex items-center gap-12">
            {hasUnsavedChanges && (
              <ActionButton
                variant="secondary"
                onClick={handleReset}
                disabled={isSaving}
                className="min-h-[44px]"
              >
                {labels.resetBtn}
              </ActionButton>
            )}
            <ActionButton
              variant="primary"
              onClick={handleSave}
              disabled={isSaving || isOffline || !hasUnsavedChanges || !contrast.isAccessible}
              title={!contrast.isAccessible ? labels.contrastWarningNotice : undefined}
              className="min-h-[44px]"
            >
              {isSaving ? labels.savingBtn : labels.saveChangesBtn}
            </ActionButton>
          </div>
        )}
      </div>

      {/* Unsaved changes notification banner */}
      {hasUnsavedChanges && !isEmployee && (
        <div className="p-12 bg-info/10 border border-info/30 text-info rounded-16 text-sm font-bold flex items-center justify-between">
          <span>{labels.unsavedChangesBanner}</span>
          <button
            onClick={handleSave}
            disabled={isSaving || !contrast.isAccessible}
            title={!contrast.isAccessible ? labels.contrastWarningNotice : undefined}
            className="text-info underline min-h-[44px] min-w-[44px] inline-flex items-center justify-center disabled:opacity-50"
          >
            Save now
          </button>
        </div>
      )}

      {/* Employee readonly notice */}
      {isEmployee && (
        <div className="p-16 bg-sand/30 border border-sand-border rounded-16 text-sm text-charcoal dark:text-warm-paper flex items-center gap-12">
          <span className="text-lg" aria-hidden="true">🔒</span>
          <span>{labels.lockWarningEmployee}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-24">
        {/* Left Column: Brand Configuration Form */}
        <div className="lg:col-span-7 space-y-24">
          {/* 1. Company Logo Card */}
          <div className="p-20 bg-white dark:bg-charcoal rounded-22 border border-sand-border shadow-sm space-y-16">
            <div>
              <h3 className="font-bold text-base text-charcoal dark:text-warm-paper">{labels.logoSectionTitle}</h3>
              <p className="text-xs text-charcoal/70 dark:text-warm-paper/70 mt-4">{labels.logoSectionDesc}</p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-16">
              <div className="w-20 h-20 rounded-16 bg-sand/20 border border-sand-border flex items-center justify-center overflow-hidden flex-shrink-0">
                {brandKit.logo ? (
                  <img src={brandKit.logo} alt="Company logo" className="max-w-full max-h-full object-contain p-4" />
                ) : (
                  <span className="text-xs font-bold text-charcoal/40">No logo</span>
                )}
              </div>

              {!isEmployee && (
                <div className="space-y-8 flex-1">
                  <div className="flex items-center gap-12 flex-wrap">
                    <input
                      type="file"
                      id={fileInputId}
                      accept="image/png,image/svg+xml,image/webp"
                      onChange={handleLogoFileChange}
                      className="hidden"
                      disabled={isUploading}
                    />
                    <label
                      htmlFor={fileInputId}
                      className={cn(
                        'inline-flex items-center justify-center px-16 py-8 rounded-16 font-bold text-sm bg-sand/40 hover:bg-sand/60 text-charcoal cursor-pointer min-h-[44px] transition-colors',
                        isUploading && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {isUploading ? labels.uploadingText : labels.uploadLogoBtn}
                    </label>

                    {brandKit.logo && (
                      <button
                        type="button"
                        onClick={() => setBrandKit((prev) => ({ ...prev, logo: null }))}
                        className="text-xs text-error hover:underline min-h-[44px] min-w-[44px] inline-flex items-center justify-center font-bold"
                      >
                        {labels.removeLogoBtn}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-charcoal/60 dark:text-warm-paper/60">{labels.uploadFormatHint}</p>
                  {uploadError && <p className="text-xs text-error font-bold">{uploadError}</p>}
                </div>
              )}
            </div>
          </div>

          {/* 2. Brand Colours & Contrast Evaluation Card */}
          <div className="p-20 bg-white dark:bg-charcoal rounded-22 border border-sand-border shadow-sm space-y-20">
            <div>
              <h3 className="font-bold text-base text-charcoal dark:text-warm-paper">{labels.coloursSectionTitle}</h3>
              <p className="text-xs text-charcoal/70 dark:text-warm-paper/70 mt-4">{labels.coloursSectionDesc}</p>
            </div>

            {/* Colour Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-16">
              {/* Band Colour */}
              <div className="space-y-6">
                <label className="block text-xs font-bold text-charcoal dark:text-warm-paper">
                  {labels.bandColourLabel}
                </label>
                <div className="flex items-center gap-8">
                  <input
                    type="color"
                    aria-label="Header band color picker"
                    value={brandKit.brandColours.band}
                    disabled={isEmployee}
                    onChange={(e) =>
                      setBrandKit((prev) => ({
                        ...prev,
                        brandColours: { ...prev.brandColours, band: e.target.value },
                      }))
                    }
                    className="w-10 h-10 rounded-12 border border-sand-border cursor-pointer p-0 disabled:opacity-50"
                  />
                  <input
                    type="text"
                    aria-label="Header band hex code"
                    value={brandKit.brandColours.band}
                    disabled={isEmployee}
                    onChange={(e) =>
                      setBrandKit((prev) => ({
                        ...prev,
                        brandColours: { ...prev.brandColours, band: e.target.value },
                      }))
                    }
                    className="w-full text-xs font-mono uppercase px-8 py-6 rounded-12 border border-sand-border min-h-[44px] bg-transparent text-charcoal dark:text-warm-paper"
                  />
                </div>
              </div>

              {/* Accent Colour */}
              <div className="space-y-6">
                <label className="block text-xs font-bold text-charcoal dark:text-warm-paper">
                  {labels.accentColourLabel}
                </label>
                <div className="flex items-center gap-8">
                  <input
                    type="color"
                    aria-label="Interactive accent color picker"
                    value={brandKit.brandColours.accent}
                    disabled={isEmployee}
                    onChange={(e) =>
                      setBrandKit((prev) => ({
                        ...prev,
                        brandColours: { ...prev.brandColours, accent: e.target.value },
                      }))
                    }
                    className="w-10 h-10 rounded-12 border border-sand-border cursor-pointer p-0 disabled:opacity-50"
                  />
                  <input
                    type="text"
                    aria-label="Interactive accent hex code"
                    value={brandKit.brandColours.accent}
                    disabled={isEmployee}
                    onChange={(e) =>
                      setBrandKit((prev) => ({
                        ...prev,
                        brandColours: { ...prev.brandColours, accent: e.target.value },
                      }))
                    }
                    className="w-full text-xs font-mono uppercase px-8 py-6 rounded-12 border border-sand-border min-h-[44px] bg-transparent text-charcoal dark:text-warm-paper"
                  />
                </div>
              </div>

              {/* Text Colour */}
              <div className="space-y-6">
                <label className="block text-xs font-bold text-charcoal dark:text-warm-paper">
                  {labels.textColourLabel}
                </label>
                <div className="flex items-center gap-8">
                  <input
                    type="color"
                    aria-label="Band text color picker"
                    value={brandKit.brandColours.text}
                    disabled={isEmployee}
                    onChange={(e) =>
                      setBrandKit((prev) => ({
                        ...prev,
                        brandColours: { ...prev.brandColours, text: e.target.value },
                      }))
                    }
                    className="w-10 h-10 rounded-12 border border-sand-border cursor-pointer p-0 disabled:opacity-50"
                  />
                  <input
                    type="text"
                    aria-label="Band text hex code"
                    value={brandKit.brandColours.text}
                    disabled={isEmployee}
                    onChange={(e) =>
                      setBrandKit((prev) => ({
                        ...prev,
                        brandColours: { ...prev.brandColours, text: e.target.value },
                      }))
                    }
                    className="w-full text-xs font-mono uppercase px-8 py-6 rounded-12 border border-sand-border min-h-[44px] bg-transparent text-charcoal dark:text-warm-paper"
                  />
                </div>
              </div>
            </div>

            {/* Contrast Indicator & Auto-Pick Suggestion Banner */}
            <div className="p-16 rounded-16 bg-sand/20 border border-sand-border space-y-12">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-charcoal dark:text-warm-paper">
                  {labels.contrastEvaluationTitle}: Band vs Text
                </span>
                <span
                  className={cn(
                    'px-8 py-4 rounded-12 text-xs font-extrabold inline-flex items-center gap-4',
                    contrast.isAccessible
                      ? 'bg-success/15 text-success'
                      : 'bg-warning/20 text-deep-orange'
                  )}
                >
                  {contrast.isAccessible ? '✓' : '⚠️'}{' '}
                  {contrast.ratio}:1 ({contrast.isAccessible ? labels.contrastPass : labels.contrastFail})
                </span>
              </div>

              {/* Notice when contrast is below WCAG 2.1 AA requirement */}
              {!contrast.isAccessible && (
                <div className="space-y-8 pt-4">
                  <p className="text-xs text-deep-orange font-bold">
                    {labels.contrastWarningNotice}
                  </p>
                  <p className="text-xs text-charcoal/70 dark:text-warm-paper/70">
                    Rule: Orange is a fill, never a text colour. Deep Orange (#A04E08) or Charcoal (#393536) must be used on light backgrounds.
                  </p>
                  {!isEmployee && (
                    <div className="flex items-center gap-12 pt-4">
                      <button
                        type="button"
                        onClick={applyAutoPick}
                        className="text-xs font-bold px-12 py-8 bg-bridge-orange text-charcoal rounded-12 hover:opacity-90 min-h-[44px] inline-flex items-center justify-center transition-opacity"
                      >
                        {labels.applyAutoPickBtn} ({contrast.autoPickColor === CHARCOAL ? 'Charcoal #393536' : 'Warm Paper #FAF7F2'})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cover Image Input */}
            <div className="space-y-6">
              <label className="block text-xs font-bold text-charcoal dark:text-warm-paper">
                {labels.coverImageLabel}
              </label>
              <input
                type="url"
                aria-label={labels.coverImageLabel}
                value={brandKit.coverImage || ''}
                disabled={isEmployee}
                placeholder={labels.coverImagePlaceholder}
                onChange={(e) =>
                  setBrandKit((prev) => ({
                    ...prev,
                    coverImage: e.target.value.trim() || null,
                  }))
                }
                className="w-full text-xs px-12 py-8 rounded-12 border border-sand-border min-h-[44px] bg-transparent text-charcoal dark:text-warm-paper placeholder:text-charcoal/40"
              />
            </div>
          </div>

          {/* 3. Field-Level Locks Configuration Card */}
          <div className="p-20 bg-white dark:bg-charcoal rounded-22 border border-sand-border shadow-sm space-y-16">
            <div>
              <h3 className="font-bold text-base text-charcoal dark:text-warm-paper">{labels.fieldLocksTitle}</h3>
              <p className="text-xs text-charcoal/70 dark:text-warm-paper/70 mt-4">{labels.fieldLocksDesc}</p>
            </div>

            <div className="divide-y divide-sand-border">
              {LOCKABLE_FIELDS.map((field) => {
                const isLocked = locks.lockedFields.includes(field.key);
                return (
                  <div
                    key={field.key}
                    className="py-12 flex items-center justify-between gap-16 min-h-[48px]"
                    title={isLocked ? labels.lockedFieldTooltip : undefined}
                    data-testid={`field-row-${field.key}`}
                  >
                    <div className="flex items-center gap-8">
                      <span className="text-sm font-bold text-charcoal dark:text-warm-paper">
                        {field.labelEn}
                      </span>
                      {isLocked && (
                        <span
                          className="text-xs text-charcoal/50 dark:text-warm-paper/50 cursor-help"
                          title={labels.lockedFieldTooltip}
                          aria-label={labels.lockedFieldTooltip}
                        >
                          🔒
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-12">
                      <div
                        title={isLocked ? labels.lockedFieldTooltip : undefined}
                        data-testid={`lock-status-${field.key}`}
                      >
                        <StatusChip status={isLocked ? 'error' : 'success'}>
                          {isLocked ? labels.lockedBadge : labels.unlockedBadge}
                        </StatusChip>
                      </div>

                      {!isEmployee && (
                        <button
                          type="button"
                          onClick={() => toggleFieldLock(field.key)}
                          className={cn(
                            'min-h-[44px] min-w-[44px] px-12 py-6 rounded-12 text-xs font-bold transition-colors inline-flex items-center justify-center',
                            isLocked
                              ? 'bg-sand/40 hover:bg-sand/60 text-charcoal'
                              : 'bg-charcoal text-white hover:bg-charcoal/80'
                          )}
                          aria-label={`Toggle lock for ${field.labelEn}`}
                        >
                          {isLocked ? 'Unlock' : 'Lock'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Card Preview */}
        <div className="lg:col-span-5 space-y-16">
          <h3 className="font-bold text-base text-charcoal dark:text-warm-paper">{labels.previewTitle}</h3>

          {/* Simulated Card Container */}
          <div className="p-16 bg-warm-paper dark:bg-charcoal-deep rounded-22 border border-sand-border shadow-md">
            <div className="bg-white dark:bg-charcoal rounded-22 overflow-hidden shadow-lg border border-sand-border">
              {/* Card Header Band with Cover Image & Brand Colours */}
              <div
                className="h-32 p-16 flex items-start justify-between relative transition-colors duration-200"
                data-testid="preview-header-band"
                style={{
                  backgroundColor: brandKit.brandColours.band,
                  backgroundImage: brandKit.coverImage ? `url(${brandKit.coverImage})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {/* Brand Logo in Header */}
                {brandKit.logo ? (
                  <div className="w-12 h-12 bg-white rounded-12 p-2 shadow-sm flex items-center justify-center">
                    <img src={brandKit.logo} alt="Company logo preview" className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-white/20 rounded-12 flex items-center justify-center text-xs font-bold text-white">
                    OB
                  </div>
                )}

                {/* Accent Badge */}
                <div
                  className="px-8 py-4 rounded-12 text-xs font-extrabold shadow-sm transition-colors"
                  style={{
                    backgroundColor: brandKit.brandColours.accent,
                    color: '#393536', // Charcoal text on orange/accent fill per section 3
                  }}
                >
                  Verified Seat
                </div>
              </div>

              {/* Card Body */}
              <div className="p-20 space-y-16">
                <div>
                  <h4
                    className="text-lg font-extrabold tracking-tight"
                    data-testid="preview-card-name"
                    style={{ color: brandKit.brandColours.text }}
                  >
                    {labels.previewCardName}
                  </h4>
                  <p className="text-xs font-bold text-charcoal/70 dark:text-warm-paper/70 mt-2">
                    {labels.previewCardTitle}
                  </p>
                  <p className="text-xs text-charcoal/50 dark:text-warm-paper/50 mt-1">
                    {labels.previewCardCompany}
                  </p>
                </div>

                {/* QR Code Placeholder Frame */}
                <div className="p-16 bg-sand/20 rounded-16 border border-dashed border-sand-border text-center space-y-8">
                  <div className="w-24 h-24 mx-auto bg-white rounded-12 border border-sand-border flex items-center justify-center text-xs font-mono text-charcoal/60">
                    [QR CODE]
                  </div>
                  <p className="text-[11px] text-charcoal/60 dark:text-warm-paper/60">
                    Scan or tap to save contact & company lead
                  </p>
                </div>

                {/* Call-to-Action Bar styled with Brand Accent */}
                <div className="grid grid-cols-2 gap-8 pt-8">
                  <button
                    type="button"
                    disabled
                    className="min-h-[44px] py-8 rounded-12 font-bold text-xs text-center border border-sand-border bg-white dark:bg-charcoal text-charcoal dark:text-warm-paper opacity-90"
                  >
                    Save Contact
                  </button>
                  <button
                    type="button"
                    disabled
                    style={{
                      backgroundColor: brandKit.brandColours.accent,
                      color: '#393536',
                    }}
                    className="min-h-[44px] py-8 rounded-12 font-bold text-xs text-center opacity-90 shadow-sm"
                  >
                    Share Back
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
