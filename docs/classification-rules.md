# 識別ルール一覧

このドキュメントは、Phase 1(調査)で各店舗に付与される **すべての識別フラグ・分類** を定義する。営業判断はこれらのフラグの組み合わせで自動化されるため、**ルールが何をどう判定しているかを把握しておくこと** が重要。

> 📌 **更新の指針**: 営業を回す中で「これは違うだろ」という誤判定が出たら、ここを更新する起点にしてください。各ルールに対応するコードと、誤判定が出たときに変えるべきパラメータを明示しています。

---

## 識別フラグ一覧

| Notion プロパティ | 型 | 意味 | コード |
|---|---|---|---|
| `WebsiteClass` | Select | HPの所有状態を3段階で分類 | `src/discovery/filter/noWebsite.ts` |
| `DecisionReason` | Rich text | `WebsiteClass` を決めた根拠(監査用) | 同上 |
| `IsChainStore` | Checkbox | 大手ハウスメーカー等の **チェーン店舗** か | `src/discovery/classify/chainStore.ts` |
| `ChainName` | Rich text | チェーン名(マッチした場合のみ) | 同上 |
| `UsesHttps` | Checkbox | Webサイトが `https://` で運用されているか | `src/discovery/classify/https.ts` |
| `LegalForm` | Select | 法人格(株/有/合同/NPO/…/不明) | `src/discovery/classify/legalForm.ts` |
| `OutreachPriority` | Select | 営業優先度の3段階ラベル(高/中/低/除外) | `src/discovery/classify/priority.ts` |
| `OutreachScore` | Number | 加点ルールから計算した数値スコア | 同上 |
| `OutreachReasons` | Rich text | スコアに加算されたルール名一覧(監査用) | 同上 |

---

## 1. WebsiteClass — HP所有状態の3段階分類

### 値

| 値 | 意味 | 主な営業チャネル |
|---|---|---|
| `none` | `websiteUri` が未登録 | A(郵送DM)/ B(電話) |
| `sns_only` | `websiteUri` あり、ただしSNSや簡易LPなど **自社HPと言いがたいもののみ** | A / B(条件次第でD) |
| `has_website` | 独自ドメインの自社HPがある | D(メール、Phase 1.5でメアド取得後) |

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
- 上記リスト以外の独自ドメインはすべて `has_website` 扱い。ただし「独自ドメインだが Wix のサブドメイン」など曖昧なケースがあれば、`DEFAULT_SNS_DOMAINS` に追記する。

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

## 3. UsesHttps — Webサイトの HTTPS 対応

### なぜ判定するか
独自ドメインで運用していても `http://` のままの店は **「Webサイトが古い」シグナル**。営業対象として:
- メール提案で「セキュリティ警告が出る現状の改善」を切り口にできる
- HP制作の引き合い動機が明確になる

### 判定方法
`websiteUri` のスキームだけを見る:
- `https://` → `UsesHttps=true`
- `http://` → `UsesHttps=false`
- 空 / 非HTTPスキーム / パース失敗 → 内部的には `undefined`、Notion には `false` で保存(後述)

### 注意点
- **登録URLベースの暫定値**。実際のサイトが `http→https` リダイレクトしているかもしれない。厳密判定はPhase 1.5(コンタクトスクレイパー)で実応答を見れば上書き可能。
- **`UsesHttps=false` が即 "古いHP" を意味するわけではない**。Notion のフィルタは必ず `WebsiteClass=has_website AND UsesHttps=false` の組み合わせで使うこと(`none` や `sns_only` の `UsesHttps=false` はノイズ)。

### ルール変更箇所
`src/discovery/classify/https.ts`。

---

## 4. LegalForm — 法人格の自動判定

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

## 5. OutreachPriority — 営業優先度スコア

### なぜ判定するか
営業対象は「★3.5-4.2 + レビュー20件以上 + HP無し/古い」が最も売れる(=客がついている裏付け × 改善余地大の組み合わせ)。これを **数値スコア** に落とし込んで、Notion でソート・フィルタできるようにする。

### スコア計算ルール

| ルール | 加減点 | 補足 |
|---|---|---|
| 大手チェーン除外 | **-1000** | `IsChainStore=true` で即除外確定 |
| レビュー数 >= 20 | **+30** | 顧客がついている裏付け |
| レビュー数 10-19 | +15 | 中程度の実績 |
| rating 3.5-4.2 | **+20** | 「顧客を失っている可能性」シグナル |
| rating >= 4.5 | +15 | 品質高、HP次第で伸びる |
| WebsiteClass=none(HP無し) | **+30** | コア訴求対象 |
| WebsiteClass=sns_only | +20 | 簡易LP/SNSのみ |
| has_website + UsesHttps=false | +25 | 「HPはあるが古い」訴求 |

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
| 評価★3.8、レビュー40件、HP無し | 30(reviews) + 20(rating) + 30(none) = 80 | **高** |
| 評価★4.0、レビュー25件、HP有り(http) | 30 + 20(?) + 25 = ※ratingが範囲外なら 30 + 25 = 55 | **高** |
| 評価★4.6、レビュー12件、SNSのみ | 15(reviews) + 15(rating) + 20(sns_only) = 50 | **高** |
| 評価★4.5、レビュー2件、HP有り(https) | 15(rating) = 15 | **低** |
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
| **D: メール(最優先)** | `OutreachPriority = 高` AND `WebsiteClass = has_website` AND `Email` あり |
| **D: メール(通常)** | `OutreachPriority ∈ {高, 中}` AND `WebsiteClass = has_website` AND `Email` あり |
| **B: 電話** | `OutreachPriority ∈ {高, 中}` AND `WebsiteClass ∈ {none, sns_only}` AND `Phone` あり |
| **A: 郵送DM** | `OutreachPriority ∈ {高, 中}` AND `WebsiteClass ∈ {none, sns_only}` AND `Address` あり |
| **要レビュー** | `OutreachPriority = 除外`(自動除外候補。一応目視で確認) |

---

## 内部用 識別ロジック(コードには出るが Notion に保存されないもの)

### メアド除外パターン(Phase 1.5)
Phase 1.5 のコンタクトスクレイパーで、HPから抽出したメアドのうち **営業先として不適切なもの** を弾く。

採用しないパターン:

- **採用系**: `recruit`, `recruits`, `recruiting`, `career`, `careers`, `job`, `jobs`, `hr`, `jinji`
- **システム/技術系**: `no-reply`, `noreply`, `donotreply`, `do-not-reply`, `postmaster`, `webmaster`, `admin`, `root`, `mailer-daemon`, `bounce`
- **サポート専用**: `support`, `help`, `helpdesk`, `customer-support`, `customersupport`
- **その他**: `abuse`, `privacy`, `legal`, `security`, `press`, `media`

優先採用するパターン(営業向け代表アドレスらしさ):
- `info`, `contact`, `hello`, `sales`, `inquiry`, `mail`, `office`

詳細は `src/discovery/contact-extractor/emailFilter.ts` 参照。

---

## ルール追加・変更の手順

1. 該当する `src/discovery/classify/*.ts` または `src/discovery/filter/*.ts` を編集
2. テスト(`*.test.ts`)に新ルールのケースを足す
3. `pnpm test` でgreen確認
4. **このドキュメント(`docs/classification-rules.md`)を更新**
5. 既存のNotion DBへの反映は次回の `pnpm indexer discover` 実行時に自動的に上書きされる(同じ `place_id` の `IsChainStore` 等が再計算される)
