import type Anthropic from '@anthropic-ai/sdk';
import type { SenderIdentity } from '../../config.ts';
import { DEFAULT_MODEL } from '../../llm/client.ts';
import { type CallScriptInput, buildSystemPrompt, buildUserPrompt } from './prompts.ts';

export interface GenerateOptions {
  /** モデル ID。デフォルトは Opus 4.7 */
  model?: string;
  /** 出力上限トークン数。600-1200字 ≈ 800 tokens なので余裕を持って 4000 */
  maxTokens?: number;
}

export interface GenerateResult {
  script: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  };
}

/**
 * 1企業分の電話スクリプトを生成する。
 *
 * 設計メモ:
 * - thinking: 'disabled' — 構造化マークダウン生成は単純タスク。思考トークン不要で
 *   コスト/レイテンシを下げる(Opus 4.7 は thinking がデフォルト off だが明示)。
 * - cache_control: system ブロックに ephemeral を付与。実 activate には Opus 4.7
 *   で約4096 tokens 必要なので現状のプロンプト長では発火しない見込みだが、構造として
 *   置いておくと将来 few-shot 等で長くなった際に自動で効く。
 * - エラーは呼び出し側でハンドリング(typed exception の instanceof チェック前提)。
 */
export async function generateCallScript(
  client: Anthropic,
  sender: SenderIdentity,
  input: CallScriptInput,
  opts: GenerateOptions = {},
): Promise<GenerateResult> {
  const model = opts.model ?? DEFAULT_MODEL;
  const maxTokens = opts.maxTokens ?? 4000;

  const systemPrompt = buildSystemPrompt(sender);
  const userPrompt = buildUserPrompt(input);

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    thinking: { type: 'disabled' },
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  });

  const script = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  return {
    script,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    },
  };
}
