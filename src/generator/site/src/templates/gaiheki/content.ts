/**
 * 外壁塗装テンプレで使う「装飾コピー」(=店ごとの事実ではない汎用文言)を定義する。
 *
 * 透明性原則 (CLAUDE.md): 創作した実績数 / 保証年数 / 受賞歴を default にハードコードしない。
 * 営業先に渡すサンプルHPでは「電話/住所/Googleレビュー」など事実のみを差し込み、
 * 装飾コピーは「店主と一緒に詰める前段のたたき台」として扱う。
 */
export interface GaihekiCopy {
  catchphrase: string;
  subCatchphrase: string;
  services: { title: string; description: string }[];
  /** Why訴求(汎用) — 店ごとの実績ではなく「外壁塗装で気にする観点」を列挙 */
  whyPoints: { title: string; description: string }[];
  /** 標準的な施工フロー(業界共通) */
  flow: { step: string; description: string }[];
  /** クロージング前のひと言 */
  closingNote: string;
}

export const defaultGaihekiCopy: GaihekiCopy = {
  catchphrase: '住まいの外壁を、長く美しく。',
  subCatchphrase:
    '築年数の進んだお住まいでも、塗装メンテナンスで「あと10年安心して暮らせる」状態に整えます。',
  services: [
    {
      title: '外壁塗装',
      description:
        'サイディング / モルタル / ALC など、外壁素材に合わせた塗料選定でお住まいを守ります。',
    },
    {
      title: '屋根塗装',
      description:
        '高耐久塗料による塗り替えで、屋根材の寿命延長と遮熱効果による室内環境の改善を両立。',
    },
    {
      title: 'コーキング工事',
      description:
        'シーリング材の劣化は雨漏りの第一歩。外壁塗装とセットでの補修・打ち替えに対応します。',
    },
    {
      title: '付帯部塗装(雨樋・破風)',
      description:
        '外壁と同時にメンテナンスすることで、足場代を抑えつつ家全体を整えます。',
    },
  ],
  whyPoints: [
    {
      title: '色褪せ・チョーキングが気になり始めた',
      description:
        '外壁を触ると白い粉がつく状態は、塗膜が機能を失い始めたサイン。早めの対応で下地ダメージを防げます。',
    },
    {
      title: '築10〜15年で初めての塗り替え',
      description:
        '初回の塗装は使われた素材や下地状況の確認が大切。現地調査で適切な工法と塗料をご提案します。',
    },
    {
      title: '相見積もりで判断したい',
      description:
        '複数社から見積もりを取られている方も歓迎です。塗料グレード/工法/保証の違いを丁寧に説明します。',
    },
  ],
  flow: [
    {
      step: '1. お問い合わせ',
      description: 'お電話または Google マップの「経路を調べる」ボタンからお越しください。',
    },
    { step: '2. 現地調査', description: '建物の状態を確認し、必要な工程をご説明します。' },
    {
      step: '3. お見積もり',
      description: '塗料グレード別の見積もりを書面でお渡し。即決は不要です。',
    },
    { step: '4. ご契約・着工', description: '日程をすり合わせて施工開始。近隣挨拶も行います。' },
    { step: '5. 完工・アフター', description: '完工確認の上、保証内容を含めてお渡しします。' },
  ],
  closingNote:
    'まずはお気軽にお電話ください。「相談だけ」「外壁の状態を見てもらうだけ」も歓迎します。',
};
