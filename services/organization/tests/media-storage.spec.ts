import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { LocalDiskMediaStorage, resolveMediaFile } from '../src/infrastructure/media-storage.service.js';
import { MediaController, MEDIA_DIR } from '../src/presentation/media.controller.js';
import { selectMediaStorage } from '../src/organization.module.js';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(24, 1)]);
const SVG = Buffer.from('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');
const TENANT = '01JACTENANTA00000000000000';

const dto = (bytes: Buffer, contentType: string, filename: string) => ({ filename, contentType, size: bytes.length, contentBase64: bytes.toString('base64') });

describe('D-VPS-DEPLOY logos on disk', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'ob-media-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('stores the real bytes under a random name and returns a public URL', async () => {
    const store = new LocalDiskMediaStorage(dir, '/svc/organization');
    const res = await store.uploadLogo(TENANT, dto(PNG, 'image/png', 'logo.png'));
    expect(res.url).toMatch(new RegExp(`^/svc/organization/media/tenants/${TENANT}/logos/[0-9a-f-]{36}\\.png$`));
    const found = resolveMediaFile(dir, res.key)!;
    expect(readFileSync(found.file).equals(PNG)).toBe(true);
    expect(found.contentType).toBe('image/png');
  });

  it('refuses files whose bytes are not the claimed image type, empty files and missing content', async () => {
    const store = new LocalDiskMediaStorage(dir, '/svc/organization');
    await expect(store.uploadLogo(TENANT, dto(Buffer.from('<html>hi</html>'), 'image/png', 'logo.png'))).rejects.toMatchObject({ status: 400 });
    await expect(store.uploadLogo(TENANT, dto(PNG, 'image/svg+xml', 'logo.svg'))).rejects.toMatchObject({ status: 400 });
    await expect(store.uploadLogo(TENANT, { filename: 'logo.png', contentType: 'image/png', size: 10 })).rejects.toMatchObject({ status: 400 });
    expect((await store.uploadLogo(TENANT, dto(SVG, 'image/svg+xml', 'logo.svg'))).url).toMatch(/\.svg$/);
  });

  it('keeps the F07 rules (format, extension, 5 MB)', async () => {
    const store = new LocalDiskMediaStorage(dir, '/svc/organization');
    await expect(store.uploadLogo(TENANT, dto(PNG, 'image/gif', 'logo.gif'))).rejects.toMatchObject({ status: 400 });
    await expect(store.uploadLogo(TENANT, { ...dto(PNG, 'image/png', 'logo.png'), size: 6 * 1024 * 1024 })).rejects.toMatchObject({ status: 400 });
  });

  it('never resolves a key outside the media folder', () => {
    for (const key of ['../../etc/passwd', `tenants/${TENANT}/logos/../../x.png`, `tenants/a/logos/not-a-uuid.png`, 'tenants/../logos/00000000-0000-0000-0000-000000000000.png']) {
      expect(resolveMediaFile(dir, key)).toBeNull();
    }
  });

  it('needs MEDIA_DIR in production', () => {
    const base = { port: 4002, appUrl: '', mongoUri: '', identityApiUrl: '', internalServiceKey: '' };
    expect(() => selectMediaStorage({ ...base, nodeEnv: 'production' })).toThrow(/MEDIA_DIR is required/);
    expect(selectMediaStorage({ ...base, nodeEnv: 'production', mediaDir: dir })).toBeInstanceOf(LocalDiskMediaStorage);
  });
});

describe('D-VPS-DEPLOY media route', () => {
  let dir: string;
  let app: INestApplication;

  beforeEach(async () => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'ob-media-'));
    const moduleRef = await Test.createTestingModule({ controllers: [MediaController], providers: [{ provide: MEDIA_DIR, useValue: dir }] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterEach(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('serves a stored SVG sandboxed and cacheable, and 404s for anything else', async () => {
    const { url } = await new LocalDiskMediaStorage(dir, '').uploadLogo(TENANT, dto(SVG, 'image/svg+xml', 'logo.svg'));
    const res = await request(app.getHttpServer()).get(url).expect(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
    expect(res.headers['content-security-policy']).toContain('sandbox');
    expect(res.headers['cache-control']).toContain('immutable');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    await request(app.getHttpServer()).get(`/media/tenants/${TENANT}/logos/00000000-0000-0000-0000-000000000000.png`).expect(404);
    await request(app.getHttpServer()).get('/media/tenants/..%2F..%2Fetc/logos/passwd').expect(404);
  });
});
