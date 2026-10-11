'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../src/api-client';

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any | null>(null);
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
      >
        <h2>Active Organization</h2>
        <p data-testid="active-org-id"><strong>Org ID:</strong> {profile.activeTenant?.tenantId || profile.activeTenant?.id}</p>
        <p data-testid="active-role"><strong>Role:</strong> {profile.activeTenant?.role}</p>
      </section>
    </main>
  );
}
