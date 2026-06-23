/**
 * WPX Electron builder - programmatic invocation
 * 使用 Node.js 直接调用 electron-builder API，避免 PowerShell 输出问题
 */
import { build } from 'electron-builder'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

console.log('=== WPX Electron Build ===')
console.log('Project Root:', projectRoot)
console.log('Platform: win32')
console.log('')

async function main() {
  try {
    const result = await build({
      projectDir: projectRoot,
      platform: 'win32',
      config: {
        npmRebuild: false,
      },
      publish: null,
    })

    console.log('')
    console.log('=== Build Complete! ===')
    console.log(JSON.stringify(result, null, 2))
    
    // List output files
    const fs = await import('node:fs')
    const releaseDir = path.join(projectRoot, 'release')
    if (fs.existsSync(releaseDir)) {
      console.log('')
      console.log('=== Release Files ===')
      const files = fs.readdirSync(releaseDir, { recursive: true, withFileTypes: true })
      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(file.path, file.name)
          const stats = fs.statSync(filePath)
          console.log(`  ${file.name.padEnd(50)} ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
        }
      }
    }
  } catch (error) {
    console.error('')
    console.error('=== Build Failed! ===')
    console.error(error)
    process.exit(1)
  }
}

main()
