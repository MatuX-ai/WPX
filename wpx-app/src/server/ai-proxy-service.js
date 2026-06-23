/**
 * AI API 代理服务：在服务端持有 DeepSeek API Key，避免前端暴露。
 * 启动：DEEPSEEK_API_KEY=sk-xxx node src/server/ai-proxy-service.js
 */
import cors from 'cors'
import express from 'express'

const app = express()
const PORT = Number(process.env.AI_PROXY_PORT || 3005)
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY || ''
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')

app.use(cors())
app.use(express.json({ limit: '4mb' }))

app.get('/api/ai/health', (_req, res) => {
  res.json({
    ok: Boolean(DEEPSEEK_API_KEY),
    hasKey: Boolean(DEEPSEEK_API_KEY),
  })
})

app.use('/api/ai', async (req, res) => {
  if (!DEEPSEEK_API_KEY) {
    res.status(503).json({ error: 'DEEPSEEK_API_KEY 未配置' })
    return
  }

  const targetPath = req.originalUrl.replace(/^\/api\/ai/, '') || req.url.replace(/^\/api\/ai/, '')
  const targetUrl = `${DEEPSEEK_BASE_URL}${targetPath}`

  try {
    const headers = {
      'Content-Type': req.headers['content-type'] || 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    }

    if (req.headers.accept) {
      headers.Accept = req.headers.accept
    }

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    })

    res.status(upstream.status)
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'transfer-encoding') return
      res.setHeader(key, value)
    })

    const buffer = await upstream.arrayBuffer()
    res.send(Buffer.from(buffer))
  } catch (error) {
    res.status(502).json({
      error: 'AI 代理请求失败',
      message: error?.message || String(error),
    })
  }
})

app.listen(PORT, () => {
  console.log(`[ai-proxy] listening on http://localhost:${PORT}`)
  if (!DEEPSEEK_API_KEY) {
    console.warn('[ai-proxy] 警告：未设置 DEEPSEEK_API_KEY，代理不可用')
  }
})
