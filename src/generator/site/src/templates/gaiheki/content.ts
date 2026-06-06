/**
 * 外壁塗装テンプレで使う「装飾コピー」(=店ごとの事実ではない汎用文言)を定義する。
 *
 * 透明性原則 (CLAUDE.md): 創作した実績数 / 保証年数 / 受賞歴を default にハードコードしない。
 * 営業先に渡すサンプルHPでは「電話/住所/Googleレビュー」など事実のみを差し込み、
 * 装飾コピーは「店主と一緒に詰める前段のたたき台」として扱う。
 */
interface SectionCopy {
  kicker: string;
  title: string;
  lede: string;
}

interface LocalSectionCopy {
  kicker: string;
  title: string;
  body: string;
}

export interface GaihekiCopy {
  sampleLabel: string;
  catchphrase: string;
  subCatchphrase: string;
  hero: {
    eyebrow: string;
    note: string;
    mediaSrc: string;
    mediaAlt: string;
    mediaCaption: string[];
  };
  sections: {
    why: SectionCopy;
    services: SectionCopy;
    cases: SectionCopy;
    trust: SectionCopy;
    estimate: SectionCopy;
    local: LocalSectionCopy;
    faq: SectionCopy;
    flow: SectionCopy;
  };
  services: { title: string; description: string }[];
  /** Why訴求(汎用) — 店ごとの実績ではなく「外壁塗装で気にする観点」を列挙 */
  whyPoints: { title: string; description: string }[];
  /** 施工実績・写真の差し替え枠。実績そのものとしては扱わない */
  casePlaceholders: { visualLabel: string; title: string; description: string }[];
  /** HP上で整理できる安心材料。店ごとの強み断定ではなく掲載観点 */
  trustMaterials: { title: string; description: string }[];
  /** 見積もり前に伝える一般的な確認観点 */
  estimateNotes: { title: string; description: string }[];
  /** よくある質問(業界共通の一般論) */
  faqItems: { question: string; answer: string }[];
  /** 標準的な施工フロー(業界共通) */
  flow: { step: string; description: string }[];
  mobileCta: { callLabel: string; mapLabel: string };
  /** クロージング前のひと言 */
  closingNote: string;
}

