/**
 * hermesRouter —— Hermes 自动路由判定（纯函数，M3-C+）
 *
 * 在 useAiChat.sendMessage 中决定「本次任务是否自动走 Hermes 本地网关」：
 * - 显式指令（"用 Hermes…" / "hermes…" / 开放任务关键词）→ 命中（无需开关）
 * - 自动路由开关开启 + 复杂（超长）任务 → 命中
 * - 两者都要求：Hermes 已启用（enabled）且网关就绪（gatewayReady）
 *
 * 与 ai-router.shouldUseHermes 的关系：
 * - 这里负责「对话层」的开关/就绪上下文判断；
 * - 复杂任务语义（关键词/长度）复用 ai-router 的 shouldUseHermes。
 */
import { shouldUseHermes } from '@/server/ai-router'

/**
 * @param {string} text 用户消息
 * @param {{ enabled?: boolean, autoRoute?: boolean, gatewayReady?: boolean }} [opts]
 * @returns {boolean}
 */
export function shouldAutoRouteHermes(text, opts = {}) {
  const msg = String(text || '').trim()
  if (!msg) return false

  const enabled = opts.enabled === true
  const gatewayReady = opts.gatewayReady === true
  if (!enabled || !gatewayReady) return false

  // 1) 显式指令 / 开放任务关键词（复用 ai-router 的模式）
  if (shouldUseHermes(msg)) return true

  // 2) 自动路由开关 + 复杂（超长）任务
  if (opts.autoRoute === true && shouldUseHermes(msg, { autoRouteEnabled: true })) return true

  return false
}

/**
 * 把 Hermes 执行结果构造成可渲染的助手消息（AI SDK UIMessage 兼容）
 * @param {string} text 任务原文
 * @param {string} result 执行结果
 * @returns {{ id: string, role: 'assistant', parts: Array<{ type: 'text', text: string }>, hermesTask: boolean, task: string }}
 */
export function buildHermesAssistantMessage(text, result) {
  return {
    id: `hermes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: 'assistant',
    parts: [{ type: 'text', text: String(result || '') }],
    hermesTask: true,
    task: String(text || ''),
  }
}

export default { shouldAutoRouteHermes, buildHermesAssistantMessage }
