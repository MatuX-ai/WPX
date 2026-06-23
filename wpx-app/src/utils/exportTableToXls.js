import { downloadBlob } from '@/utils/documentExport'

function findActiveTableElement(editor) {
  const { state, view } = editor
  const { $from } = state.selection

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name !== 'table') continue

    const pos = $from.before(depth)
    const dom = view.nodeDOM(pos)
    if (!dom) continue

    if (dom instanceof HTMLTableElement) return dom
    const nested = dom.querySelector?.('table')
    if (nested instanceof HTMLTableElement) return nested
  }

  return null
}

export function exportTableToXls(editor, filename = 'table') {
  const tableEl = findActiveTableElement(editor)
  if (!tableEl) {
    throw new Error('未找到可导出的表格')
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${tableEl.outerHTML}</body></html>`
  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  downloadBlob(blob, `${filename}.xls`)
}
