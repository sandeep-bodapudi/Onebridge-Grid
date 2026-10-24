import React, { useState, useMemo } from 'react';
import {
  Button,
  SpanCard,
  OfflineBanner,
  EmptyState,
  StatusChip,
  SpanLine,
  PhoneFramePreview,
  QrPreview,
  KeystoneTag,
} from '@onebridge/ui-kit';
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
  { value: '1-10', label: '1 - 10 employees' },
  { value: '11-50', label: '11 - 50 employees' },
  { value: '51-200', label: '51 - 200 employees' },
  { value: '201-500', label: '201 - 500 employees' },
  { value: '500+', label: '500+ employees' },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  step: controlledStep,
  initialStep = 'company_details',
  labels,
  paymentAfterFirstCard = false,
  isLoading = false,
  isOffline = false,
  isEmpty = false,
  error: externalError,
  onComplete,
}) => {
  const [internalStep, setInternalStep] = useState<OnboardingStep>(initialStep);
  const currentStep = controlledStep ?? internalStep;

  const [formData, setFormData] = useState<OnboardingFormData>({
    name: '',
    industry: 'Technology',
    size: '1-10',
    city: '',
    gstin: '',
    plan: 'starter',
    brandColours: {
      primary: '#F68713',
      secondary: '#393536',
    },
    logo: '',
    firstCardName: '',
    firstCardRole: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [startTime] = useState<number>(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: slugify(name),
    }));
    if (formErrors.name) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.name;
        return next;
      });
    }
  };

  const contrastResult = useMemo(() => {
    return validateBrandContrast(formData.brandColours.primary);
  }, [formData.brandColours.primary]);

  const stepsOrder: OnboardingStep[] = useMemo(() => {
    if (paymentAfterFirstCard) {
      return ['company_details', 'brand_setup', 'first_card', 'plan_selection', 'complete'];
    }
    return ['company_details', 'plan_selection', 'brand_setup', 'first_card', 'complete'];
  }, [paymentAfterFirstCard]);

  const stepProgressPercent = useMemo(() => {
    const idx = stepsOrder.indexOf(currentStep);
    if (idx < 0) return 25;
    return Math.round(((idx + 1) / stepsOrder.length) * 100);
  }, [currentStep, stepsOrder]);

  const goToNextStep = () => {
    const currentIndex = stepsOrder.indexOf(currentStep);
    if (currentIndex < stepsOrder.length - 1) {
      setInternalStep(stepsOrder[currentIndex + 1]);
    }
  };

  const goToPreviousStep = () => {
    const currentIndex = stepsOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setInternalStep(stepsOrder[currentIndex - 1]);
    }
  };

  const validateCompanyDetails = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) {
      errors.name = labels.requiredFieldsError || 'Company name is required';
    }
    if (!formData.city.trim()) {
      errors.city = labels.requiredFieldsError || 'City is required';
    }
    if (formData.gstin && formData.gstin.trim() && !GSTIN_REGEX.test(formData.gstin.trim())) {
      errors.gstin = labels.gstinError;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBlurField = (field: string) => {
    if (field === 'name' && !formData.name.trim()) {
      setFormErrors((prev) => ({ ...prev, name: labels.requiredFieldsError || 'Company name is required' }));
    } else if (field === 'city' && !formData.city.trim()) {
      setFormErrors((prev) => ({ ...prev, city: labels.requiredFieldsError || 'City is required' }));
    } else if (field === 'gstin' && formData.gstin && formData.gstin.trim() && !GSTIN_REGEX.test(formData.gstin.trim())) {
      setFormErrors((prev) => ({ ...prev, gstin: labels.gstinError }));
    }
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
      <div data-testid="onboarding-empty" className="p-8">
        <EmptyState message={labels.emptyStateMessage} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div data-testid="onboarding-loading" className="p-8 flex justify-center">
        <SpanCard isLoading className="w-full max-w-lg min-h-[128px]" />
      </div>
    );
  }

  const sizeOptionsList = labels.sizeOptions || defaultSizeOptions;

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-8 space-y-6" data-testid="onboarding-container">
      {isOffline && (
        <div data-testid="onboarding-offline">
          <OfflineBanner message={labels.offlineNotice} />
        </div>
      )}

      {externalError && (
        <div data-testid="onboarding-external-error" className="p-3 rounded-control bg-error/15 text-error font-bold text-xs border border-error/30">
          {externalError}
        </div>
      )}

      {/* Header with Span Stepper Progress */}
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold text-charcoal dark:text-warm-paper tracking-tight">
            {labels.title}
          </h1>
          <div className="text-xs font-bold text-charcoal/70 dark:text-warm-paper/70">
            {labels.stepLabel || 'Step'} {stepsOrder.indexOf(currentStep) + 1} {labels.ofLabel || 'of'} {stepsOrder.length}
          </div>
        </div>

        {/* Span Progress Bar */}
        <SpanLine progressPercent={stepProgressPercent} className="my-2" />
      </header>

      {/* Main Two-Column Layout on Desktop: Form on Left, Live Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Column */}
        <div className={currentStep === 'complete' ? 'lg:col-span-12' : 'lg:col-span-7'}>
          {/* STEP 1: Company Details */}
          {currentStep === 'company_details' && (
            <SpanCard className="space-y-5" data-testid="step-company-details">
              <h2 className="text-base font-bold text-charcoal dark:text-warm-paper">
                {labels.stepDetailsTitle}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-charcoal dark:text-warm-paper mb-1">
                    {labels.companyNameLabel} *
                  </label>
                  <input
                    data-testid="input-company-name"
                    type="text"
                    className="w-full min-h-[44px] px-3 font-body text-sm rounded-control border border-sand-border bg-warm-paper dark:bg-charcoal text-charcoal dark:text-warm-paper focus-visible:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange"
                    placeholder={labels.companyNamePlaceholder}
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={() => handleBlurField('name')}
                  />
                  {formErrors.name && (
                    <p className="text-xs font-semibold text-error mt-1" data-testid="error-company-name">
                      {formErrors.name}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-charcoal dark:text-warm-paper mb-1">
                      {labels.industryLabel} *
                    </label>
                    <input
                      data-testid="input-industry"
                      type="text"
                      className="w-full min-h-[44px] px-3 font-body text-sm rounded-control border border-sand-border bg-warm-paper dark:bg-charcoal text-charcoal dark:text-warm-paper focus-visible:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange"
                      placeholder={labels.industryPlaceholder}
                      value={formData.industry}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-charcoal dark:text-warm-paper mb-1">
                      {labels.sizeLabel} *
                    </label>
                    <select
                      data-testid="select-size"
                      className="w-full min-h-[44px] px-3 font-body text-sm rounded-control border border-sand-border bg-warm-paper dark:bg-charcoal text-charcoal dark:text-warm-paper focus-visible:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange"
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
                  <label className="block text-xs font-bold text-charcoal dark:text-warm-paper mb-1">
                    {labels.cityLabel} *
                  </label>
                  <input
                    data-testid="input-city"
                    type="text"
                    className="w-full min-h-[44px] px-3 font-body text-sm rounded-control border border-sand-border bg-warm-paper dark:bg-charcoal text-charcoal dark:text-warm-paper focus-visible:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange"
                    placeholder={labels.cityPlaceholder}
                    value={formData.city}
                    onChange={(e) => {
                      setFormData({ ...formData, city: e.target.value });
                      if (formErrors.city) setFormErrors((prev) => { const n = { ...prev }; delete n.city; return n; });
                    }}
                    onBlur={() => handleBlurField('city')}
                  />
                  {formErrors.city && (
                    <p className="text-xs font-semibold text-error mt-1" data-testid="error-city">
                      {formErrors.city}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal dark:text-warm-paper mb-1">
                    {labels.gstinLabel} {labels.optionalLabel || '(Optional)'}
                  </label>
                  <input
                    data-testid="input-gstin"
                    type="text"
                    maxLength={15}
                    className="w-full min-h-[44px] px-3 font-mono text-sm uppercase rounded-control border border-sand-border bg-warm-paper dark:bg-charcoal text-charcoal dark:text-warm-paper focus-visible:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange"
                    placeholder={labels.gstinPlaceholder}
                    value={formData.gstin}
                    onChange={(e) => {
                      setFormData({ ...formData, gstin: e.target.value.toUpperCase() });
                      if (formErrors.gstin) setFormErrors((prev) => { const n = { ...prev }; delete n.gstin; return n; });
                    }}
                    onBlur={() => handleBlurField('gstin')}
                  />
                  {formErrors.gstin && (
                    <p className="text-xs font-semibold text-error mt-1" data-testid="error-gstin">
                      {formErrors.gstin}
                    </p>
                  )}
                </div>

                {formData.name && (
                  <div className="bg-sand/40 dark:bg-charcoal-deep p-3 rounded-control text-xs flex items-center justify-between border border-sand-border/30">
                    <span className="font-bold text-charcoal/70 dark:text-warm-paper/70">
                      {labels.slugPreviewLabel}:
                    </span>{' '}
                    <span className="font-mono font-bold text-deep-orange dark:text-bridge-orange">
                      onebridge.in/{formData.slug || slugify(formData.name)}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  data-testid="btn-next-details"
                  variant="primary"
                  onClick={() => {
                    if (validateCompanyDetails()) {
                      goToNextStep();
                    }
                  }}
                >
                  {labels.nextButton}
                </Button>
              </div>
            </SpanCard>
          )}

          {/* STEP 2: Plan Selection */}
          {currentStep === 'plan_selection' && (
            <SpanCard className="space-y-5" data-testid="step-plan-selection">
              <h2 className="text-base font-bold text-charcoal dark:text-warm-paper">
                {labels.stepPlanTitle}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  data-testid="plan-starter-card"
                  onClick={() => setFormData({ ...formData, plan: 'starter' })}
                  className={`p-4 rounded-panel border-2 cursor-pointer transition-all motion-reduce:transition-none ${
                    formData.plan === 'starter'
                      ? 'border-bridge-orange bg-sand/30 dark:bg-charcoal-deep ring-1 ring-bridge-orange'
                      : 'border-sand-border hover:border-bridge-orange/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-sm text-charcoal dark:text-warm-paper">
                      {labels.starterPlanTitle}
                    </h3>
                    {formData.plan === 'starter' && (
                      <StatusChip status="info">{labels.selectedLabel || 'Selected'}</StatusChip>
                    )}
                  </div>
                  <p className="text-xl font-bold text-deep-orange dark:text-bridge-orange mb-2">
                    {labels.starterPlanPrice}
                  </p>
                  <p className="text-xs text-charcoal/70 dark:text-warm-paper/70">
                    {labels.starterPlanDescription}
                  </p>
                </div>

                <div
                  data-testid="plan-business-card"
                  onClick={() => setFormData({ ...formData, plan: 'business' })}
                  className={`p-4 rounded-panel border-2 cursor-pointer transition-all motion-reduce:transition-none ${
                    formData.plan === 'business'
                      ? 'border-bridge-orange bg-sand/30 dark:bg-charcoal-deep ring-1 ring-bridge-orange'
                      : 'border-sand-border hover:border-bridge-orange/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-sm text-charcoal dark:text-warm-paper">
                      {labels.businessPlanTitle}
                    </h3>
                    {formData.plan === 'business' && (
                      <StatusChip status="info">{labels.selectedLabel || 'Selected'}</StatusChip>
                    )}
                  </div>
                  <p className="text-xl font-bold text-deep-orange dark:text-bridge-orange mb-2">
                    {labels.businessPlanPrice}
                  </p>
                  <p className="text-xs text-charcoal/70 dark:text-warm-paper/70">
                    {labels.businessPlanDescription}
                  </p>
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <Button variant="secondary" onClick={goToPreviousStep}>
                  {labels.backButton}
                </Button>
                <Button data-testid="btn-next-plan" variant="primary" onClick={goToNextStep}>
                  {labels.nextButton}
                </Button>
              </div>
            </SpanCard>
          )}

          {/* STEP 3: Brand Setup */}
          {currentStep === 'brand_setup' && (
            <SpanCard className="space-y-5" data-testid="step-brand-setup">
              <h2 className="text-base font-bold text-charcoal dark:text-warm-paper">
                {labels.stepBrandTitle}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-charcoal dark:text-warm-paper mb-1">
                    {labels.primaryColorLabel}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      data-testid="input-primary-color"
                      type="color"
                      className="w-11 h-11 rounded-control cursor-pointer border border-sand-border p-1 bg-warm-paper"
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
                      className="w-full min-h-[44px] px-3 font-mono text-sm rounded-control border border-sand-border bg-warm-paper dark:bg-charcoal text-charcoal dark:text-warm-paper"
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
                  <label className="block text-xs font-bold text-charcoal dark:text-warm-paper mb-1">
                    {labels.secondaryColorLabel}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      data-testid="input-secondary-color"
                      type="color"
                      className="w-11 h-11 rounded-control cursor-pointer border border-sand-border p-1 bg-warm-paper"
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
                      className="w-full min-h-[44px] px-3 font-mono text-sm rounded-control border border-sand-border bg-warm-paper dark:bg-charcoal text-charcoal dark:text-warm-paper"
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
                  <label className="block text-xs font-bold text-charcoal dark:text-warm-paper mb-1">
                    {labels.logoUrlLabel}
                  </label>
                  <input
                    data-testid="input-logo-url"
                    type="url"
                    className="w-full min-h-[44px] px-3 font-body text-sm rounded-control border border-sand-border bg-warm-paper dark:bg-charcoal text-charcoal dark:text-warm-paper focus-visible:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange"
                    placeholder={labels.logoUrlPlaceholder}
                    value={formData.logo}
                    onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                  />
                </div>

                {/* Contrast check feedback badge */}
                <div data-testid="contrast-feedback" className="p-3 rounded-control bg-sand/30 dark:bg-charcoal-deep border border-sand-border/30 space-y-2">
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

              <div className="pt-4 flex justify-between">
                <Button variant="secondary" onClick={goToPreviousStep}>
                  {labels.backButton}
                </Button>
                <Button data-testid="btn-next-brand" variant="primary" onClick={goToNextStep}>
                  {labels.nextButton}
                </Button>
              </div>
            </SpanCard>
          )}

          {/* STEP 4: First Card Setup / Launch */}
          {currentStep === 'first_card' && (
            <SpanCard className="space-y-5" data-testid="step-first-card">
              <h2 className="text-base font-bold text-charcoal dark:text-warm-paper">
                {labels.stepCardTitle}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-charcoal dark:text-warm-paper mb-1">
                    {labels.cardholderNameLabel} *
                  </label>
                  <input
                    data-testid="input-cardholder-name"
                    type="text"
                    className="w-full min-h-[44px] px-3 font-body text-sm rounded-control border border-sand-border bg-warm-paper dark:bg-charcoal text-charcoal dark:text-warm-paper focus-visible:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange"
                    placeholder={labels.cardholderNamePlaceholder}
                    value={formData.firstCardName}
                    onChange={(e) => setFormData({ ...formData, firstCardName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-charcoal dark:text-warm-paper mb-1">
                    {labels.cardholderRoleLabel} *
                  </label>
                  <input
                    data-testid="input-cardholder-role"
                    type="text"
                    className="w-full min-h-[44px] px-3 font-body text-sm rounded-control border border-sand-border bg-warm-paper dark:bg-charcoal text-charcoal dark:text-warm-paper focus-visible:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange"
                    placeholder={labels.cardholderRolePlaceholder}
                    value={formData.firstCardRole}
                    onChange={(e) => setFormData({ ...formData, firstCardRole: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <Button variant="secondary" onClick={goToPreviousStep}>
                  {labels.backButton}
                </Button>
                <Button data-testid="btn-launch-org" variant="primary" onClick={handleLaunch}>
                  {labels.launchButton}
                </Button>
              </div>
            </SpanCard>
          )}

          {/* STEP 5: Complete */}
          {currentStep === 'complete' && (
            <SpanCard className="space-y-6 text-center py-8" data-testid="step-complete">
              <StatusChip status="success">{labels.readyBadgeLabel || 'Ready'}</StatusChip>
              <h2 className="text-2xl font-bold text-charcoal dark:text-warm-paper tracking-tight">
                {labels.stepCompleteTitle}
              </h2>
              <p className="text-sm text-charcoal/80 dark:text-warm-paper/80 max-w-md mx-auto">
                {labels.completeMessage}
              </p>

              {/* QR Preview Component */}
              <div className="max-w-xs mx-auto">
                <QrPreview
                  shortLink={`https://onebridge.in/${formData.slug || 'company'}`}
                  className="bg-transparent border-none p-0"
                />
              </div>

              <div className="p-3 rounded-control bg-sand/30 dark:bg-charcoal-deep inline-block font-mono text-xs text-deep-orange dark:text-bridge-orange font-bold">
                {labels.timeToFirstCardLabel}: {elapsedSeconds}s
              </div>
            </SpanCard>
          )}
        </div>

        {/* Live Phone Frame Preview Column (Desktop right rail / Mobile bottom) */}
        {currentStep !== 'complete' && (
          <div className="lg:col-span-5 flex flex-col items-center">
            <span className="text-xs font-bold text-charcoal/70 dark:text-warm-paper/70 uppercase tracking-wider mb-3">
              {labels.previewTitle}
            </span>

            <PhoneFramePreview width={300} height={520} className="shadow-lg">
              {/* Card Header Band with Primary Brand Colour & Span Line */}
              <div
                className="p-5 flex flex-col justify-between min-h-[140px] text-warm-paper transition-colors duration-200"
                style={{
                  backgroundColor: formData.brandColours.primary,
                  color: contrastResult.recommendedTextColor,
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="font-bold text-sm truncate max-w-[170px]">
                    {formData.name || labels.previewCompanyNameFallback || 'Company name'}
                  </div>
                  {formData.logo ? (
                    <img src={formData.logo} alt="Logo" className="w-8 h-8 object-contain rounded-control" />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs"
                      style={{ backgroundColor: formData.brandColours.secondary, color: '#FFFFFF' }}
                    >
                      {formData.name ? formData.name.charAt(0).toUpperCase() : 'G'}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <KeystoneTag label="Verified" className="text-[9px] px-1.5 py-0.5" />
                </div>
              </div>

              {/* Straight Span Line Divider along base of header band */}
              <SpanLine className="my-0 border-none" />

              {/* Card Content Body */}
              <div className="p-5 space-y-4 flex-1 bg-warm-paper text-charcoal flex flex-col justify-between">
                <div>
                  <div className="text-lg font-bold tracking-tight text-charcoal">
                    {formData.firstCardName || labels.firstMemberLabel || 'First member'}
                  </div>
                  <div className="text-xs text-charcoal/70 mt-0.5">
                    {formData.firstCardRole || 'Owner & Director'}
                  </div>
                  <div className="text-xs text-charcoal/50 mt-1">
                    {formData.city || labels.previewCityFallback || 'City, India'}
                  </div>
                </div>

                {/* Legacy selector for test compatibility */}
                <div
                  data-testid="live-card-preview"
                  className="p-3 rounded-control border border-sand-border bg-white text-xs space-y-1.5 shadow-sm"
                  style={{
                    backgroundColor: formData.brandColours.primary,
                    color: contrastResult.recommendedTextColor,
                  }}
                >
                  <div className="font-bold text-xs truncate">
                    {formData.name || labels.previewCompanyNameFallback || 'Company name'}
                  </div>
                  <div className="text-[11px] opacity-80">
                    {formData.firstCardName || labels.firstMemberLabel || 'First member'}
                  </div>
                </div>
              </div>
            </PhoneFramePreview>
          </div>
        )}
      </div>
    </div>
  );
};
