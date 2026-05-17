import { describe, expect, it } from 'vitest';
import { evaluateEmail, selectPrimaryEmail } from './emailFilter.ts';

describe('evaluateEmail', () => {
  it('rejects invalid format', () => {
    expect(evaluateEmail('not-an-email').ok).toBe(false);
    expect(evaluateEmail('a@b').ok).toBe(false);
  });

  it('rejects recruitment / role addresses', () => {
    expect(evaluateEmail('recruit@example.com').ok).toBe(false);
    expect(evaluateEmail('careers@example.com').ok).toBe(false);
    expect(evaluateEmail('support@example.com').ok).toBe(false);
    expect(evaluateEmail('no-reply@example.com').ok).toBe(false);
    expect(evaluateEmail('press@example.com').ok).toBe(false);
  });

  it('prioritizes info / contact / hello / sales', () => {
    expect(evaluateEmail('info@example.com').priority).toBe(0);
    expect(evaluateEmail('contact@example.com').priority).toBe(0);
    expect(evaluateEmail('hello@example.com').priority).toBe(0);
    expect(evaluateEmail('sales@example.com').priority).toBe(0);
  });

  it('treats person names as neutral', () => {
    const r = evaluateEmail('yamada@example.com');
    expect(r.ok).toBe(true);
    expect(r.priority).toBe(1);
  });

  it('normalizes case', () => {
    expect(evaluateEmail('Info@Example.COM').email).toBe('info@example.com');
  });
});

describe('selectPrimaryEmail', () => {
  it('picks info@ over person names', () => {
    const result = selectPrimaryEmail(['yamada@example.com', 'info@example.com']);
    expect(result.primary).toBe('info@example.com');
  });

  it('drops excluded addresses', () => {
    const result = selectPrimaryEmail([
      'recruit@example.com',
      'support@example.com',
      'info@example.com',
    ]);
    expect(result.primary).toBe('info@example.com');
    expect(result.rejected.map((r) => r.email)).toEqual([
      'recruit@example.com',
      'support@example.com',
    ]);
  });

  it('returns undefined when nothing usable', () => {
    const result = selectPrimaryEmail(['no-reply@example.com', 'careers@example.com']);
    expect(result.primary).toBeUndefined();
  });

  it('dedupes case-insensitively', () => {
    const result = selectPrimaryEmail(['Info@Example.com', 'info@example.com']);
    expect(result.accepted.length).toBe(1);
  });

  it('among same-priority picks shorter local-part', () => {
    const result = selectPrimaryEmail(['yamada-taro@example.com', 'taro@example.com']);
    expect(result.primary).toBe('taro@example.com');
  });
});
