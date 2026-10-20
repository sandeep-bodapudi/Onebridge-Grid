import { EncryptedLeadPayload } from '@onebridge/shared';

export class InvalidLeadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLeadError';
  }
}

export class ConsentRequiredError extends Error {
  constructor(message = 'Explicit consent is required to share contact details') {
    super(message);
    this.name = 'ConsentRequiredError';
  }
}

export type LeadSource = 'qr' | 'nfc' | 'link' | 'shareback' | 'manual' | 'company_enquiry';

export interface LeadConsent {
  granted: boolean;
  timestamp: string;
  noticeVersion: string;
  cardId: string;
}

export interface LeadProps {
  id: string;
  tenantId: string;
  cardId: string;
  ownerSeatId: string;
  source: LeadSource;
  sourceTag?: string;
  encryptedPayload: EncryptedLeadPayload;
  phoneBlindIndex: string;
  indexVersion: number;
  consent: LeadConsent;
  createdAt: Date;
  updatedAt: Date;
}

export class Lead {
  private constructor(private readonly props: LeadProps) {}

  public static create(
    input: Omit<LeadProps, 'createdAt' | 'updatedAt'> & { createdAt?: Date; updatedAt?: Date }
  ): Lead {
    if (!input.id || typeof input.id !== 'string') {
      throw new InvalidLeadError('Lead id is required');
    }
    if (!input.tenantId || typeof input.tenantId !== 'string') {
      throw new InvalidLeadError('tenantId is required');
    }
    if (!input.cardId || typeof input.cardId !== 'string') {
      throw new InvalidLeadError('cardId is required');
    }
    if (!input.ownerSeatId || typeof input.ownerSeatId !== 'string') {
      throw new InvalidLeadError('ownerSeatId is required');
    }
    if (!input.phoneBlindIndex || typeof input.phoneBlindIndex !== 'string') {
      throw new InvalidLeadError('phoneBlindIndex is required');
    }
    if (!input.encryptedPayload?.ciphertext || !input.encryptedPayload?.iv || !input.encryptedPayload?.authTag) {
      throw new InvalidLeadError('encryptedPayload is invalid');
    }
    if (!input.consent || input.consent.granted !== true) {
      throw new ConsentRequiredError();
    }

    const now = new Date();
    return new Lead({
      ...input,
      indexVersion: input.indexVersion || 1,
      createdAt: input.createdAt || now,
      updatedAt: input.updatedAt || now,
    });
  }

  public get id(): string {
    return this.props.id;
  }

  public get tenantId(): string {
    return this.props.tenantId;
  }

  public get cardId(): string {
    return this.props.cardId;
  }

  public get ownerSeatId(): string {
    return this.props.ownerSeatId;
  }

  public get source(): LeadSource {
    return this.props.source;
  }

  public get sourceTag(): string | undefined {
    return this.props.sourceTag;
  }

  public get encryptedPayload(): EncryptedLeadPayload {
    return this.props.encryptedPayload;
  }

  public get phoneBlindIndex(): string {
    return this.props.phoneBlindIndex;
  }

  public get indexVersion(): number {
    return this.props.indexVersion;
  }

  public get consent(): LeadConsent {
    return this.props.consent;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public toProps(): LeadProps {
    return { ...this.props };
  }
}
