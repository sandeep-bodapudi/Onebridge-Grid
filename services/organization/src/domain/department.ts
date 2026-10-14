export interface DepartmentProps {
  id: string; // OB-XXXXXX-Dnn
  tenantId: string;
  name: string;
  branchId?: string; // Optional: branch-scoped if provided, global if undefined
  managerPersonId?: string;
  isDefault: boolean;
  status: 'active' | 'archived';
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export const DEFAULT_DEPARTMENT_NAMES = [
  'Sales',
  'Marketing',
  'HR',
  'Support',
  'Development',
] as const;
