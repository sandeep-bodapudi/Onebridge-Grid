'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, CheckCircle2, Circle, ExternalLink, EyeOff, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Input, PageHeader, Skeleton } from '@onebridge/ui-kit';
import type { MyProfile, ProfileUpdate, WorkHistoryEntry } from '@onebridge/api-contracts';
import { apiClient } from '../../api-client';

/** Must match MEMBER_NOTICE_VERSION in services/profiles (N01). */
export const MEMBER_NOTICE_VERSION = 'member-notice-2026-10';

const panel = 'rounded-[14px] bg-charcoal border border-white/[0.08]';
const labelCls = 'block text-[13px] font-semibold text-warm-paper/80 mb-1';
const textareaCls =
  'w-full px-3 py-2.5 font-body text-sm rounded-control bg-charcoal text-warm-paper border border-sand-border/30 placeholder:text-warm-paper/40 focus:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange';

const COMPLETENESS_LABEL: Record<string, string> = {
  photo: 'Add a photo',
  headline: 'Write a headline',
  city: 'Add your city',
  about: 'Say a little about yourself',
  skill: 'Add at least one skill',
};

const monthYear = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });

type Draft = {
  name: string;
  handle: string;
  headline: string;
  city: string;
  about: string;
  photoUrl: string;
  coverUrl: string;
  skills: string;
  languages: string;
  visibility: 'everyone' | 'members';
  indexable: boolean;
};

const toDraft = (p: MyProfile): Draft => ({
  name: p.name,
  handle: p.handle,
  headline: p.headline ?? '',
  city: p.city ?? '',
  about: p.about ?? '',
  photoUrl: p.photoUrl ?? '',
  coverUrl: p.coverUrl ?? '',
  skills: (p.skills ?? []).join(', '),
  languages: (p.languages ?? []).join(', '),
  visibility: p.visibility,
  indexable: p.indexable,
});

const splitList = (value: string) => value.split(',').map((s) => s.trim()).filter(Boolean);

const Field: React.FC<{ id: string; label: string; hint?: string; children: React.ReactNode }> = ({ id, label, hint, children }) => (
  <div>
    <label htmlFor={id} className={labelCls}>
      {label}
    </label>
    {children}
    {hint ? <p className="text-xs text-warm-paper/50 mt-1">{hint}</p> : null}
  </div>
);

export interface ProfileFeatureProps {
  /** Name from the sign-in account, to start the create form. */
  suggestedName?: string;
}

/**
 * N01: create and edit my member profile. Contact details are not part of a
 * profile (D-CONTACT); people reach members through chat and call requests.
 */
