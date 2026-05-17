import { describe, expect, it } from 'vitest';
import { classifyWebsite } from './noWebsite.ts';

describe('classifyWebsite', () => {
  it('returns none for empty/undefined', () => {
    expect(classifyWebsite(undefined).class).toBe('none');
    expect(classifyWebsite('').class).toBe('none');
    expect(classifyWebsite('   ').class).toBe('none');
  });

  it('returns sns_only for SNS / portal domains', () => {
    expect(classifyWebsite('https://www.facebook.com/foo').class).toBe('sns_only');
    expect(classifyWebsite('https://instagram.com/bar').class).toBe('sns_only');
    expect(classifyWebsite('https://tabelog.com/tokyo/A1311/1311010/').class).toBe('sns_only');
    expect(classifyWebsite('https://peraichi.com/landing_pages/view/abc').class).toBe('sns_only');
    expect(classifyWebsite('https://shop.base.ec/items').class).toBe('sns_only');
  });

  it('returns has_website for independent domain', () => {
    const r = classifyWebsite('https://example.co.jp/');
    expect(r.class).toBe('has_website');
    expect(r.reason).toContain('example.co.jp');
  });

  it('returns none for malformed URL', () => {
    expect(classifyWebsite('not a url').class).toBe('none');
  });

  it('matches subdomain of SNS domain', () => {
    expect(classifyWebsite('https://m.facebook.com/page').class).toBe('sns_only');
  });

  it('does not match unrelated domain ending', () => {
    // notfacebook.com should NOT match facebook.com
    expect(classifyWebsite('https://notfacebook.com/').class).toBe('has_website');
  });
});
