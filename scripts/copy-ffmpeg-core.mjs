// Copies the @ffmpeg/core wasm runtime into public/ so the app can load it
// from the same origin instead of a third-party CDN (more reliable, works
// offline in dev, and avoids depending on unpkg/jsdelivr being reachable).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const srcDir = join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm')
const destDir = join(root, 'public', 'ffmpeg-core')

const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm']

if (!existsSync(srcDir)) {
  console.warn(`[copy-ffmpeg-core] Source directory not found: ${srcDir}. Skipping.`)
  process.exit(0)
}

mkdirSync(destDir, { recursive: true })

for (const file of files) {
  const src = join(srcDir, file)
  const dest = join(destDir, file)
  if (!existsSync(src)) {
    console.warn(`[copy-ffmpeg-core] Missing ${src}, skipping.`)
    continue
  }
  copyFileSync(src, dest)
  console.log(`[copy-ffmpeg-core] Copied ${file} -> public/ffmpeg-core/`)
}
