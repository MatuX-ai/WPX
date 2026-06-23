const path = require('node:path')
const { app } = require('electron')
const { registerExportRoutes } = require('./services/export-routes')
const { registerRemoveBgRoutes } = require('./services/remove-bg-routes')
const { registerTokenRoutes } = require('./services/token-routes')
const { registerCommercialFontRoutes } = require('./services/commercial-font-routes')
const { initTokenStore } = require('./services/token-store')
const { initCommercialFontStore } = require('./services/commercial-font-store')

const WPX_APP_ROOT = path.join(__dirname, '..', 'wpx-app')
const ROOT_DIR = path.join(__dirname, '..')

function requireFromWpxApp(moduleId) {
  return require(require.resolve(moduleId, { paths: [ROOT_DIR, WPX_APP_ROOT] }))
}

/** @type {{ server: import('http').Server, port: number, baseUrl: string } | null} */
let localServerState = null

function getLocalServerBaseUrl() {
  return localServerState?.baseUrl ?? null
}

async function startLocalServer() {
  if (localServerState) {
    return localServerState
  }

  const express = requireFromWpxApp('express')
  const cors = requireFromWpxApp('cors')
  const multer = requireFromWpxApp('multer')

  const expressApp = express()
  const upload = multer({ storage: multer.memoryStorage() })

  expressApp.use(cors({ origin: true, credentials: true }))
  expressApp.use(express.json({ limit: '50mb' }))

  await initTokenStore(app.getPath('userData'))
  await initCommercialFontStore(app.getPath('userData'))

  registerExportRoutes(expressApp, upload)
  registerRemoveBgRoutes(expressApp, upload)
  registerTokenRoutes(expressApp)
  registerCommercialFontRoutes(expressApp)

  expressApp.use((_req, res) => {
    res.status(404).json({ error: '接口不存在' })
  })

  expressApp.use((err, _req, res, _next) => {
    console.error('[local-server]', err)
    res.status(500).json({ error: '服务器内部错误', details: err.message })
  })

  const state = await new Promise((resolve, reject) => {
    const server = expressApp.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      const baseUrl = `http://127.0.0.1:${port}`
      console.log(`[local-server] 运行于 ${baseUrl}`)
      resolve({ server, port, baseUrl })
    })
    server.on('error', reject)
  })

  localServerState = state
  return state
}

async function stopLocalServer() {
  if (!localServerState) return

  const { server } = localServerState
  localServerState = null

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

module.exports = {
  startLocalServer,
  stopLocalServer,
  getLocalServerBaseUrl,
}
