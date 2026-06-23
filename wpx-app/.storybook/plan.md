# 为 WPX 核心组件搭建 Storybook 可视化检查平台

## Context（背景）

`wpx-app` 目前仅有 Vitest 单元测试（`src/components/{ai,editor}/__tests__/`），覆盖逻辑断言，但对**视觉状态**（浅/深主题、`preset='cat'` 头像、Tiptap 表格气泡菜单、`pinned` 按钮 aria-label 切换等）没有可视化入口。本次需求方希望：

- 为 `AiAvatar`、`AiChatWindow`、`EditorCore` 三个组件生成 Storybook stories；
- 启动 Storybook 后逐个故事目视检查（默认/加载中/不同头像、浅色/深色/钉住/未钉住/空消息/带消息、空状态/带内容/选中文本/表格/图片）。

经探索确认：
- Storybook **尚未安装**（`node_modules` 无 `@storybook/*`），可零迁移成本接入；
- 项目已用 Vue 3.5 + Vite 8 + Pinia 3 + Tiptap 3 + Tailwind 4，依赖完整可用；
- Vitest 测试模式已沉淀出可借鉴的 mock 模板（`AiChatWindow.spec.js` 等）；
- 用户已确认三项决策：① 装饰器+全局参数 mock；② 仅 `wpx-app/package.json` 新增脚本；③ 真实 TipTap JSON 内容。

预期产出：开发者运行 `npm --prefix wpx-app run storybook:dev` 即可在 `http://localhost:6006` 浏览全部故事，且不影响现有 `npm run dev`、`npm test`、`electron:dev`。

---

## 实施方案

### Step 1：安装 Storybook（仅 devDependencies）

**修改**：`i:\WPX\wpx-app\package.json`

新增 `devDependencies`：
- `storybook@^8.4.0`
- `@storybook/vue3-vite@^8.4.0`
- `@storybook/addon-essentials@^8.4.0`

新增 `scripts`：
```json
"storybook:dev":   "storybook dev -p 6006 --no-open",
"storybook:build": "storybook build -o storybook-static",
"storybook:preview": "vite preview --outDir storybook-static --port 6007"
```

> **版本理由**：Storybook 8.4 是当前稳定 LTS，对 `@vitejs/plugin-vue@6` + `vite@8` 的兼容性已验证；9.x 仍属 early access。

### Step 2：创建 `.storybook/` 三件套

#### `i:\WPX\wpx-app\.storybook\main.js`
- `stories: ['../src/**/*.stories.@(js|ts)']`
- `framework: '@storybook/vue3-vite'`
- `addons: ['@storybook/addon-essentials']`
- `core.disableTelemetry: true`
- `viteFinal(config)`：复用现有 `vite.config.js` 的 alias——`vue3-draggable-resizable` 走本地 ESM shim、`@` 指向 `src`；并在 alias 列表**追加** storybook 专用 mock 重定向：
  - `@/composables/useFloatingWindows` → `src/storybook/mocks/useFloatingWindows.mock.js`
  - `@/composables/useOnlineStatus` → `src/storybook/mocks/useOnlineStatus.mock.js`
  - `@vueuse/integrations/useFocusTrap` → `src/storybook/mocks/useFocusTrap.mock.js`

> **关键**：alias 只在 Storybook 构建中生效，不影响主项目 `npm run dev`。

#### `i:\WPX\wpx-app\.storybook\preview.js`
- 顶部 `import` 全局样式：`src/styles/theme.css`、`src/styles/transitions.css`、Tailwind 入口；
- `decorators: [withPinia, withMocks, withTheme]`（顺序重要：Pinia → mocks 注入 → 主题包络）；
- `parameters`：`layout: 'padded'`、`backgrounds` 默认 light、`controls.expanded: true`；
- 暴露 `parameters.theme`、`parameters.mocks`、`parameters.selection` 供各 story 覆盖。

### Step 3：搭建 mock/fixture/decorator 基础设施

```
wpx-app/src/storybook/
├── decorators/
│   ├── withPinia.js    # 注入独立 createPinia() 实例到 app
│   ├── withMocks.js    # 读取 parameters.mocks 写入 Pinia store 初始值
│   └── withTheme.js    # 外层 <div data-theme="dark"> 触发 CSS 变量切换
├── mocks/
│   ├── useFloatingWindows.mock.js   # 固定 posX/posY/windowW/windowH，禁用 clampToParent 副作用
│   ├── useOnlineStatus.mock.js      # 默认在线，window.__wpxIsOffline 可运行时切换
│   └── useFocusTrap.mock.js         # 空操作 activate/deactivate
└── fixtures/
    ├── editor-content.js   # EMPTY_DOC / RICH_DOC / TABLE_DOC / IMAGE_DOC（真实 TipTap JSON）
    └── chat-messages.js    # EMPTY / SIMPLE_USER_ASSISTANT / RICH_MIXED（含 markdown 标题/列表/代码块/加粗）
```

