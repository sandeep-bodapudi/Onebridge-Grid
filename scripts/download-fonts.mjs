import fs from 'fs';
import path from 'path';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchFontSubset(family, weight, subsetKeyword) {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const css = await fetch(url, { headers: { 'User-Agent': USER_AGENT } }).then(r => r.text());

  // Split by @font-face blocks
  const blocks = css.split('@font-face');
  for (const block of blocks) {
    if (block.toLowerCase().includes(subsetKeyword.toLowerCase())) {
      const match = block.match(/src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/);
      if (match) return match[1];
    }
  }

  // Fallback to the last woff2 in the css (which is typically latin in Google Fonts)
  const allMatches = [...css.matchAll(/src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g)];
  if (allMatches.length > 0) {
    return allMatches[allMatches.length - 1][1];
  }
  throw new Error(`Could not find woff2 font for ${family} ${weight} (${subsetKeyword})`);
}

async function downloadFile(url, destPath) {
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const buffer = await fetch(url).then(r => r.arrayBuffer());
  fs.writeFileSync(destPath, Buffer.from(buffer));
  console.log(`Saved: ${destPath} (${buffer.byteLength} bytes)`);
}

async function main() {
  const fonts = [
    { name: 'manrope-regular.woff2', family: 'Manrope', weight: 400, subset: 'latin' },
    { name: 'manrope-semibold.woff2', family: 'Manrope', weight: 600, subset: 'latin' },
    { name: 'manrope-bold.woff2', family: 'Manrope', weight: 700, subset: 'latin' },
    { name: 'noto-sans-devanagari-regular.woff2', family: 'Noto Sans Devanagari', weight: 400, subset: 'devanagari' },
    { name: 'noto-sans-devanagari-semibold.woff2', family: 'Noto Sans Devanagari', weight: 600, subset: 'devanagari' },
    { name: 'noto-sans-devanagari-bold.woff2', family: 'Noto Sans Devanagari', weight: 700, subset: 'devanagari' },
  ];

  const targetDirs = [
    path.resolve(process.cwd(), 'apps/web-app/public/fonts'),
    path.resolve(process.cwd(), 'apps/web-public/public/fonts'),
    path.resolve(process.cwd(), 'packages/ui-kit/public/fonts'),
  ];

  for (const font of fonts) {
    console.log(`Fetching URL for ${font.family} ${font.weight}...`);
    const fontUrl = await fetchFontSubset(font.family, font.weight, font.subset);
    console.log(`-> ${fontUrl}`);
    for (const dir of targetDirs) {
      await downloadFile(fontUrl, path.join(dir, font.name));
    }
  }

  console.log('All fonts downloaded and self-hosted successfully.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
