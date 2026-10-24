#!/usr/bin/env node
/**
 * Budget and Performance Verification for OneBridge Grid Visitor Card (F12 / Step 3 Exit Gate).
 * 
 * Verifies:
 * 1. First-load JS weight for visitor route (/c/[org]/[person]) <= 300 KB transfer budget (ADR-0003 / F12).
 * 2. LCP <= 1.5s on simulated 4G connection (Lighthouse / Web Vitals budget).
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const webPublicDir = path.join(rootDir, 'apps', 'web-public');
const nextDir = path.join(webPublicDir, '.next');

const MAX_FIRST_LOAD_JS_BYTES = 300 * 1024; // 300 KB budget
const MAX_LCP_MS = 1500; // 1.5s on simulated 4G

function checkBundleBudget() {
  console.log('====================================================');
  console.log('1. Checking Visitor Card First-Load JS Budget (<= 300 KB)');
  console.log('====================================================');

  const manifestPath = path.join(nextDir, 'app-build-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`Error: ${manifestPath} does not exist. Run "pnpm --filter @onebridge/web-public build" first.`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const routeKey = '/c/[org]/[person]/page';
  const chunks = manifest.pages?.[routeKey];

  if (!Array.isArray(chunks)) {
    console.error(`Error: Route "${routeKey}" not found in app-build-manifest.json`);
    process.exit(1);
  }

  const layoutChunks = manifest.pages?.['/layout'] || [];
  const allChunks = Array.from(new Set([...layoutChunks, ...chunks]));

  let totalRawBytes = 0;
  let totalGzipBytes = 0;

  for (const chunk of allChunks) {
    if (!chunk.endsWith('.js')) continue;
    const chunkPath = path.join(nextDir, chunk);
    if (fs.existsSync(chunkPath)) {
      const buf = fs.readFileSync(chunkPath);
      const gzipBuf = zlib.gzipSync(buf);
      totalRawBytes += buf.length;
      totalGzipBytes += gzipBuf.length;
      console.log(`  - ${chunk}: ${(gzipBuf.length / 1024).toFixed(1)} KB (gzip) / ${(buf.length / 1024).toFixed(1)} KB (raw)`);
    }
  }

  const gzipKb = (totalGzipBytes / 1024).toFixed(2);
  const rawKb = (totalRawBytes / 1024).toFixed(2);

  console.log(`\nVisitor Page First Load JS:`);
  console.log(`  - Transfer size (gzip): ${gzipKb} KB (Budget: 300.00 KB)`);
  console.log(`  - Uncompressed size:   ${rawKb} KB`);

  if (totalGzipBytes > MAX_FIRST_LOAD_JS_BYTES) {
    console.error(`❌ BUDGET EXCEEDED: ${gzipKb} KB > 300.00 KB limit.`);
    process.exit(1);
  }

  console.log(`✅ BUNDLE BUDGET MET: ${gzipKb} KB <= 300.00 KB.\n`);
}

async function startMockCardsService(port = 4099) {
  const server = http.createServer((req, res) => {
    if (req.url?.startsWith('/public/c/')) {
      const mockCard = {
        cardId: '01JD2XCARD000000000000001',
        slug: 'sahyadri-steel-works/sneha',
        status: 'published',
        templateId: 'classic-charcoal',
        language: 'en',
        verifiedBadge: true,
        person: {
          name: 'Sneha Reddy',
          designation: 'Sales Lead',
          phone: '+919876543210',
          email: 'sneha@sahyadristeel.com',
        },
        company: {
          id: '01JD2XTENANT0000000000001',
          businessId: 'OB-T15EH7',
          name: 'Sahyadri Steel Works',
        },
        sections: [],
        actions: {
          saveContactUrl: '/c/sahyadri-steel-works/sneha/vcard',
        },
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mockCard));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(port, resolve));
  return server;
}

async function waitForHttp(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200 || res.status === 404) return;
    } catch {
      // Retry
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function checkLcpBudget() {
  console.log('====================================================');
  console.log('2. Checking Visitor Card LCP on Simulated 4G (<= 1.5s)');
  console.log('====================================================');

  const { chromium } = await import('@playwright/test');
  const mockPort = 4099;
  const webPort = 3099;

  const mockServer = await startMockCardsService(mockPort);
  console.log(`Started mock cards backend on port ${mockPort}`);

  const isWindows = process.platform === 'win32';
  const command = `pnpm --filter @onebridge/web-public exec next start -p ${webPort}`;
  const nextProcess = spawn(command, {
    cwd: rootDir,
    shell: true,
    env: {
      ...process.env,
      PORT: String(webPort),
      CARDS_SERVICE_URL: `http://localhost:${mockPort}`,
    },
    stdio: 'pipe',
  });

  try {
    console.log(`Waiting for web-public on port ${webPort}...`);
    await waitForHttp(`http://localhost:${webPort}/c/sahyadri-steel-works/sneha`, 20000);
    console.log(`web-public is responding on port ${webPort}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Emulate 4G network conditions via CDP
    const client = await context.newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150, // 150ms RTT
      downloadThroughput: (4 * 1024 * 1024) / 8, // 4 Mbps
      uploadThroughput: (3 * 1024 * 1024) / 8, // 3 Mbps
    });

    console.log('Navigating with simulated 4G network throttling...');
    await page.goto(`http://localhost:${webPort}/c/sahyadri-steel-works/sneha`, {
      waitUntil: 'load',
    });

    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        let maxLcp = 0;
        const PerfObserver = window.PerformanceObserver;
        const perf = window.performance;

        if (!PerfObserver) {
          resolve(perf ? perf.now() : 0);
          return;
        }

        const observer = new PerfObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (entry.startTime > maxLcp) maxLcp = entry.startTime;
          }
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });

        setTimeout(() => {
          observer.disconnect();
          resolve(maxLcp || (perf ? perf.now() : 0));
        }, 1200);
      });
    });

    await browser.close();

    console.log(`Measured LCP on simulated 4G: ${lcp.toFixed(1)} ms (Budget: ${MAX_LCP_MS} ms)`);

    if (lcp > MAX_LCP_MS) {
      console.error(`❌ LCP BUDGET EXCEEDED: ${lcp.toFixed(1)} ms > ${MAX_LCP_MS} ms limit.`);
      process.exit(1);
    }

    console.log(`✅ LCP BUDGET MET: ${lcp.toFixed(1)} ms <= ${MAX_LCP_MS} ms.`);
  } finally {
    if (isWindows) {
      try {
        spawn('taskkill', ['/pid', String(nextProcess.pid), '/f', '/t'], { stdio: 'ignore' });
      } catch {
        nextProcess.kill();
      }
    } else {
      nextProcess.kill();
    }
    mockServer.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  checkBundleBudget();

  if (!args.includes('--bundle-only')) {
    await checkLcpBudget();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Budget check encountered an error:', err);
  process.exit(1);
});

