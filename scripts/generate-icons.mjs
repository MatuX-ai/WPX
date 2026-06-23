/**
 * WPX 图标生成脚本
 * 将 wpx-app/public/favicon.svg 转换为：
 *   - icon.png (512x512)
 *   - icon.ico (多尺寸：256, 48, 32, 16)
 *   - icon.icns (macOS 使用，实际为 512x512 PNG，macOS 会接受)
 */

import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.resolve(__dirname, '..', 'wpx-app', 'public')
const SVG_PATH = path.join(PUBLIC_DIR, 'favicon.svg')

const SIZES_ICO = [256, 48, 32, 16]
const SIZE_PNG = 512
const SIZE_ICNS = 512

/**
 * 生成 ICO 文件（嵌入 PNG 数据）
 * ICO file format: https://en.wikipedia.org/wiki/ICO_(file_format)
 */
function createIco(pngBuffers) {
  const count = pngBuffers.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)     // reserved
  header.writeUInt16LE(1, 2)     // ICO type = 1
  header.writeUInt16LE(count, 4) // number of images

  // Directory entries (16 bytes each)
  let offset = 6 + count * 16
  const entries = []
  const imageData = []

  for (const [i, { buffer, size }] of pngBuffers.entries()) {
    const entry = Buffer.alloc(16)
    // If size >= 256, write 0 (ICO format limitation)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)   // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1)   // height
    entry.writeUInt8(0, 2)  // colors (0 = 256)
    entry.writeUInt8(0, 3)  // reserved
    entry.writeUInt16LE(1, 4)  // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(buffer.length, 8) // image data size
    entry.writeUInt32LE(offset, 12) // image data offset
    entries.push(entry)
    imageData.push(buffer)
    offset += buffer.length
  }

  return Buffer.concat([header, ...entries, ...imageData])
}

async function main() {
  console.log('[icons] Reading SVG:', SVG_PATH)
  const svgBuffer = fs.readFileSync(SVG_PATH)

  // Generate PNG at 512x512
  console.log('[icons] Generating icon.png (512x512)...')
  const png512 = await sharp(svgBuffer)
    .resize(SIZE_PNG, SIZE_PNG, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  const pngPath = path.join(PUBLIC_DIR, 'icon.png')
  fs.writeFileSync(pngPath, png512)
  console.log(`[icons] ✓ icon.png (${(png512.length / 1024).toFixed(1)} KB)`)

  // Generate ICO with multiple sizes
  console.log('[icons] Generating icon.ico...')
  const icoEntries = []
  for (const size of SIZES_ICO) {
    const buffer = await sharp(svgBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    icoEntries.push({ buffer, size })
  }

  const icoBuffer = createIco(icoEntries)
  const icoPath = path.join(PUBLIC_DIR, 'icon.ico')
  fs.writeFileSync(icoPath, icoBuffer)
  console.log(`[icons] ✓ icon.ico (${(icoBuffer.length / 1024).toFixed(1)} KB)`)

  // Generate ICNS (macOS) - macOS can use a PNG as app icon if we name it correctly
  // For electron-builder, icon.icns needs to be a real ICNS file.
  // We'll create a minimal ICNS wrapper around the 512x512 PNG.
  // ICNS format: https://en.wikipedia.org/wiki/Apple_Icon_Image_format
  console.log('[icons] Generating icon.icns (512x512 PNG in ICNS container)...')
  
  // For practical purposes, electron-builder on macOS can also accept a PNG
  // But since we specified icon.icns in the config, we need to provide it.
  // The simplest approach: create a valid ICNS with ic07 (128x128) and ic08 (256x256) and ic09 (512x512) entries
  // Actually, let's just create a PNG that looks like ICNS enough for electron-builder to process
  // OR we can use the png2icns approach
  
  // Simpler: let's create separate PNGs and use them
  // For macOS, electron-builder can work with a PNG if we configure it properly
  // But to keep it simple, let's write the PNG as icon.icns for now
  // Real ICNS conversion would need a separate tool
  
  // Actually, let's create a proper ICNS with embedded PNG data
  const iconset = [
    { type: 'ic07', size: 128 },
    { type: 'ic08', size: 256 },
    { type: 'ic09', size: 512 },
  ]
  
  const icnsEntries = []
  for (const { type, size } of iconset) {
    const pngBuf = await sharp(svgBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    
    // ICNS entry: type (4 bytes) + size (4 bytes big-endian) + data
    const entryHeader = Buffer.alloc(8)
    entryHeader.write(type, 0, 4, 'ascii')
    entryHeader.writeUInt32BE(pngBuf.length + 8, 4) // total entry size including header
    icnsEntries.push(Buffer.concat([entryHeader, pngBuf]))
  }
  
  // ICNS header: 'icns' (4 bytes) + total file size (4 bytes big-endian)
  const icnsBody = Buffer.concat(icnsEntries)
  const icnsHeader = Buffer.alloc(8)
  icnsHeader.write('icns', 0, 4, 'ascii')
  icnsHeader.writeUInt32BE(icnsBody.length + 8, 4)
  
  const icnsBuffer = Buffer.concat([icnsHeader, icnsBody])
  const icnsPath = path.join(PUBLIC_DIR, 'icon.icns')
  fs.writeFileSync(icnsPath, icnsBuffer)
  console.log(`[icons] ✓ icon.icns (${(icnsBuffer.length / 1024).toFixed(1)} KB)`)

  console.log('[icons] All icons generated successfully!')
}

main().catch((err) => {
  console.error('[icons] Error:', err)
  process.exit(1)
})
