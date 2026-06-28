<script setup>
/**
 * WPX 排版后恢复提示条
 *
 * 用法：
 *   在 EditorLayout 中把此组件放在编辑器容器内顶部。
 *   它会自动监听 htmlFormatBarStore 的 visible/templateLabel，
 *   显示提示条 `✅ 已按【XX】格式排版 [恢复原样] [换模板] [✕]`。
 *
 * 交互：
 *   - 恢复原样 → 调用 useHtmlImporter.restoreFromHtmlSource 还原原始 HTML 渲染
 *   - 换模板 → 重新触发 htmlFormatPromptStore，AiAssistantPlaceholder 重新弹模板选择器
 *   - ✕ → 仅关闭提示条，保留当前排版结果
 *
 * 设计要点：
 *   - 完全复用 LocalCommandMessage.format-recovery 模式（保持视觉一致）
 *   - 不修改文档结构，纯组件级状态
 */
import { computed } from 'vue'
import { useHtmlFormatStore } from '@/stores/htmlFormatBar'
import { useHtmlFormatPromptStore } from '@/stores/htmlFormatPrompt'
import { getActiveEditor } from '@/composables/useEditorRegistry'
import { hasHtmlImport, restoreFromHtmlSource } from '@/composables/useHtmlImporter'
import { useToastStore } from '@/stores/toast'
import LocalCommandMessage from '@/components/ai/LocalCommandMessage.vue'

const htmlFormatBarStore = useHtmlFormatStore()
const htmlPromptStore = useHtmlFormatPromptStore()
const toast = useToastStore()

const visible = computed(() => htmlFormatBarStore.visible)
const templateLabel = computed(() => htmlFormatBarStore.templateLabel)

function handleRestore() {
  const editor = getActiveEditor()
  if (!editor) {
    toast.warning('没有可用的编辑器')
    return
  }
  if (!hasHtmlImport(editor)) {
    toast.warning('未找到原始网页内容，无法恢复')
    htmlFormatBarStore.dismiss()
    return
  }
  const result = restoreFromHtmlSource(editor)
  if (result.ok) {
    htmlFormatBarStore.dismiss()
    toast.success('已恢复网页原样', 2000)
  } else {
    toast.warning(result.message || '恢复原样失败', 3000)
  }
}

function handleChangeTemplate() {
  htmlFormatBarStore.dismiss()
  // 重新触发 HTML 排版选择弹窗
  htmlPromptStore.trigger({ source: 'change-template' })
}

function handleDismiss() {
  htmlFormatBarStore.dismiss()
}
</script>

<template>
  <div v-if="visible" class="format-template-selector" role="region" aria-label="HTML 排版结果提示条">
    <LocalCommandMessage
      mode="format-recovery"
      :success="true"
      icon="success"
      command-id="format-html"
      category="format"
      :template-label="templateLabel"
      :message="`已按【${templateLabel}】格式排版`"
      @restore="handleRestore"
      @change-template="handleChangeTemplate"
      @dismiss="handleDismiss"
    />
  </div>
</template>

<style scoped>
.format-template-selector {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 6px 12px;
  margin-bottom: 4px;
  animation: format-template-selector-slide-down 220ms ease-out;
}

@keyframes format-template-selector-slide-down {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
