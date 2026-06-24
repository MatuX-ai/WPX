# WPX 营销网站

独立的 Vue3 + Vite 项目，用于 WPX AI 智能文档编辑器的营销展示。

## 技术栈

- **Vue 3** + `<script setup>` SFC
- **Vite 5** 构建
- **Tailwind CSS 3**（扩展 WPX 品牌色）
- **GSAP**（Hero 区域入场动画）
- **Vue Router 4**（单页滚动 + `/blog`、`/about`、`/404`）

## 品牌色（Tailwind 扩展）

- `primary.from` `#2563EB` / `primary.to` `#7C3AED` —— 蓝紫渐变
- `accent.yellow` `#FBBF24` / `accent.mint` `#34D399` —— 强调色
- `dark` `#1E1E1E` / `light` `#FAFAFA` —— 中性色
- 渐变工具类：`bg-wpx-gradient`、`bg-wpx-gradient-soft`
- 阴影工具类：`shadow-wpx`、`shadow-wpx-glow`

## 字体

- 拉丁：`Inter`（Google Fonts CDN）
- 中文：思源黑体 `Noto Sans SC`（Google Fonts CDN）
- 在 `index.html` 中通过 `<link>` 预连接并加载
- 在 `tailwind.config.js` 与 `src/style.css` 中均注册了回退栈（PingFang SC / Microsoft YaHei / system-ui）

## 目录结构

```
landing/
├── index.html              # 入口 + 字体 CDN
├── package.json
├── vite.config.js          # 端口 5174
├── tailwind.config.js      # WPX 品牌色 & 动画
├── postcss.config.js
├── src/
│   ├── main.js
│   ├── App.vue             # 全局布局：NavBar + RouterView + Footer
│   ├── style.css           # Tailwind 三段 + 全局字体栈
│   ├── router/
│   │   └── index.js        # /, /blog, /about, 404
│   ├── components/
│   │   ├── NavBar.vue      # 固定顶部导航 + 移动菜单 + 单页滚动锚点
│   │   └── Footer.vue      # 三列站点地图 + 版权
│   └── views/
│       ├── HomeView.vue    # Hero / Features / Showcase / Skills / Pricing / FAQ / CTA
│       ├── BlogView.vue
│       ├── AboutView.vue
│       └── NotFoundView.vue
└── .gitignore
```

## 路由

- `/` 首页：单页滚动（Hero / Features / Showcase / Skills / Pricing / FAQ / Download）
- `/blog` 博客列表（懒加载）
- `/about` 关于（懒加载）
- `/:pathMatch(.*)*` 404（懒加载）

`scrollBehavior` 支持：浏览器前进/后退恢复位置、`/#xxx` 锚点平滑滚动、跨页面锚点先跳回首页再滚。

## 开发

```bash
cd landing
npm install
npm run dev      # http://127.0.0.1:5174
npm run build    # 输出 dist/
npm run preview  # 预览 dist/
```

## 备注

- 项目与主仓库 `wpx-app` / `electron` 完全独立，互不依赖。
- 端口刻意选择 `5174`（默认 5173）与 `4174`，避免与 wpx-app 的 dev server 冲突。
- 所有 `router-link` 跳转已配置 SPA 行为；如需部署到子路径，可在 `vite.config.js` 中设置 `base`。
