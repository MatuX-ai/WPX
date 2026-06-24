<script setup>
/**
 * InteractiveDemo.vue
 * ------------------------------------------------------------
 * WPX 营销站 · 交互演示组件
 *
 *  - 中央"假编辑器"：静态界面 + 可选中文本
 *  - 选中文本后右下角浮出 AI 对话窗
 *  - 浮窗内：预设对话 + 打字机 AI 回复 + 可输入（回车触发预设回复）
 *  - 右侧文字轮播 5 条功能亮点
 * ------------------------------------------------------------
 */
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'

// ---------------- 假编辑器预设文本 ----------------
const editorText = `在二十一世纪的第三个十年里，人工智能不再是科幻小说的专利。

它已经悄悄走进了我们的课堂、办公室、书房 —— 帮我们改稿、翻译、排版、做表格。

而 WPX 想做的，是把这些能力放进一个真正「不收税」的工具里。
让每一个写作者都能自由地表达，而不是被订阅制绑住手脚。`

// ---------------- AI 浮窗消息流 ----------------
const messages = ref([
  {
    id: 0,
    role: 'user',
    text: '翻译成英文'
  }
])
const aiTypingDone = ref(false) // 首条 AI 回复是否打完字

// AI 回复文本（预设）
const aiReplyText = `Here is the translation:

In the third decade of the 21st century, AI is no longer the preserve of science fiction.
It has quietly entered our classrooms, offices, and studies — helping us revise, translate, format, and build tables.
WPX aims to put all of that into a tool that truly doesn't "tax" you.
Let every writer express freely, unbound by subscriptions.`

// 打字机进度（0 → aiReplyText.length）
const aiProgress = ref(0)
const aiDone = computed(() => aiProgress.value >= aiReplyText.length)

// 显示到对话窗的 AI 文本（截取）
const aiDisplayedText = computed(() => aiReplyText.slice(0, aiProgress.value))

// 消息列表（已显示）
const messageList = computed(() => {
  return messages.value.map((m) => {
    if (m.role === 'user') return m
    // AI 消息：仅当打字中返回实时文本
    return {
      ...m,
      text: aiDone.value ? aiReplyText : aiDisplayedText.value
    }
  })
})

let typeTimer = null
function startAiTyping() {
  // 已有 AI 消息则不重复触发
  if (messages.value.some((m) => m.role === 'ai')) return
  messages.value.push({ id: Date.now(), role: 'ai', text: '' })
  aiTypingDone.value = false
  let i = 0
  typeTimer = setInterval(() => {
    i++
    if (i >= aiReplyText.length) {
      aiProgress.value = aiReplyText.length
      clearInterval(typeTimer)
      typeTimer = null
      aiTypingDone.value = true
      return
    }
    aiProgress.value = i
  }, 18)
}

// ---------------- 浮窗显隐 ----------------
const demoRef = ref(null)
const editorRef = ref(null)
const popupVisible = ref(false)
const selectedText = ref('')

function onSelectionChange() {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) {
    selectedText.value = ''
    popupVisible.value = false
    return
  }
  const text = sel.toString().trim()
  if (!text) {
    selectedText.value = ''
    popupVisible.value = false
    return
  }
  // 选区必须落在编辑器内
  const editorEl = editorRef.value
  if (!editorEl) return
  const range = sel.getRangeAt(0)
  if (!editorEl.contains(range.commonAncestorContainer)) {
    return
  }
  selectedText.value = text
  popupVisible.value = true

  // 如果是新一次选择（且不是已经触发过 AI 的"翻译成英文"），就触发 AI 回复
  // 这里简化为：每次选区变化且浮窗刚显示，就重置并播放打字机
  // 但为了不打扰用户，我们只在浮窗从隐藏变为显示时触发
  if (!aiTypingDone.value && !typeTimer && messages.value.length === 1) {
    startAiTyping()
  }
}

// 点击编辑器外区域关闭浮窗
function onDocumentMouseDown(e) {
  if (!popupVisible.value) return
  const popup = document.getElementById('wpx-demo-popup')
  const editor = editorRef.value
  if (popup && popup.contains(e.target)) return
  if (editor && editor.contains(e.target)) {
    // 编辑器内点击不立即关闭，等 selectionchange
    return
  }
  popupVisible.value = false
  window.getSelection()?.removeAllRanges()
}

