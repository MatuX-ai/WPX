/**
 * WPX 管理后台 - 角色权限定义
 *
 * 角色：
 *  - super_admin    超级管理员：全部模块 + 系统设置 + 管理员账号管理
 *  - operation_admin 运营管理员：用户、Token/订单、公告、字体审核、调用监控
 *  - content_editor 内容编辑：Skills 管理、字体商店内容更新
 *
 * 权限码（用于路由 meta 与按钮级控制）：
 *  - module:dashboard / users / models / fonts / skills / orders / announcements / settings / logs
 *  - action:view / create / update / delete / approve
 */

// 角色枚举
// 注意：'admin' 是后端 users 表第一个用户 bootstrap 时被授予的角色（见 server/models/user.js createUser）
// 它等价于前端的 super_admin（超级管理员）。前端需要兼容后端的 admin 命名。
export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin', // 后端 bootstrap 角色的别名，等同 SUPER_ADMIN
  OPERATION_ADMIN: 'operation_admin',
  CONTENT_EDITOR: 'content_editor'
})

// 角色中文名
export const ROLE_LABELS = Object.freeze({
  [ROLES.SUPER_ADMIN]: '超级管理员',
  [ROLES.ADMIN]: '超级管理员',
  [ROLES.OPERATION_ADMIN]: '运营管理员',
  [ROLES.CONTENT_EDITOR]: '内容编辑'
})

// 角色等级（数值越大权限越高）
// admin 与 super_admin 同等权限（兼容后端 bootstrap 命名）
const ROLE_LEVEL = Object.freeze({
  [ROLES.SUPER_ADMIN]: 100,
  [ROLES.ADMIN]: 100,
  [ROLES.OPERATION_ADMIN]: 50,
  [ROLES.CONTENT_EDITOR]: 10
})

/**
 * 模块 -> 允许访问的角色列表
 * key 为权限码（如 'module:users'），value 为允许的角色数组
 *
 * 注意：每个列表都同时接受 super_admin 和 admin（兼容后端 bootstrap 角色命名）
 */
export const MODULE_PERMISSIONS = Object.freeze({
  // 仪表盘：所有角色都能看
  'module:dashboard': [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.OPERATION_ADMIN,
    ROLES.CONTENT_EDITOR
  ],

  // 用户管理：超管 + 运营
  'module:users': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.OPERATION_ADMIN],

  // AI 模型配置：超管 + 运营
  'module:models': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.OPERATION_ADMIN],

  // 字体商店：超管 + 运营（审核）+ 内容编辑（更新内容）
  'module:fonts': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.OPERATION_ADMIN, ROLES.CONTENT_EDITOR],

  // Skills 管理：超管 + 内容编辑
  'module:skills': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.CONTENT_EDITOR],

  // Token 与订单：超管 + 运营
  'module:orders': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.OPERATION_ADMIN],

  // 公告与版本：超管 + 运营
  'module:announcements': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.OPERATION_ADMIN],

  // 系统设置：仅超管
  'module:settings': [ROLES.SUPER_ADMIN, ROLES.ADMIN],

  // 操作日志：超管 + 运营
  'module:logs': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.OPERATION_ADMIN],

  // 用户反馈：超管 + 运营
  'module:feedbacks': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.OPERATION_ADMIN]
})

/**
 * 角色 -> 默认首页（登录后跳转）
 * admin 别名到 super_admin 首页
 */
export const ROLE_HOME = Object.freeze({
  [ROLES.SUPER_ADMIN]: '/dashboard',
  [ROLES.ADMIN]: '/dashboard',
  [ROLES.OPERATION_ADMIN]: '/dashboard',
  [ROLES.CONTENT_EDITOR]: '/skills/builtin'
})

/**
 * 判断角色是否拥有指定权限码
 * @param {string|string[]} role 角色或角色列表
 * @param {string} permission 权限码，如 'module:users'
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  if (!role || !permission) return false
  const allowed = MODULE_PERMISSIONS[permission]
  if (!allowed) return false
  const roles = Array.isArray(role) ? role : [role]
  return roles.some((r) => allowed.includes(r))
}

/**
 * 判断角色等级是否 >= 期望等级
 */
export function hasRoleLevel(role, expected) {
  if (!role) return false
  return (ROLE_LEVEL[role] ?? -1) >= (ROLE_LEVEL[expected] ?? Infinity)
}

/**
 * 从 JWT 中解码角色
 * 注意：JWT 内容不应作为信任源，仅作为前端 UI 提示；
 * 后端需独立校验角色与权限。
 * 同时支持 sub 单值、roles 数组、role 字符串三种形式。
 */
export function decodeRoleFromJwt(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    // base64url -> base64
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    // 优先取顶层 role 字段，否则取 roles 数组第一个
    return payload.role || payload.roles?.[0] || null
  } catch (_e) {
    return null
  }
}

/**
 * 检查 JWT 是否已过期（基于 exp 字段，单位秒）
 */
export function isJwtExpired(token, skewSeconds = 30) {
  if (!token) return true
  const parts = token.split('.')
  if (parts.length !== 3) return true
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    if (!payload.exp) return false
    const nowSec = Math.floor(Date.now() / 1000)
    return payload.exp <= nowSec + skewSeconds
  } catch (_e) {
    return true
  }
}