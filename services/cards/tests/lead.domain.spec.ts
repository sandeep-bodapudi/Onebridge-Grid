import { describe, it, expect } from 'vitest';
import { Lead, InvalidLeadError, ConsentRequiredError } from '../src/domain/lead.js';

describe('Lead Domain Entity (F13 / ADR-0002)', () => {
  const validProps = {
    id: '01JD2X0000LEAD000000000001',
    tenantId: '01JD2X0000TENANT0000000001',
    cardId: '01JD2X0000CARD000000000001',
    ownerSeatId: '01JD2X0000SEAT000000000001',
    source: 'shareback' as const,
    sourceTag: 'qr:booth-a',
    encryptedPayload: {
      kid: 'dek-1-v1',
      iv: 'MTIzNDU2Nzg5MDEy',
      authTag: 'MTIzNDU2Nzg5MDEyMzQ1Ng==',
      ciphertext: 'ZW5jcnlwdGVk',
    },
    phoneBlindIndex: 'a'.repeat(64),
    indexVersion: 1,
    consent: {
      granted: true,
      timestamp: new Date().toISOString(),
      noticeVersion: 'v1.0',
      cardId: '01JD2X0000CARD000000000001',
    },
  };

  it('instantiates valid Lead entity with all properties preserved', () => {
    const lead = Lead.create(validProps);
    expect(lead.id).toBe(validProps.id);
    expect(lead.tenantId).toBe(validProps.tenantId);
    expect(lead.cardId).toBe(validProps.cardId);
    expect(lead.ownerSeatId).toBe(validProps.ownerSeatId);
    expect(lead.source).toBe('shareback');
    expect(lead.sourceTag).toBe('qr:booth-a');
    expect(lead.encryptedPayload.kid).toBe('dek-1-v1');
    expect(lead.phoneBlindIndex).toBe('a'.repeat(64));
    expect(lead.consent.granted).toBe(true);
    expect(lead.consent.noticeVersion).toBe('v1.0');
    expect(lead.createdAt).toBeInstanceOf(Date);
  });

  it('rejects creation if consent is missing or false', () => {
    expect(() => {
      Lead.create({
        ...validProps,
        consent: {
          ...validProps.consent,
          granted: false,
        },
      });
    }).toThrow(ConsentRequiredError);
  });

  it('rejects creation if required IDs or encrypted payload is missing', () => {
    expect(() => {
      Lead.create({
        ...validProps,
        cardId: '',
      });
    }).toThrow(InvalidLeadError);

    expect(() => {
      Lead.create({
        ...validProps,
        ownerSeatId: '',
      });
    }).toThrow(InvalidLeadError);

    expect(() => {
      Lead.create({
        ...validProps,
        phoneBlindIndex: '',
      });
    }).toThrow(InvalidLeadError);
  });
});
