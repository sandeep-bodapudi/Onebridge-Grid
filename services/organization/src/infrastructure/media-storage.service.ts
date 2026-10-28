import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  Injectable,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UploadLogoDto } from '../domain/brand-kit.js';

export interface UploadedMediaResult {
  url: string;
  key: string;
  width: number;
  height: number;
}

export interface MediaStorageService {
  uploadLogo(tenantId: string, dto: UploadLogoDto, correlationId?: string): Promise<UploadedMediaResult>;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/svg+xml', 'image/webp'];
const EXTENSION_FOR: Record<string, string> = { 'image/png': '.png', 'image/svg+xml': '.svg', 'image/webp': '.webp' };

function bad(detail: string, correlationId: string): BadRequestException {
  return new BadRequestException({ type: 'https://tools.ietf.org/html/rfc7807', title: 'Bad Request', status: 400, detail, correlationId });
}

/** F07 logo rules, shared by every storage adapter: required fields, format, extension, size, scan. */
export function validateLogo(dto: UploadLogoDto, correlationId: string): { contentType: string; filename: string } {
  if (!dto.filename || !dto.contentType || typeof dto.size !== 'number') {
    throw bad('filename, contentType, and size are required for logo upload', correlationId);
  }
  const contentType = dto.contentType.toLowerCase().trim();
  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    throw bad(`Unsupported image format: "${dto.contentType}". Allowed formats: PNG, SVG, WebP.`, correlationId);
  }
  const filename = dto.filename.toLowerCase().trim();
  if (!Object.values(EXTENSION_FOR).some((ext) => filename.endsWith(ext))) {
    throw bad('File extension not permitted. Allowed formats: PNG (.png), SVG (.svg), WebP (.webp).', correlationId);
  }
  if (dto.size > MAX_FILE_SIZE) {
    throw bad(`File size exceeds the 5MB maximum limit (provided: ${(dto.size / (1024 * 1024)).toFixed(1)}MB).`, correlationId);
  }
  const scanTarget = `${filename} ${dto.contentBase64 || ''}`.toLowerCase();
  if (scanTarget.includes('eicar') || scanTarget.includes('infected') || scanTarget.includes('malware')) {
    throw new UnprocessableEntityException({
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Unprocessable Entity',
      status: 422,
      detail: 'Malware signature detected. File rejected by automated virus scanner.',
      correlationId,
    });
  }
  return { contentType, filename };
}

/** Tests and local development: checks the rules, stores nothing. */
@Injectable()
export class FakeMediaStorageService implements MediaStorageService {
  async uploadLogo(tenantId: string, dto: UploadLogoDto, correlationId = 'unknown'): Promise<UploadedMediaResult> {
    validateLogo(dto, correlationId);
    const safeFilename = dto.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `tenants/${tenantId}/logos/${safeFilename}`;
    return { url: `https://cdn.onebridge.in/${key}`, key, width: 400, height: 400 };
  }
}

/** The bytes really are what the content type claims (first bytes for PNG and WebP; an <svg> root for SVG). */
function matchesType(bytes: Buffer, contentType: string): boolean {
  if (contentType === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === 'image/webp') return bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP';
  // trimStart also drops a leading byte-order mark.
  const head = bytes.subarray(0, 2048).toString('utf8').trimStart();
  return /^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head);
}

/**
 * D-VPS-DEPLOY B1: logos on the server's disk under MEDIA_DIR (a Docker volume), served by
 * organization at /media/<key> (/svc/organization/media/<key> through the router).
 */
export class LocalDiskMediaStorage implements MediaStorageService {
  constructor(
    private readonly mediaDir: string,
    /** Public prefix of the media route, e.g. "/svc/organization". */
    private readonly publicBase: string
  ) {}

  async uploadLogo(tenantId: string, dto: UploadLogoDto, correlationId = 'unknown'): Promise<UploadedMediaResult> {
    const { contentType } = validateLogo(dto, correlationId);
    if (!dto.contentBase64) throw bad('The logo file is missing. Choose the file again.', correlationId);
    const bytes = Buffer.from(dto.contentBase64.replace(/^data:[^,]*,/, ''), 'base64');
    if (bytes.length === 0) throw bad('The logo file is empty. Choose another file.', correlationId);
    if (bytes.length > MAX_FILE_SIZE) throw bad('File size exceeds the 5MB maximum limit.', correlationId);
    if (!matchesType(bytes, contentType)) throw bad("That file isn't a valid PNG, SVG or WebP image.", correlationId);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(tenantId)) throw bad('Unknown company.', correlationId);

    const key = `tenants/${tenantId}/logos/${crypto.randomUUID()}${EXTENSION_FOR[contentType]}`;
    const file = path.join(this.mediaDir, ...key.split('/'));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes, { flag: 'wx' });
    return { url: `${this.publicBase.replace(/\/+$/, '')}/media/${key}`, key, width: 400, height: 400 };
  }
}

export const MEDIA_CONTENT_TYPES: Record<string, string> = { '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

/** Resolves a public media key to a file inside mediaDir, or null for anything else (no path escapes). */
export function resolveMediaFile(mediaDir: string, key: string): { file: string; contentType: string } | null {
  const m = /^tenants\/([A-Za-z0-9_-]{1,64})\/logos\/([0-9a-f-]{36})(\.png|\.svg|\.webp)$/.exec(key);
  if (!m) return null;
  return { file: path.join(mediaDir, 'tenants', m[1], 'logos', `${m[2]}${m[3]}`), contentType: MEDIA_CONTENT_TYPES[m[3]] };
}
