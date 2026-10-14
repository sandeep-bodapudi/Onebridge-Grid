'use client';

import React, { useEffect, useState, useCallback } from 'react';
import type { UpdateBrandKitRequest, UpdateFieldLocksRequest } from '@onebridge/api-contracts';
import {
  BrandKitManager,
  type BrandKitState,
  type FieldLocksState,
  type BrandKitLabels,
} from '@onebridge/ui-kit';
import { apiClient } from '../../api-client';

export interface BrandKitFeatureProps {
  tenantId: string;
  userRole?: 'owner' | 'admin' | 'employee';
  labels?: Partial<BrandKitLabels>;
  className?: string;
}

export const BrandKitFeature: React.FC<BrandKitFeatureProps> = ({
  tenantId,
  userRole = 'admin',
  labels,
  className,
}) => {
  const [brandKit, setBrandKit] = useState<BrandKitState | null>(null);
  const [locks, setLocks] = useState<FieldLocksState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [fetchedBrand, fetchedLocks] = await Promise.all([
        apiClient.getBrandKit(tenantId).catch(() => null),
        apiClient.getFieldLocks(tenantId).catch(() => null),
      ]);

      if (fetchedBrand) {
        setBrandKit({
          logo: fetchedBrand.logo || null,
          brandColours: {
            band: fetchedBrand.brandColours.band,
            accent: fetchedBrand.brandColours.accent || '#F68713',
            text: fetchedBrand.brandColours.text,
          },
          coverImage: fetchedBrand.coverImage || null,
        });
      } else {
        setBrandKit({
          logo: null,
          brandColours: { band: '#1B2A4A', accent: '#F68713', text: '#FFFFFF' },
          coverImage: null,
        });
      }
      setLocks(fetchedLocks || { lockedFields: [] });
      setIsOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load brand settings');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveBrandKit = async (kit: BrandKitState, acceptAutoPick?: boolean) => {
    if (!tenantId) return;
    const req: UpdateBrandKitRequest = {
      logo: kit.logo || undefined,
      brandColours: kit.brandColours,
      coverImage: kit.coverImage || undefined,
    };
    const updated = await apiClient.updateBrandKit(tenantId, req, acceptAutoPick);
    setBrandKit({
      logo: updated.logo || null,
      brandColours: {
        band: updated.brandColours.band,
        accent: updated.brandColours.accent || '#F68713',
        text: updated.brandColours.text,
      },
      coverImage: updated.coverImage || null,
    });
  };

  const handleSaveLocks = async (l: FieldLocksState) => {
    if (!tenantId) return;
    const req: UpdateFieldLocksRequest = {
      lockedFields: l.lockedFields,
    };
    const updated = await apiClient.updateFieldLocks(tenantId, req);
    setLocks(updated);
  };

  const handleUploadLogo = async (file: File) => {
    if (!tenantId) throw new Error('Tenant ID required');
    return apiClient.uploadLogo(tenantId, file);
  };

  return (
    <BrandKitManager
      initialBrandKit={
        brandKit || {
          logo: null,
          brandColours: { band: '#1B2A4A', accent: '#F68713', text: '#FFFFFF' },
          coverImage: null,
        }
      }
      initialLocks={locks || { lockedFields: [] }}
      userRole={userRole}
      isLoading={isLoading}
      error={error}
      isOffline={isOffline}
      onSaveBrandKit={handleSaveBrandKit}
      onSaveLocks={handleSaveLocks}
      onUploadLogo={handleUploadLogo}
      labels={labels}
      className={className}
    />
  );
};
