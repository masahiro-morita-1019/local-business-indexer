# 識別ルール一覧

このドキュメントは、Phase 1(調査)で各店舗に付与される **すべての識別フラグ・分類** を定義する。営業判断はこれらのフラグの組み合わせで自動化されるため、**ルールが何をどう判定しているかを把握しておくこと** が重要。

> 📌 **更新の指針**: 営業を回す中で「これは違うだろ」という誤判定が出たら、ここを更新する起点にしてください。各ルールに対応するコードと、誤判定が出たときに変えるべきパラメータを明示しています。

> 📌 **2026-05-21 方針転換**: D ルート(`has_website` への メール営業)を廃止。`has_website` の店は **Notion に新規 upsert されない** ようになった。代わりに、既存ページが has_website に遷移した場合は WebsiteClass を更新 + Status が `未着手` のときだけ `見送り` に切り替える。営業チャネルは **A(郵送DM) + B(電話)** の 2チャネル運用。

---

## 識別フラグ一覧

| Notion プロパティ | 型 | 意味 | コード |
|---|---|---|---|
| `WebsiteClass` | Select | HPの所有状態を3段階で分類 | `src/discovery/filter/noWebsite.ts` |
| `DecisionReason` | Rich text | `WebsiteClass` を決めた根拠(監査用) | 同上 |
| `IsChainStore` | Checkbox | 大手ハウスメーカー等の **チェーン店舗** か | `src/discovery/classify/chainStore.ts` |
| `ChainName` | Rich text | チェーン名(マッチした場合のみ) | 同上 |
| `LegalForm` | Select | 法人格(株/有/合同/NPO/…/不明) | `src/discovery/classify/legalForm.ts` |
| `OutreachPriority` | Select | 営業優先度の3段階ラベル(高/中/低/除外) | `src/discovery/classify/priority.ts` |
| `OutreachScore` | Number | 加点ルールから計算した数値スコア | 同上 |
| `OutreachReasons` | Rich text | スコアに加算されたルール名一覧(監査用) | 同上 |

---

## 1. WebsiteClass — HP所有状態の3段階分類

### 値

| 値 | 意味 | Notion保存 | 主な営業チャネル |
|---|---|---|---|
| `none` | `websiteUri` が未登録 | ✅ 新規 upsert | A(郵送DM)/ B(電話) |
| `sns_only` | `websiteUri` あり、ただしSNSや簡易LPなど **自社HPと言いがたいもののみ** | ✅ 新規 upsert | A / B |
| `has_website` | 独自ドメインの自社HPがある | ❌ 新規 upsert しない(既存ページは見送りへ遷移) | 営業対象外 |

### `sns_only` 扱いとするドメインリスト

末尾一致(サブドメイン含む)で判定。

**SNS系**
- `facebook.com` / `instagram.com` / `x.com` / `twitter.com`
- `line.me` / `lin.ee`
- `ameba.jp` / `ameblo.jp`

**グルメ/予約/口コミポータル**
- `tabelog.com` / `hotpepper.jp`
- `ekiten.jp` / `goo.ne.jp`
- `gnavi.co.jp` / `r.gnavi.co.jp`

**簡易LP/EC/ノーコード**
- `peraichi.com` / `lit.link`
- `stores.jp` / `minne.com`
- `base.shop` / `base.ec`
- `jimdofree.com` / `wixsite.com` / `amebaownd.com`

### 注意点

- `websiteUri` が空 ≠ 確実にHPなし。Google Maps 未登録のケースがある(本社HPはあるが店舗オーナーが Maps に登録していない等)。
  - 営業前に **店名で再ググる** 運用を推奨。
- 上記リスト以外の独自ドメインはすべて `has_website` 扱いになり、**営業対象から外れる**。境界事例(Wix のサブドメイン等)があれば `DEFAULT_SNS_DOMAINS` に追記して救済。

### has_website 遷移時の挙動(discover の更新ロジック)

過去に `none` / `sns_only` で Notion に保存した企業が、再 discover 時に `has_website` に変化した場合:

- `WebsiteClass` を `has_website` に更新
- `Website` / `DecisionReason` / `LastCheckedAt` も同時に更新
- `Status` が `未着手` のときだけ `見送り` に切り替える(`架電済` 等の営業中ステータスは尊重)

→ 古い「HPなし候補」が陳腐化したまま残り続けるのを防ぐ。

### ルール変更箇所
`src/discovery/filter/noWebsite.ts` の `DEFAULT_SNS_DOMAINS` 配列。

---

## 2. IsChainStore — 大手チェーン除外

### なぜ判定するか
大手ハウスメーカー(一条工務店、積水ハウス、ミサワホーム等)の **展示場・モデルハウス・営業所** は、本社の方針でWeb運用が決まっているため、HP制作の営業対象外。これを Notion で確実にフィルタアウトするためのフラグ。

### 判定方法
以下の優先順位で先勝ち:

1. **Webサイトのドメイン末尾一致**(信頼度高)
2. **店名に「チェーン名」を含む**(信頼度中)

