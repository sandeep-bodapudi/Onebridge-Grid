import React, { useEffect, useId, useMemo, useState } from 'react';
import { Building2, ChevronDown, ChevronUp, ExternalLink, Globe, Lock, Unlock } from 'lucide-react';
import { cn } from './ActionButton';
import { Button } from './Button';
import { Input } from './Input';
import { Skeleton } from './Skeleton';
import { StatusChip } from './StatusChip';
import { getTemplateStyle } from './visitor-card-templates';

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
  /** "studio": details | live preview | look, sections and save, side by side (the dashboard). "tabs": compact (default). */
  layout?: 'tabs' | 'studio';
  /** Studio layout: content above the details, e.g. the list of people. */
  peopleSlot?: React.ReactNode;
  /** Studio layout: renders the live preview of the current draft. */
  renderPreview?: (draft: { templateId: string; sections: CardEditorSection[] }) => React.ReactNode;
  /** Company brand colour, so template thumbnails show how the card will really look. */
  brandBand?: string;
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
  layout = 'tabs',
  peopleSlot,
  renderPreview,
  brandBand,
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

  const studio = layout === 'studio';

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

  // ---------- building blocks ----------
  const detailsBlock = (
    <div className="space-y-4">
      {aboutLocked ? (
        <p className="flex items-center gap-2 text-sm text-charcoal/70 dark:text-warm-paper/60">
          <Lock className="w-4 h-4" aria-hidden="true" />
          {labels.lockedNote}
        </p>
      ) : null}
      <div className={cn('grid gap-4', !studio && 'sm:grid-cols-2')}>
        {DETAIL_FIELDS.map((field) => {
          const inputId = `${idPrefix}-${field}`;
          const hint = field === 'phone' ? labels.phoneHint : field === 'photoUrl' ? labels.photoUrlHint : undefined;
          const value = String(about?.content?.[field] ?? '');
          const errorMsg = touched[field] ? fieldErrors[field] : undefined;
          const describedBy = errorMsg ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
          return (
            <div key={field} className={cn('space-y-1.5', !studio && field === 'bio' && 'sm:col-span-2')}>
              <label htmlFor={inputId} className="block text-[13px] font-semibold text-charcoal/80 dark:text-warm-paper/70">
                {labels[field]}
                {field === 'name' ? <span className="text-error"> *</span> : null}
              </label>
              {field === 'bio' ? (
                <textarea
                  id={inputId}
                  rows={studio ? 4 : 3}
                  value={value}
                  disabled={aboutLocked}
                  aria-invalid={Boolean(errorMsg) || undefined}
                  aria-describedby={describedBy}
                  onChange={(e) => updateAbout(field, e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, [field]: true }))}
                  data-testid={`card-field-${field}`}
                  className={cn(
                    'w-full px-3 py-2.5 font-body text-sm rounded-[10px] bg-warm-paper text-charcoal border border-sand-border dark:bg-charcoal-deep dark:text-warm-paper dark:border-white/15',
                    'focus-visible:outline-none focus:border-bridge-orange focus:ring-[3px] focus:ring-bridge-orange/20 disabled:opacity-50',
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
                  className="rounded-[10px] dark:bg-charcoal-deep dark:border-white/15"
                />
              )}
              {errorMsg ? (
                <p id={`${inputId}-error`} className="text-sm text-error dark:text-[#F2A29A]">
                  {errorMsg}
                </p>
              ) : hint ? (
                <p id={`${inputId}-hint`} className="text-xs text-charcoal/60 dark:text-warm-paper/45">
                  {hint}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );

  const templateBlock = (
    <fieldset className="space-y-3">
      <legend className={cn(studio ? 'text-xs font-bold uppercase tracking-[0.06em] text-charcoal/50 dark:text-warm-paper/45 mb-2.5' : 'sr-only')}>
        {studio ? 'Look' : labels.templateHeading}
      </legend>
      <div className={cn('grid gap-2', studio ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-4')}>
        {templates.map((t) => {
          const selected = templateId === t.id;
          const look = getTemplateStyle(t.id, brandBand || '#1F3A5F');
          return (
            <label
              key={t.id}
              title={`${t.name}: ${t.description}`}
              className={cn(
                'relative block cursor-pointer rounded-[10px] overflow-hidden border bg-warm-paper dark:bg-charcoal-deep transition-shadow',
                selected ? 'border-bridge-orange ring-2 ring-bridge-orange' : 'border-sand-border dark:border-white/15 hover:border-charcoal/40 dark:hover:border-white/30'
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
              <span aria-hidden="true" className={cn('block h-8', look.headerClass)} style={look.headerStyle} />
              {look.stripeColour ? <span aria-hidden="true" className="block h-[3px]" style={{ backgroundColor: look.stripeColour }} /> : null}
              <span aria-hidden="true" className="block p-1.5 space-y-1">
                <span className="block h-1 rounded-sm bg-charcoal/15 dark:bg-white/15" />
                <span className="block h-1 w-3/5 rounded-sm bg-charcoal/15 dark:bg-white/15" />
              </span>
              <span className={cn(studio ? 'sr-only' : 'block px-1.5 pb-1.5 text-xs font-semibold truncate')}>{t.name}</span>
            </label>
          );
        })}
      </div>
      {studio ? <p className="text-xs text-charcoal/60 dark:text-warm-paper/45">{templates.find((t) => t.id === templateId)?.name}</p> : null}
    </fieldset>
  );

  const sectionsBlock = (
    <div className="space-y-2.5">
      {studio ? <div className="text-xs font-bold uppercase tracking-[0.06em] text-charcoal/50 dark:text-warm-paper/45">{labels.sectionsHeading}</div> : null}
      {!studio ? <p className="text-sm text-charcoal/70 dark:text-warm-paper/60">{labels.sectionsHint}</p> : null}
      <ol className="space-y-1.5">
        {sections.map((section, index) => {
          const disabled = section.locked && !isAdmin;
          const name = labels.sectionNames[section.type];
          return (
            <li
              key={section.type}
              className="flex items-center gap-1 pl-1 pr-2 py-1 rounded-[10px] bg-warm-paper dark:bg-charcoal-deep border border-sand-border dark:border-white/[0.08]"
              data-testid={`section-row-${section.type}`}
            >
              <span className="flex flex-col">
                <button
                  type="button"
                  className="w-7 h-[22px] flex items-center justify-center rounded-md opacity-50 hover:opacity-100 disabled:opacity-20"
                  onClick={() => move(index, -1)}
                  disabled={disabled || index === 0}
                  aria-label={`${labels.moveUp}: ${name}`}
                >
                  <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="w-7 h-[22px] flex items-center justify-center rounded-md opacity-50 hover:opacity-100 disabled:opacity-20"
                  onClick={() => move(index, 1)}
                  disabled={disabled || index === sections.length - 1}
                  aria-label={`${labels.moveDown}: ${name}`}
                >
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </span>
              <span className="flex-1 min-w-0 text-sm font-semibold truncate">{name}</span>
              <button
                type="button"
                aria-pressed={section.visibility === 'internal'}
                aria-label={`${labels.visibility}: ${name}, ${section.visibility === 'internal' ? labels.internal : labels.public}`}
                title={section.visibility === 'internal' ? labels.internal : labels.public}
                disabled={disabled}
                onClick={() => updateSection(section.type, { visibility: section.visibility === 'internal' ? 'public' : 'internal' })}
                className={cn('w-8 h-8 flex items-center justify-center rounded-md disabled:opacity-30', section.visibility === 'internal' ? 'opacity-100' : 'opacity-40 hover:opacity-100')}
              >
                {section.visibility === 'internal' ? <Building2 className="w-4 h-4" aria-hidden="true" /> : <Globe className="w-4 h-4" aria-hidden="true" />}
              </button>
              {isAdmin ? (
                <label className="w-8 h-8 flex items-center justify-center rounded-md cursor-pointer" title={labels.lock}>
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={section.locked}
                    onChange={(e) => updateSection(section.type, { locked: e.target.checked })}
                    data-testid={`section-locked-${section.type}`}
                    aria-label={`${labels.lock}: ${name}`}
                  />
                  {section.locked ? <Lock className="w-4 h-4" aria-hidden="true" /> : <Unlock className="w-4 h-4 opacity-40" aria-hidden="true" />}
                </label>
              ) : section.locked ? (
                <Lock className="w-4 h-4 mx-2 opacity-60" aria-label={labels.lock} />
              ) : null}
              <label className="relative inline-flex items-center cursor-pointer ml-1">
                <input
                  type="checkbox"
                  role="switch"
                  className="sr-only peer"
                  checked={section.enabled}
                  disabled={disabled}
                  onChange={(e) => updateSection(section.type, { enabled: e.target.checked })}
                  data-testid={`section-enabled-${section.type}`}
                  aria-label={`${labels.show}: ${name}`}
                />
                <span
                  aria-hidden="true"
                  className="w-[34px] h-5 rounded-[10px] bg-charcoal/20 dark:bg-[#393536] peer-checked:bg-bridge-orange dark:peer-checked:bg-bridge-orange peer-disabled:opacity-40 peer-focus-visible:ring-2 peer-focus-visible:ring-bridge-orange transition-colors relative after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:w-3.5 after:h-3.5 after:rounded-[5px] after:bg-warm-paper dark:after:bg-warm-paper/70 peer-checked:after:translate-x-[14px] peer-checked:after:bg-[#241A10] dark:peer-checked:after:bg-[#241A10] after:transition-transform"
                />
              </label>
            </li>
          );
        })}
      </ol>
    </div>
  );

  const statusChip = (
    <span data-testid="card-status">
      <StatusChip status={isPublished ? 'published' : card.status === 'pending_approval' ? 'info' : 'draft'}>{statusLabel}</StatusChip>
    </span>
  );

  const saveMessage = isDirty
    ? isPublished
      ? 'Unsaved changes. Saving updates the live card.'
      : labels.unsaved
    : card.status === 'draft' && hasErrors
      ? 'Add a name before publishing.'
      : isPublished
        ? 'All changes are live.'
        : '';

  const actionsBlock = (
    <div className={cn(studio ? 'flex flex-col gap-2.5 p-3.5 rounded-xl bg-warm-paper dark:bg-charcoal-deep border border-sand-border dark:border-white/[0.08]' : 'flex flex-wrap items-center gap-3 pt-4 border-t border-sand-border dark:border-white/[0.08]')}>
      {studio ? (
        <div className="flex items-center justify-between gap-2 text-[13px] text-charcoal/60 dark:text-warm-paper/55">
          {statusChip}
          {isPublished && publicUrl ? (
            <a href={publicUrl} target="_blank" rel="noreferrer" data-testid="open-public-card" className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
              {labels.openPublicCard}
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      ) : null}
      {isPublished ? (
        // Saving a published card updates it for visitors, so there is no second publish step.
        <Button type="button" variant="primary" onClick={handleSave} isLoading={isSaving} disabled={!isDirty} data-testid="card-save" isFullWidth={studio}>
          {isSaving ? labels.saving : labels.save}
        </Button>
      ) : (
        <div className={cn('flex gap-2', studio ? 'flex-col' : 'flex-wrap')}>
          {card.status === 'pending_approval' && isAdmin && onApprove ? (
            <Button type="button" variant="primary" onClick={() => onApprove()} isLoading={isPublishing} data-testid="card-approve" isFullWidth={studio}>
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
              isFullWidth={studio}
            >
              {needsApproval ? labels.submitForApproval : labels.publish}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={handleSave} isLoading={isSaving} disabled={!isDirty} data-testid="card-save" isFullWidth={studio}>
            {isSaving ? labels.saving : labels.save}
          </Button>
        </div>
      )}
      <span className="text-[13px] text-charcoal/70 dark:text-warm-paper/55" role="status">
        {saveMessage}
      </span>
    </div>
  );

  const errorBlock = error ? (
    <p role="alert" className="px-4 py-3 rounded-[10px] border border-error/40 bg-error/10 text-sm" data-testid="card-editor-error">
      {error}
    </p>
  ) : null;

  // ---------- studio layout ----------
  if (studio) {
    return (
      <div className={cn('grid rounded-[14px] border border-sand-border dark:border-white/[0.08] overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_320px]', className)} data-testid="card-editor">
        <div className="p-[18px] space-y-5 bg-sand/20 dark:bg-charcoal border-b lg:border-b-0 lg:border-r border-sand-border dark:border-white/[0.08] min-w-0">
          {peopleSlot}
          {errorBlock}
          <div className="space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-[0.06em] text-charcoal/50 dark:text-warm-paper/45">{labels.detailsHeading}</div>
            {detailsBlock}
          </div>
        </div>
        <div className="p-[18px] flex flex-col items-center gap-3.5 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(246,135,19,0.10),transparent_60%)] min-w-0">
          {renderPreview ? renderPreview({ templateId, sections }) : null}
          <p className="text-xs text-center text-charcoal/60 dark:text-warm-paper/45 max-w-[32ch]">This is exactly what a customer sees after scanning the QR code.</p>
          <div className="w-full max-w-sm xl:hidden space-y-5">
            {templateBlock}
            {sectionsBlock}
            {actionsBlock}
          </div>
        </div>
        <div className="hidden xl:flex flex-col gap-5 p-[18px] bg-sand/20 dark:bg-charcoal border-l border-sand-border dark:border-white/[0.08]">
          {templateBlock}
          {sectionsBlock}
          <div className="mt-auto">{actionsBlock}</div>
        </div>
      </div>
    );
  }

  // ---------- tabbed layout ----------
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
          {statusChip}
        </div>
        {isPublished && publicUrl ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold underline underline-offset-2"
            data-testid="open-public-card"
          >
            {labels.openPublicCard}
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
          </a>
        ) : null}
      </div>
      {errorBlock}
      <div role="tablist" aria-label="Card editor sections" className="flex border-b border-sand-border dark:border-white/[0.08]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn('relative min-h-[44px] px-4 text-sm font-semibold transition-colors', tab === t.id ? '' : 'opacity-60 hover:opacity-100')}
          >
            {t.label}
            {tab === t.id ? <span aria-hidden="true" className="absolute left-0 right-0 -bottom-px h-[2px] bg-bridge-orange" /> : null}
          </button>
        ))}
      </div>
      <section id={`${idPrefix}-panel-details`} role="tabpanel" aria-labelledby={`${idPrefix}-tab-details`} hidden={tab !== 'details'}>
        {detailsBlock}
      </section>
      <section id={`${idPrefix}-panel-template`} role="tabpanel" aria-labelledby={`${idPrefix}-tab-template`} hidden={tab !== 'template'}>
        {templateBlock}
      </section>
      <section id={`${idPrefix}-panel-sections`} role="tabpanel" aria-labelledby={`${idPrefix}-tab-sections`} hidden={tab !== 'sections'}>
        {sectionsBlock}
      </section>
      {actionsBlock}
    </div>
  );
};
