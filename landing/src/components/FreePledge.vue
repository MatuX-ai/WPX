<script setup>
/**
 * FreePledge.vue
 * ------------------------------------------------------------
 * WPX 营销站 · 为什么免费 + WPS vs WPX 收费对比
 * ------------------------------------------------------------
 */

const rows = [
  {
    feature: 'PDF 转 Word',
    wps: { text: '会员 ¥89/年', bad: true },
    wpx: { text: '完全免费', good: true }
  },
  {
    feature: 'AI 大模型',
    wps: { text: '单独付费', bad: true },
    wpx: { text: '完全免费', good: true, note: '自带 API Key 即可' }
  },
  {
    feature: '商业字体',
    wps: { text: '按字数收费', bad: true },
    wpx: { text: '完全免费', good: true, note: '自导入已授权字体' }
  },
  {
    feature: 'Token 计费',
    wps: { text: '已废止', bad: false },
    wpx: { text: '已停用', good: true, note: 'V1.1 起不适用' }
  },
  {
    feature: '模板',
    wps: { text: '会员专属', bad: true },
    wpx: { text: 'AI 免费生成', good: true }
  },
  {
    feature: '安装包',
    wps: { text: '800MB+', bad: true },
    wpx: { text: '15MB', good: true }
  },
  {
    feature: '广告',
    wps: { text: '有', bad: true },
    wpx: { text: '零广告', good: true }
  }
]

const pledgeItems = [
  {
    icon: '🔓',
    title: '工具永久免费',
    desc: '编辑器、文件管理、虚拟纸张、压缩解压、PDF 互转……全都不要钱。'
  },
  {
    icon: '🤖',
    title: 'AI 大模型完全免费',
    desc: '用户自备 API Key（支持 DeepSeek、智谱、通义千问、文心一言、豆包、Kimi、腾讯混元等），平台零抽成。'
  },
  {
    icon: '🔤',
    title: '字体可自导入',
    desc: '系统字体 + 开源字体随便用。商用授权字体由用户自行采购后导入，不另收平台费。'
  },
  {
    icon: '🚫',
    title: '零弹窗零绑架',
    desc: '没有"猜你喜欢"、没有续费提醒、没有诱导分享、没有 Token 充值弹窗。'
  }
]
</script>

