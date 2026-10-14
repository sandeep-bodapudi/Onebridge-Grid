import React, { useState, useMemo } from 'react';
import { ActionButton, ArchCard, OfflineBanner, EmptyState, StatusChip } from '@onebridge/ui-kit';
import { validateBrandContrast } from './contrast';

export type OnboardingStep =
  | 'company_details'
  | 'plan_selection'
  | 'brand_setup'
  | 'first_card'
  | 'complete';

export interface OnboardingFlowLabels {
  title: string;
  stepLabel?: string;
  ofLabel?: string;
  stepDetailsTitle: string;
  stepPlanTitle: string;
  stepBrandTitle: string;
  stepCardTitle: string;
  stepCompleteTitle: string;
  companyNameLabel: string;
  companyNamePlaceholder: string;
  industryLabel: string;
  industryPlaceholder: string;
  sizeLabel: string;
  sizeOptions?: { value: string; label: string }[];
  cityLabel: string;
  cityPlaceholder: string;
  gstinLabel: string;
  optionalLabel?: string;
  gstinPlaceholder: string;
  slugPreviewLabel: string;
  starterPlanTitle: string;
  starterPlanPrice: string;
  starterPlanDescription: string;
  businessPlanTitle: string;
  businessPlanPrice: string;
  businessPlanDescription: string;
  selectedLabel?: string;
  selectPlanButton: string;
  primaryColorLabel: string;
  secondaryColorLabel: string;
  logoUrlLabel: string;
  logoUrlPlaceholder: string;
  contrastCheckLabel?: string;
  passesAaLabel?: string;
  autoAdjustedLabel?: string;
  previewTitle: string;
  previewCompanyNameFallback?: string;
  firstMemberLabel?: string;
  previewCityFallback?: string;
  contrastNotice: string;
  cardholderNameLabel: string;
  cardholderNamePlaceholder: string;
  cardholderRoleLabel: string;
  cardholderRolePlaceholder: string;
  nextButton: string;
  backButton: string;
  launchButton: string;
  readyBadgeLabel?: string;
  completeMessage: string;
  timeToFirstCardLabel: string;
  offlineNotice: string;
  emptyStateMessage: string;
  gstinError: string;
  requiredFieldsError: string;
}

export interface OnboardingFormData {
  name: string;
  industry: string;
  size: string;
  city: string;
  gstin?: string;
  slug?: string;
  plan: 'starter' | 'business';
  brandColours: {
    primary: string;
    secondary: string;
  };
  logo?: string;
  firstCardName: string;
  firstCardRole: string;
}

