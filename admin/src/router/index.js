import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { hasPermission } from '@/utils/roles'

// ============ 路由表 ============
const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/LoginView.vue'),
    meta: { title: '登录 · WPX 管理后台', public: true }
  },

  // 受保护的主区域：使用 AdminLayout
  {
    path: '/',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: (to) => {
          // 首次进入 / ：等 auth store 恢复完会话后再跳转
          // 这里给一个占位：实际跳转由全局 afterEach 调整
          return { name: 'root-redirect' }
        },
        name: 'root-redirect'
      },

      // 仪表盘
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/dashboard/DashboardView.vue'),
        meta: {
          title: '仪表盘 · WPX 管理后台',
          permission: 'module:dashboard'
        }
      },

      // 用户管理
      {
        path: 'users',
        name: 'users',
        component: () => import('@/views/users/UsersView.vue'),
        meta: { title: '用户管理 · WPX 管理后台', permission: 'module:users' }
      },
      {
        path: 'users/visitors',
        name: 'users-visitors',
        component: () => import('@/views/users/VisitorsView.vue'),
        meta: {
          title: '访客统计 · WPX 管理后台',
          permission: 'module:users'
        }
      },
      {
        path: 'users/:id',
        name: 'user-detail',
        component: () => import('@/views/users/UserDetailView.vue'),
        meta: { title: '用户详情 · WPX 管理后台', permission: 'module:users' }
      },

      // AI 模型配置（公共模型 + 调用监控 两个 Tab）
      {
        path: 'models',
        name: 'models',
        component: () => import('@/views/models/ModelConfigView.vue'),
        meta: { title: 'AI 模型配置 · WPX 管理后台', permission: 'module:models' }
      },
      {
        path: 'models/monitor',
        redirect: '/models',
        meta: { permission: 'module:models' }
      },

      // 字体商店（字体库 + 使用统计 两个 Tab）
      {
        path: 'fonts',
        name: 'fonts',
        component: () => import('@/views/fonts/FontManageView.vue'),
        meta: { title: '字体商店 · WPX 管理后台', permission: 'module:fonts' }
      },
      {
        path: 'fonts/stats',
        redirect: '/fonts',
        meta: { permission: 'module:fonts' }
      },

      // Skills 管理（内置 / 在线 / 社区审核 三个 Tab）
      {
        path: 'skills',
        redirect: '/skills/builtin'
      },
      {
        path: 'skills/builtin',
        name: 'skills-builtin',
        component: () => import('@/views/skills/SkillsManageView.vue'),
        meta: { title: 'Skills 管理 · WPX 管理后台', permission: 'module:skills' }
      },
      {
        path: 'skills/online',
        redirect: '/skills/builtin'
      },
      {
        path: 'skills/community',
        redirect: '/skills/builtin'
      },

      // Token 与订单（充值订单 / 消费记录 / 收入统计 三个 Tab）
      {
        path: 'orders',
        redirect: '/orders/recharge'
      },
      {
        path: 'orders/recharge',
        name: 'orders-recharge',
        component: () => import('@/views/orders/TokenOrdersView.vue'),
        meta: { title: 'Token 与订单 · WPX 管理后台', permission: 'module:orders' }
      },
      {
        path: 'orders/consumption',
        redirect: '/orders/recharge'
      },
      {
        path: 'orders/revenue',
        redirect: '/orders/recharge'
      },

      // 公告
      {
        path: 'announcements',
        name: 'announcements',
        component: () => import('@/views/announcements/AnnouncementView.vue'),
        meta: {
          title: '应用公告 · WPX 管理后台',
          permission: 'module:announcements'
        }
      },
      // 版本
      {
        path: 'announcements/versions',
        name: 'announcements-versions',
        component: () => import('@/views/announcements/VersionView.vue'),
        meta: {
          title: '应用版本 · WPX 管理后台',
          permission: 'module:announcements'
        }
      },

      // 系统设置（系统配置 / CDN / 管理员账号 三个 Tab）
      {
        path: 'settings',
        redirect: '/settings/basic'
      },
      {
        path: 'settings/basic',
        name: 'settings-basic',
        component: () => import('@/views/settings/SystemSettingsView.vue'),
        meta: { title: '系统设置 · WPX 管理后台', permission: 'module:settings' }
      },
      {
        path: 'settings/cdn',
        redirect: '/settings/basic'
      },
      {
        path: 'settings/admins',
        redirect: '/settings/basic'
      },

      // 操作日志
      {
        path: 'logs',
        name: 'logs',
        component: () => import('@/views/settings/OperationLogView.vue'),
        meta: { title: '操作日志 · WPX 管理后台', permission: 'module:logs' }
      },

      // 权限不足
      {
        path: 'forbidden',
        name: 'forbidden',
        component: () => import('@/views/ForbiddenView.vue'),
        meta: { title: '无权访问 · WPX 管理后台' }
      }
    ]
  },

  // 顶栏"刷新当前页"跳转用的中转路由
  {
    path: '/redirect/:pathMatch(.*)*',
    name: 'redirect',
    component: () => import('@/views/RedirectView.vue'),
    meta: { public: true }
  },

  // 404
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '404 · WPX 管理后台', public: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { left: 0, top: 0 }
  }
})

// ============ 全局前置守卫 ============
router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore()

  // 首次进入时尝试恢复会话
  if (!auth.bootstrapped) {
    await auth.bootstrap()
  }

  // 公开路由：直接放行
  if (to.meta?.public) {
    // 已登录用户访问 /login 时，按角色跳到首页
    if (to.name === 'login' && auth.isAuthenticated) {
      return next(auth.homePath)
    }
    return next()
  }

  // 需要登录
  if (!auth.isAuthenticated) {
    const redirect = encodeURIComponent(to.fullPath)
    return next({ path: '/login', query: { redirect } })
  }

  // 权限校验：meta.permission 不存在则视为开放
  const required = to.meta?.permission
  if (required && !hasPermission(auth.role, required)) {
    return next({ name: 'forbidden' })
  }

  next()
})

router.afterEach((to) => {
  if (to.meta?.title) {
    document.title = to.meta.title
  }
})

export default router