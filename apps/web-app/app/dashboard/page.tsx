'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CircleUser, CreditCard, FileClock, Globe, Inbox, LayoutGrid, MessageSquare, Palette, Users } from 'lucide-react';
import { AppShell, Button, SpanMark, type NavItem } from '@onebridge/ui-kit';
import type { BrandKit, Organization } from '@onebridge/api-contracts';
import { apiClient } from '../../src/api-client';
import { OrgStructureFeature } from '../../src/features/structure';
import { SeatsFeature } from '../../src/features/seats';
import { BrandKitFeature } from '../../src/features/brand-kit';
import { AuditLogFeature } from '../../src/features/audit-log';
import { CardsFeature } from '../../src/features/cards';
import { QrFeature } from '../../src/features/qr-codes';
import { OverviewFeature } from '../../src/features/overview';
import { LeadsFeature } from '../../src/features/leads';
import { CompanyPageFeature } from '../../src/features/company-page';
import { AccessRequestsPanel, RequestAccessForm } from '../../src/features/access-requests';
import { OnboardingFlow, enOnboardingLabels, type OnboardingFormData } from '../../src/features/onboarding';

export interface UserProfile {
  person?: {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
  };
  activeTenant?: {
    tenantId?: string;
    id?: string;
    role?: string;
    businessId?: string;
    plan?: 'starter' | 'business' | 'enterprise';
  };
}

type Section = 'overview' | 'cards' | 'seats' | 'leads' | 'company' | 'structure' | 'brand' | 'audit';

const SECTION_META: Record<Section, { title: string; description: string }> = {
  overview: { title: 'Overview', description: 'How your cards are doing and what to do next.' },
  cards: { title: 'Card studio', description: 'Edit each person’s card, publish it and get its QR code.' },
  seats: { title: 'People', description: 'Seats, the people in them and their cards.' },
  leads: { title: 'Leads', description: 'Visitors who shared their details.' },
  company: { title: 'Company page', description: 'Your public page: catalogue, work, people and enquiries.' },
  structure: { title: 'Branches and teams', description: 'Locations, departments and teams.' },
  brand: { title: 'Brand kit', description: 'Logo, colours and what employees can change.' },
  audit: { title: 'Audit log', description: 'Every change admins made.' },
};

const SECTIONS = Object.keys(SECTION_META) as Section[];

