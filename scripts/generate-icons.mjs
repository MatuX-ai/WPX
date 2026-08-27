/**
 * WPX 图标生成脚本
 * 以 public/wpx-icon.png 为唯一源图，生成各子项目所需的 ico/png/icns。
 *
 * 用法：node scripts/generate-icons.mjs
 */

import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SOURCE_PATH = path.join(ROOT, 'public', 'wpx-icon.png')

const SIZES_ICO = [256, 48, 32, 16]
const SIZE_PNG = 512
const SIZE_APPLE = 180

/** @type {string[]} */
const OUTPUT_DIRS = [
  path.join(ROOT, 'wpx-app', 'public'),
  path.join(ROOT, 'public'),
  path.join(ROOT, 'landing', 'public'),
  path.join(ROOT, 'admin', 'public'),
]

const ADMIN_ASSETS_DIR = path.join(ROOT, 'admin', 'src', 'assets')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

/**
 * @param {{ buffer: Buffer, size: number }[]} pngBuffers
 */
function createIco(pngBuffers) {
  const count = pngBuffers.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  let offset = 6 + count * 16
  const entries = []
  const imageData = []

  for (const { buffer, size } of pngBuffers) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(buffer.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    imageData.push(buffer)
    offset += buffer.length
  }

  return Buffer.concat([header, ...entries, ...imageData])
}

/**
 * @param {import('sharp').Sharp} pipeline
 * @param {number} size
 */
async function resizePng(pipeline, size) {
  return pipeline
    .clone()
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .png()
    .toBuffer()
}

async function writeIconSet(outputDir, pipeline) {
  ensureDir(outputDir)

  const png512 = await resizePng(pipeline, SIZE_PNG)
  fs.writeFileSync(path.join(outputDir, 'icon.png'), png512)
  fs.writeFileSync(path.join(outputDir, 'wpx-icon.png'), png512)

  const appleTouch = await resizePng(pipeline, SIZE_APPLE)
  fs.writeFileSync(path.join(outputDir, 'apple-touch-icon.png'), appleTouch)

  const icoEntries = []
  for (const size of SIZES_ICO) {
    icoEntries.push({ buffer: await resizePng(pipeline, size), size })
  }
  fs.writeFileSync(path.join(outputDir, 'favicon.ico'), createIco(icoEntries))
  fs.writeFileSync(path.join(outputDir, 'icon.ico'), createIco(icoEntries))

  const icnsEntries = []
  for (const { type, size } of [
    { type: 'ic07', size: 128 },
    { type: 'ic08', size: 256 },
    { type: 'ic09', size: 512 },
  ]) {
    const pngBuf = await resizePng(pipeline, size)
    const entryHeader = Buffer.alloc(8)
    entryHeader.write(type, 0, 4, 'ascii')
    entryHeader.writeUInt32BE(pngBuf.length + 8, 4)
    icnsEntries.push(Buffer.concat([entryHeader, pngBuf]))
  }
  const icnsBody = Buffer.concat(icnsEntries)
  const icnsHeader = Buffer.alloc(8)
  icnsHeader.write('icns', 0, 4, 'ascii')
  icnsHeader.writeUInt32BE(icnsBody.length + 8, 4)
  fs.writeFileSync(path.join(outputDir, 'icon.icns'), Buffer.concat([icnsHeader, icnsBody]))

  const browserconfig = `<?xml version="1.0" encoding="UTF-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square70x70logo src="/wpx-icon.png"/>
      <square150x150logo src="/wpx-icon.png"/>
      <wide310x150logo src="/wpx-icon.png"/>
      <TileColor>#4F46E5</TileColor>
    </tile>
  </msapplication>
</browserconfig>
`
  fs.writeFileSync(path.join(outputDir, 'browserconfig.xml'), browserconfig)

  const webmanifest = {
    name: 'WPX',
    short_name: 'WPX',
    description: '永久免费的桌面写作工具',
    icons: [
      { src: '/wpx-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
    theme_color: '#4F46E5',
    background_color: '#ffffff',
    display: 'standalone',
    start_url: '/',
  }
  fs.writeFileSync(path.join(outputDir, 'site.webmanifest'), `${JSON.stringify(webmanifest, null, 2)}\n`)
}

async function main() {
  if (!fs.existsSync(SOURCE_PATH)) {
    throw new Error(`源图标不存在：${SOURCE_PATH}`)
  }

  console.log('[icons] Source:', SOURCE_PATH)
  const sourceBuffer = fs.readFileSync(SOURCE_PATH)
  const pipeline = sharp(sourceBuffer)

  for (const dir of OUTPUT_DIRS) {
    console.log('[icons] Writing:', dir)
    await writeIconSet(dir, pipeline)
  }

  ensureDir(ADMIN_ASSETS_DIR)
  const adminLogo = await resizePng(pipeline, 256)
  fs.writeFileSync(path.join(ADMIN_ASSETS_DIR, 'wpx-icon.png'), adminLogo)
  console.log('[icons] Writing:', path.join(ADMIN_ASSETS_DIR, 'wpx-icon.png'))

  console.log('[icons] All icons generated from public/wpx-icon.png')
}

main().catch((err) => {
  console.error('[icons] Error:', err)
  process.exit(1)
})
