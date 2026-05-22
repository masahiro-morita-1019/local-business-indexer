import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';

/**
 * Wrangler CLI を介して Cloudflare Pages にプロダクションデプロイする。
 *
 * 直接 Cloudflare API を叩く実装も可能だが、
 *   - アセット差分計算 / アップロード / デプロイ作成 を全部自前実装するのは負債が大きい
 *   - Wrangler は公式メンテで仕様変更に追従してくれる
 * という判断で Wrangler を spawn する形にする。
 *
 * プロジェクトが未存在のとき、Wrangler は対話で作成可否を聞いてくる。
 * これを抑制するため `--commit-dirty=true` を渡し、stdin を inherit ではなく closed にする。
 * (それでも対話プロンプトに当たる場合は、先に `wrangler pages project create <name>` を別途呼ぶ運用を README に記載)
 */

export interface DeployArgs {
  distDir: string;
  projectName: string;
  accountId: string;
  apiToken: string;
}

export interface DeployResult {
  /** プロダクション URL(常に <project>.pages.dev) */
  productionUrl: string;
  /** Wrangler の stdout(ログ確認用) */
  stdout: string;
}

export async function deployToCloudflarePages(args: DeployArgs): Promise<DeployResult> {
  await assertDistDirExists(args.distDir);

  // CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID を env に渡すことで wrangler が認証する。
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CLOUDFLARE_API_TOKEN: args.apiToken,
    CLOUDFLARE_ACCOUNT_ID: args.accountId,
    // wrangler が telemetry を尋ねる対話を抑制
    WRANGLER_SEND_METRICS: 'false',
  };

  const wranglerArgs = [
    'wrangler',
    'pages',
    'deploy',
    args.distDir,
    '--project-name',
    args.projectName,
    '--branch',
    'main',
    '--commit-dirty=true',
  ];

  return await new Promise<DeployResult>((resolve, reject) => {
    const proc = spawn('pnpm', wranglerArgs, {
      env,
      // stdin は閉じる(対話プロンプトを暗黙的に no として扱わせるため)
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stdout += text;
      process.stdout.write(text);
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stderr += text;
      process.stderr.write(text);
    });

    proc.on('error', (err) => {
      reject(new Error(`wrangler の起動に失敗: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        const hint =
          stderr.includes('not found') || stderr.includes('does not exist')
            ? `\nHint: 初回 deploy 時は先に "pnpm wrangler pages project create ${args.projectName}" を実行してプロジェクトを作成してください。`
            : '';
        reject(new Error(`wrangler が異常終了 (exit ${code})${hint}`));
        return;
      }
      const productionUrl = `https://${args.projectName}.pages.dev`;
      resolve({ productionUrl, stdout });
    });
  });
}

async function assertDistDirExists(distDir: string): Promise<void> {
  try {
    const s = await stat(distDir);
    if (!s.isDirectory()) {
      throw new Error(`${distDir} はディレクトリではありません`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      [
        `ビルド成果物が見つかりません: ${distDir}`,
        '先に Phase 2 のビルドを実行してください:',
        '  pnpm indexer build-data --category "外壁塗装" --min-priority 中',
        '  pnpm generate',
        `元のエラー: ${msg}`,
      ].join('\n'),
    );
  }
}
