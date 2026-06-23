import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import { isElectron } from '@/utils/electron'
import { getLaunchSearchParams } from '@/utils/windowContext'

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
  // Electron 用 file:// 加载，hash 模式且不要传 base: './'（会破坏路由解析）
  history: isElectron()
    ? createWebHashHistory()
    : createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: AppLayout,
      children: [
        {
          path: 'editor',
          name: 'editor',
          alias: '',
          component: () => import('@/layouts/EditorLayout.vue'),
          meta: { title: '文档' },
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
              meta: { title: '模型配置' },
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

router.beforeEach((to, _from, next) => {
  if (to.name === 'editor' && !to.query.windowId && !to.query.docPath) {
    const launchQuery = buildEditorQuery()
    if (Object.keys(launchQuery).length > 0) {
      next({ ...to, query: { ...launchQuery, ...to.query } })
      return
    }
  }
  next()
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · WPX` : 'WPX'
})

export default router
