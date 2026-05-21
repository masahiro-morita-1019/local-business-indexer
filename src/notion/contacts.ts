import type { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints.js';
import { detectChainStore } from '../discovery/classify/chainStore.ts';
import { buildPriorityInput, scorePriority } from '../discovery/classify/priority.ts';
import type { WebsiteClass } from '../discovery/filter/noWebsite.ts';
import { PROPERTIES } from './schema.ts';

export interface HasWebsitePage {
  pageId: string;
  name: string;
  website: string;
  hasEmail: boolean;
  hasContactFormUrl: boolean;
  /** 既存の Notion 値(優先度再計算に必要) */
  rating: number | undefined;
  reviewCount: number | undefined;
  websiteClass: WebsiteClass;
}

/**
 * WebsiteClass = has_website かつ Website が空でない、
 * 加えて Email が未設定のページを取得する(Phase 1.5 のスクレイピング対象)。
 *
 * pageSize は Notion API 上限の 100 まで。limit 引数で取得総数を制御。
 */
export async function queryHasWebsiteCandidates(
  client: Client,
  databaseId: string,
  limit: number,
): Promise<HasWebsitePage[]> {
  const out: HasWebsitePage[] = [];
  let cursor: string | undefined;

  while (out.length < limit) {
    const remaining = limit - out.length;
    const res = await client.databases.query({
      database_id: databaseId,
      filter: {
        and: [
          { property: PROPERTIES.WebsiteClass, select: { equals: 'has_website' } },
          { property: PROPERTIES.Email, email: { is_empty: true } },
          { property: PROPERTIES.Website, url: { is_not_empty: true } },
        ],
      },
      page_size: Math.min(100, remaining),
      ...(cursor !== undefined ? { start_cursor: cursor } : {}),
    });

    for (const page of res.results) {
      if (!('properties' in page)) continue;
      const p = page as PageObjectResponse;
      const websiteProp = p.properties[PROPERTIES.Website];
      const nameProp = p.properties[PROPERTIES.Name];
      const formProp = p.properties[PROPERTIES.ContactFormUrl];
      const ratingProp = p.properties[PROPERTIES.Rating];
      const reviewProp = p.properties[PROPERTIES.ReviewCount];
      const wcProp = p.properties[PROPERTIES.WebsiteClass];

      const website = websiteProp?.type === 'url' ? (websiteProp.url ?? '') : '';
      const name =
        nameProp?.type === 'title' ? nameProp.title.map((t) => t.plain_text).join('') : '';
      const hasContactFormUrl = formProp?.type === 'url' ? formProp.url !== null : false;
      const rating = ratingProp?.type === 'number' ? (ratingProp.number ?? undefined) : undefined;
      const reviewCount =
        reviewProp?.type === 'number' ? (reviewProp.number ?? undefined) : undefined;
      const websiteClass: WebsiteClass =
        wcProp?.type === 'select' && wcProp.select
          ? ((wcProp.select.name as WebsiteClass) ?? 'has_website')
          : 'has_website';

      if (!website) continue;
      out.push({
        pageId: p.id,
        name,
        website,
        hasEmail: false,
        hasContactFormUrl,
        rating,
        reviewCount,
        websiteClass,
      });
      if (out.length >= limit) break;
    }

    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }

  return out;
}

export interface ContactUpdate {
  email?: string | undefined;
  contactFormUrl?: string | undefined;
  note: string;
  /** Phase 1.5 でリダイレクト追跡後の最終URL。任意 */
  actualUrl?: string | undefined;
  /** 実応答ベースのHTTPS判定。undefined のときは Notion の UsesHttps は更新しない */
  actualHttps?: boolean | undefined;
  /**
   * 優先度を再計算するための入力(候補ページから取得した値)。
   * actualHttps が定まったら UsesHttps を上書きし、再スコアリングする。
   */
  recomputePriority?: {
    name: string;
    websiteClass: WebsiteClass;
    rating: number | undefined;
    reviewCount: number | undefined;
    /** GBP 由来の website URL(チェーン判定に使う) */
    websiteForChainCheck: string | undefined;
  };
}

export async function updateContact(
  client: Client,
  pageId: string,
  update: ContactUpdate,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  // 実応答ベースで HTTPS が判定できた場合は UsesHttps を上書き
  const usesHttpsOverride =
    update.actualHttps !== undefined
      ? { [PROPERTIES.UsesHttps]: { checkbox: update.actualHttps } }
      : {};

  // 優先度の再計算: actualHttps が確定し、recompute 入力が揃っているときのみ
  let priorityOverride: Record<string, unknown> = {};
  if (update.recomputePriority && update.actualHttps !== undefined) {
    const rp = update.recomputePriority;
    const chain = detectChainStore(rp.name, rp.websiteForChainCheck);
    const priority = scorePriority(
      buildPriorityInput({
        classification: { class: rp.websiteClass, reason: '' },
        chain,
        https: { uses: update.actualHttps, reason: '実応答ベース' },
        rating: rp.rating,
        reviewCount: rp.reviewCount,
      }),
    );
    priorityOverride = {
      [PROPERTIES.OutreachPriority]: { select: { name: priority.label } },
      [PROPERTIES.OutreachScore]: { number: priority.score },
      [PROPERTIES.OutreachReasons]: {
        rich_text: [
          { type: 'text', text: { content: priority.reasons.join(' / ').slice(0, 2000) } },
        ],
      },
    };
  }

  await client.pages.update({
    page_id: pageId,
    properties: {
      [PROPERTIES.Email]: { email: update.email && update.email !== '' ? update.email : null },
      [PROPERTIES.ContactFormUrl]: {
        url: update.contactFormUrl && update.contactFormUrl !== '' ? update.contactFormUrl : null,
      },
      [PROPERTIES.ContactExtractedAt]: { date: { start: today } },
      [PROPERTIES.ContactExtractionNote]: {
        rich_text: update.note
          ? [{ type: 'text', text: { content: update.note.slice(0, 2000) } }]
          : [],
      },
      [PROPERTIES.ActualUrl]: { url: update.actualUrl ?? null },
      ...usesHttpsOverride,
      ...priorityOverride,
    },
  });
}
