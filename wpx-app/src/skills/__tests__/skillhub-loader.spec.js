/**
 * skillhub-loader.spec.js —— SkillHub 加载器单元测试（Phase 1 / M1）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  HERMES_SKILL_SOURCES,
  listSkillSources,
  fetchGitHubSkillTree,
  fetchSkillMdFiles,
  loadSkillHubFromManifest,
  readSkillHubCache,
  writeSkillHubCache,
} from '@/skills/skillhub-loader'

const SAMPLE_SKILL_MD = `---
name: sample-skill
description: 示例技能
---
执行 {task} 并输出结果。`

function treeResponse (paths) {
  return {
    ok: true,
    json: async () => ({
      tree: paths.map((path) => ({ path, type: path.endsWith('.md') ? 'blob' : 'tree' })),
    }),
  }
}

/** 构造可路由的 mock fetch：api.github.com → tree；raw.githubusercontent.com → 文件内容 */
function makeRoutingFetch (treePaths, contentByPath) {
  return async (url, options) => {
    if (String(url).includes('api.github.com')) {
      return treeResponse(treePaths)
    }
    if (String(url).includes('raw.githubusercontent.com')) {
      // https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path...}
      const u = new URL(String(url))
      const segments = u.pathname.split('/').filter(Boolean) // [owner, repo, branch, ...path]
      const path = decodeURIComponent(segments.slice(3).join('/'))
      const content = contentByPath[path]
      if (content === undefined) {
        return { ok: false, status: 404, text: async () => 'Not Found' }
      }
      return { ok: true, text: async () => content }
    }
    throw new Error(`Unexpected URL: ${url}`)
  }
}

beforeEach(() => {
  localStorage.clear()
})

// ═════════════════════════════════════════════════
// 1. 技能源
// ═════════════════════════════════════════════════
describe('skillhub-loader — 技能源', () => {
  it('预置 Hermes 官方技能源定义完整', () => {
    expect(HERMES_SKILL_SOURCES).toHaveLength(1)
    const source = HERMES_SKILL_SOURCES[0]
    expect(source.id).toBe('hermes-official')
    expect(source.ref).toBe('NousResearch/hermes-agent')
    expect(source.license).toBe('Apache-2.0')
  })

  it('listSkillSources 返回副本，不共享引用', () => {
    const sources = listSkillSources()
    sources[0].id = 'mutated'
    expect(HERMES_SKILL_SOURCES[0].id).toBe('hermes-official')
  })
})

// ═════════════════════════════════════════════════
// 2. GitHub 文件树筛选
// ═════════════════════════════════════════════════
describe('skillhub-loader — GitHub 文件树筛选', () => {
  it('只保留 skills/**/SKILL.md 路径，且受 maxFiles 上限约束', async () => {
    const source = HERMES_SKILL_SOURCES[0]
    const paths = [
      'README.md',
      'skills/autonomous-ai-agents/hermes-agent/SKILL.md',
      'skills/writing/rewrite/SKILL.md',
      'skills/foo.md',            // 非 SKILL.md，应排除
      'docs/guide.md',
    ]
    const tree = await fetchGitHubSkillTree(source, {
      fetchImpl: makeRoutingFetch(paths, {}),
      maxFiles: 100,
    })
    expect(tree.map((t) => t.path)).toEqual([
      'skills/autonomous-ai-agents/hermes-agent/SKILL.md',
      'skills/writing/rewrite/SKILL.md',
    ])
  })

  it('树接口失败时抛出错误（供上层降级）', async () => {
    const source = HERMES_SKILL_SOURCES[0]
    await expect(
      fetchGitHubSkillTree(source, {
        fetchImpl: async () => ({ ok: false, status: 403 }),
      }),
    ).rejects.toThrow(/403/)
  })
})

