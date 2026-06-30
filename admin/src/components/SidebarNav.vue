<template>
  <aside
    :class="[
      'flex flex-col bg-white border-r border-gray-100 transition-all duration-200',
      collapsed ? 'w-[var(--wpx-sidebar-w-collapsed)]' : 'w-[var(--wpx-sidebar-w)]'
    ]"
  >
    <!-- 顶部 Logo -->
    <div
      class="flex items-center h-[var(--wpx-topbar-h)] px-4 border-b border-gray-100"
    >
      <div class="flex items-center gap-2 overflow-hidden">
        <img
          src="@/assets/logo.svg"
          alt="WPX"
          class="w-8 h-8 shrink-0"
        >
        <span
          v-if="!collapsed"
          class="text-base font-bold wpx-gradient-text whitespace-nowrap"
        >WPX Admin</span>
      </div>
    </div>

    <!-- 导航 -->
    <nav class="flex-1 overflow-y-auto py-3 px-2">
      <ul class="space-y-1">
        <li
          v-for="item in visibleMenus"
          :key="item.path"
        >
          <router-link
            :to="item.path"
            :class="[
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              collapsed ? 'justify-center' : '',
              isActive(item.path)
                ? 'bg-wpx-gradient-soft text-primary-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            ]"
            :title="collapsed ? item.title : ''"
          >
            <span class="text-lg shrink-0">{{ item.icon }}</span>
            <span
              v-if="!collapsed"
              class="truncate"
            >{{ item.title }}</span>
          </router-link>
        </li>
      </ul>
    </nav>

    <!-- 底部：折叠按钮 -->
    <div class="border-t border-gray-100 p-2">
      <button
        type="button"
        class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        @click="$emit('toggle')"
      >
        <span class="text-base">{{ collapsed ? '»' : '«' }}</span>
        <span v-if="!collapsed">收起侧栏</span>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

defineProps({
  collapsed: { type: Boolean, default: false }
})
defineEmits(['toggle'])

const route = useRoute()
const auth = useAuthStore()

// 菜单元信息：permission 用于过滤
const ALL_MENUS = [
  { path: '/dashboard', title: '仪表盘', icon: '📊', permission: 'module:dashboard' },
  { path: '/users', title: '用户管理', icon: '👥', permission: 'module:users' },
  { path: '/models', title: 'AI 模型配置', icon: '🤖', permission: 'module:models' },
  { path: '/fonts', title: '字体商店', icon: '🔤', permission: 'module:fonts' },
  { path: '/skills', title: 'Skills 管理', icon: '⚡', permission: 'module:skills' },
  { path: '/orders', title: 'Token 与订单', icon: '💰', permission: 'module:orders' },
  { path: '/announcements', title: '公告与版本', icon: '📢', permission: 'module:announcements' },
  { path: '/settings', title: '系统设置', icon: '⚙️', permission: 'module:settings' },
  { path: '/logs', title: '操作日志', icon: '📋', permission: 'module:logs' },
  { path: '/feedbacks', title: 'Bug & 反馈', icon: '🐛', permission: 'module:feedbacks' }
]

const visibleMenus = computed(() =>
  ALL_MENUS.filter((m) => auth.can(m.permission))
)

function isActive(path) {
  // 仪表盘精确匹配；其他路径前缀匹配
  if (path === '/dashboard') return route.path === '/dashboard'
  return route.path === path || route.path.startsWith(path + '/')
}
</script>