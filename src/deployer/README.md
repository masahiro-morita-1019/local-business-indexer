# Phase 3: デプロイ (未実装)

Phase 2 で生成した静的ファイル群を公開URLとして発行するレイヤ。

- `cloudflare/`: Cloudflare Pages の Direct Upload API を使ったデプロイ。プロジェクトを1社1つ、または共有プロジェクトのサブパス運用、のいずれかは実装時に判断。

入力: `/dist/<place_id>/` ディレクトリ。
出力: 公開URL(Notion DB の `PreviewUrl` プロパティに保存予定)。

CLI想定: `pnpm indexer deploy --place-id <id>` または `pnpm indexer deploy --status HP生成済`
