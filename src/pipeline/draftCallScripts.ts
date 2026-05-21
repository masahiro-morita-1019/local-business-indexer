import Anthropic from '@anthropic-ai/sdk';
import pLimit from 'p-limit';
import {
  type SenderIdentity,
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
import { buildSystemPrompt, buildUserPrompt } from '../outreach/call/prompts.ts';

export interface DraftCallScriptsParams {
  limit: number;
  dryRun?: boolean;
  /** 並列度。Anthropic API のレート制限を考慮し、デフォルト3。 */
  concurrency?: number;
  /**
   * true のとき Anthropic API を叩かず、Claude.ai に貼り付ける用のマークダウンを
   * stdout に出力するだけ。API キー不要、Notion 書き込みなし。
   * プロンプトチューニング期・少量手動運用向け。
   */
  printPrompts?: boolean;
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
  const databaseId = requireDatabaseId(env);
  const sender = getSenderIdentity(env);

  if (!sender.name) {
    console.warn(
      '[draft-call] OUTREACH_SENDER_NAME が未設定です。文面に「(未設定)」が入ります。.env で設定推奨。',
    );
  }

  const notion = createNotionClient(env.NOTION_API_KEY);

  // --print-prompts モード: API キー不要、Notion 書き込みなし、stdout にプロンプトだけ出す
  if (params.printPrompts) {
    const candidates = await queryCallScriptCandidates(notion, databaseId, params.limit);
    console.error(`[draft-call] ${candidates.length} 件分のプロンプトを stdout に出力します`);
    printPromptsToStdout(candidates, sender);
    return emptySummary(candidates.length);
  }

  const apiKey = requireAnthropicApiKey(env);
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

function emptySummary(candidates: number): DraftCallScriptsSummary {
  return {
    candidates,
    generated: 0,
    errors: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    estimatedCostUsd: 0,
  };
}

/**
 * Claude.ai に貼り付けて手動運用するための Markdown を stdout に出力する。
 * - 進捗ログは stderr に出して、stdout は純粋なプロンプト集だけにする
 *   → `pnpm indexer draft-call-scripts --print-prompts > prompts.md` でファイル化可能
 * - System プロンプトは全件共通なので冒頭で1回だけ出力
 * - 各企業ブロックには Notion pageId を残し、生成結果を貼り戻すときに対応関係が分かるようにする
 */
function printPromptsToStdout(candidates: CallScriptCandidate[], sender: SenderIdentity): void {
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  process.stdout.write('# 電話スクリプト生成プロンプト集\n\n');
  process.stdout.write(`- 生成日時: ${now}\n`);
  process.stdout.write(`- 対象件数: ${candidates.length}\n\n`);
  process.stdout.write('## 使い方\n\n');
  process.stdout.write('1. Claude.ai で新規会話を開始\n');
  process.stdout.write(
    '2. 下記の「## システムプロンプト(全件共通)」ブロックをカスタムインストラクション or 最初のメッセージとして設定\n',
  );
  process.stdout.write(
    '3. 「## 企業 N/M」セクションの **User プロンプト** を1件ずつ送信(同じ会話内で連続可)\n',
  );
  process.stdout.write(
    '4. 生成された電話スクリプトを Notion DB の `CallScript` 列に貼り付け(`pageId` で対応関係を確認)\n\n',
  );
  process.stdout.write(
    '> 30件以上を1会話で処理するとコンテキストが膨らむので、10〜15件ごとに新規会話を開始するのを推奨\n\n',
  );

  process.stdout.write('---\n\n');
  process.stdout.write('## システムプロンプト(全件共通)\n\n');
  process.stdout.write('```text\n');
  process.stdout.write(buildSystemPrompt(sender));
  process.stdout.write('\n```\n\n');

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c) continue;
    const userPrompt = buildUserPrompt({
      name: c.name,
      category: c.category,
      area: c.area,
      rating: c.rating,
      reviewCount: c.reviewCount,
      websiteClass: c.websiteClass,
      legalForm: c.legalForm,
      outreachReasons: c.outreachReasons,
    });

    process.stdout.write('---\n\n');
    process.stdout.write(`## 企業 ${i + 1}/${candidates.length}: ${c.name}\n\n`);
    process.stdout.write(`- Notion pageId: \`${c.pageId}\`\n`);
    process.stdout.write(`- 業種: ${c.category} / エリア: ${c.area}\n`);
    if (c.rating !== undefined && c.reviewCount !== undefined) {
      process.stdout.write(`- 評価: ${c.rating} / 5.0 (${c.reviewCount}件)\n`);
    }
    process.stdout.write('\n### User プロンプト\n\n');
    process.stdout.write('```text\n');
    process.stdout.write(userPrompt);
    process.stdout.write('\n```\n\n');
  }
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
