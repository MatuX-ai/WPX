<script setup>
/**
 * LandingView - Web 部署时的轻量级首页 / 营销页。
 *
 * 设计目标：
 * - 零交互：仅展示产品信息，不依赖 Vue Router / Pinia / 编辑器等重型模块。
 * - 静态预渲染：内容完全是字符串，SSR 阶段即可生成最终 HTML。
 * - LCP < 1s：通过 <AppPicture> + fetchpriority="high" + 内联关键 CSS。
 */
import { onBeforeUnmount, onMounted } from 'vue'
import AppPicture from '@/components/common/AppPicture.vue'
import LazySection from '@/components/common/LazySection.vue'
import { setMeta } from '@/utils/seo'

const FEATURES = [
  {
    icon: 'AI',
    title: 'AI 助手深度协作',
    desc: '基于主流大模型的智能写作助手，自动润色、扩写、改写，让创意源源不断。',
  },
  {
    icon: '字体',
    title: '海量正版字体',
    desc: '对接字体商店，即装即用；支持字体子集化嵌入导出，跨设备显示一致。',
  },
  {
    icon: '文档',
    title: '所见即所得',
    desc: '类 Word 操作逻辑，开箱即用的表格、图片、引用与脚注，专注内容本身。',
  },
  {
    icon: '导出',
    title: '专业级导出',
    desc: '一键导出 PDF / DOCX / Markdown，内置多种论文模板与虚拟纸张母版。',
  },
  {
    icon: '隐私',
    title: '本地优先',
    desc: '桌面端数据保存在本机，离线可用；云端能力按需启用，零数据外泄风险。',
  },
  {
    icon: '扩展',
    title: '可扩展架构',
    desc: '内置 Skills 框架，支持教师、大学生、营销等多套垂直场景，开箱即用。',
  },
]

const SCENARIOS = [
  { tag: '教师', text: '课件、试卷、论文排版一键导出' },
  { tag: '学生', text: '论文、笔记、毕业设计模板' },
  { tag: '市场', text: '方案、报告、白皮书排版' },
  { tag: '运营', text: '公众号、知乎长文写作' },
]

onMounted(() => {
  setMeta({
    title: 'WPX · AI 智能文档编辑器',
    description:
      'WPX 是一款 AI 驱动的智能文档编辑器，集成大模型协作、海量字体、专业级导出与可扩展 Skills，专为教学、学术与内容创作打造。',
    path: '/',
    keywords: 'AI 文档编辑器,Markdown,智能写作,论文排版,字体市场',
  })
})

onBeforeUnmount(() => {
  // 重置 meta 以避免路由切换时残留
  setMeta({
    title: 'WPX · AI 智能文档编辑器',
    description: 'AI 驱动的智能文档编辑器，专为教学、学术与内容创作打造。',
    path: '/',
  })
})
</script>

<template>
  <div class="landing">
    <a class="landing__skip" href="#main">跳到主要内容</a>

    <header class="landing__header">
      <div class="landing__brand">
        <span class="landing__logo" aria-hidden="true">W</span>
        <strong>WPX</strong>
      </div>
      <nav class="landing__nav" aria-label="主导航">
        <a href="#features">功能</a>
        <a href="#scenarios">场景</a>
        <a href="#download">下载</a>
        <a class="landing__cta" href="https://github.com/" rel="noopener">GitHub</a>
      </nav>
    </header>

    <main id="main" class="landing__main">
      <section class="landing__hero">
        <div class="landing__hero-text">
          <h1>让 AI 成为你的写作搭档</h1>
          <p>
            WPX 是一款 AI 驱动的智能文档编辑器。集成大模型协作、海量字体与专业级导出，
            专为教学、学术与内容创作打造，本地优先、隐私可控。
          </p>
          <div class="landing__hero-actions">
            <a class="landing__btn landing__btn--primary" href="#download">立即下载</a>
            <a class="landing__btn landing__btn--ghost" href="#features">了解更多</a>
          </div>
        </div>
        <div class="landing__hero-image">
          <AppPicture
            src="/assets/hero.png"
            alt="WPX 文档编辑器主界面"
            width="640"
            height="400"
            :eager="true"
            priority="high"
            sizes="(min-width: 1024px) 640px, 100vw"
          />
        </div>
      </section>

      <section id="features" class="landing__section" aria-labelledby="features-title">
        <h2 id="features-title">核心能力</h2>
        <p class="landing__section-sub">为高强度写作场景设计，让每一个想法都顺利落地。</p>
        <ul class="landing__features">
          <li v-for="item in FEATURES" :key="item.title" class="landing__feature">
            <div class="landing__feature-icon" aria-hidden="true">{{ item.icon }}</div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.desc }}</p>
          </li>
        </ul>
      </section>

      <LazySection root-margin="120px" :min-height="240">
        <section id="scenarios" class="landing__section" aria-labelledby="scenarios-title">
          <h2 id="scenarios-title">适用场景</h2>
          <p class="landing__section-sub">不同角色都能找到自己的写作节奏。</p>
          <ul class="landing__scenarios">
            <li v-for="item in SCENARIOS" :key="item.tag" class="landing__scenario">
              <span class="landing__scenario-tag">{{ item.tag }}</span>
              <span class="landing__scenario-text">{{ item.text }}</span>
            </li>
          </ul>
        </section>
      </LazySection>

      <section id="download" class="landing__section landing__cta-section" aria-labelledby="download-title">
        <h2 id="download-title">开始使用 WPX</h2>
        <p>支持 Windows / macOS / Linux 桌面端，Web 版本可即时体验。</p>
        <div class="landing__hero-actions">
          <a class="landing__btn landing__btn--primary" href="/editor">打开 Web 版</a>
          <a class="landing__btn landing__btn--ghost" href="/library">浏览文库</a>
        </div>
      </section>
    </main>

    <footer class="landing__footer">
      <p>© {{ new Date().getFullYear() }} WPX · AI 智能文档编辑器</p>
      <nav aria-label="次要导航">
        <a href="/settings">设置</a>
        <a href="/about">关于</a>
      </nav>
    </footer>
  </div>
