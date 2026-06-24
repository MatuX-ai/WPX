<!--
  SectionPricing · 价格区
-->
<script setup>
const pricing = [
  {
    name: '免费版',
    price: '¥0',
    period: '/ 永久',
    desc: '日常写作的轻量入口',
    items: ['所有基础编辑能力', '每日免费 AI 配额', '导出 PDF / DOCX', '社区支持'],
    cta: '立即下载',
    highlight: false
  },
  {
    name: '专业版',
    price: '¥39',
    period: '/ 月',
    desc: '进阶写作者 / 学生党的性价比之选',
    items: [
      '更高 AI 配额与多模型切换',
      '内置学生 / 教师全套 Skills',
      '商业字体合法嵌入',
      '多窗口独立编辑',
      '邮件技术支持'
    ],
    cta: '升级专业版',
    highlight: true
  },
  {
    name: '团队版',
    price: '¥99',
    period: '/ 用户 / 月',
    desc: '为研究小组 / 教研组而生',
    items: [
      '团队共享知识库',
      '集中式账号与配额',
      '私有部署与定制 Skills',
      '专属客户成功'
    ],
    cta: '联系我们',
    highlight: false
  }
]

function scrollToDownload() {
  if (typeof document === 'undefined') return
  const el = document.getElementById('download')
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <section
    id="pricing"
    class="wpx-section bg-wpx-gradient-soft"
    aria-labelledby="pricing-title"
  >
    <div class="wpx-container">
      <div class="mx-auto max-w-2xl text-center">
        <span class="wpx-chip">价格</span>
        <h2
          id="pricing-title"
          class="mt-4 text-3xl font-extrabold md:text-5xl"
        >
          <span class="wpx-gradient-text">简单透明，按需选择</span>
        </h2>
        <p class="mt-4 text-dark/60">
          不绑套餐，不藏条款。
        </p>
      </div>

      <div class="mt-14 grid gap-6 md:grid-cols-3">
        <article
          v-for="p in pricing"
          :key="p.name"
          :class="[
            'flex flex-col rounded-3xl border bg-white p-8 transition-all duration-300 hover:-translate-y-1',
            p.highlight
              ? 'border-transparent shadow-wpx-glow ring-2 ring-primary-500/40'
              : 'border-dark/5 shadow-sm'
          ]"
        >
          <div
            v-if="p.highlight"
            class="mb-4 inline-flex w-fit items-center gap-1 rounded-full bg-wpx-gradient px-3 py-1 text-xs font-semibold text-white"
          >
            <span aria-hidden="true">⭐</span> 最受欢迎
          </div>
          <h3 class="text-xl font-bold">
            {{ p.name }}
          </h3>
          <p class="mt-1 text-sm text-dark/60">
            {{ p.desc }}
          </p>
          <div class="mt-6 flex items-baseline gap-1">
            <span class="text-4xl font-extrabold">{{ p.price }}</span>
            <span class="text-sm text-dark/50">{{ p.period }}</span>
          </div>
          <ul class="mt-6 space-y-3 text-sm text-dark/70">
            <li
              v-for="i in p.items"
              :key="i"
              class="flex items-start gap-2"
            >
              <span
                aria-hidden="true"
                class="mt-1 h-1.5 w-1.5 rounded-full bg-accent-mint"
              />
              {{ i }}
            </li>
          </ul>
          <a
            href="#download"
            :class="[
              'mt-8 w-full text-center',
              p.highlight ? 'wpx-btn-primary' : 'wpx-btn-ghost'
            ]"
            @click.prevent="scrollToDownload"
          >
            {{ p.cta }}
          </a>
        </article>
      </div>
    </div>
  </section>
</template>
