const path = require('node:path')
const { app } = require('electron')
const { registerExportRoutes } = require('./services/export-routes')
const { registerRemoveBgRoutes } = require('./services/remove-bg-routes')
const { registerTokenRoutes } = require('./services/token-routes')
const { registerCommercialFontRoutes } = require('./services/commercial-font-routes')
const { registerJcodeRoutes } = require('./services/jcode-routes')
const { registerHermesRoutes } = require('./services/hermes-routes')
const { registerLibraryRoutes } = require('./services/library-routes')
const { registerModelProxyRoutes } = require('./services/model-proxy-routes')
const hermesLauncher = require('./services/hermes-launcher')
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

  // 安全约束：
  // - 服务仅监听 127.0.0.1，外网不可达
  // - CORS：放行本地开发 Origin，以及 Electron 生产 loadFile 产生的 Origin "null" / file://
  //   （此前只放行 http://localhost，导致 AI 对话经 /api/model-proxy 时被浏览器 CORS 拦截，
  //    表现为「无法连接到模型服务」；设置页测试连接走主进程 fetch，故不受影响）
  expressApp.use(cors({
    origin: (origin, callback) => {
      if (!origin || origin === 'null' || String(origin).startsWith('file:')) {
        return callback(null, true)
      }
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true)
      }
      callback(null, false)
    },
    credentials: true,
  }))
  expressApp.use(express.json({ limit: '50mb' }))

  await initTokenStore(app.getPath('userData'))
  await initCommercialFontStore(app.getPath('userData'))

  registerExportRoutes(expressApp, upload)
  registerRemoveBgRoutes(expressApp, upload)
  registerTokenRoutes(expressApp)
  registerCommercialFontRoutes(expressApp)
  registerJcodeRoutes(expressApp)
  // 文库服务：移植自 wpx-app/src/server/library-service.py，
  // 避免 Electron 桌面端 fetch `/api/library/*` 报 Failed to fetch。
  registerLibraryRoutes(expressApp)
  // 自定义模型代理：渲染进程经 127.0.0.1 转发，避免直连第三方 API 被 CORS 拦截
  // （设置页「测试连接」走主进程 fetch 故能通，对话必须走此代理）
  registerModelProxyRoutes(expressApp)
  // M3：Hermes Gateway 适配层（网关不可用时透明降级，不影响其他服务）
  // gatewayKey 动态取 launcher 当前生成的 API_SERVER_KEY
  registerHermesRoutes(expressApp, {
    gatewayKey: () => hermesLauncher.getStatus().apiKey || '',
  })

  expressApp.use((_req, res) => {
    res.status(404).json({ error: '接口不存在' })
  })

  expressApp.use((err, _req, res, _next) => {
    console.error('[local-server]', err)
    res.status(500).json({ error: '服务器内部错误', details: err.message })
  })

  const state = await new Promise((resolve, reject) => {
    // 端口优先级：
    //   1) process.env.WPX_LOCAL_SERVER_PORT（开发期 Vite proxy 需要固定端口）
    //   2) 0：让 OS 分配空闲端口（生产/打包后使用，零冲突）
    const envPort = Number.parseInt(process.env.WPX_LOCAL_SERVER_PORT || '', 10)
    const listenPort = Number.isFinite(envPort) && envPort > 0 ? envPort : 0
    const server = expressApp.listen(listenPort, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      const baseUrl = `http://127.0.0.1:${port}`
      console.log(`[local-server] 运行于 ${baseUrl}${listenPort ? ' (固定端口)' : ' (动态端口)'}`)
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
