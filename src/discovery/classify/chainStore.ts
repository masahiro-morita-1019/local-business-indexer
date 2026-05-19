/**
 * 大手ハウスメーカー/住宅チェーンの判定。
 * 判定された店舗は **営業対象外** として Notion 側でフィルタする想定。
 *
 * 判定の優先順位:
 *   1. ドメイン一致(末尾一致、サブドメイン含む)
 *   2. 店名前方一致 / 完全包含(displayName に含まれるかどうか)
 *
 * ルール追加は CHAIN_RULES を編集する。意図的にコンサバ(明確に大手と分かるもののみ)
 * にしている。誤検知よりも見逃しを許容する方針。
 */

export interface ChainRule {
  /** チェーン名(表示用) */
  readonly name: string;
  /** 末尾一致するドメインのリスト */
  readonly domains: readonly string[];
  /** 店名に含まれていればマッチする文字列(完全一致ではなく includes) */
  readonly namePatterns: readonly string[];
}

export const CHAIN_RULES: readonly ChainRule[] = [
  { name: '一条工務店', domains: ['ichijo.co.jp'], namePatterns: ['一条工務店'] },
  {
    name: 'アイ工務店',
    domains: ['ai-koumuten.co.jp', 'ai-koumuten.com'],
    namePatterns: ['アイ工務店'],
  },
  { name: '積水ハウス', domains: ['sekisuihouse.co.jp'], namePatterns: ['積水ハウス'] },
  {
    name: '大和ハウス',
    domains: ['daiwahouse.co.jp', 'daiwahouse.com'],
    namePatterns: ['大和ハウス', 'ダイワハウス'],
  },
  { name: '住友林業', domains: ['sfc.jp'], namePatterns: ['住友林業'] },
  {
    name: 'ミサワホーム',
    domains: ['misawa.co.jp', 'misawahome.co.jp'],
    namePatterns: ['ミサワホーム'],
  },
  {
    name: 'パナソニックホームズ',
    domains: ['panasonichomes.co.jp'],
    namePatterns: ['パナソニックホームズ', 'パナソニック ホームズ'],
  },
  {
    name: 'ヘーベルハウス',
    domains: ['hebelhaus.com', 'asahi-kasei.co.jp'],
    namePatterns: ['ヘーベルハウス', 'へーベルハウス'],
  },
  { name: 'セキスイハイム', domains: ['sekisuiheim.com'], namePatterns: ['セキスイハイム'] },
  { name: 'トヨタホーム', domains: ['toyotahome.co.jp'], namePatterns: ['トヨタホーム'] },
  { name: 'タマホーム', domains: ['tamahome.jp'], namePatterns: ['タマホーム'] },
  { name: 'アエラホーム', domains: ['aerahome.com'], namePatterns: ['アエラホーム'] },
  { name: 'ヤマダホームズ', domains: ['yamadahomes.jp'], namePatterns: ['ヤマダホームズ'] },
  {
    name: 'スウェーデンハウス',
    domains: ['swedenhouse.co.jp'],
    namePatterns: ['スウェーデンハウス'],
  },
  { name: '三井ホーム', domains: ['mitsuihome.co.jp'], namePatterns: ['三井ホーム'] },
  { name: '桧家住宅', domains: ['hinokiya.jp'], namePatterns: ['桧家住宅', 'ヒノキヤ'] },
];

export interface ChainDetection {
  isChain: boolean;
  chainName: string | undefined;
  reason: string;
}

export function detectChainStore(
  storeName: string,
  websiteUri: string | undefined,
  rules: readonly ChainRule[] = CHAIN_RULES,
): ChainDetection {
  // 1) ドメイン一致(より信頼度が高いので先に判定)
  if (websiteUri) {
    const host = safeHost(websiteUri);
    if (host) {
      for (const rule of rules) {
        const matched = rule.domains.find((d) => isHostMatch(host, d));
        if (matched) {
          return {
            isChain: true,
            chainName: rule.name,
            reason: `ドメイン一致: ${matched}`,
          };
        }
      }
    }
  }

  // 2) 店名一致
  for (const rule of rules) {
    const matched = rule.namePatterns.find((p) => storeName.includes(p));
    if (matched) {
      return {
        isChain: true,
        chainName: rule.name,
        reason: `店名一致: "${matched}"`,
      };
    }
  }

  return { isChain: false, chainName: undefined, reason: '対象外' };
}

function safeHost(url: string): string | null {
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
