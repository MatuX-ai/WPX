<script setup>
/**
 * FontsView.vue
 * ------------------------------------------------------------
 * WPX 营销站 · 字体商店
 *
 *  - 内置 8 款免费开源字体（随安装包）
 *  - 在线免费字体（按需下载）
 *  - 商业字体 Token 充值说明
 * ------------------------------------------------------------
 */

const builtInFonts = [
  { name: '思源黑体', en: 'Source Han Sans', type: '黑体', weights: 7, scene: '正文 / 标题，通用型', license: 'SIL OFL 1.1', emoji: '黑' },
  { name: '思源宋体', en: 'Source Han Serif', type: '宋体', weights: 7, scene: '正式文档、书籍排版', license: 'SIL OFL 1.1', emoji: '宋' },
  { name: '霞鹜文楷', en: 'LXGW WenKai', type: '楷体 / 手写', weights: 5, scene: '文学创作、个人笔记', license: 'SIL OFL 1.1', emoji: '楷' },
  { name: '霞鹜文楷等宽', en: 'LXGW WenKai Mono', type: '等宽楷体', weights: 1, scene: '代码块、技术文档', license: 'SIL OFL 1.1', emoji: '等' },
  { name: '阿里巴巴普惠体', en: 'Alibaba PuHuiTi', type: '现代黑体', weights: 9, scene: '商务文档、PPT', license: '阿里免费商用', emoji: '商' },
  { name: 'HarmonyOS Sans', en: 'HarmonyOS Sans', type: '无衬线黑体', weights: 9, scene: '科技感文档、UI 设计', license: '华为免费商用', emoji: '和' },
  { name: 'JetBrains Mono', en: 'JetBrains Mono', type: '等宽英文', weights: 5, scene: '代码块', license: 'SIL OFL 1.1', emoji: '码' },
  { name: 'Noto Color Emoji', en: 'Noto Color Emoji', type: '彩色表情', weights: 1, scene: '文档插画', license: 'SIL OFL 1.1', emoji: '😊' }
]

const onlineFonts = [
  { name: '站酷快乐体', type: '创意手写', scene: '标题、海报' },
  { name: '站酷文艺体', type: '文艺手写', scene: '小红书风格' },
  { name: '沐瑶软笔手写体', type: '手写毛笔', scene: '中式风格' },
  { name: '得意黑', type: '圆体', scene: '可爱风、产品介绍' },
  { name: '思源柔黑', type: '圆角黑体', scene: '女性向内容' },
  { name: '标小智龙珠体', type: '书法体', scene: '标题、LOGO' },
  { name: '极影毁片文宋', type: '仿宋', scene: '公文、报告' },
  { name: 'MiSans', type: '黑体', scene: '小米风格' }
]

const commercialRules = [
  { key: '充值方式', value: '10 元包（一次性）/ 自定义充值（10 元为单位）' },
  { key: '计费模式', value: '按字付费，用多少花多少；不订阅、不绑卡' },
  { key: '授权范围', value: '个人 / 商用可选；商用需绑定企业信息' },
  { key: '导出嵌入', value: '购买后字体可子集化嵌入 PDF / DOCX，随文档永久使用' }
]
</script>

