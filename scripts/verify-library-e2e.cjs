/**
 * 端到端验证脚本：模拟 Electron 渲染进程 → local-server → library-routes 全链路
 *
 * 验证三件事：
 *   1. local-server.js 能成功启动并注册 library 路由（修改 2 生效）
 *   2. /api/library/health 端点可访问（修复"Failed to fetch"的核心路径）
 *   3. /api/library/save 端点能成功持久化文档（修复"保存失败"的根因）
 *
 * 与单元测试的区别：本脚本加载真实的 local-server.js 而非绕过，
 * 覆盖 require → express 注册 → listen 的完整路径，
 * 用于捕获"测试通过但实际启动失败"的差异。
 *
 * 运行：node scripts/verify-library-e2e.cjs
 */

const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')

const ROOT = path.join(__dirname, '..')
const ELECTRON = path.join(ROOT, 'electron')
const WPX_APP = path.join(ROOT, 'wpx-app')

// 临时 userData 目录
const TEMP_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'wpx-verify-'))

let electronMockApplied = false

function applyElectronMock() {
  if (electronMockApplied) return
  electronMockApplied = true

  const Module = require('node:module')
  const originalLoad = Module._load
  Module._load = function loadWithMock(request, parent, isMain) {
    if (request === 'electron') {
      return {
        app: {
          isPackaged: false,
          isReady: () => true,
          whenReady: () => Promise.resolve(),
          getPath: (key) => (key === 'userData' ? TEMP_USER_DATA : os.tmpdir()),
        },
        ipcMain: { handle: () => {}, on: () => {} },
        BrowserWindow: { getAllWindows: () => [] },
        session: {
          defaultSession: {
            webRequest: { onHeadersReceived: () => {} },
          },
        },
        dialog: { showErrorBox: () => {} },
        shell: { openExternal: () => Promise.resolve() },
      }
    }
    return originalLoad.call(this, request, parent, isMain)
  }
}

async function run() {
  applyElectronMock()

  console.log('[verify] 临时 userData 目录:', TEMP_USER_DATA)

  // 1) 启动真实的 local-server（覆盖修改 2：registerLibraryRoutes 已注册）
  const { startLocalServer, getLocalServerBaseUrl, stopLocalServer } = require(path.join(ELECTRON, 'local-server.js'))
  const { baseUrl } = await startLocalServer()
  console.log('[verify] local-server 启动于:', baseUrl)

  const resolved = getLocalServerBaseUrl()
  if (!resolved) {
    throw new Error('local-server baseUrl 为空')
  }

  // 2) 验证 /api/library/health
  const healthRes = await fetch(`${baseUrl}/api/library/health`)
  if (!healthRes.ok) {
    throw new Error(`/api/library/health 返回 ${healthRes.status}`)
  }
  const health = await healthRes.json()
  console.log('[verify] /api/library/health:', JSON.stringify(health))
  if (health.status !== 'ok') {
    throw new Error(`health.status 应为 ok，实际为 ${health.status}`)
  }
  if (!String(health.libraryRoot).startsWith(TEMP_USER_DATA)) {
    throw new Error(`libraryRoot 应指向临时 userData，实际为 ${health.libraryRoot}`)
  }

  // 3) 验证 /api/library/analyze（AI 建议）
  const analyzeRes = await fetch(`${baseUrl}/api/library/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: '# WPX Vite 构建优化计划\n\n本周完成 Vite 构建优化与按需加载方案。',
      title: '',
      pathCorrections: [],
    }),
  })
  if (!analyzeRes.ok) {
    throw new Error(`/api/library/analyze 返回 ${analyzeRes.status}`)
  }
  const analyzed = await analyzeRes.json()
  console.log('[verify] /api/library/analyze:', JSON.stringify(analyzed, null, 2))
  if (!analyzed.title || !analyzed.path) {
    throw new Error('analyze 应返回 title 与 path')
  }

  // 4) 验证 /api/library/save（核心修复点：保存失败）
  const saveRes = await fetch(`${baseUrl}/api/library/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'WPX Vite 构建优化计划',
      content: '# WPX Vite 构建优化计划\n\n本周完成 Vite 构建优化与按需加载方案。\n- 减少手动 chunk\n- 优化 CSS Code Split\n- 启用 brotli 压缩',
      path: analyzed.path,
      tags: ['vite', '优化', '构建'],
      summary: analyzed.summary,
      suggestedPath: analyzed.path,
    }),
  })

  if (!saveRes.ok) {
    const text = await saveRes.text().catch(() => '')
    throw new Error(`/api/library/save 返回 ${saveRes.status}：${text}`)
  }
  const saved = await saveRes.json()
  console.log('[verify] /api/library/save:', JSON.stringify(saved, null, 2))

  if (!saved.success) {
    throw new Error('save 应返回 success:true')
  }
  if (!fs.existsSync(saved.filePath)) {
    throw new Error(`保存的文件不存在：${saved.filePath}`)
  }
  const fileContent = fs.readFileSync(saved.filePath, 'utf8')
  if (!fileContent.includes('title: "WPX Vite 构建优化计划"')) {
    throw new Error('保存的文件 frontmatter 缺少 title')
  }
  console.log('[verify] 文件已写入:', saved.filePath)

  // 5) 验证 /api/library/tree（文库视图列表）
  const treeRes = await fetch(`${baseUrl}/api/library/tree`)
  const treeData = await treeRes.json()
  console.log('[verify] /api/library/tree total:', treeData.total)
  if (treeData.total < 1) {
    throw new Error('tree.total 应至少为 1')
  }

  // 6) 验证 /api/library/document（打开已保存文档）
  const docRes = await fetch(
    `${baseUrl}/api/library/document?relativePath=${encodeURIComponent(saved.item.relativePath)}`,
  )
  if (!docRes.ok) {
    throw new Error(`/api/library/document 返回 ${docRes.status}`)
  }
  const docData = await docRes.json()
  console.log('[verify] /api/library/document title:', docData.title)
  if (docData.title !== 'WPX Vite 构建优化计划') {
    throw new Error(`document title 不匹配：${docData.title}`)
  }

  // 7) 验证 /api/library/search（文库搜索）
  const searchRes = await fetch(`${baseUrl}/api/library/search?q=vite`)
  const searchData = await searchRes.json()
  console.log('[verify] /api/library/search items:', searchData.items.length)
  if (searchData.items.length < 1) {
    throw new Error('search 应至少匹配到 1 条')
  }

  await stopLocalServer()

  console.log('\n[verify] ✅ 端到端验证全部通过：')
  console.log('  - local-server 注册了 library 路由')
  console.log('  - /api/library/health / analyze / save / tree / search / document 全部可用')
  console.log('  - "Failed to fetch" 与 "保存失败" 根因已修复')
  console.log('  - 文库根目录:', health.libraryRoot)
}

run()
  .then(() => {
    // 清理临时目录
    fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true })
    console.log('[verify] 已清理临时目录')
    process.exit(0)
  })
  .catch((err) => {
    console.error('[verify] ❌ 端到端验证失败:', err.message)
    console.error(err.stack)
    try {
      fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true })
    } catch {}
    process.exit(1)
  })