#!/usr/bin/env node
import { Command } from 'commander';
import { runDiscover } from './pipeline/discover.ts';

const program = new Command();

program
  .name('indexer')
  .description('local-business-indexer: HP未保有企業を抽出して Notion に集約するCLI')
  .version('0.1.0');

program
  .command('discover')
  .description(
    'Google Places API で area × category を検索し、HP未保有企業を Notion に upsert する',
  )
  .requiredOption('-a, --area <area>', '検索エリア (例: "相模原市")')
  .requiredOption('-c, --category <category>', '業種 (例: "工務店")')
  .option('-l, --limit <n>', '最大取得件数 (1〜60)', (v) => Number.parseInt(v, 10), 60)
  .option('--dry-run', 'Notion に書き込まず、検索結果のみ表示', false)
  .action(async (opts: { area: string; category: string; limit: number; dryRun: boolean }) => {
    const limit = Math.max(1, Math.min(60, opts.limit));
    if (limit !== opts.limit) {
      console.warn(`[cli] limit を ${limit} にクランプしました(Places API は最大60件)`);
    }

    try {
      const summary = await runDiscover({
        area: opts.area,
        category: opts.category,
        limit,
        dryRun: opts.dryRun,
      });
      console.log('\n=== サマリ ===');
      console.log(`発見           : ${summary.found}`);
      console.log(`  - HP無し     : ${summary.byClass.none}`);
      console.log(`  - SNSのみ    : ${summary.byClass.sns_only}`);
      console.log(`  - HPあり     : ${summary.byClass.has_website}`);
      if (!opts.dryRun) {
        console.log(`Notion 新規追加: ${summary.created}`);
        console.log(`Notion 更新    : ${summary.updated}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n[cli] 実行エラー: ${msg}`);
      process.exit(1);
    }
  });

program.parseAsync().catch((err) => {
  console.error(err);
  process.exit(1);
});
