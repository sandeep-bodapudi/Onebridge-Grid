'use client';

import React, { useEffect, useState, useCallback } from 'react';
import type { Branch, Department, Team, OrgChartNode } from '@onebridge/api-contracts';
import { OrgStructure, type NewBranchInput, type NewDepartmentInput, type NewTeamInput } from '@onebridge/ui-kit';
import { apiClient } from '../../api-client';

export interface OrgStructureFeatureProps {
  tenantId: string;
  plan?: 'starter' | 'business' | 'enterprise';
  onAddBranchClick?: () => void;
  onAddDepartmentClick?: () => void;
  onAddTeamClick?: () => void;
  onUpgradeClick?: () => void;
  className?: string;
}

export const OrgStructureFeature: React.FC<OrgStructureFeatureProps> = ({
  tenantId,
  plan = 'starter',
  onAddBranchClick,
  onAddDepartmentClick,
  onAddTeamClick,
  onUpgradeClick,
  className,
}) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tree, setTree] = useState<OrgChartNode | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [fetchedBranches, fetchedDepts, fetchedTeams, fetchedTree] = await Promise.all([
        apiClient.listBranches(tenantId, true).catch(() => []),
        apiClient.listDepartments(tenantId, undefined, true).catch(() => []),
        apiClient.listTeams(tenantId).catch(() => []),
        apiClient.getTree(tenantId).catch(() => undefined),
      ]);

      setBranches(fetchedBranches);
      setDepartments(fetchedDepts);
      setTeams(fetchedTeams);
      setTree(fetchedTree);
      setIsOffline(!navigator.onLine);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load organization structure';
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

  const handleSeedDefaults = async () => {
    try {
      await apiClient.seedDefaultDepartments(tenantId);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to seed default departments');
    }
  };

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setActionError(null);
    try {
      await action();
      await loadData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : fallback);
      throw err;
    }
  };

  const handleCreateBranch = (input: NewBranchInput) =>
    run(() => apiClient.createBranch(tenantId, input), 'Could not add the branch. Check the address and try again.');
  const handleCreateDepartment = (input: NewDepartmentInput) =>
    run(() => apiClient.createDepartment(tenantId, input), 'Could not add the department.');
  const handleCreateTeam = (input: NewTeamInput) =>
    run(() => apiClient.createTeam(tenantId, input), 'Could not add the team.');

  const handleArchiveBranch = async (branchId: string) => {
    try {
      await apiClient.archiveBranch(tenantId, branchId);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to archive branch');
    }
  };

  const handleArchiveDepartment = async (deptId: string) => {
    try {
      await apiClient.archiveDepartment(tenantId, deptId);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to archive department');
    }
  };

  const handleArchiveTeam = async (teamId: string) => {
    try {
      await apiClient.archiveTeam(tenantId, teamId);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to archive team');
    }
  };

  const handleMovePerson = async (
    personId: string,
    targetBranchId?: string,
    targetDepartmentId?: string,
    targetTeamId?: string
  ) => {
    try {
      await apiClient.movePersonInTree(tenantId, {
        personId,
        targetBranchId,
        targetDepartmentId,
        targetTeamId,
      });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to move person');
    }
  };

  if (error) {
    return (
      <div
        data-testid="org-structure-error"
        role="alert"
        className="px-4 py-3 rounded-panel border border-error/40 bg-error/10 text-sm"
      >
        {error}
      </div>
    );
  }

  return (
    <OrgStructure
      branches={branches}
      departments={departments}
      teams={teams}
      tree={tree}
      plan={plan}
      isLoading={isLoading}
      isOffline={isOffline}
      error={actionError}
      onCreateBranch={onAddBranchClick ? undefined : handleCreateBranch}
      onCreateDepartment={onAddDepartmentClick ? undefined : handleCreateDepartment}
      onCreateTeam={onAddTeamClick ? undefined : handleCreateTeam}
      onAddBranch={onAddBranchClick}
      onAddDepartment={onAddDepartmentClick}
      onAddTeam={onAddTeamClick}
      onSeedDefaults={handleSeedDefaults}
      onArchiveBranch={handleArchiveBranch}
      onArchiveDepartment={handleArchiveDepartment}
      onArchiveTeam={handleArchiveTeam}
      onMovePerson={handleMovePerson}
      onUpgradePlan={onUpgradeClick}
      className={className}
    />
  );
};

