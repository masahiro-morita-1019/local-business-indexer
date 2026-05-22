/**
 * Phase 2 の HP生成で使う企業データ型。
 *
 * このスキーマは `src/pipeline/buildData.ts` の `Target` と一致している必要がある。
 * Notion 直叩きを避けて、ビルド時の入力はファイル(JSON)に固定する設計のため、
 * ジェネレータ側はこの型を JSON ファイルとの契約として扱う。
 */
export interface Target {
  placeId: string;
  name: string;
  category: string;
  area: string;
  address: string;
  phone: string;
  rating: number | null;
  reviewCount: number | null;
  websiteClass: 'none' | 'sns_only';
  types: string[];
  openingHours: string;
  isChainStore: boolean;
  legalForm: string;
  honorific: string;
  outreachPriority: '高' | '中' | '低';
  outreachScore: number;
  outreachReasons: string;
  googleMapsUrl: string;
}

export interface TargetsFile {
  generatedAt: string;
  filter: { category: string | null; minPriority: '高' | '中' | '低' };
  count: number;
  targets: Target[];
}
