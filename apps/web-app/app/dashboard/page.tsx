'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../src/api-client';
import { AdminSettingsBusinessIdCard, AdminRailFooter } from '../../src/features/business-id';
import { OrgStructureFeature } from '../../src/features/structure';
import { SeatsFeature } from '../../src/features/seats';
import { BrandKitFeature } from '../../src/features/brand-kit';
import { AuditLogFeature } from '../../src/features/audit-log';

export interface UserProfile {
  person?: {
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

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadIdentity() {
      try {
        const data = await apiClient.getMe();
        setProfile(data);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    loadIdentity();
  }, [router]);

  const handleLogout = async () => {
    await apiClient.logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <main style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading your OneBridge identity...</p>
      </main>
    );
  }

  if (!profile) {
    return null;
  }

  const activeOrgId = profile.activeTenant?.tenantId || profile.activeTenant?.id || '';
  const businessId = profile.activeTenant?.businessId || '';

  return (
    <main data-testid="dashboard-container" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 data-testid="welcome-header">Welcome, {profile.person?.name || profile.person?.phone}</h1>
        <button
          data-testid="logout-button"
          onClick={handleLogout}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#F3F4F6',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </header>

      <section
        data-testid="tenant-info-card"
        style={{
          backgroundColor: '#FFFFFF',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
        className="space-y-16"
      >
        <h2>Active Organization</h2>
        <p data-testid="active-org-id"><strong>Org ID:</strong> {activeOrgId}</p>
        <p data-testid="active-role"><strong>Role:</strong> {profile.activeTenant?.role}</p>

        <div className="pt-8">
          <AdminSettingsBusinessIdCard businessId={businessId} isEmpty={!businessId} />
        </div>
      </section>

      {activeOrgId ? (
        <>
          <section className="mt-24 bg-white dark:bg-charcoal rounded-16 shadow-md" data-testid="dashboard-org-structure-section">
            <OrgStructureFeature tenantId={activeOrgId} plan={profile.activeTenant?.plan || 'starter'} />
          </section>

          <section className="mt-24 bg-white dark:bg-charcoal rounded-16 shadow-md" data-testid="dashboard-seats-section">
            <SeatsFeature tenantId={activeOrgId} plan={profile.activeTenant?.plan || 'starter'} />
          </section>

          <section className="mt-24 bg-white dark:bg-charcoal rounded-16 shadow-md p-16" data-testid="dashboard-brand-kit-section">
            <BrandKitFeature
              tenantId={activeOrgId}
              userRole={(profile.activeTenant?.role as 'owner' | 'admin' | 'employee') || 'admin'}
            />
          </section>

          {profile.activeTenant?.role === 'owner' || profile.activeTenant?.role === 'admin' ? (
            <section className="mt-24 bg-white dark:bg-charcoal rounded-16 shadow-md p-16" data-testid="dashboard-audit-log-section">
              <AuditLogFeature
                tenantId={activeOrgId}
                userRole={(profile.activeTenant?.role as 'owner' | 'admin') || 'admin'}
              />
            </section>
          ) : null}
        </>
      ) : null}

      {businessId ? (
        <aside className="mt-24 max-w-xs" data-testid="dashboard-rail-footer">
          <AdminRailFooter businessId={businessId} />
        </aside>
      ) : null}
    </main>
  );
}
