import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'fs'

// Build the Worker
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  target: 'esnext',
  outfile: 'dist/index.js',
  platform: 'neutral',
  external: ['cloudflare:workers'],
})

console.log('✅ Worker built successfully')
