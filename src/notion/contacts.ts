import type { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints.js';
import { PROPERTIES } from './schema.ts';

export interface HasWebsitePage {
  pageId: string;
  name: string;
  website: string;
  hasEmail: boolean;
  hasContactFormUrl: boolean;
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

      const website = websiteProp?.type === 'url' ? (websiteProp.url ?? '') : '';
      const name =
        nameProp?.type === 'title' ? nameProp.title.map((t) => t.plain_text).join('') : '';
      const hasContactFormUrl = formProp?.type === 'url' ? formProp.url !== null : false;

      if (!website) continue;
      out.push({
        pageId: p.id,
        name,
        website,
        hasEmail: false,
        hasContactFormUrl,
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
}

export async function updateContact(
  client: Client,
  pageId: string,
  update: ContactUpdate,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

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
    },
  });
}
