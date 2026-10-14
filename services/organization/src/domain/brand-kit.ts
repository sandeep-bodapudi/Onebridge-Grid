import { ForbiddenException } from '@nestjs/common';
import { Role } from '@onebridge/shared';

export interface BrandColoursKitProps {
  band: string;
  accent?: string;
  text: string;
}

export interface BrandKitProps {
  logo?: string;
  brandColours: BrandColoursKitProps;
  coverImage?: string;
}

export interface FieldLocksProps {
  lockedFields: string[];
}

export interface UpdateBrandKitDto {
  logo?: string;
  brandColours: BrandColoursKitProps;
  coverImage?: string;
  acceptAutoPick?: boolean;
}

export interface UpdateFieldLocksDto {
  lockedFields: string[];
}

export interface UploadLogoDto {
  filename: string;
  contentType: string;
  size: number;
  contentBase64?: string;
}

export const DEFAULT_LOCKABLE_FIELDS = [
  'logo',
  'brandColours',
  'coverImage',
  'title',
  'departmentId',
  'branchId',
  'teamId',
  'managerSeatId',
];

/**
 * Validates whether any updated fields are protected by organization field locks.
 * If the caller is not an owner or admin, editing any locked field throws 403 Forbidden.
 */
export function assertFieldsNotLocked(
  lockedFields: string[] | undefined,
  updatedFields: Record<string, unknown>,
  callerRole?: Role | string,
  correlationId = 'unknown'
): void {
  if (!lockedFields || lockedFields.length === 0) {
    return;
  }

  // Admins and owners can edit locked fields
  if (callerRole === 'owner' || callerRole === 'admin') {
    return;
  }

  for (const [key, value] of Object.entries(updatedFields)) {
    if (value !== undefined && lockedFields.includes(key)) {
      throw new ForbiddenException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: `Field "${key}" is locked by organization policy and cannot be edited by employees. Contact your organization administrator.`,
        correlationId,
      });
    }
  }
}
