const { getCommercialFontStore } = require('./commercial-font-store')

const LOG_PREFIX = '[commercial-font-routes]'

function logInfo(message, extra) {
  if (extra !== undefined) {
    console.log(`${LOG_PREFIX} ${message}`, extra)
    return
  }
  console.log(`${LOG_PREFIX} ${message}`)
}

function logError(message, error) {
  if (error instanceof Error) {
    console.error(`${LOG_PREFIX} ${message}`, error.message)
    return
  }
  console.error(`${LOG_PREFIX} ${message}`, error)
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

  if (typeof req.query?.user_id === 'string' && req.query.user_id.trim()) {
    return req.query.user_id.trim()
  }

  return null
}

/**
 * @param {import('express').Application} app
 */
function registerCommercialFontRoutes(app) {
  app.get('/api/fonts/commercial/list', (_req, res) => {
    try {
      const fonts = getCommercialFontStore().listCommercialFonts()
      logInfo('commercial font list queried', { count: fonts.length })
      return res.json(fonts)
    } catch (error) {
      logError('GET /api/fonts/commercial/list failed', error)
      return res.status(500).json({
        error: '获取商业字体列表失败',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.get('/api/fonts/commercial/detail/:id', (req, res) => {
    try {
      const fontId = typeof req.params.id === 'string' ? req.params.id.trim() : ''
      if (!fontId) {
        return res.status(400).json({ error: '字体 ID 无效' })
      }

      const font = getCommercialFontStore().getCommercialFontById(fontId)
      if (!font) {
        return res.status(404).json({ error: '字体不存在' })
      }

      const userId = resolveUserId(req)
      const isPurchased = userId
        ? getCommercialFontStore().hasUserPurchasedFont(userId, fontId)
        : false

      logInfo('commercial font detail queried', { fontId, userId: userId || null, isPurchased })

      return res.json({
        id: font.id,
        name: font.name,
        category: font.category,
        preview_url: font.preview_url,
        thumbnail_url: font.thumbnail_url,
        vendor: font.vendor,
        price_per_char: font.price_per_char,
        description: font.description,
        sample_text: font.sample_text,
        font_file_url: isPurchased ? font.font_file_url : null,
        tags: font.tags,
        is_purchased: isPurchased,
      })
    } catch (error) {
      logError('GET /api/fonts/commercial/detail/:id failed', error)
      return res.status(500).json({
        error: '获取字体详情失败',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  })

  logInfo('Commercial font routes registered')
}

module.exports = {
  registerCommercialFontRoutes,
}
