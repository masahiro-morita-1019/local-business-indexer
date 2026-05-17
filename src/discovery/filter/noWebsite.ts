export type WebsiteClass = 'none' | 'sns_only' | 'has_website';

export interface Classification {
  class: WebsiteClass;
  reason: string;
}

/**
 * 「SNS/ポータル/簡易LP のみ」を has_website とみなさないためのドメインリスト。
 * URLのホスト名がこれらの末尾一致なら sns_only と判定する。
 */
export const DEFAULT_SNS_DOMAINS: readonly string[] = [
  // SNS
  'facebook.com',
  'instagram.com',
  'x.com',
  'twitter.com',
  'line.me',
  'lin.ee',
  'ameba.jp',
  'ameblo.jp',
  // グルメ/予約/口コミポータル
  'tabelog.com',
  'hotpepper.jp',
  'ekiten.jp',
  'goo.ne.jp',
  'gnavi.co.jp',
  'r.gnavi.co.jp',
  // 簡易LP/EC/ノーコード
  'peraichi.com',
  'lit.link',
  'stores.jp',
  'minne.com',
  'base.shop',
  'base.ec',
  'jimdofree.com',
  'wixsite.com',
  'amebaownd.com',
];

export interface ClassifierOptions {
  snsDomains?: readonly string[];
}

export function classifyWebsite(
  websiteUri: string | undefined,
  opts: ClassifierOptions = {},
): Classification {
  if (!websiteUri || websiteUri.trim() === '') {
    return { class: 'none', reason: 'websiteUri空' };
  }

  const host = extractHost(websiteUri);
  if (!host) {
    return { class: 'none', reason: `URLパース失敗: ${websiteUri}` };
  }

  const snsDomains = opts.snsDomains ?? DEFAULT_SNS_DOMAINS;
  const matched = snsDomains.find((d) => isHostMatch(host, d));
  if (matched) {
    return { class: 'sns_only', reason: `${matched} のみ (${host})` };
  }

  return { class: 'has_website', reason: `独自ドメイン: ${host}` };
}

function extractHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isHostMatch(host: string, domain: string): boolean {
  const d = domain.toLowerCase();
  return host === d || host.endsWith(`.${d}`);
}
