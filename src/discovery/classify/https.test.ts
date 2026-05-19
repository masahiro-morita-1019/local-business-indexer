import { describe, expect, it } from 'vitest';
import { detectHttps } from './https.ts';

describe('detectHttps', () => {
  it('detects https://', () => {
    const r = detectHttps('https://example.com');
    expect(r.uses).toBe(true);
  });

  it('detects http://', () => {
    const r = detectHttps('http://example.com');
    expect(r.uses).toBe(false);
    expect(r.reason).toContain('http://');
  });

  it('returns undefined for empty input', () => {
    expect(detectHttps(undefined).uses).toBeUndefined();
    expect(detectHttps('').uses).toBeUndefined();
    expect(detectHttps('   ').uses).toBeUndefined();
  });

  it('returns undefined for invalid URL', () => {
    expect(detectHttps('not a url').uses).toBeUndefined();
  });

  it('returns undefined for non-http schemes', () => {
    expect(detectHttps('ftp://example.com').uses).toBeUndefined();
  });
});
