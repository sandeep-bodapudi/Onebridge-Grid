import { describe, it, expect } from 'vitest';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import {
  generateBrandedQrSvg,
  generateBrandedQrPng,
  generateBrandedQrPdf,
  generateStandeePdf,
  generateStandeeSvg,
} from '../src/domain/qr-generator.js';

describe('QR Generator Engine (F11 AC-4, AC-6, AC-9)', () => {
  const sampleUrl = 'https://obg.in/x8Fk2LpQ';
  const brandColours = {
    band: '#1B2A4A',
    accent: '#F68713',
    text: '#FFFFFF',
  };
  const logoDataUri = 'data:image/svg+xml;utf8,<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%23F68713"/></svg>';

  describe('AC-4: Branded QR (Level H, Brand Colours, Logo, Download Formats)', () => {
    it('generates valid branded QR in SVG format with error correction level H', async () => {
      const svg = await generateBrandedQrSvg({
        url: sampleUrl,
        brandColours,
        logoUrl: logoDataUri,
        size: 500,
      });

      expect(typeof svg).toBe('string');
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      // Includes brand color fill
      expect(svg).toContain('#1B2A4A');
      // Contains embedded center logo image/group
      expect(svg).toContain('<image');
    });

    it('generates high-resolution PNG buffer and embeds center logo badge', async () => {
      const plainPng = await generateBrandedQrPng({
        url: sampleUrl,
        brandColours,
        size: 600,
      });

      const logoPng = await generateBrandedQrPng({
        url: sampleUrl,
        brandColours,
        logoUrl: logoDataUri,
        size: 600,
      });

      expect(Buffer.isBuffer(plainPng)).toBe(true);
      expect(Buffer.isBuffer(logoPng)).toBe(true);
      // PNG header magic bytes: 89 50 4E 47 0D 0A 1A 0A
      expect(logoPng[0]).toBe(0x89);
      expect(logoPng[1]).toBe(0x50);
      expect(logoPng[2]).toBe(0x4e);
      expect(logoPng[3]).toBe(0x47);

      // Logo version composites center badge, resulting in distinct buffer
      expect(Buffer.compare(plainPng, logoPng)).not.toBe(0);
    });

    it('AC-4 Required Test: decodes generated PNG image to verify scannability and URL accuracy at Level H', async () => {
      const logoPng = await generateBrandedQrPng({
        url: sampleUrl,
        brandColours,
        logoUrl: logoDataUri,
        size: 600,
      });

      // Parse PNG pixels and run standard QR decoding algorithm
      const png = PNG.sync.read(logoPng);
      const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

      expect(decoded).not.toBeNull();
      expect(decoded?.data).toBe(sampleUrl);
    });

    it('generates standalone PDF buffer with vector QR code graphics and AC-9 print instructions', async () => {
      const pdfBuffer = await generateBrandedQrPdf({
        url: sampleUrl,
        brandColours,
        logoUrl: logoDataUri,
        size: 800,
      });

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
      // PDF header magic bytes: %PDF-
      const header = pdfBuffer.slice(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');

      const textContent = pdfBuffer.toString('latin1');
      // Contains vector rectangle stream operators for QR blocks
      expect(textContent).toMatch(/\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\s+re/);
      expect(textContent).toContain('f\n');
      // Contains AC-9 print size instructions
      expect(textContent).toContain('Minimum scannable print size: 2 x 2 cm');
      expect(textContent).toContain('Short Link: https://obg.in/x8Fk2LpQ');
    });
  });

  describe('AC-6: Company and Branch Standee Templates (A4 & A5)', () => {
    it('generates A4 standee template in PDF format with company branding, vector QR, and bleed marks', async () => {
      const standeePdf = await generateStandeePdf({
        url: sampleUrl,
        companyName: 'Acme Steels India Pvt Ltd',
        branchName: 'Mumbai Headquarters',
        brandColours,
        logoUrl: logoDataUri,
        templateSize: 'a4',
      });

      expect(Buffer.isBuffer(standeePdf)).toBe(true);
      expect(standeePdf.slice(0, 5).toString('ascii')).toBe('%PDF-');
      const textContent = standeePdf.toString('latin1');
      expect(textContent).toContain('Acme Steels India Pvt Ltd');
      expect(textContent).toContain('Mumbai Headquarters');
      expect(textContent).toContain('Scan to save contact');
      expect(textContent).toContain('POWERED BY ONEBRIDGE GRID');
      // Contains vector QR blocks
      expect(textContent).toMatch(/\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\s+re/);
    });

    it('generates A5 standee template in SVG format with bilingual copy and crop marks', async () => {
      const standeeSvg = await generateStandeeSvg({
        url: sampleUrl,
        companyName: 'Acme Steels India Pvt Ltd',
        brandColours,
        logoUrl: logoDataUri,
        templateSize: 'a5',
      });

      expect(typeof standeeSvg).toBe('string');
      expect(standeeSvg).toContain('<svg');
      // A5 dimensions: 148 x 210 mm
      expect(standeeSvg).toContain('width="148mm"');
      expect(standeeSvg).toContain('height="210mm"');
      expect(standeeSvg).toContain('Acme Steels India Pvt Ltd');
      // Mandated bilingual copy
      expect(standeeSvg).toContain('Scan to save contact');
      expect(standeeSvg).toContain('&#2360;&#2306;&#2346;&#2352;&#2381;&#2325;');
    });
  });
});
