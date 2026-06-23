<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTrayStore } from '@/stores/tray'
import { isEditorRoute } from '@/utils/windowContext'

const trayStore = useTrayStore()
const router = useRouter()

const menuRef = ref(null)

function handleTrayClick() {
  trayStore.showMainWindowFromTray()
}

function handleTrayContextMenu(event) {
  event.preventDefault()
  trayStore.setContextMenuOpen(true)
}

function handleNewDocument() {
  trayStore.trayNewDocument()
  if (!isEditorRoute(router.currentRoute.value)) {
    router.push({ name: 'editor' })
  }
}

function handleOpenRecent(doc) {
  trayStore.trayOpenRecentDocument(doc)
  if (!isEditorRoute(router.currentRoute.value)) {
    router.push({ name: 'editor' })
  }
}

function handleExit() {
  trayStore.trayExit()
}

function handleClickOutside(event) {
  if (!trayStore.contextMenuOpen) return
  if (menuRef.value?.contains(event.target)) return
  if (event.target.closest('.tray-simulator__icon-btn')) return
  trayStore.setContextMenuOpen(false)
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <div class="tray-simulator" role="region" aria-label="系统托盘模拟">
    <div ref="menuRef" class="tray-simulator__panel">
      <div
        v-if="trayStore.contextMenuOpen"
        class="tray-simulator__menu"
        role="menu"
      >
        <button
          type="button"
          class="tray-simulator__menu-item"
          role="menuitem"
          @click="handleNewDocument"
        >
          新建文档
        </button>

        <div class="tray-simulator__menu-group" role="group" aria-label="最近文档">
          <p class="tray-simulator__menu-label">最近文档</p>
          <button
            v-for="doc in trayStore.recentDocuments"
            :key="doc.id"
            type="button"
            class="tray-simulator__menu-item tray-simulator__menu-item--sub"
            role="menuitem"
            @click="handleOpenRecent(doc)"
          >
            <span class="tray-simulator__menu-item-title">{{ doc.title }}</span>
            <span v-if="doc.path" class="tray-simulator__menu-item-path">{{ doc.path }}</span>
          </button>
          <p
            v-if="!trayStore.recentDocuments.length"
            class="tray-simulator__menu-empty"
          >
            暂无最近文档
          </p>
        </div>

        <div class="tray-simulator__menu-separator" role="separator" />

        <button
          type="button"
          class="tray-simulator__menu-item tray-simulator__menu-item--danger"
          role="menuitem"
          @click="handleExit"
        >
          退出
        </button>
      </div>

      <button
        type="button"
        class="tray-simulator__icon-btn"
        title="WPX（左键恢复窗口，右键打开菜单）"
        aria-label="WPX 系统托盘"
        @click="handleTrayClick"
        @contextmenu="handleTrayContextMenu"
      >
        <img src="/favicon.svg" alt="" width="20" height="20" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.tray-simulator {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: calc(var(--z-ai-avatar, 1000) + 20);
  pointer-events: auto;
}

.tray-simulator__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.tray-simulator__menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  min-width: 220px;
  padding: 6px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 10px;
  background: var(--theme-bg, #fff);
  box-shadow: var(--theme-shadow-lg, 0 12px 40px rgba(15, 23, 42, 0.14));
}

.tray-simulator__menu-label {
  margin: 4px 10px 2px;
  font-size: 11px;
  font-weight: 600;
  color: var(--theme-fg-muted, #64748b);
}

.tray-simulator__menu-item {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  font-size: 13px;
  color: var(--theme-fg, #1a1a1a);
  cursor: pointer;
  transition: background 0.12s ease;
}

.tray-simulator__menu-item:hover {
  background: var(--theme-bg-muted, #f1f5f9);
}

.tray-simulator__menu-item--sub {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tray-simulator__menu-item-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tray-simulator__menu-item-path {
  font-size: 11px;
  color: var(--theme-fg-muted, #64748b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tray-simulator__menu-item--danger {
  color: #dc2626;
}

.tray-simulator__menu-item--danger:hover {
  background: #fef2f2;
}

.tray-simulator__menu-empty {
  margin: 0;
  padding: 6px 10px 8px;
  font-size: 12px;
  color: var(--theme-fg-subtle, #94a3b8);
}

.tray-simulator__menu-separator {
  height: 1px;
  margin: 4px 0;
  background: var(--theme-border, #e2e8f0);
}

.tray-simulator__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 8px;
  background: var(--theme-bg, #fff);
  box-shadow: var(--theme-shadow-md, 0 4px 12px rgba(15, 23, 42, 0.1));
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.tray-simulator__icon-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--theme-shadow-lg, 0 12px 40px rgba(15, 23, 42, 0.14));
}
</style>
