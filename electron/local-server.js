const path = require('node:path')
const { app } = require('electron')
const { registerExportRoutes } = require('./services/export-routes')
const { registerRemoveBgRoutes } = require('./services/remove-bg-routes')
const { registerTokenRoutes } = require('./services/token-routes')
const { registerCommercialFontRoutes } = require('./services/commercial-font-routes')
const { registerJcodeRoutes } = require('./services/jcode-routes')
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
  // - 仅允许来自 http://localhost:* 和 http://127.0.0.1:* 的请求（本地 Electron 渲染进程）
  // - 使用 origin 函数动态匹配，避免 origin: true 反射任意 Origin 头
  // - 同时服务监听地址硬编码为 127.0.0.1，外部网络无法访问
  expressApp.use(cors({
    origin: (origin, callback) => {
      // 无 origin 头（同源请求或 Electron file:// 协议）直接放行
      if (!origin) return callback(null, true)
      // 仅允许本地地址
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
