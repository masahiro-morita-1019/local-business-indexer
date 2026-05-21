import Anthropic from '@anthropic-ai/sdk';

/**
 * Anthropic SDK クライアントを生成する。
 * デフォルトでは ANTHROPIC_API_KEY 環境変数を使用するが、明示的に渡すこともできる。
 */
export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

/**
 * 採用モデル(MVP固定): Claude Opus 4.7。
 * Phase 4-B の電話スクリプト生成は短い構造化マークダウンを返すだけだが、
 * 「相手の業種特性に応じた説得力ある文面」を要求するため Opus を採用。
 *
 * コスト感(参考):
 *   - Opus 4.7: $5/1M input / $25/1M output
 *   - 1社あたり目安: 入力 ~600 tokens + 出力 ~800 tokens ≈ $0.024
 *   - 60社バッチで $1.5 程度
 * コスト最適化したい場合は claude-sonnet-4-6 ($3 in / $15 out, ~0.4倍) に切り替え可。
 */
export const DEFAULT_MODEL = 'claude-opus-4-7';
