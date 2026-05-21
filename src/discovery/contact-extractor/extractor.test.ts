import { describe, expect, it } from 'vitest';
import { extractContacts } from './extractor.ts';

interface MockRoute {
  status?: number;
  body?: string;
  contentType?: string;
  /** リダイレクト後の最終URL。指定するとレスポンスの url プロパティが上書きされる */
  finalUrl?: string;
}

function makeFetch(routes: Record<string, MockRoute>): typeof fetch {
  return (async (input: string | URL | Request, _init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const route = routes[url];
    if (!route) {
      return new Response('not found', { status: 404 });
    }
    const res = new Response(route.body ?? '', {
      status: route.status ?? 200,
      headers: { 'content-type': route.contentType ?? 'text/html; charset=utf-8' },
    });
    // レスポンスの url を上書き(リダイレクト追跡後の最終URLを模擬)
    Object.defineProperty(res, 'url', {
      value: route.finalUrl ?? url,
      configurable: true,
    });
    return res;
  }) as typeof fetch;
}

describe('extractContacts', () => {
  it('extracts mailto: email from contact page', async () => {
    const html = `<html><body>
      <h1>Contact</h1>
      <a href="mailto:info@example.co.jp">メール</a>
    </body></html>`;
    const fetchImpl = makeFetch({
      'https://example.co.jp/robots.txt': { status: 404 },
      'https://example.co.jp/': { body: '<html></html>' },
      'https://example.co.jp/contact': { body: html },
    });
    const result = await extractContacts('https://example.co.jp', {
      fetchImpl,
      perRequestDelayMs: 0,
    });
    expect(result.email).toBe('info@example.co.jp');
  });

  it('filters out recruitment addresses', async () => {
    const html = `<a href="mailto:recruit@example.com">Jobs</a><a href="mailto:info@example.com">Info</a>`;
    const fetchImpl = makeFetch({
      'https://example.com/robots.txt': { status: 404 },
      'https://example.com/': { body: html },
    });
    const result = await extractContacts('https://example.com', {
      fetchImpl,
      perRequestDelayMs: 0,
      paths: ['/'],
    });
    expect(result.email).toBe('info@example.com');
    expect(result.note).toContain('除外');
  });

  it('extracts plain-text email with [at] obfuscation', async () => {
    const html = '<html><body>お問い合わせ: info [at] example.com</body></html>';
    const fetchImpl = makeFetch({
      'https://example.com/robots.txt': { status: 404 },
      'https://example.com/': { body: html },
    });
    const result = await extractContacts('https://example.com', {
      fetchImpl,
      perRequestDelayMs: 0,
      paths: ['/'],
    });
    expect(result.email).toBe('info@example.com');
  });

  it('finds contact form url when no mailto', async () => {
    const html = `<form action="/contact/submit" method="post"><input/></form>`;
    const fetchImpl = makeFetch({
      'https://example.com/robots.txt': { status: 404 },
      'https://example.com/': { body: '<html></html>' },
      'https://example.com/contact': { body: html },
    });
    const result = await extractContacts('https://example.com', {
      fetchImpl,
      perRequestDelayMs: 0,
    });
    expect(result.email).toBeUndefined();
    expect(result.contactFormUrl).toBe('https://example.com/contact/submit');
  });

  it('respects robots.txt Disallow', async () => {
    const robots = ['User-agent: *', 'Disallow: /contact'].join('\n');
    const html = `<a href="mailto:info@example.com">info</a>`;
    const fetchImpl = makeFetch({
      'https://example.com/robots.txt': { body: robots, contentType: 'text/plain' },
      'https://example.com/contact': { body: html },
    });
    const result = await extractContacts('https://example.com', {
      fetchImpl,
      perRequestDelayMs: 0,
      paths: ['/contact'],
    });
    expect(result.email).toBeUndefined();
    expect(result.visitedPaths).toEqual([]);
  });

  it('flags Cloudflare email obfuscation', async () => {
    const html = `<a href="/cdn-cgi/l/email-protection#abc"><span class="__cf_email__" data-cfemail="abc">[email&nbsp;protected]</span></a>`;
    const fetchImpl = makeFetch({
      'https://example.com/robots.txt': { status: 404 },
      'https://example.com/': { body: html },
    });
    const result = await extractContacts('https://example.com', {
      fetchImpl,
      perRequestDelayMs: 0,
      paths: ['/'],
    });
    expect(result.note).toContain('Cloudflare');
  });

  it('captures actualFinalUrl and actualHttps from real response URL', async () => {
    // 入力は http:// だが、リダイレクト後は https:// になるシナリオ
    const fetchImpl = makeFetch({
      'http://www.example.com/robots.txt': { status: 404 },
      'http://www.example.com/': {
        body: '<html></html>',
        finalUrl: 'https://www.example.com/',
      },
    });
    const result = await extractContacts('http://www.example.com', {
      fetchImpl,
      perRequestDelayMs: 0,
      paths: ['/'],
    });
    expect(result.actualFinalUrl).toBe('https://www.example.com/');
    expect(result.actualHttps).toBe(true);
    expect(result.note).toContain('実応答URL');
  });

  it('actualHttps=false when site stays on http', async () => {
    const fetchImpl = makeFetch({
      'http://example.com/robots.txt': { status: 404 },
      'http://example.com/': { body: '<html></html>' },
    });
    const result = await extractContacts('http://example.com', {
      fetchImpl,
      perRequestDelayMs: 0,
      paths: ['/'],
    });
    expect(result.actualHttps).toBe(false);
    expect(result.actualFinalUrl).toBe('http://example.com/');
  });

  it('actualHttps=undefined when all paths fail', async () => {
    const fetchImpl = makeFetch({
      // 全パス 404
    });
    const result = await extractContacts('https://example.com', {
      fetchImpl,
      perRequestDelayMs: 0,
      paths: ['/', '/contact'],
    });
    expect(result.actualFinalUrl).toBeUndefined();
    expect(result.actualHttps).toBeUndefined();
  });
});
