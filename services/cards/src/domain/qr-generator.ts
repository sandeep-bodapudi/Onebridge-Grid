import QRCode from 'qrcode';
import { PNG } from 'pngjs';

export interface BrandColours {
  band: string;
  accent?: string;
  text: string;
}

export interface BrandedQrOptions {
  url: string;
  brandColours: BrandColours;
  logoUrl?: string;
  size?: number; // default 1000 for high-res print
}

export interface StandeeOptions {
  url: string;
  companyName: string;
  branchName?: string;
  brandColours: BrandColours;
  logoUrl?: string;
  templateSize?: 'a4' | 'a5';
}

/**
 * Generates branded SVG QR code with error correction Level H and embedded center logo.
 */
export async function generateBrandedQrSvg(options: BrandedQrOptions): Promise<string> {
  const size = options.size || 1000;
  const darkColor = options.brandColours.band || '#1B2A4A';
  const lightColor = '#FFFFFF';

  // Level H error correction (30% recovery) allows up to ~22% center obstruction without data loss
  const rawSvg = await QRCode.toString(options.url, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    width: size,
    color: {
      dark: darkColor,
      light: lightColor,
    },
  });

  // If no logo, return styled QR svg directly
  if (!options.logoUrl) {
    return rawSvg;
  }

  // Inject logo overlay in the center
  // Extract viewBox width/height
  const viewBoxMatch = /viewBox="0 0 (\d+) (\d+)"/.exec(rawSvg);
  const vbWidth = viewBoxMatch ? parseInt(viewBoxMatch[1], 10) : 100;
  const vbHeight = viewBoxMatch ? parseInt(viewBoxMatch[2], 10) : 100;

  // Center badge diameter: ~22% of QR dimension
  const badgeSize = Math.round(vbWidth * 0.22);
  const badgeX = (vbWidth - badgeSize) / 2;
  const badgeY = (vbHeight - badgeSize) / 2;
  const badgeCenter = vbWidth / 2;
  const badgeRadius = badgeSize / 2;

  // Padding inside logo badge
  const logoPadding = Math.max(1, Math.round(badgeSize * 0.15));
  const logoX = badgeX + logoPadding;
  const logoY = badgeY + logoPadding;
  const logoSize = badgeSize - logoPadding * 2;

  const overlaySvg = `
  <g id="center-logo-group">
    <!-- Center circular white backdrop badge -->
    <circle cx="${badgeCenter}" cy="${badgeCenter}" r="${badgeRadius}" fill="#FFFFFF" stroke="${options.brandColours.accent || '#F68713'}" stroke-width="1.5" />
    <image href="${escapeXml(options.logoUrl)}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet" />
  </g>
</svg>`;

  return rawSvg.replace('</svg>', overlaySvg);
}

/**
 * Generates high-resolution PNG Buffer for print (300 DPI, scannable at 2 cm).
 * When logoUrl is provided, composites a center protective badge and brand accent stroke
 * within the Level H 30% error correction budget.
 */
export async function generateBrandedQrPng(options: BrandedQrOptions): Promise<Buffer> {
  const size = options.size || 1200;
  const darkColor = options.brandColours.band || '#1B2A4A';
  const lightColor = '#FFFFFF';

  // Generate base PNG buffer with error correction Level H (30% recovery budget)
  const buffer = await QRCode.toBuffer(options.url, {
    type: 'png',
    errorCorrectionLevel: 'H',
    width: size,
    margin: 2,
    color: {
      dark: darkColor,
      light: lightColor,
    },
  });

  if (!options.logoUrl) {
    return buffer;
  }

  // Composite center circular logo badge within Level H recovery budget
  const png = PNG.sync.read(buffer);
  const cx = png.width / 2;
  const cy = png.height / 2;
  // Center logo badge radius: ~10% of QR size (diameter ~20% of QR, within 30% Level H budget)
  const badgeRadius = Math.round(png.width * 0.10);
  const borderWidth = Math.max(2, Math.round(badgeRadius * 0.12));

  // Accent color parsing
  const accentHex = options.brandColours.accent || '#F68713';
  const cleanHex = accentHex.startsWith('#') ? accentHex.slice(1) : accentHex;
  const accentR = parseInt(cleanHex.slice(0, 2), 16) || 246;
  const accentG = parseInt(cleanHex.slice(2, 4), 16) || 135;
  const accentB = parseInt(cleanHex.slice(4, 6), 16) || 19;

  for (let y = Math.floor(cy - badgeRadius); y <= Math.ceil(cy + badgeRadius); y++) {
    for (let x = Math.floor(cx - badgeRadius); x <= Math.ceil(cx + badgeRadius); x++) {
      if (x < 0 || x >= png.width || y < 0 || y >= png.height) continue;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= badgeRadius) {
        const idx = (y * png.width + x) * 4;
        if (dist > badgeRadius - borderWidth) {
          // Accent circular border
          png.data[idx] = accentR;
          png.data[idx + 1] = accentG;
          png.data[idx + 2] = accentB;
          png.data[idx + 3] = 255;
        } else {
          // White circular backdrop for logo
          png.data[idx] = 255;
          png.data[idx + 1] = 255;
          png.data[idx + 2] = 255;
          png.data[idx + 3] = 255;
        }
      }
    }
  }

  return PNG.sync.write(png);
}

