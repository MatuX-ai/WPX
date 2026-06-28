import { Extension } from '@tiptap/core'

/**
 * WPX HTML 导入扩展
 *
 * 背景：
 *   ProseMirror 的 doc 节点默认不包含自定义 attrs。
 *   WPX 网页文件导入功能需要在 doc 节点上持久化以下元数据：
 *     - htmlSource              完整原始 HTML 源码（用于"恢复原样"）
 *     - sourceUrl               来源 URL（粘贴 URL 导入时记录）
 *     - importedAt              导入时间戳（ISO 8601）
 *     - importSource            导入方式（paste | file | url）
 *     - lastFormattedTemplate   最近一次排版应用的模板 id（排版完成后写入）
 *     - lastFormattedAt         最近一次排版时间（ISO 8601）
 *
 *   这些字段必须随文档 JSON 一起持久化、跨窗口传输，因此必须由 schema 显式声明。
 *
 *   本扩展通过 addGlobalAttributes 把这些字段注入到 doc 类型，
 *   并提供 setHtmlSource / clearHtmlSource / setFormatState 命令，
 *   业务层（useHtmlImporter / useHtmlFormatter）只通过命令操作，不直接写 transaction。
 *
 * 注意：doc 节点上的 attrs 不参与 HTML 渲染（renderHTML 返回 {}），
 *       仅在 getJSON / getHTML 序列化阶段保留，因此导出 MD/PDF/Word 时
 *       由 exportAttrsFilter 主动剥离。
 */
export const HtmlSourceExtension = Extension.create({
  name: 'htmlSource',

  addGlobalAttributes() {
    return [
      {
        types: ['doc'],
        attributes: {
          htmlSource: {
            default: null,
            parseHTML: () => null,
            renderHTML: () => ({}),
          },
          sourceUrl: {
            default: null,
            parseHTML: () => null,
            renderHTML: () => ({}),
          },
          importedAt: {
            default: null,
            parseHTML: () => null,
            renderHTML: () => ({}),
          },
          importSource: {
            default: null,
            parseHTML: () => null,
            renderHTML: () => ({}),
          },
          lastFormattedTemplate: {
            default: null,
            parseHTML: () => null,
            renderHTML: () => ({}),
          },
          lastFormattedAt: {
            default: null,
            parseHTML: () => null,
            renderHTML: () => ({}),
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      /**
       * 写入 HTML 导入元数据（htmlSource / sourceUrl / importedAt / importSource）。
       * 保留已有字段，仅覆盖提供的字段。
       */
      setHtmlSource:
        (payload) =>
        ({ tr, dispatch }) => {
          if (!tr || !tr.doc) return false
          const doc = tr.doc
          const next = { ...doc.attrs }
          if (payload && typeof payload === 'object') {
            if ('htmlSource' in payload) next.htmlSource = payload.htmlSource
            if ('sourceUrl' in payload) next.sourceUrl = payload.sourceUrl ?? null
            if ('importedAt' in payload) next.importedAt = payload.importedAt ?? null
            if ('importSource' in payload) next.importSource = payload.importSource ?? null
          }
          const newDoc = doc.type.create(next, doc.content, doc.marks)
          if (!dispatch) return true
          tr.replaceWith(0, doc.content.size, newDoc)
          return true
        },

      /**
       * 清除所有 HTML 内部 attrs（"清除格式"或主动重置时调用）。
       */
      clearHtmlSource:
        () =>
        ({ tr, dispatch }) => {
          if (!tr || !tr.doc) return false
          const doc = tr.doc
          const next = { ...doc.attrs }
          delete next.htmlSource
          delete next.sourceUrl
          delete next.importedAt
          delete next.importSource
          delete next.lastFormattedTemplate
          delete next.lastFormattedAt
          const newDoc = doc.type.create(next, doc.content, doc.marks)
          if (!dispatch) return true
          tr.replaceWith(0, doc.content.size, newDoc)
          return true
        },

      /**
       * 记录最近一次的排版结果（模板 + 时间），供"恢复原样"提示使用。
       */
      setFormatState:
        (payload) =>
        ({ tr, dispatch }) => {
          if (!tr || !tr.doc) return false
          const doc = tr.doc
          const next = { ...doc.attrs }
          if (payload && typeof payload === 'object') {
            if ('templateId' in payload) next.lastFormattedTemplate = payload.templateId ?? null
            if ('formattedAt' in payload) next.lastFormattedAt = payload.formattedAt ?? null
          }
          const newDoc = doc.type.create(next, doc.content, doc.marks)
          if (!dispatch) return true
          tr.replaceWith(0, doc.content.size, newDoc)
          return true
        },
    }
  },
})

export default HtmlSourceExtension
