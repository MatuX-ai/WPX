import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * HTML 排版恢复提示条 Store
 *
 * 职责：
 *  - 在编辑器顶部/底部显示轻量提示条：`✅ 已按【XX】格式排版 [恢复原样] [换模板] [✕]`
 *  - 排版完成后由 AiAssistantPlaceholder 写入 visible=true 和 templateLabel
 *  - "恢复原样"后清空，"换模板"后由 AiAssistantPlaceholder 重新触发 htmlPromptStore
 *  - "✕" 仅关闭提示条，保留排版结果
 *
 * 设计要点：
 *  - 与 markdownFormatPrompt 类似，使用一次性 snapshot + token 语义
 *  - visible/templateLabel 是简单 ref，dismiss 后再次排版可重新显示
 */
export const useHtmlFormatStore = defineStore('htmlFormatBar', () => {
  /** @type {import('vue').Ref<boolean>} */
  const visible = ref(false)
  /** @type {import('vue').Ref<string>} */
  const templateLabel = ref('')
  /** @type {import('vue').Ref<string>} */
  const templateId = ref('')
  /** @type {import('vue').Ref<number>} */
  const formattedAt = ref(0)

  /**
   * 显示提示条
   * @param {{ templateId?: string, templateLabel?: string, formattedAt?: number }} payload
   */
  function show(payload = {}) {
    visible.value = true
    templateId.value = payload.templateId || ''
    templateLabel.value = payload.templateLabel || ''
    formattedAt.value = payload.formattedAt || Date.now()
  }

  /** 关闭提示条（保留排版结果） */
  function dismiss() {
    visible.value = false
  }

  /** 重置所有状态 */
  function reset() {
    visible.value = false
    templateId.value = ''
    templateLabel.value = ''
    formattedAt.value = 0
  }

  const state = computed(() => ({
    visible: visible.value,
    templateLabel: templateLabel.value,
    templateId: templateId.value,
    formattedAt: formattedAt.value,
  }))

  return {
    visible,
    templateLabel,
    templateId,
    formattedAt,
    state,
    show,
    dismiss,
    reset,
  }
})