// ---------------- 用户输入回车 ----------------
const inputValue = ref('')
const chatListRef = ref(null)

const presetReplies = [
  '好的，已为你处理。',
  '正在调用本地 AI 引擎，请稍候…',
  '已生成大纲，可点击"插入文档"应用。',
  '已润色完成，保留了原文的语气。',
  '为你找到 3 条相关引用：\n1. Smith et al., 2024\n2. 李华 等，2025\n3. WPX Docs, ch.2'
]

function pickPresetReply(text) {
  if (text.includes('翻译')) return 'Here is the translation: "..."'
  if (text.includes('总结') || text.includes('摘要')) return '摘要：该段主要讨论 AI 与写作的关系。'
  if (text.includes('改') || text.includes('润色')) return '已润色：更简洁、保留原意。'
  return presetReplies[Math.floor(Math.random() * presetReplies.length)]
}

function onInputEnter() {
  const text = inputValue.value.trim()
  if (!text) return
  // 推入用户消息
  messages.value.push({ id: Date.now(), role: 'user', text })
  inputValue.value = ''
  // 滚动到底部
  nextTick(() => {
    if (chatListRef.value) {
      chatListRef.value.scrollTop = chatListRef.value.scrollHeight
    }
  })
  // 模拟 AI 回复
  setTimeout(() => {
    const reply = pickPresetReply(text)
    messages.value.push({ id: Date.now() + 1, role: 'ai', text: reply, static: true })
    nextTick(() => {
      if (chatListRef.value) {
        chatListRef.value.scrollTop = chatListRef.value.scrollHeight
      }
    })
  }, 500)
}

// ---------------- 右侧文字轮播 ----------------
const highlights = [
  { icon: '🧠', text: 'AI 头像随时待命' },
  { icon: '🪄', text: '图片轻处理：去背景、打码一句话搞定' },
  { icon: '✨', text: '智能模板：越用越懂你' },
  { icon: '🎓', text: '16+ 教师技能、16+ 学生技能' },
  { icon: '🔤', text: '开源字体随便用' }
]
const hlIdx = ref(0)
let hlTimer = null
function startHighlights() {
  hlTimer = setInterval(() => {
    hlIdx.value = (hlIdx.value + 1) % highlights.length
  }, 2800)
}

// ---------------- 生命周期 ----------------
onMounted(() => {
  document.addEventListener('selectionchange', onSelectionChange)
  document.addEventListener('mousedown', onDocumentMouseDown)
  startHighlights()
})

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', onSelectionChange)
  document.removeEventListener('mousedown', onDocumentMouseDown)
  if (typeTimer) clearInterval(typeTimer)
  if (hlTimer) clearInterval(hlTimer)
})
</script>

