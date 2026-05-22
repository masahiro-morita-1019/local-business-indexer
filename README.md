# local-business-indexer

Google Maps の特定エリア × 業種を調査し、**ホームページ未保有の企業** を Notion DB に集約する CLI ツール。HP制作の営業先リストを自動構築するのが目的。

将来的には「調査 → HP生成 → デプロイ → 営業文作成 → Gmail下書き」までの一貫ツールに発展させる予定(本リポジトリ内に Phase 2〜5 のディレクトリ骨格あり)。

## 現在のスコープ

- **Phase 1: 調査** — Google Places API で店舗検索 → `none` / `sns_only` / `has_website` の3段階に分類 → `none` と `sns_only` のみ Notion DB に保存。`has_website` 化した既存ページは `Status=見送り` に遷移。
- **Phase 2: HP生成** — Astro v6 + `@astrojs/react` で「サンプルHP」を全社分静的書き出し。外壁塗装テンプレ実装済(`src/generator/site/`)。ローカルプレビューUI(`/`) + 個社ページ(`/<placeId>`)。
- **Phase 3: デプロイ** — Cloudflare Pages に全社1プロジェクト + サブパスで公開(`https://<project>.pages.dev/<placeId>/`)。Wrangler CLI 経由。デプロイ後 Notion の `PreviewUrl` に各社の URL、`Status=未着手` のみ `HP生成済` に遷移。
- **Phase 4-B: 電話スクリプト生成** — `OutreachPriority=高/中` × `WebsiteClass ∈ {none, sns_only}` 向けに Claude API でトークスクリプトを生成。

営業チャネル方針(**A+B 体制**):

- **A. 郵送DM**: `none` / `sns_only` 向け(住所・店名を使用)
- **B. 電話営業**: `none` / `sns_only` 向け(電話番号を使用)

> 2026-05-21、所沢市×外壁塗装の実観察を踏まえ、独自ドメインのHPを持つ企業へのメール営業(D ルート)は廃止しました。AI製サンプルで上書き提案するメリットが薄く、調査コストに見合わないため。詳細は `docs/classification-rules.md` 参照。

Phase 2(HP生成)以降は今後実装。

## セットアップ

### 1. 依存インストール

```bash
pnpm install
```

Node.js **22.12 以上** が必要。

### 2. Google Places API キーを取得

