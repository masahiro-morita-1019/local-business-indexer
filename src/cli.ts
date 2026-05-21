#!/usr/bin/env node
import { Command } from 'commander';
import { runDiscover } from './pipeline/discover.ts';
import { runExtractContacts } from './pipeline/extractContacts.ts';

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
      console.log(`発見             : ${summary.found}`);
      console.log(`  - HP無し       : ${summary.byClass.none}`);
      console.log(`  - SNSのみ      : ${summary.byClass.sns_only}`);
      console.log(`  - HPあり       : ${summary.byClass.has_website}`);
      console.log(`大手チェーン店   : ${summary.chainStores} (営業対象外フラグ済)`);
      console.log(`HTTP only (古HP) : ${summary.httpOnly}`);
      console.log(
        `優先度           : 高=${summary.byPriority.高} / 中=${summary.byPriority.中} / 低=${summary.byPriority.低} / 除外=${summary.byPriority.除外}`,
      );
      if (!opts.dryRun) {
        console.log(`Notion 新規追加  : ${summary.created}`);
        console.log(`Notion 更新      : ${summary.updated}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n[cli] 実行エラー: ${msg}`);
      process.exit(1);
    }
  });

program
  .command('extract-contacts')
  .description(
    'WebsiteClass=has_website かつ Email 未取得のページを対象に、HPからメアド/問い合わせフォームを抽出して Notion に保存',
  )
  .option('-l, --limit <n>', '最大処理件数', (v) => Number.parseInt(v, 10), 50)
  .option('-p, --concurrency <n>', '並列度', (v) => Number.parseInt(v, 10), 3)
  .option('--dry-run', 'Notion に書き込まず、結果のみ表示', false)
  .action(async (opts: { limit: number; concurrency: number; dryRun: boolean }) => {
    try {
      const summary = await runExtractContacts({
        limit: Math.max(1, opts.limit),
        concurrency: Math.max(1, Math.min(10, opts.concurrency)),
        dryRun: opts.dryRun,
      });
      console.log('\n=== サマリ ===');
      console.log(`対象候補               : ${summary.candidates}`);
      console.log(`メアド取得             : ${summary.emailFound}`);
      console.log(`フォームのみ           : ${summary.formOnly}`);
      console.log(`何も取れず             : ${summary.noContact}`);
      console.log(`エラー                 : ${summary.errors}`);
      console.log(`実応答 HTTPS 確認      : ${summary.actualHttpsConfirmed}`);
      console.log(`GBP=http→実=https の検出: ${summary.httpsUpgradeDetected}(スコア再計算済)`);
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
