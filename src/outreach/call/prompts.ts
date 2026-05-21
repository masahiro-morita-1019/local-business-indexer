import type { SenderIdentity } from '../../config.ts';
import { type LegalForm, honorificForForm } from '../../discovery/classify/legalForm.ts';
import type { WebsiteClass } from '../../discovery/filter/noWebsite.ts';

/**
 * 電話スクリプト生成への入力。Phase 1〜1.5 までの Notion データを集約。
 */
export interface CallScriptInput {
  name: string;
  category: string;
  area: string;
  rating: number | undefined;
  reviewCount: number | undefined;
  websiteClass: WebsiteClass;
  legalForm: LegalForm;
  /** OutreachReasons の文字列(スコアに加算されたルール一覧) */
  outreachReasons: string;
  /** 「古いHP」「HP無し」など、生成プロンプトに渡すための短い特徴説明(自動生成) */
}

/**
 * システムプロンプトを構築する。
 * - 差出人(屋号/個人名)情報を差し込む
 * - 構成(4セクション)、文体ルール、字数目安を明示
 * - 特商法の電話勧誘規制への配慮(目的明示・断られたら継続しない)を組み込む
 *
 * このプロンプトは全コール共通なので、`cache_control` 対象として system ブロックに渡す。
 * ただし Opus 4.7 の最小キャッシュ対象は約 4096 tokens なので、現状のプロンプト長
 * (~1000-1500 tokens 想定)では実際にはキャッシュ activate しない可能性が高い。
 * 将来 few-shot 例を追加してプロンプトが長くなった際に自動で効くよう、構造としては
 * 残しておく(害なし)。
 */
export function buildSystemPrompt(sender: SenderIdentity): string {
  const senderBlock = [
    `- 屋号/氏名: ${sender.name || '(未設定)'}`,
    sender.title ? `- 肩書き: ${sender.title}` : null,
    sender.email ? `- メール: ${sender.email}` : null,
    sender.phone ? `- 電話: ${sender.phone}` : null,
    sender.portfolioUrl ? `- ポートフォリオ: ${sender.portfolioUrl}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  return `あなたはBtoB営業のプロです。地方の中小事業者(工務店・リフォーム・外壁塗装等)に対し、
ホームページ制作サービスを電話で提案するためのトークスクリプトを作成します。

【差出人(あなたの所属)】
${senderBlock}

【スクリプトの必須構成】
以下の4セクションをこの順番で必ず含めてください。マークダウンの ## 見出しで区切ること。

## 導入(目的明示 / 60秒以内)
- 名前と所属(または屋号)を冒頭で明確に。
- 「お忙しいところ恐れ入ります。Webサイト制作のご提案のお電話です。」のように、
  **目的が営業であることを最初に伝える**(特定商取引法の電話勧誘規制への配慮)。
- 「今1分だけお時間よろしいですか?」で時間取得の許可を得る。

## 価値訴求(相手の状況に紐づける)
- 相手企業の Google マップでの評価/レビュー数/業種特徴に触れる(リサーチしてきた感を出す)。
- HP状態に応じて切り口を変える:
  - HP無し → 「同業他社のHPと比較されたとき、判断材料が無い状況」を機会損失として伝える
  - SNSのみ → 「SNSだけでは検索流入が取れない / 信頼性が伝わりにくい」
  - 古いHP(http://, デザインが古い) → 「スマホ非対応 / セキュリティ警告 / 同業比較で見劣り」
- HP制作で得られる具体的メリット(問い合わせ増、信頼性UP、見積依頼の事前情報)を1-2点に絞る。

## 反論対応(3パターン)
よくある反論3つに対する短い切り返しを箇条書きで:
1. 「今のままで困っていない」
2. 「コストが高そう / 予算がない」
3. 「忙しくて時間がない / 後回しでいい」
各反論への切り返しは1-2文で。長くしすぎない。

## クロージング
- いきなり契約ではなく、**「貴社用にサンプルサイトを作ったので、まず見ていただきたい」**
  の二段構え提案を推奨。
- メールで詳細資料 + プレビューURL を送る了承を取る、または後日折り返しの時間を取る。
- 「もしご興味なければ、これ以上のご連絡はいたしません」と引き際を提示
  (特商法上の再勧誘禁止 + 押し売り感の払拭)。

【文体ルール】
- 敬語、丁寧、押し売り感ゼロ。地方の年配経営者でも違和感ない言葉遣い。
- 専門用語を避け、平易に。ITに不慣れな相手を想定。
- マークダウン形式で出力(## 見出し + 本文)。
- 全体600-1200字を目安に。詰め込みすぎない。
- スクリプト本文以外の前置き・後置き(「以下が…です」など)は書かない。`;
}

/** Notion の WebsiteClass を、プロンプトに渡しやすい日本語の状況説明に変換 */
function describeWebsiteClass(wc: WebsiteClass): string {
  switch (wc) {
    case 'none':
      return 'ホームページなし(Googleビジネスプロフィールにも未登録)';
    case 'sns_only':
      return 'SNS / 簡易LP のみ(独自ドメインの自社サイトなし)';
    case 'has_website':
      return 'HPあり(古い可能性あり、Phase 1.5 で実応答確認済)';
  }
}

/**
 * 1企業分のユーザープロンプトを構築する。
 */
export function buildUserPrompt(input: CallScriptInput): string {
  const honorific = honorificForForm(input.legalForm);
  const ratingLine =
    input.rating !== undefined && input.reviewCount !== undefined
      ? `${input.rating} / 5.0(レビュー${input.reviewCount}件)`
      : '評価情報なし';

  return `以下の企業向けに、電話営業スクリプトを作成してください。

## 企業情報
- 店名(宛名): ${input.name} ${honorific}
- 業種: ${input.category}
- エリア: ${input.area}
- Google評価: ${ratingLine}
- HP状態: ${describeWebsiteClass(input.websiteClass)}
- 法人格(検出値): ${input.legalForm}
- 営業優先度の根拠: ${input.outreachReasons || '(なし)'}

## 注意
- 上記の評価・レビュー数を実際に「リサーチで把握した」体で具体的に触れること(架空の数字を捏造しない)。
- ${honorific === '御中' ? '法人としての宛名(担当者不明前提)で進める' : '個人事業主前提の柔らかい言い回しで進める'}。`;
}
