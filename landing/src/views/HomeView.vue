<!--
  HomeView · 营销站首页
  - 路由级 lazy chunk
  - 内部 sections 全部 async + IntersectionObserver 懒挂载
-->
<script setup>
import { onMounted, ref, defineAsyncComponent } from 'vue'
import { gsap } from 'gsap'
import LazySection from '../components/LazySection.vue'

// 非首屏 sections：单独成 chunk，滚动到视口才挂载
const SectionFeatures = defineAsyncComponent(
  () => import('../components/SectionFeatures.vue')
)
const SectionShowcase = defineAsyncComponent(
  () => import('../components/SectionShowcase.vue')
)
const SectionSkills = defineAsyncComponent(
  () => import('../components/SectionSkills.vue')
)
const SectionPricing = defineAsyncComponent(
  () => import('../components/SectionPricing.vue')
)
const SectionFAQ = defineAsyncComponent(
  () => import('../components/SectionFAQ.vue')
)
const SectionDownload = defineAsyncComponent(
  () => import('../components/SectionDownload.vue')
)

// GSAP 入场动画（仅首屏 Hero）
const heroTitle = ref(null)
const heroSub = ref(null)
const heroCta = ref(null)
const heroVisual = ref(null)

onMounted(() => {
  // 尊重 reduced-motion
  if (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return
  }
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
  if (heroTitle.value) {
    tl.from(heroTitle.value.children, {
      y: 24,
      opacity: 0,
      duration: 0.8,
      stagger: 0.08
    })
  }
  if (heroSub.value) {
    tl.from(heroSub.value, { y: 16, opacity: 0, duration: 0.6 }, '-=0.4')
  }
  if (heroCta.value) {
    tl.from(
      heroCta.value.children,
      { y: 12, opacity: 0, duration: 0.5, stagger: 0.08 },
      '-=0.3'
    )
  }
  if (heroVisual.value) {
    tl.from(
      heroVisual.value,
      { y: 32, opacity: 0, scale: 0.96, duration: 0.9 },
      '-=0.6'
    )
  }
})

