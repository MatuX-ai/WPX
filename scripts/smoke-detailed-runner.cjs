// Detailed smoke runner: loads dist/index.html, captures ALL console messages
// and webContents errors, then reports renderer state for white-screen diagnosis.

const fs = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow } = require('electron')

const rootDir = path.resolve(__dirname, '..')
const indexHtml = path.join(rootDir, 'wpx-app', 'dist', 'index.html')
const outFile = path.join(rootDir, 'wpx-smoke-detailed.json')

const logs = []
function log(...args) {
  const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
  logs.push(msg)
  console.log(msg)
}

app.whenReady().then(async () => {
  log('[smoke] app ready, creating BrowserWindow...')

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(rootDir, 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    // level: 0=verbose, 1=info, 2=warning, 3=error
    const lvlName = ['verbose', 'info', 'warning', 'error'][level] || 'log'
    log(`[console:${lvlName}] ${message}`)
    if (sourceId) log(`  at ${sourceId}:${line}`)
  })

  win.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    log(`[did-fail-load] code=${code} desc=${desc} url=${url} mainFrame=${isMainFrame}`)
  })

  win.webContents.on('preload-error', (_e, preloadPath, err) => {
    log(`[preload-error] ${preloadPath}: ${err && err.message}`)
  })

  win.webContents.on('render-process-gone', (_e, details) => {
    log(`[render-process-gone] reason=${details.reason} exitCode=${details.exitCode}`)
  })

  win.webContents.on('dom-ready', () => {
    log('[event] dom-ready')
  })

  win.webContents.on('did-finish-load', () => {
    log('[event] did-finish-load')
  })

  try {
    log('[smoke] loading file:', indexHtml)
    const searchParams = new URLSearchParams({ windowId: '1' }).toString()
    await win.loadFile(indexHtml, { search: searchParams })
    log('[smoke] loadFile resolved')

    // Wait 8 seconds for Vue mount
    await new Promise((r) => setTimeout(r, 8000))

    const state = await win.webContents.executeJavaScript(`(() => {
      try {
        return {
          hasAppEl: !!document.getElementById('app'),
          appHtml: document.getElementById('app')?.innerHTML?.slice(0, 200) ?? null,
          appHtmlLength: document.getElementById('app')?.innerHTML?.length ?? 0,
          title: document.title,
          url: location.href,
          hash: location.hash,
          usesHashRouter: location.hash.startsWith('#/'),
          hasElectronApi: !!window.electronAPI,
          hasWpxElectronFlag: !!window.__WPX_ELECTRON__,
          electronApiKeys: window.electronAPI ? Object.keys(window.electronAPI) : null,
          hasLocalServerGetBaseUrl: !!(window.electronAPI?.localServer?.getBaseUrl),
          scriptCount: document.querySelectorAll('script').length,
          errorEventCount: window.__errorCount__ || 0,
        }
      } catch (e) {
        return { inspectError: String(e) }
      }
    })()`)

    log('[smoke] page state:', JSON.stringify(state, null, 2))

    const result = {
      ok: !!(state.hasAppEl && state.appHtmlLength > 0),
      state,
      logs,
    }
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf8')
    log('[smoke] result written, exiting')
    app.exit(result.ok ? 0 : 1)
  } catch (err) {
    log('[smoke] exception:', err && err.stack || err)
    fs.writeFileSync(outFile, JSON.stringify({ ok: false, error: String(err), logs }, null, 2), 'utf8')
    app.exit(1)
  }
})