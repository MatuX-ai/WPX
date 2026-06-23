<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  anchorEl: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['close', 'settings', 'logout'])

const menuRef = ref(null)
const position = ref({ top: 0, left: 0 })

function updatePosition() {
  const anchor = props.anchorEl
  if (!anchor || typeof anchor.getBoundingClientRect !== 'function') return

  const rect = anchor.getBoundingClientRect()
  const menuWidth = 168
  const viewportWidth = window.innerWidth
  let left = rect.right - menuWidth

  if (left < 8) {
    left = 8
  }

  if (left + menuWidth > viewportWidth - 8) {
    left = Math.max(8, viewportWidth - menuWidth - 8)
  }

  position.value = {
    top: rect.bottom + 6,
    left,
  }
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
    <Transition name="user-account-menu">
      <div
        v-if="open"
        ref="menuRef"
        class="user-account-menu"
        role="menu"
        aria-label="用户菜单"
        :style="{ top: `${position.top}px`, left: `${position.left}px` }"
      >
        <button
          type="button"
          class="user-account-menu__item"
          role="menuitem"
          @click="emit('settings')"
        >
          我的设置
        </button>
        <button
          type="button"
          class="user-account-menu__item user-account-menu__item--danger"
          role="menuitem"
          @click="emit('logout')"
        >
          退出登录
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.user-account-menu {
  position: fixed;
  z-index: calc(var(--z-modal) + 2);
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: min(168px, calc(100vw - 16px));
  padding: 6px;
  border: 1px solid var(--theme-border);
  border-radius: 10px;
  background: var(--theme-surface);
  box-shadow: var(--theme-shadow-md);
}

.user-account-menu__item {
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--theme-fg);
  font-size: 13px;
  text-align: left;
  cursor: default;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;
}

.user-account-menu__item:hover {
  background: var(--theme-bg-muted);
}

.user-account-menu__item--danger {
  color: #dc2626;
}

.user-account-menu__item--danger:hover {
  background: color-mix(in srgb, #dc2626 10%, var(--theme-bg-muted));
  color: #b91c1c;
}

:global([data-theme='dark']) .user-account-menu__item--danger {
  color: #f87171;
}

:global([data-theme='dark']) .user-account-menu__item--danger:hover {
  color: #fca5a5;
}

.user-account-menu-enter-active,
.user-account-menu-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.user-account-menu-enter-from,
.user-account-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
