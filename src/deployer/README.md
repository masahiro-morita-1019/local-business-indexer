# Phase 3: デプロイ

Phase 2 で生成した静的ファイル群を Cloudflare Pages に公開し、URL を Notion に書き戻すレイヤ。

## 設計

- **構成**: 全社 1 プロジェクト + サブパス(`https://<project>.pages.dev/<placeId>/`)
- **slug**: `placeId` をそのまま使う(衝突ゼロ・実装不要)
- **デプロイ手段**: Wrangler CLI を spawn(直接 API 実装より工数が圧倒的に少なく、Cloudflare 公式メンテに乗れる)
- **書き戻し**: 各社の Notion ページに `PreviewUrl` をセット、`Status=未着手` の場合のみ `HP生成済` に上書き(架電済等の営業中ステータスは尊重)

## 環境変数

`.env` に以下を設定する(`.env.example` 参照):

| 変数 | 取得方法 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | https://dash.cloudflare.com/profile/api-tokens で "Cloudflare Pages: Edit" 権限のトークンを発行 |
| `CLOUDFLARE_ACCOUNT_ID` | ダッシュボード右サイドバー or URL の `dash.cloudflare.com/<id>` から取得 |
| `CLOUDFLARE_PAGES_PROJECT` | プロジェクト名(英数とハイフン)。初回 deploy 時に自動作成 |

## 使い方

```bash
# 0. (初回のみ) Notion DB に PreviewUrl / PreviewDeployedAt プロパティを追加
pnpm migrate:notion

# 1. データ取得 + 静的ビルド
pnpm indexer build-data --category "外壁塗装" --min-priority 中
pnpm generate

# 2. Cloudflare にアップロード + Notion 書き戻し
pnpm indexer deploy

# Notion 書き戻しだけ試したい(既にアップ済の状態で URL を再書き込み)
pnpm indexer deploy --skip-upload

# Cloudflare にはアップロードするが Notion は触らない
pnpm indexer deploy --dry-run
```

## 初回 deploy 時の注意

Wrangler はプロジェクト未存在時に **対話プロンプトで作成可否を聞いてくる** ことがある。本ツールでは stdin を閉じているため対話は通らない可能性があり、もし失敗したら次のコマンドで先にプロジェクトを作っておく:

```bash
pnpm wrangler pages project create local-business-samples --production-branch=main
```

## ディレクトリ

```
src/deployer/
├── README.md (このファイル)
└── cloudflare/
    └── wrangler.ts   # Wrangler CLI を spawn する薄いラッパ
```

オーケストレーション(targets.json 読み込み + デプロイ + Notion 書き戻し)は `src/pipeline/deploy.ts` 側に置いている。
