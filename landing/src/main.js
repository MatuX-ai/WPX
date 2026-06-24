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

// 全局样式：Tailwind base/components/utilities + WPX 自定义样式
// 必须显式 import，否则 Vite 不会把 style.css 纳入打包流水线，
// 导致 Tailwind PostCSS 不被处理，最终产物体积极小（仅含 scoped 样式）。
import './style.css'

export function createApp(opts = {}) {
  const app = createSSRApp(App)
  const router = createRouter({ ssr: !!opts.ssr, initialUrl: opts.initialUrl || '/' })
  app.use(router)
  return { app, router }
}

// 兼容旧用法：仍可被 entry-client / entry-server 直接复用
export default createApp
