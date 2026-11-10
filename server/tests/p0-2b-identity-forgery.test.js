/**
 * P0-2 补充修复回归测试：body.userId 身份伪造（user-memory/record + feedback/submit）
 *
 * 测试方式：真实 Express HTTP 服务 + require.cache 注入内存 db + 真实 JWT
 * 覆盖 Route → optionalAuth/requireAuth → Controller → Model → SQL 完整调用链
 *
 * 运行（仓库根目录）：node --test server/tests/p0-2b-identity-forgery.test.js
 */
'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..', '..')
const SERVER_DIR = path.join(ROOT, 'server')

process.env.NODE_ENV = 'test'
process.env.ACCOUNT_JWT_SECRET = process.env.ACCOUNT_JWT_SECRET || 'p0-2b-forgery-test-secret'
process.env.AUTH_BYPASS = ''

const memoryRows = [] // user_writing_memory
const feedbackRows = [] // feedbacks

function matchWhere(sql, params, row) {
  const wm = sql.match(/WHERE (.+?)( ORDER BY| GROUP BY| LIMIT| RETURNING|$)/i)
  if (!wm) return true
  return wm[1].split(' AND ').every((raw) => {
    const c = raw.trim()
    const m = c.match(/^(\w+) = \$(\d+)$/)
    if (!m) throw new Error('fake db: unsupported condition: ' + c)
    return row[m[1]] === params[Number(m[2]) - 1]
  })
}

const fakeDb = {
  async query(sql, params = []) {
    const s = String(sql).replace(/\s+/g, ' ').trim()
    if (/^(CREATE TABLE|CREATE INDEX)/i.test(s)) return { rows: [], rowCount: 0 }

    if (/^SELECT .* FROM user_writing_memory/i.test(s)) {
      const matched = memoryRows.filter((r) => matchWhere(s, params, r))
      return { rows: matched.map((r) => ({ ...r })), rowCount: matched.length }
    }

    if (/^INSERT INTO user_writing_memory/i.test(s)) {
      const [userId, docType, docCount, structures, terms, sigs, lastDocId, tplGen] = params
      const existing = memoryRows.find((r) => r.user_id === userId && r.doc_type === docType)
      if (existing) {
        existing.doc_count = docCount
        existing.structures = JSON.parse(structures)
        existing.high_freq_terms = terms
        existing.signatures = sigs
        if (lastDocId) existing.last_doc_id = lastDocId
        existing.updated_at = new Date()
        return { rows: [{ ...existing }], rowCount: 1 }
      }
      const row = {
        user_id: userId, doc_type: docType, doc_count: docCount,
        structures: JSON.parse(structures), high_freq_terms: terms, signatures: sigs,
        last_doc_id: lastDocId, template_generated: tplGen === true, template_id: null,
        created_at: new Date(), updated_at: new Date()
      }
      memoryRows.push(row)
      return { rows: [{ ...row }], rowCount: 1 }
    }

    if (/^UPDATE user_writing_memory/i.test(s)) return { rows: [], rowCount: 0 }

    if (/^INSERT INTO feedbacks/i.test(s)) {
      const row = {
        id: `fb-${String(feedbackRows.length + 1).padStart(4, '0')}`,
        user_id: params[0], category: params[1], title: params[2], content: params[3],
        contact: params[4], app_version: params[5], os: params[6], status: 'pending',
        admin_note: null, created_at: new Date(), updated_at: new Date()
      }
      feedbackRows.push(row)
      return { rows: [{ ...row }], rowCount: 1 }
    }

    throw new Error('fake db: unsupported SQL: ' + s.slice(0, 120))
  },
  async ping() { return true },
  __reset() { memoryRows.length = 0; feedbackRows.length = 0 }
}

const dbId = require.resolve(path.join(SERVER_DIR, 'models', 'db.js'))
require.cache[dbId] = {
  id: dbId, filename: dbId, loaded: true, exports: fakeDb, children: [], paths: []
}

const { createApp } = require(path.join(SERVER_DIR, 'app.js'))
const jwt = require(require.resolve('jsonwebtoken', { paths: [SERVER_DIR] }))

