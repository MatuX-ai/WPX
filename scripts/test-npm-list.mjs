// 模拟 electron-builder 的 streamCollectorCommandToFile 调用
import { spawn } from 'node:child_process'
import { createWriteStream, readFileSync } from 'node:fs'

const command = 'G:\\nodejs\\npm.CMD'
const args = ['list', '-a', '--include', 'prod', '--include', 'optional', '--omit', 'dev', '--json', '--long', '--silent', '--loglevel=error']
const cwd = 'i:\\WPX'
const tempOutputFile = 'i:\\WPX\\test-npm-list-output.json'

console.log(`> spawn ${command} ${args.join(' ')}`)
console.log(`  cwd=${cwd}`)

const outStream = createWriteStream(tempOutputFile)
const child = spawn(command, args, {
  cwd,
  shell: true,
  env: { COREPACK_ENABLE_STRICT: '0', ...process.env },
})

let stderr = ''
child.stdout.pipe(outStream)
child.stderr.on('data', (chunk) => {
  stderr += chunk.toString()
})

child.on('error', (err) => {
  console.log(`[ERROR] code=${err.code} msg=${err.message}`)
  process.exit(1)
})

child.on('close', (code) => {
  console.log(`[CLOSE] code=${code}`)
  console.log(`[STDERR] ${stderr.slice(0, 500)}`)
})

outStream.on('finish', () => {
  console.log(`[FINISH] tempOutputFile written`)
  const out = readFileSync(tempOutputFile, 'utf8')
  console.log(`[OUTPUT length] ${out.length} bytes`)
  console.log(`[OUTPUT preview] ${out.slice(0, 300)}`)
})
