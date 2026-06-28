// WPX 安装包白屏冒烟测试：直接启动 win-unpacked/WPX.exe（与安装包相同的二进制）
// 加载 asar 中的真实 index.html，捕获渲染状态、错误、console 输出

import { spawn } from 'node:child_process'
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const wpxExe = 'i:\\WPX\\release\\win-unpacked\\WPX.exe'
const resultFile = 'i:\\WPX\\wpx-smoke-result.json'

if (existsSync(resultFile)) unlinkSync(resultFile)

console.log(`Launching ${wpxExe} ...`)
const child = spawn(wpxExe, [], {
  cwd: 'i:\\WPX\\release\\win-unpacked',
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
})

let stdout = ''
let stderr = ''
child.stdout.on('data', (d) => {
  const s = d.toString()
  stdout += s
  process.stdout.write(s)
})
child.stderr.on('data', (d) => {
  const s = d.toString()
  stderr += s
  process.stderr.write(s)
})

const timeout = setTimeout(() => {
  console.log('\n[smoke] Timeout 30s, killing child process')
  try {
    child.kill('SIGKILL')
  } catch {}
}, 30000)

child.on('exit', (code, signal) => {
  clearTimeout(timeout)
  console.log(`\n[smoke] WPX.exe exited code=${code} signal=${signal}`)

  // Look for the result file that may have been written by another mechanism
  // But we didn't install one - so just log what we have
  const result = {
    exitCode: code,
    signal,
    stdoutTail: stdout.slice(-3000),
    stderrTail: stderr.slice(-3000),
  }
  writeFileSync(resultFile, JSON.stringify(result, null, 2), 'utf8')
  console.log('\nResult written to', resultFile)
  process.exit(code ?? (signal ? 2 : 0))
})