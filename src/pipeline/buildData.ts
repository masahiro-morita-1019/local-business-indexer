import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Client } from '@notionhq/client';
import type {
  PageObjectResponse,
  QueryDatabaseParameters,
} from '@notionhq/client/build/src/api-endpoints.js';
import { loadEnv, requireDatabaseId } from '../config.ts';
import { createNotionClient } from '../notion/client.ts';
import { PROPERTIES } from '../notion/schema.ts';

export interface BuildDataParams {
  /** カテゴリで絞り込む(未指定なら全カテゴリ) */
  category?: string | undefined;
  /** "高" のみ / "中" 以上 / "低" 以上 の3段階 */
  minPriority: '高' | '中' | '低';
  /** 出力先ファイル */
  outFile: string;
}

/** Phase 2 (HP生成) で使う正規化済みの企業データ。
 *  Notion API の生レスポンスではなく、テンプレが直接参照するフラットな形にする。 */
export interface Target {
  placeId: string;
  name: string;
  category: string;
  area: string;
  address: string;
  phone: string;
  rating: number | null;
  reviewCount: number | null;
  websiteClass: 'none' | 'sns_only';
  types: string[];
  openingHours: string;
  isChainStore: boolean;
  legalForm: string;
  honorific: string;
  outreachPriority: '高' | '中' | '低';
  outreachScore: number;
  outreachReasons: string;
  googleMapsUrl: string;
}

export interface TargetsFile {
  generatedAt: string;
  filter: { category: string | null; minPriority: '高' | '中' | '低' };
  count: number;
  targets: Target[];
}

export interface BuildDataSummary {
  count: number;
  outFile: string;
  byCategory: Record<string, number>;
  byPriority: Record<'高' | '中' | '低', number>;
}

