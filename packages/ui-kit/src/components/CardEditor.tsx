import React, { useEffect, useId, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ExternalLink, Lock } from 'lucide-react';
import { cn } from './ActionButton';
import { Button } from './Button';
import { Input } from './Input';
import { Skeleton } from './Skeleton';
import { StatusChip } from './StatusChip';

/** F10: one card per seat, 8 templates, 9 orderable/toggleable sections. */

export type CardEditorSectionType =
  | 'about'
  | 'products'
  | 'services'
  | 'portfolio'
  | 'gallery'
  | 'documents'
  | 'social_links'
  | 'company_info'
  | 'branch_map';

export interface CardEditorSection {
  type: CardEditorSectionType;
  enabled: boolean;
  order: number;
  locked: boolean;
  visibility: 'public' | 'internal';
  content: Record<string, unknown>;
}

export interface CardEditorCard {
  id: string;
  slug: string;
  templateId: string;
  status: 'draft' | 'pending_approval' | 'published';
  sections: CardEditorSection[];
  approvalRequired?: boolean;
}

export interface CardEditorTemplate {
  id: string;
  name: string;
  description: string;
}

export interface CardEditorLabels {
  title: string;
  statusDraft: string;
  statusPending: string;
  statusPublished: string;
  detailsHeading: string;
  name: string;
  designation: string;
  phone: string;
  phoneHint: string;
  email: string;
  photoUrl: string;
  photoUrlHint: string;
  bio: string;
  templateHeading: string;
  sectionsHeading: string;
  sectionsHint: string;
  show: string;
  visibility: string;
  public: string;
  internal: string;
  moveUp: string;
  moveDown: string;
  lock: string;
  lockedNote: string;
  save: string;
  saving: string;
  publish: string;
  submitForApproval: string;
  approve: string;
  openPublicCard: string;
  unsaved: string;
  sectionNames: Record<CardEditorSectionType, string>;
}

export const defaultCardEditorLabelsEn: CardEditorLabels = {
  title: 'Card',
  statusDraft: 'Draft',
  statusPending: 'Waiting for approval',
  statusPublished: 'Published',
  detailsHeading: 'Details',
  name: 'Full name',
  designation: 'Job title',
  phone: 'Mobile number',
  phoneHint: 'Used for Call, WhatsApp and Save contact. Example: 98765 43210',
  email: 'Email',
  photoUrl: 'Photo link',
  photoUrlHint: 'Link to a square photo, starting with https://',
  bio: 'About',
  templateHeading: 'Template',
  sectionsHeading: 'Sections',
  sectionsHint: 'Choose which sections visitors see and in what order.',
  show: 'Show',
  visibility: 'Visibility',
  public: 'Everyone',
  internal: 'Company only',
  moveUp: 'Move up',
  moveDown: 'Move down',
  lock: 'Locked for employees',
  lockedNote: 'Your company has locked this. Ask an admin to change it.',
  save: 'Save changes',
  saving: 'Saving...',
  publish: 'Publish card',
  submitForApproval: 'Submit for approval',
  approve: 'Approve and publish',
  openPublicCard: 'Open public card',
  unsaved: 'Unsaved changes',
  sectionNames: {
    about: 'About',
    products: 'Products',
    services: 'Services',
    portfolio: 'Portfolio',
    gallery: 'Gallery',
    documents: 'Documents',
    social_links: 'Social links',
    company_info: 'Company info',
    branch_map: 'Branch map',
  },
};

export interface CardEditorProps {
  card: CardEditorCard | null;
  templates: CardEditorTemplate[];
  isAdmin: boolean;
  publicUrl?: string;
  isLoading?: boolean;
  isSaving?: boolean;
  isPublishing?: boolean;
  error?: string | null;
  labels?: Partial<CardEditorLabels>;
  onSave: (update: { templateId: string; sections: CardEditorSection[] }) => Promise<void> | void;
  onPublish: () => Promise<void> | void;
  onApprove?: () => Promise<void> | void;
  /** Called on every edit, so the host can show a live preview of unsaved changes. */
  onDraftChange?: (draft: { templateId: string; sections: CardEditorSection[] }) => void;
  className?: string;
}

const DETAIL_FIELDS = ['name', 'designation', 'phone', 'email', 'photoUrl', 'bio'] as const;
type DetailField = (typeof DETAIL_FIELDS)[number];
type Tab = 'details' | 'template' | 'sections';

const PHONE_PATTERN = /^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/;

function sortSections(sections: CardEditorSection[]): CardEditorSection[] {
  return [...sections].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i }));
}