両方 false なら `IsChainStore=false`、`ChainName` は空。
どちらかにヒットすれば `IsChainStore=true`、`ChainName` に正規化されたチェーン名を保存。

### 検出対象チェーン(2026-05-19 時点)

| チェーン名 | ドメイン | 店名パターン |
|---|---|---|
| 一条工務店 | `ichijo.co.jp` | `一条工務店` |
| アイ工務店 | `ai-koumuten.co.jp`, `ai-koumuten.com` | `アイ工務店` |
| 積水ハウス | `sekisuihouse.co.jp` | `積水ハウス` |
| 大和ハウス | `daiwahouse.co.jp`, `daiwahouse.com` | `大和ハウス`, `ダイワハウス` |
| 住友林業 | `sfc.jp` | `住友林業` |
| ミサワホーム | `misawa.co.jp`, `misawahome.co.jp` | `ミサワホーム` |
| パナソニックホームズ | `panasonichomes.co.jp` | `パナソニックホームズ`, `パナソニック ホームズ` |
| ヘーベルハウス | `hebelhaus.com`, `asahi-kasei.co.jp` | `ヘーベルハウス`, `へーベルハウス` |
| セキスイハイム | `sekisuiheim.com` | `セキスイハイム` |
| トヨタホーム | `toyotahome.co.jp` | `トヨタホーム` |
| タマホーム | `tamahome.jp` | `タマホーム` |
| アエラホーム | `aerahome.com` | `アエラホーム` |
| ヤマダホームズ | `yamadahomes.jp` | `ヤマダホームズ` |
| スウェーデンハウス | `swedenhouse.co.jp` | `スウェーデンハウス` |
| 三井ホーム | `mitsuihome.co.jp` | `三井ホーム` |
| 桧家住宅 | `hinokiya.jp` | `桧家住宅`, `ヒノキヤ` |

### 方針
- **コンサバ判定**: 「明確に大手だと言えるもののみ」を除外する。誤って小規模工務店を除外するより、見逃しを許容する。
- 店名一致は **部分一致(includes)** で行う。「一条工務店 所沢展示場」のような後置きにも対応。
- 展示場・モデルハウスのキーワード単独ではフラグしない。`(株)未来住宅 〇〇展示場` のような地元工務店のショールームを誤検知するリスクがあるため。

### 誤判定したとき(運用フィードバック)
- **取りこぼし(本当はチェーンなのに false)** → `CHAIN_RULES` に追加。
- **誤検知(本当は別の店なのに true)** → 店名パターンが甘い可能性。例えば「一条」だけだと「一条木工所」がヒットしてしまうが、現状は **`一条工務店` 全体一致** にしてあるので大丈夫。

### ルール変更箇所
`src/discovery/classify/chainStore.ts` の `CHAIN_RULES`。

---

## 3. LegalForm — 法人格の自動判定

### なぜ判定するか
- **宛名表記の自動生成**: 法人なら「〇〇 御中」、個人事業主なら「〇〇 様」と書き分けたい。
- **法人/個人の見分け**: 個人事業主は意思決定が速い、契約形態が異なる、価格感も違う、と営業設計が変わる。

### 検出パターン

店名に **以下の文字列が含まれるか** を先勝ちで判定。

| 法人格 | パターン |
|---|---|
| 株式会社 | `株式会社`, `(株)`, `(株)`, `㈱`, `(株`, `(株` |
| 有限会社 | `有限会社`, `(有)`, `(有)`, `㈲`, `(有`, `(有` |
| 合同会社 | `合同会社`, `(同)`, `(同)`, `㈿` |
| 合資会社 | `合資会社`, `(資)`, `(資)` |
| 合名会社 | `合名会社`, `(名)`, `(名)` |
| 一般社団法人 | `一般社団法人`, `社団法人` |
| 一般財団法人 | `一般財団法人`, `財団法人` |
| NPO法人 | `NPO法人`, `ＮＰＯ法人`, `特定非営利活動法人` |
| 医療法人 | `医療法人` |
| 不明 | (どれにもヒットしなかった場合) |

`不明` は「個人事業主の可能性が高い」が、**法人でも店名に法人格を表示していないケースがある** ため断定はしない。

### 宛名末尾の生成ルール
`honorificForForm(form)`:
- `不明` → `様`
- それ以外(法人格判定済) → `御中`

例:
- 「㈲内田工務店住宅リフォーム」 → 有限会社 → `㈲内田工務店住宅リフォーム 御中`
- 「当麻工務店」 → 不明 → `当麻工務店 様`

### 誤判定したとき
店名に法人格を含めない法人は `不明` 判定される。これはGoogleマップの登録名に依存する問題なので、判定ロジック側ではフォローしきれない(法人番号APIとの突合で解決可能、将来課題)。

### ルール変更箇所
`src/discovery/classify/legalForm.ts` の `RULES` 配列。

---

## 4. OutreachPriority — 営業優先度スコア