<template>
  <section class="wpx-section bg-wpx-gradient-soft">
    <div class="wpx-container">
      <!-- 标题 -->
      <div class="mx-auto max-w-3xl text-center">
        <span class="wpx-chip">现场体验</span>
        <h2 class="mt-4 text-[1.6rem] font-extrabold leading-tight sm:text-3xl md:text-5xl">
          <span class="wpx-gradient-text">选中文字，AI 就在手边。</span>
        </h2>
        <p class="mt-4 text-dark/60">
          在下面的文档里选中一段文字 —— 试试看会发生什么。
        </p>
      </div>

      <!-- ============== 主体：左编辑器 + 右功能轮播 ============== -->
      <div
        ref="demoRef"
        class="mt-14 grid gap-6 md:grid-cols-3"
      >
        <!-- ========== 假编辑器（占 2 列） ========== -->
        <div
          ref="editorRef"
          class="editor-mock relative md:col-span-2 rounded-3xl border border-dark/5 bg-white shadow-wpx-glow"
        >
          <!-- 窗口栏 -->
          <div class="flex items-center gap-2 border-b border-dark/5 px-4 py-3">
            <span class="h-3 w-3 rounded-full bg-red-400/80" />
            <span class="h-3 w-3 rounded-full bg-amber-300/90" />
            <span class="h-3 w-3 rounded-full bg-emerald-300/90" />
            <span class="ml-2 text-xs text-dark/40">毕业论文 · 第一章 · 引言</span>
            <span class="ml-auto text-[10px] text-dark/30">WPX 1.0 · 自动保存</span>
          </div>

          <!-- 工具栏 -->
          <div class="flex flex-wrap items-center gap-1 border-b border-dark/5 px-4 py-2 text-xs text-dark/60">
            <span class="rounded px-2 py-1 hover:bg-dark/5">B</span>
            <span class="rounded px-2 py-1 italic hover:bg-dark/5">I</span>
            <span class="rounded px-2 py-1 line-through hover:bg-dark/5">S</span>
            <span class="mx-1 h-4 w-px bg-dark/10" />
            <span class="rounded px-2 py-1 hover:bg-dark/5">H1</span>
            <span class="rounded px-2 py-1 hover:bg-dark/5">H2</span>
            <span class="rounded px-2 py-1 hover:bg-dark/5">引用</span>
            <span class="rounded px-2 py-1 hover:bg-dark/5">图片</span>
            <span class="rounded px-2 py-1 hover:bg-dark/5">表格</span>
            <span class="ml-auto rounded bg-wpx-gradient-soft px-2 py-1 font-semibold text-primary-600">
              ✨ AI 助手
            </span>
          </div>

          <!-- 文本内容（可选中） -->
          <div
            class="prose-wpx select-text space-y-4 p-8 leading-relaxed text-dark/85 md:p-12"
            data-test="editor-body"
          >
            <div class="text-2xl font-extrabold text-dark">
              <span class="wpx-gradient-text">人工智能与写作的未来</span>
            </div>
            <p
              v-for="(para, i) in editorText.split('\n\n')"
              :key="i"
            >
              {{ para }}
            </p>
            <div class="mt-2 flex items-center gap-2 text-xs text-dark/40">
              <span>·</span>
              <span>{{ editorText.length }} 字</span>
              <span>·</span>
              <span>约 {{ Math.ceil(editorText.length / 300) }} 分钟阅读</span>
            </div>
          </div>

          <!-- 选中提示（在没有选区时引导） -->
          <div
            v-if="!popupVisible"
            class="pointer-events-none absolute bottom-4 right-4 z-10 rounded-full bg-dark/80 px-3 py-1.5 text-xs text-white shadow-sm"
          >
            👆 用鼠标选中上面任意一段文字
          </div>
        </div>

        <!-- ========== 右侧：功能轮播 ========== -->
        <div
          class="relative overflow-hidden rounded-3xl border border-primary-500/20 bg-white p-6 shadow-wpx md:p-8"
        >
          <div class="text-xs font-semibold uppercase tracking-wider text-primary-600">
            核心亮点
          </div>
          <div class="relative mt-4 h-32">
            <transition
              name="hl"
              mode="out-in"
            >
              <div
                :key="hlIdx"
                class="absolute inset-0 flex flex-col gap-3"
              >
                <div class="text-5xl">
                  {{ highlights[hlIdx].icon }}
                </div>
                <div class="text-xl font-extrabold leading-tight text-dark md:text-2xl">
                  {{ highlights[hlIdx].text }}
                </div>
              </div>
            </transition>
          </div>

          <!-- 指示器 -->
          <div class="mt-6 flex gap-1.5">
            <span
              v-for="(_, i) in highlights"
              :key="i"
              :class="[
                'h-1.5 rounded-full transition-all duration-300',
                i === hlIdx
                  ? 'w-6 bg-wpx-gradient'
                  : 'w-1.5 bg-primary-500/20'
              ]"
            />
          </div>

          <!-- 底部 CTA -->
          <div class="mt-8 rounded-2xl bg-wpx-gradient-soft p-4">
            <div class="text-sm font-semibold text-primary-600">
              不止于此
            </div>
            <div class="mt-1 text-xs leading-relaxed text-dark/60">
              多窗口、Skills 体系、虚拟纸张、文件压缩…等你来玩。
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============== AI 对话浮窗（fixed 浮层） ============== -->
    <transition name="popup">
      <div
        v-if="popupVisible"
        id="wpx-demo-popup"
        class="fixed bottom-6 right-6 z-50 flex w-[360px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-primary-500/20 bg-white shadow-wpx-glow"
        role="dialog"
        aria-label="AI 助手对话框"
      >
        <!-- 标题栏 -->
        <div class="flex items-center gap-2 bg-wpx-gradient px-4 py-3 text-white">
          <div class="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-sm">
            ✨
          </div>
          <div class="flex-1">
            <div class="text-sm font-semibold">
              WPX AI
            </div>
            <div class="text-[10px] text-white/70">
              选中了 {{ selectedText.length }} 个字符
            </div>
          </div>
          <button
            class="flex h-6 w-6 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="关闭"
            @click="popupVisible = false; window.getSelection()?.removeAllRanges()"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <!-- 消息列表 -->
        <div
          ref="chatListRef"
          class="max-h-72 min-h-40 flex-1 space-y-3 overflow-y-auto bg-wpx-gradient-soft/40 p-4"
        >
          <div
            v-for="m in messageList"
            :key="m.id"
            :class="[
              'flex',
              m.role === 'user' ? 'justify-end' : 'justify-start'
            ]"
          >
            <div
              :class="[
                'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'rounded-tr-sm bg-wpx-gradient text-white'
                  : 'rounded-tl-sm border border-primary-500/20 bg-white text-dark shadow-sm'
              ]"
            >
              <div
                v-if="m.role === 'ai' && !m.static"
                style="white-space: pre-wrap"
                v-text="m.text"
              />
              <div
                v-else-if="m.role === 'ai' && m.static"
                style="white-space: pre-wrap"
              >
                {{ m.text }}
              </div>
              <div
                v-else
                style="white-space: pre-wrap"
              >
                {{ m.text }}
              </div>
              <!-- 打字中光标 -->
              <span
                v-if="m.role === 'ai' && !aiDone"
                class="ml-0.5 inline-block h-3 w-1.5 -translate-y-0.5 bg-primary-500 align-middle animate-caret"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        <!-- 输入框 -->
        <div class="flex items-center gap-2 border-t border-dark/5 bg-white px-3 py-2">
          <input
            v-model="inputValue"
            type="text"
            placeholder="试试：润色这段 / 翻译成英文…"
            class="flex-1 rounded-md bg-dark/5 px-3 py-2 text-sm text-dark outline-none placeholder:text-dark/40 focus:bg-white focus:ring-2 focus:ring-primary-500/30"
            @keydown.enter="onInputEnter"
          />
          <button
            class="flex h-8 w-8 items-center justify-center rounded-md bg-wpx-gradient text-white shadow-wpx transition-transform hover:scale-105 disabled:opacity-40"
            :disabled="!inputValue.trim()"
            aria-label="发送"
            @click="onInputEnter"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M5 12h14M13 6l6 6-6 6"
              />
            </svg>
          </button>
        </div>

        <!-- 底部提示 -->
        <div class="bg-white px-4 py-1.5 text-center text-[10px] text-dark/40">
          这是演示版，不会真实调用 AI
        </div>
      </div>
    </transition>
  </section>
</template>

<style scoped>
/* ============== 浮窗进出动画 ============== */
.popup-enter-active,
.popup-leave-active {
  transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.popup-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}
.popup-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

/* ============== 文字轮播 ============== */
.hl-enter-active,
.hl-leave-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.hl-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.hl-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

/* ============== 光标闪烁 ============== */
@keyframes wpxCaretBlink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
.animate-caret {
  animation: wpxCaretBlink 0.8s steps(1) infinite;
}

/* ============== 排版 ============== */
.prose-wpx p {
  margin: 0;
}
.prose-wpx ::selection {
  background: rgba(124, 58, 237, 0.25);
  color: inherit;
}

/* ============== 减少动效 ============== */
@media (prefers-reduced-motion: reduce) {
  .animate-caret {
    animation: none;
    opacity: 1;
  }
}
</style>
