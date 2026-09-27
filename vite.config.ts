/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

function staticFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? staticFiles(p) : [relative('static', p).replaceAll('\\', '/')]
  })
}

/** Ustvari precache.json z vsemi datotekami builda in static/ (za service worker). */
function precache(): Plugin {
  return {
    name: 'precache',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = [...Object.keys(bundle), ...staticFiles('static')].filter((f) => f !== 'sw.js' && f !== 'precache.json')
      this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(files) })
    },
  }
}

export default defineConfig({
  base: './', // deluje na github.io/<repo>/ in lokalno
  plugins: [svelte(), precache()],
  publicDir: 'static',
  define: { __BUILD__: JSON.stringify(Date.now().toString(36)) },
  test: { include: ['src/**/*.test.ts'] },
})