### なぜ判定するか
営業対象は「★3.5-4.2 + レビュー20件以上 + HP無し」が最も売れる(=客がついている裏付け × 改善余地大の組み合わせ)。これを **数値スコア** に落とし込んで、Notion でソート・フィルタできるようにする。

### スコア計算ルール

| ルール | 加減点 | 補足 |
|---|---|---|
| 大手チェーン除外 | **-1000** | `IsChainStore=true` で即除外確定 |
| レビュー数 >= 20 | **+30** | 顧客がついている裏付け |
| レビュー数 10-19 | +15 | 中程度の実績 |
| rating 3.5-4.2 | **+20** | 「顧客を失っている可能性」シグナル |
| rating >= 4.5 | +15 | 品質高、HP次第で伸びる |
| WebsiteClass=none(HP無し) | **+20** | コア訴求対象(※GBP非紐付けの可能性込みで控えめ) |
| WebsiteClass=sns_only | +20 | 簡易LP/SNSのみ |

`has_website` は新規 upsert しないため、優先度計算には現れない(万が一渡されても加点なし)。

### ラベル変換(閾値)

| 範囲 | ラベル | 営業判断 |
|---|---|---|
| `score < 0` | **除外** | 大手チェーン等、営業対象外 |
| `score >= 50` | **高** | 最優先で当てる(着手から) |
| `30 <= score < 50` | **中** | 次のロット |
| `score < 30` | **低** | 余力があれば |

### 出力例

| 入力 | スコア計算 | ラベル |
|---|---|---|
| 評価★3.8、レビュー40件、HP無し | 30(reviews) + 20(rating) + 20(none) = **70** | **高** |
| 評価★4.6、レビュー12件、SNSのみ | 15 + 15 + 20(sns_only) = **50** | **高** |
| 評価★4.0、レビュー5件、HP無し | 20(none) = **20** | **低** |
| 大手チェーン | -1000 | **除外** |

### 追跡可能性

`OutreachReasons` に「どのルールが加点に貢献したか」が文字列で残るので、優先度の根拠は常に Notion で確認できる。

### ルール変更箇所
`src/discovery/classify/priority.ts` の `PRIORITY_RULES` と `PRIORITY_THRESHOLDS`。

---

## 営業対象の絞り込み(Notion ビュー側の運用)

判定フラグが出揃った後、Notion DB を以下のフィルタで使い分ける。

### 推奨ソート順

すべてのビューで **`OutreachScore` 降順** を第一ソートにする。優先度高から着手できる。

### チャネル別フィルタ

| 営業チャネル | フィルタ条件 |
|---|---|
| **B: 電話** | `OutreachPriority ∈ {高, 中}` AND `WebsiteClass ∈ {none, sns_only}` AND `Phone` あり |
| **A: 郵送DM** | `OutreachPriority ∈ {高, 中}` AND `WebsiteClass ∈ {none, sns_only}` AND `Address` あり |
| **要レビュー** | `OutreachPriority = 除外`(自動除外候補。一応目視で確認) |
| **見送り(参考)** | `Status = 見送り` AND `WebsiteClass = has_website`(過去に none/sns_only から遷移したもの) |

---

## ⚠️ データ不確実性について(重要)

スコアの元になっている情報は **Google Places API のメタデータ**(= Google ビジネスプロフィールに登録された値)に依存している。これは「店舗オーナーが登録した値」であり、必ずしも実態を反映していない。実運用で観測された主な乖離パターン:

### A. `WebsiteClass=none` でも実際は HP がある

GBPに登録していないだけ。Web検索すると別ドメインで普通に運営しているケースがある。

例: `株式会社堀江工務店`(WebsiteClass=none)→ 実際は `https://www.kensetumap.com/company/130829/` 経由で存在(ただしこれはポータルなので独自HPかは別問題)。

→ 対策案(将来): Phase 1.6 として「店名 + エリア」で Web検索して実HPを探すステップを追加。今は **OutreachPriority=高 のうち`none` クラスは目視確認することを推奨**。

### B. Places API のスコア重みは控えめに

不確実性を加味するため、当初設計より重みを下げてある:
- `WebsiteClass=none` : 30 → **20**

### 運用上の推奨フロー

1. `pnpm indexer discover` で大量取得
2. Notion ビューを `OutreachScore` 降順 + `OutreachPriority != 除外` でフィルタ
3. **上位の `WebsiteClass=none` だけは目視確認**(実HPがある可能性)
4. その上で電話 / DM ルートに着手

---

## ルール追加・変更の手順

1. 該当する `src/discovery/classify/*.ts` または `src/discovery/filter/*.ts` を編集
2. テスト(`*.test.ts`)に新ルールのケースを足す
3. `pnpm test` でgreen確認
4. **このドキュメント(`docs/classification-rules.md`)を更新**
5. 既存のNotion DBへの反映は次回の `pnpm indexer discover` 実行時に自動的に上書きされる(同じ `place_id` の `IsChainStore` 等が再計算される)
