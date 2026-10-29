import { build } from 'esbuild';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { proposalSchema } from './src/model.mjs';

await rm(new URL('./dist', import.meta.url), { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/extension.mjs'], outfile: 'dist/extension.cjs',
  bundle: true, platform: 'node', format: 'cjs', external: ['vscode'], target: 'node20',
});
await build({
  entryPoints: { review: 'src/webview.jsx' }, outdir: 'dist/webview',
  bundle: true, platform: 'browser', format: 'esm',
  minify: true, target: 'es2022', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
});
await writeFile('proposal.schema.json', `${JSON.stringify(z.toJSONSchema(proposalSchema), null, 2)}\n`);
