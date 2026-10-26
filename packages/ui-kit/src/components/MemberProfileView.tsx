import React from 'react';
import { BadgeCheck, Briefcase, Languages, MapPin } from 'lucide-react';
import { avatarColour, initialsOf } from './AppShell';

export interface MemberWorkEntry {
  id: string;
  verified: boolean;
  companyName: string;
  companySlug?: string;
  title: string;
  startDate: string;
  endDate?: string;
}

export interface MemberProfileData {
  handle: string;
  name: string;
  headline?: string;
  photoUrl?: string;
  coverUrl?: string;
  city?: string;
  about?: string;
  skills?: string[];
  languages?: string[];
  workHistory: MemberWorkEntry[];
}

export interface MemberProfileViewProps {
  profile: MemberProfileData;
  /** Link to a company page, from its slug (the public site's /<slug>). */
  companyHref?: (slug: string) => string;
  /** Buttons such as Follow, Message, Request a call (N04, N08, N11). */
  actions?: React.ReactNode;
  className?: string;
}

const monthYear = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });

function duration(start: string, end?: string): string {
  const s = new Date(`${start}T00:00:00Z`);
  const e = end ? new Date(`${end}T00:00:00Z`) : new Date();
  const months = Math.max(1, (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()) + 1);
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} yr${y > 1 ? 's' : ''}` : '', m ? `${m} mo${m > 1 ? 's' : ''}` : ''].filter(Boolean).join(' ');
}

const sectionTitle = 'text-[13px] font-extrabold uppercase tracking-[0.04em] text-charcoal/60 mb-3';
const surface = 'rounded-2xl bg-white border border-sand-border';

/**
 * N01: a member's public profile. Never shows phone or email (D-CONTACT);
 * contact happens through the actions slot (chat and call requests).
 */
export const MemberProfileView: React.FC<MemberProfileViewProps> = ({ profile, companyHref, actions, className }) => {
  const current = profile.workHistory.find((w) => !w.endDate);
  return (
    <div className={`w-full bg-warm-paper text-charcoal font-body ${className ?? ''}`}>
      <div
        className="h-32 sm:h-44 bg-charcoal bg-cover bg-center"
        style={profile.coverUrl ? { backgroundImage: `url(${profile.coverUrl})` } : undefined}
        aria-hidden="true"
      />
      <div className="max-w-[760px] mx-auto px-4 sm:px-5 pb-16">
        <header className={`${surface} -mt-14 p-5 sm:p-6 relative`}>
          <div
            className="w-24 h-24 rounded-[24px] border-4 border-white -mt-16 overflow-hidden flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.15)]"
            style={{ background: profile.photoUrl ? '#fff' : avatarColour(profile.name) }}
          >
            {profile.photoUrl ? (
              <img src={profile.photoUrl} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-extrabold text-[#241A10]" aria-hidden="true">
                {initialsOf(profile.name)}
              </span>
            )}
          </div>
          <h1 className="mt-3 text-[26px] sm:text-[30px] font-bold tracking-[-0.03em] leading-tight break-words">{profile.name}</h1>
          {profile.headline ? <p className="mt-1 text-[15px] text-charcoal/80">{profile.headline}</p> : null}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-charcoal/70">
            {current ? (
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="w-4 h-4" aria-hidden="true" />
                {current.title}, {current.companyName}
              </span>
            ) : null}
            {profile.city ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4" aria-hidden="true" />
                {profile.city}
              </span>
            ) : null}
          </div>
          {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
        </header>

        {profile.about ? (
          <section aria-labelledby="about-title" className="mt-6">
            <h2 id="about-title" className={sectionTitle}>
              About
            </h2>
            <p className={`${surface} p-5 text-[15px] leading-relaxed whitespace-pre-line`}>{profile.about}</p>
          </section>
        ) : null}

        <section aria-labelledby="experience-title" className="mt-6">
          <h2 id="experience-title" className={sectionTitle}>
            Experience
          </h2>
          {profile.workHistory.length ? (
            <ul className={`${surface} divide-y divide-sand-border`}>
              {profile.workHistory.map((w) => {
                const company =
                  w.companySlug && companyHref ? (
                    <a href={companyHref(w.companySlug)} className="font-semibold underline-offset-2 hover:underline">
                      {w.companyName}
                    </a>
                  ) : (
                    <span className="font-semibold">{w.companyName}</span>
                  );
                return (
                  <li key={w.id} className="p-4 sm:p-5 flex gap-3.5">
                    <span className="w-11 h-11 rounded-xl bg-sand flex items-center justify-center shrink-0 text-sm font-extrabold" aria-hidden="true">
                      {initialsOf(w.companyName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold leading-snug">{w.title}</h3>
                      <p className="text-sm mt-0.5">{company}</p>
                      <p className="text-xs text-charcoal/60 mt-1">
                        {monthYear(w.startDate)} – {w.endDate ? monthYear(w.endDate) : 'Present'} · {duration(w.startDate, w.endDate)}
                      </p>
                      {w.verified ? (
                        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold rounded px-1.5 py-0.5 bg-bridge-orange text-[#241A10]">
                          <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" />
                          Verified by {w.companyName}
                        </span>
                      ) : (
                        <span className="mt-2 inline-flex text-[11px] font-semibold rounded px-1.5 py-0.5 bg-sand text-charcoal/70">Not verified</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={`${surface} p-5 text-sm text-charcoal/70`}>No experience added yet.</p>
          )}
        </section>

        {profile.skills && profile.skills.length ? (
          <section aria-labelledby="skills-title" className="mt-6">
            <h2 id="skills-title" className={sectionTitle}>
              Skills
            </h2>
            <ul className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <li key={skill} className="px-3 py-1.5 rounded-full bg-white border border-sand-border text-sm font-semibold">
                  {skill}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {profile.languages && profile.languages.length ? (
          <section aria-labelledby="languages-title" className="mt-6">
            <h2 id="languages-title" className={sectionTitle}>
              Languages
            </h2>
            <p className="inline-flex items-center gap-2 text-sm">
              <Languages className="w-4 h-4" aria-hidden="true" />
              {profile.languages.join(' · ')}
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
};
