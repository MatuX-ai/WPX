/**
 * hermes-env —— 向 HERMES_HOME/.env 注入模型配置（Phase 3 / M3-C）
 *
 * 实机验证结论（hermes-agent 0.19.0）：网关无 provider 时 chat 返回
 * "No inference provider configured. Run 'hermes model' ... or set an API key
 * (OPENROUTER_API_KEY, OPENAI_API_KEY, etc.) in ~/.hermes/.env"
 * → WPX 在启动网关前，把用户解密后的模型 Key 写入 HERMES_HOME/.env：
 *   OPENAI_API_KEY=<key>
 *   OPENAI_BASE_URL=<baseUrl>   （自定义 OpenAI 兼容端点，如 DeepSeek；可选）
 *
 * 安全约束：
 * - 只写 OPENAI_* 白名单键，绝不回显 Key 内容
 * - 原子写（tmp + rename），避免半截文件被网关读到
 * - 文件仅本机 userData 目录内（数据主权）
 */
const fsp = require('node:fs/promises')
const path = require('node:path')

const ALLOWED_KEYS = ['OPENAI_API_KEY', 'OPENAI_BASE_URL']

/** 单行 env 转义（值中的换行/引号需安全化，防止 .env 注入） */
function escapeEnvValue(value) {
  return String(value)
    .replace(/[\r\n]+/g, ' ')
    .replace(/#/g, '\\#')
}

/**
 * 生成 .env 文本（纯函数）
 * @param {{ apiKey?: string, baseUrl?: string }} [payload]
 * @returns {{ content: string, keys: string[] }}
 */
function buildEnvFileContent(payload = {}) {
  const lines = []
  const keys = []
  const apiKey = payload && typeof payload.apiKey === 'string' ? payload.apiKey.trim() : ''
  if (apiKey) {
    lines.push(`OPENAI_API_KEY=${escapeEnvValue(apiKey)}`)
    keys.push('OPENAI_API_KEY')
  }
  const baseUrl = payload && typeof payload.baseUrl === 'string' ? payload.baseUrl.trim() : ''
  if (baseUrl) {
    lines.push(`OPENAI_BASE_URL=${escapeEnvValue(baseUrl)}`)
    keys.push('OPENAI_BASE_URL')
  }
  return { content: lines.join('\n') + (lines.length ? '\n' : ''), keys }
}

/**
 * 写入 HERMES_HOME/.env（原子写）
 * @param {string} hermesHome
 * @param {{ apiKey?: string, baseUrl?: string }} [payload]
 * @param {{ fsImpl?: typeof fsp }} [options]
 * @returns {Promise<{ ok: boolean, path: string, keys: string[], error?: string }>}
 */
async function writeHermesEnvFile(hermesHome, payload = {}, options = {}) {
  const fs = options.fsImpl || fsp
  const envPath = path.join(hermesHome, '.env')
  const { content, keys } = buildEnvFileContent(payload)
  try {
    await fs.mkdir(hermesHome, { recursive: true })
    if (!content) {
      // 无 Key 时写入空文件（清掉旧 Key）
      await fs.writeFile(envPath, '', 'utf8')
      return { ok: true, path: envPath, keys: [] }
    }
    const tmpPath = `${envPath}.tmp-${Date.now()}`
    await fs.writeFile(tmpPath, content, 'utf8')
    await fs.rename(tmpPath, envPath)
    return { ok: true, path: envPath, keys }
  } catch (error) {
    return { ok: false, path: envPath, keys: [], error: error?.message || String(error) }
  }
}

module.exports = {
  ALLOWED_KEYS,
  buildEnvFileContent,
  escapeEnvValue,
  writeHermesEnvFile,
}
