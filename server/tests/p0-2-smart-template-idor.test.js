/**
 * P0-2 修复回归测试：智能模板 IDOR 越权
 *
 * 测试方式：真实 Express HTTP 服务（server/app.js createApp）
 *   - 通过 require.cache 注入内存版 db 模块（不连接真实数据库，不修改任何数据）
 *   - 使用项目自身 jsonwebtoken 签发 user_A / user_B 两个真实 JWT
 *   - 覆盖 Route → requireAuth → Controller → Model → SQL 的完整调用路径
 *
 * 运行（仓库根目录）：node --test server/tests/
 */
'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..', '..')
const SERVER_DIR = path.join(ROOT, 'server')

// ---- 环境准备（必须在 require 任何 server 模块之前）----
process.env.NODE_ENV = 'test'
process.env.ACCOUNT_JWT_SECRET = process.env.ACCOUNT_JWT_SECRET || 'p0-2-idor-test-secret'
process.env.AUTH_BYPASS = '' // 明确关闭 bypass，走真实 JWT 校验

// ---- 内存版 db：拦截 server/models/db.js ----
/** smart_templates 行存储 */
const rows = []
/** user_writing_memory 行存储 */
const memoryRows = []
let queryCallCount = 0

function matchWhere(sql, params, row) {
  const wm = sql.match(/WHERE (.+?)( ORDER BY| GROUP BY| LIMIT| RETURNING|$)/i)
  if (!wm) return true
  return wm[1].split(' AND ').every((raw) => {
    const c = raw.trim()
    if (/^is_active = TRUE$/i.test(c)) return row.is_active === true
    if (/^template_generated = TRUE$/i.test(c)) return row.template_generated === true
    const m = c.match(/^(\w+) = \$(\d+)$/)
    if (!m) throw new Error('fake db: unsupported condition: ' + c)
    const val = params[Number(m[2]) - 1]
    if (Array.isArray(val)) return Array.isArray(row[m[1]]) && val.every((v) => row[m[1]].includes(v))
    return row[m[1]] === val
  })
}

function applySet(setClause, params, row) {
  let offset = 0
  for (const raw of setClause.split(',')) {
    const c = raw.trim()
    if (/^usage_count = usage_count \+ 1$/i.test(c)) {
      row.usage_count = (row.usage_count || 0) + 1
      continue
    }
    if (/^updated_at = NOW\(\)$/i.test(c)) {
      row.updated_at = new Date()
      continue
    }
    const lit = c.match(/^(\w+) = (TRUE|FALSE)$/i)
    if (lit) {
      row[lit[1]] = lit[2].toLowerCase() === 'true'
      continue
    }
    const m = c.match(/^(\w+) = \$(\d+)$/)
    if (!m) continue
    const [, col, idx] = m
    const val = params[Number(idx) - 1 - offset]
    if (col === 'template_id' || col === 'template_generated') {
      // user_writing_memory 的 UPDATE 参数顺序由真实 SQL 决定
      row[col] = val
      continue
    }
    row[col] = val
  }
  return offset
}

