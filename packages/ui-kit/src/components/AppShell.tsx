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
}

export interface AppShellProps {
  companyName: string;
  businessId: string;
  userName: string;
  userRole?: string;
  navItems: NavItem[];
  onNavigate?: (id: string) => void;
  /** Title of the current page, shown in the header. */
  pageTitle?: string;
  /** One-line description under the page title. */
  pageDescription?: string;
  headerActions?: React.ReactNode;
  onSignOut?: () => void;
  /** Overrides the time-of-day greeting (tests). */
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

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** The OneBridge mark: an orange tile carrying a straight span with square end nodes. */
export const SpanMark: React.FC<{ className?: string }> = ({ className }) => (
  <span
    aria-hidden="true"
    className={cn('inline-flex items-center justify-center w-8 h-8 rounded-control bg-bridge-orange shrink-0', className)}
  >
    <span className="flex items-center w-5">
      <span className="w-1 h-1 bg-charcoal" />
      <span className="flex-1 h-[2px] bg-charcoal" />
      <span className="w-1 h-1 bg-charcoal" />
    </span>
  </span>
);

const NavButton: React.FC<{ item: NavItem; onNavigate?: (id: string) => void; variant: 'rail' | 'sheet' }> = ({
  item,
  onNavigate,
  variant,
}) => (
  <button
    type="button"
    onClick={() => onNavigate?.(item.id)}
    aria-current={item.isActive ? 'page' : undefined}
    data-testid={`nav-${item.id}`}
    className={cn(
      'relative w-full flex items-center gap-3 min-h-[44px] px-3 rounded-control text-sm text-left transition-colors duration-150',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bridge-orange',
      item.isActive
        ? 'bg-white/10 text-warm-paper font-bold'
        : 'text-warm-paper/70 font-semibold hover:text-warm-paper hover:bg-white/5'
    )}
  >
    {/* Active marker: a short orange span on the left edge (orange is a fill, never text). */}
    {item.isActive ? (
      <span aria-hidden="true" className={cn('absolute left-0 top-2 bottom-2 w-[3px] bg-bridge-orange', variant === 'sheet' && 'top-3 bottom-3')} />
    ) : null}
    <span className="w-5 h-5 shrink-0 flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5">{item.icon}</span>
    <span className="truncate">{item.label}</span>
  </button>
);

/**
 * AppShell: OneBridge Grid dashboard frame.
 * - Desktop: charcoal left rail (navigation, company name and Business ID at the bottom).
 * - Mobile: charcoal top bar and a bottom bar with up to four destinations plus "More".
 * - Header: greeting by name (never a phone number), page title, user menu with sign out.
 */
export const AppShell: React.FC<AppShellProps> = ({
  companyName,
  businessId,
  userName,
  userRole,
  navItems,
  onNavigate,
  pageTitle,
  pageDescription,
  headerActions,
  onSignOut,
  greeting,
  children,
  className,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuId = useId();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const firstName = userName.trim().split(/\s+/)[0] || userName;

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
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
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

  return (
    <div
      className={cn(
        'min-h-screen md:h-screen flex flex-col md:flex-row bg-warm-paper text-charcoal dark:bg-charcoal-deep dark:text-warm-paper',
        className
      )}
    >
      {/* Desktop left rail */}
      <aside className="hidden md:flex flex-col w-64 bg-charcoal text-warm-paper shrink-0" aria-label="Sidebar">
        <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10">
          <SpanMark />
          <span className="font-bold text-sm">OneBridge Grid</span>
        </div>
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.id}>
                <NavButton item={item} onNavigate={navigate} variant="rail" />
              </li>
            ))}
          </ul>
        </nav>
        <div className="px-5 py-4 border-t border-white/10 space-y-2">
          <div className="text-xs text-warm-paper/60">Company</div>
          <div className="text-sm font-bold text-warm-paper truncate" title={companyName}>
            {companyName}
          </div>
          {businessId ? (
            <div
              className="inline-flex font-mono text-xs text-warm-paper bg-white/10 px-2 py-1 rounded-control select-all"
              aria-label={`Business ID ${businessId}`}
            >
              {businessId}
            </div>
          ) : null}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 h-14 bg-charcoal text-warm-paper">
        <div className="flex items-center gap-2 min-w-0">
          <SpanMark className="w-7 h-7" />
          <span className="font-bold text-sm truncate">{companyName}</span>
        </div>
        {businessId ? (
          <span className="font-mono text-xs text-warm-paper bg-white/10 px-2 py-1 rounded-control shrink-0">{businessId}</span>
        ) : null}
      </header>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 md:overflow-hidden">
        <header className="flex items-center justify-between gap-4 px-4 md:px-8 py-4 border-b border-sand-border dark:border-sand-border/30 bg-warm-paper dark:bg-charcoal-deep shrink-0">
          <div className="min-w-0">
            <p className="text-sm text-charcoal/70 dark:text-warm-paper/70" data-testid="shell-greeting">
              {greeting ?? greetingFor()}, {firstName}
            </p>
            {pageTitle ? (
              <h1 className="text-xl font-bold text-charcoal dark:text-warm-paper truncate">{pageTitle}</h1>
            ) : null}
            {pageDescription ? (
              <p className="hidden sm:block text-sm text-charcoal/70 dark:text-warm-paper/70 truncate">{pageDescription}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                aria-controls={userMenuId}
                onClick={() => setUserMenuOpen((v) => !v)}
                data-testid="user-menu-button"
                className="flex items-center gap-2 min-h-[44px] pl-1 pr-2 rounded-control hover:bg-sand/60 dark:hover:bg-charcoal transition-colors"
              >
                <span className="w-9 h-9 rounded-control bg-charcoal text-warm-paper dark:bg-warm-paper dark:text-charcoal flex items-center justify-center text-sm font-bold">
                  {initialsOf(userName)}
                </span>
                <span className="hidden lg:flex flex-col items-start leading-tight">
                  <span className="text-sm font-bold">{userName}</span>
                  {userRole ? <span className="text-xs text-charcoal/60 dark:text-warm-paper/60">{userRole}</span> : null}
                </span>
                <span className="sr-only">Open user menu</span>
              </button>
              {userMenuOpen ? (
                <div
                  id={userMenuId}
                  role="menu"
                  className="absolute right-0 mt-2 w-64 z-40 rounded-panel border border-sand-border dark:border-sand-border/30 bg-warm-paper dark:bg-charcoal shadow-dropdown p-2"
                >
                  <div className="px-3 py-2">
                    <div className="text-sm font-bold">{userName}</div>
                    <div className="text-xs text-charcoal/60 dark:text-warm-paper/60">
                      {userRole ? `${userRole}, ` : ''}
                      {companyName}
                    </div>
                  </div>
                  <div className="h-px bg-sand-border dark:bg-sand-border/30 my-1" />
                  {onSignOut ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={onSignOut}
                      data-testid="logout-button"
                      className="w-full flex items-center gap-2 min-h-[44px] px-3 rounded-control text-sm font-semibold hover:bg-sand/60 dark:hover:bg-charcoal-deep"
                    >
                      <LogOut className="w-4 h-4" aria-hidden="true" />
                      Sign out
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="flex-1 md:overflow-y-auto px-4 md:px-8 py-6 pb-28 md:pb-8">{children}</main>

        {/* Mobile bottom bar */}
        <nav
          aria-label="Mobile navigation"
          className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-charcoal border-t border-white/10 grid"
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
                'relative flex flex-col items-center justify-center gap-1 min-h-[56px] text-xs font-semibold',
                item.isActive ? 'text-warm-paper' : 'text-warm-paper/60'
              )}
            >
              {item.isActive ? <span aria-hidden="true" className="absolute top-0 inset-x-4 h-[3px] bg-bridge-orange" /> : null}
              <span className="[&>svg]:w-5 [&>svg]:h-5">{item.icon}</span>
              <span className="truncate max-w-full px-1">{item.label}</span>
            </button>
          ))}
          {overflow.length > 0 ? (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 min-h-[56px] text-xs font-semibold',
                overflowActive ? 'text-warm-paper' : 'text-warm-paper/60'
              )}
            >
              {overflowActive ? <span aria-hidden="true" className="absolute top-0 inset-x-4 h-[3px] bg-bridge-orange" /> : null}
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
            className="md:hidden fixed inset-0 z-50 flex items-end bg-charcoal/60"
            onClick={(e) => {
              if (e.target === e.currentTarget) setMoreOpen(false);
            }}
          >
            <div
              className="w-full bg-charcoal text-warm-paper rounded-t-sheet p-4 space-y-1"
              style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="flex items-center justify-between pb-2">
                <span className="text-sm font-bold">More</span>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="w-11 h-11 flex items-center justify-center rounded-control hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
              {overflow.map((item) => (
                <NavButton key={item.id} item={item} onNavigate={navigate} variant="sheet" />
              ))}
              {onSignOut ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full flex items-center gap-3 min-h-[44px] px-3 rounded-control text-sm font-semibold text-warm-paper/70 hover:bg-white/5"
                >
                  <LogOut className="w-5 h-5" aria-hidden="true" />
                  Sign out
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
