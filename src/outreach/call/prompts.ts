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

【こちら(売り手)の状況・装備】
${senderBlock}

【営業のスタンス・装備(必読)】
このスクリプトは **「Show, Don't Tell(=サンプル作ったので見てください)」型** で書くこと。
従来の「ご提案させてください」型ではなく、**既に成果物がある状態で見せに行く** のがコア。

具体的なスタンス・装備:
${sender.pitchContext}

→ つまりこの電話は「アポ取り」ではなく「メールでサンプルURLを送る了承を取る」のがゴール。

【スクリプトの必須構成】
以下の4セクションをこの順番で必ず含めてください。マークダウンの ## 見出しで区切ること。

## 導入(目的明示 / 60秒以内、特商法電話勧誘規制対応)
- 名乗り: 屋号 or 氏名 +「Webサイト制作の」と職種を明示。
- **この電話の核心**: 「実は貴社向けのサンプルサイトを既に作りました」を **冒頭で伝える**。
  これは"営業の提案"ではなく"成果物のお試し提示"のニュアンスで。
- 「今1分だけお時間よろしいですか?」で時間取得の許可。

## 価値訴求(既に作ったサンプルの説明 + なぜ作ったか)
- なぜこの店を選んでサンプルを作ったか、相手企業の具体的特徴と紐付ける
  (Google評価、レビュー数、業歴感)。
- 既存HP状態に応じた「もったいなさ」を1点だけ伝える:
  - HP無し → 「これだけのレビューがあるのにHPで詳細が伝わっていない」
  - SNSのみ → 「SNSだけでは検索流入(Google検索からの新規)が取れていない」
  - 古いHP → 「スマホでは表示が崩れていて、検索1位でも離脱されている可能性」
- サンプルに何を盛り込んだかを1-2点だけ簡潔に(全部説明しない、見せた方が早い)。

## 反論対応(3パターン)
1. 「もう要らない/間に合っている」→ **「無理に売り込みません。メールでURLを送るので、お時間あるときにご覧いただければ。気に入らなければそれでOKです」**
2. 「お金がかかるんでしょ?」→ **「サンプルを見るだけは無料です。気に入った場合のみ正式版を制作します」**
3. 「忙しい/時間がない」→ **「メールでURLをお送りするだけなので電話のお時間は取らせません。見るのも数分です」**
各反論への切り返しは1-2文。押し売り感ゼロ、引き際を必ず示す。

## クロージング(メールでサンプルURL送付の了承を取る)
- 「サンプルのURLをメールでお送りしてもよろしいですか?」とメールアドレスを聞く。
- 「ご覧いただいて、ご興味あればお返事ください」で締める。
- **「もしご興味なければ、これ以上のご連絡はいたしません」と引き際を明示**
  (特商法上の再勧誘禁止 + 押し売り感の払拭)。
- アポ(対面・Zoom)を取りに行かない(ハードルが高い。メール送付了承で十分)。

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
