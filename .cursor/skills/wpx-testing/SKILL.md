---
name: wpx-testing
description: >-
  WPX 单元测试（Vitest）与 E2E 测试（Playwright）工作流。在编写/修复测试、
  运行 test 脚本、mock AI/API、排查测试失败时使用。
---

# WPX 测试工作流

## 单元测试（Vitest）

位置：`wpx-app/src/**/__tests__/*.spec.js`

```bash
cd wpx-app
npm test              # 单次运行
npm run test:watch    # 监听模式
```

### 配置要点

- `vite.config.js` → `test` 块：jsdom、`setupFiles: ['./src/test/setup.js']`
- `src/test/setup.js`：scrollTo、matchMedia、getClientRects 等 polyfill
- TipTap/ProseMirror：测试结束调用 `destroyEditor()` 避免异步泄漏

### 已有测试

| 组件 | 文件 | 覆盖 |
|------|------|------|
| AiAvatar | `components/ai/__tests__/AiAvatar.spec.js` | toggle、loading、头像 |
| AiChatWindow | `components/ai/__tests__/AiChatWindow.spec.js` | 开关、钉住、消息、拖拽 |
| EditorCore | `components/editor/__tests__/EditorCore.spec.js` | 选中、AI 替换、表格 |

每个 spec 需包含：正常渲染、事件触发、边界条件。

## E2E 测试（Playwright）

位置：`wpx-app/e2e/`

```bash
cd wpx-app
npx playwright install chromium   # 首次
npm run test:e2e
```

### 配置

- `playwright.config.js`：默认 `http://127.0.0.1:5173`，自动 `npm run dev`
- Mock：`e2e/helpers/mocks.js`（AI、library、knowledge API）
- 页面操作：`e2e/helpers/editor.js`

### 四条核心流程

1. `ai-text-replace.spec.js` — 选中文字 → AI 头像 → 指令 → 替换
2. `table-operations.spec.js` — 插入表格 → 右键 → 增删行列、合并
3. `image-editor.spec.js` — 上传图片 → 裁剪 → 应用
4. `save-document.spec.js` — 保存 → AI 建议路径 → 确认

### E2E 选择器约定

- UI 为中文：用 `getByRole('button', { name: '插入图片', exact: true })` 避免歧义
- 表格气泡菜单按钮文案：`↓ 行`、`→ 列`、`合并`（非完整 title）
- AI 聊天窗：确认 `AiAssistantPlaceholder` 已解包 Ref，避免全屏遮罩拦截点击

### 已知陷阱

- `vue3-draggable-resizable` shim 若破坏 CSS/组件加载，E2E 会大面积超时；改 alias 后需重跑全套
- Playwright strict mode：多个同名按钮时用 `exact: true` 或更具体 locator

## Mock AI 请求

AI SDK v6 经 Vite 代理到 `/api/ai/**`。E2E mock 需覆盖实际请求路径（含 `/chat/completions` 等），在 `mocks.js` 用 `page.route` 拦截。

## 调试失败测试

1. 单元：`npm test -- --reporter=verbose <file>`
2. E2E：`npx playwright test <spec> --headed --debug`
3. 用 `playwright` MCP 在 `localhost:5173` 复现交互
4. 用 `wpx_check_services` 确认 Vite 与 ai-proxy 在线

## 新增测试原则

- 只测真实行为，不写 trivial assert
- 优先 mock 外部 API，不依赖真实 LLM
- 与现有 helper 复用，保持 spec 精简
