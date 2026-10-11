export interface SessionFamily {
  familyId: string;
  userId: string;
  isRevoked: boolean;
  revokedAt?: string;
  currentRefreshTokenHash: string;
  usedRefreshTokenHashes: Set<string>;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  sessionId: string;
  familyId: string;
  userId: string;
  deviceLabel: string;
  ipAddress: string;
  createdAt: string;
  lastActiveAt: string;
  isRevoked: boolean;
}
