<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { computePosition, flip, offset, shift } from '@floating-ui/dom'
import { Check } from '@lucide/vue'
import { PAPER_SIZE_OPTIONS } from '@/constants/paperPreferences'
import { useUserPreferencesStore } from '@/stores/userPreferences'
import { useThemeStore } from '@/stores/theme'
import { useToast } from '@/composables/useToast'

const userPreferencesStore = useUserPreferencesStore()
const themeStore = useThemeStore()
const toast = useToast()

const menuOpen = ref(false)
const menuRef = ref(null)
const triggerRef = ref(null)
const isPositioned = ref(false)

const paperSize = computed(() => userPreferencesStore.paper?.paperSize || 'none')
const focusModeEnabled = computed(() => userPreferencesStore.paper?.focusMode === true)
const isDark = computed(() => themeStore.isDark)

const currentLabel = computed(() => {
  const option = PAPER_SIZE_OPTIONS.find((item) => item.value === paperSize.value)
  return option?.label || '未设置'
})

const shortLabel = computed(() => {
  switch (paperSize.value) {
    case 'A4':
      return 'A4'
    case 'Letter':
      return 'Letter'
    case '16K':
      return '16 开'
    case 'mobile':
      return '手机长图'
    case 'none':
    default:
      return '无'
  }
})

const items = computed(() =>
  PAPER_SIZE_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    active: option.value === paperSize.value,
  })),
)

function openMenu() {
  menuOpen.value = true
  isPositioned.value = false
  nextTick(updatePosition)
}

function closeMenu() {
  menuOpen.value = false
  isPositioned.value = false
}

function toggleMenu() {
  if (menuOpen.value) {
    closeMenu()
    return
  }
  openMenu()
}

async function handleSelect(value) {
  if (value === paperSize.value) {
    closeMenu()
    return
  }

  closeMenu()

  try {
    await userPreferencesStore.setPaperSize(value)
    const option = PAPER_SIZE_OPTIONS.find((item) => item.value === value)
    toast.info(`导出母版已切换为 ${option?.label || value}`)
  } catch (error) {
    console.warn('[ExportTemplateIndicator] Failed to switch paper size:', error)
    toast.error('切换导出母版失败，请重试')
  }
}

async function updatePosition() {
  if (!menuOpen.value) return
  const triggerEl = triggerRef.value
  const menuEl = menuRef.value
  if (!triggerEl || !menuEl) return

  const { x, y } = await computePosition(triggerEl, menuEl, {
    placement: 'top-end',
    strategy: 'fixed',
    middleware: [offset(6), flip({ padding: 12 }), shift({ padding: 12 })],
  })

  menuEl.style.left = `${x}px`
  menuEl.style.top = `${y}px`
  isPositioned.value = true
}

function handleDocumentPointerDown(event) {
  if (!menuOpen.value) return
  const target = event.target
  if (menuRef.value?.contains(target)) return
  if (triggerRef.value?.contains(target)) return
  closeMenu()
}

function handleDocumentKeydown(event) {
  if (!menuOpen.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeMenu()
  }
}

watch(menuOpen, (open) => {
  if (!open) {
    isPositioned.value = false
  }
})

