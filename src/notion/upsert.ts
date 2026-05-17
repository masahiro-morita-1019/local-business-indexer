import type { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints.js';
import type { WebsiteClass } from '../discovery/filter/noWebsite.ts';
import { PROPERTIES } from './schema.ts';

export interface BusinessRecord {
  placeId: string;
  name: string;
  category: string;
  area: string;
  address?: string | undefined;
  phone?: string | undefined;
  website?: string | undefined;
  websiteClass: WebsiteClass;
  decisionReason: string;
  rating?: number | undefined;
  reviewCount?: number | undefined;
  googleMapsUrl?: string | undefined;
  types?: string[] | undefined;
  openingHours?: string | undefined;
}

export type UpsertOutcome = 'created' | 'updated';

const NOTION_MULTI_SELECT_MAX = 100;

export async function upsertBusiness(
  client: Client,
  databaseId: string,
  record: BusinessRecord,
): Promise<UpsertOutcome> {
  const existing = await findByPlaceId(client, databaseId, record.placeId);
  const today = new Date().toISOString().slice(0, 10);

  const factualProps = {
    [PROPERTIES.Name]: titleProp(record.name),
    [PROPERTIES.Address]: richTextProp(record.address),
    [PROPERTIES.Phone]: phoneProp(record.phone),
    [PROPERTIES.Website]: urlProp(record.website),
    [PROPERTIES.WebsiteClass]: selectProp(record.websiteClass),
    [PROPERTIES.DecisionReason]: richTextProp(record.decisionReason),
    [PROPERTIES.Rating]: numberProp(record.rating),
    [PROPERTIES.ReviewCount]: numberProp(record.reviewCount),
    [PROPERTIES.GoogleMapsUrl]: urlProp(record.googleMapsUrl),
    [PROPERTIES.Types]: multiSelectProp(record.types),
    [PROPERTIES.OpeningHours]: richTextProp(record.openingHours),
    [PROPERTIES.LastCheckedAt]: dateProp(today),
  };

  if (existing) {
    // Status / Notes / FoundAt / Category / Area には触らない(運用側の状態を尊重)
    await client.pages.update({
      page_id: existing.id,
      properties: factualProps,
    });
    return 'updated';
  }

  await client.pages.create({
    parent: { database_id: databaseId },
    properties: {
      ...factualProps,
      [PROPERTIES.PlaceId]: richTextProp(record.placeId),
      [PROPERTIES.Category]: selectProp(record.category),
      [PROPERTIES.Area]: selectProp(record.area),
      [PROPERTIES.Status]: selectProp('未着手'),
      [PROPERTIES.FoundAt]: dateProp(today),
    },
  });
  return 'created';
}

async function findByPlaceId(
  client: Client,
  databaseId: string,
  placeId: string,
): Promise<PageObjectResponse | null> {
  const res = await client.databases.query({
    database_id: databaseId,
    filter: {
      property: PROPERTIES.PlaceId,
      rich_text: { equals: placeId },
    },
    page_size: 1,
  });
  const first = res.results[0];
  if (!first || !('properties' in first)) return null;
  return first as PageObjectResponse;
}

// ---- property builders ----

function titleProp(value: string) {
  return { title: [{ type: 'text' as const, text: { content: truncate(value, 2000) } }] };
}

function richTextProp(value: string | undefined) {
  if (value === undefined || value === '') return { rich_text: [] };
  return { rich_text: [{ type: 'text' as const, text: { content: truncate(value, 2000) } }] };
}

function urlProp(value: string | undefined) {
  return { url: value && value !== '' ? value : null };
}

function phoneProp(value: string | undefined) {
  return { phone_number: value && value !== '' ? value : null };
}

function numberProp(value: number | undefined) {
  return { number: value ?? null };
}

function selectProp(name: string) {
  return { select: { name } };
}

function dateProp(isoDate: string) {
  return { date: { start: isoDate } };
}

function multiSelectProp(values: string[] | undefined) {
  if (!values || values.length === 0) return { multi_select: [] };
  const sanitized = values
    .slice(0, NOTION_MULTI_SELECT_MAX)
    .map((v) => ({ name: v.replace(/,/g, '_').slice(0, 100) }));
  return { multi_select: sanitized };
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}
