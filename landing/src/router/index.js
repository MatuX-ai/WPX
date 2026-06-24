/**
 * router/index.js · 路由配置
 *
 * 既能用于浏览器（SPA）也能用于 SSR（Node 渲染）。
 * SSR 模式下：使用 createMemoryHistory，避免依赖 window/document
 * 浏览器模式下：使用 createWebHistory，启用 History API
 *
 * 同时提供：
 *  - createRouter() 工厂
 *  - applyRouteMetaToDom(route)  把路由 meta 同步到当前 document（仅客户端）
 */

import { createRouter as createVueRouter, createWebHistory, createMemoryHistory } from 'vue-router'
import { siteConfig } from '../config/seo.js'

// 全部路由按需懒加载：每个 view 单独成一个 chunk
const HomeView = () => import('../views/HomeView.vue')

export const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: {
      title: siteConfig.title,
      description: siteConfig.description,
      keywords: siteConfig.keywords.join(', '),
      image: siteConfig.ogImage,
      type: 'website'
    }
  },
  {
    path: '/blog',
    name: 'blog',
    component: () => import('../views/BlogView.vue'),
    meta: {
      title: '博客 · WPX',
      description:
        'WPX 团队的产品故事、技术细节与设计哲学 —— 慢一点，更深一点。',
      keywords: 'WPX 博客,产品更新,技术分享,设计哲学',
      image: siteConfig.ogImage,
      type: 'article'
    }
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/AboutView.vue'),
    meta: {
      title: '关于 · WPX',
      description:
        'WPX 由一支相信「写作值得被认真对待」的小团队打造，了解我们的价值观与团队成员。',
      keywords: 'WPX 团队,关于,联系我们,本地优先',
      image: siteConfig.ogImage,
      type: 'website'
    }
  },
  {
    path: '/changelog',
    name: 'changelog',
    component: () => import('../views/ChangelogView.vue'),
    meta: {
      title: '更新日志 · WPX',
      description:
        'WPX 的每一次小步快跑 —— 新功能、性能优化、Bug 修复，一目了然。',
      keywords: 'WPX 更新日志,版本历史,Changelog,发布说明',
      image: siteConfig.ogImage,
      type: 'website'
    }
  },
  {
    path: '/docs',
    name: 'docs',
    component: () => import('../views/DocsView.vue'),
    meta: {
      title: '文档 · WPX',
      description:
        '从安装到高级定制，WPX 的完整使用文档。包含快速上手、核心功能、API 参考与最佳实践。',
      keywords: 'WPX 文档,使用指南,API,教程,快速上手',
      image: siteConfig.ogImage,
      type: 'website'
    }
  },
  {
    path: '/skills',
    name: 'skills',
    component: () => import('../views/SkillsView.vue'),
    meta: {
      title: 'Skills 市场 · WPX',
      description:
        '把 WPX 变成最懂你的工作台 —— 学生专用、教师专用、通用 Skills 一应俱全，按需启用。',
      keywords: 'WPX Skills,AI 技能,学生 Skill,教师 Skill,Skills 市场',
      image: siteConfig.ogImage,
      type: 'website'
    }
  },
  {
    path: '/fonts',
    name: 'fonts',
    component: () => import('../views/FontsView.vue'),
    meta: {
      title: '字体商店 · WPX',
      description:
        '8 款免费开源字体即装即用，在线字体按需下载，商业字体按字付费。好看、合法、不打扰。',
      keywords: 'WPX 字体,免费字体,开源字体,商业字体,思源黑体,霞鹜文楷',
      image: siteConfig.ogImage,
      type: 'website'
    }
  },
  {
    path: '/legal/privacy',
    name: 'legal-privacy',
    component: () => import('../views/PrivacyView.vue'),
    meta: {
      title: '隐私政策 · WPX',
      description:
        'WPX 致力于把数据留在本地。本政策详解我们收集、使用、存储和保护你信息的方式。',
      keywords: 'WPX 隐私政策,数据保护,本地优先,个人信息',
      image: siteConfig.ogImage,
      type: 'website'
    }
  },
  {
    path: '/legal/terms',
    name: 'legal-terms',
    component: () => import('../views/TermsView.vue'),
    meta: {
      title: '用户协议 · WPX',
      description:
        'WPX 用户协议：使用许可、用户行为规范、知识产权与免责声明的完整说明。',
      keywords: 'WPX 用户协议,服务条款,免责声明,知识产权',
      image: siteConfig.ogImage,
      type: 'website'
    }
  },
  {
    path: '/legal/licenses',
    name: 'legal-licenses',
    component: () => import('../views/LicensesView.vue'),
    meta: {
      title: '开源许可证 · WPX',
      description:
        'WPX 站在开源的肩膀上 —— 内置字体、核心依赖的许可证清单与致谢。',
      keywords: 'WPX 开源,许可证,MIT,OFL,字体版权,依赖致谢',
      image: siteConfig.ogImage,
      type: 'website'
    }
  },
  {
    // 兼容带 hash 的旧链接（如 /#/blog）
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue'),
    meta: {
      title: '404 · 页面走丢了',
      description: '这一页走丢了。不如回到首页，从头开始？',
      image: siteConfig.ogImage,
      type: 'website',
      noindex: true
    }
  }
]

