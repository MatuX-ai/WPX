/**
 * WPX AI 本地指令匹配引擎
 *
 * 职责：
 * - 接收用户原始输入 + 当前上下文，顺序匹配 LOCAL_COMMANDS
 * - 命中：检查 condition -> 执行 action -> 包装为 CommandResult
 * - 未命中：返回 { type: 'ai' }，调用方回退到 AI 模型流程
 *
 * 关键设计：
 * - 引擎是无状态的（不持有 store 引用），由调用方注入 context
 * - 支持动态注册新指令（registerLocalCommand），供 SkillHub 扩展
 * - 内置 placeholder 轮转辅助
 */

import {
  LOCAL_COMMANDS,
  LOCAL_COMMAND_PLACEHOLDERS,
  LOCAL_COMMANDS_COUNT,
} from '@/data/local-commands'

/**
 * @typedef {Object} CommandContext
 * @property {import('@tiptap/core').Editor | null} editor
 * @property {boolean} hasSelection
 * @property {boolean} hasCursor
 * @property {string} [clipboardText]
 * @property {boolean} [isDark]
 * @property {boolean} [focusMode]
 * @property {string} [documentContent]
 * @property {boolean} [isDocumentDirty]
 * @property {import('vue').Router} [router]
 * @property {object} [themeStore]
 * @property {object} [userPreferencesStore]
 * @property {object} [appStore]
 * @property {() => void} [openSettings]
 * @property {() => void} [openFontMarket]
 * @property {() => void} [openLibrary]
 * @property {() => void} [openKnowledgePanel]
 * @property {() => void} [exportPdf]
 * @property {() => void} [exportDocx]
 * @property {() => void} [exportMd]
 * @property {() => void} [saveDocument]
 * @property {() => void} [newDocument]
 * @property {() => void} [insertImage]
 * @property {() => void} [insertTable]
 * @property {() => void} [insertHr]
 * @property {() => void} [insertDate]
 * @property {() => void} [insertTime]
 * @property {() => boolean} [toggleFocusMode]
 * @property {() => boolean} [toggleDarkMode]
 * @property {string} [matchedText]
 * @property {string} [commandId]
 */

/**
 * @typedef {Object} CommandResult
 * @property {'local' | 'ai'} type
 * @property {boolean} [success]
 * @property {string} [message]
 * @property {string} [commandId]
 * @property {string} [category]
 * @property {string} [icon]
 * @property {any} [data]
 */

// 内部已注册指令集合（基础 + 动态追加）。
/** @type {import('@/data/local-commands').LocalCommandDef[]} */
const registry = [...LOCAL_COMMANDS]

/**
 * 按 priority 倒序排序（数字越大越优先）。同 priority 内保持数组原顺序。
 */
function sortByPriorityDesc(list) {
  return list
    .map((cmd, idx) => ({ cmd, idx }))
    .sort((a, b) => {
      if (b.cmd.priority !== a.cmd.priority) return b.cmd.priority - a.cmd.priority
      return a.idx - b.idx
    })
    .map((entry) => entry.cmd)
}

/**
 * 规范化用户输入：
 * - 去除首尾空白
 * - 折叠中间连续空白
 * - 保留原始文本用于 matchedText
 */
function normalizeInput(input) {
  if (typeof input !== 'string') return ''
  return input.trim().replace(/\s+/g, ' ')
}

/**
 * 检查命令的任一正则是否命中
 * @param {import('@/data/local-commands').LocalCommandDef} cmd
 * @param {string} text
 * @returns {boolean}
 */
function matchAnyPattern(cmd, text) {
  if (!Array.isArray(cmd.patterns) || cmd.patterns.length === 0) return false
  for (const pattern of cmd.patterns) {
    if (pattern instanceof RegExp && pattern.test(text)) {
      return true
    }
  }
  return false
}

/**
 * 处理用户输入，返回匹配结果
 * @param {string} input 用户原始输入
 * @param {CommandContext} context 上下文（由调用方组装）
 * @returns {CommandResult}
 */
