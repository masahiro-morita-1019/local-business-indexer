# Phase 4: 営業文生成 (未実装)

Notion DB の企業情報と Phase 2/3 で作ったプレビューURLをもとに、Claude API でパーソナライズした営業メール(件名 + 本文)を生成するレイヤ。

- `prompts/`: 業種ごとのプロンプトテンプレ。
- `draft.ts`: 1企業分の入力 → Claude API → 件名+本文を返す。

出力は Notion DB の `MailSubject` / `MailBody` プロパティに保存。

CLI想定: `pnpm indexer draft-mail --status HP生成済`
