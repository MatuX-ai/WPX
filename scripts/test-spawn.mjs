// 测试在沙箱环境中 node 进程能否 spawn cmd.exe / node.exe
import { spawn } from 'node:child_process'

function test(name, cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const start = Date.now()
    console.log(`\n--- Test: ${name} ---`)
    console.log(`> ${cmd} ${args.join(' ')}`)
    let child
    try {
      child = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        encoding: 'utf8',
        ...opts,
      })
    } catch (e) {
      console.log(`SYNC THROW: ${e.message}`)
      resolve({ name, ok: false, reason: 'sync-throw' })
      return
    }

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d) => (stdout += d.toString()))
    child.stderr?.on('data', (d) => (stderr += d.toString()))

    child.on('error', (e) => {
      console.log(`ERROR event: code=${e.code} msg=${e.message}`)
      resolve({ name, ok: false, reason: e.code || e.message, stdout, stderr })
    })

    child.on('exit', (code, signal) => {
      const elapsed = Date.now() - start
      console.log(`EXIT: code=${code} signal=${signal} (${elapsed}ms)`)
      if (stdout) console.log(`STDOUT: ${stdout.slice(0, 200)}`)
      if (stderr) console.log(`STDERR: ${stderr.slice(0, 200)}`)
      resolve({ name, ok: code === 0, code, signal, stdout, stderr })
    })
  })
}

const tests = [
  ['cmd.exe /c echo hi', 'cmd.exe', ['/c', 'echo', 'hi']],
  ['cmd.exe /c node -v', 'cmd.exe', ['/c', 'G:\\nodejs\\node.exe', '-v']],
  ['node -v (no args)', 'G:\\nodejs\\node.exe', ['-v']],
  ['npm.cmd --version (shell:true)', 'G:\\nodejs\\npm.cmd', ['--version'], { shell: true }],
  ['node 调 npm.js --version', 'G:\\nodejs\\node.exe', ['G:\\nodejs\\node_modules\\npm\\bin\\npm-cli.js', '--version']],
]

const results = []
for (const [name, cmd, args, opts] of tests) {
  const r = await test(name, cmd, args, opts || {})
  results.push(r)
}

console.log('\n========= SUMMARY =========')
for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.name} -> ${r.reason || `code=${r.code}`}`)
}
