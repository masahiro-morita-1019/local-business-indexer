import pLimit from 'p-limit';
import { loadEnv, requireDatabaseId } from '../config.ts';
import { type ChainDetection, detectChainStore } from '../discovery/classify/chainStore.ts';
import { type LegalFormDetection, detectLegalForm } from '../discovery/classify/legalForm.ts';
import {
  type PriorityResult,
  buildPriorityInput,
  scorePriority,
} from '../discovery/classify/priority.ts';
import { type Classification, classifyWebsite } from '../discovery/filter/noWebsite.ts';
import { PlacesClient } from '../discovery/places/client.ts';
import { searchPlaces } from '../discovery/places/searchText.ts';
import type { Place } from '../discovery/places/types.ts';
import { createNotionClient } from '../notion/client.ts';
import {
  type BusinessRecord,
  demoteToHasWebsite,
  findByPlaceId,
  upsertBusiness,
} from '../notion/upsert.ts';

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
  byPriority: Record<'高' | '中' | '低' | '除外', number>;
  created: number;
  updated: number;
  /** has_website に遷移した既存ページを WebsiteClass=has_website + Status=見送り に更新した件数 */
  demoted: number;
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
    const classification = classifyWebsite(p.websiteUri);
    const chain = detectChainStore(name, p.websiteUri);
    const legalForm = detectLegalForm(name);
    const priority = scorePriority(
      buildPriorityInput({
        classification,
        chain,
        rating: p.rating,
        reviewCount: p.userRatingCount,
      }),
    );
    return { place: p, classification, chain, legalForm, priority };
  });

  const byClass = { none: 0, sns_only: 0, has_website: 0 };
  const byPriority = { 高: 0, 中: 0, 低: 0, 除外: 0 };
  let chainStores = 0;
  for (const c of classified) {
    byClass[c.classification.class]++;
    byPriority[c.priority.label]++;
    if (c.chain.isChain) chainStores++;
  }

  console.log(
    `[discover] 分類結果: none=${byClass.none}, sns_only=${byClass.sns_only}, has_website=${byClass.has_website} (営業対象外)`,
  );
  console.log(`[discover] 大手チェーン: ${chainStores} 件`);
  console.log(
    `[discover] 営業優先度: 高=${byPriority.高} 中=${byPriority.中} 低=${byPriority.低} 除外=${byPriority.除外}`,
  );

  // D ルート(メール営業 to has_website)廃止により、has_website は新規 upsert しない。
  // ただし既存ページが has_website に遷移したケースは見落とさないよう、別経路で更新する。
  const targets = classified.filter((c) => c.classification.class !== 'has_website');
  const hasWebsiteCandidates = classified.filter((c) => c.classification.class === 'has_website');

  if (params.dryRun) {
    console.log('[discover] --dry-run のため Notion 書き込みはスキップ');
    return {
      found: places.length,
      byClass,
      chainStores,
      byPriority,
      created: 0,
      updated: 0,
      demoted: 0,
      skipped: 0,
    };
  }

  const databaseId = requireDatabaseId(env);
  const notion = createNotionClient(env.NOTION_API_KEY);

  // Notion API は 3 req/sec 制限。並列度 2 で安全側に。
  const limit = pLimit(2);
  let created = 0;
  let updated = 0;
  let demoted = 0;

  await Promise.all(
    targets.map((t) =>
      limit(async () => {
        const record = toBusinessRecord(
          t.place,
          t.classification,
          t.chain,
          t.legalForm,
          t.priority,
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

  // 既存ページが has_website に遷移した場合は WebsiteClass を更新 + Status が未着手のときだけ見送りに。
  await Promise.all(
    hasWebsiteCandidates.map((c) =>
      limit(async () => {
        const name = c.place.displayName?.text ?? '(名称不明)';
        try {
          const existing = await findByPlaceId(notion, databaseId, c.place.id);
          if (!existing) return;
          const changed = await demoteToHasWebsite(notion, existing, {
            websiteUri: c.place.websiteUri,
            decisionReason: c.classification.reason,
          });
          if (changed) {
            demoted++;
            console.log(`[discover] 見送り遷移: ${name} (has_website 化)`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[discover] 遷移失敗 (${c.place.id} ${name}): ${msg}`);
        }
      }),
    ),
  );

  console.log(`[discover] Notion: created=${created}, updated=${updated}, demoted=${demoted}`);

  return {
    found: places.length,
    byClass,
    chainStores,
    byPriority,
    created,
    updated,
    demoted,
    skipped: 0,
  };
}

function toBusinessRecord(
  place: Place,
  classification: Classification,
  chain: ChainDetection,
  legalForm: LegalFormDetection,
  priority: PriorityResult,
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
    legalForm: legalForm.form,
    outreachPriority: priority.label,
    outreachScore: priority.score,
    outreachReasons: priority.reasons.join(' / '),
  };
}
