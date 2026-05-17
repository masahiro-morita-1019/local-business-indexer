import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  GOOGLE_MAPS_API_KEY: z.string().min(1, 'GOOGLE_MAPS_API_KEY is required'),
  NOTION_API_KEY: z.string().min(1, 'NOTION_API_KEY is required'),
  NOTION_DATABASE_ID: z.string().optional(),
  NOTION_PARENT_PAGE_ID: z.string().optional(),
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
