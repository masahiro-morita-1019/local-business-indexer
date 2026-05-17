import { loadEnv, requireDatabaseId } from '../src/config.ts';
import { createNotionClient } from '../src/notion/client.ts';
import { databaseProperties } from '../src/notion/schema.ts';

/**
 * 既存の Notion DB に schema.ts で定義された未登録プロパティを追加する。
 * 既に存在するプロパティは Notion 側が無視するため idempotent。
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const databaseId = requireDatabaseId(env);
  const notion = createNotionClient(env.NOTION_API_KEY);

  console.log(`[migrate] DB ${databaseId} に schema.ts のプロパティ定義を適用します...`);

  const current = await notion.databases.retrieve({ database_id: databaseId });
  const existing = new Set(Object.keys(current.properties));

  const toAdd = Object.entries(databaseProperties).filter(([name]) => !existing.has(name));

  if (toAdd.length === 0) {
    console.log('[migrate] 追加対象なし。schema は最新です。');
    return;
  }

  console.log(`[migrate] 追加: ${toAdd.map(([n]) => n).join(', ')}`);

  await notion.databases.update({
    database_id: databaseId,
    properties: Object.fromEntries(toAdd) as Record<string, (typeof databaseProperties)[string]>,
  });

  console.log('[migrate] 完了。');
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[migrate] 失敗: ${msg}`);
  process.exit(1);
});