const fakeDb = {
  async query(sql, params = []) {
    queryCallCount += 1
    const s = String(sql).replace(/\s+/g, ' ').trim()

    // DDL
    if (/^(CREATE TABLE|CREATE INDEX)/i.test(s)) return { rows: [], rowCount: 0 }

    // INSERT INTO smart_templates ... RETURNING *
    if (/^INSERT INTO smart_templates/i.test(s)) {
      const row = {
        id: params[0], user_id: params[1], doc_type: params[2], name: params[3],
        description: params[4], template_content: params[5], prompt_hint: params[6],
        doc_count: params[7], structures: params[8] ? JSON.parse(params[8]) : null,
        high_freq_terms: params[9] || [], signatures: params[10] || [],
        usage_count: 0, is_active: true, created_at: new Date(), updated_at: new Date()
      }
      rows.push(row)
      return { rows: [{ ...row }], rowCount: 1 }
    }

    // SELECT
    if (/^SELECT .* FROM smart_templates/i.test(s)) {
      let matched = rows.filter((r) => matchWhere(s, params, r)).map((r) => ({ ...r }))
      if (/ORDER BY usage_count DESC/i.test(s)) {
        matched.sort((a, b) => b.usage_count - a.usage_count)
      }
      const lm = s.match(/LIMIT \$?(\d+|(\$\d+))/i)
      if (lm) {
        const n = lm[1].startsWith('$')
          ? params[Number(lm[1].slice(1)) - 1]
          : Number(lm[1])
        matched = matched.slice(0, n)
      }
      return { rows: matched, rowCount: matched.length }
    }

    if (/^SELECT .* FROM user_writing_memory/i.test(s)) {
      const matched = memoryRows.filter((r) => matchWhere(s, params, r)).map((r) => ({ ...r }))
      return { rows: matched.slice(0, /LIMIT/i.test(s) ? 1 : matched.length), rowCount: matched.length }
    }

    // UPDATE smart_templates
    if (/^UPDATE smart_templates/i.test(s)) {
      const sm = s.match(/SET (.+?) WHERE (.+?)( RETURNING|$)/i)
      const targets = rows.filter((r) => matchWhere(s, params, r))
      const wm = sm[2].match(/WHERE (.+?)( ORDER BY| GROUP BY| LIMIT| RETURNING|$)/i)
      void wm
      for (const row of targets) {
        // SET 中可能含 $n 参数；user_id 条件占 $2，SET 字段从 $3 开始
        applySet(sm[1], params, row)
      }
      const returning = /RETURNING \*/i.test(s)
        ? targets.map((r) => ({ ...r }))
        : targets.map((r) => ({ id: r.id }))
      return { rows: returning, rowCount: targets.length }
    }

    // 其他 UPDATE / DELETE / INSERT（user_writing_memory 等）一律视为执行 0 行
    if (/^UPDATE user_writing_memory/i.test(s)) {
      const sm = s.match(/SET (.+?) WHERE/i)
      const targets = memoryRows.filter((r) => matchWhere(s, params, r))
      for (const row of targets) applySet(sm[1], params, row)
      return { rows: [], rowCount: targets.length }
    }
    if (/^(DELETE FROM|INSERT INTO)/i.test(s)) return { rows: [], rowCount: 0 }

    throw new Error('fake db: unsupported SQL: ' + s.slice(0, 120))
  },
  async ping() { return true },
  __reset() { rows.length = 0; memoryRows.length = 0; queryCallCount = 0 },
  __getCallCount() { return queryCallCount }
}

// 注入 require.cache，使 server 全部模块拿到同一个内存 db
const dbId = require.resolve(path.join(SERVER_DIR, 'models', 'db.js'))
require.cache[dbId] = {
  id: dbId, filename: dbId, loaded: true, exports: fakeDb, children: [], paths: []
}

// ---- 加载真实应用与依赖 ----
const { createApp } = require(path.join(SERVER_DIR, 'app.js'))
const jwt = require(require.resolve('jsonwebtoken', { paths: [SERVER_DIR] }))
const JWT_SECRET = process.env.ACCOUNT_JWT_SECRET

function signToken(accountId) {
  return jwt.sign(
    { sub: accountId, accountId, email: `${accountId}@test.local`, nickname: accountId, roles: ['user'] },
    JWT_SECRET,
    { algorithm: 'HS256', issuer: 'prowpx.com', audience: 'wpx-server', expiresIn: '1h' }
  )
}

const tokenA = signToken('user_A')
const tokenB = signToken('user_B')

async function request(method, urlPath, { token, body } = {}) {
  const headers = {}
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

let base
let httpServer

test.before(async () => {
  const app = createApp()
  httpServer = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => httpServer.once('listening', resolve))
  base = `http://127.0.0.1:${httpServer.address().port}`
})

test.after(() => new Promise((resolve) => httpServer.close(resolve)))

let templateId // 用户 A 的模板 ID

test('T01 用户 A 通过 API 创建智能模板', async () => {
  fakeDb.__reset()
  // 预置 A 的写作记忆（generate 依赖记忆数据）
  memoryRows.push({
    user_id: 'user_A', doc_type: 'report', doc_count: 3,
    structures: { sections: ['背景', '结论'] }, high_freq_terms: ['总结', '计划'],
    signatures: ['WPX 团队'], template_generated: false, template_id: null
  })

  const res = await request('POST', '/api/smart-templates/generate', {
    token: tokenA,
    body: {
      docType: 'report',
      name: 'A 的周报模板',
      templateContent: '# 周报\n## 本周进展\n{{content}}'
    }
  })
  assert.equal(res.status, 200)
  assert.equal(res.json.ok, true)
  assert.ok(res.json.data.template.id.startsWith('stpl-'))
  assert.equal(res.json.data.template.user_id, 'user_A', '创建时 user_id 必须来自服务端身份')
  templateId = res.json.data.template.id
})

test('T02 用户 A 可以读取自己的模板', async () => {
  const res = await request('GET', `/api/smart-templates/${templateId}`, { token: tokenA })
  assert.equal(res.status, 200)
  assert.equal(res.json.ok, true)
  assert.equal(res.json.data.id, templateId)
  assert.equal(res.json.data.user_id, 'user_A')
})