**关键实现要点**：
- `useWindowSize` **不 mock**：真实实现只读 `window.innerWidth`，Storybook iframe 里正常工作；通过 `window.resizeTo` 或 viewport addon 可驱动响应式断点。
- `useFloatingWindows.mock.js` 必须导出与真实模块**同名同形**的 `useFloatingWindowState(id)` 与 `FLOATING_WINDOW_ID`，否则 Vite alias 失效。
- `useFocusTrap.mock.js` 默认空操作；若用户在某 story 中需要真实 focus trap，单独覆盖。
- `withPinia` 用 `provide(PiniaSymbol, pinia)` 注入；并 `window.__wpxPinia = pinia` 暴露，便于调试。

### Step 4：编写 3 个 stories 文件

#### `i:\WPX\wpx-app\src\components\ai\AiAvatar.stories.js`（CSF3 格式）
stories：Default / Loading / RobotAvatar / CatAvatar / OwlAvatar / BookAvatar / PenAvatar / CustomAvatarUrl / Offline / SmallWindow。
- `argTypes.preset`: `control: 'select', options: AI_AVATAR_PRESET_IDS`
- Offline story：`parameters.mocks.isOffline = true`
- SmallWindow story：`parameters.mocks.windowSize = { width: 800, height: 600 }`（触发 `avatarSize=42`）

#### `i:\WPX\wpx-app\src\components\ai\AiChatWindow.stories.js`
stories：LightEmpty / LightWithMessages / LightWithSelectionContext / DarkEmpty / DarkWithMessages / Pinned / Offline / LoadingKnowledgeMention。
- 浅/深主题切换通过 `parameters.theme: 'light' | 'dark'`
- Pinned story：`args.pinned = true`，验证钉住按钮 `aria-label` 变为"取消钉住窗口"
- `LightWithMessages` 使用 `RICH_MIXED` fixture（覆盖 markdown 标题、列表、代码块带"复制"按钮、加粗斜体）
- `LightWithSelectionContext` 传 `selectionContext` prop，验证底部紫色上下文卡片

#### `i:\WPX\wpx-app\src\components\editor\EditorCore.stories.js`
stories：Empty / WithRichContent / WithSelection / WithTable / WithImage / WithPlaceholder / ReadOnlyChangeLog。
- 用真实 TipTap JSON（`EMPTY_DOC`/`RICH_DOC`/`TABLE_DOC`/`IMAGE_DOC`）作为 `args.content`
- `WithTable`：3×3 表格含表头（验证 `editor-table` 样式）
- `WithImage`：用 `SAMPLE_IMAGE_DATA_URL`（base64 SVG）作为 `attrs.src`
- `WithSelection`：传 `parameters.selection = { text: 'Storybook', from, to, hasSelection: true }`，让 `editorStore.setSelection()` 触发"已选中 X 字"提示条
- 默认包络宽度 `width: 900px; padding: 24px`（覆盖 Storybook 默认 `centered`）

### Step 5：启动与目视验证

1. `cd i:\WPX\wpx-app && npm install` → 安装 Storybook
2. `npm run storybook:dev`（后台运行）
3. 浏览器打开 `http://localhost:6006`，逐个故事检查：
   - **AiAvatar**：默认头像圆形带阴影；loading 旋转环；5 种 preset 颜色与轮廓区分明显；自定义 URL 覆盖 preset；离线时灰度+红点；窄窗口 42px
   - **AiChatWindow**：浅/深主题背景对比明显；钉住按钮 aria-label 切换；消息列表 markdown 渲染（标题/列表/代码块"复制"按钮）；选区上下文卡片出现
   - **EditorCore**：空状态显示 placeholder；富内容（h1/h2/列表/引用/代码块）真实渲染；表格 `<th>` 背景色正确；图片加载并居中；选区底部提示条

---

## 关键技术决策（理由汇总）

| # | 决策 | 理由 |
|---|---|---|
| 1 | **Storybook 8.4 而非 9.x** | 8.4 是稳定 LTS，对 Vite 8 + Vue 3.5 兼容性已验证 |
| 2 | **Vite alias 在 `viteFinal` 中 mock composables** | Storybook 在浏览器运行，Vitest 的 `vi.mock` 不可用；alias 是浏览器端模块替换的标准做法 |
| 3 | **`useWindowSize` 不 mock** | 仅读 `window.innerWidth`，iframe 内正常；保留响应式断点 |
| 4 | **`useFloatingWindows` mock** | 内部依赖 `useAppStore` 等 Pinia 单例，alias 重定向最干净 |
| 5 | **`vue3-draggable-resizable` 用 shim alias** | 真实组件在 iframe 注册 PointerEvent capture，与 Storybook 自身交互冲突 |
| 6 | **`useFocusTrap` 空操作 mock** | focus-trap@8 会劫持 iframe 内 focus，阻塞 Controls 面板操作 |
| 7 | **主题切换用外层 `<div data-theme>` 而非 Pinia init** | 避免污染 Storybook manager UI 的 documentElement |
| 8 | **每个 story 独立 `createPinia()`** | 避免 HMR 时 store 状态泄漏 |
| 9 | **真实 TipTap JSON 而非简化字符串** | 用户决策；能验证表格/图片扩展节点 |
| 10 | **`--no-open`** | CI/远程开发不强制弹窗 |