function sectionFromHash(): Section {
  if (typeof window === 'undefined') return 'overview';
  const hash = window.location.hash.replace('#', '') as Section;
  return SECTIONS.includes(hash) ? hash : 'overview';
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [ownCardName, setOwnCardName] = useState<string>('');
  const [recentLeads, setRecentLeads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>('overview');
  const [cardSeatId, setCardSeatId] = useState<string | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [takenGstin, setTakenGstin] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    // Access token lives in memory only; after a reload, restore it from the
    // httpOnly refresh cookie instead of sending the user back to sign in.
    if (!apiClient.getAccessToken()) {
      await apiClient.silentRefresh();
    }
    const me = (await apiClient.getMe()) as UserProfile;
    const tenantId = me.activeTenant?.tenantId || me.activeTenant?.id || '';
    apiClient.setActiveTenantId(tenantId || null);
    setProfile(me);
    if (tenantId) {
      const [organization, kit, seats, cards] = await Promise.all([
        apiClient.getOrganization(tenantId).catch(() => null),
        apiClient.getBrandKit(tenantId).catch(() => null),
        apiClient.listSeats(tenantId, { limit: 100 }).catch(() => null),
        apiClient.listCardSummaries(tenantId).catch(() => []),
      ]);
      setOrg(organization);
      setBrandKit(kit);
      // Sign-in is by phone, so the person record may have no name: use the name on their own card.
      const ownSeat = seats?.items?.find((s) => s.personId && s.personId === me.person?.id);
      setOwnCardName(cards.find((c) => (c.seatId || c.id) === ownSeat?.id)?.name || '');
      apiClient
        .getOverviewStats(tenantId)
        .then((s) => setRecentLeads(s.period?.leads ?? 0))
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    setSection(sectionFromHash());
    const onHash = () => setSection(sectionFromHash());
    window.addEventListener('hashchange', onHash);
    loadProfile()
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
    return () => window.removeEventListener('hashchange', onHash);
  }, [loadProfile, router]);

  const navigate = useCallback((next: Section) => {
    setSection(next);
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `#${next}`);
  }, []);

  const handleLogout = async () => {
    await apiClient.logout();
    router.push('/login');
  };

  /** F06 onboarding: create the company, then the owner's own seat and first card. */
  const handleOnboardingComplete = async (data: OnboardingFormData) => {
    setOnboardingBusy(true);
    setOnboardingError(null);
    try {
      const created = await apiClient.createOrganization({
        name: data.name,
        industry: data.industry,
        size: data.size,
        city: data.city,
        gstin: data.gstin || undefined,
        slug: data.slug || undefined,
        plan: data.plan,
      });
      apiClient.setActiveTenantId(created.id);
      if (data.plan === 'free') {
        // N02: a free company profile has no seats or employee cards; the owner goes straight to the company page.
        window.history.replaceState(null, '', '#company');
        await loadProfile();
        return;
      }
      const seat = await apiClient.createSeat(created.id, {
        title: data.firstCardRole || 'Owner',
        personId: profile?.person?.id,
      });
      // The cards service creates the draft card from seat.created; fill in the owner's details.
      const card = await apiClient.getCard(seat.id, created.id);
      await apiClient.updateCard(
        card.id,
        {
          sections: card.sections.map((s) =>
            s.type === 'about'
              ? { ...s, content: { ...s.content, name: data.firstCardName, designation: data.firstCardRole, phone: profile?.person?.phone } }
              : s
          ),
        },
        created.id
      );
      await loadProfile();
    } catch (err) {
      if ((err as { code?: string }).code === 'gstin_taken' && data.gstin) {
        setTakenGstin(data.gstin.trim().toUpperCase());
        return;
      }
      setOnboardingError(err instanceof Error ? err.message : 'Could not create your company. Try again.');
    } finally {
      setOnboardingBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-warm-paper dark:bg-charcoal-deep p-6" aria-busy="true">
        <div className="flex flex-col items-center gap-3">
          <SpanMark />
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">Loading your dashboard...</p>
        </div>
      </main>
    );
  }

  if (!profile) return null;

  const activeOrgId = profile.activeTenant?.tenantId || profile.activeTenant?.id || '';
  const role = profile.activeTenant?.role;
  const isAdmin = role === 'owner' || role === 'admin';
  const plan = (org?.plan as 'free' | 'starter' | 'business' | undefined) || profile.activeTenant?.plan || 'starter';
  const businessId = org?.businessId || profile.activeTenant?.businessId || '';
  const companyName = org?.name || 'Your company';
  // Greeting uses the person's name, never their phone number.
  const displayName = profile.person?.name?.trim() || ownCardName || 'there';
  const roleDisplay = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Member';
  const leadsEnabled = isAdmin && apiClient.leadsPanelEnabled();

  if (!activeOrgId) {
    return (
      <main className="min-h-screen bg-warm-paper dark:bg-charcoal-deep" data-testid="dashboard-onboarding">
        <header className="flex items-center justify-between px-4 md:px-8 h-16 border-b border-sand-border dark:border-sand-border/30">
          <div className="flex items-center gap-3">
            <SpanMark />
            <span className="font-bold text-sm">OneBridge Grid</span>
          </div>
          <Button variant="ghost" data-testid="logout-button" onClick={handleLogout}>
            Sign out
          </Button>
        </header>
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
          <a
            href="/profile"
            data-testid="member-only-link"
            className="mb-6 flex items-center justify-between gap-4 rounded-[14px] border border-white/10 bg-charcoal p-4 hover:border-white/25"
          >
            <span>
              <span className="block font-bold text-warm-paper">Joining as a professional, not a company?</span>
              <span className="block text-sm text-warm-paper/60">Create your personal profile. You can add a company later.</span>
            </span>
            <CircleUser className="w-6 h-6 shrink-0 text-warm-paper/70" aria-hidden="true" />
          </a>
          {takenGstin ? (
            <RequestAccessForm gstin={takenGstin} suggestedName={profile.person?.name} onBack={() => setTakenGstin(null)} />
          ) : (
            <OnboardingFlow labels={enOnboardingLabels} isLoading={onboardingBusy} error={onboardingError} onComplete={handleOnboardingComplete} />
          )}
        </div>
      </main>
    );
  }

  const isFree = plan === 'free';
  // Seats and structure use Starter's limits for a free profile (one branch; seats are not offered).
  const paidPlan = plan === 'free' ? 'starter' : plan;
  // N02: a free company profile has no seats or cards, so only the company page and settings apply.
  const visible: Section[] = isFree
    ? isAdmin
      ? ['company', 'structure', 'brand', 'audit']
      : ['company']
    : isAdmin
      ? (['overview', 'cards', 'seats', ...(leadsEnabled ? (['leads'] as Section[]) : []), 'company', 'structure', 'brand', 'audit'] as Section[])
      : ['overview', 'cards'];
  const current = visible.includes(section) ? section : visible[0];

  const icons: Record<Section, React.ReactNode> = {
    overview: <LayoutGrid aria-hidden="true" />,
    cards: <CreditCard aria-hidden="true" />,
    seats: <Users aria-hidden="true" />,
    leads: <Inbox aria-hidden="true" />,
    company: <Globe aria-hidden="true" />,
    structure: <Building2 aria-hidden="true" />,
    brand: <Palette aria-hidden="true" />,
    audit: <FileClock aria-hidden="true" />,
  };
  const primary: Section[] = isFree ? ['company', 'structure', 'brand'] : leadsEnabled ? ['overview', 'cards', 'seats', 'leads'] : ['overview', 'cards', 'seats'];
  const navItems: NavItem[] = visible.map((id) => ({
    id,
    label: SECTION_META[id].title,
    href: `#${id}`,
    icon: icons[id] as NavItem['icon'],
    isActive: current === id,
    primary: primary.includes(id),
    badge: id === 'leads' && recentLeads > 0 ? recentLeads : undefined,
  }));

  const brandColours = brandKit?.brandColours;

  return (
    <AppShell
      companyName={companyName}
      businessId={businessId}
      userName={displayName}
      userRole={roleDisplay}
      navItems={navItems}
      onNavigate={(id) => navigate(id as Section)}
      onSignOut={handleLogout}
      userMenuItems={[
        { id: 'messages', label: 'Messages', href: '/messages?inbox=company', icon: <MessageSquare className="w-4 h-4" aria-hidden="true" /> },
        { id: 'profile', label: 'My profile', href: '/profile', icon: <CircleUser className="w-4 h-4" aria-hidden="true" /> },
      ]}
    >
      <div data-testid="dashboard-container">
        {/* Stable hooks for end-to-end tests; hidden from everyone (no IDs reach screen readers). */}
        <div hidden>
          <span data-testid="welcome-header">Welcome, {displayName}</span>
          <span data-testid="active-role">Your role: {role}</span>
        </div>

        {role === 'owner' ? <AccessRequestsPanel tenantId={activeOrgId} /> : null}

        {current === 'overview' ? (
          <OverviewFeature
            tenantId={activeOrgId}
            isAdmin={isAdmin}
            companyName={companyName}
            firstName={displayName.split(/\s+/)[0]}
            selfPersonId={profile.person?.id}
            selfName={profile.person?.name || ownCardName}
            onNavigate={(next) => navigate(next)}
            onEditCard={(seatId) => {
              setCardSeatId(seatId);
              navigate('cards');
            }}
          />
        ) : null}

        {current === 'cards' ? (
          <CardsFeature
            tenantId={activeOrgId}
            userRole={role}
            personId={profile.person?.id}
            initialSeatId={cardSeatId}
            company={{
              name: companyName,
              businessId,
              brandColours: brandColours ? { band: brandColours.band, accent: brandColours.accent, text: brandColours.text } : undefined,
              logoUrl: brandKit?.logo || org?.logo || undefined,
            }}
            renderCardExtras={(card) =>
              card.status === 'published' ? (
                <QrFeature
                  tenantId={activeOrgId}
                  cardId={card.id}
                  cardName={card.name}
                  userRole={(role as 'owner' | 'admin' | 'employee') || 'employee'}
                />
              ) : (
                <p className="text-sm text-charcoal/70 dark:text-warm-paper/70">Publish this card to get its QR code and short link.</p>
              )
            }
          />
        ) : null}

        {current === 'seats' && isAdmin ? (
          <SeatsFeature
            tenantId={activeOrgId}
            plan={paidPlan}
            onEditCard={(seatId) => {
              setCardSeatId(seatId);
              navigate('cards');
            }}
          />
        ) : null}

        {current === 'leads' && leadsEnabled ? <LeadsFeature tenantId={activeOrgId} /> : null}

        {current === 'company' && isAdmin ? (
          <CompanyPageFeature tenantId={activeOrgId} organization={org} onOrganizationSaved={setOrg} />
        ) : null}

        {current === 'structure' && isAdmin ? <OrgStructureFeature tenantId={activeOrgId} plan={paidPlan} /> : null}

        {current === 'brand' && isAdmin ? (
          <BrandKitFeature tenantId={activeOrgId} userRole={(role as 'owner' | 'admin') || 'admin'} companyName={companyName} />
        ) : null}

        {current === 'audit' && isAdmin ? (
          <AuditLogFeature
            tenantId={activeOrgId}
            userRole={(role as 'owner' | 'admin') || 'admin'}
            selfPersonId={profile.person?.id}
            selfName={profile.person?.name || ownCardName}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
