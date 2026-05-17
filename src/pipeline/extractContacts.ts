import pLimit from 'p-limit';
import { loadEnv, requireDatabaseId } from '../config.ts';
import { extractContacts } from '../discovery/contact-extractor/extractor.ts';
import { createNotionClient } from '../notion/client.ts';
import { queryHasWebsiteCandidates, updateContact } from '../notion/contacts.ts';

export interface ExtractContactsParams {
  limit: number;
  dryRun?: boolean;
  /** 並列度。各サイトごとに独立、ただし同一ドメインは extractor 側でレート制御 */
  concurrency?: number;
}

export interface ExtractContactsSummary {
  candidates: number;
  emailFound: number;
  formOnly: number;
  noContact: number;
  errors: number;
}

export async function runExtractContacts(
  params: ExtractContactsParams,
): Promise<ExtractContactsSummary> {
  const env = loadEnv();
  const databaseId = requireDatabaseId(env);
  const notion = createNotionClient(env.NOTION_API_KEY);

  console.log(`[extract] Notion から has_website 候補を取得中... (limit=${params.limit})`);
  const candidates = await queryHasWebsiteCandidates(notion, databaseId, params.limit);
  console.log(`[extract] ${candidates.length} 件が対象`);

  if (candidates.length === 0) {
    return { candidates: 0, emailFound: 0, formOnly: 0, noContact: 0, errors: 0 };
  }

  let emailFound = 0;
  let formOnly = 0;
  let noContact = 0;
  let errors = 0;

  const limit = pLimit(params.concurrency ?? 3);

  await Promise.all(
    candidates.map((c) =>
      limit(async () => {
        try {
          const result = await extractContacts(c.website);
          const status = result.email ? 'EMAIL' : result.contactFormUrl ? 'FORM' : 'NONE';
          console.log(
            `[extract] ${status.padEnd(5)} ${c.name} <${c.website}> → ${result.email ?? result.contactFormUrl ?? '(なし)'}`,
          );

          if (result.email) emailFound++;
          else if (result.contactFormUrl) formOnly++;
          else noContact++;

          if (!params.dryRun) {
            await updateContact(notion, c.pageId, {
              email: result.email,
              contactFormUrl: result.contactFormUrl,
              note: result.note,
            });
          }
        } catch (err) {
          errors++;
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[extract] エラー ${c.name} <${c.website}>: ${msg}`);
        }
      }),
    ),
  );

  return {
    candidates: candidates.length,
    emailFound,
    formOnly,
    noContact,
    errors,
  };
}
