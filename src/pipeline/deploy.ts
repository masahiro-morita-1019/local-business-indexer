import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pLimit from 'p-limit';
import { loadEnv, requireCloudflareConfig, requireDatabaseId } from '../config.ts';
import { deployToCloudflarePages } from '../deployer/cloudflare/wrangler.ts';
import { createNotionClient } from '../notion/client.ts';
import { writePreviewUrl } from '../notion/upsert.ts';

export interface DeployParams {
  /** ビルド成果物のルート(`dist/generated-sites/`) */
  distDir: string;
  /** targets.json のパス(どの placeId をデプロイ対象としたかを Notion 書き戻しに使う) */
  targetsFile: string;
  /** Cloudflare へのアップロードを行わず、Notion 書き戻しだけ試したいとき true */
  skipUpload?: boolean;
  dryRun?: boolean;
}

export interface DeploySummary {
  productionUrl: string;
  uploaded: boolean;
  targetsCount: number;
  notionUpdated: number;
  notionNotFound: number;
  notionErrors: number;
}

interface TargetsFileShape {
  count: number;
  targets: { placeId: string; name: string }[];
}

export async function runDeploy(params: DeployParams): Promise<DeploySummary> {
  const env = loadEnv();
  const cf = requireCloudflareConfig(env);
  const databaseId = requireDatabaseId(env);

  // targets.json を読み込んでデプロイ対象 placeId を把握する。
  // dist/ のディレクトリ名を見て placeId を抽出する手もあるが、targets.json の方が「営業対象」と一致する。
  const file = await readTargets(params.targetsFile);
  console.log(`[deploy] targets.json から ${file.count} 件を確認`);

  let productionUrl = `https://${cf.projectName}.pages.dev`;
  let uploaded = false;

  if (params.skipUpload) {
    console.log('[deploy] --skip-upload のため Cloudflare アップロードはスキップ');
  } else {
    console.log(
      `[deploy] Cloudflare Pages にデプロイ中... (project=${cf.projectName}, dir=${params.distDir})`,
    );
    const res = await deployToCloudflarePages({
      distDir: resolve(params.distDir),
      projectName: cf.projectName,
      accountId: cf.accountId,
      apiToken: cf.apiToken,
    });
    productionUrl = res.productionUrl;
    uploaded = true;
    console.log(`[deploy] アップロード完了: ${productionUrl}`);
  }

  if (params.dryRun) {
    console.log('[deploy] --dry-run のため Notion 書き戻しはスキップ');
    return {
      productionUrl,
      uploaded,
      targetsCount: file.count,
      notionUpdated: 0,
      notionNotFound: 0,
      notionErrors: 0,
    };
  }

  // Notion 側に PreviewUrl + PreviewDeployedAt を書き戻し
  const notion = createNotionClient(env.NOTION_API_KEY);
  const limit = pLimit(2); // Notion API: 3 req/sec

  let notionUpdated = 0;
  let notionNotFound = 0;
  let notionErrors = 0;

  await Promise.all(
    file.targets.map((t) =>
      limit(async () => {
        const previewUrl = `${productionUrl}/${t.placeId}/`;
        try {
          const outcome = await writePreviewUrl(notion, databaseId, t.placeId, previewUrl);
          if (outcome === 'updated') {
            notionUpdated++;
            console.log(`[deploy] Notion 更新: ${t.name} → ${previewUrl}`);
          } else {
            notionNotFound++;
            console.warn(`[deploy] Notion ページ未発見: ${t.name} (place_id=${t.placeId})`);
          }
        } catch (err) {
          notionErrors++;
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[deploy] Notion 更新失敗: ${t.name}: ${msg}`);
        }
      }),
    ),
  );

  return {
    productionUrl,
    uploaded,
    targetsCount: file.count,
    notionUpdated,
    notionNotFound,
    notionErrors,
  };
}

async function readTargets(path: string): Promise<TargetsFileShape> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as TargetsFileShape;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      [
        `targets.json が読めません: ${path}`,
        '先に build-data + generate を実行してください:',
        '  pnpm indexer build-data --category "外壁塗装" --min-priority 中',
        '  pnpm generate',
        `元のエラー: ${msg}`,
      ].join('\n'),
    );
  }
}
