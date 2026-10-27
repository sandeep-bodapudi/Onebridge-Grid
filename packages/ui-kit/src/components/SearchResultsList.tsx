import React from 'react';
import { BadgeCheck, Building2, MapPin, SearchX, UserRound } from 'lucide-react';
import { avatarColour, initialsOf } from './AppShell';

export interface SearchResultItem {
  actor: { type: 'company' | 'member'; id: string; handle?: string; name: string; headline?: string; photoUrl?: string; verified: boolean };
  city?: string;
  snippet?: string;
  featured: boolean;
}

export interface SearchResultsListProps {
  items: SearchResultItem[];
  /** Link for a result (public site and app use different routes). */
  hrefFor: (item: SearchResultItem) => string;
  total?: number;
  /** Shown when nothing matched. */
  emptyHint?: string;
  className?: string;
}

/**
 * N03: search and directory results. Never shows contact details; paid
 * placement is always labelled "Featured".
 */
export const SearchResultsList: React.FC<SearchResultsListProps> = ({ items, hrefFor, total, emptyHint, className }) => {
  if (items.length === 0) {
    return (
      <div className={`rounded-2xl bg-white border border-sand-border p-8 text-center text-charcoal ${className ?? ''}`} data-testid="search-empty">
        <span className="mx-auto w-12 h-12 rounded-xl bg-sand flex items-center justify-center">
          <SearchX className="w-6 h-6" aria-hidden="true" />
        </span>
        <p className="mt-3 font-bold">No matches</p>
        <p className="mt-1 text-sm text-charcoal/70">{emptyHint ?? 'Try fewer words, or remove a filter.'}</p>
      </div>
    );
  }
  return (
    <div className={className}>
      {typeof total === 'number' ? (
        <p className="text-sm text-charcoal/65 mb-3" role="status">
          {total.toLocaleString('en-IN')} result{total === 1 ? '' : 's'}
        </p>
      ) : null}
      <ul className="space-y-2">
        {items.map((item) => {
          const a = item.actor;
          return (
            <li key={`${a.type}-${a.id}`}>
              <a
                href={hrefFor(item)}
                className="flex items-start gap-3.5 rounded-2xl bg-white border border-sand-border p-4 text-charcoal hover:border-charcoal/30 min-h-[72px]"
              >
                <span
                  className={`w-12 h-12 shrink-0 overflow-hidden flex items-center justify-center text-sm font-extrabold text-[#241A10] ${a.type === 'company' ? 'rounded-xl bg-white border border-sand-border' : 'rounded-full'}`}
                  style={a.photoUrl || a.type === 'company' ? undefined : { background: avatarColour(a.name) }}
                >
                  {a.photoUrl ? <img src={a.photoUrl} alt="" className="w-full h-full object-contain" /> : <span aria-hidden="true">{initialsOf(a.name)}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-bold leading-snug">{a.name}</span>
                    {a.verified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold rounded px-1.5 py-0.5 bg-bridge-orange text-[#241A10]">
                        <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        Verified
                      </span>
                    ) : null}
                    {item.featured ? <span className="text-[11px] font-bold rounded px-1.5 py-0.5 bg-sand">Featured</span> : null}
                  </span>
                  {a.headline ? <span className="block text-sm text-charcoal/75 mt-0.5 truncate">{a.headline}</span> : null}
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-charcoal/60">
                    <span className="inline-flex items-center gap-1">
                      {a.type === 'company' ? <Building2 className="w-3.5 h-3.5" aria-hidden="true" /> : <UserRound className="w-3.5 h-3.5" aria-hidden="true" />}
                      {a.type === 'company' ? 'Company' : 'Person'}
                    </span>
                    {item.city ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                        {item.city}
                      </span>
                    ) : null}
                    {item.snippet ? <span className="truncate">Matches: {item.snippet}</span> : null}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
