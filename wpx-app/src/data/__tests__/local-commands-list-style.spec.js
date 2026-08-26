import { describe, it, expect, beforeEach, vi } from 'vitest'
import { processUserInput, __resetRegistry } from '@/composables/useLocalCommands'
import { LOCAL_COMMANDS } from '@/data/local-commands'

/**
 * 单元测试：列表样式扩展指令（CustomList 本地指令）
 *
 * 覆盖：
 *  1. 命令注册表里能找到 7 个新 list-* 指令
 *  2. condition isInList 在不在列表中时返回 false
 *  3. 命中规则如"列表用 1 2 3 数字"匹配 list-style-decimal
 *  4. 命中规则如"列表用大写字母"匹配 list-style-upper-alpha
 *  5. action 内部调用 editor 的 setListStyleType / setListIcon / unsetListStyle
 *  6. 失败条件（无编辑器 / 不在列表中）下提示正确的报错信息
 */

function buildEditorMock(overrides = {}) {
  // 跟踪每次调用，便于断言
  const calls = {
    setListStyleType: [],
    setListIcon: [],
    setListStart: [],
    unsetListStyle: 0,
    toggleBulletList: 0,
    toggleOrderedList: 0,
  }
  const chain = {
    focus: () => chain,
    setListStyleType: (v) => {
      calls.setListStyleType.push(v)
      return chain
    },
    setListIcon: (v) => {
      calls.setListIcon.push(v)
      return chain
    },
    setListStart: (v) => {
      calls.setListStart.push(v)
      return chain
    },
    unsetListStyle: () => {
      calls.unsetListStyle += 1
      return chain
    },
    toggleBulletList: () => {
      calls.toggleBulletList += 1
      return chain
    },
    toggleOrderedList: () => {
      calls.toggleOrderedList += 1
      return chain
    },
    run: () => true,
  }
  const editor = {
    isActive: (name) => {
      if (name === 'bulletList') return overrides.inBulletList === true
      if (name === 'orderedList') return overrides.inOrderedList === true
      return false
    },
    commands: {
      setListStyleType: chain.setListStyleType,
      setListIcon: chain.setListIcon,
      setListStart: chain.setListStart,
      unsetListStyle: chain.unsetListStyle,
      toggleBulletList: chain.toggleBulletList,
      toggleOrderedList: chain.toggleOrderedList,
    },
    chain: () => chain,
    __calls: calls,
  }
  return editor
}

beforeEach(() => {
  __resetRegistry()
})

describe('LOCAL_COMMANDS 注册表 - 列表样式', () => {
  it('注册了 7 个新的列表样式指令', () => {
    const listStyleIds = [
      'list-style-decimal',
      'list-style-upper-alpha',
      'list-style-lower-alpha',
      'list-style-upper-roman',
      'list-style-lower-roman',
      'list-icon-emoji',
      'clear-list-style',
    ]
    for (const id of listStyleIds) {
      const cmd = LOCAL_COMMANDS.find((c) => c.id === id)
      expect(cmd, `command ${id} should be registered`).toBeTruthy()
    }
  })

  it('所有 7 个 list-* 指令的 category 都是 "list"', () => {
    const listStyleIds = [
      'list-style-decimal',
      'list-style-upper-alpha',
      'list-style-lower-alpha',
      'list-style-upper-roman',
      'list-style-lower-roman',
      'list-icon-emoji',
      'clear-list-style',
    ]
    for (const id of listStyleIds) {
      const cmd = LOCAL_COMMANDS.find((c) => c.id === id)
      expect(cmd.category).toBe('list')
    }
  })
})

describe('processUserInput - 列表样式指令', () => {
  it('输入"列表用 1 2 3 数字" → list-style-decimal 触发', async () => {
    const editor = buildEditorMock({ inOrderedList: true })
    const result = await processUserInput('列表用 1 2 3 数字', { editor })
    expect(result.type).toBe('local')
    expect(result.commandId).toBe('list-style-decimal')
    expect(editor.__calls.setListStyleType).toContain('decimal')
  })

  it('输入"列表用 A B 大写字母" → list-style-upper-alpha 触发', async () => {
    const editor = buildEditorMock({ inBulletList: true })
    const result = await processUserInput('列表用 A B 大写字母', { editor })
    expect(result.type).toBe('local')
    expect(result.commandId).toBe('list-style-upper-alpha')
    expect(editor.__calls.setListStyleType).toContain('upper-alpha')
  })

  it('输入"emoji 当行首符号" → list-icon-emoji 触发，使用默认 ✓', async () => {
    const editor = buildEditorMock({ inBulletList: true })
    const result = await processUserInput('emoji 当行首符号', { editor })
    expect(result.type).toBe('local')
    expect(result.commandId).toBe('list-icon-emoji')
    expect(editor.__calls.setListIcon).toContain('✓')
  })

  it('输入"用 🔥 做行首符号" → list-icon-emoji 触发，使用 🔥', async () => {
    const editor = buildEditorMock({ inBulletList: true })
    const result = await processUserInput('用 🔥 做行首符号', { editor })
    expect(result.type).toBe('local')
    expect(result.commandId).toBe('list-icon-emoji')
    expect(editor.__calls.setListIcon).toContain('🔥')
  })

  it('输入"清除列表样式" → clear-list-style 触发', async () => {
    const editor = buildEditorMock({ inBulletList: true })
    const result = await processUserInput('清除列表样式', { editor })
    expect(result.type).toBe('local')
    expect(result.commandId).toBe('clear-list-style')
    expect(editor.__calls.unsetListStyle).toBe(1)
  })

  it('不在列表中时 list-style-decimal 返回 success=false 且 message 含失败提示', async () => {
    const editor = buildEditorMock({ inBulletList: false, inOrderedList: false })
    const result = await processUserInput('列表用 1 2 3 数字', { editor })
    expect(result.type).toBe('local')
    expect(result.success).toBe(false)
    expect(result.message).toMatch(/不在列表|请先点击到列表中/)
    // 关键：未触发 setListStyleType
    expect(editor.__calls.setListStyleType).toHaveLength(0)
  })
})
