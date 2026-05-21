import type { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints.js';
import type { LegalForm } from '../discovery/classify/legalForm.ts';
import type { WebsiteClass } from '../discovery/filter/noWebsite.ts';
import { PROPERTIES } from './schema.ts';

/**
 * 電話スクリプト生成の対象企業。
 * - OutreachPriority が 高 or 中
 * - WebsiteClass が none or sns_only(=電話向き、has_website はメール経路)
 * - Phone あり
 * - CallScript 未生成
 */
export interface CallScriptCandidate {
  pageId: string;
  name: string;
  category: string;
  area: string;
  rating: number | undefined;
  reviewCount: number | undefined;
  websiteClass: WebsiteClass;
  legalForm: LegalForm;
  outreachReasons: string;
}

export async function queryCallScriptCandidates(
  client: Client,
  databaseId: string,
  limit: number,
): Promise<CallScriptCandidate[]> {
  const out: CallScriptCandidate[] = [];
  let cursor: string | undefined;

  while (out.length < limit) {
    const remaining = limit - out.length;
    const res = await callWithMigrationHint(() =>
      client.databases.query({
        database_id: databaseId,
        filter: {
          and: [
            {
              or: [
                { property: PROPERTIES.OutreachPriority, select: { equals: '高' } },
                { property: PROPERTIES.OutreachPriority, select: { equals: '中' } },
              ],
            },
            {
              or: [
                { property: PROPERTIES.WebsiteClass, select: { equals: 'none' } },
                { property: PROPERTIES.WebsiteClass, select: { equals: 'sns_only' } },
              ],
            },
            { property: PROPERTIES.Phone, phone_number: { is_not_empty: true } },
            { property: PROPERTIES.CallScript, rich_text: { is_empty: true } },
          ],
        },
        sorts: [{ property: PROPERTIES.OutreachScore, direction: 'descending' }],
        page_size: Math.min(100, remaining),
        ...(cursor !== undefined ? { start_cursor: cursor } : {}),
      }),
    );

    for (const page of res.results) {
      if (!('properties' in page)) continue;
      const p = page as PageObjectResponse;
      const candidate = extractCandidate(p);
      if (candidate) out.push(candidate);
      if (out.length >= limit) break;
    }

    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }

  return out;
}

/**
 * Notion API 呼び出しで「プロパティが存在しない」エラーが出たとき、
 * マイグレーション手順を示した親切なエラーに置き換える。
 * (Phase 4-B 以降の新プロパティを既存DBに追加し忘れた場合の対処)
 */
async function callWithMigrationHint<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: unknown }).code === 'validation_error' &&
      'message' in err &&
      typeof (err as { message: unknown }).message === 'string' &&
      /Could not find property/i.test((err as { message: string }).message)
    ) {
      const original = (err as { message: string }).message;
      throw new Error(
        [
          `Notion DB に必要なプロパティが存在しません: ${original}`,
          '',
          '`pnpm migrate:notion` を実行して、schema.ts に追加された新プロパティを既存DBに反映してください。',
          '(idempotent なので既存プロパティには影響しません)',
        ].join('\n'),
      );
    }
    throw err;
  }
}

function extractCandidate(p: PageObjectResponse): CallScriptCandidate | null {
  const props = p.properties;
  const nameProp = props[PROPERTIES.Name];
  const name = nameProp?.type === 'title' ? nameProp.title.map((t) => t.plain_text).join('') : '';
  if (!name) return null;

  const categoryProp = props[PROPERTIES.Category];
  const category =
    categoryProp?.type === 'select' && categoryProp.select ? categoryProp.select.name : '';
  const areaProp = props[PROPERTIES.Area];
  const area = areaProp?.type === 'select' && areaProp.select ? areaProp.select.name : '';

  const ratingProp = props[PROPERTIES.Rating];
  const rating = ratingProp?.type === 'number' ? (ratingProp.number ?? undefined) : undefined;
  const reviewProp = props[PROPERTIES.ReviewCount];
  const reviewCount = reviewProp?.type === 'number' ? (reviewProp.number ?? undefined) : undefined;

  const wcProp = props[PROPERTIES.WebsiteClass];
  const websiteClass: WebsiteClass =
    wcProp?.type === 'select' && wcProp.select ? (wcProp.select.name as WebsiteClass) : 'none';

  const lfProp = props[PROPERTIES.LegalForm];
  const legalForm: LegalForm =
    lfProp?.type === 'select' && lfProp.select ? (lfProp.select.name as LegalForm) : '不明';

  const reasonsProp = props[PROPERTIES.OutreachReasons];
  const outreachReasons =
    reasonsProp?.type === 'rich_text'
      ? reasonsProp.rich_text.map((t) => t.plain_text).join('')
      : '';

  return {
    pageId: p.id,
    name,
    category,
    area,
    rating,
    reviewCount,
    websiteClass,
    legalForm,
    outreachReasons,
  };
}

const NOTION_RICH_TEXT_MAX = 2000;

export async function writeCallScript(
  client: Client,
  pageId: string,
  script: string,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  // Notion の rich_text は 1 ブロック 2000 chars 制限。長文は複数ブロックに分割。
  const chunks: string[] = [];
  let remaining = script;
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, NOTION_RICH_TEXT_MAX));
    remaining = remaining.slice(NOTION_RICH_TEXT_MAX);
  }

  await client.pages.update({
    page_id: pageId,
    properties: {
      [PROPERTIES.CallScript]: {
        rich_text: chunks.map((content) => ({
          type: 'text' as const,
          text: { content },
        })),
      },
      [PROPERTIES.CallScriptGeneratedAt]: { date: { start: today } },
    },
  });
}
