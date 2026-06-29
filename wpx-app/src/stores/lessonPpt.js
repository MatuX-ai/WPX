/**
 * 课件生成状态 Store（lessonPpt）
 *
 * 集中保存：
 *  - 当前文档识别出的学科 / 学段 / 模板
 *  - 教案解析结果（outline / confidence）
 *  - 最近一次生成的幻灯片数据
 *  - 增量更新 diff
 *  - 文档内容哈希（用于判断教案是否变更）
 *
 * 设计原则：
 *  - Pinia store，单例
 *  - 状态全部 ref，便于在任意组件 / 本地指令 / 工具栏中读取
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { parseLessonPlan, diffOutline } from '@/utils/lessonPlanParser'
import { getTemplate, DEFAULT_TEMPLATE } from '@/data/lesson-templates'

/**
 * 简易 SHA-1（不依赖 crypto.subtle，避免 http 限制）
 * 仅用于文档指纹，不需要密码学强度。
 */
function lightHash(str) {
  if (!str) return ''
  let hash = 0
  const normalized = String(str).replace(/\s+/g, ' ').trim()
  for (let i = 0; i < normalized.length; i++) {
    const chr = normalized.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return `h${(hash >>> 0).toString(16)}-${normalized.length}`
}

export const useLessonPptStore = defineStore('lessonPpt', () => {
  /* ───────── 配置（弹窗写入） ───────── */
  const subject = ref('math')               // 学科
  const stage = ref('junior')               // 学段
  const templateId = ref('default')         // 模板 ID
  const textbookVersion = ref('人教版')     // 教材版本
  const lessonNumber = ref(1)               // 课时编号
  const studentContext = ref('')           // 学情描述

  const includeBlackboard = ref(true)       // 包含板书设计
  const includeReflection = ref(false)      // 包含教学反思
  const includeHomework = ref(true)         // 包含作业布置

  /* ───────── 解析结果 ───────── */
  const lastOutline = ref([])               // 最近一次大纲
  const lastParseResult = ref(null)         // 最近一次解析结果（含 confidence / warnings）
  const confidence = ref(0)

  /* ───────── 生成结果 ───────── */
  const lastGeneratedSlides = ref([])       // 最近生成的 slides 数组
  const lastGeneratedAt = ref(null)
  const documentHash = ref('')              // 教案指纹（用于增量更新）

  /* ───────── 增量更新 diff ───────── */
  const lastDiff = ref(null)                // { added, modified, removed, unchanged }

  /* ───────── UI 状态 ───────── */
  const isGenerating = ref(false)
  const lastError = ref('')
  const dialogVisible = ref(false)

  /* ───────── 计算属性 ───────── */
  const currentTemplate = computed(() => getTemplate(templateId.value))

  const hasGenerated = computed(
    () => Array.isArray(lastGeneratedSlides.value) && lastGeneratedSlides.value.length > 0,
  )

  /* ───────── Actions ───────── */

  /**
   * 打开生成课件配置弹窗
   */
  function openDialog() {
    dialogVisible.value = true
  }

  function closeDialog() {
    dialogVisible.value = false
  }

  /**
   * 更新配置（由弹窗在用户点击"开始生成"前调用）
   */
  function updateConfig(patch) {
    if (!patch) return
    if (patch.subject != null) subject.value = patch.subject
    if (patch.stage != null) stage.value = patch.stage
    if (patch.templateId != null) templateId.value = patch.templateId
    if (patch.textbookVersion != null) textbookVersion.value = patch.textbookVersion
    if (patch.lessonNumber != null) lessonNumber.value = Number(patch.lessonNumber) || 1
    if (patch.studentContext != null) studentContext.value = patch.studentContext
    if (patch.includeBlackboard != null) includeBlackboard.value = Boolean(patch.includeBlackboard)
    if (patch.includeReflection != null) includeReflection.value = Boolean(patch.includeReflection)
    if (patch.includeHomework != null) includeHomework.value = Boolean(patch.includeHomework)
  }

  /**
   * 解析教案 Markdown，返回大纲（不修改生成结果）。
   * @param {string} markdown
   */
  function analyzeMarkdown(markdown) {
    const result = parseLessonPlan(markdown, {
      subject: subject.value,
      stage: stage.value,
      textbookVersion: textbookVersion.value,
    })
    lastParseResult.value = result
    lastOutline.value = result.outline
    confidence.value = result.confidence
    return result
  }

  /**
   * 记录一次完整生成（生成器调用方写入）。
   * @param {Array} slides - [{ component, props }]
   * @param {string} markdown - 用于哈希指纹
   * @param {Array} [outline] - 可选。如果提供，同时更新 lastOutline，避免后续 computeDiff
   *                            出现 "prev 全为空" 的错误语义；不提供则保持原状。
   */
  function recordGenerated(slides, markdown, outline) {
    lastGeneratedSlides.value = Array.isArray(slides) ? slides.slice() : []
    if (Array.isArray(outline)) {
      lastOutline.value = outline.slice()
    }
    lastGeneratedAt.value = Date.now()
    documentHash.value = lightHash(markdown)
    isGenerating.value = false
    lastError.value = ''
  }

  /**
   * 重置解析状态（教案内容被清空时使用，例如弹窗提示后）
   * 封装为 action，避免组件直接改写内部 ref。
   */
  function resetParseState() {
    lastParseResult.value = null
    lastOutline.value = []
    confidence.value = 0
    lastError.value = ''
  }

  /**
   * 计算增量更新 diff（不修改生成结果，等待用户确认）
   * @param {string} currentMarkdown
   * @returns {null | { added, modified, removed, unchanged, hasChange: boolean }}
   */
  function computeDiff(currentMarkdown) {
    const newHash = lightHash(currentMarkdown)
    if (newHash === documentHash.value) {
      lastDiff.value = { added: [], modified: [], removed: [], unchanged: lastOutline.value, hasChange: false }
      return lastDiff.value
    }
    // 先快照旧大纲，调用 analyzeMarkdown 会重写 lastOutline
    const prevOutline = lastOutline.value.slice()
    const newResult = analyzeMarkdown(currentMarkdown)
    const diff = diffOutline(prevOutline, newResult.outline)
    diff.hasChange = diff.added.length > 0 || diff.modified.length > 0 || diff.removed.length > 0
    lastDiff.value = diff
    return diff
  }

  /**
   * 应用 diff（用户确认后调用）：只刷新变化页面。
   * @param {Array} newSlides - 由生成器返回的新 slides
   * @param {string} currentMarkdown
   */
  function applyDiff(newSlides, currentMarkdown) {
    lastGeneratedSlides.value = Array.isArray(newSlides) ? newSlides.slice() : []
    lastOutline.value = lastParseResult.value?.outline || lastOutline.value
    documentHash.value = lightHash(currentMarkdown)
    lastGeneratedAt.value = Date.now()
    lastDiff.value = null
    lastError.value = ''
  }

  /**
   * 重置（切换教案 / 关闭弹窗时调用）
   * 完整重置配置 + 解析 + 生成 + UI 状态，避免多用户 / 多文档场景下配置残留。
   */
  function reset() {
    // 配置重置为默认值
    subject.value = 'math'
    stage.value = 'junior'
    templateId.value = 'default'
    textbookVersion.value = '人教版'
    lessonNumber.value = 1
    studentContext.value = ''
    includeBlackboard.value = true
    includeReflection.value = false
    includeHomework.value = true
    // 解析结果
    lastOutline.value = []
    lastParseResult.value = null
    confidence.value = 0
    // 生成结果
    lastGeneratedSlides.value = []
    lastGeneratedAt.value = null
    documentHash.value = ''
    // 增量 diff
    lastDiff.value = null
    // UI 状态
    isGenerating.value = false
    lastError.value = ''
    dialogVisible.value = false
  }

  /**
   * 记录错误（生成失败时调用）
   */
  function setError(msg) {
    lastError.value = String(msg || '')
    isGenerating.value = false
  }

  /**
   * 标记正在生成中
   */
  function setGenerating(busy) {
    isGenerating.value = Boolean(busy)
  }

  return {
    // 配置
    subject,
    stage,
    templateId,
    textbookVersion,
    lessonNumber,
    studentContext,
    includeBlackboard,
    includeReflection,
    includeHomework,

    // 解析 / 生成
    lastOutline,
    lastParseResult,
    confidence,
    lastGeneratedSlides,
    lastGeneratedAt,
    documentHash,
    lastDiff,

    // UI
    isGenerating,
    lastError,
    dialogVisible,

    // 计算
    currentTemplate,
    hasGenerated,

    // Actions
    openDialog,
    closeDialog,
    updateConfig,
    analyzeMarkdown,
    resetParseState,
    recordGenerated,
    computeDiff,
    applyDiff,
    reset,
    setError,
    setGenerating,
  }
})

export { lightHash, DEFAULT_TEMPLATE }

export default useLessonPptStore