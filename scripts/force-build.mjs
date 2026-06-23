/**
 * 强制运行 electron-builder，所有输出写入文件
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const projectRoot = path.resolve(import.meta.dirname, '..')
const cliPath = path.join(projectRoot, 'node_modules', 'electron-builder', 'cli.js')
const logFile = path.join(projectRoot, 'build-electron.log')

const startTime = Date.now()

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  fs.appendFileSync(logFile, line + '\n')
  console.log(line)
}

log('=== WPX Electron Builder (force) ===')
log(`Project root: ${projectRoot}`)
log(`CLI path: ${cliPath}`)
log(`npmRebuild: false (in package.json)`)

// Run electron-builder
const child = spawn(process.execPath, [cliPath, '--win', '--config'], {
  cwd: projectRoot,
  env: {
    ...process.env,
    ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/',
    ELECTRON_BUILDER_BINARIES_MIRROR: 'https://npmmirror.com/mirrors/electron-builder-binaries/',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
})

let output = ''
child.stdout.on('data', (data) => {
  output += data.toString()
  fs.appendFileSync(logFile, data.toString())
})
child.stderr.on('data', (data) => {
  output += data.toString()
  fs.appendFileSync(logFile, '[STDERR] ' + data.toString())
})

child.on('error', (err) => {
  log(`Spawn error: ${err.message}`)
  log(`Error code: ${err.code}`)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  log(`Exit code: ${code}, signal: ${signal}, elapsed: ${elapsed}s`)

  if (code === 0) {
    log('=== Build Successful! ===')
    
    // List release files
    const releaseDir = path.join(projectRoot, 'release')
    if (fs.existsSync(releaseDir)) {
      log('=== Release Files ===')
      const entries = fs.readdirSync(releaseDir, { recursive: true, withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile()) {
          const fp = path.join(entry.path, entry.name)
          const stat = fs.statSync(fp)
          log(`  ${entry.name.padEnd(50)} ${(stat.size / 1024 / 1024).toFixed(2)} MB (${fp})`)
        }
      }
    } else {
      log('release/ directory not found')
    }
  } else {
    log(`=== Build Failed (exit code ${code}) ===`)
  }
  
  // Also dump output to console
  log('=== Full Output ===')
  log(output.slice(-5000))
})
