import { describe, expect, it } from 'vitest';
import { scorePriority } from './priority.ts';

describe('scorePriority', () => {
  it('excludes chain stores regardless of other signals', () => {
    const r = scorePriority({
      websiteClass: 'none',
      isChainStore: true,
      rating: 4.0,
      reviewCount: 50,
    });
    expect(r.label).toBe('除外');
    expect(r.score).toBeLessThan(0);
  });

  it('returns 高 for the ideal target: 評価3.8 + reviews 40 + HP無し', () => {
    const r = scorePriority({
      websiteClass: 'none',
      isChainStore: false,
      rating: 3.8,
      reviewCount: 40,
    });
    // reviews 30 + rating 20 + websiteClass(none) 20 = 70
    expect(r.label).toBe('高');
    expect(r.score).toBe(70);
  });

  it('returns 高 for sns_only + good rating + medium reviews', () => {
    const r = scorePriority({
      websiteClass: 'sns_only',
      isChainStore: false,
      rating: 4.6,
      reviewCount: 12,
    });
    // reviews(10-19) 15 + rating(>=4.5) 15 + sns_only 20 = 50
    expect(r.label).toBe('高');
    expect(r.score).toBe(50);
  });

  it('handles undefined rating/reviews gracefully', () => {
    const r = scorePriority({
      websiteClass: 'none',
      isChainStore: false,
      rating: undefined,
      reviewCount: undefined,
    });
    // websiteClass(none) 20 = 20
    expect(r.label).toBe('低');
    expect(r.score).toBe(20);
  });

  it('reasons list reflects matched rules', () => {
    const r = scorePriority({
      websiteClass: 'none',
      isChainStore: false,
      rating: 4.0,
      reviewCount: 30,
    });
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.reasons.some((s) => s.includes('レビュー数 >= 20'))).toBe(true);
    expect(r.reasons.some((s) => s.includes('rating 3.5-4.2'))).toBe(true);
    expect(r.reasons.some((s) => s.includes('WebsiteClass=none'))).toBe(true);
  });

  it('does not add bonus for has_website (D ルート廃止後の挙動)', () => {
    // has_website が万が一渡された場合でも、none/sns_only 用のボーナスは付かない。
    // 通常のフローでは discover で has_website は弾かれるため、ここに到達しない設計。
    const r = scorePriority({
      websiteClass: 'has_website',
      isChainStore: false,
      rating: 4.0,
      reviewCount: 30,
    });
    // reviews 30 + rating 20 = 50 (has_website 自体には加点なし)
    expect(r.score).toBe(50);
    expect(r.reasons.some((s) => s.includes('WebsiteClass=none'))).toBe(false);
    expect(r.reasons.some((s) => s.includes('WebsiteClass=sns_only'))).toBe(false);
  });
});
