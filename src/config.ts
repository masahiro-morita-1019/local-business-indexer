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
}

export function getSenderIdentity(env: Env): SenderIdentity {
  return {
    name: env.OUTREACH_SENDER_NAME ?? '',
    title: env.OUTREACH_SENDER_TITLE ?? '',
    email: env.OUTREACH_SENDER_EMAIL ?? '',
    phone: env.OUTREACH_SENDER_PHONE ?? '',
    address: env.OUTREACH_SENDER_ADDRESS ?? '',
    portfolioUrl: env.OUTREACH_SENDER_PORTFOLIO_URL ?? '',
    unsubscribeUrl: env.OUTREACH_UNSUBSCRIBE_URL ?? '',
  };
}
