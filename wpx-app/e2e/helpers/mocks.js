/**
 * @param {import('@playwright/test').Page} page
 * @param {{ aiReply?: string, analyzeResult?: object }} [options]
 */
export async function setupE2eMocks(page, options = {}) {
  const aiReply = options.aiReply ?? '润色后的精彩文字'
  const analyzeResult = options.analyzeResult ?? {
    title: 'E2E 测试文档',
    path: '工作/周报',
    tags: ['e2e', '自动化'],
    summary: 'Playwright 端到端测试自动生成的文档摘要。',
  }

  // Register the catch-all FIRST so that more specific routes registered later
  // take precedence in Playwright's route resolution.
  // Fallback: intercept any unmatched /api/ requests to prevent test hangs
  await page.route('**/api/**', async (route) => {
    await route.fulfill({
      status: 501,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'not mocked' }),
    })
  })

  await page.route('**/api/knowledge/**', async (route) => {
    const url = route.request().url()

    if (url.includes('/preview')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: '参考资料预览内容' }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    })
  })

  await page.route('**/api/library/analyze', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(analyzeResult),
    })
  })

  await page.route('**/api/library/save', async (route) => {
    const payload = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        item: {
          id: 'e2e-doc-1',
          title: payload.title,
          path: payload.path,
          tags: payload.tags,
          summary: payload.summary,
          relativePath: `${payload.path}/${payload.title}.md`.replace(/\//g, '/'),
          savedAt: new Date().toISOString(),
        },
      }),
    })
  })

  const aiHandler = createAiRouteHandler(aiReply)
  // Use a regex so the route matches any host / port / path that contains
  // `chat/completions` — that covers both the Vite-proxied `/api/ai/...` and
  // the direct upstream `https://api.deepseek.com/chat/completions` URL the
  // AI SDK dials.
  await page.route(/\/chat\/completions(\?|$|\/)/, aiHandler)
  await page.route('**/api/ai/**', aiHandler)
}

/**
 * @param {string} reply
 */
function createAiRouteHandler(reply) {
  return async (route) => {
    const request = route.request()
    let stream = false

    try {
      const body = request.postDataJSON()
      stream = Boolean(body?.stream)
    } catch {
      stream = request.headers()['accept']?.includes('text/event-stream')
    }

    if (stream) {
      const chunks = [
        buildOpenAiSseChunk({ role: 'assistant' }),
        buildOpenAiSseChunk({ content: reply }),
        buildOpenAiSseChunk({}, true),
      ]

      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
        body: `${chunks.join('')}data: [DONE]\n\n`,
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'chatcmpl-e2e',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: reply },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 8,
          total_tokens: 20,
        },
      }),
    })
  }
}

function buildOpenAiSseChunk(delta, finished = false) {
  const choice = finished
    ? { index: 0, delta: {}, finish_reason: 'stop' }
    : { index: 0, delta, finish_reason: null }

  return `data: ${JSON.stringify({
    id: 'chatcmpl-e2e',
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: 'deepseek-chat',
    choices: [choice],
  })}\n\n`
}
