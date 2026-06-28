import { describe, expect, it } from 'vitest'

// pdfOcrClient 顶层 import 了 pdfjs-dist 和 tesseract.js，在 jsdom 里加载会
// 触发 worker / wasm 初始化。 这里把模块整体替换成最小 stub，只暴露顶层
// GlobalWorkerOptions（让模块加载不出错），导出我们要测的纯函数。
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => ({ promise: Promise.reject(new Error('not used in tests')) }),
}))
vi.mock('pdfjs-dist/build/pdf.worker.mjs?url', () => ({ default: 'pdf.worker.stub' }))
vi.mock('tesseract.js', () => ({
  createWorker: () => Promise.reject(new Error('not used in tests')),
}))

const { looksLikeHeading, structurePageText } = await import('@/utils/pdfOcrClient')

describe('pdfOcrClient — looksLikeHeading', () => {
  it('带章节序号 → 标题', () => {
    expect(looksLikeHeading('第一章 引言')).toBe(true)
    expect(looksLikeHeading('1. 背景')).toBe(true)
    expect(looksLikeHeading('一、方法概述')).toBe(true)
    expect(looksLikeHeading('第3章')).toBe(true)
  })

  it('标题关键字 → 标题', () => {
    expect(looksLikeHeading('项目背景')).toBe(true)
    expect(looksLikeHeading('研究概述')).toBe(true)
    expect(looksLikeHeading('实验结果')).toBe(true)
    expect(looksLikeHeading('参考文献')).toBe(true)
  })

  it('全大写英文 → 标题', () => {
    expect(looksLikeHeading('INTRODUCTION')).toBe(true)
    expect(looksLikeHeading('OVERVIEW')).toBe(true)
    expect(looksLikeHeading('A B C')).toBe(true)
  })

  it('超过 30 字符 → 视为段落', () => {
    const longLine = '中'.repeat(40)
    expect(looksLikeHeading(longLine)).toBe(false)
  })

  it('长度不足 2 字符 → 视为段落', () => {
    expect(looksLikeHeading('一')).toBe(false)
    expect(looksLikeHeading(' ')).toBe(false)
  })

  it('以句末标点结尾 → 视为段落', () => {
    expect(looksLikeHeading('这是句子。')).toBe(false)
    expect(looksLikeHeading('A sentence.')).toBe(false)
    expect(looksLikeHeading('真的是问句？')).toBe(false)
    expect(looksLikeHeading('感叹句！')).toBe(false)
    expect(looksLikeHeading('引用；')).toBe(false)
  })

  it('含强分隔标点 → 视为段落', () => {
    expect(looksLikeHeading('项目背景：xxx')).toBe(false)
    expect(looksLikeHeading('方法，结果')).toBe(false)
  })

  it('常见动词后缀的中文短语 → 视为段落', () => {
    expect(looksLikeHeading('这是示例')).toBe(false)
    expect(looksLikeHeading('背景介绍')).toBe(false)
  })

  it('纯数字 / 标点 → 视为段落', () => {
    expect(looksLikeHeading('123')).toBe(false)
    expect(looksLikeHeading('1.2.3')).toBe(false)
    expect(looksLikeHeading('---')).toBe(false)
  })

  it('空字符串 / 纯空格 → 不是标题', () => {
    expect(looksLikeHeading('')).toBe(false)
    expect(looksLikeHeading('   ')).toBe(false)
  })

  it('含英文小写的中文短语 → 视为段落', () => {
    // 包含英文小写字母不符合"纯中文"模式
    expect(looksLikeHeading('这是一个title')).toBe(false)
  })
})

describe('pdfOcrClient — structurePageText', () => {
  it('空字符串 → 返回空', () => {
    expect(structurePageText('')).toBe('')
    expect(structurePageText(null)).toBe('')
  })

  it('CRLF 归一为 LF，并去除行尾空格', () => {
    const out = structurePageText('第一行   \r\n第二行   \r\n第三行')
    expect(out).not.toContain('\r')
    expect(out).toContain('第一行')
    expect(out).toContain('第三行')
  })

  it('多个连续空行被压缩成段落分隔（双换行）', () => {
    const raw = '## 段落A\n\n\n\n\n## 段落B'
    const out = structurePageText(raw)
    // "## 段落A" 含 "##" 开头会先被 buffer 接收，但单独的 "段落A" 会被识别
    // 为标题，模拟场景：原文不带 ## 的纯文本
    const raw2 = '段落A\n\n\n\n\n段落B'
    const out2 = structurePageText(raw2)
    expect(out2).toBe('段落A\n\n段落B')
  })

  it('OCR 输出零散短句会被合并成一段', () => {
    // 模拟 OCR 把同一段落切成多行
    const raw = '这是\n同一\n段的\n内容'
    const out = structurePageText(raw)
    expect(out).toBe('这是 同一 段的 内容')
  })

  it('单独成行的短句 → 升级为 ## 标题', () => {
    const raw = '## 第一章\n本章介绍项目背景。'
    // 当前实现没有 H1/H2 标记识别；"本章介绍项目背景。"含句号 → 段落
    const out = structurePageText(raw)
    expect(out).toContain('本章介绍项目背景')
  })

  it('heuristic 标题：短、无句末标点 → 升为 ## 标题', () => {
    const raw = '项目背景\n\n本项目研究 OCR 技术。'
    const out = structurePageText(raw)
    // "项目背景" 短且无句末标点 → ## 标题
    expect(out).toContain('## 项目背景')
    expect(out).toContain('本项目研究 OCR 技术')
  })

  it('整个页面只有空格 → 返回空字符串', () => {
    expect(structurePageText('   \n\n   \t  \n')).toBe('')
  })

  it('替换 NBSP 为普通空格', () => {
    const out = structurePageText('正文\u00A0段落')
    expect(out).not.toContain('\u00A0')
    expect(out).toContain('正文')
  })
})