/**
 * Generates standalone print-resolution PDF Buffer containing the branded vector QR.
 */
export async function generateBrandedQrPdf(options: BrandedQrOptions): Promise<Buffer> {
  return buildMinimalPdf({
    pageWidthPt: 595.28, // A4 width in pt
    pageHeightPt: 841.89, // A4 height in pt
    title: 'OneBridge Branded QR',
    url: options.url,
    brandColours: options.brandColours,
    logoUrl: options.logoUrl,
    caption: options.url,
  });
}

/**
 * Generates A4 or A5 Standee Template in SVG format.
 */
export async function generateStandeeSvg(options: StandeeOptions): Promise<string> {
  const isA5 = options.templateSize === 'a5';
  const widthMm = isA5 ? 148 : 210;
  const heightMm = isA5 ? 210 : 297;

  // Generate embedded QR SVG
  const qrSvg = await generateBrandedQrSvg({
    url: options.url,
    brandColours: options.brandColours,
    logoUrl: options.logoUrl,
    size: 400,
  });

  const bandColor = options.brandColours.band || '#1B2A4A';
  const accentColor = options.brandColours.accent || '#F68713';
  const textColor = options.brandColours.text || '#FFFFFF';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm} ${heightMm}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .brand-title { font-family: 'Manrope', 'Helvetica Neue', sans-serif; font-size: 10px; font-weight: 700; fill: ${textColor}; text-anchor: middle; }
      .branch-subtitle { font-family: 'Manrope', 'Helvetica Neue', sans-serif; font-size: 6px; font-weight: 500; fill: #FAF7F2; text-anchor: middle; opacity: 0.9; }
      .scan-cta { font-family: 'Manrope', 'Helvetica Neue', sans-serif; font-size: 7.5px; font-weight: 700; fill: #1B2A4A; text-anchor: middle; }
      .scan-hint { font-family: 'Manrope', 'Helvetica Neue', sans-serif; font-size: 5px; fill: #6B7280; text-anchor: middle; }
      .footer-brand { font-family: 'Manrope', 'Helvetica Neue', sans-serif; font-size: 4px; fill: #9CA3AF; text-anchor: middle; letter-spacing: 1px; }
    </style>
  </defs>

  <!-- Background Base -->
  <rect width="${widthMm}" height="${heightMm}" fill="#FAF7F2" />

  <!-- Top Brand Banner -->
  <rect x="0" y="0" width="${widthMm}" height="${heightMm * 0.28}" fill="${bandColor}" />
  <!-- Accent Border Line -->
  <line x1="0" y1="${heightMm * 0.28}" x2="${widthMm}" y2="${heightMm * 0.28}" stroke="${accentColor}" stroke-width="2" />

  <!-- Company Logo (if provided) -->
  ${options.logoUrl ? `<image href="${escapeXml(options.logoUrl)}" x="${(widthMm - 24) / 2}" y="12" width="24" height="24" preserveAspectRatio="xMidYMid meet" />` : ''}

  <!-- Company Name -->
  <text x="${widthMm / 2}" y="${options.logoUrl ? 44 : 28}" class="brand-title">${escapeXml(options.companyName)}</text>
  ${options.branchName ? `<text x="${widthMm / 2}" y="${options.logoUrl ? 52 : 36}" class="branch-subtitle">${escapeXml(options.branchName)}</text>` : ''}

  <!-- White QR Card Stage -->
  <rect x="${widthMm * 0.12}" y="${heightMm * 0.34}" width="${widthMm * 0.76}" height="${widthMm * 0.76}" rx="12" fill="#FFFFFF" stroke="#E5E7EB" stroke-width="1" />

  <!-- QR Code Embedded -->
  <g transform="translate(${widthMm * 0.16}, ${heightMm * 0.36}) scale(${(widthMm * 0.68) / 100})">
    ${stripSvgTag(qrSvg)}
  </g>

  <!-- CTA and Instructions (Mandated: "Scan to save contact / संपर्क सहेजने के लिए स्कैन करें") -->
  <text x="${widthMm / 2}" y="${heightMm * 0.34 + widthMm * 0.76 + 18}" class="scan-cta">Scan to save contact / &#2360;&#2306;&#2346;&#2352;&#2381;&#2325; &#2360;&#2361;&#2375;&#2332;&#2344;&#2375; &#2325;&#2375; &#2354;&#2368;&#2319; &#2360;&#2381;&#2325;&#2376;&#2344; &#2325;&#2352;&#2375;&#2306;</text>
  <text x="${widthMm / 2}" y="${heightMm * 0.34 + widthMm * 0.76 + 26}" class="scan-hint">Point your camera or QR reader at the code above</text>

  <!-- Footer Branding -->
  <text x="${widthMm / 2}" y="${heightMm - 8}" class="footer-brand">POWERED BY ONEBRIDGE GRID</text>

  <!-- Crop / Trim Lines for Printing -->
  <line x1="3" y1="0" x2="3" y2="8" stroke="#D1D5DB" stroke-width="0.5" />
  <line x1="0" y1="3" x2="8" y2="3" stroke="#D1D5DB" stroke-width="0.5" />
  <line x1="${widthMm - 3}" y1="0" x2="${widthMm - 3}" y2="8" stroke="#D1D5DB" stroke-width="0.5" />
  <line x1="${widthMm}" y1="3" x2="${widthMm - 8}" y2="3" stroke="#D1D5DB" stroke-width="0.5" />
  <line x1="3" y1="${heightMm}" x2="3" y2="${heightMm - 8}" stroke="#D1D5DB" stroke-width="0.5" />
  <line x1="0" y1="${heightMm - 3}" x2="8" y2="${heightMm - 3}" stroke="#D1D5DB" stroke-width="0.5" />
  <line x1="${widthMm - 3}" y1="${heightMm}" x2="${widthMm - 3}" y2="${heightMm - 8}" stroke="#D1D5DB" stroke-width="0.5" />
  <line x1="${widthMm}" y1="${heightMm - 3}" x2="${widthMm - 8}" y2="${heightMm - 3}" stroke="#D1D5DB" stroke-width="0.5" />
</svg>`;
}

/**
 * Generates Standee Template in PDF format with embedded vector QR code.
 */
export async function generateStandeePdf(options: StandeeOptions): Promise<Buffer> {
  const isA5 = options.templateSize === 'a5';
  // A4 in pt: 595.28 x 841.89 | A5 in pt: 419.53 x 595.28
  const widthPt = isA5 ? 419.53 : 595.28;
  const heightPt = isA5 ? 595.28 : 841.89;

  return buildMinimalPdf({
    pageWidthPt: widthPt,
    pageHeightPt: heightPt,
    title: `${options.companyName} Standee`,
    url: options.url,
    brandColours: options.brandColours,
    logoUrl: options.logoUrl,
    companyName: options.companyName,
    branchName: options.branchName,
    caption: options.url,
    isStandee: true,
  });
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripSvgTag(svg: string): string {
  return svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '');
}

/**
 * Constructs a valid standard PDF 1.4 document buffer with vector QR code graphics.
 */
function buildMinimalPdf(params: {
  pageWidthPt: number;
  pageHeightPt: number;
  title: string;
  url: string;
  brandColours: BrandColours;
  logoUrl?: string;
  companyName?: string;
  branchName?: string;
  caption?: string;
  isStandee?: boolean;
}): Buffer {
  const { pageWidthPt, pageHeightPt, title, url, brandColours, logoUrl, companyName, branchName, caption, isStandee } = params;

  const hex = brandColours.band.startsWith('#') ? brandColours.band.slice(1) : brandColours.band;
  const bandR = (parseInt(hex.slice(0, 2), 16) || 27) / 255;
  const bandG = (parseInt(hex.slice(2, 4), 16) || 42) / 255;
  const bandB = (parseInt(hex.slice(4, 6), 16) || 74) / 255;

  const accentHex = (brandColours.accent || '#F68713').replace('#', '');
  const accentR = (parseInt(accentHex.slice(0, 2), 16) || 246) / 255;
  const accentG = (parseInt(accentHex.slice(2, 4), 16) || 135) / 255;
  const accentB = (parseInt(accentHex.slice(4, 6), 16) || 19) / 255;

  const contentStreamParts: string[] = [];

  if (isStandee) {
    // Top banner
    const bannerH = pageHeightPt * 0.28;
    contentStreamParts.push(`${bandR.toFixed(3)} ${bandG.toFixed(3)} ${bandB.toFixed(3)} rg`);
    contentStreamParts.push(`0 ${(pageHeightPt - bannerH).toFixed(2)} ${pageWidthPt.toFixed(2)} ${bannerH.toFixed(2)} re f`);

    // Accent line
    contentStreamParts.push(`${accentR.toFixed(3)} ${accentG.toFixed(3)} ${accentB.toFixed(3)} RG 2 w`);
    contentStreamParts.push(`0 ${(pageHeightPt - bannerH).toFixed(2)} m ${pageWidthPt.toFixed(2)} ${(pageHeightPt - bannerH).toFixed(2)} l S`);

    // White card stage for QR
    const stageW = pageWidthPt * 0.74;
    const stageH = stageW;
    const stageX = (pageWidthPt - stageW) / 2;
    const stageY = pageHeightPt * 0.32;
    contentStreamParts.push(`1 1 1 rg ${stageX.toFixed(2)} ${stageY.toFixed(2)} ${stageW.toFixed(2)} ${stageH.toFixed(2)} re f`);
    contentStreamParts.push(`0.9 0.9 0.9 RG 1 w ${stageX.toFixed(2)} ${stageY.toFixed(2)} ${stageW.toFixed(2)} ${stageH.toFixed(2)} re s`);

    // Draw Vector QR inside stage
    const qrSize = stageW * 0.84;
    const qrX = stageX + (stageW - qrSize) / 2;
    const qrY = stageY + (stageH - qrSize) / 2;
    contentStreamParts.push(renderVectorQr(url, qrX, qrY, qrSize, bandR, bandG, bandB, Boolean(logoUrl)));

    // Crop / trim marks around edges (3mm ≈ 8.5 pt)
    contentStreamParts.push('0.8 0.8 0.8 RG 0.5 w');
    contentStreamParts.push(`8.5 0 m 8.5 22 l S 0 8.5 m 22 8.5 l S`);
    contentStreamParts.push(`${(pageWidthPt - 8.5).toFixed(2)} 0 m ${(pageWidthPt - 8.5).toFixed(2)} 22 l S ${pageWidthPt.toFixed(2)} 8.5 m ${(pageWidthPt - 22).toFixed(2)} 8.5 l S`);
    contentStreamParts.push(`8.5 ${pageHeightPt.toFixed(2)} m 8.5 ${(pageHeightPt - 22).toFixed(2)} l S 0 ${(pageHeightPt - 8.5).toFixed(2)} m 22 ${(pageHeightPt - 8.5).toFixed(2)} l S`);
    contentStreamParts.push(`${(pageWidthPt - 8.5).toFixed(2)} ${pageHeightPt.toFixed(2)} m ${(pageWidthPt - 8.5).toFixed(2)} ${(pageHeightPt - 22).toFixed(2)} l S ${pageWidthPt.toFixed(2)} ${(pageHeightPt - 8.5).toFixed(2)} m ${(pageWidthPt - 22).toFixed(2)} ${(pageHeightPt - 8.5).toFixed(2)} l S`);

    // Text content
    contentStreamParts.push('BT');
    contentStreamParts.push('/F1 20 Tf 1 1 1 rg');
    contentStreamParts.push(`50 ${(pageHeightPt - 60).toFixed(2)} Td`);
    contentStreamParts.push(`(${escapePdf(companyName || title)}) Tj`);

    if (branchName) {
      contentStreamParts.push('/F1 12 Tf 0.9 0.9 0.9 rg');
      contentStreamParts.push('0 -22 Td');
      contentStreamParts.push(`(${escapePdf(branchName)}) Tj`);
    }

    // CTA under stage
    contentStreamParts.push(`/F1 14 Tf ${bandR.toFixed(3)} ${bandG.toFixed(3)} ${bandB.toFixed(3)} rg`);
    contentStreamParts.push(`${stageX.toFixed(2)} ${(stageY - 28).toFixed(2)} Td`);
    contentStreamParts.push('(Scan to save contact) Tj');

    contentStreamParts.push('/F1 9 Tf 0.45 0.45 0.45 rg');
    contentStreamParts.push('0 -16 Td');
    contentStreamParts.push('(Point your camera or QR reader at the code above) Tj');

    contentStreamParts.push('/F1 8 Tf 0.6 0.6 0.6 rg');
    contentStreamParts.push('0 -28 Td');
    contentStreamParts.push('(POWERED BY ONEBRIDGE GRID) Tj');
    contentStreamParts.push('ET');
  } else {
    // Standalone Branded QR PDF
    contentStreamParts.push('BT');
    contentStreamParts.push(`/F1 20 Tf ${bandR.toFixed(3)} ${bandG.toFixed(3)} ${bandB.toFixed(3)} rg`);
    contentStreamParts.push(`50 ${(pageHeightPt - 70).toFixed(2)} Td`);
    contentStreamParts.push(`(${escapePdf(title)}) Tj`);

    if (caption) {
      contentStreamParts.push('/F1 10 Tf 0.4 0.4 0.4 rg');
      contentStreamParts.push('0 -20 Td');
      contentStreamParts.push(`(Short Link: ${escapePdf(caption)}) Tj`);
    }
    contentStreamParts.push('ET');

    // Draw Vector QR Code in Center
    const qrSize = Math.min(pageWidthPt, pageHeightPt) * 0.60;
    const qrX = (pageWidthPt - qrSize) / 2;
    const qrY = (pageHeightPt - qrSize) / 2 - 20;
    contentStreamParts.push(renderVectorQr(url, qrX, qrY, qrSize, bandR, bandG, bandB, Boolean(logoUrl)));

    // Minimum print size instructions (AC-9)
    contentStreamParts.push('BT');
    contentStreamParts.push('/F1 9 Tf 0.4 0.4 0.4 rg');
    contentStreamParts.push(`${qrX.toFixed(2)} ${(qrY - 24).toFixed(2)} Td`);
    contentStreamParts.push('(Minimum scannable print size: 2 x 2 cm | Error Correction Level H) Tj');
    contentStreamParts.push('ET');
  }

  const streamContent = contentStreamParts.join('\n');
  const streamLength = Buffer.byteLength(streamContent, 'utf-8');

  const objects: string[] = [];

  // Obj 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  // Obj 2: Pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  // Obj 3: Page
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt.toFixed(2)} ${pageHeightPt.toFixed(2)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj`
  );
  // Obj 4: Contents
  objects.push(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj`);
  // Obj 5: Font
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');

  let offset = 0;
  const header = '%PDF-1.4\n';
  offset += Buffer.byteLength(header, 'utf-8');

  const xrefEntries: string[] = ['0000000000 65535 f \n'];
  let body = '';

  for (let i = 0; i < objects.length; i++) {
    const entryOffset = offset + Buffer.byteLength(body, 'utf-8');
    xrefEntries.push(String(entryOffset).padStart(10, '0') + ' 00000 n \n');
    body += objects[i] + '\n';
  }

  const xrefOffset = offset + Buffer.byteLength(body, 'utf-8');
  const xref = `xref\n0 ${objects.length + 1}\n${xrefEntries.join('')}`;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(header + body + xref + trailer, 'latin1');
}

/**
 * Draws sharp, vector QR module blocks in PDF coordinate space.
 */
function renderVectorQr(
  url: string,
  qrX: number,
  qrY: number,
  qrBoxSize: number,
  r: number,
  g: number,
  b: number,
  hasLogo: boolean
): string {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
  const moduleCount = qr.modules.size;
  const modSize = qrBoxSize / moduleCount;

  const commands: string[] = [];
  commands.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);

  const centerMod = moduleCount / 2;
  const cutoutRadius = hasLogo ? moduleCount * 0.11 : 0;

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (qr.modules.get(row, col)) {
        if (hasLogo) {
          const dist = Math.sqrt((col + 0.5 - centerMod) ** 2 + (row + 0.5 - centerMod) ** 2);
          if (dist <= cutoutRadius) {
            continue; // Clear center for logo badge
          }
        }
        const x = qrX + col * modSize;
        const y = qrY + (moduleCount - 1 - row) * modSize;
        commands.push(`${x.toFixed(2)} ${y.toFixed(2)} ${modSize.toFixed(2)} ${modSize.toFixed(2)} re`);
      }
    }
  }

  commands.push('f');

  if (hasLogo) {
    const badgeSize = qrBoxSize * 0.22;
    const badgeX = qrX + (qrBoxSize - badgeSize) / 2;
    const badgeY = qrY + (qrBoxSize - badgeSize) / 2;
    // White backdrop
    commands.push('1 1 1 rg');
    commands.push(`${badgeX.toFixed(2)} ${badgeY.toFixed(2)} ${badgeSize.toFixed(2)} ${badgeSize.toFixed(2)} re f`);
    // Stroke
    commands.push('0.96 0.53 0.07 RG 1.5 w');
    commands.push(`${badgeX.toFixed(2)} ${badgeY.toFixed(2)} ${badgeSize.toFixed(2)} ${badgeSize.toFixed(2)} re s`);
  }

  return commands.join('\n');
}

function escapePdf(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