export const ProfileFeature: React.FC<ProfileFeatureProps> = ({ suggestedName }) => {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getMyProfile()
      .then(setProfile)
      .catch((err: Error & { code?: string }) => {
        if (err.code === 'profile_missing') setMissing(true);
        else setLoadError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (loadError) {
    return (
      <p role="alert" className={`${panel} p-5 flex items-center gap-2 text-sm`}>
        <AlertTriangle className="w-4 h-4 text-error" aria-hidden="true" />
        {loadError}
      </p>
    );
  }
  if (missing || !profile) {
    return (
      <CreateProfile
        suggestedName={suggestedName}
        onCreated={(p) => {
          setProfile(p);
          setMissing(false);
        }}
      />
    );
  }
  return <EditProfile profile={profile} onChange={setProfile} />;
};

const CreateProfile: React.FC<{ suggestedName?: string; onCreated: (p: MyProfile) => void }> = ({ suggestedName, onCreated }) => {
  const [name, setName] = useState(suggestedName ?? '');
  const [headline, setHeadline] = useState('');
  const [city, setCity] = useState('');
  const [adult, setAdult] = useState(false);
  const [notice, setNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Enter your name.');
    if (!adult) return setError('You must be 18 or older to join.');
    if (!notice) return setError('Accept the member privacy notice to continue.');
    setBusy(true);
    try {
      onCreated(
        await apiClient.saveMyProfile({
          name: name.trim(),
          headline: headline.trim() || undefined,
          city: city.trim() || undefined,
          ageConfirmed: true,
          noticeVersion: MEMBER_NOTICE_VERSION,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl" data-testid="profile-create">
      <PageHeader className="mb-6" title="Create your profile" subtitle="Show who you are and where you have worked. Your phone number and email are never shown." />
      <form onSubmit={submit} noValidate className={`${panel} p-5 sm:p-6 space-y-4`}>
        <Field id="p-name" label="Your name">
          <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <Field id="p-headline" label="Headline" hint="For example: Sales executive, structural steel">
          <Input id="p-headline" value={headline} maxLength={120} onChange={(e) => setHeadline(e.target.value)} />
        </Field>
        <Field id="p-city" label="City">
          <Input id="p-city" value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
        </Field>
        <div className="rounded-[12px] bg-charcoal-deep border border-white/[0.08] p-4 text-sm text-warm-paper/80 space-y-2">
          <p className="font-semibold text-warm-paper">Member privacy notice</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your profile belongs to you. You can download or delete it at any time.</li>
            <li>We never show your phone number or email. People reach you by chat or a call request, as your settings allow.</li>
            <li>Roles verified by a company come from that company. You can hide them but not change them.</li>
            <li>Search engines only list your profile if you turn that on.</li>
          </ul>
        </div>
        <label className="flex items-start gap-3 text-sm min-h-[44px] cursor-pointer">
          <input type="checkbox" className="mt-0.5 w-5 h-5 shrink-0 accent-bridge-orange" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
          I am 18 or older.
        </label>
        <label className="flex items-start gap-3 text-sm min-h-[44px] cursor-pointer">
          <input type="checkbox" className="mt-0.5 w-5 h-5 shrink-0 accent-bridge-orange" checked={notice} onChange={(e) => setNotice(e.target.checked)} />
          I accept the member privacy notice.
        </label>
        {error ? (
          <p role="alert" className="text-sm px-3 py-2.5 rounded-[10px] bg-error/15 border border-error/40">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" isFullWidth isLoading={busy}>
          Create profile
        </Button>
      </form>
    </div>
  );
};

const EditProfile: React.FC<{ profile: MyProfile; onChange: (p: MyProfile) => void }> = ({ profile, onChange }) => {
  const [draft, setDraft] = useState<Draft>(toDraft(profile));
  const [saved, setSaved] = useState<string>(JSON.stringify(toDraft(profile)));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const dirty = JSON.stringify(draft) !== saved;
  const set = (patch: Partial<Draft>) => {
    setStatus(null);
    setDraft((d) => ({ ...d, ...patch }));
  };

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const update: ProfileUpdate = {
        name: draft.name,
        handle: draft.handle,
        headline: draft.headline,
        city: draft.city,
        about: draft.about,
        photoUrl: draft.photoUrl || undefined,
        coverUrl: draft.coverUrl || undefined,
        skills: splitList(draft.skills),
        languages: splitList(draft.languages),
      };
      const next = await apiClient.saveMyProfile({ ...update, visibility: draft.visibility, indexable: draft.visibility === 'everyone' && draft.indexable });
      onChange(next);
      setDraft(toDraft(next));
      setSaved(JSON.stringify(toDraft(next)));
      setStatus({ kind: 'ok', text: 'Saved.' });
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save your profile.' });
    } finally {
      setBusy(false);
    }
  };

  const publicUrl = apiClient.publicMemberUrl(profile.handle);
  const pct = Math.round((profile.completeness.done / 5) * 100);

  return (
    <div data-testid="profile-edit">
      <PageHeader
        className="mb-6"
        title="My profile"
        subtitle="Your professional identity on OneBridge Grid. It belongs to you, not your company."
        actions={
          <>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-4 rounded-[10px] border border-white/15 text-sm font-bold inline-flex items-center gap-2 hover:bg-white/10"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              View my profile
            </a>
            <Button onClick={save} disabled={!dirty || busy} isLoading={busy} data-testid="profile-save">
              Save changes
            </Button>
          </>
        }
      />

      {status ? (
        <p
          role={status.kind === 'error' ? 'alert' : 'status'}
          className={`mb-4 px-4 py-3 rounded-[12px] text-sm ${status.kind === 'error' ? 'bg-error/15 border border-error/40' : 'bg-white/[0.06] border border-white/10'}`}
        >
          {status.text}
        </p>
      ) : null}

      <div className="grid lg:grid-cols-[1fr_300px] gap-5 items-start">
        <div className="space-y-5">
          <section className={`${panel} p-5 space-y-4`} aria-labelledby="basics-title">
            <h2 id="basics-title" className="text-base font-bold">
              About you
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field id="e-name" label="Name">
                <Input id="e-name" value={draft.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} />
              </Field>
              <Field id="e-city" label="City">
                <Input id="e-city" value={draft.city} maxLength={60} onChange={(e) => set({ city: e.target.value })} />
              </Field>
            </div>
            <Field id="e-headline" label="Headline">
              <Input id="e-headline" value={draft.headline} maxLength={120} onChange={(e) => set({ headline: e.target.value })} />
            </Field>
            <Field id="e-about" label="About" hint={`${draft.about.length} of 2,000 characters`}>
              <textarea id="e-about" rows={5} maxLength={2000} className={textareaCls} value={draft.about} onChange={(e) => set({ about: e.target.value })} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field id="e-photo" label="Photo link" hint="An https link to a square image.">
                <Input id="e-photo" type="url" placeholder="https://" value={draft.photoUrl} onChange={(e) => set({ photoUrl: e.target.value })} />
              </Field>
              <Field id="e-cover" label="Cover image link">
                <Input id="e-cover" type="url" placeholder="https://" value={draft.coverUrl} onChange={(e) => set({ coverUrl: e.target.value })} />
              </Field>
            </div>
            <Field id="e-skills" label="Skills" hint="Separate with commas. Up to 30.">
              <Input id="e-skills" value={draft.skills} onChange={(e) => set({ skills: e.target.value })} />
            </Field>
            <Field id="e-languages" label="Languages" hint="For example: English, Hindi, Telugu">
              <Input id="e-languages" value={draft.languages} onChange={(e) => set({ languages: e.target.value })} />
            </Field>
          </section>

          <WorkHistory profile={profile} onChange={onChange} />

          <section className={`${panel} p-5 space-y-4`} aria-labelledby="visibility-title">
            <h2 id="visibility-title" className="text-base font-bold">
              Address and visibility
            </h2>
            <Field id="e-handle" label="Profile address" hint="Lowercase letters, numbers and hyphens. Your old address keeps working.">
              <div className="flex items-center gap-2">
                <span className="text-sm text-warm-paper/60 shrink-0">/in/</span>
                <Input id="e-handle" value={draft.handle} maxLength={40} onChange={(e) => set({ handle: e.target.value.toLowerCase() })} />
              </div>
            </Field>
            <fieldset>
              <legend className={labelCls}>Who can see your profile</legend>
              <div className="grid sm:grid-cols-2 gap-2">
                {(
                  [
                    ['members', 'Signed-in members', 'People who use OneBridge Grid'],
                    ['everyone', 'Everyone', 'Anyone with the link'],
                  ] as const
                ).map(([value, title, desc]) => (
                  <label
                    key={value}
                    className={`min-h-[56px] flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${draft.visibility === value ? 'border-bridge-orange bg-white/[0.04]' : 'border-white/10'}`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      className="mt-1 accent-bridge-orange"
                      checked={draft.visibility === value}
                      onChange={() => set({ visibility: value, indexable: value === 'everyone' ? draft.indexable : false })}
                    />
                    <span>
                      <span className="block text-sm font-semibold">{title}</span>
                      <span className="block text-xs text-warm-paper/55">{desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className={`flex items-start gap-3 text-sm min-h-[44px] ${draft.visibility === 'everyone' ? 'cursor-pointer' : 'opacity-50'}`}>
              <input
                type="checkbox"
                className="mt-0.5 w-5 h-5 shrink-0 accent-bridge-orange"
                disabled={draft.visibility !== 'everyone'}
                checked={draft.visibility === 'everyone' && draft.indexable}
                onChange={(e) => set({ indexable: e.target.checked })}
              />
              <span>
                Let search engines list my profile
                <span className="block text-xs text-warm-paper/55">Only when everyone can see it. Off by default.</span>
              </span>
            </label>
          </section>
        </div>

        <aside className={`${panel} p-5 lg:sticky lg:top-6`} aria-labelledby="complete-title">
          <h2 id="complete-title" className="text-base font-bold">
            Profile {pct}% complete
          </h2>
          <div className="h-2 rounded-full bg-white/10 mt-3 overflow-hidden" aria-hidden="true">
            <div className="h-full bg-bridge-orange rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {(['photo', 'headline', 'city', 'about', 'skill'] as const).map((key) => {
              const done = !profile.completeness.missing.includes(key);
              return (
                <li key={key} className={`flex items-center gap-2 ${done ? 'text-warm-paper/50' : ''}`}>
                  {done ? <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" /> : <Circle className="w-4 h-4 shrink-0" aria-hidden="true" />}
                  <span className={done ? 'line-through' : ''}>{COMPLETENESS_LABEL[key]}</span>
                  <span className="sr-only">{done ? '(done)' : '(to do)'}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-warm-paper/50 mt-4">Only you see this checklist.</p>
        </aside>
      </div>
    </div>
  );
};

const WorkHistory: React.FC<{ profile: MyProfile; onChange: (p: MyProfile) => void }> = ({ profile, onChange }) => {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ companyName: '', title: '', startDate: '', endDate: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => onChange(await apiClient.getMyProfile());
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (w: WorkHistoryEntry) => {
    setEditing(w.id);
    setAdding(false);
    setForm({ companyName: w.companyName, title: w.title, startDate: w.startDate, endDate: w.endDate ?? '' });
  };

  const entryForm = (onSubmit: () => void, submitLabel: string) => (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="rounded-xl bg-charcoal-deep border border-white/[0.08] p-4 space-y-3"
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <Field id="w-company" label="Company">
          <Input id="w-company" value={form.companyName} maxLength={120} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
        </Field>
        <Field id="w-title" label="Role">
          <Input id="w-title" value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field id="w-start" label="Started">
          <Input id="w-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </Field>
        <Field id="w-end" label="Ended" hint="Leave empty if you still work there.">
          <Input id="w-end" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" isLoading={busy}>
          {submitLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setAdding(false);
            setEditing(null);
            setError(null);
          }}
          className="border border-white/15"
        >
          Cancel
        </Button>
      </div>
    </form>
  );

  const entries = useMemo(() => profile.workHistory, [profile.workHistory]);

  return (
    <section className={`${panel} p-5`} aria-labelledby="experience-title">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id="experience-title" className="text-base font-bold">
          Experience
        </h2>
        {!adding ? (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setEditing(null);
              setForm({ companyName: '', title: '', startDate: '', endDate: '' });
            }}
            className="min-h-[44px] px-3 rounded-[10px] border border-dashed border-white/20 text-sm font-bold inline-flex items-center gap-1.5 hover:border-white/40"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add a past role
          </button>
        ) : null}
      </div>
      <p className="text-xs text-warm-paper/55 mb-3">Roles at companies on OneBridge Grid are added and verified automatically when you claim your card. Roles you add yourself show as “Not verified”.</p>
      {error ? (
        <p role="alert" className="mb-3 text-sm px-3 py-2.5 rounded-[10px] bg-error/15 border border-error/40">
          {error}
        </p>
      ) : null}
      {adding ? <div className="mb-3">{entryForm(() => run(() => apiClient.addWorkHistory({ ...form, endDate: form.endDate || undefined })).then((ok) => ok && setAdding(false)), 'Add role')}</div> : null}
      {entries.length === 0 && !adding ? <p className="text-sm text-warm-paper/60">No experience yet.</p> : null}
      <ul className="space-y-2">
        {entries.map((w) =>
          editing === w.id ? (
            <li key={w.id}>{entryForm(() => run(() => apiClient.updateWorkHistory(w.id, { ...form, endDate: form.endDate || undefined })).then((ok) => ok && setEditing(null)), 'Save role')}</li>
          ) : (
            <li key={w.id} className={`flex items-start gap-3 p-3 rounded-xl bg-charcoal-deep border border-white/[0.08] ${w.hidden ? 'opacity-60' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{w.title}</p>
                <p className="text-sm text-warm-paper/70">{w.companyName}</p>
                <p className="text-xs text-warm-paper/50 mt-0.5">
                  {monthYear(w.startDate)} – {w.endDate ? monthYear(w.endDate) : 'Present'}
                  {w.hidden ? ' · Hidden from your profile' : ''}
                </p>
                {w.verified ? (
                  <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold rounded px-1.5 py-0.5 bg-bridge-orange text-[#241A10]">
                    <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    Verified
                  </span>
                ) : (
                  <span className="mt-1.5 inline-flex text-[11px] font-semibold rounded px-1.5 py-0.5 bg-white/10">Not verified</span>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => run(() => apiClient.updateWorkHistory(w.id, { hidden: !w.hidden }))}
                  aria-label={w.hidden ? `Show ${w.title} on my profile` : `Hide ${w.title} from my profile`}
                  className="w-11 h-11 inline-flex items-center justify-center rounded-[10px] text-warm-paper/70 hover:bg-white/10"
                >
                  {w.hidden ? <Eye className="w-4 h-4" aria-hidden="true" /> : <EyeOff className="w-4 h-4" aria-hidden="true" />}
                </button>
                {!w.verified ? (
                  <>
                    <button type="button" onClick={() => startEdit(w)} aria-label={`Edit ${w.title}`} className="w-11 h-11 inline-flex items-center justify-center rounded-[10px] text-warm-paper/70 hover:bg-white/10">
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => run(() => apiClient.deleteWorkHistory(w.id))}
                      aria-label={`Delete ${w.title}`}
                      className="w-11 h-11 inline-flex items-center justify-center rounded-[10px] text-warm-paper/70 hover:bg-white/10"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          )
        )}
      </ul>
    </section>
  );
};
