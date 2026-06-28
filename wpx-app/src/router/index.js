import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import { isElectron } from '@/utils/electron'
import { getLaunchSearchParams } from '@/utils/windowContext'

/** Electron / file:// 加载时必须用 hash 模式，否则路由与资源解析失败 */
function resolveRouterHistory() {
  if (typeof window !== 'undefined') {
    if (
      window.__WPX_ELECTRON__ === true ||
      window.electronAPI ||
      window.location.protocol === 'file:'
    ) {
      return createWebHashHistory()
    }
  }

  if (isElectron()) {
    return createWebHashHistory()
  }

  return createWebHistory(import.meta.env.BASE_URL)
}

function buildEditorQuery() {
  const params = getLaunchSearchParams()
  const query = {}

  const windowId = params.get('windowId')
  if (windowId) {
    query.windowId = windowId
  }

  const docPath = params.get('docPath')
  if (docPath) {
    query.docPath = docPath
  }

  return query
}

const router = createRouter({
  history: resolveRouterHistory(),
  routes: [
    {
      path: '/',
      component: AppLayout,
      children: [
        {
          path: '',
          name: 'landing',
          // Landing 仅在 Web 端（history 模式）有意义；Electron 仍以 editor 为首屏
          component: () => import('@/views/LandingView.vue'),
          meta: {
            title: 'WPX · AI 智能文档编辑器',
            description: 'AI 驱动的智能文档编辑器，专为教学、学术与内容创作打造。',
            webOnly: true,
          },
        },
        {
          path: 'editor',
          name: 'editor',
          alias: '',
          component: () => import('@/layouts/EditorLayout.vue'),
          meta: { title: '文档' },
        },
        // ===== 应用内嵌认证配套页面（Web 端） =====
        // 邮件中的验证链接 / 重置链接会落到这里。
        // 客户端路由走 hash 模式时也会被这些 path 匹配，但 Web 端是主要场景。
        {
          path: 'auth/verify-email',
          name: 'auth-verify-email',
          component: () => import('@/views/auth/VerifyEmailView.vue'),
          meta: { title: '验证邮箱 · WPX', webOnly: true, public: true }
        },
        {
          path: 'auth/forgot-password',
          name: 'auth-forgot-password',
          component: () => import('@/views/auth/ForgotPasswordView.vue'),
          meta: { title: '找回密码 · WPX', webOnly: true, public: true }
        },
        {
          path: 'auth/reset-password',
          name: 'auth-reset-password',
          component: () => import('@/views/auth/ResetPasswordView.vue'),
          meta: { title: '重置密码 · WPX', webOnly: true, public: true }
        },
        {
          path: 'library',
          name: 'library',
          component: () => import('@/views/LibraryView.vue'),
          meta: { title: '文库' },
        },
        {
          path: 'materials',
          name: 'materials',
          component: () => import('@/views/MaterialsView.vue'),
          meta: { title: '资料库' },
        },
        {
          path: 'fonts',
          name: 'fonts',
          component: () => import('@/views/FontMarket.vue'),
          meta: { title: '字体商店' },
        },
        {
          path: 'font-market',
          name: 'font-market',
          redirect: { name: 'fonts' },
        },
        {
          path: 'token/recharge',
          name: 'token-recharge',
          component: () => import('@/views/TokenRecharge.vue'),
          meta: { title: 'Token 充值' },
        },
        {
          path: 'my-fonts',
          name: 'my-fonts',
          component: () => import('@/views/MyFonts.vue'),
          meta: { title: '我的字体' },
        },
        {
          path: 'settings',
          component: () => import('@/views/Settings.vue'),
          meta: { title: '设置' },
          redirect: { name: 'settings-agent' },
          children: [
            {
              path: 'agent',
              name: 'settings-agent',
              component: () => import('@/views/settings/AgentSettings.vue'),
              meta: { title: 'Agent 设置' },
            },
            {
              path: 'skills',
              name: 'settings-skills',
              component: () => import('@/views/settings/SkillsSettings.vue'),
              meta: { title: 'Skills 管理' },
            },
            {
              path: 'models',
              name: 'settings-models',
              component: () => import('@/views/settings/ModelSettings.vue'),
              meta: { title: '我的模型' },
            },
            {
              path: 'jcode',
              name: 'settings-jcode',
              component: () => import('@/views/settings/JcodeSettings.vue'),
              meta: { title: 'AI 引擎' },
            },
            {
              path: 'fonts',
              name: 'settings-fonts',
              component: () => import('@/views/settings/FontsSettings.vue'),
              meta: { title: '字体与 Token' },
            },
            {
              path: 'general',
              name: 'settings-general',
              component: () => import('@/views/settings/GeneralSettings.vue'),
              meta: { title: '通用设置' },
            },
            {
              path: 'privacy',
              name: 'settings-privacy',
              component: () => import('@/views/settings/PrivacySettings.vue'),
              meta: { title: '数据与隐私' },
            },
            {
              path: 'about',
              name: 'settings-about',
              component: () => import('@/views/settings/AboutSettings.vue'),
              meta: { title: '关于' },
            },
          ],
        },
      ],
    },
  ],
})

router.beforeEach((to, _from) => {
  // Web 端：若用户访问根路径但带了 docPath / windowId / 直达 editor 链接，正常通过。
  // Electron（hash 模式）始终以 editor 为首屏：若误进入 landing，重定向回 editor。
  if (to.name === 'landing' && to.meta?.webOnly && isElectron()) {
    return { name: 'editor' }
  }
  if (to.name === 'editor' && !to.query.windowId && !to.query.docPath) {
    const launchQuery = buildEditorQuery()
    if (Object.keys(launchQuery).length > 0) {
      return { ...to, query: { ...launchQuery, ...to.query } }
    }
  }
  return true
})

router.afterEach((to) => {
  // 标题回退：landing 由视图内部 setMeta 写入（避免与 description 一同回退）
  if (to.name === 'landing') return
  document.title = to.meta.title ? `${to.meta.title} · WPX` : 'WPX'
})

export default router
