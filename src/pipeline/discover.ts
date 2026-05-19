import pLimit from 'p-limit';
import { loadEnv, requireDatabaseId } from '../config.ts';
import { type ChainDetection, detectChainStore } from '../discovery/classify/chainStore.ts';
import { type HttpsDetection, detectHttps } from '../discovery/classify/https.ts';
import { type LegalFormDetection, detectLegalForm } from '../discovery/classify/legalForm.ts';
import { type Classification, classifyWebsite } from '../discovery/filter/noWebsite.ts';
import { PlacesClient } from '../discovery/places/client.ts';
import { searchPlaces } from '../discovery/places/searchText.ts';
import type { Place } from '../discovery/places/types.ts';
import { createNotionClient } from '../notion/client.ts';
import { type BusinessRecord, upsertBusiness } from '../notion/upsert.ts';

export interface DiscoverParams {
  area: string;
  category: string;
  limit: number;
  dryRun?: boolean;
}

export interface DiscoverSummary {
  found: number;
  byClass: Record<'none' | 'sns_only' | 'has_website', number>;
  chainStores: number;
  httpOnly: number;
  created: number;
  updated: number;
  skipped: number;
}

export async function runDiscover(params: DiscoverParams): Promise<DiscoverSummary> {
  const env = loadEnv();

  const placesClient = new PlacesClient({ apiKey: env.GOOGLE_MAPS_API_KEY });

  console.log(`[discover] 検索: "${params.area} ${params.category}" (limit=${params.limit})`);
  const places = await searchPlaces(placesClient, params);
  console.log(`[discover] Places API から ${places.length} 件取得`);

  const classified = places.map((p) => {
    const name = p.displayName?.text ?? '(名称不明)';
    return {
      place: p,
      classification: classifyWebsite(p.websiteUri),
      chain: detectChainStore(name, p.websiteUri),
      https: detectHttps(p.websiteUri),
      legalForm: detectLegalForm(name),
    };
  });

  const byClass = { none: 0, sns_only: 0, has_website: 0 };
  let chainStores = 0;
  let httpOnly = 0;
  for (const c of classified) {
    byClass[c.classification.class]++;
    if (c.chain.isChain) chainStores++;
    if (c.https.uses === false) httpOnly++;
  }

  console.log(
    `[discover] 分類結果: none=${byClass.none}, sns_only=${byClass.sns_only}, has_website=${byClass.has_website}`,
  );
  console.log(`[discover] 大手チェーン: ${chainStores} 件 / HTTPなし(SSL未対応): ${httpOnly} 件`);

  // A+B+D方針: has_website も Phase 1.5(コンタクトスクレイパー)の対象なので全件保存。
  // 営業フェーズではチャネル別に Notion 側でフィルタする (WebsiteClass で絞り込み)。
  const targets = classified;

  if (params.dryRun) {
    console.log('[discover] --dry-run のため Notion 書き込みはスキップ');
    return {
      found: places.length,
      byClass,
      chainStores,
      httpOnly,
      created: 0,
      updated: 0,
      skipped: 0,
    };
  }

  const databaseId = requireDatabaseId(env);
  const notion = createNotionClient(env.NOTION_API_KEY);

  // Notion API は 3 req/sec 制限。並列度 2 で安全側に。
  const limit = pLimit(2);
  let created = 0;
  let updated = 0;

  await Promise.all(
    targets.map((t) =>
      limit(async () => {
        const record = toBusinessRecord(
          t.place,
          t.classification,
          t.chain,
          t.https,
          t.legalForm,
          params,
        );
        try {
          const outcome = await upsertBusiness(notion, databaseId, record);
          if (outcome === 'created') created++;
          else updated++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[discover] upsert失敗 (${record.placeId} ${record.name}): ${msg}`);
        }
      }),
    ),
  );

  console.log(`[discover] Notion: created=${created}, updated=${updated}`);

  return {
    found: places.length,
    byClass,
    chainStores,
    httpOnly,
    created,
    updated,
    skipped: 0,
  };
}

function toBusinessRecord(
  place: Place,
  classification: Classification,
  chain: ChainDetection,
  https: HttpsDetection,
  legalForm: LegalFormDetection,
  params: DiscoverParams,
): BusinessRecord {
  return {
    placeId: place.id,
    name: place.displayName?.text ?? '(名称不明)',
    category: params.category,
    area: params.area,
    address: place.formattedAddress,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber,
    website: place.websiteUri,
    websiteClass: classification.class,
    decisionReason: classification.reason,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    googleMapsUrl: place.googleMapsUri,
    types: place.types,
    openingHours: place.regularOpeningHours?.weekdayDescriptions?.join('\n'),
    isChainStore: chain.isChain,
    chainName: chain.chainName,
    usesHttps: https.uses,
    legalForm: legalForm.form,
  };
}
