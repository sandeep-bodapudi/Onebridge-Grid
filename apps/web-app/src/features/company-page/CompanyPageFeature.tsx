'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { Avatar, Button, Input, PageHeader, Skeleton } from '@onebridge/ui-kit';
import type { ActorSummary, Branch, CardSummary, CompanyProfileSettings, Organization } from '@onebridge/api-contracts';
import { apiClient } from '../../api-client';

export interface CompanyPageFeatureProps {
  tenantId: string;
  organization: Organization | null;
  onOrganizationSaved?: (org: Organization) => void;
}

type Tab = 'profile' | 'catalogue' | 'work' | 'documents' | 'people' | 'followers' | 'search';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'catalogue', label: 'Products and services' },
  { id: 'work', label: 'Work and clients' },
  { id: 'documents', label: 'Documents' },
  { id: 'people', label: 'People and enquiries' },
  { id: 'followers', label: 'Followers' },
  { id: 'search', label: 'Search engines' },
];

const SOCIAL = [
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'youtube', label: 'YouTube' },
] as const;

interface ProfileText {
  about: string;
  website: string;
  socialLinks: Record<string, string>;
}

const panel = 'rounded-[14px] bg-charcoal border border-white/[0.08]';
const label = 'block text-[13px] font-semibold text-warm-paper/80 mb-1';
const textarea =
  'w-full px-3 py-2.5 font-body text-sm rounded-control bg-charcoal text-warm-paper border border-sand-border/30 placeholder:text-warm-paper/40 focus:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange';
const select =
  'w-full min-h-[44px] px-3 font-body text-sm rounded-control bg-charcoal text-warm-paper border border-sand-border/30 focus:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange';

