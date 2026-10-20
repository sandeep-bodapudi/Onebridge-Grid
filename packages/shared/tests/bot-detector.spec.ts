import { describe, it, expect } from 'vitest';
import { isBotUserAgent } from '../src/bot-detector.js';

describe('AC-6: Bot and Search Crawler Filtering', () => {
  it('detects search engine web crawlers', () => {
    expect(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true);
    expect(isBotUserAgent('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')).toBe(true);
    expect(isBotUserAgent('DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)')).toBe(true);
    expect(isBotUserAgent('Baiduspider+(+http://www.baidu.com/search/spider.htm)')).toBe(true);
    expect(isBotUserAgent('YandexBot/3.0; +http://yandex.com/bots')).toBe(true);
  });

  it('detects headless browsers, automated tools, and scrapers', () => {
    expect(isBotUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/118.0.0.0 Safari/537.36')).toBe(true);
    expect(isBotUserAgent('curl/8.4.0')).toBe(true);
    expect(isBotUserAgent('Wget/1.21.4')).toBe(true);
    expect(isBotUserAgent('python-requests/2.31.0')).toBe(true);
    expect(isBotUserAgent('Mozilla/5.0 (compatible; Lighthouse)')).toBe(true);
  });

  it('allows genuine mobile and desktop browser user agents', () => {
    const mobileIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1';
    const mobileAndroid = 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.80 Mobile Safari/537.36';
    const desktopMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

    expect(isBotUserAgent(mobileIos)).toBe(false);
    expect(isBotUserAgent(mobileAndroid)).toBe(false);
    expect(isBotUserAgent(desktopMac)).toBe(false);
  });

  it('handles missing or empty user agents safely', () => {
    expect(isBotUserAgent(undefined)).toBe(false);
    expect(isBotUserAgent(null)).toBe(false);
    expect(isBotUserAgent('')).toBe(false);
  });
});
