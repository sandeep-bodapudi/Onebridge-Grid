export interface PersonMfa {
  enabled: boolean;
  secret?: string;
  verifiedAt?: string;
}

export type AuthProvider = 'otp' | 'password' | 'google' | 'microsoft';

export interface Person {
  userId: string;
  phone?: string;
  email?: string;
  name?: string;
  authProviders: AuthProvider[];
  mfa: PersonMfa;
  /** D-AUTH-EMAIL: set when the person proved they own `email` (a code, or a verified Google email). */
  emailVerifiedAt?: string;
  /** scrypt string from domain/password.ts; never leaves the service. */
  passwordHash?: string;
  passwordUpdatedAt?: string;
  /** Google account id (the ID token `sub`). */
  googleSub?: string;
  language?: 'en' | 'hi';
  roles?: { tenantId: string; role: 'Owner' | 'Admin' | 'Member'; plan: string }[];
  createdAt: string;
  updatedAt: string;
}
