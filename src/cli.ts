#!/usr/bin/env node
import { Command } from 'commander';
import { runBuildData } from './pipeline/buildData.ts';
import { runDeploy } from './pipeline/deploy.ts';
import { runDiscover } from './pipeline/discover.ts';
import { runDraftCallScripts } from './pipeline/draftCallScripts.ts';

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
      console.log(`発見              : ${summary.found}`);
      console.log(`  - HP無し        : ${summary.byClass.none}`);
      console.log(`  - SNSのみ       : ${summary.byClass.sns_only}`);
      console.log(`  - HPあり (除外) : ${summary.byClass.has_website}`);
      console.log(`大手チェーン店    : ${summary.chainStores} (営業対象外)`);
      console.log(
        `優先度            : 高=${summary.byPriority.高} / 中=${summary.byPriority.中} / 低=${summary.byPriority.低} / 除外=${summary.byPriority.除外}`,
      );
      if (!opts.dryRun) {
        console.log(`Notion 新規追加   : ${summary.created}`);
        console.log(`Notion 更新       : ${summary.updated}`);
        console.log(`Notion 見送り遷移 : ${summary.demoted} (has_website 化した既存ページ)`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n[cli] 実行エラー: ${msg}`);
      process.exit(1);
    }
  });

program
  .command('draft-call-scripts')
  .description(
    'OutreachPriority=高/中 かつ WebsiteClass=none/sns_only の企業向けに、Claude API で電話営業スクリプトを生成して Notion に保存',
  )
  .option('-l, --limit <n>', '最大処理件数', (v) => Number.parseInt(v, 10), 20)
  .option('-p, --concurrency <n>', '並列度', (v) => Number.parseInt(v, 10), 3)
  .option('--dry-run', 'Notion に書き込まず、結果のみ表示', false)
  .option(
    '--print-prompts',
    'Anthropic API を叩かず、Claude.ai 貼り付け用の Markdown を stdout に出力(手動運用モード、API キー不要)',
    false,
  )
  .action(
    async (opts: {
      limit: number;
      concurrency: number;
      dryRun: boolean;
      printPrompts: boolean;
    }) => {
      try {
        const summary = await runDraftCallScripts({
          limit: Math.max(1, opts.limit),
          concurrency: Math.max(1, Math.min(10, opts.concurrency)),
          dryRun: opts.dryRun,
          printPrompts: opts.printPrompts,
        });
        // --print-prompts のときは stdout は純粋なプロンプト集なので、サマリは stderr に出す
        const out = opts.printPrompts ? console.error : console.log;
        out('\n=== サマリ ===');
        out(`対象候補         : ${summary.candidates}`);
        if (!opts.printPrompts) {
          out(`生成成功         : ${summary.generated}`);
          out(`エラー           : ${summary.errors}`);
          out(`入力トークン合計 : ${summary.totalInputTokens}`);
          out(`出力トークン合計 : ${summary.totalOutputTokens}`);
          out(`キャッシュヒット : ${summary.totalCacheReadTokens}`);
          out(`推定コスト       : $${summary.estimatedCostUsd.toFixed(4)}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`\n[cli] 実行エラー: ${msg}`);
        process.exit(1);
      }
    },
  );

program
  .command('build-data')
  .description(
    'Notion から OutreachPriority=高/中 × WebsiteClass=none/sns_only の企業を取得し、Phase 2 (HP生成) 用に正規化 JSON を出力',
  )
  .option('-c, --category <category>', '業種で絞り込み (例: "外壁塗装")')
  .option('-m, --min-priority <p>', '最低優先度 (高 / 中 / 低) - これ以上のスコアを含める', '中')
  .option('-o, --out <path>', '出力先 JSON ファイル', 'src/generator/site/data/targets.json')
  .action(async (opts: { category?: string; minPriority: string; out: string }) => {
    if (opts.minPriority !== '高' && opts.minPriority !== '中' && opts.minPriority !== '低') {
      console.error(`[cli] --min-priority は 高/中/低 のいずれか: ${opts.minPriority}`);
      process.exit(1);
    }
    try {
      const summary = await runBuildData({
        category: opts.category,
        minPriority: opts.minPriority as '高' | '中' | '低',
        outFile: opts.out,
      });
      console.log('\n=== サマリ ===');
      console.log(`出力ファイル : ${summary.outFile}`);
      console.log(`件数         : ${summary.count}`);
      console.log(
        `優先度内訳   : 高=${summary.byPriority.高} / 中=${summary.byPriority.中} / 低=${summary.byPriority.低}`,
      );
      const cats = Object.entries(summary.byCategory)
        .map(([c, n]) => `${c}=${n}`)
        .join(', ');
      console.log(`業種内訳     : ${cats || '(なし)'}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n[cli] 実行エラー: ${msg}`);
      process.exit(1);
    }
  });

program
  .command('deploy')
  .description(
    'Phase 3: dist/generated-sites/ を Cloudflare Pages にアップロードし、Notion に PreviewUrl を書き戻す',
  )
  .option('-d, --dist <path>', 'ビルド成果物ディレクトリ', 'dist/generated-sites')
  .option(
    '-t, --targets <path>',
    'デプロイ対象を示す targets.json のパス',
    'src/generator/site/data/targets.json',
  )
  .option(
    '--skip-upload',
    'Cloudflare へのアップロードをスキップ (Notion 書き戻しだけテスト)',
    false,
  )
  .option('--dry-run', 'Cloudflare はアップロードするが Notion 書き戻しはスキップ', false)
  .action(async (opts: { dist: string; targets: string; skipUpload: boolean; dryRun: boolean }) => {
    try {
      const summary = await runDeploy({
        distDir: opts.dist,
        targetsFile: opts.targets,
        skipUpload: opts.skipUpload,
        dryRun: opts.dryRun,
      });
      console.log('\n=== サマリ ===');
      console.log(`Production URL  : ${summary.productionUrl}`);
      console.log(`アップロード    : ${summary.uploaded ? '実行済' : 'スキップ'}`);
      console.log(`対象企業        : ${summary.targetsCount}`);
      if (!opts.dryRun) {
        console.log(`Notion 更新     : ${summary.notionUpdated}`);
        console.log(`Notion 未発見   : ${summary.notionNotFound}`);
        console.log(`Notion エラー   : ${summary.notionErrors}`);
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
