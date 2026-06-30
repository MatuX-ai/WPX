/**
 * 资料库根目录解析逻辑单元测试
 *
 * 覆盖 `resolveKnowledgeRoot(prefs, userDataPath)`：
 *  - 优先读取 general.knowledgeBasePath（新字段）
 *  - 回退到顶层 libraryRootPath（旧字段兼容）
 *  - 都为空时回退到 app.getPath('userData')
 *  - trim 处理、null 防御、字段优先级
 *
 * 运行：npx vitest run --config electron/vitest.config.js knowledge-service-path
 */

import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { resolveKnowledgeRoot } = require('../knowledge-service.js')

const USER_DATA = '/mock/userData'

describe('resolveKnowledgeRoot — 资料库根目录解析', () => {
  describe('字段优先级', () => {
    it('优先使用 general.knowledgeBasePath（新字段）', () => {
      const result = resolveKnowledgeRoot(
        {
          general: { knowledgeBasePath: '/new/path' },
          libraryRootPath: '/legacy/path',
        },
        USER_DATA,
      )
      expect(result).toBe(path.join('/new/path', 'knowledge'))
    })

    it('回退到顶层 libraryRootPath（旧字段兼容）', () => {
      const result = resolveKnowledgeRoot(
        { libraryRootPath: '/legacy/path' },
        USER_DATA,
      )
      expect(result).toBe(path.join('/legacy/path', 'knowledge'))
    })

    it('general 字段缺失时回退到 libraryRootPath', () => {
      const result = resolveKnowledgeRoot(
        { libraryRootPath: '/legacy/path' },
        USER_DATA,
      )
      expect(result).toBe(path.join('/legacy/path', 'knowledge'))
    })

    it('general 为空对象时回退到 libraryRootPath', () => {
      const result = resolveKnowledgeRoot(
        { general: {}, libraryRootPath: '/legacy/path' },
        USER_DATA,
      )
      expect(result).toBe(path.join('/legacy/path', 'knowledge'))
    })

    it('两个字段都为空字符串时回退到 userData', () => {
      const result = resolveKnowledgeRoot(
        { general: { knowledgeBasePath: '' }, libraryRootPath: '' },
        USER_DATA,
      )
      expect(result).toBe(path.join(USER_DATA, 'knowledge'))
    })
  })

  describe('trim 与空白字符', () => {
    it('general.knowledgeBasePath 仅为空白时视为空', () => {
      const result = resolveKnowledgeRoot(
        { general: { knowledgeBasePath: '   ' }, libraryRootPath: '/legacy/path' },
        USER_DATA,
      )
      expect(result).toBe(path.join('/legacy/path', 'knowledge'))
    })

    it('general.knowledgeBasePath 前后有空格时正常 trim', () => {
      const result = resolveKnowledgeRoot(
        { general: { knowledgeBasePath: '  /new/path  ' } },
        USER_DATA,
      )
      expect(result).toBe(path.join('/new/path', 'knowledge'))
    })

    it('libraryRootPath 仅为空白时视为空', () => {
      const result = resolveKnowledgeRoot(
        { libraryRootPath: '   ' },
        USER_DATA,
      )
      expect(result).toBe(path.join(USER_DATA, 'knowledge'))
    })

    it('libraryRootPath 包含 tab/换行时也正常 trim', () => {
      const result = resolveKnowledgeRoot(
        { libraryRootPath: '\t\n/legacy/path\r\n' },
        USER_DATA,
      )
      expect(result).toBe(path.join('/legacy/path', 'knowledge'))
    })
  })

  describe('默认值回退', () => {
    it('preferences 为 null 时回退到 userData', () => {
      const result = resolveKnowledgeRoot(null, USER_DATA)
      expect(result).toBe(path.join(USER_DATA, 'knowledge'))
    })

    it('preferences 为 undefined 时回退到 userData', () => {
      const result = resolveKnowledgeRoot(undefined, USER_DATA)
      expect(result).toBe(path.join(USER_DATA, 'knowledge'))
    })

    it('preferences 为非对象（字符串）时不抛错，回退到 userData', () => {
      const result = resolveKnowledgeRoot('not-an-object', USER_DATA)
      expect(result).toBe(path.join(USER_DATA, 'knowledge'))
    })

    it('preferences 为空对象时回退到 userData', () => {
      const result = resolveKnowledgeRoot({}, USER_DATA)
      expect(result).toBe(path.join(USER_DATA, 'knowledge'))
    })

    it('preferences.general 不存在但顶层 libraryRootPath 为空字符串时回退到 userData', () => {
      const result = resolveKnowledgeRoot({ libraryRootPath: '' }, USER_DATA)
      expect(result).toBe(path.join(USER_DATA, 'knowledge'))
    })
  })

  describe('字段类型防御', () => {
    it('knowledgeBasePath 为非字符串（数字）时不抛错，回退到 libraryRootPath', () => {
      const result = resolveKnowledgeRoot(
        { general: { knowledgeBasePath: 12345 }, libraryRootPath: '/legacy/path' },
        USER_DATA,
      )
      // 数字没有 .trim() 方法，依赖 optional chaining 不会抛错，结果为 legacy 路径
      expect(result).toBe(path.join('/legacy/path', 'knowledge'))
    })

    it('libraryRootPath 为非字符串（数组）时不抛错，回退到 userData', () => {
      const result = resolveKnowledgeRoot({ libraryRootPath: ['/x', '/y'] }, USER_DATA)
      // 数组没有 .trim()，结果为 userData
      expect(result).toBe(path.join(USER_DATA, 'knowledge'))
    })

    it('general 为 null 时回退到 libraryRootPath', () => {
      const result = resolveKnowledgeRoot(
        { general: null, libraryRootPath: '/legacy/path' },
        USER_DATA,
      )
      expect(result).toBe(path.join('/legacy/path', 'knowledge'))
    })
  })

  describe('Windows 路径兼容', () => {
    it('Windows 反斜杠路径能正确拼接', () => {
      const result = resolveKnowledgeRoot(
        { general: { knowledgeBasePath: 'D:\\docs\\knowledge' } },
        USER_DATA,
      )
      expect(result).toBe(path.join('D:\\docs\\knowledge', 'knowledge'))
    })

    it('Windows userData 默认路径（C:\\Users\\xxx）能正确拼接', () => {
      const result = resolveKnowledgeRoot({}, 'C:\\Users\\test\\AppData\\Roaming\\WPX')
      expect(result).toBe(path.join('C:\\Users\\test\\AppData\\Roaming\\WPX', 'knowledge'))
    })
  })

  describe('边界场景', () => {
    it('返回值始终以 knowledge 结尾（确保子目录结构稳定）', () => {
      const result = resolveKnowledgeRoot(
        { general: { knowledgeBasePath: '/some/where' } },
        USER_DATA,
      )
      expect(result.endsWith('knowledge')).toBe(true)
    })

    it('绝对路径与 userData 路径都不会注入额外子目录', () => {
      const result = resolveKnowledgeRoot(
        { general: { knowledgeBasePath: '/abs/path' } },
        USER_DATA,
      )
      // 只拼接一层 knowledge（平台无关断言）
      expect(result).toBe(path.join('/abs/path', 'knowledge'))
    })

    it('userData 路径已包含 knowledge 子目录时仍直接拼接（不去重）', () => {
      // 这是预期行为：保证路径解析确定性，不做规范化
      const result = resolveKnowledgeRoot({}, '/userData/knowledge')
      expect(result).toBe(path.join('/userData/knowledge', 'knowledge'))
    })
  })
})