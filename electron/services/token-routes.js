const crypto = require('node:crypto')
const { getTokenStore, TOKENS_PER_YUAN } = require('./token-store')
const { getCommercialFontStore } = require('./commercial-font-store')

const LOG_PREFIX = '[token-routes]'

function logInfo(message, extra) {
  if (extra !== undefined) {
    console.log(`${LOG_PREFIX} ${message}`, extra)
    return
  }
  console.log(`${LOG_PREFIX} ${message}`)
}

function logWarn(message, extra) {
  if (extra !== undefined) {
    console.warn(`${LOG_PREFIX} ${message}`, extra)
    return
  }
  console.warn(`${LOG_PREFIX} ${message}`)
}

function logError(message, error) {
  if (error instanceof Error) {
    console.error(`${LOG_PREFIX} ${message}`, error.message)
    return
  }
  console.error(`${LOG_PREFIX} ${message}`, error)
}

function getPaymentSecret() {
  return process.env.WPX_PAYMENT_SECRET || 'wpx-dev-payment-secret'
}

/**
 * @param {import('express').Request} req
 * @returns {string | null}
 */
function resolveUserId(req) {
  const headerValue = req.headers['x-wpx-user-id']
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim()
  }

  if (typeof req.body?.user_id === 'string' && req.body.user_id.trim()) {
    return req.body.user_id.trim()
  }

  if (typeof req.query?.user_id === 'string' && req.query.user_id.trim()) {
    return req.query.user_id.trim()
  }

  return null
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requireUserId(req, res, next) {
  const userId = resolveUserId(req)
  if (!userId) {
    return res.status(401).json({ error: '缺少 user_id，请通过 X-WPX-User-Id 请求头或 body.user_id 传递' })
  }

  req.userId = userId
  return next()
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {string}
 */
function buildPaymentSignaturePayload(payload) {
  return [
    String(payload.order_id ?? ''),
    String(payload.user_id ?? ''),
    String(payload.amount ?? ''),
    String(payload.token_count ?? ''),
    String(payload.payment_id ?? ''),
  ].join('|')
}

/**
 * @param {Record<string, unknown>} payload
 * @param {string} signature
 * @returns {boolean}
 */
function verifyPaymentSignature(payload, signature) {
  if (typeof signature !== 'string' || !signature.trim()) {
    return false
  }

  const expected = crypto
    .createHmac('sha256', getPaymentSecret())
    .update(buildPaymentSignaturePayload(payload))
    .digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature.trim(), 'utf8'))
  } catch {
    return false
  }
}

function buildPaymentUrl(req, orderId, channel = 'wechat') {
  const host = req.get('host') || '127.0.0.1'
  return `http://${host}/api/token/payment-mock?order_id=${encodeURIComponent(orderId)}&channel=${encodeURIComponent(channel)}`
}

function buildSignedPaymentCallbackPayload(order, paymentId) {
  const payload = {
    order_id: order.id,
    user_id: order.user_id,
    amount: order.amount,
    token_count: order.token_count,
    payment_id: paymentId,
  }

  const signature = crypto
    .createHmac('sha256', getPaymentSecret())
    .update(buildPaymentSignaturePayload(payload))
    .digest('hex')

  return { ...payload, signature }
}

function resolveFontDisplayName(fontId) {
  try {
    const font = getCommercialFontStore().getCommercialFontById(fontId)
    if (font?.name) return font.name
  } catch {
    // commercial store may be unavailable in tests
  }

  return fontId
}

/**
 * @param {import('express').Application} app
 */
