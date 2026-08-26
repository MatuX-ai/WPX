import { computed, ref } from 'vue'
import { buildPptxImportWarningSummary } from '@/utils/pptxImportWarning'

/**
 * PPTX 有损导入确认弹窗（Promise 式）。
 * 在插入编辑器内容前调用，用户可取消以避免误覆盖原文件。
 */

const visible = ref(false)
/** @type {import('vue').Ref<ReturnType<typeof buildPptxImportWarningSummary> | null>} */
const summary = ref(null)
/** @type {((ok: boolean) => void) | null} */
let resolver = null

/**
 * @param {object} payload 主进程 convertPptxFile 返回的负载
 * @returns {Promise<boolean>} true=继续打开，false=取消
 */
export function confirmPptxImport(payload) {
  // 若已有弹窗在等，先按取消结束旧 Promise，避免悬挂
  if (resolver) {
    resolver(false)
    resolver = null
  }

  summary.value = buildPptxImportWarningSummary(payload || {})
  visible.value = true

  return new Promise((resolve) => {
    resolver = resolve
  })
}

function settle(ok) {
  visible.value = false
  const fn = resolver
  resolver = null
  summary.value = null
  if (typeof fn === 'function') fn(Boolean(ok))
}

export function acceptPptxImportWarning() {
  settle(true)
}

export function cancelPptxImportWarning() {
  settle(false)
}

/**
 * 供弹窗组件绑定状态。
 */
export function usePptxImportWarningDialog() {
  return {
    visible: computed(() => visible.value),
    summary: computed(() => summary.value),
    accept: acceptPptxImportWarning,
    cancel: cancelPptxImportWarning,
  }
}
