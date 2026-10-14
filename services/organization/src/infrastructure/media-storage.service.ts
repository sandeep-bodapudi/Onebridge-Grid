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

@Injectable()
export class FakeMediaStorageService implements MediaStorageService {
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  private static readonly ALLOWED_MIME_TYPES = [
    'image/png',
    'image/svg+xml',
    'image/webp',
  ];
  private static readonly ALLOWED_EXTENSIONS = ['.png', '.svg', '.webp'];

  async uploadLogo(
    tenantId: string,
    dto: UploadLogoDto,
    correlationId = 'unknown'
  ): Promise<UploadedMediaResult> {
    if (!dto.filename || !dto.contentType || typeof dto.size !== 'number') {
      throw new BadRequestException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Bad Request',
        status: 400,
        detail: 'filename, contentType, and size are required for logo upload',
        correlationId,
      });
    }

    // 1. Validate file format / MIME type
    const lowerContentType = dto.contentType.toLowerCase().trim();
    if (!FakeMediaStorageService.ALLOWED_MIME_TYPES.includes(lowerContentType)) {
      throw new BadRequestException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Bad Request',
        status: 400,
        detail: `Unsupported image format: "${dto.contentType}". Allowed formats: PNG, SVG, WebP.`,
        correlationId,
      });
    }

    const lowerFilename = dto.filename.toLowerCase().trim();
    const hasValidExt = FakeMediaStorageService.ALLOWED_EXTENSIONS.some((ext) =>
      lowerFilename.endsWith(ext)
    );
    if (!hasValidExt) {
      throw new BadRequestException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Bad Request',
        status: 400,
        detail: `File extension not permitted. Allowed formats: PNG (.png), SVG (.svg), WebP (.webp).`,
        correlationId,
      });
    }

    // 2. Enforce size limit (max 5 MB)
    if (dto.size > FakeMediaStorageService.MAX_FILE_SIZE) {
      throw new BadRequestException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Bad Request',
        status: 400,
        detail: `File size exceeds the 5MB maximum limit (provided: ${(dto.size / (1024 * 1024)).toFixed(1)}MB).`,
        correlationId,
      });
    }

    // 3. Fake virus and malware scan
    const scanTarget = `${lowerFilename} ${dto.contentBase64 || ''}`.toLowerCase();
    if (scanTarget.includes('eicar') || scanTarget.includes('infected') || scanTarget.includes('malware')) {
      throw new UnprocessableEntityException({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Malware signature detected. File rejected by automated virus scanner.',
        correlationId,
      });
    }

    // 4. Fake resize & metadata normalization
    const safeFilename = dto.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `tenants/${tenantId}/logos/${safeFilename}`;
    const url = `https://cdn.onebridge.in/${key}`;

    return {
      url,
      key,
      width: 400,
      height: 400,
    };
  }
}
