import { useRoute, useRouter } from 'vue-router'

/**
 * 打开设置页，保留当前窗口 query（如 windowId）。
 */
export function useOpenSettings() {
  const router = useRouter()
  const route = useRoute()

  function openSettings(routeName) {
    if (routeName) {
      return router.push({
        name: routeName,
        query: { ...route.query },
      })
    }

    return router.push({
      path: '/settings',
      query: { ...route.query },
    })
  }

  return {
    openSettings,
  }
}