export async function runBuildData(params: BuildDataParams): Promise<BuildDataSummary> {
  const env = loadEnv();
  const databaseId = requireDatabaseId(env);
  const notion = createNotionClient(env.NOTION_API_KEY);

  console.log(
    `[build-data] Notion から取得中... (category=${params.category ?? '全件'} minPriority=${params.minPriority})`,
  );

  const targets = await fetchTargets(notion, databaseId, {
    category: params.category,
    minPriority: params.minPriority,
  });

  console.log(`[build-data] ${targets.length} 件を取得`);

  const file: TargetsFile = {
    generatedAt: new Date().toISOString(),
    filter: { category: params.category ?? null, minPriority: params.minPriority },
    count: targets.length,
    targets,
  };

  await mkdir(dirname(params.outFile), { recursive: true });
  await writeFile(params.outFile, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
  console.log(`[build-data] 書き込み完了: ${params.outFile}`);

  const byCategory: Record<string, number> = {};
  const byPriority: Record<'高' | '中' | '低', number> = { 高: 0, 中: 0, 低: 0 };
  for (const t of targets) {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
    byPriority[t.outreachPriority]++;
  }

  return { count: targets.length, outFile: params.outFile, byCategory, byPriority };
}

async function fetchTargets(
  notion: Client,
  databaseId: string,
  opts: { category?: string | undefined; minPriority: '高' | '中' | '低' },
): Promise<Target[]> {
  const priorityValues: string[] =
    opts.minPriority === '高'
      ? ['高']
      : opts.minPriority === '中'
        ? ['高', '中']
        : ['高', '中', '低'];

  const websiteClassFilters = [
    {
      property: PROPERTIES.WebsiteClass,
      select: { equals: 'none' },
    },
    {
      property: PROPERTIES.WebsiteClass,
      select: { equals: 'sns_only' },
    },
  ];

  const priorityFilters = priorityValues.map((p) => ({
    property: PROPERTIES.OutreachPriority,
    select: { equals: p },
  }));

  const filter: QueryDatabaseParameters['filter'] = {
    and: [
      { or: websiteClassFilters },
      { or: priorityFilters },
      ...(opts.category
        ? [
            {
              property: PROPERTIES.Category,
              select: { equals: opts.category },
            },
          ]
        : []),
    ],
  };

  const targets: Target[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.databases.query({
      database_id: databaseId,
      filter,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
      sorts: [{ property: PROPERTIES.OutreachScore, direction: 'descending' }],
    });

    for (const page of res.results) {
      if (!('properties' in page)) continue;
      targets.push(toTarget(page as PageObjectResponse));
    }

    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return targets;
}

function toTarget(page: PageObjectResponse): Target {
  const websiteClass = readSelect(page, PROPERTIES.WebsiteClass);
  if (websiteClass !== 'none' && websiteClass !== 'sns_only') {
    throw new Error(`予期しない WebsiteClass: ${websiteClass} (page=${page.id})`);
  }
  const outreachPriority = readSelect(page, PROPERTIES.OutreachPriority);
  if (outreachPriority !== '高' && outreachPriority !== '中' && outreachPriority !== '低') {
    throw new Error(`予期しない OutreachPriority: ${outreachPriority} (page=${page.id})`);
  }
  const legalForm = readSelect(page, PROPERTIES.LegalForm) ?? '不明';
  return {
    placeId: readRichText(page, PROPERTIES.PlaceId),
    name: readTitle(page, PROPERTIES.Name),
    category: readSelect(page, PROPERTIES.Category) ?? '',
    area: readSelect(page, PROPERTIES.Area) ?? '',
    address: readRichText(page, PROPERTIES.Address),
    phone: readPhone(page, PROPERTIES.Phone),
    rating: readNumber(page, PROPERTIES.Rating),
    reviewCount: readNumber(page, PROPERTIES.ReviewCount),
    websiteClass,
    types: readMultiSelect(page, PROPERTIES.Types),
    openingHours: readRichText(page, PROPERTIES.OpeningHours),
    isChainStore: readCheckbox(page, PROPERTIES.IsChainStore),
    legalForm,
    honorific: legalForm === '不明' ? '様' : '御中',
    outreachPriority,
    outreachScore: readNumber(page, PROPERTIES.OutreachScore) ?? 0,
    outreachReasons: readRichText(page, PROPERTIES.OutreachReasons),
    googleMapsUrl: readUrl(page, PROPERTIES.GoogleMapsUrl),
  };
}

function readTitle(page: PageObjectResponse, prop: string): string {
  const p = page.properties[prop];
  if (!p || p.type !== 'title') return '';
  return p.title.map((t) => t.plain_text).join('');
}

function readRichText(page: PageObjectResponse, prop: string): string {
  const p = page.properties[prop];
  if (!p || p.type !== 'rich_text') return '';
  return p.rich_text.map((t) => t.plain_text).join('');
}

function readSelect(page: PageObjectResponse, prop: string): string | null {
  const p = page.properties[prop];
  if (!p || p.type !== 'select') return null;
  return p.select?.name ?? null;
}

function readMultiSelect(page: PageObjectResponse, prop: string): string[] {
  const p = page.properties[prop];
  if (!p || p.type !== 'multi_select') return [];
  return p.multi_select.map((o) => o.name);
}

function readNumber(page: PageObjectResponse, prop: string): number | null {
  const p = page.properties[prop];
  if (!p || p.type !== 'number') return null;
  return p.number;
}

function readCheckbox(page: PageObjectResponse, prop: string): boolean {
  const p = page.properties[prop];
  if (!p || p.type !== 'checkbox') return false;
  return p.checkbox;
}

function readUrl(page: PageObjectResponse, prop: string): string {
  const p = page.properties[prop];
  if (!p || p.type !== 'url') return '';
  return p.url ?? '';
}

function readPhone(page: PageObjectResponse, prop: string): string {
  const p = page.properties[prop];
  if (!p || p.type !== 'phone_number') return '';
  return p.phone_number ?? '';
}