function signToken(accountId) {
  return jwt.sign(
    { sub: accountId, accountId, email: `${accountId}@test.local`, roles: ['user'] },
    process.env.ACCOUNT_JWT_SECRET,
    { algorithm: 'HS256', issuer: 'prowpx.com', audience: 'wpx-server', expiresIn: '1h' }
  )
}

const tokenA = signToken('user_A')
const tokenB = signToken('user_B')

let base
let httpServer

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

const recordBody = (over = {}) => ({ docType: 'report', docId: 'doc-1', content: '# 内容\n正文段落', ...over })

test.before(async () => {
  const app = createApp()
  httpServer = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => httpServer.once('listening', resolve))
  base = `http://127.0.0.1:${httpServer.address().port}`
})

test.after(() => new Promise((resolve) => httpServer.close(resolve)))

// ============ 用户记忆 user-memory/record ============

test('T01 A 登录提交自己的用户记忆 → 成功且归属 A', async () => {
  fakeDb.__reset()
  const res = await request('POST', '/api/user-memory/record', { token: tokenA, body: recordBody() })
  assert.equal(res.status, 200)
  assert.equal(res.json.ok, true)
  assert.equal(res.json.data.memory.user_id, 'user_A', '记忆必须归属服务端识别的 A')
})

test('T02 A 登录但 body.userId=user_B → 服务端仍只识别 A', async () => {
  fakeDb.__reset()
  const res = await request('POST', '/api/user-memory/record', {
    token: tokenA,
    body: recordBody({ userId: 'user_B' })
  })
  assert.equal(res.status, 200)
  assert.equal(res.json.data.memory.user_id, 'user_A', 'body.userId 必须被忽略')
  assert.ok(!memoryRows.some((r) => r.user_id === 'user_B'), '不得写入 B 的记忆')
})

test('T03 B 登录伪造 userId=user_A → 不能污染 A 的数据', async () => {
  fakeDb.__reset()
  await request('POST', '/api/user-memory/record', { token: tokenA, body: recordBody() })
  const before = { ...memoryRows.find((r) => r.user_id === 'user_A' && r.doc_type === 'report') }

  const res = await request('POST', '/api/user-memory/record', {
    token: tokenB,
    body: recordBody({ userId: 'user_A', docId: 'doc-evil', content: '# 恶意污染' })
  })
  assert.equal(res.status, 200)
  assert.equal(res.json.data.memory.user_id, 'user_B', 'B 的写入只能归属 B 自己')
  const after = memoryRows.find((r) => r.user_id === 'user_A' && r.doc_type === 'report')
  assert.equal(after.doc_count, before.doc_count, 'A 的记忆数据不得被 B 污染')
  assert.equal(after.last_doc_id, before.last_doc_id)
})

test('T04 未登录提交 userId=user_A → 401，不写入 A 的记忆', async () => {
  fakeDb.__reset()
  const res = await request('POST', '/api/user-memory/record', {
    body: recordBody({ userId: 'user_A' })
  })
  assert.equal(res.status, 401, '记忆必须归属账户，匿名请求返回 401')
  assert.equal(res.json.ok, false)
  assert.equal(memoryRows.length, 0, '匿名请求不得写入任何记忆')
})

test('T05 未登录提交记忆（不带 userId）→ 401（业务规则：记忆必须登录）', async () => {
  fakeDb.__reset()
  const res = await request('POST', '/api/user-memory/record', { body: recordBody() })
  assert.equal(res.status, 401)
  assert.equal(res.json.error.code, 'UNAUTHORIZED')
})

// ============ 反馈 feedback/submit ============
// 注意：feedback.routes.js 挂载于 '/api'（routes/index.js L14）且路径定义为 '/submit'，
// 实际生效路径为 POST /api/submit；文件头注释写的 /api/feedback/submit 与实际不符（404）。
const SUBMIT_URL = '/api/submit'

test('T06 A 登录提交反馈 → 正确关联 A', async () => {
  fakeDb.__reset()
  const res = await request('POST', SUBMIT_URL, {
    token: tokenA,
    body: { category: 'bug', title: '问题', content: '登录态反馈内容' }
  })
  assert.equal(res.status, 200)
  assert.equal(res.json.ok, true)
  assert.equal(res.json.data.userId, 'user_A', '登录用户的反馈必须关联 A')
})