</template>

<style>
/**
 * 关键路径样式：内联或放置在 <style> 标签。
 * 为了 SSR 友好，保留 scoped 与外部样式表共同加载。
 */
.landing {
  --c-bg: #fafafa;
  --c-fg: #0f172a;
  --c-muted: #475569;
  --c-accent: #7c3aed;
  --c-accent-soft: #ede9fe;
  --c-border: #e2e8f0;
  --c-card: #ffffff;
  font-family: 'Inter', system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: var(--c-fg);
  background: var(--c-bg);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.landing__skip {
  position: absolute;
  left: -9999px;
  top: 0;
  background: var(--c-accent);
  color: #fff;
  padding: 0.5rem 1rem;
  z-index: 1000;
  border-radius: 0 0 0.5rem 0.5rem;
}
.landing__skip:focus {
  left: 0;
}

.landing__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--c-border);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: saturate(180%) blur(8px);
  position: sticky;
  top: 0;
  z-index: 50;
}
.landing__brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.125rem;
}
.landing__logo {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--c-accent);
  color: #fff;
  font-weight: 700;
}
.landing__nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  font-size: 0.95rem;
}
.landing__nav a {
  color: var(--c-muted);
  text-decoration: none;
  transition: color 0.2s;
}
.landing__nav a:hover {
  color: var(--c-accent);
}
.landing__cta {
  background: var(--c-accent-soft);
  color: var(--c-accent) !important;
  padding: 0.4rem 0.9rem;
  border-radius: 0.5rem;
}

.landing__main {
  flex: 1;
  width: min(1100px, 92%);
  margin: 0 auto;
  padding: 3rem 0;
}

.landing__hero {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 2.5rem;
  align-items: center;
  padding: 3rem 0;
}
@media (max-width: 768px) {
  .landing__hero {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}
.landing__hero-text h1 {
  font-size: clamp(2rem, 4vw, 3rem);
  margin: 0 0 1rem;
  line-height: 1.15;
  letter-spacing: -0.02em;
}
.landing__hero-text p {
  color: var(--c-muted);
  font-size: 1.05rem;
  line-height: 1.6;
  max-width: 38rem;
}
.landing__hero-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
  flex-wrap: wrap;
}

.landing__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.7rem 1.4rem;
  border-radius: 0.6rem;
  font-weight: 500;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
}
.landing__btn--primary {
  background: var(--c-accent);
  color: #fff !important;
  box-shadow: 0 6px 20px -8px rgba(124, 58, 237, 0.6);
}
.landing__btn--primary:hover {
  transform: translateY(-1px);
}
.landing__btn--ghost {
  background: #fff;
  color: var(--c-fg) !important;
  border: 1px solid var(--c-border);
}
.landing__btn--ghost:hover {
  border-color: var(--c-accent);
  color: var(--c-accent) !important;
}

.landing__hero-image {
  display: flex;
  align-items: center;
  justify-content: center;
}
.landing__hero-image :deep(img),
.landing__hero-image img {
  max-width: 100%;
  height: auto;
  border-radius: 1rem;
  box-shadow: 0 30px 60px -30px rgba(15, 23, 42, 0.25);
}

.landing__section {
  padding: 3.5rem 0;
  border-top: 1px solid var(--c-border);
}
.landing__section h2 {
  font-size: clamp(1.5rem, 3vw, 2rem);
  margin: 0 0 0.5rem;
}
.landing__section-sub {
  color: var(--c-muted);
  margin: 0 0 2rem;
}

.landing__features {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}
.landing__feature {
  background: var(--c-card);
  border: 1px solid var(--c-border);
  border-radius: 0.85rem;
  padding: 1.25rem;
  transition: transform 0.2s, box-shadow 0.2s;
}
.landing__feature:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px -12px rgba(15, 23, 42, 0.1);
}
.landing__feature h3 {
  margin: 0.5rem 0 0.5rem;
  font-size: 1.05rem;
}
.landing__feature p {
  margin: 0;
  color: var(--c-muted);
  font-size: 0.9rem;
  line-height: 1.55;
}
.landing__feature-icon {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  background: var(--c-accent-soft);
  color: var(--c-accent);
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.85rem;
}

.landing__scenarios {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}
.landing__scenario {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--c-card);
  border: 1px solid var(--c-border);
  border-radius: 0.6rem;
}
.landing__scenario-tag {
  background: var(--c-accent-soft);
  color: var(--c-accent);
  padding: 0.2rem 0.6rem;
  border-radius: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
}
.landing__scenario-text {
  color: var(--c-muted);
  font-size: 0.9rem;
}

.landing__cta-section {
  text-align: center;
  background: linear-gradient(180deg, rgba(124, 58, 237, 0.04), transparent);
  border-radius: 1rem;
  border: 1px solid var(--c-border);
  padding: 3rem 1.5rem;
}
.landing__cta-section .landing__hero-actions {
  justify-content: center;
}

.landing__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2rem;
  border-top: 1px solid var(--c-border);
  font-size: 0.85rem;
  color: var(--c-muted);
}
.landing__footer nav {
  display: flex;
  gap: 1rem;
}
.landing__footer a {
  color: inherit;
  text-decoration: none;
}
.landing__footer a:hover {
  color: var(--c-accent);
}
</style>