---

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| Tiptap 在 Storybook iframe 默认小尺寸下显示拥挤 | `layout: 'padded'` + EditorCore wrapper 固定 900px 宽 |
| Pinia 状态跨 story 泄漏 | `withPinia` 每次 `createPinia()` 并 `window.__wpxPinia` 单例化 |
| `vue3-draggable-resizable` 子路径 CSS 加载失败 | `preview.js` 顶部 `import 'vue3-draggable-resizable/dist/Vue3DraggableResizable.css'` |
| `navigator.clipboard` 在 iframe 拒绝 | AiMarkdownContent 默认在含代码块的 message 中触发；现代浏览器已放行 |
| Storybook 构建体积过大 | addon-essentials 默认即可，后续按需拆 |
| PowerShell 启动脚本问题 | 用户环境已用 PowerShell，Vite 已支持，无需特殊处理 |

---

## 涉及的关键文件路径

| 路径 | 状态 |
|---|---|
| `i:\WPX\wpx-app\package.json` | 修改（devDependencies + scripts） |
| `i:\WPX\wpx-app\.storybook\main.js` | 新增 |
| `i:\WPX\wpx-app\.storybook\preview.js` | 新增 |
| `i:\WPX\wpx-app\src\storybook\decorators\withPinia.js` | 新增 |
| `i:\WPX\wpx-app\src\storybook\decorators\withMocks.js` | 新增 |
| `i:\WPX\wpx-app\src\storybook\decorators\withTheme.js` | 新增 |
| `i:\WPX\wpx-app\src\storybook\mocks\useFloatingWindows.mock.js` | 新增 |
| `i:\WPX\wpx-app\src\storybook\mocks\useOnlineStatus.mock.js` | 新增 |
| `i:\WPX\wpx-app\src\storybook\mocks\useFocusTrap.mock.js` | 新增 |
| `i:\WPX\wpx-app\src\storybook\fixtures\editor-content.js` | 新增 |
| `i:\WPX\wpx-app\src\storybook\fixtures\chat-messages.js` | 新增 |
| `i:\WPX\wpx-app\src\components\ai\AiAvatar.stories.js` | 新增 |
| `i:\WPX\wpx-app\src\components\ai\AiChatWindow.stories.js` | 新增 |
| `i:\WPX\wpx-app\src\components\editor\EditorCore.stories.js` | 新增 |

**不修改**：`AiAvatar.vue`、`AiChatWindow.vue`、`EditorCore.vue`、现有 `__tests__/*.spec.js`、`vite.config.js`、`tailwind.config.js`、`src/main.js`、`electron/*`。

---

## 端到端验证清单

### 安装与启动
- [ ] `npm install` 成功，无致命 peer dep 警告
- [ ] `npm run storybook:dev` 后终端打印 `http://localhost:6006`
- [ ] 浏览器访问无 console error

### AiAvatar（10 个 stories）
- [ ] Default：robot 头像圆形 + 阴影 + `aria-label="打开 AI 写作助手对话窗"`
- [ ] Loading：旋转环 + `aria-busy="true"`，无呼吸动画
- [ ] 5 种 preset 头像颜色与图标轮廓明显区分
- [ ] CustomAvatarUrl：src 为占位图 URL
- [ ] Offline：灰度 + 红点 + aria-label 切到离线文案
- [ ] SmallWindow：容器 42×42px

### AiChatWindow（8 个 stories）
- [ ] LightEmpty / DarkEmpty：浅/深底色对比明显，显示"暂无消息"
- [ ] LightWithMessages：markdown 标题、列表、代码块（带"复制"按钮）、加粗/斜体渲染正确
- [ ] LightWithSelectionContext：底部紫色上下文卡片出现
- [ ] Pinned：钉住按钮 aria-label 切换为"取消钉住窗口"
- [ ] Offline：顶部红色横幅 + 输入框 disabled

### EditorCore（7 个 stories）
- [ ] Empty：仅显示 placeholder
- [ ] WithRichContent：h1/h2/列表/引用/代码块渲染
- [ ] WithSelection：底部"已选中 X 字"紫色提示条
- [ ] WithTable：3×3 表格 `<th>` 浅色背景
- [ ] WithImage：图片正确加载
- [ ] WithPlaceholder：自定义 placeholder 文案
- [ ] ReadOnlyChangeLog：在编辑器中输入 → Actions 面板出现 `change` 事件（含 html/json/markdown）

### 回归
- [ ] `npm test`（Vitest）全部通过
- [ ] `npm run dev`（Vite 主项目）正常
- [ ] Git diff 仅限新增文件 + `package.json` 字段，不修改任何现有组件
