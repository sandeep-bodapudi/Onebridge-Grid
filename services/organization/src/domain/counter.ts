import { DerivedEntityType } from '@onebridge/shared';

export type CounterType = DerivedEntityType;

export interface CounterDoc {
  id: string;
  tenantId: string;
  type: CounterType;
  seq: number;
  updatedAt: string;
  [key: string]: unknown;
}
