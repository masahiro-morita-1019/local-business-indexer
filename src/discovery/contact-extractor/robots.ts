/**
 * 最小限の robots.txt パーサ。
 * - User-agent: * のグループに含まれる Disallow / Allow を集める
 * - URLパスに対し最長一致した方を採用(Allow が長ければ許可、Disallow が長ければ拒否)
 * - User-agent: 個別指定にはこのMVPでは対応しない(常に "*" 扱い)
 */

interface RobotsRules {
  allow: string[];
  disallow: string[];
}

export interface RobotsCheck {
  isAllowed(path: string): boolean;
}

const ALLOW_ALL: RobotsCheck = { isAllowed: () => true };

export async function fetchRobots(
  origin: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RobotsCheck> {
  const url = `${origin}/robots.txt`;
  let body: string;
  try {
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': DEFAULT_UA },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return ALLOW_ALL;
    body = await res.text();
  } catch {
    return ALLOW_ALL;
  }

  return parseRobots(body);
}

export function parseRobots(body: string): RobotsCheck {
  const lines = body.split(/\r?\n/);
  let inStarGroup = false;
  const rules: RobotsRules = { allow: [], disallow: [] };

  for (const rawLine of lines) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (line === '') continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (key === 'user-agent') {
      inStarGroup = value === '*';
      continue;
    }
    if (!inStarGroup) continue;

    if (key === 'disallow' && value !== '') rules.disallow.push(value);
    else if (key === 'allow' && value !== '') rules.allow.push(value);
  }

  return {
    isAllowed(path: string): boolean {
      const longestAllow = longestMatch(path, rules.allow);
      const longestDisallow = longestMatch(path, rules.disallow);
      if (longestDisallow === 0) return true;
      return longestAllow >= longestDisallow;
    },
  };
}

function longestMatch(path: string, patterns: readonly string[]): number {
  let best = 0;
  for (const p of patterns) {
    if (path.startsWith(p) && p.length > best) best = p.length;
  }
  return best;
}

export const DEFAULT_UA = 'LocalBusinessIndexer/0.1 (+contact-extraction)';