function registerTokenRoutes(app) {
  app.get('/api/token/balance', requireUserId, async (req, res) => {
    try {
      const balance = await getTokenStore().getBalance(req.userId)
      logInfo('balance queried', { userId: req.userId, balance })
      return res.json({ balance })
    } catch (error) {
      logError('GET /api/token/balance failed', error)
      return res.status(500).json({
        error: '查询 Token 余额失败',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.post('/api/token/recharge', requireUserId, async (req, res) => {
    try {
      const amount = Number(req.body?.amount)
      if (!Number.isFinite(amount) || amount < 10 || amount % 10 !== 0) {
        return res.status(400).json({ error: 'amount 必须是大于等于 10 且为 10 的倍数' })
      }

      const order = await getTokenStore().createRechargeOrder(req.userId, amount)
      const paymentUrl = buildPaymentUrl(req, order.id, 'wechat')

      logInfo('recharge order created', {
        userId: req.userId,
        orderId: order.id,
        amount,
        tokenCount: order.token_count,
      })

      return res.json({
        order_id: order.id,
        payment_url: paymentUrl,
        qr_data: {
          wechat: buildPaymentUrl(req, order.id, 'wechat'),
          alipay: buildPaymentUrl(req, order.id, 'alipay'),
        },
        amount: order.amount,
        token_count: order.token_count,
        tokens_per_yuan: TOKENS_PER_YUAN,
      })
    } catch (error) {
      logError('POST /api/token/recharge failed', error)
      return res.status(500).json({
        error: '创建充值订单失败',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.post('/api/token/consume/preview', requireUserId, async (req, res) => {
    try {
      const fonts = req.body?.fonts
      const docHash = typeof req.body?.doc_hash === 'string' ? req.body.doc_hash.trim() : ''

      if (!Array.isArray(fonts) || fonts.length === 0) {
        return res.status(400).json({ error: 'fonts 必须是非空数组' })
      }

      if (!docHash) {
        return res.status(400).json({ error: 'doc_hash 无效' })
      }

      /** @type {Array<{ font_id: string, char_count: number }>} */
      const normalizedFonts = []

      for (const item of fonts) {
        const fontId = typeof item?.font_id === 'string' ? item.font_id.trim() : ''
        const charCount = Number(item?.char_count)

        if (!fontId) {
          return res.status(400).json({ error: 'fonts[].font_id 无效' })
        }

        if (!Number.isFinite(charCount) || charCount < 0) {
          return res.status(400).json({ error: 'fonts[].char_count 无效' })
        }

        normalizedFonts.push({ font_id: fontId, char_count: Math.floor(charCount) })
      }

      const result = await getTokenStore().estimateConsumeTokens(req.userId, normalizedFonts, docHash)
      const enrichedFonts = normalizedFonts.map((item) => {
        const charged = result.charged_fonts.find((font) => font.font_id === item.font_id)
        const deduplicated = result.skipped_fonts.includes(item.font_id)
        return {
          font_id: item.font_id,
          font_name: resolveFontDisplayName(item.font_id),
          char_count: item.char_count,
          token_used: charged?.token_used ?? 0,
          deduplicated,
        }
      })

      return res.json({
        ...result,
        fonts: enrichedFonts,
      })
    } catch (error) {
      logError('POST /api/token/consume/preview failed', error)
      return res.status(500).json({
        error: '预估 Token 消耗失败',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.post('/api/token/consume', requireUserId, async (req, res) => {
    try {
      const fonts = req.body?.fonts
      const docHash = typeof req.body?.doc_hash === 'string' ? req.body.doc_hash.trim() : ''
      const docName = typeof req.body?.doc_name === 'string' ? req.body.doc_name.trim() : ''

      if (!Array.isArray(fonts) || fonts.length === 0) {
        return res.status(400).json({ error: 'fonts 必须是非空数组' })
      }

      if (!docHash) {
        return res.status(400).json({ error: 'doc_hash 无效' })
      }

      /** @type {Array<{ font_id: string, char_count: number }>} */
      const normalizedFonts = []

      for (const item of fonts) {
        const fontId = typeof item?.font_id === 'string' ? item.font_id.trim() : ''
        const charCount = Number(item?.char_count)

        if (!fontId) {
          return res.status(400).json({ error: 'fonts[].font_id 无效' })
        }

        if (!Number.isFinite(charCount) || charCount < 0) {
          return res.status(400).json({ error: 'fonts[].char_count 无效' })
        }

        normalizedFonts.push({ font_id: fontId, char_count: Math.floor(charCount) })
      }

      const result = await getTokenStore().consumeTokens(
        req.userId,
        normalizedFonts,
        docHash,
        docName || null,
      )

      logInfo('token consumed', {
        userId: req.userId,
        docHash,
        totalConsumed: result.total_consumed,
        alreadyConsumed: result.already_consumed,
      })

      return res.json({
        success: result.success,
        balance_after: result.balance_after,
        total_consumed: result.total_consumed,
        already_consumed: result.already_consumed,
        skipped_fonts: result.skipped_fonts,
        charged_fonts: result.charged_fonts,
      })
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'TOKEN_INSUFFICIENT') {
        logWarn('consume rejected: insufficient balance', { userId: req.userId })
        return res.status(402).json({
          error: 'Token 余额不足',
          code: 'TOKEN_INSUFFICIENT',
        })
      }

      logError('POST /api/token/consume failed', error)
      return res.status(500).json({
        error: 'Token 消费失败',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.get('/api/token/recharge-records', requireUserId, async (req, res) => {
    try {
      const limit = Number.parseInt(String(req.query.limit ?? '100'), 10)
      const records = await getTokenStore().listRechargeRecords(req.userId, {
        limit: Number.isFinite(limit) ? limit : 100,
      })

      logInfo('recharge records listed', { userId: req.userId, count: records.length })
      return res.json(records)
    } catch (error) {
      logError('GET /api/token/recharge-records failed', error)
      return res.status(500).json({
        error: '查询充值记录失败',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.get('/api/token/recharge/:orderId/status', requireUserId, async (req, res) => {
    try {
      const orderId = typeof req.params.orderId === 'string' ? req.params.orderId.trim() : ''
      if (!orderId) {
        return res.status(400).json({ error: '订单 ID 无效' })
      }

      const order = getTokenStore().findRechargeRecord(orderId)
      if (!order) {
        return res.status(404).json({ error: '充值订单不存在' })
      }

      if (order.user_id !== req.userId) {
        return res.status(403).json({ error: '无权查看该订单' })
      }

      const balance =
        order.status === 'paid' ? await getTokenStore().getBalance(req.userId) : undefined

      return res.json({
        order_id: order.id,
        status: order.status,
        amount: order.amount,
        token_count: order.token_count,
        balance,
      })
    } catch (error) {
      logError('GET /api/token/recharge/:orderId/status failed', error)
      return res.status(500).json({
        error: '查询订单状态失败',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.post('/api/token/recharge/:orderId/simulate-pay', requireUserId, async (req, res) => {
    try {
      const orderId = typeof req.params.orderId === 'string' ? req.params.orderId.trim() : ''
      if (!orderId) {
        return res.status(400).json({ error: '订单 ID 无效' })
      }

      const order = getTokenStore().findRechargeRecord(orderId)
      if (!order) {
        return res.status(404).json({ error: '充值订单不存在' })
      }

      if (order.user_id !== req.userId) {
        return res.status(403).json({ error: '无权操作该订单' })
      }

      if (order.status === 'paid') {
        const balance = await getTokenStore().getBalance(req.userId)
        return res.json({
          success: true,
          status: 'paid',
          balance,
          token_count: order.token_count,
        })
      }

      const paymentId = `mock-${crypto.randomUUID()}`
      const completed = await getTokenStore().completeRecharge(orderId, paymentId)
      if (!completed) {
        return res.status(404).json({ error: '充值订单不存在' })
      }

      logInfo('simulate payment completed', {
        orderId,
        userId: req.userId,
        balance: completed.balance,
      })

      return res.json({
        success: true,
        status: 'paid',
        balance: completed.balance,
        token_count: order.token_count,
      })
    } catch (error) {
      logError('POST /api/token/recharge/:orderId/simulate-pay failed', error)
      return res.status(500).json({
        error: '模拟支付失败',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.get('/api/token/records', requireUserId, async (req, res) => {
    try {
      const limit = Number.parseInt(String(req.query.limit ?? '100'), 10)
      const from = typeof req.query.from === 'string' ? req.query.from : undefined
      const to = typeof req.query.to === 'string' ? req.query.to : undefined

      const records = await getTokenStore().listConsumeRecords(req.userId, {
        limit: Number.isFinite(limit) ? limit : 100,
        from,
        to,
      })

      const enriched = records.map((record) => ({
        ...record,
        font_name: resolveFontDisplayName(record.font_id),
        document_name: record.doc_name || '未命名文档',
      }))

      logInfo('consume records listed', { userId: req.userId, count: enriched.length })
      return res.json(enriched)
    } catch (error) {
      logError('GET /api/token/records failed', error)
      return res.status(500).json({
        error: '查询消费记录失败',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.post('/api/token/payment-callback', async (req, res) => {
    try {
      const payload = req.body ?? {}
      const orderId = typeof payload.order_id === 'string' ? payload.order_id.trim() : ''
      const paymentId = typeof payload.payment_id === 'string' ? payload.payment_id.trim() : ''
      const userId = typeof payload.user_id === 'string' ? payload.user_id.trim() : ''
      const amount = Number(payload.amount)
      const tokenCount = Number(payload.token_count)
      const signature = typeof payload.signature === 'string' ? payload.signature : ''

      if (!orderId || !paymentId || !userId) {
        return res.status(400).json({ error: 'order_id、payment_id、user_id 为必填项' })
      }

      if (!Number.isFinite(amount) || !Number.isFinite(tokenCount)) {
        return res.status(400).json({ error: 'amount 或 token_count 无效' })
      }

      if (!verifyPaymentSignature(payload, signature)) {
        logWarn('payment callback signature invalid', { orderId, userId })
        return res.status(403).json({ error: '支付回调签名校验失败' })
      }

      const order = getTokenStore().findRechargeRecord(orderId)
      if (!order) {
        return res.status(404).json({ error: '充值订单不存在' })
      }

      if (order.user_id !== userId) {
        return res.status(400).json({ error: '订单用户不匹配' })
      }

      if (order.amount !== amount || order.token_count !== tokenCount) {
        return res.status(400).json({ error: '订单金额或 Token 数量不匹配' })
      }

      const completed = await getTokenStore().completeRecharge(orderId, paymentId)
      if (!completed) {
        return res.status(404).json({ error: '充值订单不存在' })
      }

      logInfo('payment callback processed', {
        orderId,
        paymentId,
        userId,
        balance: completed.balance,
      })

      return res.json({
        success: true,
        order_id: orderId,
        balance: completed.balance,
      })
    } catch (error) {
      logError('POST /api/token/payment-callback failed', error)
      return res.status(500).json({
        error: '支付回调处理失败',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.get('/api/token/payment-mock', async (req, res) => {
    const orderId = typeof req.query.order_id === 'string' ? req.query.order_id.trim() : ''
    const channel = typeof req.query.channel === 'string' ? req.query.channel.trim() : 'wechat'
    if (!orderId) {
      return res.status(400).json({ error: '缺少 order_id' })
    }

    const order = getTokenStore().findRechargeRecord(orderId)
    if (!order) {
      return res.status(404).json({ error: '充值订单不存在' })
    }

    if (order.status === 'paid') {
      return res.json({
        message: '订单已支付',
        order_id: order.id,
        status: order.status,
      })
    }

    const paymentId = `mock-${channel}-${crypto.randomUUID()}`
    const callbackPayload = buildSignedPaymentCallbackPayload(order, paymentId)
    await getTokenStore().completeRecharge(order.id, paymentId)

    return res.json({
      message: `开发环境 ${channel === 'alipay' ? '支付宝' : '微信'} 支付模拟成功`,
      order_id: order.id,
      user_id: order.user_id,
      amount: order.amount,
      token_count: order.token_count,
      status: 'paid',
      callback_payload: callbackPayload,
    })
  })

  logInfo('Token routes registered')
}

module.exports = {
  registerTokenRoutes,
  verifyPaymentSignature,
  buildPaymentSignaturePayload,
}
