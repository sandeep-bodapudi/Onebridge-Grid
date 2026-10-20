import React, { useEffect, useId, useMemo, useState } from 'react';
import { cn, ActionButton } from './ActionButton';

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
  detailsHeading: 'Details on the card',
  name: 'Full name',
  designation: 'Designation',
  phone: 'Mobile number',
  phoneHint: 'Used for Call, WhatsApp and Save contact. Example: 98765 43210',
  email: 'Email',
  photoUrl: 'Photo link',
  photoUrlHint: 'Link to a square photo (https://...)',
  bio: 'Short bio',
  templateHeading: 'Template',
  sectionsHeading: 'Sections',
  sectionsHint: 'Choose which sections visitors see and in what order.',
  show: 'Show',
  visibility: 'Visibility',
  public: 'Public',
  internal: 'Internal only',
  moveUp: 'Move up',
  moveDown: 'Move down',
  lock: 'Locked by company',
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
  className?: string;
}

const DETAIL_FIELDS = ['name', 'designation', 'phone', 'email', 'photoUrl', 'bio'] as const;
type DetailField = (typeof DETAIL_FIELDS)[number];

function sortSections(sections: CardEditorSection[]): CardEditorSection[] {
  return [...sections].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i }));
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
  className,
}) => {
  const labels = { ...defaultCardEditorLabelsEn, ...labelOverrides };
  const idPrefix = useId();
  const [templateId, setTemplateId] = useState(card?.templateId ?? '');
  const [sections, setSections] = useState<CardEditorSection[]>(card ? sortSections(card.sections) : []);

  useEffect(() => {
    if (card) {
      setTemplateId(card.templateId);
      setSections(sortSections(card.sections));
    }
  }, [card]);

  const about = sections.find((s) => s.type === 'about');
  const aboutLocked = Boolean(about?.locked) && !isAdmin;

  const isDirty = useMemo(() => {
    if (!card) return false;
    return (
      templateId !== card.templateId ||
      JSON.stringify(sections) !== JSON.stringify(sortSections(card.sections))
    );
  }, [card, templateId, sections]);

  if (isLoading) {
    return (
      <div className={cn('animate-pulse space-y-16 p-16', className)} data-testid="card-editor-loading" aria-busy="true">
        <div className="h-8 w-1/3 rounded-12 bg-sand" />
        <div className="h-32 rounded-16 bg-sand" />
        <div className="h-32 rounded-16 bg-sand" />
      </div>
    );
  }

  if (!card) {
    return (
      <p className={cn('p-16 text-charcoal/70 dark:text-warm-paper/70', className)} data-testid="card-editor-empty">
        Select a seat to edit its card.
      </p>
    );
  }

  const updateAbout = (field: DetailField, value: string) => {
    setSections((prev) =>
      prev.map((s) => (s.type === 'about' ? { ...s, content: { ...s.content, [field]: value } } : s))
    );
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
  const statusIcon = card.status === 'published' ? '●' : card.status === 'pending_approval' ? '◐' : '○';

  const needsApproval = Boolean(card.approvalRequired) && !isAdmin;
  const inputClass =
    'mt-4 w-full min-h-[44px] rounded-12 border border-sand-border bg-white px-12 text-charcoal disabled:bg-sand disabled:text-charcoal/60 dark:bg-charcoal-deep dark:text-warm-paper';

  return (
    <div className={cn('space-y-24', className)} data-testid="card-editor">
      <div className="flex flex-wrap items-center justify-between gap-12">
        <div className="flex items-center gap-12">
          <h3 className="text-lg font-extrabold">{labels.title}</h3>
          <span
            className={cn('inline-flex items-center gap-4 rounded-12 px-12 py-4 text-sm font-bold', {
              'bg-success/10 text-success': card.status === 'published',
              'bg-warning/10 text-deep-orange': card.status === 'pending_approval',
              'bg-sand text-charcoal dark:bg-charcoal dark:text-warm-paper': card.status === 'draft',
            })}
            data-testid="card-status"
          >
            <span aria-hidden="true">{statusIcon}</span>
            {statusLabel}
          </span>
        </div>
        {card.status === 'published' && publicUrl ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center font-bold text-deep-orange underline-offset-4 hover:underline"
            data-testid="open-public-card"
          >
            {labels.openPublicCard} ↗
          </a>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-12 bg-error/10 p-12 font-bold text-error" data-testid="card-editor-error">
          {error}
        </p>
      ) : null}

      <section aria-labelledby={`${idPrefix}-details`} className="space-y-12">
        <h4 id={`${idPrefix}-details`} className="font-bold">
          {labels.detailsHeading}
        </h4>
        {aboutLocked ? <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">🔒 {labels.lockedNote}</p> : null}
        <div className="grid gap-12 sm:grid-cols-2">
          {DETAIL_FIELDS.map((field) => {
            const inputId = `${idPrefix}-${field}`;
            const hint = field === 'phone' ? labels.phoneHint : field === 'photoUrl' ? labels.photoUrlHint : undefined;
            const value = String(about?.content?.[field] ?? '');
            return (
              <div key={field} className={field === 'bio' ? 'sm:col-span-2' : undefined}>
                <label htmlFor={inputId} className="text-sm font-bold">
                  {labels[field]}
                </label>
                {field === 'bio' ? (
                  <textarea
                    id={inputId}
                    className={cn(inputClass, 'py-8')}
                    rows={3}
                    value={value}
                    disabled={aboutLocked}
                    onChange={(e) => updateAbout(field, e.target.value)}
                    data-testid={`card-field-${field}`}
                  />
                ) : (
                  <input
                    id={inputId}
                    type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : field === 'photoUrl' ? 'url' : 'text'}
                    className={inputClass}
                    value={value}
                    disabled={aboutLocked}
                    aria-describedby={hint ? `${inputId}-hint` : undefined}
                    onChange={(e) => updateAbout(field, e.target.value)}
                    data-testid={`card-field-${field}`}
                  />
                )}
                {hint ? (
                  <p id={`${inputId}-hint`} className="mt-4 text-xs text-charcoal/60 dark:text-warm-paper/60">
                    {hint}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <fieldset className="space-y-12">
        <legend className="font-bold">{labels.templateHeading}</legend>
        <div className="grid gap-8 sm:grid-cols-2">
          {templates.map((t) => (
            <label
              key={t.id}
              className={cn(
                'flex min-h-[44px] cursor-pointer items-start gap-8 rounded-16 border p-12',
                templateId === t.id ? 'border-bridge-orange bg-bridge-orange/10' : 'border-sand-border'
              )}
            >
              <input
                type="radio"
                name={`${idPrefix}-template`}
                value={t.id}
                checked={templateId === t.id}
                onChange={() => setTemplateId(t.id)}
                className="mt-4"
                data-testid={`template-${t.id}`}
              />
              <span>
                <span className="block font-bold">{t.name}</span>
                <span className="block text-sm text-charcoal/70 dark:text-warm-paper/70">{t.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <section aria-labelledby={`${idPrefix}-sections`} className="space-y-12">
        <div>
          <h4 id={`${idPrefix}-sections`} className="font-bold">
            {labels.sectionsHeading}
          </h4>
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">{labels.sectionsHint}</p>
        </div>
        <ol className="space-y-8">
          {sections.map((section, index) => {
            const disabled = section.locked && !isAdmin;
            const name = labels.sectionNames[section.type];
            return (
              <li
                key={section.type}
                className="flex flex-wrap items-center gap-12 rounded-16 border border-sand-border p-12"
                data-testid={`section-row-${section.type}`}
              >
                <span className="min-w-[120px] flex-1 font-bold">
                  {name}
                  {section.locked ? <span className="ml-8 text-sm font-regular text-charcoal/60 dark:text-warm-paper/60">🔒 {labels.lock}</span> : null}
                </span>
                <label className="flex min-h-[44px] items-center gap-8 text-sm">
                  <input
                    type="checkbox"
                    checked={section.enabled}
                    disabled={disabled}
                    onChange={(e) => updateSection(section.type, { enabled: e.target.checked })}
                    data-testid={`section-enabled-${section.type}`}
                  />
                  {labels.show}
                </label>
                <label className="flex items-center gap-8 text-sm">
                  <span className="sr-only">
                    {labels.visibility}: {name}
                  </span>
                  <select
                    className="min-h-[44px] rounded-12 border border-sand-border bg-white px-8 dark:bg-charcoal-deep"
                    value={section.visibility}
                    disabled={disabled}
                    onChange={(e) => updateSection(section.type, { visibility: e.target.value as 'public' | 'internal' })}
                  >
                    <option value="public">{labels.public}</option>
                    <option value="internal">{labels.internal}</option>
                  </select>
                </label>
                {isAdmin ? (
                  <label className="flex min-h-[44px] items-center gap-8 text-sm">
                    <input
                      type="checkbox"
                      checked={section.locked}
                      onChange={(e) => updateSection(section.type, { locked: e.target.checked })}
                      data-testid={`section-locked-${section.type}`}
                    />
                    {labels.lock}
                  </label>
                ) : null}
                <span className="flex gap-4">
                  <button
                    type="button"
                    className="min-h-[44px] min-w-[44px] rounded-12 border border-sand-border disabled:opacity-40"
                    onClick={() => move(index, -1)}
                    disabled={disabled || index === 0}
                    aria-label={`${labels.moveUp}: ${name}`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="min-h-[44px] min-w-[44px] rounded-12 border border-sand-border disabled:opacity-40"
                    onClick={() => move(index, 1)}
                    disabled={disabled || index === sections.length - 1}
                    aria-label={`${labels.moveDown}: ${name}`}
                  >
                    ↓
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex flex-wrap items-center gap-12 border-t border-sand-border pt-16">
        <ActionButton
          type="button"
          onClick={() => onSave({ templateId, sections })}
          isLoading={isSaving}
          disabled={!isDirty}
          data-testid="card-save"
        >
          {isSaving ? labels.saving : labels.save}
        </ActionButton>
        {card.status === 'pending_approval' && isAdmin && onApprove ? (
          <ActionButton type="button" variant="secondary" onClick={() => onApprove()} isLoading={isPublishing} data-testid="card-approve">
            {labels.approve}
          </ActionButton>
        ) : (
          <ActionButton
            type="button"
            variant="secondary"
            onClick={() => onPublish()}
            isLoading={isPublishing}
            disabled={isDirty || card.status === 'pending_approval'}
            data-testid="card-publish"
          >
            {needsApproval ? labels.submitForApproval : labels.publish}
          </ActionButton>
        )}
        {isDirty ? <span className="text-sm font-bold text-deep-orange">{labels.unsaved}</span> : null}
      </div>
    </div>
  );
};
