import { describe, it, expect } from 'vitest';
import { generateVCard, VCardInput, foldVCardLine } from '../src/vcard.js';

describe('AC-2: vCard generation (RFC 6350 / vCard 3.0)', () => {
  const sampleCard: VCardInput = {
    firstName: 'Sneha',
    lastName: 'Reddy',
    company: 'Acme Steels',
    branch: 'Headquarters Branch',
    title: 'Senior Sales Executive',
    phone: '+919876543210',
    email: 'sneha@acmesteels.com',
    url: 'https://grid.onebridge.in/c/acme-steels/sneha-reddy',
    photoUrl: 'https://cdn.onebridge.in/photos/sneha.jpg',
    address: {
      street: 'Road No. 36, Banjara Hills',
      city: 'Hyderabad',
      state: 'Telangana',
      postalCode: '500034',
      country: 'India',
    },
    note: 'OneBridge Digital Business Card',
  };

  it('generates valid RFC-compliant vCard 3.0 header and footer with CRLF line breaks', () => {
    const vcard = generateVCard(sampleCard);
    expect(vcard.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true);
    expect(vcard.endsWith('END:VCARD\r\n')).toBe(true);
  });

  it('formats structured name (N) and formatted name (FN)', () => {
    const vcard = generateVCard(sampleCard);
    expect(vcard).toContain('FN:Sneha Reddy\r\n');
    expect(vcard).toContain('N:Reddy;Sneha;;;\r\n');
  });

  it('formats company and branch as ORG components', () => {
    const vcard = generateVCard(sampleCard);
    expect(vcard).toContain('ORG:Acme Steels;Headquarters Branch\r\n');
  });

  it('formats designation as TITLE', () => {
    const vcard = generateVCard(sampleCard);
    expect(vcard).toContain('TITLE:Senior Sales Executive\r\n');
  });

  it('formats phone numbers with CELL and VOICE types', () => {
    const vcard = generateVCard(sampleCard);
    expect(vcard).toContain('TEL;TYPE=CELL,VOICE:+919876543210\r\n');
  });

  it('formats email with WORK and INTERNET types', () => {
    const vcard = generateVCard(sampleCard);
    expect(vcard).toContain('EMAIL;TYPE=WORK,INTERNET:sneha@acmesteels.com\r\n');
  });

  it('formats photo as URI', () => {
    const vcard = generateVCard(sampleCard);
    expect(vcard).toContain('PHOTO;VALUE=URI:https://cdn.onebridge.in/photos/sneha.jpg\r\n');
  });

  it('formats work address properly with empty post office box and extended address fields', () => {
    const vcard = generateVCard(sampleCard);
    expect(vcard.replace(/\r\n /g, '')).toContain('ADR;TYPE=WORK:;;Road No. 36\\, Banjara Hills;Hyderabad;Telangana;500034;India\r\n');
  });

  it('escapes commas, semicolons, and backslashes in text fields', () => {
    const escaped = generateVCard({
      ...sampleCard,
      company: 'Acme Steels, Co.; Ltd.',
      note: 'Line 1\nLine 2, with comma; and semicolon\\backslash',
    });
    expect(escaped).toContain('ORG:Acme Steels\\, Co.\\; Ltd.;Headquarters Branch\r\n');
    expect(escaped).toContain('NOTE:Line 1\\nLine 2\\, with comma\\; and semicolon\\\\backslash\r\n');
  });

  it('omits optional fields gracefully when not provided', () => {
    const minimal: VCardInput = {
      firstName: 'Rajesh',
      lastName: 'Iyer',
      company: 'Acme Steels',
    };
    const vcard = generateVCard(minimal);
    expect(vcard).toContain('FN:Rajesh Iyer\r\n');
    expect(vcard).toContain('ORG:Acme Steels\r\n');
    expect(vcard).not.toContain('TEL;');
    expect(vcard).not.toContain('EMAIL;');
    expect(vcard).not.toContain('PHOTO;');
    expect(vcard).not.toContain('ADR;');
  });

  it('folds lines exceeding 75 octets with CRLF followed by a single space per RFC 6350', () => {
    const longNote = 'This is an extremely detailed and exceptionally long biographical note intended specifically to verify that vCard lines exceeding seventy-five octets are folded properly.';
    const vcard = generateVCard({
      ...sampleCard,
      note: longNote,
    });

    // Check that every line is 75 octets or fewer (excluding the CRLF)
    const rawLines = vcard.split('\r\n');
    for (const line of rawLines) {
      if (line.length > 0) {
        expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
      }
    }

    // Verify folding occurs with CRLF + space
    expect(vcard).toMatch(/NOTE:[^\r\n]+\r\n [^\r\n]+/);

    // Verify unfolding recovers the original note
    const unfolded = vcard.replace(/\r\n /g, '');
    expect(unfolded).toContain(`NOTE:${longNote}`);
  });

  it('foldVCardLine handles short lines without alteration', () => {
    expect(foldVCardLine('FN:John Doe')).toBe('FN:John Doe');
  });
});

