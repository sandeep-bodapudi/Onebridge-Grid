'use client';

import React, { useEffect, useState, useCallback } from 'react';
import type { ShortLink, CreateCardQrRequest, UpdateShortLinkRequest } from '@onebridge/api-contracts';
import {
  SourceTagManager,
  type ShortLinkItem,
} from '@onebridge/ui-kit';
import { apiClient } from '../../api-client';

export interface QrFeatureProps {
  tenantId: string;
  cardId: string;
  cardName?: string;
  userRole?: 'owner' | 'admin' | 'employee';
  className?: string;
}

export const QrFeature: React.FC<QrFeatureProps> = ({
  tenantId,
  cardId,
  cardName = 'Digital Business Card',
  userRole = 'admin',
  className,
}) => {
  const [items, setItems] = useState<ShortLinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = userRole === 'owner' || userRole === 'admin';

  const loadData = useCallback(async () => {
    if (!tenantId || !cardId) return;
    setIsLoading(true);
    setError(null);
    try {
      const qrs = await apiClient.listCardQrs(tenantId, cardId);
      const mapped: ShortLinkItem[] = qrs.map((q: ShortLink) => ({
        id: q.id,
        code: q.code,
        shortUrl: q.shortUrl || `https://obg.in/${q.code}`,
        source: q.source || 'default',
        label: q.label,
        destinationUrl: q.destinationUrl,
        status: q.status,
        isExternal: q.isExternal,
      }));
      setItems(mapped);
      setIsOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load QR links');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, cardId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateTag = async (data: { source: string; label?: string; destinationUrl?: string }) => {
    if (!tenantId || !cardId) return;
    const req: CreateCardQrRequest = {
      source: data.source,
      label: data.label,
      destinationUrl: data.destinationUrl || undefined,
    };
    const created = await apiClient.createCardQr(tenantId, cardId, req);
    setItems((prev) => [
      ...prev,
      {
        id: created.id,
        code: created.code,
        shortUrl: created.shortUrl || `https://obg.in/${created.code}`,
        source: created.source || data.source,
        label: created.label,
        destinationUrl: created.destinationUrl,
        status: created.status,
        isExternal: created.isExternal,
      },
    ]);
  };

  const handleUpdateTag = async (
    id: string,
    data: { destinationUrl?: string; label?: string; status?: 'active' | 'disabled' }
  ) => {
    if (!tenantId || !cardId) return;
    const req: UpdateShortLinkRequest = {
      destinationUrl: data.destinationUrl,
      label: data.label,
      status: data.status,
    };
    const updated = await apiClient.updateShortLink(tenantId, cardId, id, req);
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              label: updated.label || item.label,
              destinationUrl: updated.destinationUrl,
              status: updated.status,
            }
          : item
      )
    );
  };

  const handleDownloadAsset = (
    qrId: string,
    format: 'png' | 'svg' | 'pdf',
    size: number,
    template?: 'a4' | 'a5'
  ) => {
    const downloadUrl = apiClient.getQrAssetUrl(cardId, qrId, format, size, template, tenantId);
    const filename = `${cardId}-${qrId}${template ? `-${template}` : ''}.${format}`;
    apiClient.downloadProtectedFile(downloadUrl, filename, tenantId).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Could not download the file. Try again.');
    });
  };

  return (
    <div className={className}>
      <SourceTagManager
        cardId={cardId}
        cardName={cardName}
        items={items}
        isLoading={isLoading}
        error={error}
        isOffline={isOffline}
        onCreateTag={handleCreateTag}
        onUpdateTag={handleUpdateTag}
        onDownloadAsset={handleDownloadAsset}
        isAdmin={isAdmin}
      />
    </div>
  );
};