<template>
  <section class="wpx-section">
    <div class="wpx-container">
      <!-- ========== 标题 ========== -->
      <div class="mx-auto max-w-3xl text-center">
        <span class="wpx-chip">我们的承诺</span>
        <h2 class="mt-4 text-[1.6rem] font-extrabold leading-tight sm:text-3xl md:text-5xl">
          <span class="wpx-gradient-text">完全免费 · 没有任何附加项</span>
        </h2>
        <p class="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-dark/70">
          工具<strong class="text-dark">永久免费</strong>，AI 与字体由用户自备 / 自导入。
          WPX <strong class="text-emerald-700">不收任何平台服务费、不抽成、不收 Token 费</strong>。
          <br class="hidden md:block" />
          其余一切不收费，不弹窗，不绑架。
        </p>
      </div>

      <!-- ========== 三段式承诺 ========== -->
      <div class="mt-14 grid gap-5 md:grid-cols-3">
        <div
          v-for="p in pledgeItems"
          :key="p.title"
          class="rounded-2xl border border-dark/5 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-wpx"
        >
          <div class="text-3xl">
            {{ p.icon }}
          </div>
          <h3 class="mt-3 text-lg font-bold text-dark">
            {{ p.title }}
          </h3>
          <p class="mt-2 text-sm leading-relaxed text-dark/60">
            {{ p.desc }}
          </p>
        </div>
      </div>

      <!-- ========== 收费对比表 ========== -->
      <div
        class="comparison-table mt-16 overflow-hidden rounded-3xl border border-dark/5 bg-white shadow-wpx"
      >
        <!-- 表头 -->
        <div
          class="grid grid-cols-12 border-b border-dark/5 bg-wpx-gradient-soft"
        >
          <div class="col-span-4 px-2 py-4 text-xs font-semibold text-dark/70 sm:px-4 sm:py-5 sm:text-sm md:col-span-5 md:px-6">
            功能
          </div>
          <div
            class="col-span-4 border-l border-dark/5 px-2 py-4 text-center text-xs font-bold text-rose-600 sm:px-3 sm:py-5 sm:text-sm md:col-span-3 md:px-6"
          >
            <div class="flex items-center justify-center gap-2">
              <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                W
              </span>
              WPS
            </div>
          </div>
          <div
            class="col-span-4 border-l border-primary-500/20 px-2 py-4 text-center text-xs font-bold text-primary-600 sm:px-3 sm:py-5 sm:text-sm md:col-span-4 md:px-6"
          >
            <div class="flex items-center justify-center gap-2">
              <span
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-wpx-gradient text-white shadow-wpx"
              >
                W
              </span>
              WPX
              <span class="rounded-full bg-accent-mint/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                推荐
              </span>
            </div>
          </div>
        </div>

        <!-- 表体 -->
        <div
          v-for="(row, idx) in rows"
          :key="row.feature"
          :class="[
            'grid grid-cols-12 items-center transition-colors hover:bg-wpx-gradient-soft/30',
            idx !== rows.length - 1 ? 'border-b border-dark/5' : ''
          ]"
        >
          <!-- 功能列 -->
          <div class="col-span-4 px-2 py-4 text-xs font-medium text-dark sm:px-4 sm:py-5 sm:text-sm md:col-span-5 md:px-6">
            {{ row.feature }}
          </div>

          <!-- WPS 列 -->
          <div
            class="col-span-4 flex items-center justify-center gap-1 border-l border-dark/5 px-1 py-4 text-center text-xs sm:gap-1.5 sm:px-3 sm:py-5 sm:text-sm md:col-span-3 md:px-6"
          >
            <span
              v-if="row.wps.bad"
              class="rounded-md bg-rose-50 px-2.5 py-1 text-rose-600 line-through decoration-rose-300"
            >
              {{ row.wps.text }}
            </span>
            <span
              v-else
              class="text-dark/60"
            >
              {{ row.wps.text }}
            </span>
            <span
              v-if="row.wps.bad"
              class="text-rose-400"
              title="需要付费"
            >💸</span>
          </div>

          <!-- WPX 列 -->
          <div
            class="col-span-4 flex flex-col items-center justify-center gap-0.5 border-l border-primary-500/20 bg-wpx-gradient-soft/40 px-1 py-4 text-center sm:px-3 sm:py-5 md:col-span-4 md:px-6"
          >
            <div class="flex items-center gap-1.5">
              <span
                v-if="row.wpx.good"
                class="rounded-md bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700"
              >
                ✓ {{ row.wpx.text }}
              </span>
              <span
                v-else
                class="text-dark/80"
              >
                {{ row.wpx.text }}
              </span>
            </div>
            <span
              v-if="row.wpx.note"
              class="text-[10px] text-dark/50"
            >
              {{ row.wpx.note }}
            </span>
          </div>
        </div>
      </div>

      <!-- ========== 底部说明 ========== -->
      <div class="mt-8 flex flex-col items-center gap-4 text-center">
        <div class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-dark/60">
          <div class="flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-full bg-rose-500" />
            <span>WPS：年均付费 ¥89~299</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-full bg-emerald-500" />
            <span>WPX：¥0 起，完全免费</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-full bg-emerald-500" />
            <span>5 年累计可省 ¥1000+</span>
          </div>
        </div>
        <a
          href="#download"
          class="wpx-btn-primary !px-7 !py-3 text-sm"
          @click.prevent="document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' })"
        >
          立即免费下载
          <span aria-hidden="true">→</span>
        </a>
        <!-- 同步说明：本文已随 v0.1.16 同步生效，旧版 Token 计费措辞已废 -->
        <p class="mt-2 max-w-2xl text-xs leading-relaxed text-dark/40">
          本文最后随 v0.1.16 同步生效；之前版本若仍提 Token 计费，已作废。
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 移动端表格列宽优化 */
@media (max-width: 767px) {
  .comparison-table :deep(.col-span-4) {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }
}
</style>
