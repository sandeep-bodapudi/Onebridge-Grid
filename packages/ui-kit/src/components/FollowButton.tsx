import React from 'react';
import { Check, Plus } from 'lucide-react';

export interface FollowButtonProps {
  following: boolean;
  /** Shown next to the button, e.g. "1,240 followers" (Indian number formatting). */
  followerCount?: number;
  /** Toggle handler (signed in). */
  onToggle?: () => void;
  /** Link instead of a toggle, e.g. to sign in (public pages). */
  href?: string;
  busy?: boolean;
  /** "band": on a dark or brand-coloured hero; "plain": on a light page. */
  tone?: 'band' | 'plain';
  /** Name of what is followed, for the accessible label. */
  targetName: string;
}

export function formatFollowers(count: number): string {
  return `${count.toLocaleString('en-IN')} follower${count === 1 ? '' : 's'}`;
}

/** N04: follow or unfollow a member or company. Status is shown by word and icon, not colour alone. */
export const FollowButton: React.FC<FollowButtonProps> = ({ following, followerCount, onToggle, href, busy, tone = 'plain', targetName }) => {
  const base = 'min-h-[48px] px-5 rounded-[14px] text-sm font-extrabold inline-flex items-center gap-2 disabled:opacity-60';
  const style = following
    ? tone === 'band'
      ? 'bg-white/10 border border-white/30 hover:bg-white/20'
      : 'bg-white border border-sand-border text-charcoal hover:bg-sand'
    : 'bg-bridge-orange text-[#241A10] hover:bg-[#E5790C]';
  const content = (
    <>
      {following ? <Check className="w-4 h-4" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
      {following ? 'Following' : 'Follow'}
    </>
  );
  return (
    <span className="inline-flex items-center gap-3">
      {href ? (
        <a href={href} className={`${base} ${style}`} aria-label={`Follow ${targetName}`}>
          {content}
        </a>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          aria-pressed={following}
          aria-label={following ? `Unfollow ${targetName}` : `Follow ${targetName}`}
          className={`${base} ${style}`}
          data-testid="follow-button"
        >
          {content}
        </button>
      )}
      {typeof followerCount === 'number' ? (
        <span className={`text-sm font-semibold ${tone === 'band' ? 'opacity-85' : 'text-charcoal/70'}`} data-testid="follower-count">
          {formatFollowers(followerCount)}
        </span>
      ) : null}
    </span>
  );
};
