const fs = require('node:fs')
const path = require('node:path')

const CONFIG_PATH = path.join(__dirname, 'dev-config.json')

/** @typedef {{
 *   enabled: boolean,
 *   remoteDebugPort: number,
 *   debugPortBase: number,
 *   debugPortSpan: number,
 *   autoDevTools: boolean,
 *   logWindows: boolean,
 *   logIpc: boolean,
 *   initialWindows: number,
 *   disableSingleInstance: boolean,
 * }} DevConfig */

/**
 * @returns {Partial<DevConfig>}
 */
function readConfigFile() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return {}
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    console.warn('[dev-config] Failed to read dev-config.json:', error.message)
    return {}
  }
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  const normalized = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * 开发环境配置（环境变量优先，其次 electron/dev-config.json）
 * @param {{ isPackaged?: boolean }} [options]
 */
function loadDevConfig(options = {}) {
  const isPackaged = options.isPackaged ?? false
  const fileConfig = isPackaged ? {} : readConfigFile()

  const remoteDebugPort = parsePositiveInt(
    process.env.WPX_REMOTE_DEBUG_PORT ?? fileConfig.remoteDebugPort,
    0,
  )

  return {
    enabled: !isPackaged,
    remoteDebugPort,
    debugPortBase: parsePositiveInt(
      process.env.WPX_DEBUG_PORT_BASE ?? fileConfig.debugPortBase,
      9222,
    ),
    debugPortSpan: parsePositiveInt(
      process.env.WPX_DEBUG_PORT_SPAN ?? fileConfig.debugPortSpan,
      200,
    ),
    autoDevTools: parseBoolean(
      process.env.WPX_DEV_AUTO_DEVTOOLS ?? fileConfig.autoDevTools,
      true,
    ),
    logWindows: parseBoolean(
      process.env.WPX_DEV_LOG ?? process.env.WPX_DEV_LOG_WINDOWS ?? fileConfig.logWindows,
      true,
    ),
    logIpc: parseBoolean(
      process.env.WPX_DEV_IPC_LOG ?? fileConfig.logIpc,
      true,
    ),
    initialWindows: parsePositiveInt(
      process.env.WPX_DEV_INITIAL_WINDOWS ?? fileConfig.initialWindows,
      1,
    ),
    disableSingleInstance: parseBoolean(
      process.env.WPX_DISABLE_SINGLE_INSTANCE ?? fileConfig.disableSingleInstance,
      false,
    ),
  }
}

module.exports = {
  CONFIG_PATH,
  loadDevConfig,
}