<template>
  <section class="wpx-section pt-32">
    <div class="wpx-container">
      <!-- Hero -->
      <div class="mx-auto max-w-3xl text-center">
        <span class="wpx-chip">字体商店</span>
        <h1 class="mt-4 text-4xl font-extrabold md:text-5xl">
          <span class="wpx-gradient-text">好看的字体，免费、合法、即装即用</span>
        </h1>
        <p class="mt-4 text-dark/60">
          8 款免费开源字体随应用打包；按需下载更多免费字体；
          商业字体按字付费，不绑架、不订阅。
        </p>
      </div>

      <!-- 内置字体区 -->
      <div class="mt-16">
        <div class="flex items-end justify-between">
          <div>
            <h2 class="text-2xl font-extrabold md:text-3xl">
              <span class="wpx-gradient-text">内置字体</span>
            </h2>
            <p class="mt-2 text-sm text-dark/60">
              安装即用，无需联网。中文字体已子集化，安装包体积控制良好。
            </p>
          </div>
          <span class="hidden rounded-full bg-accent-mint/20 px-3 py-1 text-xs font-semibold text-emerald-700 md:inline-block">
            {{ builtInFonts.length }} 款免费
          </span>
        </div>

        <div class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <article
            v-for="f in builtInFonts"
            :key="f.name"
            class="group flex flex-col rounded-2xl border border-dark/5 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-primary-500/30 hover:shadow-wpx"
          >
            <div class="flex items-center gap-3">
              <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-wpx-gradient text-lg font-extrabold text-white shadow-wpx">
                {{ f.emoji }}
              </div>
              <div class="min-w-0">
                <h3 class="truncate text-base font-bold group-hover:text-primary-600">
                  {{ f.name }}
                </h3>
                <p class="truncate text-xs text-dark/50">
                  {{ f.en }}
                </p>
              </div>
            </div>
            <dl class="mt-4 space-y-1.5 text-xs text-dark/70">
              <div class="flex justify-between">
                <dt class="text-dark/50">类型</dt>
                <dd class="font-semibold">{{ f.type }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-dark/50">字重</dt>
                <dd class="font-semibold">{{ f.weights }} 字重</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-dark/50">场景</dt>
                <dd class="text-right font-semibold">{{ f.scene }}</dd>
              </div>
            </dl>
            <span class="mt-4 inline-flex w-fit items-center rounded-full bg-wpx-gradient-soft px-2.5 py-0.5 text-[11px] font-semibold text-primary-600">
              {{ f.license }}
            </span>
          </article>
        </div>
      </div>

      <!-- 在线免费字体 -->
      <div class="mt-20">
        <h2 class="text-2xl font-extrabold md:text-3xl">
          <span class="wpx-gradient-text">在线免费字体</span>
        </h2>
        <p class="mt-2 text-sm text-dark/60">
          同样免费可商用，体积较大或使用频率低，按需从 CDN 下载。
        </p>

        <div class="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <article
            v-for="f in onlineFonts"
            :key="f.name"
            class="flex items-center gap-3 rounded-xl border border-dark/5 bg-white px-4 py-3 transition-colors hover:border-primary-500/30 hover:bg-wpx-gradient-soft/50"
          >
            <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-wpx-gradient-soft text-sm font-bold text-primary-600">
              {{ f.name.slice(0, 1) }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-bold">{{ f.name }}</div>
              <div class="truncate text-xs text-dark/50">{{ f.type }} · {{ f.scene }}</div>
            </div>
          </article>
        </div>
      </div>

      <!-- 商业字体 Token 充值 -->
      <div class="mt-20 rounded-3xl border border-primary-500/20 bg-wpx-gradient-soft p-8 md:p-10">
        <div class="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <h2 class="text-2xl font-extrabold md:text-3xl">
              <span class="wpx-gradient-text">需要商业字体？</span>
            </h2>
            <p class="mt-3 text-dark/70">
              按字付费，不订阅、不绑卡。10 元起充，余额永久有效；用多少花多少，导出时可一键嵌入文档。
            </p>
            <a
              href="https://github.com/wpx-team/wpx/discussions"
              target="_blank"
              rel="noopener noreferrer"
              class="wpx-btn-primary mt-6"
            >
              了解 Token 充值
            </a>
          </div>
          <div class="rounded-2xl bg-white p-6 shadow-sm">
            <h3 class="text-sm font-semibold uppercase tracking-wider text-dark/50">
              商业字体使用规则
            </h3>
            <dl class="mt-4 space-y-3 text-sm">
              <div
                v-for="r in commercialRules"
                :key="r.key"
                class="flex justify-between gap-3 border-b border-dark/5 pb-3 last:border-0 last:pb-0"
              >
                <dt class="font-semibold text-dark/70">{{ r.key }}</dt>
                <dd class="text-right text-dark/80">{{ r.value }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <!-- Bottom CTA -->
      <div class="mt-16 text-center">
        <p class="text-sm text-dark/60">
          想把字体立即用起来？下载 WPX，所有内置字体一键启用。
        </p>
        <div class="mt-4 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/#download"
            class="wpx-btn-cta-pulse"
            aria-label="免费下载 WPX"
          >
            <span>免费下载 WPX</span>
          </a>
          <router-link
            to="/changelog"
            class="wpx-btn-ghost"
          >
            查看更新历史
          </router-link>
        </div>
      </div>
    </div>
  </section>
</template>
