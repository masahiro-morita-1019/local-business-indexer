import type { CreateDatabaseParameters } from '@notionhq/client/build/src/api-endpoints.js';

/**
 * Notion DB スキーマ(プロパティ定義)。
 * setup-notion-db スクリプトで使用するほか、upsert 側の型安全のためにも参照する。
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
  // Phase 1.5: コンタクト情報スクレイパーで追加
  Email: 'Email',
  ContactFormUrl: 'ContactFormUrl',
  ContactExtractedAt: 'ContactExtractedAt',
  ContactExtractionNote: 'ContactExtractionNote',
  ActualUrl: 'ActualUrl',
  // ターゲット品質改善で追加 (大手チェーン除外 / HTTPS判定 / 法人格判定)
  IsChainStore: 'IsChainStore',
  ChainName: 'ChainName',
  UsesHttps: 'UsesHttps',
  LegalForm: 'LegalForm',
  OutreachPriority: 'OutreachPriority',
  OutreachScore: 'OutreachScore',
  OutreachReasons: 'OutreachReasons',
} as const;

export const STATUS_OPTIONS = [
  '未着手',
  'HP生成済',
  'メール下書き',
  '送付済',
  '返信あり',
  '見送り',
] as const;
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
  [PROPERTIES.Email]: { email: {} },
  [PROPERTIES.ContactFormUrl]: { url: {} },
  [PROPERTIES.ContactExtractedAt]: { date: {} },
  [PROPERTIES.ContactExtractionNote]: { rich_text: {} },
  [PROPERTIES.ActualUrl]: { url: {} },
  [PROPERTIES.IsChainStore]: { checkbox: {} },
  [PROPERTIES.ChainName]: { rich_text: {} },
  [PROPERTIES.UsesHttps]: { checkbox: {} },
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
};
