import targetsRaw from '../../data/targets.json';
import type { TargetsFile } from './types.ts';

/**
 * targets.json をビルド時に Vite が静的解決で取り込む。
 * Notion API は `pnpm indexer build-data` で先に叩き、ジェネレータ側は静的ファイルだけを入力にする。
 *
 * 「targets.json が無い」場合は build エラーになるので、運用ミスにすぐ気づける。
 */
export const targetsFile = targetsRaw as TargetsFile;

export async function loadTargetsFile(): Promise<TargetsFile> {
  return targetsFile;
}
