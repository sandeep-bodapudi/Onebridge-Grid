/**
 * F12 AC-2: Standard RFC 6350 / vCard 3.0 generator.
 * Formats contact attributes for native iOS Contacts and Android Contacts opening.
 */

export interface VCardAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface VCardInput {
  firstName: string;
  lastName?: string;
  company?: string;
  branch?: string;
  title?: string;
  phone?: string;
  email?: string;
  url?: string;
  photoUrl?: string;
  address?: VCardAddress;
  note?: string;
}

function escapeVCardText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function foldVCardLine(line: string, maxOctets = 75): string {
  if (Buffer.byteLength(line, 'utf8') <= maxOctets) {
    return line;
  }

  const chunks: string[] = [];
  let currentChunk = '';
  let currentOctets = 0;
  let isFirstLine = true;

  for (const char of line) {
    const charOctets = Buffer.byteLength(char, 'utf8');
    const targetLimit = isFirstLine ? maxOctets : maxOctets - 1; // 1 octet for leading space on continuation lines

    if (currentOctets + charOctets > targetLimit && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = char;
      currentOctets = charOctets;
      isFirstLine = false;
    } else {
      currentChunk += char;
      currentOctets += charOctets;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks.join('\r\n ');
}

export function generateVCard(input: VCardInput): string {
  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];

  const firstName = input.firstName ? escapeVCardText(input.firstName.trim()) : '';
  const lastName = input.lastName ? escapeVCardText(input.lastName.trim()) : '';
  const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ').trim();

  lines.push(`FN:${escapeVCardText(fullName || 'Contact')}`);
  lines.push(`N:${lastName};${firstName};;;`);

  if (input.company) {
    const orgParts = [input.company];
    if (input.branch) orgParts.push(input.branch);
    lines.push(`ORG:${orgParts.map(escapeVCardText).join(';')}`);
  }

  if (input.title) {
    lines.push(`TITLE:${escapeVCardText(input.title)}`);
  }

  if (input.phone) {
    lines.push(`TEL;TYPE=CELL,VOICE:${input.phone.trim()}`);
  }

  if (input.email) {
    lines.push(`EMAIL;TYPE=WORK,INTERNET:${input.email.trim()}`);
  }

  if (input.url) {
    lines.push(`URL:${input.url.trim()}`);
  }

  if (input.photoUrl) {
    lines.push(`PHOTO;VALUE=URI:${input.photoUrl.trim()}`);
  }

  if (input.address) {
    const street = input.address.street ? escapeVCardText(input.address.street) : '';
    const city = input.address.city ? escapeVCardText(input.address.city) : '';
    const state = input.address.state ? escapeVCardText(input.address.state) : '';
    const postalCode = input.address.postalCode ? escapeVCardText(input.address.postalCode) : '';
    const country = input.address.country ? escapeVCardText(input.address.country) : '';

    lines.push(`ADR;TYPE=WORK:;;${street};${city};${state};${postalCode};${country}`);
  }

  if (input.note) {
    lines.push(`NOTE:${escapeVCardText(input.note)}`);
  }

  lines.push(`REV:${new Date().toISOString()}`);
  lines.push('END:VCARD');

  return lines.map((l) => foldVCardLine(l)).join('\r\n') + '\r\n';
}

