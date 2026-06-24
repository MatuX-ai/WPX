<script setup>
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

const team = [
  { name: 'Leo', role: '产品 / 架构', emoji: '🦊' },
  { name: 'Mira', role: '前端 / 设计', emoji: '🐰' },
  { name: 'Tomo', role: 'AI / 工程', emoji: '🦉' },
  { name: 'Kai', role: '后端 / DevOps', emoji: '🐧' }
]
</script>

<template>
  <section class="wpx-section pt-32">
    <div class="wpx-container">
      <div class="mx-auto max-w-3xl text-center">
        <span class="wpx-chip">关于我们</span>
        <h1 class="mt-4 text-4xl font-extrabold md:text-5xl">
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

      <!-- Team -->
      <div
        id="careers"
        class="mt-20"
      >
        <h2 class="text-2xl font-extrabold md:text-3xl">团队</h2>
        <div class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="m in team"
            :key="m.name"
            class="rounded-2xl border border-dark/5 bg-white p-5 text-center"
          >
            <div
              class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-wpx-gradient-soft text-3xl"
            >
              {{ m.emoji }}
            </div>
            <div class="mt-3 text-base font-bold">
              {{ m.name }}
            </div>
            <div class="text-xs text-dark/50">
              {{ m.role }}
            </div>
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
