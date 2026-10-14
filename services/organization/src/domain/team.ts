export interface TeamProps {
  id: string; // ULID
  tenantId: string;
  name: string;
  departmentId: string;
  leadPersonId?: string;
  parentTeamId?: string;
  status: 'active' | 'archived';
  archivedAt?: string;
  memberPersonIds?: string[];
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface OrgChartNodeProps {
  id: string;
  name: string;
  type: 'company' | 'branch' | 'department' | 'team' | 'person';
  managerPersonId?: string;
  managerChain?: string[];
  children?: OrgChartNodeProps[];
}
