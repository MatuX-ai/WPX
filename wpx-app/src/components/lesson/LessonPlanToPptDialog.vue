<script setup>
/**
 * <LessonPlanToPptDialog> - 教案生成课件配置弹窗
 *
 * 提供配置项：学科 / 学段 / 教材版本 / 课时 / 模板 / 板块开关
 * - 学科+学段变更时自动推荐模板
 * - 切换弹窗可见时自动调用 lessonPpt.analyzeMarkdown() 解析当前教案
 * - 触发 confirm 时：
 *    1. updateConfig() 写入 store
 *    2. emit('confirm', { config, parseResult })
 *    3. 父组件负责实际驱动 usePPTWorkflow.startWorkflow() 或本地指令
 */
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLessonPptStore } from '@/stores/lessonPpt'
import {
  SUBJECT_LABELS,
  STAGE_LABELS,
  TEXTBOOK_VERSIONS,
  listTemplates,
  getTemplate,
  getTemplateBySubject,
  DEFAULT_TEMPLATE,
} from '@/data/lesson-templates'

const props = defineProps({
  visible: { type: Boolean, default: false },
  /** 当前教案 Markdown（由父组件传入，弹窗不直接接触编辑器） */
  markdown: { type: String, default: '' },
})

const emit = defineEmits(['confirm', 'cancel', 'update:visible'])

const store = useLessonPptStore()
const {
  subject,
  stage,
  templateId,
  textbookVersion,
  lessonNumber,
  studentContext,
  includeBlackboard,
  includeReflection,
  includeHomework,
  confidence,
  lastParseResult,
  isGenerating,
  lastError,
} = storeToRefs(store)

/* ───────── 派生数据 ───────── */
const subjectOptions = Object.keys(SUBJECT_LABELS).filter((k) => k !== 'any')
const stageOptions = ['primary', 'junior', 'senior']
const allTemplates = listTemplates()

/** 当前可选模板（按学科+学段推荐） */
const recommendedTemplates = computed(() => {
  const hit = getTemplateBySubject(subject.value, stage.value)
  return [hit, ...allTemplates.filter((t) => t.id !== hit.id && t.id !== 'custom')]
})

/** 学段+学科自动选推荐模板，但只在用户没显式选过 custom 时 */
function syncRecommendedTemplate() {
  const hit = getTemplateBySubject(subject.value, stage.value)
  if (templateId.value === 'custom' || templateId.value === 'default') {
    // 用户没显式选过，绑定推荐
    templateId.value = hit.id
  } else {
    // 用户已选过时仍可保留，但若选中的模板学科/学段不匹配，提示一下
    const current = getTemplate(templateId.value)
    if (
      current.subject !== 'any' &&
      current.subject !== subject.value &&
      current.stage !== 'custom' &&
      current.stage !== stage.value
    ) {
      // 不强制切换，只在 UI 提示
    }
  }
}

const currentTemplate = computed(() => getTemplate(templateId.value))

/* ───────── 解析联动 ───────── */
function runAnalysis() {
  if (!props.markdown || !props.markdown.trim()) {
    // 通过 action 重置，避免直接改 store 内部 ref
    store.resetParseState()
    return
  }
  store.analyzeMarkdown(props.markdown)
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      // 弹窗打开时立即解析
      runAnalysis()
    }
  },
  { immediate: false },
)

watch(
  () => props.markdown,
  () => {
    if (props.visible) runAnalysis()
  },
)

watch([subject, stage], () => {
  syncRecommendedTemplate()
})

onMounted(() => {
  syncRecommendedTemplate()
})

/* ───────── 行为 ───────── */
function close() {
  emit('update:visible', false)
  emit('cancel')
}

function onConfirm() {
  // 先把配置写入 store
  store.updateConfig({
    subject: subject.value,
    stage: stage.value,
    templateId: templateId.value,
    textbookVersion: textbookVersion.value,
    lessonNumber: lessonNumber.value,
    studentContext: studentContext.value,
    includeBlackboard: includeBlackboard.value,
    includeReflection: includeReflection.value,
    includeHomework: includeHomework.value,
  })
  emit('confirm', {
    config: {
      subject: subject.value,
      stage: stage.value,
      templateId: templateId.value,
      textbookVersion: textbookVersion.value,
      lessonNumber: lessonNumber.value,
      studentContext: studentContext.value,
      includeBlackboard: includeBlackboard.value,
      includeReflection: includeReflection.value,
      includeHomework: includeHomework.value,
    },
    parseResult: lastParseResult.value,
  })
  // 不自动关闭，由父组件在生成完成后决定
}

