<script setup>
/**
 * NotFound.vue
 * ------------------------------------------------------------
 * WPX 营销站 · 趣味 404 页面
 *
 *  - 大标题 + 副标题（指引 + 共情）
 *  - 模拟 AI 对话窗（输入 → 预设回复）
 *  - 两个主行动按钮
 *  - Canvas 粒子背景（轻微动画）
 * ------------------------------------------------------------
 */
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// ---------------- 粒子背景 ----------------
const canvasRef = ref(null)
let ctx = null
let rafId = 0
let particles = []
let dpr = 1

function initParticles() {
  const c = canvasRef.value
  if (!c) return
  ctx = c.getContext('2d')
  dpr = window.devicePixelRatio || 1
  resize()
  // 30 个粒子
  const count = 30
  particles = []
  for (let i = 0; i < count; i++) {
    particles.push(makeParticle())
  }
  loop()
}

function makeParticle() {
  const w = canvasRef.value.clientWidth
  const h = canvasRef.value.clientHeight
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    r: 1 + Math.random() * 2.5,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
    a: 0.15 + Math.random() * 0.35
  }
}

function resize() {
  const c = canvasRef.value
  if (!c || !ctx) return
  const w = c.clientWidth
  const h = c.clientHeight
  c.width = w * dpr
  c.height = h * dpr
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
}

function loop() {
  const c = canvasRef.value
  if (!c || !ctx) return
  const w = c.clientWidth
  const h = c.clientHeight
  ctx.clearRect(0, 0, w, h)

  for (const p of particles) {
    p.x += p.vx
    p.y += p.vy
    if (p.x < 0) p.x = w
    if (p.x > w) p.x = 0
    if (p.y < 0) p.y = h
    if (p.y > h) p.y = 0

    // 径向渐变粒子
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3)
    grad.addColorStop(0, `rgba(124, 58, 237, ${p.a})`)
    grad.addColorStop(0.5, `rgba(37, 99, 235, ${p.a * 0.4})`)
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2)
    ctx.fill()
  }

  // 临近粒子连线
  ctx.lineWidth = 1
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const a = particles[i]
      const b = particles[j]
      const dx = a.x - b.x
      const dy = a.y - b.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 130) {
        const alpha = (1 - dist / 130) * 0.18
        ctx.strokeStyle = `rgba(124, 58, 237, ${alpha})`
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
    }
  }

  rafId = requestAnimationFrame(loop)
}

function handleResize() {
  resize()
}

onMounted(async () => {
  await nextTick()
  initParticles()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', handleResize)
})

// ---------------- AI 对话窗 ----------------
const inputText = ref('')
const chatList = ref([
  {
    role: 'system',
    text: '我是 WPX 寻路 AI · 输入你想找的内容，我帮你猜'
  }
])
const aiTyping = ref(false)
const aiProgress = ref(0)

const presets = [
  '我猜你想找的是【功能】或【下载】？点击下方按钮试试。',
  '哦？听起来像是想看看【功能】或者直接【下载】？',
  '这关键词我没见过……要不先去【功能】页逛逛？或者直接【下载】？',
  '嗯~ 我建议先看【功能】，再点【下载】。',
  '我帮你搜过了，最相关的就是【功能】和【下载】。',
  '404 不可怕，可怕的是没装 WPX。点【下载】治好选择困难症。'
]

const replyQueue = ref([]) // 打字机队列
let typingTimer = null

function guessReply(text) {
  if (!text) return presets[0]
  // 关键词联想
  const t = text.toLowerCase()
  if (/功能|feature|介绍|可以|做什么/.test(t)) return '我猜你想看的是【功能】页面 → 那里有 WPX 的全部能力介绍。'
  if (/下载|download|安装|exe|dmg|appimage/.test(t)) return '直奔【下载】页，15MB 一键装好。'
  if (/价格|付费|多少钱|token/.test(t)) return 'WPX 工具免费，AI 算力按 Token 计费（6 块起）。详见首页【为什么免费】段落。'
  if (/文档|教程|怎么用|帮助/.test(t)) return '官方文档持续更新中，先看【功能】页和首页交互演示。'
  if (/博客|blog|文章|更新/.test(t)) return '博客页（/blog）有团队周记和功能解读。'
  if (/关于|团队|公司|联系/.test(t)) return '团队介绍在【关于】路由 → /about。'
  // 未命中 → 随机预设
  return presets[Math.floor(Math.random() * presets.length)]
}

