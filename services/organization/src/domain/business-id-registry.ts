export interface IssuedBusinessIdEntry {
  id: string; // registry entry id
  businessId: string; // OB-XXXXXX, unique index
  tenantId: string; // associated company ULID
  status: 'issued' | 'void';
  issuedAt: string;
}
