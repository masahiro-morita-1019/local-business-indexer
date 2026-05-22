import type { Classification as WebsiteClassification } from '../filter/noWebsite.ts';
import type { ChainDetection } from './chainStore.ts';

/**
 * 営業優先度の計算。Notion でソート/フィルタするための数値スコア + 4段階ラベル。
 *
 * 設計の出発点:
 *   - 「★3.5-4.2 + レビュー20件以上 + HPなし」が最も売れる
 *   - 大手チェーンは即除外
 *   - ★が低すぎ(3.0未満) or レビュー数が極端に少ない(< 3)はノイズなので加点しない
 *
 * 2026-05-21 方針転換: D ルート(has_website への メール営業) を廃止。
 * has_website は discover で Notion に新規 upsert されないため、has_website 系のルールは
 * 入力としても発生しない想定だが、入力された場合でも控えめにスコアが下がるだけで害は無い。
 *
 * すべての加点ルールは PRIORITY_RULES に定義してある。ルール追加・変更時はそこを編集。
 * docs/classification-rules.md にも同じルールが記載されている — 編集時は両方更新すること。
 */

export const PRIORITY_LABELS = ['高', '中', '低', '除外'] as const;
export type PriorityLabel = (typeof PRIORITY_LABELS)[number];

export interface PriorityInput {
  websiteClass: WebsiteClassification['class'];
  isChainStore: boolean;
  rating: number | undefined;
  reviewCount: number | undefined;
}

export interface PriorityResult {
  label: PriorityLabel;
  score: number;
  /** 加点に貢献したルール名のリスト(監査・透明性のため) */
  reasons: string[];
}

export interface PriorityRule {
  name: string;
  /** スコア加減 */
  delta: number;
  test: (input: PriorityInput) => boolean;
}

export const PRIORITY_RULES: readonly PriorityRule[] = [
  // 除外条件(即終了)
  {
    name: '大手チェーン除外',
    delta: -1000,
    test: (i) => i.isChainStore,
  },
  // レビュー数 (顧客がついている裏付け)
  {
    name: 'レビュー数 >= 20',
    delta: 30,
    test: (i) => (i.reviewCount ?? 0) >= 20,
  },
  {
    name: 'レビュー数 10-19',
    delta: 15,
    test: (i) => (i.reviewCount ?? 0) >= 10 && (i.reviewCount ?? 0) < 20,
  },
  // rating (品質シグナル)
  {
    name: 'rating 3.5-4.2(顧客を失っている可能性、改善余地大)',
    delta: 20,
    test: (i) => i.rating !== undefined && i.rating >= 3.5 && i.rating <= 4.2,
  },
  {
    name: 'rating >= 4.5(品質高、HP次第で更に伸びる)',
    delta: 15,
    test: (i) => i.rating !== undefined && i.rating >= 4.5,
  },
  // HP状態(これがコア)
  // 重みは「データ不確実性」を加味して控えめにしてある。詳しくは docs/classification-rules.md を参照。
  // WebsiteClass=none は Google ビジネスプロフィール非紐付けの可能性込み(=実は HP がある可能性)
  {
    name: 'WebsiteClass=none(HP無し)',
    delta: 20,
    test: (i) => i.websiteClass === 'none',
  },
  {
    name: 'WebsiteClass=sns_only(SNS/簡易LPのみ)',
    delta: 20,
    test: (i) => i.websiteClass === 'sns_only',
  },
];

/** スコアからラベルへの閾値。docs/classification-rules.md と揃えること。 */
export const PRIORITY_THRESHOLDS = {
  high: 50,
  middle: 30,
} as const;

export function scorePriority(input: PriorityInput): PriorityResult {
  let score = 0;
  const reasons: string[] = [];

  for (const rule of PRIORITY_RULES) {
    if (rule.test(input)) {
      score += rule.delta;
      reasons.push(`${rule.name}(${rule.delta > 0 ? '+' : ''}${rule.delta})`);
    }
  }

  let label: PriorityLabel;
  if (input.isChainStore) label = '除外';
  else if (score >= PRIORITY_THRESHOLDS.high) label = '高';
  else if (score >= PRIORITY_THRESHOLDS.middle) label = '中';
  else label = '低';

  return { label, score, reasons };
}

export function buildPriorityInput(args: {
  classification: WebsiteClassification;
  chain: ChainDetection;
  rating: number | undefined;
  reviewCount: number | undefined;
}): PriorityInput {
  return {
    websiteClass: args.classification.class,
    isChainStore: args.chain.isChain,
    rating: args.rating,
    reviewCount: args.reviewCount,
  };
}
