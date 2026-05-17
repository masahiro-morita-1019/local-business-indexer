import { type SearchTextResponse, searchTextResponseSchema } from './types.ts';

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.types',
  'places.primaryType',
  'places.regularOpeningHours',
  'nextPageToken',
].join(',');

export interface SearchTextParams {
  textQuery: string;
  languageCode?: string;
  regionCode?: string;
  pageSize?: number;
  pageToken?: string;
}

export interface PlacesClientOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export class PlacesClient {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: PlacesClientOptions) {
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async searchText(params: SearchTextParams): Promise<SearchTextResponse> {
    const body: Record<string, unknown> = {
      textQuery: params.textQuery,
      languageCode: params.languageCode ?? 'ja',
      regionCode: params.regionCode ?? 'JP',
    };
    if (params.pageSize !== undefined) body.pageSize = params.pageSize;
    if (params.pageToken !== undefined) body.pageToken = params.pageToken;

    const res = await this.fetchWithRetry(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as unknown;
    const parsed = searchTextResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`Places API response schema mismatch: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  private async fetchWithRetry(url: string, init: RequestInit, attempt = 0): Promise<Response> {
    const res = await this.fetchImpl(url, init);
    if (res.ok) return res;

    const retryable = res.status === 429 || (res.status >= 500 && res.status < 600);
    if (retryable && attempt < 3) {
      const backoffMs = 500 * 2 ** attempt + Math.random() * 250;
      await new Promise((r) => setTimeout(r, backoffMs));
      return this.fetchWithRetry(url, init, attempt + 1);
    }

    const text = await res.text().catch(() => '');
    throw new Error(`Places API error: ${res.status} ${res.statusText} ${text}`);
  }
}
