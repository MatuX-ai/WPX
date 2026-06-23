const fs = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow } = require('electron')

const rootDir = path.resolve(__dirname, '..')
const indexHtml = path.join(rootDir, 'wpx-app', 'dist', 'index.html')
const outFile = path.join(rootDir, 'smoke-result.json')

let failed = false
const logs = []

function log(msg) {
  logs.push(msg)
  console.log(msg)
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(rootDir, 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.webContents.on('console-message', (_e, _level, message) => {
    if (/init_\w+_esm_bundler is not defined/i.test(message)) {
      log(`[renderer-error] ${message}`)
      failed = true
    }
  })

  win.webContents.on('did-fail-load', (_e, code, desc) => {
    log(`[did-fail-load] ${code} ${desc}`)
    failed = true
  })

  try {
    await win.loadFile(indexHtml, { search: 'windowId=1' })
    await new Promise((r) => setTimeout(r, 8000))
    const pageState = await win.webContents.executeJavaScript(`({
      hasApp: !!document.querySelector('#app')?.innerHTML?.trim(),
      title: document.title,
    })`)
    log(`[smoke] page state: ${JSON.stringify(pageState)}`)
    const ok = pageState.hasApp && !failed
    fs.writeFileSync(
      outFile,
      JSON.stringify({ ok, failed, pageState, logs }, null, 2),
      'utf8',
    )
    app.exit(ok ? 0 : 1)
  } catch (err) {
    log(`[smoke] exception: ${err?.stack || err}`)
    fs.writeFileSync(outFile, JSON.stringify({ ok: false, error: String(err), logs }, null, 2))
    app.exit(1)
  }
})
