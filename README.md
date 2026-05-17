# local-business-indexer

Google Maps の特定エリア × 業種を調査し、**ホームページ未保有の企業** を Notion DB に集約する CLI ツール。HP制作の営業先リストを自動構築するのが目的。

将来的には「調査 → HP生成 → デプロイ → 営業文作成 → Gmail下書き」までの一貫ツールに発展させる予定(本リポジトリ内に Phase 2〜5 のディレクトリ骨格あり)。

## 現在のMVPスコープ

調査フェーズのみ:

1. Google Places API (New) で `area × category` を検索
2. `websiteUri` を `none` / `sns_only` / `has_website` の3段階に分類
3. `none` と `sns_only` を営業対象として Notion DB に upsert(`place_id` をキー)

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

## 使い方

```bash
# 相模原市の工務店を最大60件調査(デフォルト)
pnpm indexer discover --area "相模原市" --category "工務店"

# 件数を絞る + Notion 書き込みなしで結果だけ確認
pnpm indexer discover --area "町田市" --category "塗装業" --limit 20 --dry-run
```

CLI オプション:

| オプション | 必須 | 説明 |
|---|---|---|
| `--area, -a` | ✓ | 検索エリア(例: `"相模原市"`) |
| `--category, -c` | ✓ | 業種(例: `"工務店"`) |
| `--limit, -l` | | 最大取得件数(1〜60、デフォルト60) |
| `--dry-run` | | Notion 書き込みをスキップ |

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
├── cli.ts              # CLIエントリ
├── config.ts           # 環境変数(zod検証)
├── discovery/          # Phase 1: 調査(MVP実装済)
│   ├── places/         # Places API (New) クライアント
│   └── filter/         # HP判定ロジック(3段階分類)
├── notion/             # 共通: Notion永続化レイヤ
├── pipeline/           # 共通: 各フェーズのオーケストレータ
│   └── discover.ts     # Phase 1 統合フロー
├── generator/          # Phase 2: HP生成 (未実装)
├── deployer/           # Phase 3: デプロイ (未実装)
├── sales/              # Phase 4: 営業文生成 (未実装)
└── mail/               # Phase 5: メール下書き (未実装)
```

Phase 2〜5 は README のみ置き、実装はまだ。

## 設計の意図

詳細な設計判断は `~/.claude/plans/google-map-hp-goofy-thunder.md` 参照。要点:

- **Places API (New) の `searchText` のみで完結**: `websiteUri` を FieldMask で要求すれば Place Details を呼ばずに済む → コスト削減。
- **3段階分類**: `websiteUri` が空 → `none`、SNS/簡易LPのみ → `sns_only`、独自ドメイン → `has_website`。営業優先度を可視化。
- **upsert は事実情報のみ更新**: 運用側で更新した `Status` / `Notes` は自動上書きしない。
- **手動送信前提**: メール自動送信はしない(特定電子メール法 / 誤送信リスク回避)。Phase 5 は Gmail 下書き作成まで。