function scrollToShowcase(e) {
  e?.preventDefault?.()
  if (typeof document === 'undefined') return
  document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <!-- ============== HERO（首屏，eager） ============== -->
  <section
    id="hero"
    class="relative isolate overflow-hidden pt-24 md:pt-32"
    aria-labelledby="hero-title"
  >
    <!-- 背景装饰 -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div class="absolute -top-40 left-1/2 h-[280px] w-[480px] -translate-x-1/2 rounded-full bg-wpx-gradient opacity-20 blur-3xl sm:h-[480px] sm:w-[860px]" />
      <div class="absolute -bottom-32 right-0 h-[200px] w-[320px] rounded-full bg-accent-mint/20 blur-3xl sm:h-[280px] sm:w-[480px]" />
    </div>

    <div class="wpx-container grid items-center gap-10 md:grid-cols-2 md:gap-12">
      <div class="min-w-0">
        <span class="wpx-chip">
          <span
            aria-hidden="true"
            class="h-1.5 w-1.5 rounded-full bg-primary-from"
          />
          v0.1.16 · 已迭代 6 个版本
        </span>

        <h1
          id="hero-title"
          ref="heroTitle"
          class="mt-6 text-[1.65rem] font-extrabold leading-[1.15] tracking-tight sm:text-4xl sm:leading-[1.1] md:text-6xl"
        >
          <span class="block">让写作更自由的</span>
          <span class="block">
            <span class="wpx-gradient-text">AI 文档编辑器</span>
          </span>
        </h1>

        <p
          ref="heroSub"
          class="mt-6 max-w-xl text-lg leading-relaxed text-dark/70"
        >
          编辑器 + AI 助手 + 本地指令 + 演示文稿生成，多窗口一处搞定。
          论文、报告、随笔、研究资料、备课课件，从构思到定稿，一处完成。
        </p>

        <div
          ref="heroCta"
          class="mt-8 flex flex-wrap items-center gap-3"
        >
          <a
            href="#download"
            class="wpx-btn-primary"
            aria-label="免费下载 WPX 桌面端"
          >
            免费下载
            <span aria-hidden="true">→</span>
          </a>
          <a
            href="#showcase"
            class="wpx-btn-ghost"
            @click="scrollToShowcase"
          >
            看看长什么样
          </a>
        </div>

        <ul class="mt-10 grid grid-cols-2 gap-4 text-sm text-dark/60 md:max-w-md">
          <li class="flex items-center gap-2">
            <span
              aria-hidden="true"
              class="h-1.5 w-1.5 rounded-full bg-accent-mint"
            />
            多窗口独立
          </li>
          <li class="flex items-center gap-2">
            <span
              aria-hidden="true"
              class="h-1.5 w-1.5 rounded-full bg-accent-yellow"
            />
            64 条本地指令
          </li>
          <li class="flex items-center gap-2">
            <span
              aria-hidden="true"
              class="h-1.5 w-1.5 rounded-full bg-primary-from"
            />
            32+ Skills
          </li>
          <li class="flex items-center gap-2">
            <span
              aria-hidden="true"
              class="h-1.5 w-1.5 rounded-full bg-primary-to"
            />
            完全免费
          </li>
        </ul>
      </div>

      <!-- 视觉占位：编辑器 Hero 卡片 -->
      <div
        ref="heroVisual"
        class="relative min-w-0"
        role="img"
        aria-label="WPX 桌面端编辑器截图示意"
      >
        <div class="rounded-3xl border border-dark/5 bg-white p-4 shadow-wpx-glow">
          <!-- 模拟窗口栏 -->
          <div class="flex items-center gap-2 border-b border-dark/5 px-2 pb-3">
            <span
              aria-hidden="true"
              class="h-3 w-3 rounded-full bg-red-400/80"
            />
            <span
              aria-hidden="true"
              class="h-3 w-3 rounded-full bg-accent-yellow/90"
            />
            <span
              aria-hidden="true"
              class="h-3 w-3 rounded-full bg-accent-mint/90"
            />
            <span class="ml-2 text-xs text-dark/40">毕业论文 · 第一章</span>
          </div>

          <div class="space-y-3 p-3">
            <div class="text-2xl font-extrabold tracking-tight">
              <span class="wpx-gradient-text">基于深度学习的图像去背景研究</span>
            </div>
            <div class="flex gap-2 text-xs text-dark/50">
              <span>摘要</span><span aria-hidden="true">·</span><span>关键词</span><span aria-hidden="true">·</span><span>引言</span>
            </div>
            <div class="h-2.5 w-11/12 rounded-full bg-dark/5" />
            <div class="h-2.5 w-10/12 rounded-full bg-dark/5" />
            <div class="h-2.5 w-9/12 rounded-full bg-dark/5" />
            <div class="mt-4 rounded-xl border border-primary-from/20 bg-wpx-gradient-soft p-3 text-sm">
              <div class="text-xs font-semibold text-primary-600">
                <span aria-hidden="true">✨</span> AI 帮你续写
              </div>
              <div class="mt-2 h-2 w-10/12 rounded-full bg-white/70" />
              <div class="mt-1.5 h-2 w-8/12 rounded-full bg-white/70" />
            </div>
          </div>
        </div>

        <!-- 浮动徽标 · 左下：教师 PPT 一键生成 -->
        <div
          aria-hidden="true"
          class="absolute -left-6 -bottom-6 hidden animate-float items-center gap-3 rounded-2xl bg-white p-3 shadow-wpx md:flex"
        >
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-yellow/30">
            🎓
          </div>
          <div>
            <div class="text-xs font-semibold">
              教师课件 PPT 一键生成
            </div>
            <div class="text-[10px] text-dark/50">
              教案 → 大纲 → 课件
            </div>
          </div>
        </div>
        <!-- 浮动徽标 · 右上：PDF 离线 OCR -->
        <div
          aria-hidden="true"
          class="absolute -right-4 -top-4 hidden animate-float items-center gap-3 rounded-2xl bg-white p-3 shadow-wpx md:flex"
          style="animation-delay: -3s"
        >
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-mint/30">
            🔍
          </div>
          <div>
            <div class="text-xs font-semibold">
              PDF 离线 OCR
            </div>
            <div class="text-[10px] text-dark/50">
              本地推理 · 扫描件可读
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ============== 非首屏：按 section 懒加载 ============== -->
  <LazySection min-height="640px">
    <SectionFeatures />
  </LazySection>

  <LazySection min-height="520px">
    <SectionShowcase />
  </LazySection>

  <LazySection min-height="540px">
    <SectionSkills />
  </LazySection>

  <LazySection min-height="680px">
    <SectionPricing />
  </LazySection>

  <LazySection min-height="520px">
    <SectionFAQ />
  </LazySection>

  <LazySection min-height="420px">
    <SectionDownload />
  </LazySection>
</template>
