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
    '築年数や外壁の状態に合わせて、塗り替え時期や補修の必要性を確認するための相談窓口としてご利用ください。',
  services: [
    {
      title: '外壁塗装',
      description:
        'サイディング / モルタル / ALC など、外壁素材や劣化状況に合わせた塗り替え相談。',
    },
    {
      title: '屋根塗装',
      description:
        '屋根材の状態確認、色あせ、コケ、雨まわりなどを踏まえたメンテナンス相談。',
    },
    {
      title: 'コーキング工事',
      description:
        '外壁目地やサッシまわりの割れ・すき間など、雨水の侵入につながる箇所の確認。',
    },
    {
      title: '付帯部塗装(雨樋・破風)',
      description:
        '雨樋、破風、軒天など、外壁と一緒に状態を見ておきたい付帯部の相談。',
    },
  ],
  whyPoints: [
    {
      title: '色褪せ・チョーキングが気になり始めた',
      description:
        '外壁を触ると白い粉がつく状態は、塗膜劣化のサインとされます。現地で状態を確認してもらう目安になります。',
    },
    {
      title: '築10〜15年で初めての塗り替え',
      description:
        '初回の塗装相談では、外壁素材や下地状況、過去の補修履歴を確認することが大切です。',
    },
    {
      title: '相見積もりで判断したい',
      description:
        '複数社を比較するときは、塗料グレード、工法、見積もり範囲の違いを整理して確認できます。',
    },
  ],
  flow: [
    {
      step: '1. お問い合わせ',
      description: '掲載されている電話番号や Google マップ情報から、相談先を確認します。',
    },
    { step: '2. 現地調査', description: '建物の状態を確認し、必要な工程をご説明します。' },
    {
      step: '3. お見積もり',
      description: '塗料グレード別の見積もりを書面でお渡し。即決は不要です。',
    },
    { step: '4. ご契約・着工', description: '内容に納得できた場合、日程や工事範囲を確認します。' },
    { step: '5. 完工確認', description: '仕上がりや説明内容を確認し、今後のメンテナンス時期を相談します。' },
  ],
  closingNote:
    '外壁の色あせ、ひび割れ、雨まわりが気になったら、まずは掲載情報から相談先をご確認ください。',
};
