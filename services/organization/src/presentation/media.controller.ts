import { Controller, Get, Inject, NotFoundException, Optional, Param, Res } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { resolveMediaFile } from '../infrastructure/media-storage.service.js';

export const MEDIA_DIR = 'ORGANIZATION_MEDIA_DIR';

interface MediaResponse {
  setHeader(name: string, value: string): void;
  end(body: Buffer): void;
}

/**
 * D-VPS-DEPLOY B1: public logo files from LocalDiskMediaStorage. Names are random, so files
 * never change and cache for a year. SVGs are sandboxed (CSP), so a crafted SVG opened directly
 * cannot run script on this domain.
 */
@Controller('media')
export class MediaController {
  constructor(@Optional() @Inject(MEDIA_DIR) private readonly mediaDir?: string) {}

  @Get('tenants/:tenantId/logos/:file')
  async logo(@Param('tenantId') tenantId: string, @Param('file') file: string, @Res() res: MediaResponse): Promise<void> {
    const found = this.mediaDir ? resolveMediaFile(this.mediaDir, `tenants/${tenantId}/logos/${file}`) : null;
    if (!found) throw new NotFoundException({ title: 'Not Found', detail: 'No such file.' });
    let bytes: Buffer;
    try {
      bytes = await fs.readFile(found.file);
    } catch {
      throw new NotFoundException({ title: 'Not Found', detail: 'No such file.' });
    }
    res.setHeader('Content-Type', found.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.end(bytes);
  }
}
