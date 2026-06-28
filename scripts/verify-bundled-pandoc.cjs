/**
 * 验证脚本：在 dev 模式下 export-routes.js 能正确找到 bundled pandoc.exe
 * 模拟：app.isPackaged === false，从项目根 resources/bin/pandoc/ 查找
 */
const fs = require('node:fs')
const path = require('node:path')

// 模拟 export-routes.js 中的逻辑
const PROJECT_ROOT = path.join(__dirname, '..')
const binaryName = process.platform === 'win32' ? 'pandoc.exe' : 'pandoc'

const candidates = [
  path.join(PROJECT_ROOT, 'resources', 'bin', 'pandoc', binaryName),
  path.join(PROJECT_ROOT, 'resources', 'pandoc', binaryName),
]

console.log('=== PROJECT_ROOT ===', PROJECT_ROOT)
console.log('=== Candidates ===')
candidates.forEach((c) => {
  const exists = fs.existsSync(c)
  console.log(`  ${exists ? 'OK ' : 'X  '} ${c}`)
})

const found = candidates.find((c) => fs.existsSync(c)) ?? null
console.log('=== Resolved ===')
console.log(`  ${found ?? '(none, will fall back to PATH)'}`)

if (!found) {
  console.error('FAIL: pandoc.exe not found in dev resources!')
  process.exit(1)
}

// 直接 execFile 验证可用
const { execFile } = require('node:child_process')
execFile(found, ['--version'], (error, stdout) => {
  if (error) {
    console.error('FAIL: pandoc --version failed:', error.message)
    process.exit(1)
  }
  console.log('=== pandoc --version ===')
  console.log(stdout.split('\n').slice(0, 5).join('\n'))
  console.log('PASS')
})
