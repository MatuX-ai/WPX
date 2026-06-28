import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * MD 智能排版引擎 - 提示状态共享 Store
 *
 * 负责在"触发方"(EditorCore / useDragDrop)和"消费方"(AiAssistantPlaceholder)之间
 * 传递待处理的 Markdown 排版请求。
 *
 * 设计要点：
 * 1. 使用 Pinia 而非 composable，便于跨组件订阅
 * 2. pending 是一次性事件快照，AiAssistantPlaceholder watch 到后立刻 clear，避免重复消费
 * 3. token 字段使用 Symbol 类型，保证不同次触发的语义隔离（即使对象被复用也不会被错配）
 *
 * @typedef {'paste' | 'import' | 'manual' | 'dragdrop'} MarkdownPromptSource
 *
 * @typedef {Object} MarkdownPromptPayload
 * @property {MarkdownPromptSource} source 触发来源
 * @property {string} previewText 检测到的 MD 片段预览（截取前若干字符）
 * @property {boolean} hasImages 文档是否含图片节点
 * @property {string} [templateId] 当 source === 'manual' 且有默认偏好时携带
 * @property {Symbol} [token] 唯一标识，用于消费方校验过期事件
 */

/**
 * @returns {MarkdownPromptPayload | null}
 */
function createEmptyPayload() {
  return null
}

export const useMarkdownFormatPromptStore = defineStore(
  'markdownFormatPrompt',
  () => {
    /** @type {import('vue').Ref<MarkdownPromptPayload | null>} */
    const pending = ref(createEmptyPayload())

    /**
     * 触发一次排版提示请求。
     * 调用后 pending 会被赋值为一个新的 payload（附带新的 token），触发订阅方 watch。
     * @param {Omit<MarkdownPromptPayload, 'token'>} payload
     */
    function trigger(payload) {
      if (!payload || typeof payload !== 'object') return
      const next = {
        ...payload,
        token: typeof Symbol === 'function' ? Symbol('markdown-format-prompt') : `t-${Date.now()}-${Math.random()}`,
        consumedAt: Date.now(),
      }
      pending.value = next
    }

    /**
     * 主动清空 pending（如订阅方已成功消费或调用方主动取消）。
     */
    function clear() {
      pending.value = null
    }

    /**
     * 消费方读取当前 pending（不会自动清空，由调用方按需 clear）。
     * @returns {MarkdownPromptPayload | null}
     */
    function consume() {
      return pending.value
    }

    return {
      pending,
      trigger,
      clear,
      consume,
    }
  },
)