import { spawn } from 'node:child_process'

const asarPath = 'i:\\WPX\\release\\win-unpacked\\resources\\app.asar'

const child = spawn(
  'G:\\nodejs\\node.exe',
  ['i:\\WPX\\node_modules\\@electron\\asar\\bin\\asar.js', 'list', asarPath],
  { stdio: ['ignore', 'pipe', 'pipe'], shell: false },
)
let stdout = ''
child.stdout.on('data', (d) => (stdout += d.toString()))

const exitCode = await new Promise((resolve, reject) => {
  child.on('error', reject)
  child.on('exit', (code) => resolve(code ?? -1))
})

const lines = stdout.split(/\r?\n/).filter(Boolean)
console.log(`Total entries: ${lines.length}`)

// Check top-level directories
const topLevel = new Set()
for (const f of lines) {
  const root = f.replace(/^\\/, '').split('\\')[0]
  topLevel.add(root)
}
console.log('\n=== Top-level directories ===')
for (const t of [...topLevel].sort()) {
  const count = lines.filter((f) => f.replace(/^\\/, '').startsWith(t + '\\')).length
  console.log(`  ${t}: ${count} entries`)
}

console.log('\n=== electron/ entries (first 30) ===')
const electronEntries = lines.filter((f) => f.replace(/^\\/, '').startsWith('electron\\')).slice(0, 30)
for (const e of electronEntries) console.log(`  ${e}`)

console.log('\n=== wpx-app/ entries (first 20) ===')
const wpxAppEntries = lines.filter((f) => f.replace(/^\\/, '').startsWith('wpx-app\\')).slice(0, 20)
for (const e of wpxAppEntries) console.log(`  ${e}`)

console.log('\n=== Checking for index.html anywhere ===')
const indexFiles = lines.filter((f) => f.toLowerCase().endsWith('index.html'))
for (const e of indexFiles) console.log(`  ${e}`)

console.log('\n=== resources/ entries ===')
const resourcesEntries = lines.filter((f) => f.replace(/^\\/, '').startsWith('resources\\')).slice(0, 20)
for (const e of resourcesEntries) console.log(`  ${e}`)