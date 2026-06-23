/**
 * Storybook mock for @/composables/useOnlineStatus
 * Monitors window.__wpxMocks?.isOffline or subscribes to the mock bus
 * for per-story reactive updates.
 */
import { ref, computed, readonly } from 'vue'

const _isOffline = ref(false)

if (typeof window !== 'undefined') {
  window.__wpxOnlineStatus = {
    setOffline(offline) {
      _isOffline.value = offline
    },
  }

  // Subscribe to mock bus for reactive updates
  if (window.__wpxMockBus) {
    window.__wpxMockBus.subscribe((mocks) => {
      if (mocks.isOffline != null) {
        _isOffline.value = mocks.isOffline
      }
    })
  } else {
    // Fallback: check once
    if (window.__wpxMocks?.isOffline) {
      _isOffline.value = true
    }
  }
}

export function useOnlineStatus() {
  return {
    isOnline: computed(() => !_isOffline.value),
    isOffline: readonly(_isOffline),
    networkRequiredTooltip: '需要网络连接',
  }
}