test('T07 A 登录但伪造 body.userId=user_B → 仍然关联 A', async () => {
  fakeDb.__reset()
  const res = await request('POST', SUBMIT_URL, {
    token: tokenA,
    body: { content: '伪造身份的反馈', userId: 'user_B' }
  })
  assert.equal(res.status, 200)
  assert.equal(res.json.data.userId, 'user_A', 'body.userId 必须被忽略，登录身份优先且唯一')
  assert.ok(!feedbackRows.some((f) => f.user_id === 'user_B'), '不得产生归属 B 的反馈')
})

test('T08 未登录提交反馈 → 保留匿名能力，但不能伪造为 A', async () => {
  fakeDb.__reset()
  const res = await request('POST', SUBMIT_URL, {
    body: { content: '匿名反馈内容', userId: 'user_A' }
  })
  assert.equal(res.status, 200, '匿名反馈是合法业务，必须保留')
  assert.equal(res.json.ok, true)
  assert.equal(res.json.data.userId, 'anonymous', '未登录一律记录为 anonymous，body.userId 不得被采信')
  assert.ok(!feedbackRows.some((f) => f.user_id === 'user_A'), '匿名请求不得伪造为 A 的反馈')
})

test('T09 其他用户数据不受影响（A/B 混合操作后保持隔离）', async () => {
  fakeDb.__reset()
  await request('POST', '/api/user-memory/record', { token: tokenA, body: recordBody({ docId: 'doc-A1' }) })
  await request('POST', '/api/user-memory/record', { token: tokenB, body: recordBody({ docId: 'doc-B1' }) })
  await request('POST', '/api/user-memory/record', {
    token: tokenA, body: recordBody({ userId: 'user_B', docId: 'doc-forged' })
  })
  await request('POST', '/api/user-memory/record', {
    body: recordBody({ userId: 'user_B', docId: 'doc-anon-forged' })
  })
  const bRows = memoryRows.filter((r) => r.user_id === 'user_B')
  assert.equal(bRows.length, 1, 'B 的记忆只能由 B 自己的请求产生')
  assert.equal(bRows[0].last_doc_id, 'doc-B1', 'B 的记忆内容未被伪造请求覆盖')
  const aRows = memoryRows.filter((r) => r.user_id === 'user_A')
  assert.equal(aRows.length, 1, 'A 的记忆数据保持独立')
})

test('T10 并发请求下不存在身份串用', async () => {
  fakeDb.__reset()
  const tasks = []
  for (let i = 0; i < 8; i++) {
    tasks.push(request('POST', '/api/user-memory/record', { token: tokenA, body: recordBody({ docId: `doc-A${i}` }) }))
    tasks.push(request('POST', '/api/user-memory/record', { token: tokenB, body: recordBody({ docId: `doc-B${i}` }) }))
    tasks.push(request('POST', '/api/user-memory/record', { body: recordBody({ userId: 'user_A', docId: `doc-X${i}` }) }))
    tasks.push(request('POST', SUBMIT_URL, { body: { content: `匿名${i}`, userId: 'user_B' } }))
  }
  const results = await Promise.all(tasks)
  // 匿名记忆请求全部 401，匿名反馈全部记为 anonymous
  for (let i = 0; i < 8; i++) {
    assert.equal(results[i * 4 + 2].status, 401, '匿名伪造身份的记忆请求必须全部 401')
    assert.equal(results[i * 4 + 3].json.data.userId, 'anonymous', '匿名反馈必须全部记录为 anonymous')
  }
  // A/B 各只有 1 条记忆（同 docType upsert），归属正确、内容互不串用
  const aRows = memoryRows.filter((r) => r.user_id === 'user_A')
  const bRows = memoryRows.filter((r) => r.user_id === 'user_B')
  assert.equal(aRows.length, 1)
  assert.equal(bRows.length, 1)
  assert.equal(aRows[0].last_doc_id, 'doc-A7', 'A 的记忆最终状态只由 A 自己的并发请求决定')
  assert.equal(bRows[0].last_doc_id, 'doc-B7', 'B 的记忆最终状态只由 B 自己的并发请求决定')
  assert.ok(feedbackRows.every((f) => f.user_id === 'anonymous'), '并发匿名反馈不得串用为任何登录用户')
})
