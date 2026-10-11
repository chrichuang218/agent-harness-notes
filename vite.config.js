import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export default defineConfig({
  root: 'site',
  base: './',
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  plugins: [{
    name: 'deployment-identity',
    generateBundle() {
      const { version } = JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf8'));
      const commit = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({ version, commit }) + '\n' });
    },
  }],
});
