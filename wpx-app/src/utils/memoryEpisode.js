/**
 * memoryEpisode —— AI 对话 → 情景记忆（episode）的纯函数辅助（M2.1）
 *
 * 职责：
 * - buildChatEpisode：把一次成功的 AI 对话（用户任务 + 助手摘要）构造成 episode 载荷
 * - isEpisodeRecordingEnabled：按学习设置判断是否应记录（recordEpisodes 开关）
 *
 * 纯函数模块：不依赖 DOM / IPC / Electron，可直接单测。
 */

/** 与 memory-service normalizeEpisode 对齐的截断长度 */
const TASK_MAX = 500
const SUMMARY_MAX = 2000

/**
 * 从 AI 对话完成事件构造 episode 载荷
 * @param {{ text?: string }} event ToolLoopAgent onFinish 事件
 * @param {string} userText 用户本次输入（原始文本，不含上下文注入）
 * @returns {{ task: string, summary: string, outcome: 'success', feedback: null } | null}
 *          文本为空时返回 null（不记录噪音 episode）
 */
export function buildChatEpisode(event, userText) {
  const task = String(userText || '').trim().slice(0, TASK_MAX)
  const summary = String(event?.text || '').trim().slice(0, SUMMARY_MAX)
  if (!task || !summary) return null
  return { task, summary, outcome: 'success', feedback: null }
}

/**
 * 判断是否应自动记录情景记忆
 * @param {object | null | undefined} settings memory:learn:settings 的返回
 * @returns {boolean} recordEpisodes 未显式关闭即视为开启
 */
export function isEpisodeRecordingEnabled(settings) {
  if (!settings || typeof settings !== 'object') return true
  return settings.recordEpisodes !== false
}

export default { buildChatEpisode, isEpisodeRecordingEnabled }
