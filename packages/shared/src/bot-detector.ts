/**
 * F12 AC-6: Filter automated search engine crawlers and scrapers
 * to prevent visitor scan and card-view analytics distortion.
 */

const BOT_PATTERNS = [
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /googlebot/i,
  /bingbot/i,
  /slurp/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /sogou/i,
  /exabot/i,
  /facebookexternalhit/i,
  /facebot/i,
  /ia_archiver/i,
  /headlesschrome/i,
  /lighthouse/i,
  /phantomjs/i,
  /selenium/i,
  /puppeteer/i,
  /playwright/i,
  /wget/i,
  /curl\//i,
  /python-requests/i,
  /aiohttp/i,
  /httpclient/i,
  /postmanruntime/i,
];

export function isBotUserAgent(userAgent?: string | null): boolean {
  if (!userAgent || typeof userAgent !== 'string' || userAgent.trim() === '') {
    return false;
  }
  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}
