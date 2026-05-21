import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import type { SenderIdentity } from '../../config.ts';
import { generateCallScript } from './generator.ts';

const SENDER: SenderIdentity = {
  name: '山田太郎',
  title: 'Webサイト制作',
  email: 'yamada@example.com',
  phone: '',
  address: '',
  portfolioUrl: 'https://yamada.example.com',
  unsubscribeUrl: '',
  pitchContext: 'テスト用ピッチコンテキスト',
};

function mockClient(textResponse: string): Anthropic {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: textResponse }],
        usage: {
          input_tokens: 500,
          output_tokens: 700,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      }),
    },
  } as unknown as Anthropic;
}

describe('generateCallScript', () => {
  it('returns the script text and usage metrics', async () => {
    const client = mockClient('## 導入\nテスト本文');
    const result = await generateCallScript(client, SENDER, {
      name: 'テスト工務店',
      category: '工務店',
      area: '所沢市',
      rating: 4.5,
      reviewCount: 30,
      websiteClass: 'none',
      legalForm: '不明',
      outreachReasons: '',
    });
    expect(result.script).toContain('## 導入');
    expect(result.usage.inputTokens).toBe(500);
    expect(result.usage.outputTokens).toBe(700);
  });

  it('calls messages.create with thinking disabled and cache_control on system', async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    });
    const client = { messages: { create } } as unknown as Anthropic;

    await generateCallScript(client, SENDER, {
      name: 'A',
      category: 'B',
      area: 'C',
      rating: undefined,
      reviewCount: undefined,
      websiteClass: 'none',
      legalForm: '不明',
      outreachReasons: '',
    });

    const callArgs = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArgs.model).toBe('claude-opus-4-7');
    expect(callArgs.thinking).toEqual({ type: 'disabled' });

    const systemArg = callArgs.system as Array<{
      type: string;
      text: string;
      cache_control?: { type: string };
    }>;
    expect(systemArg).toHaveLength(1);
    expect(systemArg[0]?.cache_control).toEqual({ type: 'ephemeral' });
  });

  it('joins multiple text blocks in the response', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            { type: 'text', text: 'パート1' },
            { type: 'text', text: 'パート2' },
          ],
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
        }),
      },
    } as unknown as Anthropic;

    const result = await generateCallScript(client, SENDER, {
      name: 'A',
      category: 'B',
      area: 'C',
      rating: undefined,
      reviewCount: undefined,
      websiteClass: 'none',
      legalForm: '不明',
      outreachReasons: '',
    });
    expect(result.script).toContain('パート1');
    expect(result.script).toContain('パート2');
  });
});
