# WPX Vite 构建优化计划

## Context

当前 `wpx-app` 项目 Vite 构建存在两个需要处理的警告：

1. **Chunk Size Warning**：`EditorLayout-DfuR2C-E.js` 单文件达 **1.34 MB**（gzip 388KB），超过 Vite 500KB 警告阈值
2. **#__PURE__ Annotation Warning**：`@vueuse/core/dist/index.js` 中有 2 处 rolldown 无法识别的 `#__PURE__` 注释（位置 3362:1、5780:23），影响 tree-shaking 效果

这些警告在终端输出中以 `plugin builtin:vite-reporter` 标签呈现，影响构建产物的加载性能。

## 当前构建产物概览

| 文件 | 大小 | gzip | 来源 |
|------|------|------|------|
| `EditorLayout-DfuR2C-E.js` | 1,336.63 kB | 388.30 kB | 主入口聚合 |
| `EditorCore-DKgzo4t8.js` | 551.03 kB | 170.87 kB | TipTap 编辑器 |
| `_plugin-vue_export-helper` | 123.05 kB | 48.34 kB | Vue 运行时 |
| 其他组件 | < 60 kB | < 20 kB | 各子功能 |

**根因**：`src/layouts/EditorLayout.vue` 静态导入了所有重型组件（ImageEditor、KnowledgePanel、EditorCore 等），即使这些组件仅在特定场景下使用。

## 实施方案

### 1. 动态导入重型组件（核心优化）

在 `EditorLayout.vue` 中将以下组件改为 `defineAsyncComponent` 异步加载：

- **`ImageEditor`**（图片编辑器，依赖 `tui-image-editor`，体积大，仅在用户编辑图片时使用）
- **`KnowledgePanel`**（资料库侧栏，可折叠，未打开时无需加载）
- **`CloseConfirmDialog`**（关闭确认弹窗，触发频率低）
- **`SaveDialog`**（保存对话框，触发频率低）

示例模式：

```vue
import { defineAsyncComponent } from 'vue'
const ImageEditor = defineAsyncComponent(
  () => import('@/components/image/ImageEditor.vue')
)
```

### 2. 配置 Vite 分包策略

在 `vite.config.js` 中新增 `build` 配置：

```js
build: {
  chunkSizeWarningLimit: 800,    // 提升警告阈值至 800KB
  rollupOptions: {
    output: {
      manualChunks: {
        // TipTap 编辑器（最大依赖）
        tiptap: [
          '@tiptap/vue-3',
          '@tiptap/starter-kit',
          '@tiptap/extension-table',
          '@tiptap/extension-image',
        ],
        // AI SDK（大依赖）
        ai: ['ai', '@ai-sdk/vue', '@ai-sdk/openai-compatible'],
        // VueUse 工具库
        vueuse: ['@vueuse/core', '@vueuse/integrations'],
      },
    },
  },
}
```

### 3. 抑制 #__PURE__ 警告（不可修复但可忽略）

由于警告源于 `node_modules/@vueuse/core`，无法直接修复源码。可通过 Vite 的 `esbuild` 配置跳过：

```js
esbuild: {
  legalComments: 'none',
}
```

或保留警告以提醒升级 `@vueuse/core` 到 rolldown 兼容版本（v12+ 已修复）。

### 4. 编辑器代码分割

将 `EditorCore` 内联的 TipTap 扩展通过动态导入按需加载。

## 涉及文件

- `i:\WPX\wpx-app\vite.config.js`（新增 `build` 配置）
- `i:\WPX\wpx-app\src\layouts\EditorLayout.vue`（修改为异步组件）

## 验证步骤

1. 执行 `cd wpx-app && npm run build`
2. 验证：
   - `EditorLayout` 主 chunk < 500KB
   - `ImageEditor`、`KnowledgePanel` 成为独立 chunk
   - #__PURE__ 警告消除或减少
3. 运行 `npm run electron:dev` 启动开发模式，确认功能正常
4. 检查 `wpx-app/dist/index.html` 中代码分割正确