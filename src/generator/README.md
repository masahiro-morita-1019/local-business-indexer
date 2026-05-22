# Phase 2: HP生成

ターゲット企業向けのサンプルコーポレートサイトを Astro v6 + `@astrojs/react` で自動生成するレイヤ。

電話・郵送DM営業の前段で「サンプルHPを既に作りました」と提示するための **Show, Don't Tell 型** の入り口。

## 入出力

- **入力**: `src/generator/site/data/targets.json`(`pnpm indexer build-data` で Notion から生成)
- **出力**: `dist/generated-sites/<placeId>/index.html`(全社分)

Astro 側は Notion API を直接叩かず、`targets.json` を契約点として読み込む。これにより:
- プレビュー/ビルドがネット切断・Notion レート制限に影響されない
- ジェネレータ単体でテスト可能
- Phase 3 デプロイで同じ JSON を再利用可能

## ディレクトリ

```
src/generator/
├── README.md
└── site/
    ├── astro.config.mjs            React integration + output: static
    ├── tsconfig.json               (astro/tsconfigs/strict 拡張)
    ├── data/
    │   └── targets.json            (build-data の出力 — gitignore)
    └── src/
        ├── data/
        │   ├── types.ts            (Target / TargetsFile スキーマ。buildData.ts と一致させる)
        │   └── loadTargets.ts      (targets.json を Vite で取り込む)
        ├── layouts/
        │   └── BaseLayout.astro    (head/meta/共通CSS)
        ├── components/
        │   ├── Hero.astro
        │   ├── Services.astro
        │   └── ContactSection.astro
        ├── templates/
        │   └── gaiheki/
        │       ├── HomePage.astro  (外壁塗装サイトの骨子)
        │       └── content.ts      (装飾コピー = 汎用文言、店ごとの事実は target から)
        └── pages/
            ├── index.astro         (プレビューUI = 全社一覧)
            └── [placeId].astro     (getStaticPaths で全社分書き出し)
```

## 使い方

```bash
# 1. Notion から正規化 JSON を生成(外壁塗装 + OutreachPriority=高/中)
pnpm indexer build-data --category "外壁塗装" --min-priority 中

# 2-A. ローカル開発サーバを起動(ホットリロードあり)
pnpm preview                # http://localhost:4321

# 2-B. 静的ビルド(本番用)
pnpm generate               # dist/generated-sites/ に書き出し

# 一括: build-data + preview
pnpm site
```

## 透明性原則の運用

`templates/gaiheki/content.ts` の装飾コピー(キャッチコピー / サービス説明)は **汎用テンプレート**。創作した実績年数・保証年数・受賞歴は default に入れない。

サンプルHPには:
- ✅ 事実: 店名 / 住所 / 電話 / Googleレビュー(`target` から)
- ⚠️ 汎用: キャッチコピー / 対応工事リスト / ご依頼の流れ(`content.ts` から)
- 🚫 創作禁止: 実績数 / 受賞歴 / 保証年数(店主と一緒に詰めるフェーズで追加)

サンプルHP上部には「⚠️ これは外壁塗装サンプルHPです。事実情報は Google マップから取得しており、装飾コピーは汎用のたたき台です」と明示している(`HomePage.astro` のトップバー)。

## 横展開(他業種テンプレを増やす場合)

1. `src/templates/<業種>/content.ts` を新規作成(`GaihekiCopy` の型を参考に業種固有の構造を定義)
2. `src/templates/<業種>/HomePage.astro` を実装
3. `src/pages/[placeId].astro` の業種分岐に新業種を追加
4. `pnpm indexer build-data --category "<業種>"` で対応企業の `targets.json` を生成

外壁塗装の `target.outreachReasons` を表示しているプレビュー UI のレイアウトはそのまま流用可能。
