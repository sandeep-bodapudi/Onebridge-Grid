export interface SeedTenant {
  id: string;
  name: string;
  businessId: string;
  plan: 'starter' | 'business';
}

export interface SeedPerson {
  id: string;
  name: string;
  phone: string;
  email: string;
  mfaEnrolled: boolean;
  totpSecret?: string;
}

export interface SeedMembership {
  id: string;
  personId: string;
  tenantId: string;
  role: 'owner' | 'admin' | 'employee';
}

/**
 * D-AUTH-EMAIL A9: every seeded person can sign in with their example.com email and this
 * development-only password. Seeds never run in production (seedDevDatabase refuses).
 */
export const DEV_PASSWORD = 'DevPassword-2026!';

export const SEED_DATA = {
  tenants: {
    acme: {
      id: '01M4NHCCY9NMYMSKFVK51DN4F9',
      name: 'Acme Technologies Pvt Ltd',
      businessId: 'IN-DL-2024-ACME-01',
      plan: 'business',
    } as SeedTenant,
    beta: {
      id: '01M4NHCCYP0Q8ESC0STYVWXJTY',
      name: 'Beta Global Solutions',
      businessId: 'IN-MH-2024-BETA-02',
      plan: 'starter',
    } as SeedTenant,
  },
  persons: {
    acmeOwner: {
      id: '01M4NHCCYQ2S5YB9Q8TDRHJ9P8',
      name: 'Aarav Patel',
      phone: '+919876500001',
      email: 'aarav.owner@acme.example.com',
      mfaEnrolled: true,
      totpSecret: 'JBSWY3DPEHPK3PXP',
    } as SeedPerson,
    acmeAdmin: {
      id: '01M4NHCCYRRNJEGXBZ0YVJ41CZ',
      name: 'Neha Sharma',
      phone: '+919876500002',
      email: 'neha.admin@acme.example.com',
      mfaEnrolled: true,
      totpSecret: 'JBSWY3DPEHPK3PXP',
    } as SeedPerson,
    acmeEmployee: {
      id: '01M4NHCCYR0CNCVTNBN03EKBHX',
      name: 'Rohan Verma',
      phone: '+919876500003',
      email: 'rohan.emp@acme.example.com',
      mfaEnrolled: false,
    } as SeedPerson,
    betaOwner: {
      id: '01M4NHCCYSEQJPCHTJ4BWQK17H',
      name: 'Vikram Singh',
      phone: '+919876500004',
      email: 'vikram.owner@beta.example.com',
      mfaEnrolled: true,
      totpSecret: 'JBSWY3DPEHPK3PXP',
    } as SeedPerson,
    betaAdmin: {
      id: '01M4NHCCYSP4M6QNPWGKKEB3TA',
      name: 'Pooja Iyer',
      phone: '+919876500005',
      email: 'pooja.admin@beta.example.com',
      mfaEnrolled: true,
      totpSecret: 'JBSWY3DPEHPK3PXP',
    } as SeedPerson,
    betaEmployee: {
      id: '01M4NHCCYTJGS3FD6J3B3FBTMA',
      name: 'Karan Mehra',
      phone: '+919876500006',
      email: 'karan.emp@beta.example.com',
      mfaEnrolled: false,
    } as SeedPerson,
  },
  memberships: {
    acmeOwner: {
      id: '01M4NHCCYTB2YAB444DNZBRRM2',
      personId: '01M4NHCCYQ2S5YB9Q8TDRHJ9P8',
      tenantId: '01M4NHCCY9NMYMSKFVK51DN4F9',
      role: 'owner',
    } as SeedMembership,
    acmeAdmin: {
      id: '01M4NHCCYVMB10NEPVRDYA82F2',
      personId: '01M4NHCCYRRNJEGXBZ0YVJ41CZ',
      tenantId: '01M4NHCCY9NMYMSKFVK51DN4F9',
      role: 'admin',
    } as SeedMembership,
    acmeEmployee: {
      id: '01M4NHCCYXEKBDB52T8W5ND1BT',
      personId: '01M4NHCCYR0CNCVTNBN03EKBHX',
      tenantId: '01M4NHCCY9NMYMSKFVK51DN4F9',
      role: 'employee',
    } as SeedMembership,
    betaOwner: {
      id: '01M4NHCCYY3R4WCK2TEBBK66FA',
      personId: '01M4NHCCYSEQJPCHTJ4BWQK17H',
      tenantId: '01M4NHCCYP0Q8ESC0STYVWXJTY',
      role: 'owner',
    } as SeedMembership,
    betaAdmin: {
      id: '01M4NHCCYYKFB5QQCX12VXEVAR',
      personId: '01M4NHCCYSP4M6QNPWGKKEB3TA',
      tenantId: '01M4NHCCYP0Q8ESC0STYVWXJTY',
      role: 'admin',
    } as SeedMembership,
    betaEmployee: {
      id: '01M4NHCCYZ43GBZXXH6MPH7QDA',
      personId: '01M4NHCCYTJGS3FD6J3B3FBTMA',
      tenantId: '01M4NHCCYP0Q8ESC0STYVWXJTY',
      role: 'employee',
    } as SeedMembership,
  },
};
