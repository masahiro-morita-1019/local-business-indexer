import { describe, expect, it } from 'vitest';
import { detectLegalForm, honorificForForm } from './legalForm.ts';

describe('detectLegalForm', () => {
  it('detects 株式会社 (full notation)', () => {
    expect(detectLegalForm('株式会社山田工務店').form).toBe('株式会社');
  });

  it('detects 株式会社 (abbreviated 半角)', () => {
    expect(detectLegalForm('(株)山田工務店').form).toBe('株式会社');
  });

  it('detects 株式会社 (abbreviated 全角)', () => {
    expect(detectLegalForm('(株)山田工務店').form).toBe('株式会社');
  });

  it('detects 株式会社 (single-char ㈱)', () => {
    expect(detectLegalForm('㈱山田工務店').form).toBe('株式会社');
  });

  it('detects 有限会社 (㈲)', () => {
    expect(detectLegalForm('㈲内田工務店').form).toBe('有限会社');
  });

  it('detects 合同会社', () => {
    expect(detectLegalForm('合同会社サンプル').form).toBe('合同会社');
  });

  it('detects NPO法人', () => {
    expect(detectLegalForm('NPO法人サンプル').form).toBe('NPO法人');
    expect(detectLegalForm('特定非営利活動法人サンプル').form).toBe('NPO法人');
  });

  it('returns 不明 when no pattern matches', () => {
    expect(detectLegalForm('山田工務店').form).toBe('不明');
    expect(detectLegalForm('当麻工務店').form).toBe('不明');
  });

  it('matches anywhere in the name (not only prefix)', () => {
    expect(detectLegalForm('山田工務店 (株)').form).toBe('株式会社');
  });
});

describe('honorificForForm', () => {
  it('returns 御中 for corporations', () => {
    expect(honorificForForm('株式会社')).toBe('御中');
    expect(honorificForForm('有限会社')).toBe('御中');
    expect(honorificForForm('合同会社')).toBe('御中');
    expect(honorificForForm('NPO法人')).toBe('御中');
  });

  it('returns 様 for unknown (likely individual proprietor)', () => {
    expect(honorificForForm('不明')).toBe('様');
  });
});