export const defaultGaihekiCopy: GaihekiCopy = {
  sampleLabel: '外壁塗装サンプルHP',
  catchphrase: '住まいの外壁を、長く美しく。',
  subCatchphrase:
    '築年数や外壁の状態に合わせて、塗り替え時期や補修の必要性を確認するための相談窓口としてご利用ください。',
  hero: {
    eyebrow: '{area}の外壁塗装・住まいのメンテナンス相談',
    note: '住所・電話番号・Google評価などの事実情報をもとにした、確認用のサンプルページです。',
    mediaSrc: '/assets/gaiheki-hero-home-maintenance.png',
    mediaAlt: '手入れされた住宅外観のイメージ',
    mediaCaption: ['外壁・屋根の状態確認', '色あせ・ひび割れ・雨まわりの相談'],
  },
  sections: {
    why: {
      kicker: 'Check points',
      title: 'よくあるお悩み・現地で確認したいこと',
      lede:
        '外壁塗装を検討し始めるきっかけになりやすい症状を整理しています。気になる点があれば、現地で状態を確認してもらう目安になります。',
    },
    services: {
      kicker: 'Services',
      title: '相談できる工事内容',
      lede:
        '外壁まわりは、塗装だけでなく屋根・目地・雨樋などをまとめて確認すると、必要な工事範囲を整理しやすくなります。',
    },
    cases: {
      kicker: 'Portfolio',
      title: '施工写真・お客様の声を掲載できる枠',
      lede:
        '実績写真や口コミ本文は自動生成せず、ヒアリング後に差し替える前提の掲載枠として用意しています。完成後のHPでどのように見せられるかを確認できます。',
    },
    trust: {
      kicker: 'Trust',
      title: 'HPで伝えられる安心材料',
      lede:
        '未確認の強みを断定する代わりに、問い合わせ前に見込み客が確認したい情報を整理して掲載します。',
    },
    estimate: {
      kicker: 'Estimate',
      title: '見積もり前に確認したいこと',
      lede: '価格を断定せず、現地確認で見ておきたいポイントを先に伝えることで、相談前の不安を減らします。',
    },
    local: {
      kicker: 'Local',
      title: '{area}で外壁まわりを相談したい方へ',
      body:
        '住所、電話番号、営業時間、Google マップ情報など、確認できる事実情報を中心にまとめています。施工実績や保証内容など、事業者ごとに確認が必要な情報はこのサンプルでは断定していません。',
    },
    faq: {
      kicker: 'FAQ',
      title: 'よくある質問',
      lede: '外壁塗装を検討する方が問い合わせ前に確認しやすいよう、一般的な質問を整理しています。',
    },
    flow: {
      kicker: 'Flow',
      title: 'ご依頼の流れ',
      lede: '',
    },
  },
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
    {
      title: '防水・雨まわり確認',
      description:
        'ベランダ、バルコニー、サッシまわりなど、雨水が入りやすい箇所の点検相談。',
    },
    {
      title: '外壁点検',
      description:
        '塗り替えが必要か、補修で足りるかを判断するための状態確認の相談。',
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
    {
      title: '雨漏りやひび割れが心配',
      description:
        '室内に症状が出る前でも、外壁や屋根まわりのひび割れ・すき間は確認しておきたいポイントです。',
    },
  ],
  casePlaceholders: [
    {
      visualLabel: 'Before',
      title: 'Before / After 掲載枠',
      description:
        '施工前後の写真を掲載すると、仕上がりの変化や色選びの参考として見込み客に伝わりやすくなります。',
    },
    {
      visualLabel: 'Photo',
      title: '施工写真ギャラリー',
      description:
        '外壁、屋根、付帯部などの写真を整理して掲載できます。ここでは実績写真の代わりに掲載枠のみを用意しています。',
    },
    {
      visualLabel: 'Voice',
      title: 'お客様の声 掲載枠',
      description:
        'ヒアリング後に掲載許可を得た声や、公式に使えるレビューを掲載できます。本文の自動生成や引用は行いません。',
    },
  ],
  trustMaterials: [
    {
      title: '所在地・営業時間を見やすく整理',
      description:
        'Google マップ由来の住所、営業時間、地図を1か所にまとめ、問い合わせ前の確認をしやすくします。',
    },
    {
      title: '電話しやすい導線',
      description:
        'スマホでも押しやすい電話ボタンを複数箇所に配置し、相談したいタイミングを逃しにくくします。',
    },
    {
      title: '地域名と相談内容を明確化',
      description:
        '対応エリアや相談内容が伝わる構成にすることで、近隣で探している人に伝わりやすいページにします。',
    },
  ],
  estimateNotes: [
    {
      title: '建物の状態',
      description:
        '外壁材、ひび割れ、チョーキング、コーキングの劣化などにより必要な作業が変わります。',
    },
    {
      title: '工事範囲',
      description:
        '外壁だけでなく屋根、雨樋、破風、軒天などを同時に確認すると見積もり範囲を整理しやすくなります。',
    },
    {
      title: '塗料・工程',
      description:
        '塗料の種類や下地処理、足場の有無によって費用は変わるため、現地確認後の説明が大切です。',
    },
  ],
  faqItems: [
    {
      question: '外壁塗装の相談は築何年くらいが目安ですか?',
      answer:
        '一般的には築10年前後から状態確認を検討する方が多いですが、立地や外壁材、過去の補修状況で変わります。色あせ、粉ふき、ひび割れが気になったら早めに確認すると安心です。',
    },
    {
      question: '見積もりだけの相談でも大丈夫ですか?',
      answer:
        '相見積もりで比較する場合は、工事範囲、塗料、下地処理、足場、付帯部の扱いを揃えて確認すると判断しやすくなります。',
    },
    {
      question: '金額の目安をサイトに載せられますか?',
      answer:
        '建物の大きさや劣化状況で変わるため、このサンプルでは価格を断定していません。ヒアリング後に、目安や見積もり例として掲載する形が安全です。',
    },
    {
      question: '施工写真や口コミはあとから差し替えられますか?',
      answer:
        'はい。掲載許可のある写真やお客様の声が揃った段階で、Before / After、施工写真、声の掲載枠に差し替える想定です。',
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
  mobileCta: {
    callLabel: '電話する',
    mapLabel: '地図を見る',
  },
  closingNote:
    '外壁の色あせ、ひび割れ、雨まわりが気になったら、まずは掲載情報から相談先をご確認ください。',
};
