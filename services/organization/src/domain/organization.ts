export interface OrganizationAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isPrimary: boolean;
}

export interface BrandColours {
  primary: string;
  secondary?: string;
  accent?: string;
}

export interface OrganizationProps {
  id: string; // tenantId (ULID)
  tenantId?: string; // explicitly injected for TenantScopedRepository
  businessId: string; // OB-XXXXXX
  name: string;
  legalName?: string;
  slug: string;
  previousSlugs: string[];
  industry: string;
  size: string;
  city: string;
  about?: string;
  website?: string;
  addresses?: OrganizationAddress[];
  gstin?: string;
  brandColours?: BrandColours;
  brandKit?: {
    logo?: string;
    brandColours: {
      band: string;
      accent?: string;
      text: string;
    };
    coverImage?: string;
  };
  fieldLocks?: string[];
  logo?: string;
  cover?: string;
  socialLinks?: Record<string, string>;
  plan: 'starter' | 'business';
  verifiedBadge: boolean;
  onboardingStartedAt: string;
  firstCardCreatedAt?: string;
  timeToFirstCardSeconds?: number;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export class Organization {
  constructor(private props: OrganizationProps) {}

  get id(): string {
    return this.props.id;
  }

  get businessId(): string {
    return this.props.businessId;
  }

  get name(): string {
    return this.props.name;
  }

  get slug(): string {
    return this.props.slug;
  }

  get previousSlugs(): string[] {
    return [...this.props.previousSlugs];
  }

  toJSON(): OrganizationProps {
    return { ...this.props };
  }
}
