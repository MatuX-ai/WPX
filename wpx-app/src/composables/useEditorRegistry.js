/**
 * 编辑器实例全局注册中心
 *
 * 单一职责：在应用内任意位置都能拿到当前激活的 Tiptap editor 实例。
 * 由 EditorCore 在 mount / unmount 时分别调用 setActiveEditor / clearActiveEditor。
 *
 * 设计原因：
 * - 避免把 Tiptap editor 通过 props 层层下传（AI 对话窗、命令面板等都需要）
 * - 避免在 Pinia store 里存重型对象（editor 内部包含 ProseMirror 状态）
 * - 全局只有一个 editor，模块级 ref 即足够，无需 Pinia 持久化
 */

import { ref, shallowRef } from 'vue'

// 使用 shallowRef：editor 内部状态（ProseMirror state、commands、nodes）都是深嵌套对象，
// 只需在引用级别响应即可，避免 Vue 对其做深响应代理带来的性能开销。
const activeEditor = shallowRef(null)
const editorCount = ref(0)

/**
 * 设置当前激活的 editor 实例。
 * 允许多个 editor 共存（例如多窗口），但仅记录最近一次注册。
 * @param {import('@tiptap/core').Editor | null} editor
 */
export function setActiveEditor(editor) {
  if (editor) {
    editorCount.value += 1
  }
  activeEditor.value = editor
}

/**
 * 注销 editor 实例。
 * 若传入的不是当前 active editor，则忽略。
 * @param {import('@tiptap/core').Editor | null} editor
 */
export function clearActiveEditor(editor) {
  if (activeEditor.value === editor) {
    activeEditor.value = null
  }
  if (editor && editorCount.value > 0) {
    editorCount.value -= 1
  }
}

/**
 * 获取当前激活的 editor 实例（响应式 ref）。
 * @returns {import('vue').ShallowRef<import('@tiptap/core').Editor | null>}
 */
export function useActiveEditor() {
  return activeEditor
}

/**
 * 获取当前激活的 editor 实例（非响应式快照）。
 * @returns {import('@tiptap/core').Editor | null}
 */
export function getActiveEditor() {
  return activeEditor.value
}

export default {
  setActiveEditor,
  clearActiveEditor,
  useActiveEditor,
  getActiveEditor,
}
