import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import './styles/transitions.css'
import './styles/floating-window.css'
import App from './App.vue'
import router from './router'
import { useThemeStore } from '@/stores/theme'
import { useGeneralSettingsStore } from '@/stores/generalSettings'
import { useOnlineStatus } from '@/composables/useOnlineStatus'
import { useWindowFocus } from '@/composables/useWindowFocus'
import { isElectron } from '@/utils/electron'
import { primeLocalApiBase } from '@/utils/localApi'
import '@/composables/useWindowCloseInterceptor'
import {
  getDocPathFromUrl,
  getLaunchSearchParams,
  getWindowId,
  initWindowContext,
} from '@/utils/windowContext'

initWindowContext()

const app = createApp(App)
const pinia = createPinia()

pinia.use(({ store }) => {
  store.$wpx = Object.freeze({ windowId: getWindowId() })
})

app.use(pinia)
app.use(router)

useThemeStore(pinia).init()
useGeneralSettingsStore(pinia).initFromLocalStorage()
useOnlineStatus()
useWindowFocus()

async function syncEditorRoute() {
  const launchParams = getLaunchSearchParams()
  const query = { ...router.currentRoute.value.query }

  const windowId = getWindowId()
  if (windowId > 0) {
    query.windowId = String(windowId)
  }

  const docPath = getDocPathFromUrl() || launchParams.get('docPath')
  if (docPath) {
    query.docPath = docPath
  }

  if (router.currentRoute.value.name !== 'editor') {
    await router.replace({ name: 'editor', query })
    return
  }

  const currentQuery = router.currentRoute.value.query
  if (query.windowId !== currentQuery.windowId || query.docPath !== currentQuery.docPath) {
    await router.replace({ name: 'editor', query })
  }
}

async function bootstrap() {
  if (isElectron()) {
    await primeLocalApiBase()
  }

  await router.isReady()
  await syncEditorRoute()

  app.mount('#app')
}

function showBootstrapError(error) {
  const message = error instanceof Error ? error.message : String(error)
  const root = document.getElementById('app')
  if (root) {
    root.innerHTML = `
      <div style="padding:32px;font-family:system-ui,sans-serif;color:#1a1a1a;background:#fff;min-height:100vh;">
        <h1 style="font-size:18px;margin:0 0 12px;">WPX 启动失败</h1>
        <p style="margin:0 0 8px;color:#475569;">${message}</p>
        <p style="margin:0;color:#64748b;font-size:14px;">请关闭后重新安装，或联系技术支持。</p>
      </div>`
  }
}

bootstrap().catch((error) => {
  console.error('[bootstrap]', error)
  showBootstrapError(error)
})
