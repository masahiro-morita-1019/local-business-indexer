# local-business-indexer

Google Maps の特定エリア × 業種を調査し、**ホームページ未保有の企業** を Notion DB に集約する CLI ツール。HP制作の営業先リストを自動構築するのが目的。

将来的には「調査 → HP生成 → デプロイ → 営業文作成 → Gmail下書き」までの一貫ツールに発展させる予定(本リポジトリ内に Phase 2〜5 のディレクトリ骨格あり)。

## 現在のスコープ

- **Phase 1: 調査** — Google Places API で店舗検索 → `none` / `sns_only` / `has_website` の3段階に分類 → 全件を Notion DB に保存
- **Phase 1.5: コンタクトスクレイパー** — `has_website` の企業のHPからメアド/問い合わせフォームURLを抽出 → Notion に追記

営業チャネル方針(A+B+D):

- **A. 郵送DM**: `none` / `sns_only` 向け(住所・店名を使用)
- **B. 電話営業**: `none` / `sns_only` 向け(電話番号を使用)
- **D. メール営業**: `has_website` 向け(Phase 1.5 で取得したメアド)

Phase 2(HP生成)以降は今後実装。

## セットアップ

### 1. 依存インストール

```bash
pnpm install
```

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

`schema.ts` に追加されたプロパティを idempotent に追加。既存DBに対し Phase 1.5 用の `Email` / `ContactFormUrl` 等を追加するときに使う。

## 使い方

### Phase 1: 調査

```bash
# 相模原市の工務店を最大60件調査(デフォルト)
pnpm indexer discover --area "相模原市" --category "工務店"

# 件数を絞る + Notion 書き込みなしで結果だけ確認
pnpm indexer discover --area "町田市" --category "塗装業" --limit 20 --dry-run
```

| オプション | 必須 | 説明 |
|---|---|---|
| `--area, -a` | ✓ | 検索エリア(例: `"相模原市"`) |
| `--category, -c` | ✓ | 業種(例: `"工務店"`) |
| `--limit, -l` | | 最大取得件数(1〜60、デフォルト60) |
| `--dry-run` | | Notion 書き込みをスキップ |

検索結果は `WebsiteClass = none / sns_only / has_website` を問わず **全件 Notion に保存** される。営業対象は後段の Notion ビューでフィルタする。

### Phase 4-B: 電話スクリプト生成

`OutreachPriority = 高/中` かつ `WebsiteClass ∈ {none, sns_only}` の企業向けに、Claude API で電話営業スクリプトを生成して Notion に保存する。

```bash
pnpm indexer draft-call-scripts --limit 10
```

| オプション | 説明 |
|---|---|
| `--limit, -l` | 最大処理件数(デフォルト 20) |
| `--concurrency, -p` | 並列度(1〜10、デフォルト 3) |
| `--dry-run` | Notion 書き込みをスキップ(生成のみ) |

事前準備:
- `.env` に `ANTHROPIC_API_KEY` を設定
- `.env` に差出人情報(`OUTREACH_SENDER_NAME` 等)を設定。屋号未登録なら個人名で OK
- `pnpm migrate:notion` で `CallScript` / `CallScriptGeneratedAt` プロパティを追加

スクリプトの構成(自動生成される4セクション):
1. **導入** — 名乗り + 営業目的明示(特商法電話勧誘規制対応)
2. **価値訴求** — Google評価/レビュー数/HP状態に応じたパーソナライズ
3. **反論対応** — 「困ってない」「コスト」「時間ない」への切り返し
4. **クロージング** — サンプルHP提示の二段構え提案 + 引き際明示(再勧誘禁止対応)

使用モデル: **Claude Opus 4.7** (`claude-opus-4-7`)。1社あたり推定 $0.02。

### Phase 1.5: コンタクトスクレイパー

`has_website` の企業のHPからメアド/問い合わせフォームを抽出して Notion に追記する。

```bash
# 最大50件処理(デフォルト)
pnpm indexer extract-contacts

# 件数を絞ってDryRun(Notion書き込みなし)
pnpm indexer extract-contacts --limit 10 --dry-run
```

| オプション | 説明 |
|---|---|
| `--limit, -l` | 最大処理件数(デフォルト 50) |
| `--concurrency, -p` | 並列度(1〜10、デフォルト 3)。**同一ドメインへの連続アクセスは1req/sec 制限** |
| `--dry-run` | Notion 書き込みをスキップ |

抽出ロジック:
- robots.txt 尊重(Disallow に該当するパスはスキップ)
- `mailto:` リンク + 本文中のメアド(`info[at]example.com` 等の簡易難読化にも対応)
- 採用/サポート/no-reply 系の役割アドレスは自動除外
- 問い合わせフォーム(`<form>` の action URL)も検出して保存
- Cloudflare Email Protection は復号せず、ノートに警告だけ残す

## おすすめのテスト対象

HP未保有率が体感的に高い組み合わせ:

- **エリア**: 首都圏郊外の中規模都市 — `相模原市` / `町田市` / `松戸市` など
- **業種**: 建設関連 — `工務店` / `塗装業` / `内装工事` / `解体業`

```bash
pnpm indexer discover --area "相模原市" --category "工務店" --limit 60
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
│   └── contact-extractor/    # コンタクト情報スクレイパー (Phase 1.5)
├── notion/                   # 共通: Notion永続化レイヤ
├── pipeline/
│   ├── discover.ts           # Phase 1 統合
│   └── extractContacts.ts    # Phase 1.5 統合
├── generator/                # Phase 2: HP生成 (未実装)
├── deployer/                 # Phase 3: デプロイ (未実装)
├── sales/                    # Phase 4: 営業文生成 (未実装、outreach/ に再編予定)
└── mail/                     # Phase 5: メール下書き (未実装、outreach/email/ に再編予定)
```

Phase 2 以降は README のみ置き、実装はまだ。

## 設計の意図

詳細な設計判断は `~/.claude/plans/google-map-hp-goofy-thunder.md` 参照。要点:

- **Places API (New) の `searchText` のみで完結**: `websiteUri` を FieldMask で要求すれば Place Details を呼ばずに済む → コスト削減。
- **3段階分類**: `websiteUri` が空 → `none`、SNS/簡易LPのみ → `sns_only`、独自ドメイン → `has_website`。営業優先度を可視化。
- **upsert は事実情報のみ更新**: 運用側で更新した `Status` / `Notes` は自動上書きしない。
- **手動送信前提**: メール自動送信はしない(特定電子メール法 / 誤送信リスク回避)。Phase 5 は Gmail 下書き作成まで。
