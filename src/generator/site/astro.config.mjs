import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Phase 3 (デプロイ) で書き出し先を整理しやすくするためルート直下の dist/generated-sites に出す。
  outDir: '../../../dist/generated-sites',
  integrations: [react()],
  // Phase 2 では静的サイト生成のみを目的とする(動的SSRは不要)。
  output: 'static',
  // ローカルプレビュー UI でも本番ビルドと同じパス構造を見たいので、ベースURLは無指定(=ルート)。
});
