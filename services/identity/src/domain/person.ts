export interface PersonMfa {
  enabled: boolean;
  secret?: string;
  verifiedAt?: string;
}

export interface Person {
  userId: string;
  phone?: string;
  email?: string;
  name?: string;
  authProviders: ('otp' | 'google' | 'microsoft')[];
  mfa: PersonMfa;
  roles?: { tenantId: string; role: 'Owner' | 'Admin' | 'Member'; plan: string }[];
  createdAt: string;
  updatedAt: string;
}
