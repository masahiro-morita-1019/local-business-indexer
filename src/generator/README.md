# Phase 2: HP生成 (未実装)

ターゲット企業向けのコーポレートサイトを Astro + React で自動生成するレイヤ。

- `templates/`: 業種別 Astro テンプレート(3〜5種類想定)。インタラクティブ部分のみ `@astrojs/react` で React コンポーネント化(Islands Architecture)。
- `renderer/`: Notion DB の企業データを取得し、`getStaticPaths` 経由で全社分のページに差し込む処理。

入力: Notion DB の `Status = 未着手` かつ `WebsiteClass != has_website` のページ。
出力: 各社1ディレクトリのHTML静的ファイル群(`/dist/<place_id>/`)。

CLI想定: `pnpm indexer generate --limit 10`
