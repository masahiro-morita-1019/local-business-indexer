import Anthropic from '@anthropic-ai/sdk';
import pLimit from 'p-limit';
import {
  getSenderIdentity,
  loadEnv,
  requireAnthropicApiKey,
  requireDatabaseId,
} from '../config.ts';
import { createAnthropicClient } from '../llm/client.ts';
import {
  type CallScriptCandidate,
  queryCallScriptCandidates,
  writeCallScript,
} from '../notion/callScripts.ts';
import { createNotionClient } from '../notion/client.ts';
import { generateCallScript } from '../outreach/call/generator.ts';

export interface DraftCallScriptsParams {
  limit: number;
  dryRun?: boolean;
  /** 並列度。Anthropic API のレート制限を考慮し、デフォルト3。 */
  concurrency?: number;
}

export interface DraftCallScriptsSummary {
  candidates: number;
  generated: number;
  errors: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  estimatedCostUsd: number;
}

/** Claude Opus 4.7 の料金($/1M tokens) */
const PRICE_INPUT_PER_M = 5;
const PRICE_OUTPUT_PER_M = 25;
const PRICE_CACHE_READ_PER_M = 0.5; // ~0.1x of input

export async function runDraftCallScripts(
  params: DraftCallScriptsParams,
): Promise<DraftCallScriptsSummary> {
  const env = loadEnv();
  const apiKey = requireAnthropicApiKey(env);
  const databaseId = requireDatabaseId(env);
  const sender = getSenderIdentity(env);

  if (!sender.name) {
    console.warn(
      '[draft-call] OUTREACH_SENDER_NAME が未設定です。文面に「(未設定)」が入ります。.env で設定推奨。',
    );
  }

  const notion = createNotionClient(env.NOTION_API_KEY);
  const anthropic = createAnthropicClient(apiKey);

  console.log(`[draft-call] Notion から電話スクリプト対象を取得中... (limit=${params.limit})`);
  const candidates = await queryCallScriptCandidates(notion, databaseId, params.limit);
  console.log(`[draft-call] ${candidates.length} 件が対象`);

  if (candidates.length === 0) {
    return {
      candidates: 0,
      generated: 0,
      errors: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      estimatedCostUsd: 0,
    };
  }

  const limit = pLimit(params.concurrency ?? 3);
  let generated = 0;
  let errors = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;

  await Promise.all(
    candidates.map((c) =>
      limit(async () => {
        await processOne(c, anthropic, notion, databaseId, sender, params.dryRun ?? false)
          .then((result) => {
            generated++;
            totalInputTokens += result.usage.inputTokens;
            totalOutputTokens += result.usage.outputTokens;
            totalCacheReadTokens += result.usage.cacheReadTokens;
            console.log(
              `[draft-call] ✓ ${c.name} (in=${result.usage.inputTokens} out=${result.usage.outputTokens} cached=${result.usage.cacheReadTokens})`,
            );
          })
          .catch((err) => {
            errors++;
            handleGenerateError(err, c);
          });
      }),
    ),
  );

  const estimatedCostUsd =
    (totalInputTokens * PRICE_INPUT_PER_M) / 1_000_000 +
    (totalOutputTokens * PRICE_OUTPUT_PER_M) / 1_000_000 +
    (totalCacheReadTokens * PRICE_CACHE_READ_PER_M) / 1_000_000;

  return {
    candidates: candidates.length,
    generated,
    errors,
    totalInputTokens,
    totalOutputTokens,
    totalCacheReadTokens,
    estimatedCostUsd,
  };
}

async function processOne(
  c: CallScriptCandidate,
  anthropic: Anthropic,
  notion: ReturnType<typeof createNotionClient>,
  databaseId: string,
  sender: ReturnType<typeof getSenderIdentity>,
  dryRun: boolean,
): Promise<Awaited<ReturnType<typeof generateCallScript>>> {
  const result = await generateCallScript(anthropic, sender, {
    name: c.name,
    category: c.category,
    area: c.area,
    rating: c.rating,
    reviewCount: c.reviewCount,
    websiteClass: c.websiteClass,
    legalForm: c.legalForm,
    outreachReasons: c.outreachReasons,
  });

  if (!dryRun) {
    await writeCallScript(notion, c.pageId, result.script);
  }
  // databaseId is intentionally unused here — writeCallScript targets page_id directly.
  // Kept as a parameter for future expansion (e.g. cross-DB linking).
  void databaseId;

  return result;
}

function handleGenerateError(err: unknown, c: CallScriptCandidate): void {
  if (err instanceof Anthropic.RateLimitError) {
    console.error(
      `[draft-call] ✗ ${c.name}: レート制限 (status=${err.status}). 並列度を下げるか時間を空けて再実行。`,
    );
  } else if (err instanceof Anthropic.AuthenticationError) {
    console.error(`[draft-call] ✗ ${c.name}: 認証エラー. ANTHROPIC_API_KEY を確認。`);
  } else if (err instanceof Anthropic.APIError) {
    console.error(`[draft-call] ✗ ${c.name}: API エラー status=${err.status} ${err.message}`);
  } else {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[draft-call] ✗ ${c.name}: ${msg}`);
  }
}