[Google Cloud Console](https://console.cloud.google.com/google/maps-apis/credentials) で **Places API (New)** を有効化し、API キーを発行。

### 3. Notion インテグレーションを作成

[Notion インテグレーション](https://www.notion.so/my-integrations) で internal integration を作成し、Secret(`secret_...`)を取得。

Notion 側で **DB を作成したい親ページに、このインテグレーションをアクセス権限として追加**(`...` メニュー → コネクトを追加)。

親ページの ID を URL の末尾(`https://www.notion.so/<workspace>/<32文字英数>?...` の32文字部分)からコピー。

### 4. `.env` を用意

```bash
cp .env.example .env
```

`.env` に以下を記入:

```
GOOGLE_MAPS_API_KEY=...
NOTION_API_KEY=secret_...
NOTION_PARENT_PAGE_ID=<32文字の親ページID>
```

### 5. Notion DB を作成

```bash
pnpm setup:notion
```

出力された `database_id` を `.env` の `NOTION_DATABASE_ID` に追記。

#### 既にDB作成済の場合(スキーマ更新)

```bash
pnpm migrate:notion
```

`schema.ts` に追加されたプロパティを idempotent に追加。**ただし削除はされない** ため、D ルート廃止後に既存DBから `Email` / `ContactFormUrl` / `ContactExtractedAt` / `ContactExtractionNote` / `ActualUrl` / `UsesHttps` / `メール下書き` Status を消したい場合は **Notion UI から手動削除** してください。

## 使い方

### Phase 1: 調査

```bash
# 所沢市の外壁塗装を最大60件調査(Tier S 業種を推奨)
pnpm indexer discover --area "所沢市" --category "外壁塗装"

# 件数を絞る + Notion 書き込みなしで結果だけ確認
pnpm indexer discover --area "町田市" --category "リフォーム" --limit 20 --dry-run
```

| オプション | 必須 | 説明 |
|---|---|---|
| `--area, -a` | ✓ | 検索エリア(例: `"所沢市"`) |
| `--category, -c` | ✓ | 業種(例: `"外壁塗装"`) |
| `--limit, -l` | | 最大取得件数(1〜60、デフォルト60) |
| `--dry-run` | | Notion 書き込みをスキップ |

**保存対象**: `WebsiteClass ∈ {none, sns_only}` のみ。`has_website` の店は **新規 upsert されない**。既存ページが has_website に変化した場合は `Status=未着手` のときだけ `見送り` に遷移する。

### Phase 2: HP生成(サンプルHP一覧 + 個社ページ)

`OutreachPriority=高/中` × `WebsiteClass ∈ {none, sns_only}` の企業向けに、外壁塗装サンプルHPを全社分静的書き出しする。

```bash
# 1. Notion から正規化 JSON を生成
pnpm indexer build-data --category "外壁塗装" --min-priority 中

# 2. ローカル開発サーバ起動(http://localhost:4321)
pnpm preview

# 3. 静的ビルド(本番用 → dist/generated-sites/<placeId>/index.html)
pnpm generate

# build-data + preview を一発で
pnpm site
```

- 入力: `src/generator/site/data/targets.json`(build-data CLI の出力)
- 出力: `dist/generated-sites/<placeId>/index.html`
- テンプレ: 外壁塗装のみ実装済(`src/generator/site/src/templates/gaiheki/`)。横展開は同README参照
- 透明性: 店ごとの事実(店名 / 電話 / 住所 / Googleレビュー)は target から差し込み、装飾コピーは汎用テンプレ。サンプルHP上部に「これはサンプル」と明示

詳細は [src/generator/README.md](src/generator/README.md) 参照。

### Phase 3: Cloudflare Pages にデプロイ

```bash
# 初回のみ: PreviewUrl / PreviewDeployedAt プロパティを Notion DB に追加
pnpm migrate:notion

# Cloudflare Pages に全社1プロジェクトでアップロード + Notion に PreviewUrl を書き戻し
pnpm indexer deploy
```

事前準備:
- `.env` に `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_PAGES_PROJECT` を設定
- `pnpm indexer build-data` + `pnpm generate` で `dist/generated-sites/` を作っておく

公開 URL: `https://<CLOUDFLARE_PAGES_PROJECT>.pages.dev/<placeId>/`

詳細は [src/deployer/README.md](src/deployer/README.md) 参照。

### Phase 4-B: 電話スクリプト生成

`OutreachPriority = 高/中` かつ `WebsiteClass ∈ {none, sns_only}` の企業向けに、電話営業スクリプトを生成する。

#### 設計の前提: Show, Don't Tell 型

生成されるスクリプトは **「サンプルHPを既に作ったので見てください」型** で構成される。
従来の「ご提案させてください」型(=アポ取り)ではない。

→ **電話する前に、相手企業向けの簡易サンプルHPを1ページ作っておく必要がある**。
電話のゴールは「メールでサンプルURLを送る了承を取ること」。

スタンス・装備は `.env` の `OUTREACH_PITCH_CONTEXT` で自由文として上書き可能。
未設定時はデフォルト(サンプルHP準備済み前提)が使われる。

**運用モード**:

#### モード A: 手動運用(`--print-prompts`)

Claude.ai に貼り付ける用のプロンプト集を Markdown で出力。**API キー不要・課金なし**。プロンプトチューニング期や少量(10件以下)の運用に向く。

```bash
pnpm indexer draft-call-scripts --limit 10 --print-prompts > prompts.md
```

`prompts.md` を開いて Claude.ai にコピペ → 生成されたスクリプトを Notion DB の `CallScript` 列に手で貼り戻す運用。

事前準備: `OUTREACH_SENDER_NAME` 等の差出人情報のみ設定すれば OK(`ANTHROPIC_API_KEY` 不要)。

#### モード B: 完全自動(Anthropic API 経由)

Claude API で生成 → Notion に自動書き戻し。

```bash
pnpm indexer draft-call-scripts --limit 10
```

| オプション | 説明 |
|---|---|
| `--limit, -l` | 最大処理件数(デフォルト 20) |
| `--concurrency, -p` | 並列度(1〜10、デフォルト 3) |
| `--dry-run` | Notion 書き込みをスキップ(生成のみ) |
| `--print-prompts` | API を叩かず、Claude.ai 貼付用 Markdown を stdout 出力 |

事前準備:
- `.env` に `ANTHROPIC_API_KEY` を設定(モード B のみ必要)
- `.env` に差出人情報(`OUTREACH_SENDER_NAME` 等)を設定。屋号未登録なら個人名で OK
- `pnpm migrate:notion` で `CallScript` / `CallScriptGeneratedAt` プロパティを追加

**推奨フロー**: まず `--print-prompts` で 2-3 件試して文面を確認・プロンプト調整 → 固まったら `--print-prompts` なしの自動モードに切り替え。

スクリプトの構成(自動生成される4セクション):
1. **導入** — 名乗り + 営業目的明示(特商法電話勧誘規制対応)
2. **価値訴求** — Google評価/レビュー数/HP状態に応じたパーソナライズ
3. **反論対応** — 「困ってない」「コスト」「時間ない」への切り返し
4. **クロージング** — サンプルHP提示の二段構え提案 + 引き際明示(再勧誘禁止対応)

使用モデル: **Claude Opus 4.7** (`claude-opus-4-7`)。1社あたり推定 $0.02。

## おすすめのテスト対象

HP未保有率 × 単価の組み合わせが良い業種は `docs/target-industries.md` 参照。

Tier S(最有力):
- **外壁塗装** / **リフォーム** / **エアコンクリーニング** / **害虫駆除** / **不用品回収** / **ハウスクリーニング**

```bash
pnpm indexer discover --area "所沢市" --category "外壁塗装" --limit 60
```

## 開発

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # biome check
pnpm format      # biome format --write
pnpm test        # vitest
```

## ディレクトリ構成

```
src/
├── cli.ts                    # CLIエントリ
├── config.ts                 # 環境変数(zod検証)
├── discovery/
│   ├── places/               # Places API (New) クライアント (Phase 1)
│   ├── filter/               # HP判定ロジック (Phase 1)
│   └── classify/             # chainStore / legalForm / priority (Phase 1)
├── notion/                   # 共通: Notion永続化レイヤ
├── pipeline/
│   ├── discover.ts           # Phase 1 統合
│   ├── buildData.ts          # Phase 2: Notion → 正規化JSON
│   └── deploy.ts             # Phase 3: Cloudflare Pages デプロイ + Notion 書き戻し
├── outreach/
│   └── call/                 # Phase 4-B: 電話スクリプト生成
├── llm/                      # Anthropic SDK ラッパ
├── generator/                # Phase 2: HP生成 (実装済)
│   └── site/                 # Astro v6 プロジェクト (独立 tsconfig)
├── deployer/                 # Phase 3: デプロイ (実装済)
│   └── cloudflare/           # Wrangler CLI ラッパ
├── sales/                    # (将来 outreach/ 配下に再編予定)
└── mail/                     # (将来 outreach/email/ に再編予定)
```

Phase 2 以降は README のみ置き、実装はまだ。

## 設計の意図

詳細な設計判断は `~/.claude/plans/google-map-hp-goofy-thunder.md` 参照。要点:

- **Places API (New) の `searchText` のみで完結**: `websiteUri` を FieldMask で要求すれば Place Details を呼ばずに済む → コスト削減。
- **3段階分類**: `websiteUri` が空 → `none`、SNS/簡易LPのみ → `sns_only`、独自ドメイン → `has_website`。営業対象は `{none, sns_only}` のみ。
- **upsert は事実情報のみ更新**: 運用側で更新した `Status` / `Notes` は自動上書きしない(例外: has_website 遷移時の Status=見送り は `未着手` のページに限り上書きする)。
- **手動送信前提**: メール自動送信はしない(特定電子メール法 / 誤送信リスク回避)。
