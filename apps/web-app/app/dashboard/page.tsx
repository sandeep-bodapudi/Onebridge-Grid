'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionButton, cn } from '@onebridge/ui-kit';
import type { Organization } from '@onebridge/api-contracts';
import { apiClient } from '../../src/api-client';
import { AdminSettingsBusinessIdCard } from '../../src/features/business-id';
import { OrgStructureFeature } from '../../src/features/structure';
import { SeatsFeature } from '../../src/features/seats';
import { BrandKitFeature } from '../../src/features/brand-kit';
import { AuditLogFeature } from '../../src/features/audit-log';
import { CardsFeature } from '../../src/features/cards';
import { QrFeature } from '../../src/features/qr-codes';
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

type TabId = 'cards' | 'seats' | 'structure' | 'brand' | 'audit';

const TABS: Array<{ id: TabId; label: string; adminOnly?: boolean }> = [
  { id: 'cards', label: 'Cards' },
  { id: 'seats', label: 'People and seats', adminOnly: true },
  { id: 'structure', label: 'Branches and teams', adminOnly: true },
  { id: 'brand', label: 'Brand kit', adminOnly: true },
  { id: 'audit', label: 'Audit log', adminOnly: true },
];

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('cards');
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [onboardingBusy, setOnboardingBusy] = useState(false);

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
      setOrg(await apiClient.getOrganization(tenantId).catch(() => null));
    }
  }, []);

  useEffect(() => {
    loadProfile()
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [loadProfile, router]);

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
      setOnboardingError(err instanceof Error ? err.message : 'Could not create your company. Try again.');
    } finally {
      setOnboardingBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl p-24" aria-busy="true">
        <p className="text-charcoal/70 dark:text-warm-paper/70">Loading your OneBridge identity...</p>
      </main>
    );
  }

  if (!profile) return null;

  const activeOrgId = profile.activeTenant?.tenantId || profile.activeTenant?.id || '';
  const role = profile.activeTenant?.role;
  const isAdmin = role === 'owner' || role === 'admin';
  const plan = (org?.plan as 'starter' | 'business' | undefined) || profile.activeTenant?.plan || 'starter';
  const businessId = org?.businessId || profile.activeTenant?.businessId || '';
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <main data-testid="dashboard-container" className="mx-auto max-w-5xl space-y-24 p-16 md:p-24">
      <header className="flex flex-wrap items-center justify-between gap-12">
        <div>
          <p className="text-sm font-bold text-deep-orange">OneBridge Grid</p>
          <h1 data-testid="welcome-header" className="text-2xl font-extrabold">
            Welcome, {profile.person?.name || profile.person?.phone}
          </h1>
        </div>
        <ActionButton variant="ghost" data-testid="logout-button" onClick={handleLogout}>
          Sign out
        </ActionButton>
      </header>

      {!activeOrgId ? (
        <section className="rounded-16 bg-white p-16 shadow-md dark:bg-charcoal" data-testid="dashboard-onboarding">
          <OnboardingFlow
            labels={enOnboardingLabels}
            isLoading={onboardingBusy}
            error={onboardingError}
            onComplete={handleOnboardingComplete}
          />
        </section>
      ) : (
        <>
          <section
            data-testid="tenant-info-card"
            className="flex flex-wrap items-center justify-between gap-16 rounded-16 bg-white p-16 shadow-md dark:bg-charcoal"
          >
            <div>
              <h2 className="text-xl font-extrabold">{org?.name || 'Your company'}</h2>
              <p data-testid="active-role" className="text-sm text-charcoal/70 dark:text-warm-paper/70">
                Your role: <span className="font-bold capitalize">{role}</span>
              </p>
              <p data-testid="active-org-id" className="sr-only">
                Org ID: {activeOrgId}
              </p>
            </div>
            <AdminSettingsBusinessIdCard businessId={businessId} isEmpty={!businessId} />
          </section>

          <nav aria-label="Dashboard sections" className="flex flex-wrap gap-8 border-b border-sand-border">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={cn(
                  'min-h-[44px] px-16 font-bold',
                  tab === t.id ? 'border-b-4 border-bridge-orange' : 'text-charcoal/70 dark:text-warm-paper/70'
                )}
                data-testid={`tab-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <section className="rounded-16 bg-white p-16 shadow-md dark:bg-charcoal md:p-24">
            {tab === 'cards' ? (
              <CardsFeature
                tenantId={activeOrgId}
                userRole={role}
                personId={profile.person?.id}
                renderCardExtras={(card) => (
                  <div className="border-t border-sand-border pt-24">
                    <QrFeature
                      tenantId={activeOrgId}
                      cardId={card.id}
                      cardName={card.name}
                      userRole={(role as 'owner' | 'admin' | 'employee') || 'employee'}
                    />
                  </div>
                )}
              />
            ) : null}
            {tab === 'seats' && isAdmin ? <SeatsFeature tenantId={activeOrgId} plan={plan} /> : null}
            {tab === 'structure' && isAdmin ? <OrgStructureFeature tenantId={activeOrgId} plan={plan} /> : null}
            {tab === 'brand' && isAdmin ? (
              <BrandKitFeature tenantId={activeOrgId} userRole={(role as 'owner' | 'admin') || 'admin'} />
            ) : null}
            {tab === 'audit' && isAdmin ? (
              <AuditLogFeature tenantId={activeOrgId} userRole={(role as 'owner' | 'admin') || 'admin'} />
            ) : null}
          </section>
        </>
      )}
    </main>
  );
}