let idCounter = 0;
function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter}`;
}

function profileOf(org: Organization | null): ProfileText {
  return {
    about: org?.about ?? '',
    website: org?.website ?? '',
    socialLinks: Object.fromEntries(Object.entries(org?.socialLinks ?? {}).filter(([, v]) => typeof v === 'string')) as Record<string, string>,
  };
}

const Field: React.FC<{ id: string; text: string; children: React.ReactNode; hint?: string }> = ({ id, text, children, hint }) => (
  <div>
    <label htmlFor={id} className={label}>
      {text}
    </label>
    {children}
    {hint ? <p className="text-xs text-warm-paper/50 mt-1">{hint}</p> : null}
  </div>
);

const RemoveButton: React.FC<{ onClick: () => void; what: string }> = ({ onClick, what }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`Remove ${what}`}
    className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-[10px] text-warm-paper/60 hover:text-warm-paper hover:bg-white/10"
  >
    <Trash2 className="w-4 h-4" aria-hidden="true" />
  </button>
);

const AddButton: React.FC<{ onClick: () => void; children: React.ReactNode; disabled?: boolean }> = ({ onClick, children, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="min-h-[44px] px-4 rounded-[10px] border border-dashed border-white/20 text-sm font-bold text-warm-paper/85 inline-flex items-center gap-2 hover:border-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <Plus className="w-4 h-4" aria-hidden="true" />
    {children}
  </button>
);

/**
 * F26: edits the public company page. Profile text (about, website, social
 * links) is saved on the organization; everything else is the company page
 * settings in the cards service.
 */
export const CompanyPageFeature: React.FC<CompanyPageFeatureProps> = ({ tenantId, organization, onOrganizationSaved }) => {
  const [tab, setTab] = useState<Tab>('profile');
  const [settings, setSettings] = useState<CompanyProfileSettings | null>(null);
  const [savedSettings, setSavedSettings] = useState<string>('');
  const [profile, setProfile] = useState<ProfileText>(profileOf(organization));
  const [savedProfile, setSavedProfile] = useState<string>(JSON.stringify(profileOf(organization)));
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'saved' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.getCompanyProfile(tenantId),
      apiClient.listCardSummaries(tenantId).catch(() => []),
      apiClient.listBranches(tenantId).catch(() => []),
    ])
      .then(([s, c, b]) => {
        if (cancelled) return;
        setSettings(s);
        setSavedSettings(JSON.stringify(s));
        setCards(c);
        setBranches(b.filter((x) => x.status !== 'archived'));
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load the company page');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  useEffect(() => {
    const p = profileOf(organization);
    setProfile(p);
    setSavedProfile(JSON.stringify(p));
  }, [organization]);

  const published = useMemo(() => cards.filter((c) => c.status === 'published'), [cards]);
  const dirty = settings !== null && (JSON.stringify(settings) !== savedSettings || JSON.stringify(profile) !== savedProfile);
  const publicUrl = organization?.slug ? apiClient.publicCompanyUrl(organization.slug) : null;

  const update = (patch: Partial<CompanyProfileSettings>) => {
    setStatus(null);
    setSettings((s) => (s ? { ...s, ...patch } : s));
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setStatus(null);
    try {
      if (JSON.stringify(profile) !== savedProfile && organization) {
        const socialLinks = Object.fromEntries(Object.entries(profile.socialLinks).filter(([, v]) => v.trim()));
        const org = await apiClient.updateOrganization(organization.id, {
          about: profile.about.trim(),
          website: profile.website.trim(),
          socialLinks,
        });
        setSavedProfile(JSON.stringify(profile));
        onOrganizationSaved?.(org);
      }
      if (JSON.stringify(settings) !== savedSettings) {
        const saved = await apiClient.updateCompanyProfile(settings, tenantId);
        setSettings(saved);
        setSavedSettings(JSON.stringify(saved));
      }
      setStatus({ kind: 'saved', text: 'Saved. The public page updates within a minute.' });
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save the company page' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (loadError || !settings) {
    return (
      <div role="alert" className={`${panel} p-5 flex items-start gap-3`}>
        <AlertTriangle className="w-5 h-5 text-error shrink-0" aria-hidden="true" />
        <p className="text-sm">{loadError || 'Could not load the company page'}</p>
      </div>
    );
  }

  const maxProducts = settings.limits?.maxProducts ?? null;
  const atLimit = maxProducts !== null && settings.products.length >= maxProducts;
  const isFreePlan = (organization?.plan as string | undefined) === 'free';
  const planName = isFreePlan ? 'the free profile' : 'Starter';
  const shownSeats = new Set(settings.directory.seatIds);

  return (
    <div data-testid="company-page-feature">
      <PageHeader
        className="mb-6"
        title="Company page"
        subtitle={
          publicUrl ? (
            <>
              Your public page at <span className="font-mono text-warm-paper/80">{publicUrl.replace(/^https?:\/\//, '')}</span>. Branch standee codes open it with that branch first.
            </>
          ) : (
            'Your public company page.'
          )
        }
        actions={
          <>
            {publicUrl ? (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-4 rounded-[10px] border border-white/15 text-sm font-bold inline-flex items-center gap-2 hover:bg-white/10"
              >
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
                View public page
              </a>
            ) : null}
            <Button onClick={save} disabled={!dirty || saving} data-testid="company-page-save">
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        }
      />

      {status ? (
        <div
          role={status.kind === 'error' ? 'alert' : 'status'}
          className={`mb-4 px-4 py-3 rounded-[12px] text-sm flex items-center gap-2 ${
            status.kind === 'error' ? 'bg-error/15 border border-error/40' : 'bg-white/[0.06] border border-white/10'
          }`}
        >
          {status.kind === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-error shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          )}
          {status.text}
        </div>
      ) : null}

      <div role="tablist" aria-label="Company page sections" className="flex gap-1 overflow-x-auto mb-5 border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`cp-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={tab === t.id ? `cp-panel-${t.id}` : undefined}
            onClick={() => setTab(t.id)}
            className={`shrink-0 min-h-[44px] px-3 text-sm font-bold border-b-2 -mb-px ${
              tab === t.id ? 'border-bridge-orange text-warm-paper' : 'border-transparent text-warm-paper/60 hover:text-warm-paper'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`cp-panel-${tab}`} aria-labelledby={`cp-tab-${tab}`} className="space-y-4">
        {tab === 'profile' ? (
          <section className={`${panel} p-5 space-y-4`}>
            <Field id="cp-about" text="About the company" hint="Shown at the top of the page and in search results. Up to 600 characters.">
              <textarea
                id="cp-about"
                rows={4}
                maxLength={600}
                className={textarea}
                value={profile.about}
                onChange={(e) => setProfile({ ...profile, about: e.target.value })}
              />
            </Field>
            <Field id="cp-website" text="Website">
              <Input id="cp-website" type="url" placeholder="https://" value={profile.website} onChange={(e) => setProfile({ ...profile, website: e.target.value })} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              {SOCIAL.map((s) => (
                <Field key={s.key} id={`cp-social-${s.key}`} text={s.label}>
                  <Input
                    id={`cp-social-${s.key}`}
                    type="url"
                    placeholder="https://"
                    value={profile.socialLinks[s.key] ?? ''}
                    onChange={(e) => setProfile({ ...profile, socialLinks: { ...profile.socialLinks, [s.key]: e.target.value } })}
                  />
                </Field>
              ))}
            </div>
            <p className="text-xs text-warm-paper/50">Name, logo and colours come from the brand kit. Branches come from Branches and teams.</p>
          </section>
        ) : null}

        {tab === 'catalogue' ? (
          <>
            <section className={`${panel} p-5`} aria-labelledby="cp-products-title">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 id="cp-products-title" className="text-base font-bold">
                  Products
                </h2>
                <span data-testid="catalogue-limit" className={`text-xs font-bold rounded-full px-2.5 py-1 ${atLimit ? 'bg-bridge-orange text-[#241A10]' : 'bg-white/10 text-warm-paper/80'}`}>
                  {maxProducts === null ? `${settings.products.length} items · unlimited` : `${settings.products.length} of ${maxProducts} on ${planName}`}
                </span>
              </div>
              <ul className="space-y-3">
                {settings.products.map((p, i) => {
                  const set = (patch: Partial<typeof p>) => update({ products: settings.products.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                  return (
                    <li key={p.id} className="rounded-xl bg-charcoal-deep border border-white/[0.08] p-4 space-y-3">
                      <div className="flex gap-3 items-end">
                        <div className="flex-1 grid sm:grid-cols-[2fr_1fr] gap-3">
                          <Field id={`p-name-${p.id}`} text="Name">
                            <Input id={`p-name-${p.id}`} value={p.name} onChange={(e) => set({ name: e.target.value })} />
                          </Field>
                          <Field id={`p-cat-${p.id}`} text="Category">
                            <Input id={`p-cat-${p.id}`} value={p.category ?? ''} onChange={(e) => set({ category: e.target.value || undefined })} />
                          </Field>
                        </div>
                        <RemoveButton onClick={() => update({ products: settings.products.filter((_, j) => j !== i) })} what={p.name || 'product'} />
                      </div>
                      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
                        <Field id={`p-price-${p.id}`} text="Price">
                          <Input
                            id={`p-price-${p.id}`}
                            placeholder="₹54,000 / MT"
                            disabled={p.priceOnRequest}
                            value={p.priceOnRequest ? '' : p.price ?? ''}
                            onChange={(e) => set({ price: e.target.value || undefined })}
                          />
                        </Field>
                        <label className="min-h-[44px] inline-flex items-center gap-2 text-sm">
                          <input type="checkbox" className="w-5 h-5 accent-bridge-orange" checked={Boolean(p.priceOnRequest)} onChange={(e) => set({ priceOnRequest: e.target.checked || undefined })} />
                          Price on request
                        </label>
                      </div>
                      <Field id={`p-desc-${p.id}`} text="Description">
                        <textarea id={`p-desc-${p.id}`} rows={2} maxLength={500} className={textarea} value={p.description ?? ''} onChange={(e) => set({ description: e.target.value || undefined })} />
                      </Field>
                      <Field id={`p-img-${p.id}`} text="Image link">
                        <Input id={`p-img-${p.id}`} type="url" placeholder="https://" value={p.imageUrl ?? ''} onChange={(e) => set({ imageUrl: e.target.value || undefined })} />
                      </Field>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <AddButton disabled={atLimit} onClick={() => update({ products: [...settings.products, { id: newId('p'), name: '' }] })}>
                  Add product
                </AddButton>
                {atLimit ? <span className="text-xs text-warm-paper/60">{isFreePlan ? `The free profile includes ${maxProducts} items. Starter allows 50.` : `Starter includes ${maxProducts} items. Business has no limit.`}</span> : null}
              </div>
            </section>

            <section className={`${panel} p-5`} aria-labelledby="cp-services-title">
              <h2 id="cp-services-title" className="text-base font-bold mb-4">
                Services
              </h2>
              <ul className="space-y-3">
                {settings.services.map((s, i) => {
                  const set = (patch: Partial<typeof s>) => update({ services: settings.services.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                  return (
                    <li key={s.id} className="flex gap-3 items-end">
                      <div className="flex-1 grid sm:grid-cols-[1fr_2fr] gap-3">
                        <Field id={`s-name-${s.id}`} text="Service">
                          <Input id={`s-name-${s.id}`} value={s.name} onChange={(e) => set({ name: e.target.value })} />
                        </Field>
                        <Field id={`s-desc-${s.id}`} text="Short description">
                          <Input id={`s-desc-${s.id}`} value={s.description ?? ''} onChange={(e) => set({ description: e.target.value || undefined })} />
                        </Field>
                      </div>
                      <RemoveButton onClick={() => update({ services: settings.services.filter((_, j) => j !== i) })} what={s.name || 'service'} />
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4">
                <AddButton onClick={() => update({ services: [...settings.services, { id: newId('s'), name: '' }] })}>Add service</AddButton>
              </div>
            </section>
          </>
        ) : null}

        {tab === 'work' ? (
          <>
            <section className={`${panel} p-5`} aria-labelledby="cp-work-title">
              <h2 id="cp-work-title" className="text-base font-bold mb-4">
                Projects
              </h2>
              <ul className="space-y-3">
                {settings.portfolio.map((w, i) => {
                  const set = (patch: Partial<typeof w>) => update({ portfolio: settings.portfolio.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                  return (
                    <li key={w.id} className="rounded-xl bg-charcoal-deep border border-white/[0.08] p-4 space-y-3">
                      <div className="flex gap-3 items-end">
                        <div className="flex-1 grid sm:grid-cols-2 gap-3">
                          <Field id={`w-title-${w.id}`} text="Project">
                            <Input id={`w-title-${w.id}`} value={w.title} onChange={(e) => set({ title: e.target.value })} />
                          </Field>
                          <Field id={`w-client-${w.id}`} text="Client">
                            <Input id={`w-client-${w.id}`} value={w.client ?? ''} onChange={(e) => set({ client: e.target.value || undefined })} />
                          </Field>
                        </div>
                        <RemoveButton onClick={() => update({ portfolio: settings.portfolio.filter((_, j) => j !== i) })} what={w.title || 'project'} />
                      </div>
                      <Field id={`w-desc-${w.id}`} text="Description">
                        <textarea id={`w-desc-${w.id}`} rows={2} maxLength={800} className={textarea} value={w.description ?? ''} onChange={(e) => set({ description: e.target.value || undefined })} />
                      </Field>
                      <Field id={`w-video-${w.id}`} text="Video link" hint="YouTube or Vimeo. It loads only when a visitor taps play.">
                        <Input id={`w-video-${w.id}`} type="url" placeholder="https://youtu.be/…" value={w.videoUrl ?? ''} onChange={(e) => set({ videoUrl: e.target.value || undefined })} />
                      </Field>
                      <Field id={`w-images-${w.id}`} text="Image links" hint="One link per line, up to 8.">
                        <textarea
                          id={`w-images-${w.id}`}
                          rows={2}
                          className={textarea}
                          value={(w.imageUrls ?? []).join('\n')}
                          onChange={(e) => {
                            const urls = e.target.value.split('\n').map((u) => u.trim()).filter(Boolean).slice(0, 8);
                            set({ imageUrls: urls.length ? urls : undefined });
                          }}
                        />
                      </Field>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4">
                <AddButton onClick={() => update({ portfolio: [...settings.portfolio, { id: newId('w'), title: '' }] })}>Add project</AddButton>
              </div>
            </section>

            <section className={`${panel} p-5`} aria-labelledby="cp-clients-title">
              <h2 id="cp-clients-title" className="text-base font-bold mb-4">
                Clients
              </h2>
              <ul className="space-y-3">
                {settings.clientLogos.map((c, i) => {
                  const set = (patch: Partial<typeof c>) => update({ clientLogos: settings.clientLogos.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                  return (
                    <li key={c.id} className="flex gap-3 items-end">
                      <div className="flex-1 grid sm:grid-cols-2 gap-3">
                        <Field id={`c-name-${c.id}`} text="Client">
                          <Input id={`c-name-${c.id}`} value={c.name} onChange={(e) => set({ name: e.target.value })} />
                        </Field>
                        <Field id={`c-logo-${c.id}`} text="Logo link (optional)">
                          <Input id={`c-logo-${c.id}`} type="url" placeholder="https://" value={c.imageUrl ?? ''} onChange={(e) => set({ imageUrl: e.target.value || undefined })} />
                        </Field>
                      </div>
                      <RemoveButton onClick={() => update({ clientLogos: settings.clientLogos.filter((_, j) => j !== i) })} what={c.name || 'client'} />
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4">
                <AddButton onClick={() => update({ clientLogos: [...settings.clientLogos, { id: newId('c'), name: '' }] })}>Add client</AddButton>
              </div>
            </section>
          </>
        ) : null}

        {tab === 'documents' ? (
          <section className={`${panel} p-5`} aria-labelledby="cp-docs-title">
            <h2 id="cp-docs-title" className="text-base font-bold mb-1">
              Documents
            </h2>
            <p className="text-sm text-warm-paper/60 mb-4">Brochures, price lists and certificates. PDF only, up to 25 MB. Downloads are counted.</p>
            <ul className="space-y-3">
              {settings.documents.map((d, i) => {
                const set = (patch: Partial<typeof d>) => update({ documents: settings.documents.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                return (
                  <li key={d.id} className="flex gap-3 items-end">
                    <div className="flex-1 grid sm:grid-cols-[1fr_2fr_110px] gap-3">
                      <Field id={`d-title-${d.id}`} text="Title">
                        <Input id={`d-title-${d.id}`} value={d.title} onChange={(e) => set({ title: e.target.value })} />
                      </Field>
                      <Field id={`d-url-${d.id}`} text="PDF link">
                        <Input id={`d-url-${d.id}`} type="url" placeholder="https://…/brochure.pdf" value={d.url} onChange={(e) => set({ url: e.target.value })} />
                      </Field>
                      <Field id={`d-size-${d.id}`} text="Size (MB)">
                        <Input
                          id={`d-size-${d.id}`}
                          type="number"
                          min={0}
                          max={25}
                          step={0.1}
                          value={d.sizeBytes ? Math.round((d.sizeBytes / (1024 * 1024)) * 10) / 10 : ''}
                          onChange={(e) => set({ sizeBytes: e.target.value ? Math.round(Number(e.target.value) * 1024 * 1024) : undefined })}
                        />
                      </Field>
                    </div>
                    <RemoveButton onClick={() => update({ documents: settings.documents.filter((_, j) => j !== i) })} what={d.title || 'document'} />
                  </li>
                );
              })}
            </ul>
            <div className="mt-4">
              <AddButton onClick={() => update({ documents: [...settings.documents, { id: newId('d'), title: '', url: '' }] })}>Add document</AddButton>
            </div>
          </section>
        ) : null}

        {tab === 'people' ? (
          <>
            <section className={`${panel} p-5`} aria-labelledby="cp-people-title">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="cp-people-title" className="text-base font-bold">
                    People on the page
                  </h2>
                  <p className="text-sm text-warm-paper/60 mt-0.5">Visitors can open each person’s card. Only published cards appear.</p>
                </div>
                <label className="min-h-[44px] inline-flex items-center gap-2 text-sm font-semibold shrink-0">
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-bridge-orange"
                    checked={settings.directory.enabled}
                    onChange={(e) => update({ directory: { ...settings.directory, enabled: e.target.checked } })}
                  />
                  Show people
                </label>
              </div>
              {settings.directory.enabled ? (
                published.length === 0 ? (
                  <p className="text-sm text-warm-paper/60 mt-4">No published cards yet. Publish a card in the card studio.</p>
                ) : (
                  <fieldset className="mt-4">
                    <legend className="text-[13px] font-semibold text-warm-paper/80 mb-2">
                      {shownSeats.size === 0 ? 'Everyone with a published card is shown. Tick people to show only them.' : `${shownSeats.size} of ${published.length} shown`}
                    </legend>
                    <ul className="grid sm:grid-cols-2 gap-2">
                      {published.map((c) => {
                        const seatId = c.seatId || c.id;
                        return (
                          <li key={c.id}>
                            <label className="min-h-[52px] flex items-center gap-3 px-3 rounded-xl bg-charcoal-deep border border-white/[0.08] text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                className="w-5 h-5 accent-bridge-orange"
                                checked={shownSeats.has(seatId)}
                                onChange={(e) => {
                                  const next = new Set(shownSeats);
                                  if (e.target.checked) next.add(seatId);
                                  else next.delete(seatId);
                                  update({ directory: { ...settings.directory, seatIds: Array.from(next) } });
                                }}
                              />
                              <span className="min-w-0">
                                <span className="block font-semibold truncate">{c.name || 'Unnamed card'}</span>
                                <span className="block text-xs text-warm-paper/55 truncate">{c.designation}</span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </fieldset>
                )
              ) : null}
            </section>

            <section className={`${panel} p-5 space-y-4`} aria-labelledby="cp-routing-title">
              <div>
                <h2 id="cp-routing-title" className="text-base font-bold">
                  Who gets enquiries
                </h2>
                <p className="text-sm text-warm-paper/60 mt-0.5">Enquiries become leads on this person’s card. They stay with the seat if the person moves on.</p>
              </div>
              <Field id="cp-default-contact" text="General enquiries">
                <select
                  id="cp-default-contact"
                  className={select}
                  value={settings.enquiryRouting.defaultSeatId ?? ''}
                  onChange={(e) => update({ enquiryRouting: { ...settings.enquiryRouting, defaultSeatId: e.target.value || undefined } })}
                >
                  <option value="">First published card</option>
                  {published.map((c) => (
                    <option key={c.id} value={c.seatId || c.id}>
                      {c.name || 'Unnamed card'}
                    </option>
                  ))}
                </select>
              </Field>
              {branches.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {branches.map((b) => (
                    <Field key={b.id} id={`cp-branch-${b.id}`} text={`${b.name} branch`}>
                      <select
                        id={`cp-branch-${b.id}`}
                        className={select}
                        value={settings.enquiryRouting.branchSeats[b.id] ?? ''}
                        onChange={(e) => {
                          const branchSeats = { ...settings.enquiryRouting.branchSeats };
                          if (e.target.value) branchSeats[b.id] = e.target.value;
                          else delete branchSeats[b.id];
                          update({ enquiryRouting: { ...settings.enquiryRouting, branchSeats } });
                        }}
                      >
                        <option value="">Same as general enquiries</option>
                        {published.map((c) => (
                          <option key={c.id} value={c.seatId || c.id}>
                            {c.name || 'Unnamed card'}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ))}
                </div>
              ) : null}
            </section>
          </>
        ) : null}

        {tab === 'followers' ? <FollowersPanel tenantId={tenantId} /> : null}

        {tab === 'search' ? (
          <section className={`${panel} p-5`} aria-labelledby="cp-seo-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="cp-seo-title" className="text-base font-bold">
                  Let search engines list this page
                </h2>
                <p className="text-sm text-warm-paper/60 mt-0.5 max-w-[60ch]">
                  When on, Google and others can show your company page, products and branches in search results. Turn it off to share the page only by link
                  and QR code.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 min-h-[44px]">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  aria-label="Let search engines list this page"
                  checked={settings.seoIndexable}
                  onChange={(e) => update({ seoIndexable: e.target.checked })}
                />
                <span className="w-11 h-6 rounded-full bg-white/20 peer-checked:bg-bridge-orange transition-colors after:content-[''] after:absolute after:top-1/2 after:-translate-y-1/2 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5 motion-reduce:after:transition-none" />
              </label>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
};

/** N04: who follows the company (Owner and Admins). Follower contact details are never shown. */
const FollowersPanel: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const [state, setState] = useState<{ items: ActorSummary[]; total: number; next?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    apiClient
      .listCompanyFollowers(tenantId)
      .then((page) => setState({ items: page.items, total: page.total ?? page.items.length, next: page.nextCursor }))
      .catch((err: Error) => setError(err.message));
  }, [tenantId]);

  const loadMore = async () => {
    if (!state?.next) return;
    setMore(true);
    try {
      const page = await apiClient.listCompanyFollowers(tenantId, state.next);
      setState({ items: [...state.items, ...page.items], total: state.total, next: page.nextCursor });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load more.');
    } finally {
      setMore(false);
    }
  };

  return (
    <section className={`${panel} p-5`} aria-labelledby="cp-followers-title">
      <h2 id="cp-followers-title" className="text-base font-bold">
        {state ? `${state.total.toLocaleString('en-IN')} follower${state.total === 1 ? '' : 's'}` : 'Followers'}
      </h2>
      <p className="text-sm text-warm-paper/60 mt-0.5">People and companies who follow your page see your updates. Their phone numbers and emails are not shared.</p>
      {error ? (
        <p role="alert" className="mt-3 text-sm px-3 py-2.5 rounded-[10px] bg-error/15 border border-error/40">
          {error}
        </p>
      ) : null}
      {!state && !error ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : null}
      {state && state.items.length === 0 ? <p className="mt-4 text-sm text-warm-paper/70">No followers yet. Share your company page link or QR standee to get your first.</p> : null}
      {state && state.items.length ? (
        <ul className="mt-4 grid sm:grid-cols-2 gap-2">
          {state.items.map((a) => (
            <li key={`${a.type}-${a.id}`} className="rounded-xl bg-charcoal-deep border border-white/[0.08] p-3 flex items-center gap-3">
              <Avatar name={a.name} />
              <a href={a.type === 'company' ? `/network/company/${a.handle}` : `/network/in/${a.handle}`} className="min-w-0">
                <span className="block font-semibold truncate">{a.name}</span>
                <span className="block text-xs text-warm-paper/55 truncate">
                  {a.type === 'company' ? 'Company' : 'Member'}
                  {a.headline ? ` · ${a.headline}` : ''}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {state?.next ? (
        <div className="mt-4">
          <Button variant="secondary" isLoading={more} onClick={loadMore}>
            Show more
          </Button>
        </div>
      ) : null}
    </section>
  );
};
