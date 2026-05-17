import { describe, expect, it } from 'vitest';
import { parseRobots } from './robots.ts';

describe('parseRobots', () => {
  it('allows everything when robots.txt is empty', () => {
    const r = parseRobots('');
    expect(r.isAllowed('/contact')).toBe(true);
    expect(r.isAllowed('/')).toBe(true);
  });

  it('respects User-agent: * Disallow', () => {
    const r = parseRobots(['User-agent: *', 'Disallow: /admin'].join('\n'));
    expect(r.isAllowed('/admin')).toBe(false);
    expect(r.isAllowed('/admin/users')).toBe(false);
    expect(r.isAllowed('/contact')).toBe(true);
  });

  it('Allow overrides Disallow when longer/equal match', () => {
    const r = parseRobots(
      ['User-agent: *', 'Disallow: /private', 'Allow: /private/public'].join('\n'),
    );
    expect(r.isAllowed('/private/secret')).toBe(false);
    expect(r.isAllowed('/private/public/page')).toBe(true);
  });

  it('ignores non-star user-agent groups', () => {
    const r = parseRobots(['User-agent: Googlebot', 'Disallow: /'].join('\n'));
    expect(r.isAllowed('/anything')).toBe(true);
  });

  it('strips comments', () => {
    const r = parseRobots(['User-agent: * # comment', 'Disallow: /x # comment'].join('\n'));
    expect(r.isAllowed('/x')).toBe(false);
    expect(r.isAllowed('/y')).toBe(true);
  });
});
