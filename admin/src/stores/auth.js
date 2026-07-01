/**
 * 认证状态管理（Pinia）
 *
 * 负责：
 *  - 登录 / 登出 / 恢复会话
 *  - 持久化 token（localStorage）与当前用户（内存）
 *  - 暴露角色权限相关计算属性供侧边栏 / 路由守卫使用
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  login as apiLogin,
  fetchCurrentUser,
  logout as apiLogout
} from '@/utils/auth-api'
import { getToken, setToken, clearToken } from '@/utils/http'
import {
  ROLES,
  ROLE_LABELS,
  ROLE_HOME,
  hasPermission,
  isJwtExpired,
  decodeRoleFromJwt
} from '@/utils/roles'

const USER_KEY = 'wpx_admin_user'

function loadCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (_e) {
    return null
  }
}

function persistUser(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  } catch (_e) {
    /* noop */
  }
}

export const useAuthStore = defineStore('auth', () => {
  // ============ State ============
  const token = ref(getToken())
  const user = ref(loadCachedUser())
  const loading = ref(false)
  const bootstrapped = ref(false)

  // ============ Getters ============
  const isAuthenticated = computed(
    () => !!token.value && !isJwtExpired(token.value)
  )

  // 角色来源（按优先级）：
  //   1) user.role 顶层字段（兼容旧版定制登录返回）
  //   2) user.roles 数组的第一个元素（与后端 users 表 roles 字段对齐）
  //   3) 从 JWT payload 解出的 role/roles[0]
  const role = computed(() => {
    const u = user.value
    if (!u) return null
    if (u.role) return u.role
    if (Array.isArray(u.roles) && u.roles.length) return u.roles[0]
    if (token.value) return decodeRoleFromJwt(token.value)
    return null
  })

  // 完整的角色数组（用于 hasPermission 等需要多角色检查的场景）
  const roles = computed(() => {
    const u = user.value
    if (!u) return []
    if (Array.isArray(u.roles) && u.roles.length) return u.roles
    if (u.role) return [u.role]
    return []
  })

  const roleLabel = computed(() =>
    role.value ? ROLE_LABELS[role.value] || role.value : ''
  )

  const displayName = computed(
    () => user.value?.name || user.value?.nickname || user.value?.email || '管理员'
  )

  const avatar = computed(() => user.value?.avatar || user.value?.picture || '')

  const homePath = computed(() =>
    role.value ? ROLE_HOME[role.value] || '/dashboard' : '/dashboard'
  )

  function can(permission) {
    return hasPermission(role.value, permission)
  }

  // ============ Actions ============

  /**
   * 应用启动时尝试恢复会话
   *  - 如果 localStorage 中有未过期的 token，调用 /api/auth/me 校验并刷新 user
   *  - 否则清空状态
   */
  async function bootstrap() {
    if (bootstrapped.value) return
    bootstrapped.value = true

    if (!token.value || isJwtExpired(token.value)) {
      clearToken()
      token.value = ''
      user.value = null
      persistUser(null)
      return
    }

    // 若 user 未缓存，尝试从 JWT 解出角色占位
    if (!user.value) {
      const decodedRole = decodeRoleFromJwt(token.value)
      if (decodedRole) {
        user.value = { role: decodedRole }
      }
    }

    try {
      const me = await fetchCurrentUser()
      if (me && typeof me === 'object') {
        // 兼容 { data: user } 与直接 user 两种返回
        const u = me.data || me.user || me
        user.value = u
        persistUser(u)
      }
    } catch (_e) {
      // token 失效或后端不可用：保留 token，由后续 401 拦截器处理
    }
  }

  /**
   * 登录
   * @param {{ email: string, password: string, captcha?: string }} payload
   */
  async function login(payload) {
    loading.value = true
    try {
      const res = await apiLogin(payload)
      // 兼容多种返回结构：
      //   { token, user } | { data: { token, user } } | { access_token, profile }
      const t = res?.token || res?.access_token || res?.data?.token
      const u =
        res?.user || res?.profile || res?.data?.user || res?.data?.profile || {}

      if (!t) {
        throw new Error('登录响应缺少 token，请联系管理员')
      }

      token.value = t
      setToken(t)
      user.value = u
      persistUser(u)
      return u
    } finally {
      loading.value = false
    }
  }

  /**
   * 登出
   */
  async function logout() {
    await apiLogout()
    token.value = ''
    user.value = null
    clearToken()
    persistUser(null)
  }

  /**
   * 更新当前用户信息（用于编辑个人资料等场景）
   */
  function setUser(u) {
    user.value = u
    persistUser(u)
  }

  return {
    // state
    token,
    user,
    loading,
    bootstrapped,
    // getters
    isAuthenticated,
    role,
    roles,
    roleLabel,
    displayName,
    avatar,
    homePath,
    // actions
    bootstrap,
    login,
    logout,
    setUser,
    can
  }
})

export { ROLES }