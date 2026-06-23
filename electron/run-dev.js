#!/usr/bin/env node
/**
 * 开发环境 Electron 启动器：设置默认调试环境变量并启动主进程。
 *
 * 用法：
 *   node electron/run-dev.js
 *   node electron/run-dev.js --multi          # 启动 3 个窗口
 *   node electron/run-dev.js --windows=4
 */
const { spawn } = require('node:child_process')
const path = require('node:path')

const projectRoot = path.join(__dirname, '..')

if (!process.env.WPX_DEV_LOG) {
  process.env.WPX_DEV_LOG = '1'
}

if (!process.env.WPX_DEV_AUTO_DEVTOOLS) {
  process.env.WPX_DEV_AUTO_DEVTOOLS = '1'
}

for (const arg of process.argv.slice(2)) {
  if (arg === '--multi') {
    process.env.WPX_DEV_INITIAL_WINDOWS = process.env.WPX_DEV_INITIAL_WINDOWS || '3'
    continue
  }

  if (arg.startsWith('--windows=')) {
    process.env.WPX_DEV_INITIAL_WINDOWS = arg.slice('--windows='.length)
  }
}

const electronBinary = require('electron')
const child = spawn(electronBinary, [projectRoot], {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
