import React, { useEffect, useId, useRef, useState } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import { cn } from './ActionButton';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: React.ReactNode;
  isActive?: boolean;
  /** Shown in the mobile bottom bar (at most 4 items); the rest go under "More". */
  primary?: boolean;
  /** Small orange count, e.g. new leads. */
  badge?: number;
}

export interface AppShellProps {
  companyName: string;
  businessId: string;
  userName: string;
  userRole?: string;
  navItems: NavItem[];
  onNavigate?: (id: string) => void;
  onSignOut?: () => void;
  /** Extra links in the user menu, above "Sign out" (for example "My profile"). */
  userMenuItems?: Array<{ id: string; label: string; href: string; icon?: React.ReactNode }>;
  /** Kept for compatibility; pages render their own header with PageHeader. */
  pageTitle?: string;
  pageDescription?: string;
  headerActions?: React.ReactNode;
  greeting?: string;
  children: React.ReactNode;
  className?: string;
}

export function greetingFor(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Warm, readable avatar colours (dark text on all of them), picked from the name so a person keeps theirs. */
const AVATAR_COLOURS = ['#F6B26B', '#8FB4DE', '#A7D7B8', '#D9B8F2', '#F2C6A0', '#B8D4F2', '#F2E2A0', '#E8B4B8'];
export function avatarColour(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}

export const Avatar: React.FC<{ name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }> = ({ name, size = 'md', className }) => (
  <span
    aria-hidden="true"
    className={cn(
      'inline-flex items-center justify-center shrink-0 font-bold text-[#241A10]',
      size === 'sm' && 'w-8 h-8 rounded-lg text-xs',
      size === 'md' && 'w-9 h-9 rounded-[10px] text-xs',
      size === 'lg' && 'w-11 h-11 rounded-xl text-sm',
      size === 'xl' && 'w-14 h-14 rounded-2xl text-base',
      className
    )}
    style={{ backgroundColor: name.trim() ? avatarColour(name) : '#CFC6BA' }}
  >
    {name.trim() ? initialsOf(name) : '—'}
  </span>
);

/** The OneBridge mark: an orange tile carrying a straight span with square end nodes. */
export const SpanMark: React.FC<{ className?: string }> = ({ className }) => (
  <span aria-hidden="true" className={cn('inline-flex items-center justify-center w-8 h-8 rounded-lg bg-bridge-orange shrink-0', className)}>
    <span className="flex items-center w-[18px]">
      <span className="w-1 h-1 bg-[#241A10]" />
      <span className="flex-1 h-[2px] bg-[#241A10]" />
      <span className="w-1 h-1 bg-[#241A10]" />
    </span>
  </span>
);

/** Page title row: large title, one line of context, actions on the right. */
export const PageHeader: React.FC<{
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, actions, className }) => (
  <div className={cn('flex flex-col sm:flex-row sm:items-end justify-between gap-4', className)}>
    <div className="min-w-0">
      <h1 className="text-2xl md:text-[28px] md:leading-9 font-bold tracking-tight text-warm-paper">{title}</h1>
      {subtitle ? <p className="text-sm text-warm-paper/60 mt-1">{subtitle}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
  </div>
);

const NavButton: React.FC<{ item: NavItem; onNavigate?: (id: string) => void }> = ({ item, onNavigate }) => (
  <button
    type="button"
    onClick={() => onNavigate?.(item.id)}
    aria-current={item.isActive ? 'page' : undefined}
    data-testid={`nav-${item.id}`}
    className={cn(
      'w-full flex items-center gap-3 min-h-[42px] px-3 rounded-[10px] text-sm text-left transition-colors duration-150',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bridge-orange',
      item.isActive
        ? 'bg-[#393536] text-warm-paper font-bold shadow-[inset_3px_0_0_#F68713]'
        : 'text-warm-paper/60 font-semibold hover:text-warm-paper hover:bg-white/5'
    )}
  >
    <span className="w-[18px] h-[18px] shrink-0 flex items-center justify-center [&>svg]:w-[18px] [&>svg]:h-[18px]">{item.icon}</span>
    <span className="truncate">{item.label}</span>
    {item.badge ? (
      <span className="ml-auto text-xs font-bold bg-bridge-orange text-[#241A10] rounded-md px-[7px] py-px tabular-nums">
        <span className="sr-only">, </span>
        {item.badge}
        <span className="sr-only"> new</span>
      </span>
    ) : null}
  </button>
);

/**
 * AppShell: the charcoal-led dashboard frame (D-UI-PREMIUM).
 * - Desktop: dark rail with the company and Business ID at the top, sections with count badges, you at the bottom.
 * - Mobile: top bar with the company, bottom bar with up to four sections plus "More".
 * Pages render their own header with PageHeader.
 */
export const AppShell: React.FC<AppShellProps> = ({
  companyName,
  businessId,
  userName,
  userRole,
  navItems,
  onNavigate,
  onSignOut,
  userMenuItems,
  children,
  className,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuId = useId();
  const railMenuRef = useRef<HTMLDivElement>(null);
  const topMenuRef = useRef<HTMLDivElement>(null);

  const primary = navItems.filter((n) => n.primary).slice(0, 4);
  const bottomItems = primary.length > 0 ? primary : navItems.slice(0, 4);
  const overflow = navItems.filter((n) => !bottomItems.includes(n));
  const overflowActive = overflow.some((n) => n.isActive);

  useEffect(() => {
    if (!userMenuOpen && !moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
        setMoreOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!railMenuRef.current?.contains(target) && !topMenuRef.current?.contains(target)) setUserMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [userMenuOpen, moreOpen]);

  const navigate = (id: string) => {
    setMoreOpen(false);
    onNavigate?.(id);
  };

  const userMenu = (placement: 'rail' | 'top') => (
    <div className="relative" ref={placement === 'rail' ? railMenuRef : topMenuRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={userMenuOpen}
        aria-controls={userMenuId}
        onClick={() => setUserMenuOpen((v) => !v)}
        data-testid={placement === 'rail' ? 'user-menu-button' : 'user-menu-button-mobile'}
        className={cn(
          'flex items-center gap-3 rounded-[10px] text-left transition-colors hover:bg-white/5',
          placement === 'rail' ? 'w-full p-2' : 'p-1'
        )}
      >
        <Avatar name={userName} />
        {placement === 'rail' ? (
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-semibold text-warm-paper truncate">{userName}</span>
            {userRole ? <span className="block text-xs text-warm-paper/50">{userRole}</span> : null}
          </span>
        ) : null}
        <span className="sr-only">Open user menu</span>
      </button>
      {userMenuOpen ? (
        <div
          id={userMenuId}
          role="menu"
          className={cn(
            'absolute z-40 w-60 rounded-xl border border-white/10 bg-[#272425] shadow-overlay p-2',
            placement === 'rail' ? 'left-0 bottom-full mb-2' : 'right-0 top-full mt-2'
          )}
        >
          <div className="px-3 py-2">
            <div className="text-sm font-bold text-warm-paper">{userName}</div>
            <div className="text-xs text-warm-paper/50">
              {userRole ? `${userRole}, ` : ''}
              {companyName}
            </div>
          </div>
          <div className="h-px bg-white/10 my-1" />
          {userMenuItems?.map((item) => (
            <a
              key={item.id}
              href={item.href}
              role="menuitem"
              data-testid={`user-menu-${item.id}`}
              className="w-full flex items-center gap-2 min-h-[44px] px-3 rounded-lg text-sm font-semibold text-warm-paper hover:bg-white/5"
            >
              {item.icon}
              {item.label}
            </a>
          ))}
          {onSignOut ? (
            <button
              type="button"
              role="menuitem"
              onClick={onSignOut}
              data-testid="logout-button"
              className="w-full flex items-center gap-2 min-h-[44px] px-3 rounded-lg text-sm font-semibold text-warm-paper hover:bg-white/5"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              Sign out
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={cn('min-h-screen md:h-screen flex flex-col md:flex-row bg-charcoal-deep text-warm-paper', className)}>
      {/* Desktop rail */}
      <aside className="hidden md:flex flex-col w-60 bg-[#191717] border-r border-white/[0.08] shrink-0 px-3.5 py-5 gap-5" aria-label="Sidebar">
        <div className="flex items-center gap-2.5 px-1.5 font-bold tracking-tight">
          <SpanMark />
          OneBridge Grid
        </div>
        <div className="rounded-xl bg-[#272425] border border-white/[0.08] px-3 py-3">
          <div className="text-sm font-bold text-warm-paper truncate" title={companyName}>
            {companyName}
          </div>
          {businessId ? (
            <div className="font-mono text-xs text-warm-paper/60 mt-0.5 select-all" aria-label={`Business ID ${businessId}`}>
              {businessId}
            </div>
          ) : null}
        </div>
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto">
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.id}>
                <NavButton item={item} onNavigate={navigate} />
              </li>
            ))}
          </ul>
        </nav>
        {userMenu('rail')}
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 h-14 bg-[#191717] border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5 min-w-0">
          <SpanMark className="w-7 h-7" />
          <span className="font-bold text-sm truncate">{companyName}</span>
        </div>
        {userMenu('top')}
      </header>

      {/* Page */}
      <main className="flex-1 min-w-0 md:overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-6 md:pt-8 pb-28 md:pb-10">{children}</div>
      </main>

      {/* Mobile bottom bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#191717] border-t border-white/10 grid"
        style={{
          gridTemplateColumns: `repeat(${bottomItems.length + (overflow.length > 0 ? 1 : 0)}, minmax(0, 1fr))`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {bottomItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.id)}
            aria-current={item.isActive ? 'page' : undefined}
            className={cn(
              'relative flex flex-col items-center justify-center gap-1 min-h-[58px] text-xs font-semibold',
              item.isActive ? 'text-warm-paper' : 'text-warm-paper/50'
            )}
          >
            {item.isActive ? <span aria-hidden="true" className="absolute top-0 inset-x-5 h-[3px] bg-bridge-orange" /> : null}
            <span className="relative [&>svg]:w-5 [&>svg]:h-5">
              {item.icon}
              {item.badge ? (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded bg-bridge-orange text-[#241A10] text-[11px] leading-4 font-bold text-center">
                  {item.badge}
                </span>
              ) : null}
            </span>
            <span className="truncate max-w-full px-1">{item.label}</span>
          </button>
        ))}
        {overflow.length > 0 ? (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            className={cn(
              'relative flex flex-col items-center justify-center gap-1 min-h-[58px] text-xs font-semibold',
              overflowActive ? 'text-warm-paper' : 'text-warm-paper/50'
            )}
          >
            {overflowActive ? <span aria-hidden="true" className="absolute top-0 inset-x-5 h-[3px] bg-bridge-orange" /> : null}
            <Menu className="w-5 h-5" aria-hidden="true" />
            <span>More</span>
          </button>
        ) : null}
      </nav>

      {moreOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="More sections"
          className="md:hidden fixed inset-0 z-50 flex items-end bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMoreOpen(false);
          }}
        >
          <div className="w-full bg-[#191717] rounded-t-sheet p-4 space-y-1" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex items-center justify-between pb-2">
              <span className="text-sm font-bold">More</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-white/10"
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            {overflow.map((item) => (
              <NavButton key={item.id} item={item} onNavigate={navigate} />
            ))}
            {onSignOut ? (
              <button
                type="button"
                onClick={onSignOut}
                className="w-full flex items-center gap-3 min-h-[44px] px-3 rounded-[10px] text-sm font-semibold text-warm-paper/60 hover:bg-white/5"
              >
                <LogOut className="w-[18px] h-[18px]" aria-hidden="true" />
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};
