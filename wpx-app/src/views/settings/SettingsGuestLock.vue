<script setup>
defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['login'])

function handleLogin() {
  emit('login')
}
</script>

<template>
  <div
    class="settings-guest-lock"
    role="presentation"
    @click="handleLogin"
    @keydown.enter.prevent="handleLogin"
    @keydown.space.prevent="handleLogin"
  >
    <button
      type="button"
      class="settings-guest-lock__cta"
      :disabled="loading"
      @click.stop="handleLogin"
    >
      {{ loading ? '登录中…' : '登录后解锁' }}
    </button>
  </div>
</template>

<style scoped>
.settings-guest-lock {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--theme-bg, #fff) 72%, transparent);
  backdrop-filter: blur(2px);
  cursor: pointer;
}

.settings-guest-lock__cta {
  border: none;
  border-radius: var(--theme-radius-md, 10px);
  background: var(--theme-accent);
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 8px 24px rgb(37 99 235 / 24%);
  transition: background 0.15s ease, transform 0.15s ease;
}

.settings-guest-lock__cta:hover:not(:disabled) {
  background: var(--theme-accent-hover);
  transform: translateY(-1px);
}

.settings-guest-lock__cta:disabled {
  opacity: 0.75;
  cursor: wait;
}
</style>
