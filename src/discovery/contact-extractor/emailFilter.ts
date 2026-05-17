/**
 * 営業に使うべきでないメアド(採用/サポート専用/システム系)を弾く。
 * 戻り値で除外理由も返す。
 */
const EXCLUDED_LOCAL_PARTS = [
  // 採用系
  'recruit',
  'recruits',
  'recruiting',
  'career',
  'careers',
  'job',
  'jobs',
  'hr',
  'jinji',
  // システム/技術系
  'no-reply',
  'noreply',
  'donotreply',
  'do-not-reply',
  'postmaster',
  'webmaster',
  'admin',
  'root',
  'mailer-daemon',
  'bounce',
  // サポート専用(営業先には不適切)
  'support',
  'help',
  'helpdesk',
  'customer-support',
  'customersupport',
  // その他
  'abuse',
  'privacy',
  'legal',
  'security',
  'press',
  'media',
];

/**
 * 営業向けに好まれるメアドの局所部(local-part)プレフィックス。
 * これに前方一致するアドレスは優先度を上げる。
 */
const PREFERRED_LOCAL_PARTS = ['info', 'contact', 'hello', 'sales', 'inquiry', 'mail', 'office'];

export type EmailRejection =
  | { reason: 'invalid_format' }
  | { reason: 'excluded_local_part'; matched: string }
  | { reason: 'role_excluded'; matched: string };

export interface EmailEvaluation {
  email: string;
  ok: boolean;
  priority: number; // 0=preferred, 1=neutral, 2=person-name-likely, -1=rejected
  rejection?: EmailRejection;
}

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function evaluateEmail(raw: string): EmailEvaluation {
  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { email, ok: false, priority: -1, rejection: { reason: 'invalid_format' } };
  }

  const atIdx = email.indexOf('@');
  const local = email.slice(0, atIdx);

  for (const ex of EXCLUDED_LOCAL_PARTS) {
    if (
      local === ex ||
      local.startsWith(`${ex}@`) ||
      local.startsWith(`${ex}-`) ||
      local.startsWith(`${ex}_`) ||
      local.startsWith(`${ex}.`)
    ) {
      return {
        email,
        ok: false,
        priority: -1,
        rejection: { reason: 'excluded_local_part', matched: ex },
      };
    }
  }

  for (const pref of PREFERRED_LOCAL_PARTS) {
    if (
      local === pref ||
      local.startsWith(`${pref}-`) ||
      local.startsWith(`${pref}_`) ||
      local.startsWith(`${pref}.`)
    ) {
      return { email, ok: true, priority: 0 };
    }
  }

  // 数字のみや極端に短いものは person-name 系として扱う(優先度低め)
  return { email, ok: true, priority: 1 };
}

/**
 * 候補メアド群から営業向けに最適な1件を選ぶ。
 * - 除外パターンに該当するものは捨てる
 * - 残った中で priority が小さいものを優先
 * - 同 priority なら局所部が短いもの(汎用代表アドレスらしさ)を優先
 */
export interface SelectionResult {
  primary: string | undefined;
  accepted: EmailEvaluation[];
  rejected: EmailEvaluation[];
}

export function selectPrimaryEmail(rawEmails: readonly string[]): SelectionResult {
  const seen = new Set<string>();
  const evaluations: EmailEvaluation[] = [];

  for (const raw of rawEmails) {
    const ev = evaluateEmail(raw);
    if (seen.has(ev.email)) continue;
    seen.add(ev.email);
    evaluations.push(ev);
  }

  const accepted = evaluations.filter((e) => e.ok);
  const rejected = evaluations.filter((e) => !e.ok);

  accepted.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const aLocal = a.email.slice(0, a.email.indexOf('@'));
    const bLocal = b.email.slice(0, b.email.indexOf('@'));
    return aLocal.length - bLocal.length;
  });

  return {
    primary: accepted[0]?.email,
    accepted,
    rejected,
  };
}