/**
 * 工厂：创建路由实例
 * @param {object} opts
 *   - ssr: 布尔，是否 SSR 模式（默认 false，使用 web history）
 *   - initialUrl: SSR 模式下的初始 URL
 */
export function createRouter(opts = {}) {
  const { ssr = false, initialUrl = '/' } = opts
  const history = ssr ? createMemoryHistory(initialUrl) : createWebHistory()
  const router = createVueRouter({
    history,
    routes,
    scrollBehavior(to, from, savedPosition) {
      if (savedPosition) return savedPosition
      if (to.hash) return { el: to.hash, behavior: 'smooth', top: 80 }
      return { left: 0, top: 0, behavior: 'smooth' }
    }
  })
  return router
}

/**
 * 把当前路由的 meta 同步到 document.head（仅客户端使用）
 * - 通过 querySelector 复用已有 meta，避免重复创建
 * - 任何 DOM 调用都用 typeof document 守护，SSR 环境跳过
 */
export function applyRouteMetaToDom(route, opts = {}) {
  if (typeof document === 'undefined') return
  const meta = route?.meta || {}
  const siteUrl =
    (typeof window !== 'undefined' && window.__WPX_SITE_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SITE_URL) ||
    'https://wpx.app'
  const fullUrl = siteUrl.replace(/\/$/, '') + (route?.fullPath || '/')

  if (meta.title) document.title = meta.title

  setMetaName('description', meta.description)
  setMetaName('keywords', meta.keywords)
  setLinkRel('canonical', fullUrl)
  setMetaName('robots', meta.noindex ? 'noindex, nofollow' : 'index, follow')

  if (meta.title) {
    setMetaProperty('og:title', meta.title)
    setMetaName('twitter:title', meta.title)
  }
  if (meta.description) {
    setMetaProperty('og:description', meta.description)
    setMetaName('twitter:description', meta.description)
  }
  if (meta.image) {
    const imageUrl = /^https?:/.test(meta.image)
      ? meta.image
      : siteUrl.replace(/\/$/, '') + meta.image
    setMetaProperty('og:image', imageUrl)
    setMetaName('twitter:image', imageUrl)
  }
  setMetaProperty('og:url', fullUrl)
  setMetaName('twitter:url', fullUrl)
  setMetaProperty('og:type', meta.type || 'website')
}

// ========== DOM helpers ==========
function setMetaName(name, value) {
  if (!value) return
  let el = document.head.querySelector(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

function setMetaProperty(prop, value) {
  if (!value) return
  let el = document.head.querySelector(`meta[property="${prop}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', prop)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

function setLinkRel(rel, href) {
  if (!href) return
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

// ========== 默认实例（向后兼容：直接 import router from '...'） ==========
// 仅在浏览器环境创建默认实例（SSR 时不触发）
const _defaultRouter =
  typeof window !== 'undefined'
    ? createRouter({ ssr: false })
    : null
// 仅在浏览器注册 afterEach DOM 同步钩子
if (_defaultRouter && typeof window !== 'undefined') {
  _defaultRouter.afterEach((to) => applyRouteMetaToDom(to))
}
export default _defaultRouter
