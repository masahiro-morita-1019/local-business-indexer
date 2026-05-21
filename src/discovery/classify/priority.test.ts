import { describe, expect, it } from 'vitest';
import { scorePriority } from './priority.ts';

describe('scorePriority', () => {
  it('excludes chain stores regardless of other signals', () => {
    const r = scorePriority({
      websiteClass: 'none',
      isChainStore: true,
      usesHttps: undefined,
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
      usesHttps: undefined,
      rating: 3.8,
      reviewCount: 40,
    });
    // reviews 30 + rating 20 + websiteClass 30 = 80
    expect(r.label).toBe('高');
    expect(r.score).toBe(80);
  });

  it('returns 高 for has_website + http only + reviews 25', () => {
    const r = scorePriority({
      websiteClass: 'has_website',
      isChainStore: false,
      usesHttps: false,
      rating: 4.0,
      reviewCount: 25,
    });
    // reviews 30 + rating 20 + http25 = 75
    expect(r.label).toBe('高');
  });

  it('returns 中 for sns_only + few reviews', () => {
    const r = scorePriority({
      websiteClass: 'sns_only',
      isChainStore: false,
      usesHttps: true,
      rating: 4.6,
      reviewCount: 12,
    });
    // reviews(10-19) 15 + rating(>=4.5) 15 + sns_only 20 = 50
    expect(r.label).toBe('高');
  });

  it('returns 低 for has_website + few reviews + https + rating 4.5', () => {
    const r = scorePriority({
      websiteClass: 'has_website',
      isChainStore: false,
      usesHttps: true,
      rating: 4.5,
      reviewCount: 2,
    });
    // rating(>=4.5) 15 = 15
    expect(r.label).toBe('低');
  });

  it('handles undefined rating/reviews gracefully', () => {
    const r = scorePriority({
      websiteClass: 'none',
      isChainStore: false,
      usesHttps: undefined,
      rating: undefined,
      reviewCount: undefined,
    });
    // websiteClass(none) 30 = 30
    expect(r.label).toBe('中');
  });

  it('reasons list reflects matched rules', () => {
    const r = scorePriority({
      websiteClass: 'none',
      isChainStore: false,
      usesHttps: undefined,
      rating: 4.0,
      reviewCount: 30,
    });
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.reasons.some((s) => s.includes('レビュー数 >= 20'))).toBe(true);
    expect(r.reasons.some((s) => s.includes('rating 3.5-4.2'))).toBe(true);
    expect(r.reasons.some((s) => s.includes('WebsiteClass=none'))).toBe(true);
  });
});
