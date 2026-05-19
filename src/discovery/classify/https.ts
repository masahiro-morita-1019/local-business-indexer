/**
 * 取得した websiteUri が HTTPS で配信されているかを判定する。
 * HPはあるが http:// で運用されている店は「Webサイトが古い」シグナルとして
 * 営業優先度を上げる材料になる。
 *
 * 注意: Google Maps の websiteUri は店舗が登録した URL そのまま(リダイレクトされる
 * 前)。実際のサイトが HTTPS にリダイレクトしている可能性は十分あるため、本判定は
 * **登録URLベース** の暫定値であることを understand しておく。Phase 1.5
 * (コンタクトスクレイパー)で実HTTP応答ベースの上書き判定を入れることも検討可能。
 */

export interface HttpsDetection {
  uses: boolean | undefined; // undefined = websiteUri が空など、判定不能
  reason: string;
}

export function detectHttps(websiteUri: string | undefined): HttpsDetection {
  if (!websiteUri || websiteUri.trim() === '') {
    return { uses: undefined, reason: 'websiteUri 未設定' };
  }
  try {
    const url = new URL(websiteUri);
    if (url.protocol === 'https:') return { uses: true, reason: 'https://' };
    if (url.protocol === 'http:') return { uses: false, reason: 'http:// (SSL未対応の可能性)' };
    return { uses: undefined, reason: `非HTTP/HTTPSスキーム: ${url.protocol}` };
  } catch {
    return { uses: undefined, reason: `URLパース失敗: ${websiteUri}` };
  }
}