const confidencePct = computed(() => Math.round((confidence.value || 0) * 100))
const confidenceLevel = computed(() => {
  const c = confidence.value || 0
  if (c >= 0.7) return { label: '识别良好', cls: 'good' }
  if (c >= 0.4) return { label: '部分识别', cls: 'mid' }
  return { label: '识别较弱', cls: 'low' }
})
</script>

<template>
  <Transition name="wpx-lpd-fade">
    <div
      v-if="visible"
      class="fixed inset-0 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
      style="z-index: var(--z-modal, 1100)"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lpd-title"
      @click.self="close"
    >
      <div
        class="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <!-- Header -->
        <header
          class="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4 dark:border-slate-800"
        >
          <div>
            <h2
              id="lpd-title"
              class="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              <span class="text-xl" aria-hidden="true">📚</span>
              教案生成课件
            </h2>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              配置学科、模板与板块，让 AI 把当前教案自动生成一节课的 PPT 课件。
            </p>
          </div>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label="关闭"
            @click="close"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 6l12 12M6 18L18 6" stroke-linecap="round" />
            </svg>
          </button>
        </header>

        <!-- Body -->
        <div class="max-h-[calc(90vh-160px)] overflow-y-auto px-6 py-5">
          <!-- 解析状态卡片 -->
          <section
            class="mb-5 rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40"
            aria-label="教案识别结果"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span class="text-base" aria-hidden="true">🔍</span>
                教案识别
                <span
                  v-if="lastParseResult"
                  class="rounded-full px-2 py-0.5 text-xs font-semibold"
                  :class="{
                    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300':
                      confidenceLevel.cls === 'good',
                    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300':
                      confidenceLevel.cls === 'mid',
                    'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300':
                      confidenceLevel.cls === 'low',
                  }"
                >
                  {{ confidenceLevel.label }} {{ confidencePct }}%
                </span>
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400">
                <template v-if="lastParseResult">
                  已识别 {{ lastParseResult.outline.length }} 个章节
                </template>
                <template v-else> 暂无可解析的教案内容 </template>
              </div>
            </div>
            <div v-if="lastParseResult && lastParseResult.warnings?.length" class="mt-2">
              <ul class="space-y-1 text-xs text-amber-700 dark:text-amber-300">
                <li v-for="(w, i) in lastParseResult.warnings" :key="i" class="flex items-start gap-1.5">
                  <span aria-hidden="true">⚠️</span>
                  <span>{{ w }}</span>
                </li>
              </ul>
            </div>
            <div v-if="lastError" class="mt-2 text-xs text-rose-600 dark:text-rose-400">
              解析失败：{{ lastError }}
            </div>
          </section>

          <!-- 学科 / 学段 -->
          <section class="mb-5">
            <h3 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">基本信息</h3>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label class="block text-sm text-slate-700 dark:text-slate-300">
                学科
                <select
                  v-model="subject"
                  class="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-brand-400 dark:focus:ring-brand-900/40"
                >
                  <option v-for="k in subjectOptions" :key="k" :value="k">
                    {{ SUBJECT_LABELS[k] }}
                  </option>
                </select>
              </label>
              <label class="block text-sm text-slate-700 dark:text-slate-300">
                学段
                <select
                  v-model="stage"
                  class="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-brand-400 dark:focus:ring-brand-900/40"
                >
                  <option v-for="k in stageOptions" :key="k" :value="k">
                    {{ STAGE_LABELS[k] }}
                  </option>
                </select>
              </label>
              <label class="block text-sm text-slate-700 dark:text-slate-300">
                教材版本
                <select
                  v-model="textbookVersion"
                  class="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-brand-400 dark:focus:ring-brand-900/40"
                >
                  <option v-for="v in TEXTBOOK_VERSIONS" :key="v" :value="v">{{ v }}</option>
                </select>
              </label>
              <label class="block text-sm text-slate-700 dark:text-slate-300">
                课时编号
                <input
                  v-model.number="lessonNumber"
                  type="number"
                  min="1"
                  max="200"
                  class="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-brand-400 dark:focus:ring-brand-900/40"
                />
              </label>
            </div>
            <label class="mt-3 block text-sm text-slate-700 dark:text-slate-300">
              学情补充（可选）
              <textarea
                v-model="studentContext"
                rows="2"
                placeholder="例：八年级学生，已掌握一元一次方程，基础较好，可适度拔高。"
                class="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-brand-400 dark:focus:ring-brand-900/40"
              />
            </label>
          </section>

          <!-- 模板 -->
          <section class="mb-5">
            <h3 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">课件模板</h3>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <button
                v-for="t in recommendedTemplates"
                :key="t.id"
                type="button"
                class="group relative flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition"
                :class="
                  templateId === t.id
                    ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/20'
                    : 'border-slate-200 hover:border-brand-300 dark:border-slate-700 dark:hover:border-brand-500'
                "
                @click="templateId = t.id"
              >
                <div
                  class="h-10 w-full rounded-md border border-slate-200 dark:border-slate-700"
                  :style="{
                    background: `linear-gradient(135deg, ${t.theme.primary} 0%, ${t.theme.secondary} 100%)`,
                  }"
                  aria-hidden="true"
                />
                <div class="min-w-0">
                  <div class="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {{ t.name }}
                  </div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">
                    {{ SUBJECT_LABELS[t.subject] || '通用' }} ·
                    {{ STAGE_LABELS[t.stage] || '通用' }}
                  </div>
                </div>
                <span
                  v-if="templateId === t.id"
                  class="absolute right-2 top-2 rounded-full bg-brand-500 p-0.5 text-white"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3">
                    <path d="M5 12l5 5L20 7" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </span>
              </button>
            </div>
            <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
              当前模板：<span class="font-medium">{{ currentTemplate.name }}</span>
            </p>
          </section>

          <!-- 板块开关 -->
          <section class="mb-2">
            <h3 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">生成板块</h3>
            <div class="space-y-2">
              <label
                class="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 transition hover:border-brand-300 dark:border-slate-700 dark:hover:border-brand-500"
              >
                <input v-model="includeBlackboard" type="checkbox" class="mt-0.5 h-4 w-4 rounded" />
                <div>
                  <div class="text-sm font-medium text-slate-800 dark:text-slate-200">板书设计</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">
                    按"导入→讲授→例题→小结"流程在深绿板书页展示关键步骤
                  </div>
                </div>
              </label>
              <label
                class="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 transition hover:border-brand-300 dark:border-slate-700 dark:hover:border-brand-500"
              >
                <input v-model="includeHomework" type="checkbox" class="mt-0.5 h-4 w-4 rounded" />
                <div>
                  <div class="text-sm font-medium text-slate-800 dark:text-slate-200">作业布置</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">
                    必做 / 选做 / 实践分组，附完成时间预估
                  </div>
                </div>
              </label>
              <label
                class="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 transition hover:border-brand-300 dark:border-slate-700 dark:hover:border-brand-500"
              >
                <input v-model="includeReflection" type="checkbox" class="mt-0.5 h-4 w-4 rounded" />
                <div>
                  <div class="text-sm font-medium text-slate-800 dark:text-slate-200">教学反思</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">
                    按"亮点 / 待改进 / 改进措施"分栏
                  </div>
                </div>
              </label>
            </div>
          </section>
        </div>

        <!-- Footer -->
        <footer
          class="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3 dark:border-slate-800 dark:bg-slate-800/40"
        >
          <div class="text-xs text-slate-500 dark:text-slate-400">
            <template v-if="lastParseResult?.matchedTemplate">
              已识别模板：<span class="font-medium">{{ lastParseResult.matchedTemplate }}</span>
            </template>
            <template v-else> 提示：识别度低时将自动采用默认结构。 </template>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
              @click="close"
            >
              取消
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isGenerating"
              @click="onConfirm"
            >
              <svg
                v-if="isGenerating"
                class="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-dasharray="42 18"
                />
              </svg>
              <span>{{ isGenerating ? '生成中...' : '开始生成课件' }}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.wpx-lpd-fade-enter-active,
.wpx-lpd-fade-leave-active {
  transition: opacity 0.18s ease;
}
.wpx-lpd-fade-enter-from,
.wpx-lpd-fade-leave-to {
  opacity: 0;
}
</style>
