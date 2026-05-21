import * as cheerio from 'cheerio';
import { selectPrimaryEmail } from './emailFilter.ts';
import { CONTACT_PATHS } from './paths.ts';
import { DEFAULT_UA, fetchRobots } from './robots.ts';

export interface ExtractResult {
  email: string | undefined;
  contactFormUrl: string | undefined;
  note: string;
  visitedPaths: string[];
  /**
   * 最初に成功したリクエストの「リダイレクト追跡後の最終URL」。
   * Places API が古い http:// を登録していても、実サイトが https に
   * 301 してくる場合はここに https:// の URL が入る。
   * undefined = どのパスも取れなかった、または URL パース失敗。
   */
  actualFinalUrl: string | undefined;
  /**
   * 最終URLが https かどうか。actualFinalUrl から導出。
   * undefined = 判定できず(プローブ失敗等)。
   */
  actualHttps: boolean | undefined;
}

export interface ExtractorOptions {
  fetchImpl?: typeof fetch;
  userAgent?: string;
  perRequestTimeoutMs?: number;
  /** ドメイン内リクエスト間ディレイ(ミリ秒) */
  perRequestDelayMs?: number;
  /** 試行するパスのリスト(デフォルト: CONTACT_PATHS) */
  paths?: readonly string[];
}

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_DELAY = 1000;

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * 1サイト(オリジン)から問い合わせ情報を抽出する。
 * - robots.txt を尊重(Disallow 該当パスはスキップ)
 * - mailto: と本文中のメアドを抽出
 * - 問い合わせフォームらしき <form> の action URL を抽出
 * - 同ドメイン内の問い合わせ系リンクも候補に追加(MVP では既知パスのみ)
 */
export async function extractContacts(
  siteUrl: string,
  opts: ExtractorOptions = {},
): Promise<ExtractResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const ua = opts.userAgent ?? DEFAULT_UA;
  const timeoutMs = opts.perRequestTimeoutMs ?? DEFAULT_TIMEOUT;
  const delayMs = opts.perRequestDelayMs ?? DEFAULT_DELAY;
  const paths = opts.paths ?? CONTACT_PATHS;

  let origin: string;
  try {
    origin = new URL(siteUrl).origin;
  } catch {
    return {
      email: undefined,
      contactFormUrl: undefined,
      note: `URLパース失敗: ${siteUrl}`,
      visitedPaths: [],
      actualFinalUrl: undefined,
      actualHttps: undefined,
    };
  }

  const robots = await fetchRobots(origin, fetchImpl);

  const foundEmails: string[] = [];
  let contactFormUrl: string | undefined;
  const visitedPaths: string[] = [];
  const visitedSet = new Set<string>();
  let cloudflareObfuscationSeen = false;
  let actualFinalUrl: string | undefined;
  let actualHttps: boolean | undefined;

  for (const path of paths) {
    if (visitedSet.has(path)) continue;
    visitedSet.add(path);

    if (!robots.isAllowed(path)) continue;

    const url = `${origin}${path}`;
    const fetched = await fetchHtml(url, fetchImpl, ua, timeoutMs);
    if (fetched === null) continue;

    // 最初に成功したリクエストの最終URLを記録(リダイレクト追跡後の真の応答先)
    if (actualFinalUrl === undefined) {
      actualFinalUrl = fetched.finalUrl;
      try {
        actualHttps = new URL(fetched.finalUrl).protocol === 'https:';
      } catch {
        actualHttps = undefined;
      }
    }

    const html = fetched.html;
    visitedPaths.push(path);

    const $ = cheerio.load(html);

    // mailto:
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const email = href
        .replace(/^mailto:/i, '')
        .split('?')[0]
        ?.trim();
      if (email) foundEmails.push(email);
    });

    // Cloudflare email obfuscation 検出(復号は未対応、ログのみ)
    if ($('[data-cfemail]').length > 0 || $('a[href*="/cdn-cgi/l/email-protection"]').length > 0) {
      cloudflareObfuscationSeen = true;
    }

    // 本文中のメアド([at] 系の簡易置換も)
    const text = $('body').text();
    const decoded = text.replace(/\s*[\[（(]\s*at\s*[\]）)]\s*/gi, '@').replace(/\s+@\s+/g, '@');
    const matches = decoded.match(EMAIL_REGEX);
    if (matches) foundEmails.push(...matches);

    // 問い合わせフォームらしき <form>
    if (!contactFormUrl) {
      $('form').each((_, el) => {
        if (contactFormUrl) return;
        const action = $(el).attr('action');
        const method = ($(el).attr('method') ?? '').toLowerCase();
        if (method === 'post' || (action && /(contact|inquiry|mail|form)/i.test(action))) {
          contactFormUrl = resolveUrl(url, action) ?? url;
        }
      });
    }

    // ドメイン内レート制御
    await new Promise((r) => setTimeout(r, delayMs));

    // メールが既に1件以上見つかった & フォームも判定済みなら早期終了
    if (foundEmails.length > 0 && contactFormUrl !== undefined) break;
  }

  const selection = selectPrimaryEmail(foundEmails);

  const noteParts: string[] = [];
  if (selection.primary) {
    noteParts.push(`採用: ${selection.primary}`);
  }
  if (selection.accepted.length > 1) {
    noteParts.push(
      `他候補: ${selection.accepted
        .slice(1)
        .map((e) => e.email)
        .join(', ')}`,
    );
  }
  if (selection.rejected.length > 0) {
    noteParts.push(
      `除外: ${selection.rejected
        .map((e) => `${e.email}(${e.rejection?.reason ?? '?'})`)
        .join(', ')}`,
    );
  }
  if (cloudflareObfuscationSeen) {
    noteParts.push('Cloudflare email obfuscation 検出(未対応・人間確認推奨)');
  }
  if (visitedPaths.length === 0) {
    noteParts.push('全パス到達失敗(robots.txt or ネットワークエラー)');
  }
  if (actualFinalUrl !== undefined && actualFinalUrl !== `${origin}${visitedPaths[0] ?? '/'}`) {
    noteParts.push(`実応答URL: ${actualFinalUrl}`);
  }

  return {
    email: selection.primary,
    contactFormUrl,
    note: noteParts.join(' / '),
    visitedPaths,
    actualFinalUrl,
    actualHttps,
  };
}

interface FetchedHtml {
  html: string;
  /** リダイレクト追跡後の最終URL */
  finalUrl: string;
}

async function fetchHtml(
  url: string,
  fetchImpl: typeof fetch,
  ua: string,
  timeoutMs: number,
): Promise<FetchedHtml | null> {
  try {
    const res = await fetchImpl(url, {
      headers: {
        'User-Agent': ua,
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('text/html') && !ct.includes('application/xhtml+xml')) return null;
    const html = await res.text();
    return { html, finalUrl: res.url || url };
  } catch {
    return null;
  }
}

function resolveUrl(base: string, ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  try {
    return new URL(ref, base).toString();
  } catch {
    return undefined;
  }
}
