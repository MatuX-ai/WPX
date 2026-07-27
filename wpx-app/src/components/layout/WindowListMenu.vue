<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Plus, X } from '@lucide/vue'
import { requestCreateAppWindow } from '@/composables/useCreateAppWindow'
import { getElectronAPI, isElectron } from '@/utils/electron'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  windows: {
    type: Array,
    default: () => [],
  },
  currentWindowId: {
    type: Number,
    default: 0,
  },
  anchorEl: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['close', 'select'])

const menuRef = ref(null)
const position = ref({ top: 0, left: 0 })

const hasWindows = computed(() => props.windows.length > 0)

function updatePosition() {
  const anchor = props.anchorEl
  if (!anchor || typeof anchor.getBoundingClientRect !== 'function') return

  const rect = anchor.getBoundingClientRect()
  const menuWidth = 240
  const viewportWidth = window.innerWidth
  let left = rect.left

  if (left + menuWidth > viewportWidth - 8) {
    left = Math.max(8, viewportWidth - menuWidth - 8)
  }

  position.value = {
    top: rect.bottom + 6,
    left,
  }
}

function handleSelect(windowId) {
  emit('select', windowId)
}

async function handleCloseWindow(windowId) {
  if (!isElectron()) return
  const api = getElectronAPI()
  if (typeof api?.closeWindow !== 'function') return
  const result = await api.closeWindow(windowId)
  if (!result?.ok) {
    useToast().error('关闭窗口失败')
    return
  }
  emit('close')
}

async function handleNewWindow() {
  await requestCreateAppWindow()
  emit('close')
}

function handleDocumentClick(event) {
  if (!props.open) return
  const target = event.target
  if (menuRef.value?.contains(target)) return
  if (props.anchorEl?.contains?.(target)) return
  emit('close')
}

function handleKeydown(event) {
  if (!props.open) return
  if (event.key === 'Escape') {
    emit('close')
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    updatePosition()
  },
)

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', updatePosition)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', updatePosition)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="window-list-menu">
      <div
        v-if="open"
        ref="menuRef"
        class="window-list-menu"
        role="menu"
        aria-label="窗口列表"
        :style="{ top: `${position.top}px`, left: `${position.left}px` }"
      >
        <p class="window-list-menu__title">窗口</p>

        <button
          type="button"
          class="window-list-menu__new-btn"
          role="menuitem"
          aria-label="新建窗口"
          @click="handleNewWindow"
        >
          <Plus :size="14" aria-hidden="true" />
          <span>新建窗口</span>
        </button>

        <p v-if="!hasWindows" class="window-list-menu__empty">暂无打开的窗口</p>

        <ul v-else class="window-list-menu__items">
          <li v-for="item in windows" :key="item.id" class="window-list-menu__item-row">
            <button
              type="button"
              class="window-list-menu__item"
              :class="{ 'window-list-menu__item--active': item.id === currentWindowId }"
              role="menuitem"
              @click="handleSelect(item.id)"
            >
              <span class="window-list-menu__item-title" :title="item.title">{{ item.title }}</span>
              <span v-if="item.id === currentWindowId" class="window-list-menu__check" aria-hidden="true">
                ✓
              </span>
            </button>
            <button
              v-if="item.id !== currentWindowId"
              type="button"
              class="window-list-menu__close-btn"
              role="menuitem"
              :aria-label="`关闭 ${item.title}`"
              @click.stop="handleCloseWindow(item.id)"
            >
              <X :size="12" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.window-list-menu {
  position: fixed;
  z-index: calc(var(--z-modal) + 2);
  width: min(240px, calc(100vw - 16px));
  padding: 8px;
  border: 1px solid var(--theme-border);
  border-radius: 10px;
  background: var(--theme-surface);
  box-shadow: var(--theme-shadow-md);
}

.window-list-menu__title {
  margin: 0 0 6px;
  padding: 4px 8px 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--theme-fg-subtle);
}

.window-list-menu__new-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 10px;
  margin-bottom: 6px;
  border: none;
  border-radius: 8px;
  background: var(--theme-accent);
  color: #fff;
  font-size: 13px;
  text-align: left;
  cursor: default;
  transition: background-color 0.12s ease;
}

.window-list-menu__new-btn:hover {
  background: color-mix(in srgb, var(--theme-accent) 88%, #000 12%);
}

.window-list-menu__empty {
  margin: 0;
  padding: 8px;
  font-size: 13px;
  color: var(--theme-fg-muted);
}

.window-list-menu__items {
  margin: 0;
  padding: 0;
  list-style: none;
}

.window-list-menu__item-row {
  display: flex;
  align-items: center;
  gap: 0;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
}

.window-list-menu__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex: 1;
  padding: 8px 10px;
  border: none;
  background: transparent;
  color: var(--theme-fg);
  font-size: 13px;
  text-align: left;
  cursor: default;
}

.window-list-menu__item:hover,
.window-list-menu__item--active {
  background: var(--theme-bg-muted);
}

.window-list-menu__item-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.window-list-menu__check {
  flex-shrink: 0;
  color: var(--theme-accent);
  font-size: 12px;
  font-weight: 700;
}

.window-list-menu__close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  align-self: stretch;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--theme-fg-muted);
  cursor: default;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;
}

.window-list-menu__close-btn:hover {
  background: var(--theme-bg-muted);
  color: var(--theme-fg);
}

.window-list-menu-enter-active,
.window-list-menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.window-list-menu-enter-from,
.window-list-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>