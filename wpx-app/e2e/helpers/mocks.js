/**
 * @param {import('@playwright/test').Page} page
 * @param {{
 *   aiReply?: string,
 *   aiReplies?: string[],
 *   analyzeResult?: object,
 * }} [options]
 */
export async function setupE2eMocks(page, options = {}) {
  const aiReplyQueue = Array.isArray(options.aiReplies)
    ? [...options.aiReplies]
    : [options.aiReply ?? '润色后的精彩文字']

  const analyzeResult = options.analyzeResult ?? {
    title: 'E2E 测试文档',
    path: '工作/周报',
    tags: ['e2e', '自动化'],
    summary: 'Playwright 端到端测试自动生成的文档摘要。',
  }

  /** @type {Map<string, {
   *   title: string,
   *   content: string,
   *   path: string,
   *   tags: string[],
   *   summary: string,
   *   relativePath: string,
   *   savedAt: string,
   * }>} */
  const libraryDocs = new Map()

  // Register the catch-all FIRST so that more specific routes registered later
  // take precedence in Playwright's route resolution.
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

  await page.route('**/api/library/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        libraryRoot: 'E:\\e2e-library',
        documents: libraryDocs.size,
      }),
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
    const relativePath =
      payload.relativePath ||
      `${payload.path}/${payload.title}.md`.replace(/\/+/g, '/')
    const item = {
      id: relativePath,
      title: payload.title,
      path: payload.path,
      tags: payload.tags || [],
      summary: payload.summary || '',
      relativePath,
      savedAt: new Date().toISOString(),
    }
    libraryDocs.set(relativePath, {
      ...item,
      content: payload.content || '',
    })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        item,
        filePath: `E:\\e2e-library\\${relativePath.replace(/\//g, '\\')}`,
      }),
    })
  })

  await page.route('**/api/library/tree', async (route) => {
    const docs = [...libraryDocs.values()]
    const children = docs.map((doc) => ({
      name: `${doc.title}.md`,
      type: 'file',
      title: doc.title,
      path: doc.path,
      relativePath: doc.relativePath,
      tags: doc.tags,
    }))
    const tagCount = new Map()
    for (const doc of docs) {
      for (const tag of doc.tags || []) {
        tagCount.set(tag, (tagCount.get(tag) || 0) + 1)
      }
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: docs.length,
        tree: { name: '', type: 'folder', path: '', children },
        tags: [...tagCount.entries()].map(([tag, count]) => ({ tag, count })),
      }),
    })
  })

  await page.route('**/api/library/search**', async (route) => {
    const url = new URL(route.request().url())
    const q = (url.searchParams.get('q') || '').trim().toLowerCase()
    const items = [...libraryDocs.values()]
      .filter((doc) => {
        if (!q) return true
        const haystack = `${doc.title}\n${doc.path}\n${(doc.tags || []).join(' ')}\n${doc.content}`.toLowerCase()
        return haystack.includes(q)
      })
      .map((doc) => ({
        title: doc.title,
        path: doc.path,
        relativePath: doc.relativePath,
        tags: doc.tags,
        snippet: String(doc.content || '').slice(0, 80),
      }))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items }),
    })
  })

  await page.route('**/api/library/document**', async (route) => {
    const url = new URL(route.request().url())
    const relativePath = url.searchParams.get('relativePath') || ''
    const doc = libraryDocs.get(relativePath)
    if (!doc) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: '文档不存在' }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        title: doc.title,
        content: doc.content,
        path: doc.path,
        tags: doc.tags,
        summary: doc.summary,
        relativePath: doc.relativePath,
      }),
    })
  })

  const aiHandler = createAiRouteHandler(aiReplyQueue)
  await page.route(/\/chat\/completions(\?|$|\/)/, aiHandler)
  await page.route('**/api/ai/**', aiHandler)
}

/**
 * @param {string[]} replyQueue
 */
function createAiRouteHandler(replyQueue) {
  return async (route) => {
    const request = route.request()
    let stream = false
    const reply =
      replyQueue.length > 1 ? replyQueue.shift() : (replyQueue[0] ?? '润色后的精彩文字')

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
