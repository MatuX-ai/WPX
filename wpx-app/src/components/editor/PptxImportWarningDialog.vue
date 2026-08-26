<script setup>
/**
 * PPTX 有损导入确认弹窗
 * - 打开前必须确认，避免用户误以为可无损编辑并覆盖原文件
 */
import { usePptxImportWarningDialog } from '@/composables/usePptxImportWarning'

const { visible, summary, accept, cancel } = usePptxImportWarningDialog()
</script>

<template>
  <Teleport to="body">
    <Transition name="pptx-warn">
      <div
        v-if="visible && summary"
        class="pptx-warn-backdrop"
        role="presentation"
        @click.self="cancel"
      >
        <div
          class="pptx-warn-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="pptx-warn-title"
          aria-describedby="pptx-warn-desc"
          @click.stop
        >
          <header class="pptx-warn-dialog__header">
            <div class="pptx-warn-dialog__badge" aria-hidden="true">!</div>
            <div class="pptx-warn-dialog__heading">
              <h2 id="pptx-warn-title" class="pptx-warn-dialog__title">
                导入前请确认：PPTX 为有损转换
              </h2>
              <p id="pptx-warn-desc" class="pptx-warn-dialog__subtitle">
                「{{ summary.title }}」将转为 WPX 可编辑幻灯片。
                <template v-if="summary.statsLabel">
                  本次解析：{{ summary.statsLabel }}。
                </template>
                继续后可用 Ctrl+S 写回，但无法保证与原文件完全一致。
              </p>
            </div>
          </header>

          <div class="pptx-warn-dialog__body">
            <p class="pptx-warn-dialog__section-label">可能丢失或改变的内容</p>
            <ul class="pptx-warn-dialog__list">
              <li
                v-for="(risk, idx) in summary.risks"
                :key="`risk-${idx}`"
              >
                {{ risk }}
              </li>
            </ul>

            <template v-if="summary.extraWarnings.length">
              <p class="pptx-warn-dialog__section-label">本次导入补充说明</p>
              <ul class="pptx-warn-dialog__list pptx-warn-dialog__list--muted">
                <li
                  v-for="(w, idx) in summary.extraWarnings"
                  :key="`warn-${idx}`"
                >
                  {{ w }}
                </li>
              </ul>
            </template>

            <p v-if="summary.fileName" class="pptx-warn-dialog__file">
              源文件：{{ summary.fileName }}
            </p>
          </div>

          <footer class="pptx-warn-dialog__footer">
            <button
              type="button"
              class="pptx-warn-dialog__btn pptx-warn-dialog__btn--ghost wpx-btn"
              @click="cancel"
            >
              取消打开
            </button>
            <button
              type="button"
              class="pptx-warn-dialog__btn pptx-warn-dialog__btn--primary wpx-btn"
              @click="accept"
            >
              我已了解，继续打开
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pptx-warn-backdrop {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-modal) + 2);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(2px);
}

.pptx-warn-dialog {
  width: min(520px, 100%);
  max-height: min(86vh, 640px);
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.2);
  overflow: hidden;
}

.pptx-warn-dialog__header {
  display: flex;
  gap: 12px;
  padding: 20px 20px 12px;
}

.pptx-warn-dialog__badge {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: #b45309;
  background: #fef3c7;
}

.pptx-warn-dialog__heading {
  min-width: 0;
}

.pptx-warn-dialog__title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.35;
}

.pptx-warn-dialog__subtitle {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.65;
  color: #64748b;
}

.pptx-warn-dialog__body {
  padding: 4px 20px 8px;
  overflow: auto;
}

.pptx-warn-dialog__section-label {
  margin: 10px 0 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #475569;
  text-transform: none;
}

.pptx-warn-dialog__list {
  margin: 0;
  padding: 0 0 0 1.15rem;
  font-size: 13px;
  line-height: 1.65;
  color: #334155;
}

.pptx-warn-dialog__list li + li {
  margin-top: 4px;
}

.pptx-warn-dialog__list--muted {
  color: #64748b;
}

.pptx-warn-dialog__file {
  margin: 12px 0 4px;
  font-size: 12px;
  color: #94a3b8;
  word-break: break-all;
}

.pptx-warn-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 20px;
  border-top: 1px solid #f1f5f9;
}

.pptx-warn-dialog__btn {
  padding: 9px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.pptx-warn-dialog__btn--ghost {
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
}

.pptx-warn-dialog__btn--primary {
  border: none;
  background: #b45309;
  color: #fff;
}

.pptx-warn-dialog__btn--primary:hover {
  background: #92400e;
}

.pptx-warn-dialog__btn--ghost:hover {
  background: #f8fafc;
}

.pptx-warn-enter-active,
.pptx-warn-leave-active {
  transition: opacity 0.16s ease;
}

.pptx-warn-enter-active .pptx-warn-dialog,
.pptx-warn-leave-active .pptx-warn-dialog {
  transition: transform 0.16s ease, opacity 0.16s ease;
}

.pptx-warn-enter-from,
.pptx-warn-leave-to {
  opacity: 0;
}

.pptx-warn-enter-from .pptx-warn-dialog,
.pptx-warn-leave-to .pptx-warn-dialog {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
</style>
