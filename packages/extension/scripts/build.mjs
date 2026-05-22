import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const distAssets = path.join(dist, 'assets');
const watchMode = process.argv.includes('--watch');

async function copyStatic() {
  await mkdir(path.join(dist, 'ui'), { recursive: true });
  await cp(path.join(root, 'public', 'manifest.json'), path.join(dist, 'manifest.json'));
  await cp(path.join(root, 'ui', 'popup', 'index.html'), path.join(dist, 'ui', 'popup.html'));
  await cp(
    path.join(root, 'ui', 'sidepanel', 'index.html'),
    path.join(dist, 'ui', 'sidepanel.html'),
  );
  await cp(path.join(root, 'ui', 'popup', 'main.js'), path.join(dist, 'ui', 'popup.js'));
  await cp(path.join(root, 'ui', 'sidepanel', 'main.js'), path.join(dist, 'ui', 'sidepanel.js'));
  await cp(path.join(root, 'style.css'), path.join(dist, 'ui', 'style.css'));
}

async function run() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(distAssets, { recursive: true });
  await copyStatic();

  const common = {
    bundle: true,
    platform: 'browser',
    target: ['chrome114'],
    sourcemap: true,
    logLevel: 'info',
  };

  const backgroundOptions = {
    ...common,
    format: 'esm',
    entryPoints: [path.join(root, 'background', 'index.ts')],
    outfile: path.join(distAssets, 'background.js'),
  };

  const contentOptions = {
    ...common,
    format: 'iife',
    entryPoints: [path.join(root, 'content', 'index.ts')],
    outfile: path.join(distAssets, 'content.js'),
  };

  if (watchMode) {
    const bg = await esbuild.context(backgroundOptions);
    const ct = await esbuild.context(contentOptions);
    await bg.watch();
    await ct.watch();
    console.log('Extension watch mode started.');
    return;
  }

  await esbuild.build(backgroundOptions);
  await esbuild.build(contentOptions);
  console.log('Extension build complete.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
