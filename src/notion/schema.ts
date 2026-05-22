import type { CreateDatabaseParameters } from '@notionhq/client/build/src/api-endpoints.js';

/**
 * Notion DB スキーマ(プロパティ定義)。
 * setup-notion-db スクリプトで使用するほか、upsert 側の型安全のためにも参照する。
 *
 * 2026-05-21 方針転換: D ルート(has_website への メール営業)廃止に伴い、
 * Email / ContactFormUrl / ContactExtractedAt / ContactExtractionNote / ActualUrl / UsesHttps を削除。
 * WEBSITE_CLASS_OPTIONS は has_website を残す(classifyWebsite の戻り値型として使う + 既存DBビュー互換のため)。
 */
export const PROPERTIES = {
  Name: 'Name',
  PlaceId: 'place_id',
  Category: 'Category',
  Area: 'Area',
  Address: 'Address',
  Phone: 'Phone',
  Website: 'Website',
  WebsiteClass: 'WebsiteClass',
  DecisionReason: 'DecisionReason',
  Rating: 'Rating',
  ReviewCount: 'ReviewCount',
  GoogleMapsUrl: 'GoogleMapsUrl',
  Types: 'Types',
  OpeningHours: 'OpeningHours',
  Status: 'Status',
  FoundAt: 'FoundAt',
  LastCheckedAt: 'LastCheckedAt',
  Notes: 'Notes',
  // ターゲット品質改善で追加 (大手チェーン除外 / 法人格判定)
  IsChainStore: 'IsChainStore',
  ChainName: 'ChainName',
  LegalForm: 'LegalForm',
  OutreachPriority: 'OutreachPriority',
  OutreachScore: 'OutreachScore',
  OutreachReasons: 'OutreachReasons',
  // Phase 4-B: 電話スクリプト
  CallScript: 'CallScript',
  CallScriptGeneratedAt: 'CallScriptGeneratedAt',
  // Phase 3: HP デプロイ
  PreviewUrl: 'PreviewUrl',
  PreviewDeployedAt: 'PreviewDeployedAt',
} as const;

export const STATUS_OPTIONS = ['未着手', 'HP生成済', '送付済', '返信あり', '見送り'] as const;
export type StatusOption = (typeof STATUS_OPTIONS)[number];

export const WEBSITE_CLASS_OPTIONS = ['none', 'sns_only', 'has_website'] as const;

export const LEGAL_FORM_OPTIONS = [
  '株式会社',
  '有限会社',
  '合同会社',
  '合資会社',
  '合名会社',
  '一般社団法人',
  '一般財団法人',
  'NPO法人',
  '医療法人',
  '不明',
] as const;

export const OUTREACH_PRIORITY_OPTIONS = ['高', '中', '低', '除外'] as const;

export const databaseProperties: CreateDatabaseParameters['properties'] = {
  [PROPERTIES.Name]: { title: {} },
  [PROPERTIES.PlaceId]: { rich_text: {} },
  [PROPERTIES.Category]: { select: { options: [] } },
  [PROPERTIES.Area]: { select: { options: [] } },
  [PROPERTIES.Address]: { rich_text: {} },
  [PROPERTIES.Phone]: { phone_number: {} },
  [PROPERTIES.Website]: { url: {} },
  [PROPERTIES.WebsiteClass]: {
    select: {
      options: WEBSITE_CLASS_OPTIONS.map((name) => ({ name })),
    },
  },
  [PROPERTIES.DecisionReason]: { rich_text: {} },
  [PROPERTIES.Rating]: { number: { format: 'number' } },
  [PROPERTIES.ReviewCount]: { number: { format: 'number' } },
  [PROPERTIES.GoogleMapsUrl]: { url: {} },
  [PROPERTIES.Types]: { multi_select: { options: [] } },
  [PROPERTIES.OpeningHours]: { rich_text: {} },
  [PROPERTIES.Status]: {
    select: {
      options: STATUS_OPTIONS.map((name) => ({ name })),
    },
  },
  [PROPERTIES.FoundAt]: { date: {} },
  [PROPERTIES.LastCheckedAt]: { date: {} },
  [PROPERTIES.Notes]: { rich_text: {} },
  [PROPERTIES.IsChainStore]: { checkbox: {} },
  [PROPERTIES.ChainName]: { rich_text: {} },
  [PROPERTIES.LegalForm]: {
    select: {
      options: LEGAL_FORM_OPTIONS.map((name) => ({ name })),
    },
  },
  [PROPERTIES.OutreachPriority]: {
    select: {
      options: OUTREACH_PRIORITY_OPTIONS.map((name) => ({ name })),
    },
  },
  [PROPERTIES.OutreachScore]: { number: { format: 'number' } },
  [PROPERTIES.OutreachReasons]: { rich_text: {} },
  [PROPERTIES.CallScript]: { rich_text: {} },
  [PROPERTIES.CallScriptGeneratedAt]: { date: {} },
  [PROPERTIES.PreviewUrl]: { url: {} },
  [PROPERTIES.PreviewDeployedAt]: { date: {} },
};