export interface OnboardingFlowProps {
  step?: OnboardingStep;
  initialStep?: OnboardingStep;
  labels: OnboardingFlowLabels;
  paymentAfterFirstCard?: boolean;
  isLoading?: boolean;
  isOffline?: boolean;
  isEmpty?: boolean;
  error?: string | null;
  onComplete?: (data: OnboardingFormData, timeToFirstCardSeconds: number) => void;
  onCancel?: () => void;
}

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const defaultSizeOptions = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '500+', label: '500+ employees' },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  step: controlledStep,
  initialStep = 'company_details',
  labels,
  paymentAfterFirstCard = false,
  isLoading = false,
  isOffline = false,
  isEmpty = false,
  error: externalError = null,
  onComplete,
}) => {
  const [internalStep, setInternalStep] = useState<OnboardingStep>(initialStep);
  const currentStep = controlledStep ?? internalStep;

  const [startTime] = useState<number>(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const [formData, setFormData] = useState<OnboardingFormData>({
    name: '',
    industry: 'Technology',
    size: '1-10',
    city: '',
    gstin: '',
    slug: '',
    plan: 'starter',
    brandColours: {
      primary: '#1B2A4A',
      secondary: '#F68713',
    },
    logo: '',
    firstCardName: '',
    firstCardRole: 'Founder',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const contrastResult = useMemo(
    () => validateBrandContrast(formData.brandColours.primary),
    [formData.brandColours.primary]
  );

  const stepsOrder: OnboardingStep[] = useMemo(() => {
    if (paymentAfterFirstCard) {
      return ['company_details', 'brand_setup', 'first_card', 'plan_selection', 'complete'];
    }
    return ['company_details', 'plan_selection', 'brand_setup', 'first_card', 'complete'];
  }, [paymentAfterFirstCard]);

  const goToNextStep = () => {
    const currentIndex = stepsOrder.indexOf(currentStep);
    if (currentIndex >= 0 && currentIndex < stepsOrder.length - 1) {
      const next = stepsOrder[currentIndex + 1];
      setInternalStep(next);
    }
  };

  const goToPreviousStep = () => {
    const currentIndex = stepsOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      const prev = stepsOrder[currentIndex - 1];
      setInternalStep(prev);
    }
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: prev.slug === '' || prev.slug === slugify(prev.name) ? slugify(name) : prev.slug,
    }));
  };

  const validateCompanyDetails = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = labels.requiredFieldsError;
    if (!formData.industry.trim()) errors.industry = labels.requiredFieldsError;
    if (!formData.size.trim()) errors.size = labels.requiredFieldsError;
    if (!formData.city.trim()) errors.city = labels.requiredFieldsError;

    if (formData.gstin && formData.gstin.trim() !== '') {
      if (!GSTIN_REGEX.test(formData.gstin.trim())) {
        errors.gstin = labels.gstinError;
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLaunch = () => {
    const finishTime = Date.now();
    const durationSec = Math.max(1, Math.round((finishTime - startTime) / 1000));
    setElapsedSeconds(durationSec);
    setInternalStep('complete');
    onComplete?.(formData, durationSec);
  };

  if (isEmpty) {
    return (
      <div data-testid="onboarding-empty" className="p-32">
        <EmptyState message={labels.emptyStateMessage} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div data-testid="onboarding-loading" className="p-32 flex justify-center">
        <ArchCard isLoading className="w-full max-w-lg min-h-32" />
      </div>
    );
  }

  const sizeOptionsList = labels.sizeOptions || defaultSizeOptions;

  return (
    <div className="w-full max-w-2xl mx-auto p-16 md:p-24 space-y-24" data-testid="onboarding-container">
      {isOffline && (
        <div data-testid="onboarding-offline">
          <OfflineBanner message={labels.offlineNotice} />
        </div>
      )}

      {externalError && (
        <div data-testid="onboarding-external-error" className="p-12 rounded-12 bg-error/10 text-error font-bold">
          {externalError}
        </div>
      )}

      <header className="space-y-4">
        <h1 className="text-3xl font-extrabold text-charcoal dark:text-warm-paper tracking-tight">
          {labels.title}
        </h1>
        <div className="flex gap-8 items-center text-xs font-bold text-charcoal/60 dark:text-warm-paper/60">
          <span>
            {labels.stepLabel || 'Step'} {stepsOrder.indexOf(currentStep) + 1} {labels.ofLabel || 'of'} {stepsOrder.length}
          </span>
        </div>
      </header>

      {/* STEP 1: Company Details */}
      {currentStep === 'company_details' && (
        <ArchCard className="space-y-20" data-testid="step-company-details">
          <h2 className="text-xl font-bold text-charcoal dark:text-warm-paper">
            {labels.stepDetailsTitle}
          </h2>

          <div className="space-y-16">
            <div>
              <label className="block text-sm font-bold text-charcoal dark:text-warm-paper mb-4">
                {labels.companyNameLabel} *
              </label>
              <input
                data-testid="input-company-name"
                type="text"
                className="w-full min-h-[44px] px-16 py-8 rounded-12 border border-sand-border bg-white dark:bg-charcoal text-charcoal dark:text-warm-paper focus:outline-none focus:ring-2 focus:ring-deep-orange"
                placeholder={labels.companyNamePlaceholder}
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
              {formErrors.name && (
                <p className="text-xs font-bold text-error mt-4" data-testid="error-company-name">
                  {formErrors.name}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              <div>
                <label className="block text-sm font-bold text-charcoal dark:text-warm-paper mb-4">
                  {labels.industryLabel} *
                </label>
                <input
                  data-testid="input-industry"
                  type="text"
                  className="w-full min-h-[44px] px-16 py-8 rounded-12 border border-sand-border bg-white dark:bg-charcoal text-charcoal dark:text-warm-paper focus:outline-none focus:ring-2 focus:ring-deep-orange"
                  placeholder={labels.industryPlaceholder}
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-charcoal dark:text-warm-paper mb-4">
                  {labels.sizeLabel} *
                </label>
                <select
                  data-testid="select-size"
                  className="w-full min-h-[44px] px-16 py-8 rounded-12 border border-sand-border bg-white dark:bg-charcoal text-charcoal dark:text-warm-paper focus:outline-none focus:ring-2 focus:ring-deep-orange"
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                >
                  {sizeOptionsList.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-charcoal dark:text-warm-paper mb-4">
                {labels.cityLabel} *
              </label>
              <input
                data-testid="input-city"
                type="text"
                className="w-full min-h-[44px] px-16 py-8 rounded-12 border border-sand-border bg-white dark:bg-charcoal text-charcoal dark:text-warm-paper focus:outline-none focus:ring-2 focus:ring-deep-orange"
                placeholder={labels.cityPlaceholder}
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
              {formErrors.city && (
                <p className="text-xs font-bold text-error mt-4" data-testid="error-city">
                  {formErrors.city}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-charcoal dark:text-warm-paper mb-4">
                {labels.gstinLabel} {labels.optionalLabel || '(Optional)'}
              </label>
              <input
                data-testid="input-gstin"
                type="text"
                maxLength={15}
                className="w-full min-h-[44px] px-16 py-8 rounded-12 border border-sand-border bg-white dark:bg-charcoal text-charcoal dark:text-warm-paper focus:outline-none focus:ring-2 focus:ring-deep-orange uppercase"
                placeholder={labels.gstinPlaceholder}
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
              />
              {formErrors.gstin && (
                <p className="text-xs font-bold text-error mt-4" data-testid="error-gstin">
                  {formErrors.gstin}
                </p>
              )}
            </div>

            {formData.name && (
              <div className="bg-sand/40 dark:bg-charcoal-deep p-12 rounded-12 text-xs">
                <span className="font-bold text-charcoal/70 dark:text-warm-paper/70">
                  {labels.slugPreviewLabel}:
                </span>{' '}
                <span className="font-mono text-deep-orange">
                  onebridge.in/{formData.slug || slugify(formData.name)}
                </span>
              </div>
            )}
          </div>

          <div className="pt-16 flex justify-end">
            <ActionButton
              data-testid="btn-next-details"
              variant="primary"
              onClick={() => {
                if (validateCompanyDetails()) {
                  goToNextStep();
                }
              }}
            >
              {labels.nextButton}
            </ActionButton>
          </div>
        </ArchCard>
      )}

      {/* STEP 2: Plan Selection */}
      {currentStep === 'plan_selection' && (
        <ArchCard className="space-y-20" data-testid="step-plan-selection">
          <h2 className="text-xl font-bold text-charcoal dark:text-warm-paper">
            {labels.stepPlanTitle}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div
              data-testid="plan-starter-card"
              onClick={() => setFormData({ ...formData, plan: 'starter' })}
              className={`p-16 rounded-16 border-2 cursor-pointer transition-all motion-reduce:transition-none ${
                formData.plan === 'starter'
                  ? 'border-deep-orange bg-sand/20 dark:bg-charcoal-deep ring-2 ring-deep-orange'
                  : 'border-sand-border hover:border-deep-orange/50'
              }`}
            >
              <div className="flex justify-between items-start mb-8">
                <h3 className="font-extrabold text-lg text-charcoal dark:text-warm-paper">
                  {labels.starterPlanTitle}
                </h3>
                {formData.plan === 'starter' && (
                  <StatusChip status="info">{labels.selectedLabel || 'Selected'}</StatusChip>
                )}
              </div>
              <p className="text-2xl font-black text-deep-orange mb-8">
                {labels.starterPlanPrice}
              </p>
              <p className="text-xs text-charcoal/70 dark:text-warm-paper/70">
                {labels.starterPlanDescription}
              </p>
            </div>

            <div
              data-testid="plan-business-card"
              onClick={() => setFormData({ ...formData, plan: 'business' })}
              className={`p-16 rounded-16 border-2 cursor-pointer transition-all motion-reduce:transition-none ${
                formData.plan === 'business'
                  ? 'border-deep-orange bg-sand/20 dark:bg-charcoal-deep ring-2 ring-deep-orange'
                  : 'border-sand-border hover:border-deep-orange/50'
              }`}
            >
              <div className="flex justify-between items-start mb-8">
                <h3 className="font-extrabold text-lg text-charcoal dark:text-warm-paper">
                  {labels.businessPlanTitle}
                </h3>
                {formData.plan === 'business' && (
                  <StatusChip status="info">{labels.selectedLabel || 'Selected'}</StatusChip>
                )}
              </div>
              <p className="text-2xl font-black text-deep-orange mb-8">
                {labels.businessPlanPrice}
              </p>
              <p className="text-xs text-charcoal/70 dark:text-warm-paper/70">
                {labels.businessPlanDescription}
              </p>
            </div>
          </div>

          <div className="pt-16 flex justify-between">
            <ActionButton variant="secondary" onClick={goToPreviousStep}>
              {labels.backButton}
            </ActionButton>
            <ActionButton data-testid="btn-next-plan" variant="primary" onClick={goToNextStep}>
              {labels.nextButton}
            </ActionButton>
          </div>
        </ArchCard>
      )}

      {/* STEP 3: Brand Setup */}
      {currentStep === 'brand_setup' && (
        <ArchCard className="space-y-20" data-testid="step-brand-setup">
          <h2 className="text-xl font-bold text-charcoal dark:text-warm-paper">
            {labels.stepBrandTitle}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
            <div className="space-y-16">
              <div>
                <label className="block text-sm font-bold text-charcoal dark:text-warm-paper mb-4">
                  {labels.primaryColorLabel}
                </label>
                <div className="flex items-center gap-12">
                  <input
                    data-testid="input-primary-color"
                    type="color"
                    className="w-44 h-44 rounded-12 cursor-pointer border border-sand-border"
                    value={formData.brandColours.primary}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        brandColours: { ...formData.brandColours, primary: e.target.value },
                      })
                    }
                  />
                  <input
                    data-testid="input-primary-hex"
                    type="text"
                    className="w-full min-h-[44px] px-16 py-8 rounded-12 border border-sand-border bg-white dark:bg-charcoal text-charcoal dark:text-warm-paper font-mono"
                    value={formData.brandColours.primary}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        brandColours: { ...formData.brandColours, primary: e.target.value },
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-charcoal dark:text-warm-paper mb-4">
                  {labels.secondaryColorLabel}
                </label>
                <div className="flex items-center gap-12">
                  <input
                    data-testid="input-secondary-color"
                    type="color"
                    className="w-44 h-44 rounded-12 cursor-pointer border border-sand-border"
                    value={formData.brandColours.secondary}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        brandColours: { ...formData.brandColours, secondary: e.target.value },
                      })
                    }
                  />
                  <input
                    data-testid="input-secondary-hex"
                    type="text"
                    className="w-full min-h-[44px] px-16 py-8 rounded-12 border border-sand-border bg-white dark:bg-charcoal text-charcoal dark:text-warm-paper font-mono"
                    value={formData.brandColours.secondary}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        brandColours: { ...formData.brandColours, secondary: e.target.value },
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-charcoal dark:text-warm-paper mb-4">
                  {labels.logoUrlLabel}
                </label>
                <input
                  data-testid="input-logo-url"
                  type="url"
                  className="w-full min-h-[44px] px-16 py-8 rounded-12 border border-sand-border bg-white dark:bg-charcoal text-charcoal dark:text-warm-paper"
                  placeholder={labels.logoUrlPlaceholder}
                  value={formData.logo}
                  onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                />
              </div>

              {/* Contrast feedback badge */}
              <div data-testid="contrast-feedback" className="p-12 rounded-12 bg-sand/30 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-charcoal dark:text-warm-paper">
                    {labels.contrastCheckLabel || 'Contrast check:'}
                  </span>
                  <StatusChip status={contrastResult.isAccessible ? 'success' : 'warning'}>
                    {contrastResult.ratio.toFixed(1)}:1 ({contrastResult.isAccessible ? (labels.passesAaLabel || 'Passes AA') : (labels.autoAdjustedLabel || 'Auto-adjusted')})
                  </StatusChip>
                </div>
                {contrastResult.warning && (
                  <p className="text-xs text-deep-orange font-semibold" data-testid="contrast-warning">
                    {contrastResult.warning}
                  </p>
                )}
              </div>
            </div>

            {/* Live Card Preview */}
            <div className="flex flex-col items-center justify-center space-y-8 p-16 rounded-16 bg-sand/20 dark:bg-charcoal-deep">
              <span className="text-xs font-bold text-charcoal/60 dark:text-warm-paper/60 uppercase tracking-wider">
                {labels.previewTitle}
              </span>
              <div
                data-testid="live-card-preview"
                className="w-64 h-40 rounded-16 p-16 shadow-lg flex flex-col justify-between transition-colors motion-reduce:transition-none duration-200"
                style={{
                  backgroundColor: formData.brandColours.primary,
                  color: contrastResult.recommendedTextColor,
                }}
              >
                <div className="flex justify-between items-start">
                  <div className="font-extrabold text-base tracking-tight truncate max-w-xs">
                    {formData.name || labels.previewCompanyNameFallback || 'Company name'}
                  </div>
                  {formData.logo ? (
                    <img
                      src={formData.logo}
                      alt="Logo"
                      className="w-24 h-24 object-contain rounded"
                    />
                  ) : (
                    <div
                      className="w-20 h-20 rounded-full"
                      style={{ backgroundColor: formData.brandColours.secondary }}
                    />
                  )}
                </div>

                <div>
                  <div className="text-xs font-bold opacity-90">{labels.firstMemberLabel || 'First member'}</div>
                  <div className="text-xs opacity-75">{formData.city || labels.previewCityFallback || 'City, India'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-16 flex justify-between">
            <ActionButton variant="secondary" onClick={goToPreviousStep}>
              {labels.backButton}
            </ActionButton>
            <ActionButton data-testid="btn-next-brand" variant="primary" onClick={goToNextStep}>
              {labels.nextButton}
            </ActionButton>
          </div>
        </ArchCard>
      )}

      {/* STEP 4: First Card Setup / Launch */}
      {currentStep === 'first_card' && (
        <ArchCard className="space-y-20" data-testid="step-first-card">
          <h2 className="text-xl font-bold text-charcoal dark:text-warm-paper">
            {labels.stepCardTitle}
          </h2>

          <div className="space-y-16">
            <div>
              <label className="block text-sm font-bold text-charcoal dark:text-warm-paper mb-4">
                {labels.cardholderNameLabel} *
              </label>
              <input
                data-testid="input-cardholder-name"
                type="text"
                className="w-full min-h-[44px] px-16 py-8 rounded-12 border border-sand-border bg-white dark:bg-charcoal text-charcoal dark:text-warm-paper"
                placeholder={labels.cardholderNamePlaceholder}
                value={formData.firstCardName}
                onChange={(e) => setFormData({ ...formData, firstCardName: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-charcoal dark:text-warm-paper mb-4">
                {labels.cardholderRoleLabel} *
              </label>
              <input
                data-testid="input-cardholder-role"
                type="text"
                className="w-full min-h-[44px] px-16 py-8 rounded-12 border border-sand-border bg-white dark:bg-charcoal text-charcoal dark:text-warm-paper"
                placeholder={labels.cardholderRolePlaceholder}
                value={formData.firstCardRole}
                onChange={(e) => setFormData({ ...formData, firstCardRole: e.target.value })}
              />
            </div>
          </div>

          <div className="pt-16 flex justify-between">
            <ActionButton variant="secondary" onClick={goToPreviousStep}>
              {labels.backButton}
            </ActionButton>
            <ActionButton
              data-testid="btn-launch-org"
              variant="primary"
              onClick={handleLaunch}
            >
              {labels.launchButton}
            </ActionButton>
          </div>
        </ArchCard>
      )}

      {/* STEP 5: Complete */}
      {currentStep === 'complete' && (
        <ArchCard className="space-y-20 text-center py-32" data-testid="step-complete">
          <StatusChip status="success">{labels.readyBadgeLabel || 'Ready'}</StatusChip>
          <h2 className="text-2xl font-black text-charcoal dark:text-warm-paper">
            {labels.stepCompleteTitle}
          </h2>
          <p className="text-sm text-charcoal/80 dark:text-warm-paper/80 max-w-md mx-auto">
            {labels.completeMessage}
          </p>
          <div className="p-16 rounded-16 bg-sand/30 inline-block font-mono text-sm text-deep-orange">
            {labels.timeToFirstCardLabel}: {elapsedSeconds}s
          </div>
        </ArchCard>
      )}
    </div>
  );
};
