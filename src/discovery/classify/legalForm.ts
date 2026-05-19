/**
 * 店名から法人格を推定する。
 * 個人事業主か法人かの見極めと、宛名表記の自動生成(`御中` / `様`)に使う。
 *
 * 検出方法: 店名に含まれる代表的な略記/正式表記を **先勝ち** で判定する。
 * 一致しなかったときは "不明"(個人事業主の可能性が高いが、店名表記を省略してる
 * 法人もあるため "個人" とは断定しない方針)。
 */

export const LEGAL_FORMS = [
  '株式会社',
  '有限会社',
  '合同会社',
  '合資会社',
  '合名会社',
  '一般社団法人',
  '一般財団法人',
  'NPO法人',
  '医療法人',
  '不明',
] as const;

export type LegalForm = (typeof LEGAL_FORMS)[number];

interface FormRule {
  form: LegalForm;
  patterns: readonly string[];
}

const RULES: readonly FormRule[] = [
  {
    form: '株式会社',
    patterns: ['株式会社', '(株)', '(株)', '㈱', '(株', '(株'],
  },
  {
    form: '有限会社',
    patterns: ['有限会社', '(有)', '(有)', '㈲', '(有', '(有'],
  },
  {
    form: '合同会社',
    patterns: ['合同会社', '(同)', '(同)', '㈿'],
  },
  {
    form: '合資会社',
    patterns: ['合資会社', '(資)', '(資)'],
  },
  {
    form: '合名会社',
    patterns: ['合名会社', '(名)', '(名)'],
  },
  {
    form: '一般社団法人',
    patterns: ['一般社団法人', '社団法人'],
  },
  {
    form: '一般財団法人',
    patterns: ['一般財団法人', '財団法人'],
  },
  {
    form: 'NPO法人',
    patterns: ['NPO法人', 'ＮＰＯ法人', '特定非営利活動法人'],
  },
  {
    form: '医療法人',
    patterns: ['医療法人'],
  },
];

export interface LegalFormDetection {
  form: LegalForm;
  /** どのパターンに一致したか(デバッグ/監査用) */
  matchedPattern: string | undefined;
}

export function detectLegalForm(storeName: string): LegalFormDetection {
  for (const rule of RULES) {
    for (const p of rule.patterns) {
      if (storeName.includes(p)) {
        return { form: rule.form, matchedPattern: p };
      }
    }
  }
  return { form: '不明', matchedPattern: undefined };
}

/**
 * 宛名表記の末尾(`御中` / `様`)を返す。
 * - 法人(株式会社等) → 御中
 * - 個人(不明) → 様
 * - その他団体(社団/財団/NPO/医療) → 御中
 */
export function honorificForForm(form: LegalForm): '御中' | '様' {
  return form === '不明' ? '様' : '御中';
}
