import { describe, expect, it } from 'vitest';
import type { SenderIdentity } from '../../config.ts';
import { buildSystemPrompt, buildUserPrompt } from './prompts.ts';

const TEST_SENDER: SenderIdentity = {
  name: '山田太郎',
  title: 'Webサイト制作',
  email: 'yamada@example.com',
  phone: '090-1234-5678',
  address: '',
  portfolioUrl: 'https://yamada.example.com',
  unsubscribeUrl: '',
  pitchContext: 'テスト用の装備説明: 既にサンプルを作っている。',
};

describe('buildSystemPrompt', () => {
  it('includes sender name and title', () => {
    const sys = buildSystemPrompt(TEST_SENDER);
    expect(sys).toContain('山田太郎');
    expect(sys).toContain('Webサイト制作');
    expect(sys).toContain('yamada@example.com');
  });

  it('shows (未設定) when sender name is empty', () => {
    const sys = buildSystemPrompt({ ...TEST_SENDER, name: '' });
    expect(sys).toContain('(未設定)');
  });

  it('omits optional fields when not provided', () => {
    const sys = buildSystemPrompt({
      ...TEST_SENDER,
      portfolioUrl: '',
      phone: '',
    });
    expect(sys).not.toContain('ポートフォリオ:');
    expect(sys).not.toContain('電話:');
  });

  it('includes all 4 required sections', () => {
    const sys = buildSystemPrompt(TEST_SENDER);
    expect(sys).toContain('## 導入');
    expect(sys).toContain('## 価値訴求');
    expect(sys).toContain('## 反論対応');
    expect(sys).toContain('## クロージング');
  });

  it('mentions 特定商取引法 / 特商法 (regulatory awareness)', () => {
    const sys = buildSystemPrompt(TEST_SENDER);
    expect(sys.includes('特定商取引法') || sys.includes('特商法')).toBe(true);
  });

  it('mentions 再勧誘禁止 / 引き際 (no-pushy-sales)', () => {
    const sys = buildSystemPrompt(TEST_SENDER);
    expect(sys.includes('再勧誘禁止') || sys.includes('これ以上のご連絡')).toBe(true);
  });

  it("embeds pitchContext verbatim (Show-Don't-Tell framing)", () => {
    const sys = buildSystemPrompt(TEST_SENDER);
    expect(sys).toContain('テスト用の装備説明: 既にサンプルを作っている。');
  });

  it("uses Show-Don't-Tell framing (not pure appointment-setting)", () => {
    const sys = buildSystemPrompt(TEST_SENDER);
    expect(sys).toContain("Show, Don't Tell");
    expect(sys).toContain('貴社向けのサンプルサイトを既に作りました');
    expect(sys).toContain('メールでサンプルURL送付の了承を取る');
    // 旧来の「アポ取り」型ではないことを確認
    expect(sys).toContain('アポ(対面・Zoom)を取りに行かない');
  });
});

describe('buildUserPrompt', () => {
  it('includes company name with 御中 for 株式会社', () => {
    const prompt = buildUserPrompt({
      name: '株式会社テスト工務店',
      category: '工務店',
      area: '所沢市',
      rating: 4.5,
      reviewCount: 30,
      websiteClass: 'none',
      legalForm: '株式会社',
      outreachReasons: 'レビュー数 >= 20(+30)',
    });
    expect(prompt).toContain('株式会社テスト工務店');
    expect(prompt).toContain('御中');
    expect(prompt).toContain('4.5');
    expect(prompt).toContain('30件');
  });

  it('includes 様 for 不明 (likely individual)', () => {
    const prompt = buildUserPrompt({
      name: '山田工務店',
      category: '工務店',
      area: '町田市',
      rating: 4.0,
      reviewCount: 5,
      websiteClass: 'sns_only',
      legalForm: '不明',
      outreachReasons: '',
    });
    expect(prompt).toContain('様');
    expect(prompt).not.toContain('御中');
  });

  it('handles missing rating/reviewCount', () => {
    const prompt = buildUserPrompt({
      name: 'テスト',
      category: '塗装業',
      area: '相模原市',
      rating: undefined,
      reviewCount: undefined,
      websiteClass: 'none',
      legalForm: '不明',
      outreachReasons: '',
    });
    expect(prompt).toContain('評価情報なし');
  });

  it('describes WebsiteClass appropriately', () => {
    const noneCase = buildUserPrompt({
      name: 'A',
      category: 'B',
      area: 'C',
      rating: undefined,
      reviewCount: undefined,
      websiteClass: 'none',
      legalForm: '不明',
      outreachReasons: '',
    });
    expect(noneCase).toContain('ホームページなし');

    const snsCase = buildUserPrompt({
      name: 'A',
      category: 'B',
      area: 'C',
      rating: undefined,
      reviewCount: undefined,
      websiteClass: 'sns_only',
      legalForm: '不明',
      outreachReasons: '',
    });
    expect(snsCase).toContain('SNS');
  });
});
