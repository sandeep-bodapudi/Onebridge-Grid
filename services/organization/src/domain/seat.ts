export type SeatStatus = 'vacant' | 'invited' | 'active' | 'inactive' | 'offboarded';

export interface CardBindingProps {
  cardId?: string;
  cardUrl?: string;
  qrCodeUrl?: string;
  nfcChipId?: string;
  [key: string]: unknown;
}

export interface SeatProps {
  id: string; // derived ID <BusinessID>-E<nnnn>
  tenantId: string;
  title: string;
  branchId?: string;
  departmentId?: string;
  teamId?: string;
  managerSeatId?: string;
  personId?: string;
  status: SeatStatus;
  isReadOnly: boolean;
  cardBinding?: CardBindingProps;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface CreateSeatDto {
  title: string;
  branchId?: string;
  departmentId?: string;
  teamId?: string;
  managerSeatId?: string;
  personId?: string;
  status?: SeatStatus;
  cardBinding?: CardBindingProps;
}

export interface UpdateSeatDto {
  title?: string;
  branchId?: string;
  departmentId?: string;
  teamId?: string;
  managerSeatId?: string;
  status?: SeatStatus;
}