function validateField(field: DetailField, value: string): string | undefined {
  const v = value.trim();
  if (field === 'name' && !v) return 'Enter the name to show on the card.';
  if (field === 'phone' && v && !PHONE_PATTERN.test(v)) return 'Enter a 10-digit Indian mobile number, like 98765 43210.';
  if (field === 'email' && v && !/^\S+@\S+\.\S+$/.test(v)) return 'Enter an email address like name@company.com.';
  if (field === 'photoUrl' && v && !/^https:\/\/\S+$/.test(v)) return 'Use a link that starts with https://';
  if (field === 'bio' && v.length > 300) return 'Keep the about text under 300 characters.';
  return undefined;
}

export const CardEditor: React.FC<CardEditorProps> = ({
  card,
  templates,
  isAdmin,
  publicUrl,
  isLoading,
  isSaving,
  isPublishing,
  error,
  labels: labelOverrides,
  onSave,
  onPublish,
  onApprove,
  onDraftChange,
  className,
}) => {
  const labels = { ...defaultCardEditorLabelsEn, ...labelOverrides };
  const idPrefix = useId();
  const [tab, setTab] = useState<Tab>('details');
  const [templateId, setTemplateId] = useState(card?.templateId ?? '');
  const [sections, setSections] = useState<CardEditorSection[]>(card ? sortSections(card.sections) : []);
  const [touched, setTouched] = useState<Partial<Record<DetailField, boolean>>>({});

  useEffect(() => {
    if (card) {
      setTemplateId(card.templateId);
      setSections(sortSections(card.sections));
      setTouched({});
    }
  }, [card]);

  useEffect(() => {
    if (card) onDraftChange?.({ templateId, sections });
  }, [templateId, sections]);

  const about = sections.find((s) => s.type === 'about');
  const aboutLocked = Boolean(about?.locked) && !isAdmin;

  const isDirty = useMemo(() => {
    if (!card) return false;
    return templateId !== card.templateId || JSON.stringify(sections) !== JSON.stringify(sortSections(card.sections));
  }, [card, templateId, sections]);

  const fieldErrors = useMemo(() => {
    const errs: Partial<Record<DetailField, string>> = {};
    for (const field of DETAIL_FIELDS) {
      const msg = validateField(field, String(about?.content?.[field] ?? ''));
      if (msg) errs[field] = msg;
    }
    return errs;
  }, [about]);
  const hasErrors = Object.keys(fieldErrors).length > 0;

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)} data-testid="card-editor-loading" aria-busy="true">
        <Skeleton width="33%" height={28} />
        <Skeleton height={44} />
        <Skeleton height={160} />
      </div>
    );
  }

  if (!card) {
    return (
      <p className={cn('py-8 text-sm text-charcoal/70 dark:text-warm-paper/70', className)} data-testid="card-editor-empty">
        Select a person to edit their card.
      </p>
    );
  }

  const updateAbout = (field: DetailField, value: string) => {
    setSections((prev) => prev.map((s) => (s.type === 'about' ? { ...s, content: { ...s.content, [field]: value } } : s)));
  };
  const updateSection = (type: CardEditorSectionType, patch: Partial<CardEditorSection>) => {
    setSections((prev) => prev.map((s) => (s.type === type ? { ...s, ...patch } : s)));
  };
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next.map((s, i) => ({ ...s, order: i })));
  };

  const statusLabel =
    card.status === 'published' ? labels.statusPublished : card.status === 'pending_approval' ? labels.statusPending : labels.statusDraft;
  const needsApproval = Boolean(card.approvalRequired) && !isAdmin;
  const isPublished = card.status === 'published';

  const handleSave = () => {
    if (hasErrors) {
      setTouched(Object.fromEntries(DETAIL_FIELDS.map((f) => [f, true])));
      setTab('details');
      return;
    }
    onSave({ templateId, sections });
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'details', label: labels.detailsHeading },
    { id: 'template', label: labels.templateHeading },
    { id: 'sections', label: labels.sectionsHeading },
  ];

  return (
    <div className={cn('space-y-5', className)} data-testid="card-editor">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold">{labels.title}</h3>
          <span data-testid="card-status">
            <StatusChip status={isPublished ? 'published' : card.status === 'pending_approval' ? 'info' : 'draft'}>{statusLabel}</StatusChip>
          </span>
        </div>
        {isPublished && publicUrl ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-deep-orange underline underline-offset-2"
            data-testid="open-public-card"
          >
            {labels.openPublicCard}
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
          </a>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="px-4 py-3 rounded-panel border border-error/40 bg-error/10 text-sm" data-testid="card-editor-error">
          {error}
        </p>
      ) : null}

      <div role="tablist" aria-label="Card editor sections" className="flex border-b border-sand-border dark:border-sand-border/30">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              'relative min-h-[44px] px-4 text-sm font-semibold transition-colors',
              tab === t.id ? 'text-charcoal dark:text-warm-paper' : 'text-charcoal/60 hover:text-charcoal dark:text-warm-paper/60 dark:hover:text-warm-paper'
            )}
          >
            {t.label}
            {t.id === 'details' && hasErrors && Object.keys(touched).length > 0 ? (
              <span className="ml-1.5 inline-block w-1.5 h-1.5 bg-error align-middle" aria-label="has errors" />
            ) : null}
            {tab === t.id ? <span aria-hidden="true" className="absolute left-0 right-0 -bottom-px h-[2px] bg-charcoal dark:bg-warm-paper" /> : null}
          </button>
        ))}
      </div>

      {/* Details */}
      <section
        id={`${idPrefix}-panel-details`}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-tab-details`}
        hidden={tab !== 'details'}
        className="space-y-4"
      >
        {aboutLocked ? (
          <p className="flex items-center gap-2 text-sm text-charcoal/70 dark:text-warm-paper/70">
            <Lock className="w-4 h-4" aria-hidden="true" />
            {labels.lockedNote}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {DETAIL_FIELDS.map((field) => {
            const inputId = `${idPrefix}-${field}`;
            const hint = field === 'phone' ? labels.phoneHint : field === 'photoUrl' ? labels.photoUrlHint : undefined;
            const value = String(about?.content?.[field] ?? '');
            const errorMsg = touched[field] ? fieldErrors[field] : undefined;
            const describedBy = errorMsg ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
            return (
              <div key={field} className={cn('space-y-1', field === 'bio' && 'sm:col-span-2')}>
                <label htmlFor={inputId} className="block text-sm font-semibold">
                  {labels[field]}
                  {field === 'name' ? <span className="text-error"> *</span> : null}
                </label>
                {field === 'bio' ? (
                  <textarea
                    id={inputId}
                    rows={3}
                    value={value}
                    disabled={aboutLocked}
                    aria-invalid={Boolean(errorMsg) || undefined}
                    aria-describedby={describedBy}
                    onChange={(e) => updateAbout(field, e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, [field]: true }))}
                    data-testid={`card-field-${field}`}
                    className={cn(
                      'w-full px-3 py-2 font-body text-sm rounded-control bg-warm-paper text-charcoal border border-sand-border dark:bg-charcoal dark:text-warm-paper dark:border-sand-border/30',
                      'focus-visible:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange disabled:opacity-50',
                      errorMsg && 'border-error'
                    )}
                  />
                ) : (
                  <Input
                    id={inputId}
                    type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : field === 'photoUrl' ? 'url' : 'text'}
                    value={value}
                    disabled={aboutLocked}
                    hasError={Boolean(errorMsg)}
                    aria-invalid={Boolean(errorMsg) || undefined}
                    aria-describedby={describedBy}
                    onChange={(e) => updateAbout(field, e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, [field]: true }))}
                    data-testid={`card-field-${field}`}
                  />
                )}
                {errorMsg ? (
                  <p id={`${inputId}-error`} className="text-sm text-error">
                    {errorMsg}
                  </p>
                ) : hint ? (
                  <p id={`${inputId}-hint`} className="text-xs text-charcoal/60 dark:text-warm-paper/60">
                    {hint}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* Template */}
      <fieldset
        id={`${idPrefix}-panel-template`}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-tab-template`}
        hidden={tab !== 'template'}
        className="space-y-3"
      >
        <legend className="sr-only">{labels.templateHeading}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {templates.map((t) => {
            const selected = templateId === t.id;
            return (
              <label
                key={t.id}
                className={cn(
                  'relative flex min-h-[64px] cursor-pointer items-start gap-3 rounded-panel border p-3 transition-colors',
                  selected
                    ? 'border-charcoal bg-sand/50 dark:border-warm-paper dark:bg-charcoal'
                    : 'border-sand-border hover:bg-sand/30 dark:border-sand-border/30 dark:hover:bg-charcoal'
                )}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-template`}
                  value={t.id}
                  checked={selected}
                  onChange={() => setTemplateId(t.id)}
                  className="sr-only"
                  data-testid={`template-${t.id}`}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 w-5 h-5 shrink-0 rounded-control border flex items-center justify-center',
                    selected ? 'bg-charcoal border-charcoal text-warm-paper dark:bg-warm-paper dark:border-warm-paper dark:text-charcoal' : 'border-sand-border dark:border-sand-border/50'
                  )}
                >
                  {selected ? <Check className="w-3.5 h-3.5" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{t.name}</span>
                  <span className="block text-sm text-charcoal/70 dark:text-warm-paper/70">{t.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Sections */}
      <section
        id={`${idPrefix}-panel-sections`}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-tab-sections`}
        hidden={tab !== 'sections'}
        className="space-y-3"
      >
        <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">{labels.sectionsHint}</p>
        <ol className="rounded-panel border border-sand-border dark:border-sand-border/30 divide-y divide-sand-border dark:divide-sand-border/30 overflow-hidden">
          {sections.map((section, index) => {
            const disabled = section.locked && !isAdmin;
            const name = labels.sectionNames[section.type];
            return (
              <li
                key={section.type}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 bg-warm-paper dark:bg-charcoal"
                data-testid={`section-row-${section.type}`}
              >
                <label className="flex min-h-[44px] flex-1 min-w-[150px] items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={section.enabled}
                    disabled={disabled}
                    onChange={(e) => updateSection(section.type, { enabled: e.target.checked })}
                    data-testid={`section-enabled-${section.type}`}
                    className="w-4 h-4 accent-charcoal"
                    aria-label={`${labels.show}: ${name}`}
                  />
                  {name}
                  {section.locked ? <Lock className="w-3.5 h-3.5 text-charcoal/50 dark:text-warm-paper/50" aria-label={labels.lock} /> : null}
                </label>
                <label className="flex items-center text-sm">
                  <span className="sr-only">
                    {labels.visibility}: {name}
                  </span>
                  <select
                    className="min-h-[44px] rounded-control border border-sand-border bg-warm-paper px-2 text-sm dark:bg-charcoal-deep dark:border-sand-border/30"
                    value={section.visibility}
                    disabled={disabled}
                    onChange={(e) => updateSection(section.type, { visibility: e.target.value as 'public' | 'internal' })}
                  >
                    <option value="public">{labels.public}</option>
                    <option value="internal">{labels.internal}</option>
                  </select>
                </label>
                {isAdmin ? (
                  <label className="flex min-h-[44px] items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={section.locked}
                      onChange={(e) => updateSection(section.type, { locked: e.target.checked })}
                      data-testid={`section-locked-${section.type}`}
                      className="w-4 h-4 accent-charcoal"
                    />
                    <span className="hidden sm:inline">{labels.lock}</span>
                    <span className="sm:hidden">Lock</span>
                  </label>
                ) : null}
                <span className="flex">
                  <button
                    type="button"
                    className="w-11 h-11 flex items-center justify-center rounded-control hover:bg-sand disabled:opacity-30 dark:hover:bg-charcoal-deep"
                    onClick={() => move(index, -1)}
                    disabled={disabled || index === 0}
                    aria-label={`${labels.moveUp}: ${name}`}
                  >
                    <ArrowUp className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="w-11 h-11 flex items-center justify-center rounded-control hover:bg-sand disabled:opacity-30 dark:hover:bg-charcoal-deep"
                    onClick={() => move(index, 1)}
                    disabled={disabled || index === sections.length - 1}
                    aria-label={`${labels.moveDown}: ${name}`}
                  >
                    <ArrowDown className="w-4 h-4" aria-hidden="true" />
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-sand-border dark:border-sand-border/30">
        {isPublished ? (
          // Saving a published card updates it for visitors, so there is no second publish step.
          <Button type="button" variant="primary" onClick={handleSave} isLoading={isSaving} disabled={!isDirty} data-testid="card-save">
            {isSaving ? labels.saving : labels.save}
          </Button>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={handleSave} isLoading={isSaving} disabled={!isDirty} data-testid="card-save">
              {isSaving ? labels.saving : labels.save}
            </Button>
            {card.status === 'pending_approval' && isAdmin && onApprove ? (
              <Button type="button" variant="primary" onClick={() => onApprove()} isLoading={isPublishing} data-testid="card-approve">
                {labels.approve}
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                onClick={() => onPublish()}
                isLoading={isPublishing}
                disabled={isDirty || card.status === 'pending_approval' || hasErrors}
                data-testid="card-publish"
              >
                {needsApproval ? labels.submitForApproval : labels.publish}
              </Button>
            )}
          </>
        )}
        <span className="text-sm text-charcoal/70 dark:text-warm-paper/70" role="status">
          {isDirty
            ? isPublished
              ? 'Unsaved changes. Saving updates the live card.'
              : labels.unsaved
            : card.status === 'draft' && hasErrors
              ? 'Add a name before publishing.'
              : ''}
        </span>
      </div>
    </div>
  );
};
