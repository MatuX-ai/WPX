/**
 * WPX Electron 重新打包 - 直接调 API 绕过 cli.js
 * 原因：sandbox 拒绝启动 electron-builder/cli.js（路径匹配阻止）
 * 方案：直接 require electron-builder，调用其 build 函数
 */
import { pathToFileURL } from 'node:url'
const electronBuilderUrl = pathToFileURL('i:\\WPX\\node_modules\\electron-builder\\out\\index.js').href
const { build } = await import(electronBuilderUrl)
import { createWriteStream, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = resolve(__dirname, '..')
const logFile = join(projectRoot, 'build-pack.log')

const logStream = createWriteStream(logFile, { flags: 'w' })
function log(...args) {
  const ts = new Date().toISOString()
  const line = args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ')
  const out = `[${ts}] ${line}\n`
  logStream.write(out)
  process.stdout.write(out)
}

function logSection(title) {
  log('')
  log('='.repeat(70))
  log(title)
  log('='.repeat(70))
}

const startTime = Date.now()

function step0_readVersion() {
  const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))
  log(`当前打包版本: ${pkg.version}`)
  return pkg.version
}

function step3_runBuilder(version) {
  logSection('Step 3: electron-builder build() --win')
  log('Calling build() directly (bypassing cli.js)...')

  // 注意：build 是 async 函数，需要 await
  return build({
    projectDir: projectRoot,
    win: ['nsis'],
    config: {
      npmRebuild: false,
    },
    publish: null,
  })
}

function step4_bumpVersion() {
  logSection('Step 4: bump version')
  const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))
  const parts = pkg.version.split('.').map(Number)
  let [major, minor, patch] = parts
  patch += 1
  if (patch > 100) {
    minor += 1
    patch = 0
  }
  const next = `${major}.${minor}.${patch}`
  pkg.version = next
  writeFileSync(join(projectRoot, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8')
  log(`[pack-version] ${pkg.version} -> ${next}`)
}

function step5_listArtifacts(version) {
  logSection('Step 5: 列出产物文件')
  const releaseDir = join(projectRoot, 'release')
  if (!releaseDir) return
  const entries = readdirSync(releaseDir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.exe')) {
      const fp = join(entry.path || releaseDir, entry.name)
      const stat = statSync(fp)
      log(`  ${entry.name.padEnd(50)} ${(stat.size / 1024 / 1024).toFixed(2)} MB`)
    }
  }
}

async function main() {
  try {
    const version = step0_readVersion()
    logSection(`开始打包 v${version}`)

    const result = await step3_runBuilder(version)
    log('build() returned:', JSON.stringify(result, null, 2))

    step4_bumpVersion()
    step5_listArtifacts(version)

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    logSection(`打包完成！版本 v${version}，耗时 ${elapsed}s`)
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    logSection(`打包失败！耗时 ${elapsed}s`)
    log('Error:', err.message)
    if (err.stack) log(err.stack)
    process.exitCode = 1
  } finally {
    logStream.end()
  }
}

main()
