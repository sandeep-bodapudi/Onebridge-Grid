import { Address, MapPin, BranchContact } from '@onebridge/api-contracts';

export interface BranchProps {
  id: string; // OB-XXXXXX-Bnn
  tenantId: string;
  name: string;
  address: Address;
  mapPin?: MapPin;
  contact?: BranchContact;
  managerPersonId?: string;
  status: 'active' | 'archived';
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}
