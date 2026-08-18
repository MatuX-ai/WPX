/**
 * skillhub-ipc —— SKILL.md 技能市场主进程 IPC（Phase 1 / M1.5）
 *
 * 能力：
 * - skillhub:export       把 SKILL.md 文件清单导出到磁盘（单文件→保存对话框；多文件→选目录）
 * - skillhub:import-file  打开对话框选择本地 SKILL.md 并读取内容
 *
 * 设计：
 * - 纯函数（sanitizeSegment / buildSkillMdRelativePath / writeSkillMdFiles）与
 *   electron 接线（registerSkillhubIpcHandlers）分离，便于单元测试。
 * - 所有 handler 捕获异常并返回 { ok:false, error }，不抛穿（对齐主进程 IPC 约定）。
 */
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')

const LOG_PREFIX = '[skillhub-ipc]'

// ── 纯函数：路径构建 / 安全 ────────────────────

/**
 * 净化单段路径片段：去除路径分隔符 / 盘符 / .. / 非法字符，统一小写
 * @param {string} segment
 * @param {string} fallback 净化后为空时使用的回退值（传 '' 表示丢弃该段）
 * @returns {string}
 */
function sanitizeSegment (segment, fallback = 'skill') {
  const cleaned = String(segment || '')
    .replace(/[\\/]/g, '-')      // 路径分隔符 → 连字符
    .replace(/\.\./g, '')        // 去掉 ..
    .replace(/[<>:"|?*\u0000-\u001f]/g, '') // Windows 非法字符
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim()
    .toLowerCase()
  return cleaned || fallback
}

/**
 * 构建 SKILL.md 相对路径：skills/<category>/<subcategory>/<id>/SKILL.md
 * subcategory 为空/无效时压缩为 skills/<category>/<id>/SKILL.md
 * @param {{ id: string, category?: string, subcategory?: string }} file
 * @returns {string}
 */
function buildSkillMdRelativePath (file) {
  const id = sanitizeSegment(file && file.id, 'skill')
  const category = sanitizeSegment(file && file.category, 'general')
  const subcategory = sanitizeSegment(file && file.subcategory, '')
  const tail = subcategory ? `${category}/${subcategory}/${id}/SKILL.md` : `${category}/${id}/SKILL.md`
  return `skills/${tail}`
}

/**
 * 将 SKILL.md 文件清单写入指定目录（相对路径安全展开）
 * @param {string} dir 目标根目录
 * @param {Array<{ id: string, name?: string, category?: string, subcategory?: string, content: string }>} files
 * @returns {Promise<{ written: number, paths: string[] }>}
 */
async function writeSkillMdFiles (dir, files) {
  const written = []
  for (const file of files || []) {
    const rel = buildSkillMdRelativePath(file)
    const abs = path.join(dir, ...rel.split('/'))
    // 防止越出目标目录（双保险）
    const resolved = path.resolve(abs)
    if (!resolved.startsWith(path.resolve(dir) + path.sep)) {
      console.warn(`${LOG_PREFIX} 拒绝越界路径: ${rel}`)
      continue
    }
    await fsp.mkdir(path.dirname(resolved), { recursive: true })
    await fsp.writeFile(resolved, String(file.content || ''), 'utf8')
    written.push(resolved)
  }
  return { written: written.length, paths: written }
}

// ── IPC 注册 ──────────────────────────────────

/**
 * 注册 skillhub IPC 通道
 * @param {{ ipcMain: any, dialog: any }} deps
 */
function registerSkillhubIpcHandlers ({ ipcMain, dialog }) {
  if (!ipcMain || !dialog) {
    console.warn(`${LOG_PREFIX} 缺少 ipcMain/dialog，跳过注册`)
    return
  }

  // ── 导出：单文件→保存对话框；多文件→选择目录 ──
  ipcMain.handle('skillhub:export', async (_event, payload = {}) => {
    const files = Array.isArray(payload.files) ? payload.files : []
    if (files.length === 0) {
      return { ok: false, error: '没有可导出的文件' }
    }
    try {
      if (files.length === 1) {
        const file = files[0]
        const defaultName = `${sanitizeSegment(file.id, 'skill')}-SKILL.md`
        const result = await dialog.showSaveDialog({
          title: '导出 SKILL.md',
          defaultPath: defaultName,
          filters: [{ name: 'Markdown (SKILL.md)', extensions: ['md'] }],
        })
        if (result.canceled || !result.filePath) {
          return { ok: false, canceled: true }
        }
        await fsp.writeFile(result.filePath, String(file.content || ''), 'utf8')
        return { ok: true, path: result.filePath, written: 1 }
      }

      const result = await dialog.showOpenDialog({
        title: '选择导出目录',
        properties: ['openDirectory', 'createDirectory'],
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, canceled: true }
      }
      const dir = result.filePaths[0]
      const { written, paths } = await writeSkillMdFiles(dir, files)
      return { ok: true, dir, written, paths }
    } catch (error) {
      console.error(`${LOG_PREFIX} 导出失败:`, error?.message || error)
      return { ok: false, error: error?.message || String(error) }
    }
  })

  // ── 导入：打开对话框读取单个 SKILL.md ──
  ipcMain.handle('skillhub:import-file', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '导入 SKILL.md',
        properties: ['openFile'],
        filters: [{ name: 'SKILL.md / Markdown', extensions: ['md', 'markdown'] }],
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, canceled: true }
      }
      const filePath = result.filePaths[0]
      const content = await fsp.readFile(filePath, 'utf8')
      return {
        ok: true,
        path: filePath,
        name: path.basename(filePath),
        content,
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} 导入失败:`, error?.message || error)
      return { ok: false, error: error?.message || String(error) }
    }
  })
}

module.exports = {
  sanitizeSegment,
  buildSkillMdRelativePath,
  writeSkillMdFiles,
  registerSkillhubIpcHandlers,
}