test('T03 用户 B 读取 A 的模板 → 拒绝', async () => {
  const res = await request('GET', `/api/smart-templates/${templateId}`, { token: tokenB })
  assert.equal(res.status, 404, '归属校验失败应返回通用 404，不泄露他人资源存在性')
  assert.equal(res.json.ok, false)
  assert.equal(res.json.error.code, 'NOT_FOUND')
})

test('T04 用户 B 修改 A 的模板 → 拒绝，且内容不变', async () => {
  const res = await request('PUT', `/api/smart-templates/${templateId}`, {
    token: tokenB,
    body: { name: 'B 篡改后的名字', templateContent: '# 恶意内容' }
  })
  assert.equal(res.status, 404)
  // 确认 A 的数据未被改动
  const asA = await request('GET', `/api/smart-templates/${templateId}`, { token: tokenA })
  assert.equal(asA.json.data.name, 'A 的周报模板')
  assert.equal(asA.json.data.template_content, '# 周报\n## 本周进展\n{{content}}')
})

test('T05 用户 B 删除 A 的模板 → 拒绝，模板仍存在', async () => {
  const res = await request('DELETE', `/api/smart-templates/${templateId}`, { token: tokenB })
  assert.equal(res.status, 404)
  const asA = await request('GET', `/api/smart-templates/${templateId}`, { token: tokenA })
  assert.equal(asA.status, 200, 'B 删除失败后 A 的模板必须仍然存在')
})

test('T06 用户 B 使用 A 的模板 → 拒绝，使用计数不变', async () => {
  const before = (await request('GET', `/api/smart-templates/${templateId}`, { token: tokenA })).json.data.usage_count
  const res = await request('POST', `/api/smart-templates/${templateId}/use`, { token: tokenB })
  assert.equal(res.status, 404)
  const after = (await request('GET', `/api/smart-templates/${templateId}`, { token: tokenA })).json.data.usage_count
  assert.equal(after, before, 'B 不得增加 A 模板的使用计数')
})

test('T07 用户 A 修改自己的模板 → 成功', async () => {
  const res = await request('PUT', `/api/smart-templates/${templateId}`, {
    token: tokenA,
    body: { name: 'A 的周报模板 v2', description: '更新描述' }
  })
  assert.equal(res.status, 200)
  assert.equal(res.json.data.template.name, 'A 的周报模板 v2')
})

test('T08 用户 A 删除自己的模板 → 成功', async () => {
  const res = await request('DELETE', `/api/smart-templates/${templateId}`, { token: tokenA })
  assert.equal(res.status, 200)
  assert.equal(res.json.data.deleted, true)
  // 软删除后不再出现在列表中
  const list = await request('GET', '/api/smart-templates/list', { token: tokenA })
  assert.ok(!list.json.data.items.some((t) => t.id === templateId), '已删除模板不应出现在列表')
})

test('T09 未登录用户访问模板 → 401', async () => {
  const res = await request('GET', `/api/smart-templates/${templateId}`)
  assert.equal(res.status, 401)
  assert.equal(res.json.error.code, 'UNAUTHORIZED')
})

test('T10 用户 B 伪造 userId=user_A 仍然无法操作 A 的模板', async () => {
  // 重新创建一个 A 的模板用于本场景
  fakeDb.__reset()
  memoryRows.push({
    user_id: 'user_A', doc_type: 'report', doc_count: 3,
    structures: null, high_freq_terms: [], signatures: [], template_generated: false, template_id: null
  })
  const created = await request('POST', '/api/smart-templates/generate', {
    token: tokenA, body: { docType: 'report', name: 'A 模板', templateContent: '# content' }
  })
  const id = created.json.data.template.id

  // B 的请求体携带伪造 userId
  const upd = await request('PUT', `/api/smart-templates/${id}`, {
    token: tokenB,
    body: { userId: 'user_A', name: '伪造身份篡改' }
  })
  assert.equal(upd.status, 404, '客户端提交的 userId 不得被采信')

  const del = await request('DELETE', `/api/smart-templates/${id}`, {
    token: tokenB,
    body: { userId: 'user_A' }
  })
  assert.equal(del.status, 404, '伪造 userId 的删除请求不得生效')

  // 服务端身份始终是 B：即便用 B 自己的 ID 造模板，列表也只含 B 的数据
  const listB = await request('GET', '/api/smart-templates/list', { token: tokenB })
  assert.ok(!listB.json.data.items.some((t) => t.id === id), 'A 的模板不得出现在 B 的列表中')
})

