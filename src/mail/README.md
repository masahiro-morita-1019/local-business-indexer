# Phase 5: メール送付(下書きまで)(未実装)

Phase 4 で生成した営業メール本文を Gmail の下書きとして作成するレイヤ。**自動送信はしない**(特定電子メール法対応 / 1人運用での誤送信リスク回避)。

- `gmail/`: Gmail API の `drafts.create` で下書きを作成。送信は人間が Gmail UI で内容確認した上で実施。

出力: Notion DB の `Status` を `メール下書き` に更新。

CLI想定: `pnpm indexer draft-mail --status HP生成済` の延長(または別コマンド)で下書きまで一気通貫。
