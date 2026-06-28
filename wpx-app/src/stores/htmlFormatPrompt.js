import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * HTML 智能排版引擎 - 提示状态共享 Store
 *
 * 负责在"触发方"(EditorCore / useDragDrop / TitleBar)和"消费方"(AiAssistantPlaceholder)
 * 之间传递待处理的 HTML 排版请求。
 *
 * 设计要点：
 * 1. 使用 Pinia 而非 composable，便于跨组件订阅
 * 2. pending 是一次性事件快照，AiAssistantPlaceholder watch 到后立刻 clear，避免重复消费
 * 3. token 字段使用 Symbol 类型，保证不同次触发的语义隔离
 * 4. 与 markdownFormatPrompt 独立：MD 走 MD store，HTML 走 HTML store，互不干扰
 *
 * @typedef {'a4-focus-mode' | 'manual' | 'paste' | 'file' | 'change-template'} HtmlPromptSource
 *
 * @typedef {Object} HtmlPromptPayload
 * @property {HtmlPromptSource} source 触发来源
 * @property {string} [templateId] 当 source === 'change-template' 时携带目标模板
 * @property {boolean} [autoApply] 当 source === 'paste' 时为 true，自动应用默认偏好
 * @property {Symbol} [token] 唯一标识，用于消费方校验过期事件
 */

/**
 * @returns {HtmlPromptPayload | null}
 */
function createEmptyPayload() {
  return null
}

export const useHtmlFormatPromptStore = defineStore(
  'htmlFormatPrompt',
  () => {
    /** @type {import('vue').Ref<HtmlPromptPayload | null>} */
    const pending = ref(createEmptyPayload())

    /**
     * 触发一次排版提示请求。
     * 调用后 pending 会被赋值为一个新的 payload（附带新的 token），触发订阅方 watch。
     * @param {Omit<HtmlPromptPayload, 'token'>} payload
     */
    function trigger(payload) {
      if (!payload || typeof payload !== 'object') return
      const next = {
        ...payload,
        token:
          typeof Symbol === 'function'
            ? Symbol('html-format-prompt')
            : `h-${Date.now()}-${Math.random()}`,
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
     * @returns {HtmlPromptPayload | null}
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
