<script setup>
import { ref } from 'vue'

const values = [
  {
    title: '本地优先',
    desc: '默认把数据留在你的电脑；只有在你主动调用云端 AI 时，相关片段才离开。'
  },
  {
    title: '为写作者设计',
    desc: '界面克制、快捷键顺手、性能稳定 —— 不打扰你的思考。'
  },
  {
    title: '开放可扩展',
    desc: '通过 Skills 体系，你可以把 WPX 改造成最适合自己的工作台。'
  }
]

const form = ref({ title: '', content: '', contact: '' })
const submitting = ref(false)
const submitted = ref(false)
const error = ref('')

async function submitBug() {
  if (!form.value.content.trim()) {
    error.value = '请描述你遇到的问题'
    return
  }
  error.value = ''
  submitting.value = true
  try {
    const res = await fetch('/api/feedback/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'bug',
        title: form.value.title,
        content: form.value.content,
        contact: form.value.contact,
      }),
    })
    if (!res.ok) throw new Error('提交失败')
    submitted.value = true
    form.value = { title: '', content: '', contact: '' }
  } catch (e) {
    error.value = '提交失败，请稍后重试或通过邮件反馈'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="wpx-section pt-32">
    <div class="wpx-container">
      <div class="mx-auto max-w-3xl text-center">
        <span class="wpx-chip">关于我们</span>
        <h1 class="mt-4 text-2xl font-extrabold sm:text-3xl md:text-4xl lg:text-5xl">
          <span class="wpx-gradient-text">我们想做一个真正懂写作者的工具</span>
        </h1>
        <p class="mt-6 text-lg leading-relaxed text-dark/70">
          WPX 由一支相信「写作值得被认真对待」的小团队打造。
          我们也曾被格式、引用、模板和工具割裂的体验困扰，
          所以决定自己造一个。
        </p>
      </div>

      <!-- Values -->
      <div class="mt-16 grid gap-6 md:grid-cols-3">
        <div
          v-for="v in values"
          :key="v.title"
          class="rounded-2xl border border-dark/5 bg-white p-6"
        >
          <h3 class="text-lg font-bold">
            <span class="wpx-gradient-text">{{ v.title }}</span>
          </h3>
          <p class="mt-2 text-sm leading-relaxed text-dark/60">
            {{ v.desc }}
          </p>
        </div>
      </div>

      <!-- Bug 提交区 -->
      <div
        id="bug-report"
        class="mt-20"
      >
        <h2 class="text-2xl font-extrabold md:text-3xl">Bug 提交区</h2>
        <p class="mt-2 text-dark/60">遇到问题了吗？请在下方描述，我们会尽快处理。</p>

        <!-- 成功提示 -->
        <div
          v-if="submitted"
          class="mt-6 rounded-2xl border border-green-200 bg-green-50 p-6 text-center"
        >
          <span class="text-3xl">✅</span>
          <p class="mt-2 text-sm text-green-700">已收到你的反馈，我们会尽快跟进处理！</p>
          <button
            class="mt-3 text-sm text-green-600 underline hover:text-green-800"
            @click="submitted = false"
          >继续提交</button>
        </div>

        <div
          v-else
          class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <!-- 在线提交 -->
          <div class="rounded-2xl border border-dark/5 bg-white p-6 sm:col-span-2 lg:col-span-2">
            <div class="flex items-center gap-3">
              <span class="text-2xl">🐛</span>
              <h3 class="text-base font-bold">在线提交</h3>
            </div>
            <form
              class="mt-4 space-y-3"
              @submit.prevent="submitBug"
            >
              <div>
                <input
                  v-model="form.title"
                  type="text"
                  placeholder="标题（选填）"
                  class="w-full rounded-lg border border-dark/10 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-wpx-primary focus:ring-1 focus:ring-wpx-primary/30"
                >
              </div>
              <div>
                <textarea
                  v-model="form.content"
                  rows="4"
                  placeholder="请描述你遇到的问题…"
                  class="w-full rounded-lg border border-dark/10 bg-gray-50 px-3 py-2 text-sm outline-none resize-none focus:border-wpx-primary focus:ring-1 focus:ring-wpx-primary/30"
                ></textarea>
              </div>
              <div>
                <input
                  v-model="form.contact"
                  type="text"
                  placeholder="联系方式（选填，邮箱或微信号）"
                  class="w-full rounded-lg border border-dark/10 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-wpx-primary focus:ring-1 focus:ring-wpx-primary/30"
                >
              </div>
              <p
                v-if="error"
                class="text-xs text-red-500"
              >{{ error }}</p>
              <button
                type="submit"
                :disabled="submitting"
                class="wpx-btn-primary text-sm"
              >{{ submitting ? '提交中…' : '提交反馈' }}</button>
            </form>
          </div>

          <!-- 邮件反馈 -->
          <div class="rounded-2xl border border-dark/5 bg-white p-6">
            <div class="flex items-center gap-3">
              <span class="text-2xl">📧</span>
              <h3 class="text-base font-bold">邮件反馈</h3>
            </div>
            <p class="mt-3 text-sm leading-relaxed text-dark/60">
              适合附截图或日志文件的大段反馈。
            </p>
            <a
              href="mailto:hello@wpx.app"
              class="mt-4 inline-block text-sm font-semibold text-wpx-primary hover:underline"
            >
              发送邮件 →
            </a>
          </div>

          <!-- 提交指南 -->
          <div class="rounded-2xl border border-dark/5 bg-white p-6 sm:col-span-2 lg:col-span-1">
            <div class="flex items-center gap-3">
              <span class="text-2xl">📋</span>
              <h3 class="text-base font-bold">提交指南</h3>
            </div>
            <ul class="mt-3 text-sm leading-relaxed text-dark/60 space-y-1.5 list-disc list-inside">
              <li>WPX 版本与操作系统</li>
              <li>复现步骤（做了什么）</li>
              <li>期望结果与实际结果</li>
              <li>如有截图或日志更好</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Contact -->
      <div
        id="contact"
        class="mt-20 rounded-3xl bg-wpx-gradient-soft p-10 text-center"
      >
        <h2 class="text-2xl font-extrabold md:text-3xl">
          <span class="wpx-gradient-text">想跟我们聊聊？</span>
        </h2>
        <p class="mt-3 text-dark/70">
          无论是产品反馈、合作机会、还是单纯想打声招呼 —— 都欢迎。
        </p>
        <a
          href="mailto:hello@wpx.app"
          class="wpx-btn-primary mt-6"
        >
          hello@wpx.app
        </a>
      </div>
    </div>
  </section>
</template>
