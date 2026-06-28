// Verify the dist has no @copilotkit/vue/v2 bare specifier left after fix
import { spawn } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const distAssets = 'i:\\WPX\\wpx-app\\dist\\assets'

const files = readdirSync(distAssets).filter((f) => f.endsWith('.js'))
console.log(`Total .js files in dist/assets: ${files.length}`)

let bareHits = []
for (const file of files) {
  const full = join(distAssets, file)
  const stat = statSync(full)
  if (stat.size > 5 * 1024 * 1024) continue  // skip very large for speed
  const child = spawn('G:\\nodejs\\node.exe', [
    '-e',
    `const fs = require('node:fs'); const s = fs.readFileSync(${JSON.stringify(full)}, 'utf8'); if (s.includes('@copilotkit/vue/v2')) { const idx = s.indexOf('@copilotkit/vue/v2'); console.log(JSON.stringify({file: ${JSON.stringify(file)}, snippet: s.slice(Math.max(0, idx - 80), idx + 100)})); }`,
  ], { stdio: ['ignore', 'pipe', 'ignore'], shell: false })
  let out = ''
  child.stdout.on('data', (d) => (out += d.toString()))
  await new Promise((r) => child.on('exit', r))
  if (out.trim()) bareHits.push(out.trim())
}

console.log('\n=== Files containing "@copilotkit/vue/v2" (raw search) ===')
if (bareHits.length === 0) {
  console.log('NONE — fix successful')
} else {
  for (const h of bareHits) console.log(h)
}

// Also check for any bare specifier import
console.log('\n=== Checking all .js for bare specifier imports ===')
const child = spawn(
  'G:\\nodejs\\node.exe',
  ['-e',
   `const fs = require('node:fs'); const path = require('node:path'); const dir = ${JSON.stringify(distAssets)}; const re = /from["'](@[^./][^"']*)["']/g; for (const f of fs.readdirSync(dir)) { if (!f.endsWith('.js')) continue; const s = fs.readFileSync(path.join(dir, f), 'utf8'); let m; while ((m = re.exec(s))) { console.log(f + ': ' + m[1]); if (m.index > 1e6) break; } }`,
  ],
  { stdio: ['ignore', 'pipe', 'pipe'], shell: false },
)
let stdout = ''
let stderr = ''
child.stdout.on('data', (d) => (stdout += d.toString()))
child.stderr.on('data', (d) => (stderr += d.toString()))
const exitCode = await new Promise((r) => child.on('exit', r))
console.log(stdout || 'NONE — all imports are relative')
if (stderr) console.error(stderr)