test('T11 用户 B 批量查询无法获取 A 的模板', async () => {
  // 重建隔离数据：A、B 各一个模板
  fakeDb.__reset()
  memoryRows.push(
    { user_id: 'user_A', doc_type: 'report', doc_count: 3, structures: null, high_freq_terms: [], signatures: [], template_generated: false, template_id: null },
    { user_id: 'user_B', doc_type: 'report', doc_count: 3, structures: null, high_freq_terms: [], signatures: [], template_generated: false, template_id: null }
  )
  const tA = (await request('POST', '/api/smart-templates/generate', {
    token: tokenA, body: { docType: 'report', name: 'A-only', templateContent: '# A' }
  })).json.data.template.id
  const tB = (await request('POST', '/api/smart-templates/generate', {
    token: tokenB, body: { docType: 'report', name: 'B-only', templateContent: '# B' }
  })).json.data.template.id

  const listB = await request('GET', '/api/smart-templates/list', { token: tokenB })
  assert.ok(listB.json.data.items.some((t) => t.id === tB), 'B 能看到自己的模板')
  assert.ok(!listB.json.data.items.some((t) => t.id === tA), 'B 的列表不得包含 A 的模板')

  const recB = await request('GET', '/api/smart-templates/recommended', { token: tokenB })
  assert.ok(!recB.json.data.items.some((t) => t.id === tA), 'B 的推荐列表不得包含 A 的模板')

  const recBig = await request('GET', '/api/smart-templates/recommended?limit=100', { token: tokenB })
  assert.ok(!recBig.json.data.items.some((t) => t.id === tA), '加大 limit 批量拉取也不得越界')
})

test('T12 不存在的模板 ID → 正常业务错误', async () => {
  const res = await request('GET', '/api/smart-templates/stpl-notexist', { token: tokenA })
  assert.equal(res.status, 404)
  assert.equal(res.json.ok, false)
  assert.equal(res.json.error.code, 'NOT_FOUND')
  const del = await request('DELETE', '/api/smart-templates/stpl-notexist', { token: tokenA })
  assert.equal(del.status, 404)
})

test('T13 并发场景不出现跨用户数据串用', async () => {
  fakeDb.__reset()
  memoryRows.push(
    { user_id: 'user_A', doc_type: 'report', doc_count: 3, structures: null, high_freq_terms: [], signatures: [], template_generated: false, template_id: null },
    { user_id: 'user_B', doc_type: 'report', doc_count: 3, structures: null, high_freq_terms: [], signatures: [], template_generated: false, template_id: null }
  )
  const tA = (await request('POST', '/api/smart-templates/generate', {
    token: tokenA, body: { docType: 'report', name: 'A-concurrent', templateContent: '# A' }
  })).json.data.template.id
  const tB = (await request('POST', '/api/smart-templates/generate', {
    token: tokenB, body: { docType: 'report', name: 'B-concurrent', templateContent: '# B' }
  })).json.data.template.id

  // 20 个并发请求：A 使用自己模板 x10，B 越权使用 A 模板 x10，同时 A/B 各读对方/自己模板
  const tasks = []
  for (let i = 0; i < 10; i++) {
    tasks.push(request('POST', `/api/smart-templates/${tA}/use`, { token: tokenA }))
    tasks.push(request('POST', `/api/smart-templates/${tA}/use`, { token: tokenB }))
    tasks.push(request('GET', `/api/smart-templates/${tB}`, { token: tokenA }))
    tasks.push(request('GET', `/api/smart-templates/${tA}`, { token: tokenB }))
  }
  const results = await Promise.all(tasks)

  // B 对 A 模板的全部使用请求失败；B 读 A 模板失败
  for (let i = 0; i < 10; i++) {
    assert.equal(results[i * 4 + 1].status, 404, 'B 并发使用 A 模板必须全部失败')
    assert.equal(results[i * 4 + 3].status, 404, 'B 并发读取 A 模板必须全部失败')
  }
  // A 使用自己模板成功，且计数恰好 +10（无重复、无遗漏）
  const finalA = (await request('GET', `/api/smart-templates/${tA}`, { token: tokenA })).json.data
  assert.equal(finalA.usage_count, 10, 'A 模板使用计数必须精确等于 A 自己的成功调用次数')
  assert.equal(finalA.user_id, 'user_A', '并发后模板归属不得变化')

  // B 自己的模板不受并发影响
  const finalB = (await request('GET', `/api/smart-templates/${tB}`, { token: tokenB })).json.data
  assert.equal(finalB.usage_count, 0)
  assert.equal(finalB.user_id, 'user_B')
})
