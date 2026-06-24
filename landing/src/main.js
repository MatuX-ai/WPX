/**
 * main.js · 应用入口工厂
 *
 * 同时支持浏览器（SPA 客户端）和 SSR（Node 渲染）：
 *  - 客户端：createApp().app.mount('#app')
 *  - SSR：    await renderToString(createApp().app)
 *
 * 为了正确预渲染所有路由（包括动态导入的 view），我们在 SSR 阶段
 * 提前 await router.isReady()，触发路由组件解析。
 */

import { createSSRApp } from 'vue'
import App from './App.vue'
import { createRouter } from './router'

export function createApp(opts = {}) {
  const app = createSSRApp(App)
  const router = createRouter({ ssr: !!opts.ssr, initialUrl: opts.initialUrl || '/' })
  app.use(router)
  return { app, router }
}

// 兼容旧用法：仍可被 entry-client / entry-server 直接复用
export default createApp
