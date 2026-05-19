import { describe, expect, it } from 'vitest';
import { detectChainStore } from './chainStore.ts';

describe('detectChainStore', () => {
  it('detects 一条工務店 by domain', () => {
    const r = detectChainStore('所沢展示場', 'https://www.ichijo.co.jp/showroom/tokorozawa');
    expect(r.isChain).toBe(true);
    expect(r.chainName).toBe('一条工務店');
    expect(r.reason).toContain('ドメイン一致');
  });

  it('detects 一条工務店 by name pattern', () => {
    const r = detectChainStore('一条工務店 所沢展示場', undefined);
    expect(r.isChain).toBe(true);
    expect(r.chainName).toBe('一条工務店');
    expect(r.reason).toContain('店名一致');
  });

  it('detects アイ工務店 by name', () => {
    const r = detectChainStore('アイ工務店 新所沢展示場', undefined);
    expect(r.isChain).toBe(true);
    expect(r.chainName).toBe('アイ工務店');
  });

  it('detects ヘーベルハウス via 旧表記 (へーベルハウス)', () => {
    const r = detectChainStore('へーベルハウス所沢', undefined);
    expect(r.isChain).toBe(true);
    expect(r.chainName).toBe('ヘーベルハウス');
  });

  it('does not match local small contractor', () => {
    const r = detectChainStore('当麻工務店', 'http://touma-koumuten.com/');
    expect(r.isChain).toBe(false);
    expect(r.chainName).toBeUndefined();
  });

  it('does not falsely match similar local domain', () => {
    // ichijoworks.local など似た名前を含むが一致しない例
    const r = detectChainStore('一条木工所', 'https://ichijoworks.example.com');
    expect(r.isChain).toBe(false);
  });

  it('domain match takes priority over name match', () => {
    // 店名に「一条」が含まれず、URLだけが一条系のレアケース
    const r = detectChainStore('所沢ショールーム', 'https://ichijo.co.jp/branch');
    expect(r.isChain).toBe(true);
    expect(r.reason).toContain('ドメイン一致');
  });

  it('handles undefined website gracefully', () => {
    const r = detectChainStore('一般工務店', undefined);
    expect(r.isChain).toBe(false);
  });
});
