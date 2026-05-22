import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  GOOGLE_MAPS_API_KEY: z.string().min(1, 'GOOGLE_MAPS_API_KEY is required'),
  NOTION_API_KEY: z.string().min(1, 'NOTION_API_KEY is required'),
  NOTION_DATABASE_ID: z.string().optional(),
  NOTION_PARENT_PAGE_ID: z.string().optional(),
  // Phase 4-B 以降で使用
  ANTHROPIC_API_KEY: z.string().optional(),
  OUTREACH_SENDER_NAME: z.string().optional(),
  OUTREACH_SENDER_TITLE: z.string().optional(),
  OUTREACH_SENDER_EMAIL: z.string().optional(),
  OUTREACH_SENDER_PHONE: z.string().optional(),
  OUTREACH_SENDER_ADDRESS: z.string().optional(),
  OUTREACH_SENDER_PORTFOLIO_URL: z.string().optional(),
  OUTREACH_UNSUBSCRIBE_URL: z.string().optional(),
  /**
   * 営業時の「装備・スタンス」を自由文で記述する。
   * Show-Don't-Tell 型(=「サンプル作ったので見てください」前提)の文面生成のため。
   * 未設定時はデフォルト文(下記 DEFAULT_PITCH_CONTEXT)が使われる。
   */
  OUTREACH_PITCH_CONTEXT: z.string().optional(),
  // Phase 3: Cloudflare Pages デプロイ
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_PAGES_PROJECT: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment variables:\n${issues}\n\n.env を確認してください (.env.example が雛形)`,
    );
  }
  cached = parsed.data;
  return cached;
}

export function requireDatabaseId(env: Env): string {
  if (!env.NOTION_DATABASE_ID) {
    throw new Error(
      'NOTION_DATABASE_ID が未設定です。`pnpm setup:notion` で DB を作成し .env に追記してください。',
    );
  }
  return env.NOTION_DATABASE_ID;
}

export function requireParentPageId(env: Env): string {
  if (!env.NOTION_PARENT_PAGE_ID) {
    throw new Error(
      'NOTION_PARENT_PAGE_ID が未設定です。Notion で DB を作成したい親ページのIDを .env に設定してください。',
    );
  }
  return env.NOTION_PARENT_PAGE_ID;
}

export function requireAnthropicApiKey(env: Env): string {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY が未設定です。https://console.anthropic.com で取得し .env に追記してください。',
    );
  }
  return env.ANTHROPIC_API_KEY;
}

export interface CloudflareConfig {
  apiToken: string;
  accountId: string;
  projectName: string;
}

export function requireCloudflareConfig(env: Env): CloudflareConfig {
  const missing: string[] = [];
  if (!env.CLOUDFLARE_API_TOKEN) missing.push('CLOUDFLARE_API_TOKEN');
  if (!env.CLOUDFLARE_ACCOUNT_ID) missing.push('CLOUDFLARE_ACCOUNT_ID');
  if (!env.CLOUDFLARE_PAGES_PROJECT) missing.push('CLOUDFLARE_PAGES_PROJECT');
  if (missing.length > 0) {
    throw new Error(
      [
        `Cloudflare の環境変数が未設定です: ${missing.join(', ')}`,
        '  1. https://dash.cloudflare.com/profile/api-tokens で "Cloudflare Pages: Edit" 権限のトークンを発行',
        '  2. Account ID はダッシュボード右サイドバー or URL から取得',
        '  3. プロジェクト名は英数とハイフンのみ(初回 deploy 時に自動作成)',
      ].join('\n'),
    );
  }
  return {
    // biome-ignore lint/style/noNonNullAssertion: 上で missing チェック済み
    apiToken: env.CLOUDFLARE_API_TOKEN!,
    // biome-ignore lint/style/noNonNullAssertion: 上で missing チェック済み
    accountId: env.CLOUDFLARE_ACCOUNT_ID!,
    // biome-ignore lint/style/noNonNullAssertion: 上で missing チェック済み
    projectName: env.CLOUDFLARE_PAGES_PROJECT!,
  };
}

/**
 * 営業文面に差し込む差出人情報。すべて任意で、未設定の項目はテンプレ上でも空欄になる。
 */
export interface SenderIdentity {
  name: string;
  title: string;
  email: string;
  phone: string;
  address: string;
  portfolioUrl: string;
  unsubscribeUrl: string;
  /**
   * 営業時の「装備・スタンス」。Show-Don't-Tell 型のスクリプト/文面生成のための前提条件。
   * 例: 「電話前にサンプルHPを作成済み。電話の目的は URL 送付の了承を取ること。」
   */
  pitchContext: string;
}

/**
 * OUTREACH_PITCH_CONTEXT 未設定時のデフォルト。
 * 「電話前に貴社向けサンプルHPを準備済み」を前提にした Show-Don't-Tell 型の構え。
 * 自分の運用が違う場合は .env で上書きする。
 */
export const DEFAULT_PITCH_CONTEXT = [
  '電話前に、相手企業向けの簡易なサンプルHP(プレビュー版)を1ページ作成済みである。',
  '電話の目的は「メールでプレビューURLを送る了承を取ること」。',
  'サンプルが気に入った場合のみ有料の正式版を制作する低リスク提案。',
  '気に入らなければそれで終了で問題ない、というスタンス(押し売り絶対しない)。',
  'ポートフォリオサイトと併せて「実在する制作者である証拠」を提示できる。',
].join('\n');

export function getSenderIdentity(env: Env): SenderIdentity {
  return {
    name: env.OUTREACH_SENDER_NAME ?? '',
    title: env.OUTREACH_SENDER_TITLE ?? '',
    email: env.OUTREACH_SENDER_EMAIL ?? '',
    phone: env.OUTREACH_SENDER_PHONE ?? '',
    address: env.OUTREACH_SENDER_ADDRESS ?? '',
    portfolioUrl: env.OUTREACH_SENDER_PORTFOLIO_URL ?? '',
    unsubscribeUrl: env.OUTREACH_UNSUBSCRIBE_URL ?? '',
    pitchContext: env.OUTREACH_PITCH_CONTEXT ?? DEFAULT_PITCH_CONTEXT,
  };
}
