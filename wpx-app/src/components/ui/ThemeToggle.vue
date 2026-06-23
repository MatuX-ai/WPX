<script setup>
import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()

const THEME_LABELS = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
}

const ariaLabel = computed(
  () => `当前${THEME_LABELS[themeStore.mode]}主题，点击切换`,
)

const title = computed(
  () => `${THEME_LABELS[themeStore.mode]} · 点击切换主题`,
)

function handleClick() {
  themeStore.cycleTheme()
}
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :title="title"
    :aria-label="ariaLabel"
    @click="handleClick"
  >
    <svg
      v-if="themeStore.mode === 'light'"
      class="theme-toggle__icon"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
      />
    </svg>

    <svg
      v-else-if="themeStore.mode === 'dark'"
      class="theme-toggle__icon"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
    </svg>

    <svg
      v-else
      class="theme-toggle__icon"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fill-rule="evenodd"
        d="M10 2a1 1 0 011 1v1.05a7.002 7.002 0 014.95 11.95H17a1 1 0 110 2h-1.05A7.002 7.002 0 012.05 4H1a1 1 0 110-2h1.05A7.002 7.002 0 0110 2.05V3a1 1 0 011-1zm0 4a5 5 0 100 10 5 5 0 000-10z"
        clip-rule="evenodd"
      />
    </svg>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--theme-radius-sm);
  background: transparent;
  color: var(--theme-fg-muted);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease;
}

.theme-toggle:hover {
  background: var(--theme-bg-muted);
  color: var(--theme-fg);
}

.theme-toggle:active {
  transform: scale(0.94);
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--theme-accent);
  outline-offset: 2px;
}

.theme-toggle__icon {
  width: 16px;
  height: 16px;
}
</style>
