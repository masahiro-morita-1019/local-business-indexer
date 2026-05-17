import type { PlacesClient } from './client.ts';
import type { Place } from './types.ts';

export interface SearchAllParams {
  area: string;
  category: string;
  limit: number;
}

/**
 * area × category のクエリで Places API (New) を叩き、nextPageToken を辿って最大 limit 件返す。
 * Places API (New) は 1 ページ最大 20 件、最大 60 件まで(3ページ)取得可能。
 * limit > 60 の場合は呼び出し側で地名サブ分割する想定。
 */
export async function searchPlaces(
  client: PlacesClient,
  params: SearchAllParams,
): Promise<Place[]> {
  const textQuery = `${params.area} ${params.category}`;
  const results: Place[] = [];
  let pageToken: string | undefined;

  while (results.length < params.limit) {
    const remaining = params.limit - results.length;
    const pageSize = Math.min(20, remaining);

    const res = await client.searchText({
      textQuery,
      pageSize,
      ...(pageToken !== undefined ? { pageToken } : {}),
    });

    const places = res.places ?? [];
    results.push(...places);

    if (!res.nextPageToken || places.length === 0) break;
    pageToken = res.nextPageToken;

    // Places API は nextPageToken 直後の呼び出しに数秒の遅延を要する
    await new Promise((r) => setTimeout(r, 2000));
  }

  return results.slice(0, params.limit);
}
