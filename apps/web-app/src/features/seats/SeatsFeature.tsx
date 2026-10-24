'use client';

import React, { useEffect, useState, useCallback } from 'react';
import type { Seat, Branch, Department, Team, CardSummary } from '@onebridge/api-contracts';
import { SeatsManagement, type SeatItem, type NewSeatInput } from '@onebridge/ui-kit';
import { apiClient } from '../../api-client';

export interface SeatsFeatureProps {
  tenantId: string;
  plan?: 'starter' | 'business' | 'enterprise';
  maxSeats?: number;
  /** Opens the card editor for a seat (the dashboard switches to Cards). */
  onEditCard?: (seatId: string) => void;
  className?: string;
}

export const SeatsFeature: React.FC<SeatsFeatureProps> = ({
  tenantId,
  plan = 'starter',
  maxSeats,
  onEditCard,
  className,
}) => {
  const [seats, setSeats] = useState<SeatItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [fetchedSeats, fetchedBranches, fetchedDepts, fetchedTeams, cards] = await Promise.all([
        apiClient.listSeats(tenantId).catch(() => ({ items: [], total: 0 })),
        apiClient.listBranches(tenantId, true).catch(() => [] as Branch[]),
        apiClient.listDepartments(tenantId, undefined, true).catch(() => [] as Department[]),
        apiClient.listTeams(tenantId).catch(() => [] as Team[]),
        apiClient.listCardSummaries(tenantId).catch(() => [] as CardSummary[]),
      ]);
      const cardBySeat = new Map(cards.map((c) => [c.seatId || c.id, c]));

      const items = (fetchedSeats.items || []).map((s: Seat): SeatItem => ({
        id: s.id,
        tenantId: s.tenantId,
        title: s.title,
        branchId: s.branchId,
        departmentId: s.departmentId,
        teamId: s.teamId,
        managerSeatId: s.managerSeatId,
        personId: s.personId,
        status: s.status,
        isReadOnly: s.isReadOnly ?? false,
        cardBinding: s.cardBinding,
        displayName: cardBySeat.get(s.id)?.name || undefined,
        cardStatus: cardBySeat.get(s.id)?.status,
        cardPublicUrl: cardBySeat.get(s.id)?.publicUrl,
        stats: cardBySeat.get(s.id)?.stats,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));

      setSeats(items);
      setTotal(fetchedSeats.total || items.length);
      setBranches(fetchedBranches.map((b) => ({ id: b.id, name: b.name })));
      setDepartments(fetchedDepts.map((d) => ({ id: d.id, name: d.name })));
      setTeams(fetchedTeams.map((t) => ({ id: t.id, name: t.name })));
      setIsOffline(!navigator.onLine);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load seats';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadData();

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData]);

  const handleCreateSeat = async (input: NewSeatInput) => {
    const { name, phone, email, ...dto } = input;
    try {
      const seat = await apiClient.createSeat(tenantId, dto);
      if (name || phone || email) {
        // The cards service creates the draft card from seat.created; fill in the person's details.
        const card = await apiClient.getCard(seat.id, tenantId);
        await apiClient.updateCard(
          card.id,
          {
            sections: card.sections.map((section) =>
              section.type === 'about'
                ? { ...section, content: { ...section.content, name, designation: dto.title, phone, email } }
                : section
            ),
          },
          tenantId
        );
      }
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not add the seat. Try again.');
      throw err;
    }
  };

  const handleAssignPerson = async (seatId: string, personId: string) => {
    try {
      await apiClient.assignSeat(tenantId, seatId, { personId });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to assign person');
    }
  };

  const handleUpdateStatus = async (seatId: string, status: SeatItem['status']) => {
    try {
      await apiClient.updateSeat(tenantId, seatId, { status });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update seat status');
    }
  };

  const handleArchiveSeat = async (seatId: string) => {
    try {
      await apiClient.archiveSeat(tenantId, seatId);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to archive seat');
    }
  };

  return (
    <div className={className} data-testid="seats-feature-container">
      <SeatsManagement
        seats={seats}
        total={total}
        plan={plan}
        maxSeats={maxSeats}
        isLoading={isLoading}
        isOffline={isOffline}
        error={error}
        branches={branches}
        departments={departments}
        teams={teams}
        onCreateSeat={handleCreateSeat}
        onAssignPerson={handleAssignPerson}
        onUpdateStatus={handleUpdateStatus}
        onArchiveSeat={handleArchiveSeat}
        onEditCard={onEditCard}
      />
    </div>
  );
};
