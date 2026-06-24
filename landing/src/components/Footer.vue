<script setup>
/**
 * Footer.vue
 * ------------------------------------------------------------
 * WPX 营销站 · 站点页脚
 *
 *  - 四列布局：产品 / 资源 / 关于 / 法律
 *  - 链接全部预留跳转路径（路由 / 锚点 / 外链）
 *  - 底部彩蛋：Made with ❤️ and a lot of midnight snacks.
 * ------------------------------------------------------------
 */
const year = new Date().getFullYear()

const groups = [
  {
    title: '产品',
    icon: '📦',
    links: [
      { label: '功能', to: '/#features' },
      { label: '下载', to: '/#download' },
      { label: '更新日志', to: '/changelog' }
    ]
  },
  {
    title: '资源',
    icon: '📚',
    links: [
      { label: '文档', to: '/docs' },
      { label: 'Skills 市场', to: '/skills' },
      { label: '字体商店', to: '/fonts' }
    ]
  },
  {
    title: '关于',
    icon: '👋',
    links: [
      { label: '团队', to: '/about#team' },
      { label: 'GitHub', to: 'https://github.com/wpx-team/wpx', external: true },
      { label: '联系我们', to: 'mailto:hello@wpx.app', external: true }
    ]
  },
  {
    title: '法律',
    icon: '⚖️',
    links: [
      { label: '隐私政策', to: '/legal/privacy' },
      { label: '用户协议', to: '/legal/terms' },
      { label: '开源许可证', to: '/legal/licenses' }
    ]
  }
]

const socials = [
  {
    name: 'GitHub',
    href: 'https://github.com/wpx-team/wpx',
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4"><path d="M12 2C6.48 2 2 6.58 2 12.22c0 4.5 2.87 8.32 6.84 9.67.5.1.68-.22.68-.49l-.01-1.72c-2.78.62-3.37-1.36-3.37-1.36-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.4 9.4 0 0 1 12 7.07c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.64 1.03 2.76 0 3.94-2.34 4.81-4.57 5.07.36.32.68.94.68 1.9l-.01 2.82c0 .27.18.6.69.49C19.14 20.54 22 16.72 22 12.22 22 6.58 17.52 2 12 2z"/></svg>`
  },
  {
    name: 'Twitter / X',
    href: 'https://twitter.com/wpx_app',
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`
  },
  {
    name: 'Discord',
    href: 'https://discord.gg/wpx',
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.07.07 0 0 0-.073.034c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.073-.035 19.74 19.74 0 0 0-4.885 1.515.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.08.08 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`
  },
  {
    name: 'Email',
    href: 'mailto:hello@wpx.app',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`
  }
]
</script>

<template>
  <footer class="border-t border-dark/5 bg-white">
    <!-- ============== 主体：四列 + 品牌区 ============== -->
    <div class="wpx-container py-12 md:py-16">
      <div class="grid gap-12 md:grid-cols-12">
        <!-- 品牌区（占 4 列） -->
        <div class="md:col-span-4">
          <router-link
            to="/"
            class="inline-flex items-center gap-2"
          >
            <span
              class="flex h-9 w-9 items-center justify-center rounded-xl bg-wpx-gradient text-white font-extrabold shadow-wpx"
            >
              W
            </span>
            <span class="text-lg font-extrabold tracking-tight">
              <span class="wpx-gradient-text">WPX</span>
            </span>
          </router-link>
          <p class="mt-4 max-w-xs text-sm leading-relaxed text-dark/60">
            AI 智能文档编辑器，让每一次写作都更自由。
            论文、报告、随笔，一处搞定。
          </p>

          <!-- 社交链接 -->
          <div class="mt-6 flex flex-wrap items-center gap-2">
            <a
              v-for="s in socials"
              :key="s.name"
              :href="s.href"
              :target="s.href.startsWith('http') ? '_blank' : undefined"
              :rel="s.href.startsWith('http') ? 'noopener noreferrer' : undefined"
              :aria-label="s.name"
              class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-dark/10 bg-light text-dark/60 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-500/40 hover:bg-wpx-gradient-soft hover:text-primary-600"
              v-html="s.icon"
            />
          </div>

          <!-- 二维码占位（可选） -->
          <div class="mt-6 inline-flex items-center gap-3 rounded-xl border border-dark/5 bg-light/50 p-3">
            <div
              class="flex h-14 w-14 items-center justify-center rounded-md bg-white text-[10px] text-dark/40 shadow-sm"
            >
              QR
            </div>
            <div>
              <div class="text-xs font-semibold text-dark">
                扫码加群
              </div>
              <div class="text-[10px] text-dark/50">
                与 5000+ 写作者一起
              </div>
            </div>
          </div>
        </div>

        <!-- 四列链接（占 8 列） -->
        <div class="grid grid-cols-2 gap-8 md:col-span-8 md:grid-cols-4">
          <div
            v-for="g in groups"
            :key="g.title"
          >
            <h4 class="flex items-center gap-1.5 text-sm font-semibold text-dark">
              <span class="text-base">{{ g.icon }}</span>
              {{ g.title }}
            </h4>
            <ul class="mt-4 space-y-3">
              <li
                v-for="l in g.links"
                :key="l.label"
              >
                <!-- 外链：mailto / https -->
                <a
                  v-if="l.external"
                  :href="l.to"
                  :target="l.to.startsWith('http') ? '_blank' : undefined"
                  :rel="l.to.startsWith('http') ? 'noopener noreferrer' : undefined"
                  class="inline-flex items-center gap-1 text-sm text-dark/60 transition-colors hover:text-primary-600"
                >
                  {{ l.label }}
                  <span
                    v-if="l.to.startsWith('http')"
                    class="text-[10px] opacity-50"
                  >↗</span>
                </a>
                <!-- 内部路由 -->
                <router-link
                  v-else
                  :to="l.to"
                  class="text-sm text-dark/60 transition-colors hover:text-primary-600"
                >
                  {{ l.label }}
                </router-link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- ============== 底部一行 ============== -->
      <div
        class="mt-14 flex flex-col items-start justify-between gap-4 border-t border-dark/5 pt-6 md:flex-row md:items-center"
      >
        <p class="text-sm text-dark/50">
          © {{ year }} WPX Team · 保留所有权利
        </p>
        <p
          class="flex items-center gap-1.5 text-sm text-dark/55"
          aria-label="Made with love and midnight snacks"
        >
          Made with
          <span class="animate-pulse text-rose-500">❤️</span>
          and a lot of
          <span class="font-semibold text-primary-600">midnight snacks</span>.
        </p>
        <div class="flex items-center gap-3 text-xs text-dark/40">
          <a
            href="/sitemap.xml"
            class="transition-colors hover:text-primary-600"
          >Sitemap</a>
          <span>·</span>
          <a
            href="/rss.xml"
            class="transition-colors hover:text-primary-600"
          >RSS</a>
          <span>·</span>
          <a
            href="https://github.com/wpx-team/wpx/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            class="transition-colors hover:text-primary-600"
          >MIT</a>
        </div>
      </div>
    </div>
  </footer>
</template>