async function sendChat() {
  const text = inputText.value.trim()
  if (!text || aiTyping.value) return
  chatList.value.push({ role: 'user', text })
  inputText.value = ''

  // 模拟思考延时
  aiTyping.value = true
  await new Promise((r) => setTimeout(r, 500 + Math.random() * 400))
  const reply = guessReply(text)
  chatList.value.push({ role: 'ai', text: '', done: false })

  // 打字机
  let i = 0
  typingTimer = setInterval(() => {
    i++
    const last = chatList.value[chatList.value.length - 1]
    last.text = reply.slice(0, i)
    if (i >= reply.length) {
      clearInterval(typingTimer)
      last.done = true
      aiTyping.value = false
    }
  }, 22)
}

function onEnter() {
  sendChat()
}

function quickFill(text) {
  inputText.value = text
  sendChat()
}

// ---------------- 按钮 ----------------
function goHome() {
  router.push('/')
}
function goDownload() {
  router.push('/#download')
}
</script>

<template>
  <section class="relative flex min-h-[88vh] items-center justify-center overflow-hidden pt-24 pb-16">
    <!-- 粒子背景 -->
    <canvas
      ref="canvasRef"
      class="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />

    <!-- 装饰光斑 -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-primary-from/15 blur-3xl"
    />
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-primary-to/15 blur-3xl"
    />

    <!-- 主体 -->
    <div class="relative z-10 mx-auto grid w-full max-w-5xl gap-10 px-6 md:grid-cols-2 md:items-center">
      <!-- ============ 左：标题 + 按钮 ============ -->
      <div class="text-center md:text-left">
        <span class="inline-flex items-center gap-2 rounded-full border border-primary-500/20 bg-wpx-gradient-soft px-4 py-1.5 text-xs font-medium text-primary-600">
          <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
          ERROR 404 · NOT FOUND
        </span>

        <h1 class="mt-5 text-[1.85rem] font-extrabold leading-tight sm:text-4xl md:text-6xl">
          <span class="wpx-gradient-text">你好像走丢了</span>
          <span class="ml-1 inline-block origin-bottom animate-bounce">🧭</span>
        </h1>
        <p class="mt-5 text-lg leading-relaxed text-dark/70 md:text-xl">
          但别担心，WPX 的 AI
          <span class="inline-flex items-center gap-1 rounded-full bg-primary-500/10 px-2 py-0.5 text-sm font-semibold text-primary-600">
            ✨
            能帮你找回来
          </span>。
        </p>

        <!-- 两个按钮 -->
        <div class="mt-8 flex w-full flex-col items-stretch gap-3 sm:flex-row md:items-start">
          <button
            type="button"
            class="wpx-btn-primary w-full justify-center sm:w-auto sm:justify-start"
            @click="goHome"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            回到首页
          </button>
          <button
            type="button"
            class="wpx-btn-cta-pulse w-full justify-center sm:w-auto sm:justify-start"
            @click="goDownload"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            去下载
            <span class="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">15MB</span>
          </button>
        </div>

        <!-- 装饰数字 404 -->
        <div
          aria-hidden="true"
          class="mt-10 select-none truncate text-[6rem] font-black leading-none text-dark/[0.04] sm:text-[8rem] md:text-[12rem]"
        >
          404
        </div>
      </div>

      <!-- ============ 右：AI 对话窗 ============ -->
      <div class="relative">
        <!-- AI 对话卡片 -->
        <div
          class="overflow-hidden rounded-3xl border border-primary-500/20 bg-white shadow-wpx-glow"
        >
          <!-- 标题栏 -->
          <div
            class="flex items-center gap-3 border-b border-dark/5 bg-wpx-gradient-soft/60 px-5 py-4"
          >
            <div
              class="flex h-10 w-10 items-center justify-center rounded-xl bg-wpx-gradient text-white shadow-wpx"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2.2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div class="flex-1">
              <div class="text-sm font-bold text-dark">
                WPX 寻路 AI
              </div>
              <div class="flex items-center gap-1.5 text-[10px] text-dark/50">
                <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-mint" />
                在线 · 假装很懂
              </div>
            </div>
            <span class="rounded-full bg-primary-500/10 px-2 py-0.5 text-[10px] font-semibold text-primary-600">
              DEMO
            </span>
          </div>

          <!-- 消息列表 -->
          <div
            class="max-h-72 min-h-[160px] space-y-3 overflow-y-auto bg-light/30 px-5 py-4"
          >
            <div
              v-for="(msg, idx) in chatList"
              :key="idx"
              :class="[
                'flex',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              ]"
            >
              <!-- 系统消息 -->
              <div
                v-if="msg.role === 'system'"
                class="mx-auto rounded-full bg-dark/5 px-3 py-1 text-[11px] text-dark/50"
              >
                {{ msg.text }}
              </div>

              <!-- AI 消息 -->
              <div
                v-else-if="msg.role === 'ai'"
                class="flex max-w-[88%] items-start gap-2"
              >
                <div
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wpx-gradient text-xs text-white shadow-wpx"
                >
                  AI
                </div>
                <div
                  class="rounded-2xl rounded-tl-sm border border-primary-500/20 bg-white px-3.5 py-2 text-sm leading-relaxed text-dark/85"
                >
                  {{ msg.text }}<span
                    v-if="!msg.done"
                    class="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-primary-500 align-middle"
                  />
                </div>
              </div>

              <!-- 用户消息 -->
              <div
                v-else
                class="max-w-[88%] rounded-2xl rounded-tr-sm bg-wpx-gradient px-3.5 py-2 text-sm leading-relaxed text-white shadow-wpx"
              >
                {{ msg.text }}
              </div>
            </div>

            <!-- 输入提示 -->
            <div v-if="chatList.length <= 1" class="pt-2">
              <div class="text-[10px] text-dark/40">
                试试：
              </div>
              <div class="mt-2 flex flex-wrap gap-1.5">
                <button
                  v-for="kw in ['我想看功能', '怎么下载？', 'WPX 多少钱']"
                  :key="kw"
                  type="button"
                  class="rounded-full bg-wpx-gradient-soft px-2.5 py-1 text-[11px] font-medium text-primary-600 transition-colors hover:bg-primary-500/15"
                  @click="quickFill(kw)"
                >
                  {{ kw }}
                </button>
              </div>
            </div>
          </div>

          <!-- 输入区 -->
          <div
            class="flex items-center gap-2 border-t border-dark/5 bg-white px-4 py-3"
          >
            <input
              v-model="inputText"
              type="text"
              placeholder="试试：我想看功能 / 怎么下载…"
              class="flex-1 rounded-xl border border-dark/10 bg-light/50 px-3 py-2.5 text-sm text-dark outline-none transition-all focus:border-primary-500/50 focus:bg-white focus:ring-2 focus:ring-primary-500/20"
              :disabled="aiTyping"
              @keydown.enter="onEnter"
            />
            <button
              type="button"
              class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wpx-gradient text-white shadow-wpx transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
              :disabled="!inputText.trim() || aiTyping"
              @click="sendChat"
              aria-label="发送"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2.4"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- 卡片装饰光 -->
        <div
          aria-hidden="true"
          class="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-accent-yellow/30 blur-2xl"
        />
      </div>
    </div>
  </section>
</template>