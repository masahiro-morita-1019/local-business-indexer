import { loadEnv, requireParentPageId } from '../src/config.ts';
import { createNotionClient } from '../src/notion/client.ts';
import { databaseProperties } from '../src/notion/schema.ts';

/**
 * Notion ページURLに含まれる "Title-32文字ID" のうち、末尾32文字だけを取り出す。
 * UUIDハイフン付き形式(8-4-4-4-12)もそのまま許容。
 */
function normalizePageId(raw: string): string {
  const trimmed = raw.trim();
  // 既にハイフン付き UUID 形式ならそのまま
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed;
  }
  // 末尾の32文字16進を抽出
  const m = trimmed.match(/([0-9a-f]{32})$/i);
  if (m?.[1]) return m[1];
  throw new Error(
    [
      `NOTION_PARENT_PAGE_ID の形式が不正です: "${raw}"`,
      'Notion ページURLの末尾の32文字英数(または UUID 形式)を指定してください。',
      '例) https://www.notion.so/Workspace/Title-363907b1259b807ba2b0f7ba6c0b34af → 363907b1259b807ba2b0f7ba6c0b34af',
    ].join('\n'),
  );
}

function isObjectNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'object_not_found'
  );
}

async function main(): Promise<void> {
  const env = loadEnv();
  const parentPageId = normalizePageId(requireParentPageId(env));
  const notion = createNotionClient(env.NOTION_API_KEY);

  console.log(`[setup] 親ページ ${parentPageId} 配下に DB を作成します...`);

  let res: Awaited<ReturnType<typeof notion.databases.create>>;
  try {
    res = await notion.databases.create({
      parent: { type: 'page_id', page_id: parentPageId },
      title: [{ type: 'text', text: { content: 'Local Business Indexer' } }],
      properties: databaseProperties,
    });
  } catch (err) {
    if (isObjectNotFound(err)) {
      const original = err instanceof Error ? err.message : String(err);
      throw new Error(
        [
          '親ページが見つかりません。以下を確認してください:',
          '  1. NOTION_PARENT_PAGE_ID が正しい(URLの末尾32文字)',
          '  2. Notion で対象ページを開き、右上 "..." メニュー → "Connections" / "コネクト" から',
          '     インテグレーションを接続済みである',
          '',
          `元のエラー: ${original}`,
        ].join('\n'),
      );
    }
    throw err;
  }

  console.log('\n[setup] 作成完了。');
  console.log(`database_id : ${res.id}`);
  console.log(`URL         : ${'url' in res ? res.url : '(URL取得不可)'}`);
  console.log('\n.env に以下を追記してください:\n');
  console.log(`NOTION_DATABASE_ID=${res.id}\n`);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[setup] 失敗: ${msg}`);
  process.exit(1);
});