// ═════════════════════════════════════════════════
// 3. 主入口：成功 / 缓存回退 / 彻底失败
// ═════════════════════════════════════════════════
describe('skillhub-loader — loadSkillHubFromManifest', () => {
  it('成功路径：拉取 → 转换 → 统计 added/updated → 写入缓存', async () => {
    const source = HERMES_SKILL_SOURCES[0]
    const paths = [
      'skills/education/lesson/SKILL.md',
      'skills/college/paper/SKILL.md',
    ]
    const contentByPath = {
      'skills/education/lesson/SKILL.md': SAMPLE_SKILL_MD.replace('sample-skill', 'lesson-skill'),
      'skills/college/paper/SKILL.md': SAMPLE_SKILL_MD.replace('sample-skill', 'paper-skill'),
    }

    const result = await loadSkillHubFromManifest(source, {
      fetchImpl: makeRoutingFetch(paths, contentByPath),
    })

    expect(result.ok).toBe(true)
    expect(result.fromCache).toBe(false)
    expect(result.skills).toHaveLength(2)
    expect(result.added).toBe(2)
    expect(result.updated).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.errors).toHaveLength(0)

    // 缓存已写入
    const cache = readSkillHubCache(source.id)
    expect(cache).not.toBeNull()
    expect(cache.files).toHaveLength(2)
  })

  it('重复同步：第二次全部计入 updated', async () => {
    const source = HERMES_SKILL_SOURCES[0]
    const paths = ['skills/edu/one/SKILL.md']
    const contentByPath = {
      'skills/edu/one/SKILL.md': SAMPLE_SKILL_MD.replace('sample-skill', 'edu-one'),
    }
    const fetchImpl = makeRoutingFetch(paths, contentByPath)

    const first = await loadSkillHubFromManifest(source, { fetchImpl })
    expect(first.added).toBe(1)

    const second = await loadSkillHubFromManifest(source, { fetchImpl })
    expect(second.added).toBe(0)
    expect(second.updated).toBe(1)
  })

  it('网络失败 → 使用上次成功缓存（fromCache:true）', async () => {
    const source = HERMES_SKILL_SOURCES[0]
    // 预置缓存
    writeSkillHubCache(source.id, source.ref, [
      { path: 'skills/cached/one/SKILL.md', content: SAMPLE_SKILL_MD.replace('sample-skill', 'cached-one') },
    ], ['cached-one'])

    const result = await loadSkillHubFromManifest(source, {
      fetchImpl: async () => {
        throw new Error('network down')
      },
    })

    expect(result.ok).toBe(true)
    expect(result.fromCache).toBe(true)
    expect(result.skills).toHaveLength(1)
    expect(result.skills[0].id).toBe('cached-one')
    expect(result.errors.some((e) => String(e.reason).includes('缓存'))).toBe(true)
  })

  it('网络失败且无缓存 → ok:false', async () => {
    const source = HERMES_SKILL_SOURCES[0]
    const result = await loadSkillHubFromManifest(source, {
      fetchImpl: async () => {
        throw new Error('network down')
      },
    })
    expect(result.ok).toBe(false)
    expect(result.skills).toHaveLength(0)
  })

  it('未知 sourceId → ok:false', async () => {
    const result = await loadSkillHubFromManifest('not-exists')
    expect(result.ok).toBe(false)
  })

  it('部分文件拉取失败：成功文件仍被转换，错误被收集', async () => {
    const source = HERMES_SKILL_SOURCES[0]
    const paths = [
      'skills/ok/one/SKILL.md',
      'skills/broken/two/SKILL.md',
    ]
    const contentByPath = {
      'skills/ok/one/SKILL.md': SAMPLE_SKILL_MD.replace('sample-skill', 'ok-one'),
      // 'skills/broken/two/SKILL.md' 缺失 → raw 404
    }
    const result = await loadSkillHubFromManifest(source, {
      fetchImpl: makeRoutingFetch(paths, contentByPath),
    })
    expect(result.ok).toBe(true)
    expect(result.skills).toHaveLength(1)
    expect(result.skills[0].id).toBe('ok-one')
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors.some((e) => String(e.path).includes('broken'))).toBe(true)
  })
})

// ═════════════════════════════════════════════════
// 4. 并发拉取
// ═════════════════════════════════════════════════
describe('skillhub-loader — fetchSkillMdFiles', () => {
  it('并发拉取全部文件，失败的进入 errors', async () => {
    const source = HERMES_SKILL_SOURCES[0]
    const tree = [
      { path: 'skills/a/1/SKILL.md' },
      { path: 'skills/b/2/SKILL.md' },
      { path: 'skills/c/3/SKILL.md' },
    ]
    const contentByPath = {
      'skills/a/1/SKILL.md': SAMPLE_SKILL_MD,
      'skills/b/2/SKILL.md': SAMPLE_SKILL_MD,
    }
    const { files, errors } = await fetchSkillMdFiles(source, tree, {
      fetchImpl: makeRoutingFetch([], contentByPath),
      concurrency: 2,
    })
    expect(files).toHaveLength(2)
    expect(errors).toHaveLength(1)
    expect(errors[0].path).toBe('skills/c/3/SKILL.md')
  })
})