export function processUserInput(input, context = {}) {
  const text = normalizeInput(input)
  if (!text) {
    return { type: 'ai' }
  }

  const sorted = sortByPriorityDesc(registry)

  for (const cmd of sorted) {
    if (!matchAnyPattern(cmd, text)) continue

    // 命中后，把 matchedText / commandId 注入 context
    const enrichedContext = Object.assign({}, context, {
      matchedText: text,
      commandId: cmd.id,
    })

    let conditionPassed = true
    try {
      conditionPassed = cmd.condition ? cmd.condition(enrichedContext) : true
    } catch (error) {
      console.warn(`[useLocalCommands] Condition check failed for "${cmd.id}":`, error)
      conditionPassed = false
    }

    if (!conditionPassed) {
      return {
        type: 'local',
        success: false,
        message: typeof cmd.failureMessage === 'function'
          ? cmd.failureMessage(enrichedContext)
          : cmd.failureMessage,
        commandId: cmd.id,
        category: cmd.category,
        icon: 'warning',
      }
    }

    let actionResult
    try {
      actionResult = cmd.action
        ? cmd.action(enrichedContext)
        : { ok: true }
    } catch (error) {
      console.error(`[useLocalCommands] Action failed for "${cmd.id}":`, error)
      return {
        type: 'local',
        success: false,
        message: `❌ 执行失败：${error?.message || '未知错误'}`,
        commandId: cmd.id,
        category: cmd.category,
        icon: 'error',
      }
    }

    // 允许 action 直接返回 { ok: false, message } 表达"业务失败"（如导出失败）
    if (actionResult && actionResult.ok === false) {
      return {
        type: 'local',
        success: false,
        message: actionResult.message || '⚠️ 操作未完成',
        commandId: cmd.id,
        category: cmd.category,
        icon: 'warning',
        data: actionResult.data,
      }
    }

    const successMessage = actionResult?.message
      || (typeof cmd.successMessage === 'function'
        ? cmd.successMessage(enrichedContext)
        : cmd.successMessage)

    return {
      type: 'local',
      success: true,
      message: successMessage,
      commandId: cmd.id,
      category: cmd.category,
      icon: 'success',
      data: actionResult?.data,
    }
  }

  return { type: 'ai' }
}

/**
 * 动态注册一条本地指令（用于 SkillHub 扩展或测试）
 * @param {import('@/data/local-commands').LocalCommandDef} command
 */
export function registerLocalCommand(command) {
  if (!command || typeof command !== 'object' || !command.id) {
    console.warn('[useLocalCommands] Invalid command registration:', command)
    return false
  }

  // 避免重复注册同 id
  const existing = registry.findIndex((c) => c.id === command.id)
  if (existing >= 0) {
    registry[existing] = command
  } else {
    registry.push(command)
  }
  return true
}

/**
 * 注销一条本地指令
 * @param {string} commandId
 */
export function unregisterLocalCommand(commandId) {
  const idx = registry.findIndex((c) => c.id === commandId)
  if (idx >= 0) {
    registry.splice(idx, 1)
    return true
  }
  return false
}

/**
 * 获取已注册指令数量
 */
export function getRegisteredCommandCount() {
  return registry.length
}

/**
 * 获取用于 placeholder 轮转的示例短语
 * @returns {string[]}
 */
export function getLocalCommandPlaceholders() {
  return LOCAL_COMMAND_PLACEHOLDERS.slice()
}

/**
 * 获取基础指令数量（不含动态注册）
 */
export function getBuiltInCommandCount() {
  return LOCAL_COMMANDS_COUNT
}

/**
 * 测试用：重置注册表到初始状态
 * @internal
 */
export function __resetRegistry() {
  registry.splice(0, registry.length, ...LOCAL_COMMANDS)
}

/**
 * 便捷 hook：在 Vue 组件中使用
 */
export function useLocalCommands() {
  return {
    processUserInput,
    registerLocalCommand,
    unregisterLocalCommand,
    getRegisteredCommandCount,
    getLocalCommandPlaceholders,
    getBuiltInCommandCount,
  }
}

export default {
  processUserInput,
  registerLocalCommand,
  unregisterLocalCommand,
  getRegisteredCommandCount,
  getLocalCommandPlaceholders,
  getBuiltInCommandCount,
  useLocalCommands,
}
