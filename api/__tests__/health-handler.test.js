/**
 * P0-1 修复回归测试：公开健康检查端点 /api/health 安全性
 *
 * 覆盖：
 *   T1 匿名访问返回最小化健康状态
 *   T2 响应（body + headers）无敏感信息
 *   T3 数据库不可用场景不泄露内部异常
 *   T4 健康检查不清除数据库模块缓存 / 重建连接池
 *   T5 Vercel 入口（api/admin/handler.js）与本地 Express（server/）镜像一致
 *
 * 运行（仓库根目录）：node --test api/__tests__/
 * 仅使用 Node.js 内置 node:test，不引入新依赖。
 */
'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const path = require('node:path')
const fs = require('node:fs')

const ROOT = path.join(__dirname, '..', '..')
const handler = require('../admin/handler.js')

const REPO_SERVER = path.join(ROOT, 'server')
const MIRROR_SERVER = path.join(ROOT, '_server')

/** 构造最小 req/res mock（health 分支只用 setHeader/status/end） */
function makeRes() {
  const res = {
    headersSent: false,
    statusCode: null,
    body: '',
    headers: {},
    setHeader(k, v) {
      this.headers[String(k).toLowerCase()] = v
    },
    status(code) {
      this.statusCode = code
      return this
    },
    end(payload) {
      this.body = payload || ''
      this.headersSent = true
      return this
    },
    json(payload) {
      this.body = JSON.stringify(payload)
      this.headersSent = true
      return this
    },
    once() {}
  }
  return res
}

async function callHealth(url = '/api/health') {
  const res = makeRes()
  await handler({ url, method: 'GET', headers: {} }, res)
  return res
}

test('T1 匿名 GET /api/health 返回 200 与最小化健康状态', async () => {
  const res = await callHealth()
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.ok, true)
  assert.equal(body.status, 'healthy')
  // 最小化：除 ok/status 外不得有其他字段（diag/pgProbe/inlineMarker 等）
  assert.deepEqual(Object.keys(body).sort(), ['ok', 'status'])
})

test('T2 响应 body 与 headers 不含敏感信息，且无 X-WPX-Diag 泄露头', async () => {
  const res = await callHealth()
  assert.equal(res.headers['x-wpx-diag'], undefined, '不得再返回 X-WPX-Diag 诊断头')
  const serialized = (res.body + JSON.stringify(res.headers)).toLowerCase()
  for (const secret of [
    'email',
    'roles',
    'users',
    'pg_host',
    'pg_port',
    'pg_database',
    'pg_ssl',
    'feedbacks',
    'search_path',
    'current_database',
    'current_user',
    'database_url',
    'jwt',
    'token',
    'apikey',
    'api_key',
    'password',
    'secret',
    'sk-',
    'bearer ',
    'postgres://',
    'postgresql://',
    'redis://',
    'stack'
  ]) {
    assert.ok(!serialized.includes(secret), `响应不得包含敏感片段: ${secret}`)
  }
})

test('T3 数据库不可用场景：仍返回最小响应，不泄露异常与连接信息', async (t) => {
  const pgKeys = Object.keys(process.env).filter((k) => /^PG_|^DATABASE_URL|^REDIS_|^ACCOUNT_JWT/.test(k))
  const saved = {}
  for (const k of pgKeys) {
    saved[k] = process.env[k]
    delete process.env[k]
  }
  t.after(() => Object.assign(process.env, saved))

  const res = await callHealth()
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.ok, true)
  assert.equal(body.status, 'healthy')
  const serialized = res.body.toLowerCase()
  for (const frag of ['error', 'stack', 'econnrefused', 'enotfound', 'pgprobe', 'diag', 'throw', 'exception']) {
    assert.ok(!serialized.includes(frag), `数据库不可用时响应不得包含: ${frag}`)
  }
})

test('T4 健康检查不清除数据库模块缓存、不重建连接池', async () => {
  const dbPath = require.resolve(path.join(MIRROR_SERVER, 'models', 'db.js'))
  assert.ok(require.cache[dbPath], 'db 模块应已随 handler 加载缓存')
  const before = require.cache[dbPath]

  await callHealth()
  await callHealth()
  await callHealth('/api/health?probe=1')

  assert.equal(require.cache[dbPath], before, '连续健康检查后 db 模块缓存条目必须保持同一实例')
})

test('T5 部署入口一致性：handler 加载 _server/app.js 且与 server/ 无版本漂移', () => {
  // handler.js 顶层加载的是项目根 _server/app.js
  assert.equal(
    path.join(MIRROR_SERVER, 'app.js'),
    path.join(ROOT, '_server', 'app.js'),
    '镜像根路径应存在'
  )
  assert.ok(fs.existsSync(path.join(MIRROR_SERVER, 'app.js')), 'Vercel 入口实际加载的 _server/app.js 必须存在')

  const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
  const pairs = [
    'app.js',
    path.join('routes', 'index.js'),
    path.join('controllers', 'health.controller.js'),
    path.join('models', 'db.js'),
    path.join('models', 'redis.js')
  ]
  for (const rel of pairs) {
    const a = sha(path.join(REPO_SERVER, rel))
    const b = sha(path.join(MIRROR_SERVER, rel))
    assert.equal(a, b, `server/${rel} 与 _server/${rel} 必须一致，避免部署入口版本漂移`)
  }
})

test('附加：/api/health 带查询参数与子路径均返回最小响应', async () => {
  for (const url of ['/api/health?x=1', '/api/health/']) {
    const res = await callHealth(url)
    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.body)
    assert.deepEqual(Object.keys(body).sort(), ['ok', 'status'])
  }
})