onMounted(() => {
  document.addEventListener('mousedown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
})
</script>

<template>
  <div
    class="export-template-indicator"
    :class="{
      'export-template-indicator--focus': focusModeEnabled,
      'export-template-indicator--dark': isDark,
    }"
    :data-paper-size="paperSize"
    data-testid="export-template-indicator"
  >
    <button
      ref="triggerRef"
      type="button"
      class="export-template-indicator__trigger"
      :aria-label="`当前导出母版：${currentLabel}，点击切换`"
      :aria-haspopup="'menu'"
      :aria-expanded="menuOpen"
      :title="`导出母版：${currentLabel}`"
      @click="toggleMenu"
    >
      <span class="export-template-indicator__label">导出母版：</span>
      <span class="export-template-indicator__value">{{ shortLabel }}</span>
    </button>

    <Teleport to="body">
      <div
        v-if="menuOpen"
        ref="menuRef"
        class="export-template-indicator__menu"
        :class="{
          'export-template-indicator__menu--dark': isDark,
          'export-template-indicator__menu--ready': isPositioned,
        }"
        role="menu"
        aria-label="导出母版"
        @contextmenu.prevent
      >
        <button
          v-for="item in items"
          :key="item.value"
          type="button"
          class="export-template-indicator__menu-item"
          :class="{ 'export-template-indicator__menu-item--active': item.active }"
          role="menuitemradio"
          :aria-checked="item.active"
          @click="handleSelect(item.value)"
        >
          <span class="export-template-indicator__menu-check" aria-hidden="true">
            <Check v-if="item.active" :size="14" :stroke-width="2.4" />
          </span>
          <span class="export-template-indicator__menu-label">{{ item.label }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.export-template-indicator {
  position: fixed;
  right: 20px;
  bottom: 88px;
  z-index: var(--z-knowledge-panel, 50);
  pointer-events: auto;
  user-select: none;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.export-template-indicator__trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 220px;
  border: none;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-bg-subtle, #f8fafc) 78%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 4px 10px;
  font-size: 12px;
  line-height: 1.2;
  color: color-mix(in srgb, var(--theme-fg-muted, #475569) 78%, transparent);
  cursor: pointer;
  white-space: nowrap;
  transition:
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.export-template-indicator__trigger:hover {
  background: color-mix(in srgb, var(--theme-bg, #fff) 88%, transparent);
  color: var(--theme-fg, #1a1a1a);
}

.export-template-indicator__trigger:focus-visible {
  outline: 2px solid var(--theme-accent, #7c3aed);
  outline-offset: 2px;
}

.export-template-indicator__label {
  font-weight: 400;
  letter-spacing: 0.02em;
}

.export-template-indicator__value {
  font-weight: 600;
}

/* 焦点模式下加亮 */
.export-template-indicator--focus .export-template-indicator__trigger {
  background: color-mix(in srgb, var(--theme-accent, #7c3aed) 14%, var(--theme-bg-subtle, #f8fafc) 70%);
  color: var(--theme-accent, #7c3aed);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-accent, #7c3aed) 30%, transparent);
}

.export-template-indicator--focus .export-template-indicator__trigger:hover {
  background: color-mix(in srgb, var(--theme-accent, #7c3aed) 22%, var(--theme-bg, #fff) 70%);
}

/* 菜单容器 */
.export-template-indicator__menu {
  position: fixed;
  z-index: 10050;
  min-width: 168px;
  padding: 4px;
  border: 1px solid var(--theme-border, #e2e8f0);
  border-radius: 8px;
  background: var(--theme-bg, #ffffff);
  color: var(--theme-fg, #1a1a1a);
  box-shadow: var(--theme-shadow-lg, 0 12px 40px rgba(15, 23, 42, 0.14));
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
}

.export-template-indicator__menu--ready {
  opacity: 1;
  pointer-events: auto;
}

.export-template-indicator__menu--dark {
  border-color: var(--theme-border, #404040);
  background: var(--theme-surface, #252525);
  color: var(--theme-fg, #e0e0e0);
  box-shadow: var(--theme-shadow-lg, 0 12px 40px rgba(0, 0, 0, 0.55));
}

.export-template-indicator__menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  font-size: 13px;
  line-height: 1.4;
  color: inherit;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.export-template-indicator__menu-item:hover {
  background: var(--theme-bg-muted, #f1f5f9);
}

.export-template-indicator__menu--dark .export-template-indicator__menu-item:hover {
  background: var(--theme-bg-muted, #2d2d2d);
}

.export-template-indicator__menu-item--active {
  color: var(--theme-accent, #7c3aed);
  font-weight: 500;
}

.export-template-indicator__menu-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--theme-accent, #7c3aed);
}

.export-template-indicator__menu-label {
  flex: 1;
  min-width: 0;
}
</style>