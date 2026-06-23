/**
 * Token 扣费、充值与 7 日去重（Vitest / Node）
 *
 * 运行：npm --prefix wpx-app run test:zip
 * （复用 electron vitest 配置，或单独：npx vitest run --config electron/vitest.config.js token-store）
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { TokenStore, TOKENS_PER_YUAN } = require('../services/token-store.js')

describe('token-store 字体 Token', () => {
  /** @type {string} */
  let tempDir
  /** @type {import('../services/token-store.js').TokenStore} */
  let store

  beforeEach(async () => {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'wpx-token-test-'))
    store = new TokenStore(tempDir)
    await store.init()
  })

  afterEach(async () => {
    await fsp.rm(tempDir, { recursive: true, force: true })
  })

  it('5. 确认导出后 Token 余额正确扣减', async () => {
    const userId = 'test-user'
    const row = store.ensureUserTokenRow(userId)
    row.balance = 500
    await store.save()

    const result = await store.consumeTokens(
      userId,
      [{ font_id: 'founder-lanting-hei', char_count: 12 }],
      'doc-hash-1',
      '测试文档',
    )

    expect(result.success).toBe(true)
    expect(result.total_consumed).toBe(12)
    expect(result.balance_after).toBe(488)
  })

  it('6. 同一文档 7 天内再次导出不重复扣费', async () => {
    const userId = 'test-user'
    const row = store.ensureUserTokenRow(userId)
    row.balance = 500
    await store.save()

    const fonts = [{ font_id: 'founder-lanting-hei', char_count: 12 }]
    const docHash = 'doc-hash-dedup'

    await store.consumeTokens(userId, fonts, docHash)
    const second = await store.consumeTokens(userId, fonts, docHash)

    expect(second.total_consumed).toBe(0)
    expect(second.already_consumed).toBe(true)
    expect(second.skipped_fonts).toContain('founder-lanting-hei')

    const balance = await store.getBalance(userId)
    expect(balance).toBe(488)
  })

  it('7. 余额不足时 estimateConsumeTokens 返回 sufficient=false', async () => {
    const userId = 'test-user'
    const row = store.ensureUserTokenRow(userId)
    row.balance = 5
    await store.save()

    const preview = await store.estimateConsumeTokens(
      userId,
      [{ font_id: 'founder-lanting-hei', char_count: 12 }],
      'doc-hash-low-balance',
    )

    expect(preview.total_consumed).toBe(12)
    expect(preview.balance).toBe(5)
    expect(preview.sufficient).toBe(false)

    await expect(
      store.consumeTokens(userId, [{ font_id: 'founder-lanting-hei', char_count: 12 }], 'doc-hash-low-balance'),
    ).rejects.toMatchObject({ code: 'TOKEN_INSUFFICIENT' })
  })

  it('8. 充值 10 元包支付成功后余额增加 200 Token', async () => {
    const userId = 'test-user'
    const order = await store.createRechargeOrder(userId, 10)

    expect(order.amount).toBe(10)
    expect(order.token_count).toBe(10 * TOKENS_PER_YUAN)

    const paid = await store.completeRecharge(order.id, 'pay-10')
    expect(paid?.balance).toBe(200)
  })

  it('9. 自定义充值 30 元支付成功后余额增加 600 Token', async () => {
    const userId = 'test-user'
    const order = await store.createRechargeOrder(userId, 30)

    expect(order.token_count).toBe(600)

    const paid = await store.completeRecharge(order.id, 'pay-30')
    expect(paid?.balance).toBe(600)
  })
})
