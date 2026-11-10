# WPX 项目全面调试前置检查报告

- 生成日期：2026-11-10
- 审计范围：`i:/WPX`（只读审计，未修改任何源代码 / 锁文件 / 数据库 / 服务器配置）
- 审计方式：代码静态审查（目录结构、路由、IPC、服务端鉴权矩阵、测试配置逐项核对）
- Git 状态：本地 `master` 与 `origin/master` 已对齐，提交 `aa11a6726d7be91cb2a34ee30ac6b0758da317aa`；工作区有 1 个已跟踪文件修改（`wpx-app/test-results/.last-run.json`）及大量未跟踪调试残留物

---

## 1. 项目总体情况

WPX 是一款基于 **Electron 42 + Vue 3 + Vite + Tiptap** 的 AI 智能文档编辑器（v0.1.36 / README 业务版本 v1.1），含四大板块：

1. **桌面端**（Electron 多窗口编辑器，根 `package.json` + `electron/`）
2. **Web 前端**（`wpx-app/` 编辑器 SPA + `landing/` 官网）
3. **管理后台**（`admin/` 前端 + `server/` Express 后端 + `api/` Vercel Serverless 入口）
4. **本地外挂引擎**（jcode、Hermes Agent，`hermes-lib/` Python）

整体实现完整度较高：README 宣称的 16 大模块在代码中基本均有真实实现（含测试与打包二进制）。主要缺口集中在**服务端安全（1 个已确认高危信息泄露 + IDOR）**、**API Key 本地加密强度**、**CI 完全不跑测试**、**服务端零测试**四方面。

---

## 2. 项目架构图

```
                         ┌────────────────────────────────────────────┐
                         │              prowpx.com (Vercel)           │
                         │  vercel.json: /api/(.*) → api/admin/handler│
                         └───────────────┬────────────────────────────┘
                                         │
        ┌────────────────┐        ┌──────┴───────┐        ┌──────────────┐
        │  landing/      │  静态  │  api/        │  加载  │  _server/    │
        │  官网 (Vue3+Vite,│◄──────│  admin/       │──────►│  (server/ 的  │
        │  SSR 预渲染)    │        │  handler.js  │        │  Vercel 副本) │
        └────────────────┘        └──────────────┘        └──────┬───────┘
        ┌────────────────┐                                       │
        │  admin/        │  VITE_API_BASE_URL                    ▼
        │  管理后台前端    │────────────────────────────►  ┌──────────────┐
        └────────────────┘                               │  server/     │
                                                         │  Express 4   │
        ┌────────────────────────────────────────────┐   │  + PostgreSQL│
        │  Electron 桌面端（根 package.json）          │   │  + Redis     │
        │  electron/main.js (主进程)                  │   └──────┬───────┘
        │   ├─ window-manager.js (MAX_WINDOWS=8)      │          │
        │   ├─ preload.js (contextBridge ~90+ API)    │          │
        │   ├─ services/ (26 个：export/zip/font/     │          │
        │   │   hermes/jcode/model-secrets/knowledge) │          │
        │   └─ local-server.js (127.0.0.1 本地服务)    │          │
        │  wpx-app/ (渲染进程 Vue3+Tiptap+Pinia)       │          │
        │   ├─ src/server/ (ai-proxy / export /       │          │
        │   │   knowledge-service.py / rembg)         │          │
        │   └─ resources/bin/ (pandoc.exe, 7za.exe)   │          │
        └────────────────────────────────────────────┘
        hermes-lib/ (Python ≥3.11, Hermes Agent 本地网关 :8642)
```

---

## 3. 项目目录及模块说明

| 目录 | 用途 | 说明 |
|---|---|---|
| `electron/` | Electron 主进程 | `main.js`(41.7KB)、`preload.js`(asarUnpack)、`window-manager.js`、`services/` 26 个服务（导出、压缩、字体、Hermes/jcode 启动器、模型密钥、知识库等）、各 `*-ipc.js` |
| `wpx-app/` | 渲染进程 + Web SPA | Vue3 + Tiptap + Pinia（26 个 store）+ 48 个 composables；`src/server/` 附带本地 Node/Python 服务；`e2e/` Playwright |
| `landing/` | 官网 | Vue3 + Vite5 + GSAP，SSR 预渲染 |
| `admin/` | 管理后台前端 | Vue3 + Pinia + echarts（仪表盘/公告/版本/字体/模型/订单/角色） |
| `server/` | 生产后端 | Express 4 + pg(PostgreSQL) + redis + JWT + bcryptjs，CommonJS |
| `api/` | Vercel Serverless 入口 | `admin/handler.js` 薄包装加载 `_server/app.js`；`proxy.js` 反代 |
| `_server/` | server/ 的 Vercel 部署副本 | 与 `server/` 内容镜像（注意双份维护风险） |
| `hermes-lib/` | Hermes Agent 本地引擎 | Python 源码（run_agent.py 等 15 个文件），无 requirements.txt |
| `scripts/` | 构建辅助 | `build-frontend.js`(Vercel 构建)、`bump-pack-version.mjs`、冒烟/校验脚本 |
| `resources/` | 打包资源 | `bin/pandoc/pandoc.exe`(209MB)、`bin/7za.exe`；⚠️ `fonts/built-in/` 目录缺失 |
| `docs/` | 架构与需求文档 | 32 个 .md |
| 根目录残留物 | 调试产物 | `run*.json`、`probe*.json`、多张响应式截图、`diff.txt`、`hermes-home/`、`hermes-tmp/`、`wheels/`、`_login.json`、`_register.json` 等，无 .gitignore 覆盖 |

## 4. 实际技术栈

| 层 | 技术 |
|---|---|
| 桌面端 | Electron ^42.4.1、electron-builder ^26.15.3、electron-store ^11 |
| 前端 | Vue ^3.5、Vite ^8、Pinia ^3、vue-router ^5、Tailwind ^4、Tiptap ^3.27、CodeMirror 6、AI SDK (`ai` ^6 / @ai-sdk/vue / CopilotKit vue ^1.61.1)、echarts、pptxgenjs、markdown-it、tesseract.js 5.1.1、pdfjs-dist 4.10.38 |
| 官网/后台前端 | Vue ^3.4、Vite ^5、Tailwind ^3（与 wpx-app 版本不一致，属双套依赖） |
| 服务端 | Express ^4.19.2、pg ^8.12、redis ^4.7、jsonwebtoken、bcryptjs、nodemailer、helmet、multer ^2.2.0、express ^5.2.1（根项目内嵌 local-server） |
| 数据库 | PostgreSQL（纯 SQL，无 ORM，无迁移框架）+ Redis |
| 本地工具链 | Pandoc（xelatex/pdflatex PDF 引擎）、7za、mammoth（DOCX）、JSZip、fontkit/subset-font/fonttools（字体子集化）、rembg（Python）、ChromaDB（RAG 向量库） |
| 测试 | Vitest ^4.1.9（jsdom + node 双环境）、Playwright ^1.61（仅 Chromium）、Storybook ^8.4 |
| 包管理 | 各子项目独立 npm（非 workspaces），各自 package-lock.json |
| Node 要求 | 仅 `server/package.json` 声明 `>=18.0.0`；CI 用 Node 22.12.0；无 .nvmrc |

## 5. 功能模块实现情况

| # | 模块 | 状态 | 关键证据 |
|---|---|---|---|
| 1 | 官网 Web 前端 (landing) | ✅ 已实现 | `landing/src/`（Hero/FAQ/Pricing/Docs/SSR entry-server.js） |
| 2 | Web 编辑器 (wpx-app) | ✅ 已实现 | `wpx-app/src/components/editor/EditorCore.vue`、`extensions/` |
| 3 | Electron 多窗口桌面端 | ✅ 已实现 | `electron/window-manager.js` L6 MAX_WINDOWS=8、窗口计数持久化 |
| 4 | Tiptap JSON↔Markdown 转换 | ⚠️ 部分实现 | `src/utils/tiptapToMarkdown.js` 仅一个方向完整；MD→编辑器走 markdown-it 链路，非严格双向对等 |
| 5 | MD 智能排版引擎 | ✅ 已实现（实际 6 模板，README 写 5） | `src/composables/useMarkdownFormatter.js` L9/L90/L458 |
| 6 | 虚拟纸张 + 导出母版 | ✅ 已实现 | `src/constants/paperPreferences.js`、`electron/services/export-paper-layout.js` |
| 7 | 浮动 AI 助手（流式/多模型） | ✅ 已实现 | `useAiChat.js`（Chat + DirectChatTransport）、`modelSettings` store |
| 8 | AI 本地指令系统 | ✅ 已实现（实际 64 条，README 写约 56） | `src/data/local-commands.js` L4、`useLocalCommands.js` |
| 9 | Skills 系统（内置 + skillhub） | ✅ 已实现 | `src/data/teacher-skills.js`、`college-skills.js`、`skills/skillhub-loader.js`、`electron/skillhub-ipc.js` |
| 10 | PDF/DOCX/PPT 导入导出 | ✅ 已实现 | `electron/services/export-routes.js`(Pandoc)、`mammoth`、`electron/pptx-import.js`、`pdfOcrClient.js` |
| 11 | 演示文稿生成器 | ✅ 已实现 | `useSlideGenerator.js`、`electron/export-service.js` renderSlidesToPPTXBuffer L2297 |
| 12 | 压缩/解压 (7za) | ✅ 已实现 | `resources/bin/7za.exe`、`electron/zip-service.js` |
| 13 | 图片处理 + 字体库 | ⚠️ 部分实现 | rembg 双后端、OCR OK；**8 款内置字体仅有许可元数据，`resources/fonts/built-in/` 无任何 .ttf，二进制未入库** |
| 14 | 资料库 RAG | ⚠️ 部分实现 | Chroma 向量库存在，但 embedding 默认可能落到 `HashFallbackEmbeddingFunction`（SHA256 伪向量），真语义检索依赖 ONNX 模型 |
| 15 | 记忆与智能模板 | ✅ 已实现 | `electron/memory-service.js`（四层记忆）、`server/routes/user-memory.routes.js` |
| 16 | 用户注册/登录/JWT | ✅ 已实现 | `useAuth.js`、`electron/auth-store.js`（safeStorage/AES-GCM）、`server/routes/auth.routes.js` |
| 17 | 管理后台 | ✅ 已实现 | `admin/src/views/`（与 README 完全对应）、`server/routes/admin.routes.js` 44 条路由全带鉴权 |
| 18 | PostgreSQL + Redis | ✅ 已实现 | `server/models/db.js`、`redis.js`；`server/sql/init.sql` 16 张表 |
| 19 | Vercel 部署体系 | ✅ 已实现 | `vercel.json`（rewrites→`api/admin/handler`）、`scripts/build-frontend.js` |
| 20 | jcode / Hermes 本地引擎 | ✅ 已实现 | `electron/services/jcode-launcher.js`、`hermes-launcher.js`、`hermes-lib/` |

## 6. 本地开发环境要求

1. **Node.js**：≥18（server 要求），建议 22.12（CI 版本）。无 .nvmrc。
2. **包管理**：npm（每个子项目独立 `npm install`，无 workspaces/pnpm/yarn）。
3. **Python**：≥3.11（Hermes 引擎、`knowledge-service.py`、rembg；`wpx-app/src/server/requirements.txt` 存在，hermes-lib 无依赖清单）。
4. **外部工具**：MiKTeX/LaTeX（PDF 导出 xelatex 路径）、Chromium 系统浏览器（E2E `channel:'chrome'`）、ffmpeg（Playwright 视频录制，**本地缺失已导致上次 E2E 失败**）。
5. **数据库**：PostgreSQL + Redis（`server/.env.example` 提供 PG_*/REDIS_URL 全套键名）。
6. **第三方 API**：用户自备大模型 Key（DeepSeek 等）；ANYSEARCH_API_KEY（服务端）；SMTP（邮件验证码）。
7. **环境变量**：`server/.env.example`（82 行，最完整）、`admin/.env.example`、`wpx-app/.env.example`（仅注释形式）。**landing/、api/、hermes-lib 无 .env.example**（待办：补齐）。

## 7. 启动、构建和测试命令清单

| 命令 | 执行目录 | 作用 | 前置条件 | 副作用 |
|---|---|---|---|---|
| `npm install` | `/`、`/wpx-app`、`/landing`、`/admin`、`/server` | 安装依赖 | Node ≥18 | 写 node_modules（**未执行过则所有 dev 命令不可用，属待办事项**） |
| `npm run dev` | `/wpx-app` | Vite 开发服务器 :5173 | 已安装依赖 | 无 |
| `npm run electron:dev` | `/` | 并行起 vite + Electron | 已安装依赖；5173 就绪 | 启动桌面窗口、写 userData |
| `npm run electron:dev:multi` | `/` | 同上（多窗口模式） | 同上 | 同上 |
| `npm run build` | `/wpx-app` | 生产构建 dist | 已安装依赖 | 覆盖 dist/ |
| `npm run electron:build:win` | `/` | 打包 Windows 安装包 | 已安装依赖；镜像变量已配 | 生成 release/，体积大耗时长 |
| `npm run electron:pack:win` | `/` | 打包 + 版本号自动递增（bump-pack-version.mjs） | 同上 | ⚠️ **会修改 package.json 版本号** |
| `npm run test` | `/wpx-app` | Vitest 全量单测 | 已安装依赖 | 无 |
| `npm run test:zip` | `/wpx-app` | 运行 electron 主进程单测 | 已安装依赖 | 无 |
| `npm run test:e2e` | `/wpx-app` | Playwright E2E（自起 vite） | Chrome + ffmpeg 就绪 | 写 test-results/、playwright-report/ |
| `npm start` / `npm run dev` | `/server` | 启动生产/开发后端 | PG/Redis/JWT_SECRET 已配置 | 连接数据库 |
| `npm run smoke:prod` | `/` | 生产包冒烟测试 | 已打包 | 启动 Electron 实例 |
| `node scripts/build-frontend.js` | `/` | Vercel 构建入口（landing+admin） | 已安装两子项目依赖 | 写 public/ |

## 8. 数据库及第三方依赖

- **PostgreSQL**：16 张表（users、user_profiles、usage_events、payments、ai_models、model_call_logs、fonts、font_usage_logs、skills、token_orders、token_consumptions、announcements、versions、system_settings、admin_users、operation_logs）。初始化：`server/sql/init.sql` + `server/scripts/init-db.sh`。**无版本化迁移框架**（改动需手工同步 init.sql）。
- **Redis**：仅封装 getJSON/setJSON（`server/models/redis.js`），业务层使用少；serverless 冷启动失败仅记日志不阻断。
- **第三方服务**：用户自配大模型 API（直连）、ANYSEARCH 搜索、SMTP 邮件、Vercel 托管、GitHub（skillhub 拉取）、prowpx.com/releases（electron-builder 自动更新源）。
- **代码重复**：`server/`、`_server/`、`api/admin/server/` 三份镜像，`docs/`、`landing/`、`admin/` 各自独立依赖树——同步漂移是长期维护风险。

## 9. 高风险代码分析

### A. 数据安全

| 发现 | 位置 | 说明 |
|---|---|---|
| 【已确认】保存链路无备份/原子写/重试 | `wpx-app/src/composables/useAutoSave.js` L41-66；`src/utils/documentFile.js` L296-302；`documentPack.js` L94-103 | `fsp.writeFile` 直写目标文件，写失败仅抛错；无 .bak、无 tmp+rename、无重试队列 |
| 【潜在】主进程 3 秒强关窗口 | `electron/main.js` `bindWindowCloseGuard` L718-743 | 渲染进程 3s 未响应 close-check 即 `destroy()`，卡死时未保存内容丢失（强杀前未 flush 草稿） |
| 【已确认】文件 IPC 无路径白名单 | `electron/main.js` L1017-1045 `file:read-document`、L1047-1061 `file:write-document`、L1063-1080 `file:write-binary` | 渲染进程可传任意路径读写文件；knowledge 通道 `docId` 拼路径亦无 `path.relative` 校验（`electron/knowledge-service.js` L156/L240/L271） |
| 【潜在】多窗口草稿隔离为软隔离 | `src/utils/windowContext.js` L104-107 | windowId 取自 URL 参数无校验，窗口间可互相读取 localStorage 草稿（本机场景危害有限） |

### B. Electron 桌面端

| 发现 | 位置 | 说明 |
|---|---|---|
| 【良好】contextIsolation:true / nodeIntegration:false | `electron/window-manager.js` L157-162 | 基线达标；未发现 webSecurity:false、executeJavaScript |
| 【注意】sandbox:false + CSP 保留 unsafe-eval | `window-manager.js` L161；`main.js` L871-886 | 纵深防御缺口；一旦渲染层 XSS，eval 放大危害 |
| 【注意】preload 暴露 90+ IPC API | `electron/preload.js` L24-244 | 桥为白名单式（规范），风险集中在主进程 handler 参数校验（见上表） |

### C. AI 功能

| 发现 | 位置 | 说明 |
|---|---|---|
| 【已确认】模型 API Key 加密强度弱 | `electron/services/model-secrets-store.js` L13-16 | AES 密钥 seed = userData 路径 + 固定串，可离线解密；未用 safeStorage；兼容历史明文 Key（L134-147） |
| 【已确认】Key 明文落盘 | `electron/services/hermes-env.js` `writeHermesEnvFile` L19-58 | Hermes 协议要求，结果上 Key 明文写 `HERMES_HOME/.env` |
| 【潜在】Key 回传渲染进程 | `electron/model-ipc.js` L92-96 → 渲染层组请求 | 渲染层被注入即泄露（CSP 缓解但 unsafe-eval 削弱） |
| 【已确认·良好】流式中断处理完整 | `electron/services/model-fetch-bridge.js` L13-154 | AbortController、sender 销毁保护齐全 |
| 【潜在】流无整体超时 | `model-fetch-bridge.js` `handleFetchStream` | 对比 proxy 25s / url-extractor 30s，此处挂起需手动 abort |
| 【潜在】AI 整段覆盖文档 | `useHtmlImporter.js` L158/L265 `setContent`、`useHtmlSourceEditor.js` L244 | `setContent` 是全文档替换，依赖 Tiptap undo 兜底，无写入前确认/版本快照（版本机制只覆盖知识库） |

### D. 服务端

| 发现 | 位置 | 说明 |
|---|---|---|
| 【已确认·高危】`/api/health` 信息泄露 | `api/admin/handler.js` L117-175 | 公开无鉴权，返回 PG 主机/端口/库名 + **全量用户 email + roles**；L142 `delete require.cache` 诊断请求可打断连接池 |
| 【已确认·高危】IDOR | `server/controllers/user-memory.controller.js` L192-225 + `server/models/smart-template.js` L148-214 | 智能模板 get/update/delete/use 只 `WHERE id=$1` 不校验 user_id；ID `stpl-<8hex>` 熵约 32bit 可枚举 |
| 【已确认】userId 可伪造 | `user-memory.controller.js` L30、`feedback.routes.js` L34 | 未登录时直接采信 body.userId |
| 【已确认】公开端点无限流 | `anysearch.routes.js` L16/L52（无鉴权消耗服务端搜索配额）；`auth.routes.js` 登录/注册无 rate limit | 暴力破解/邮箱轰炸/配额滥用面 |
| 【良好】SQL 全参数化 + 排序白名单 | `server/models/*.js`（如 user.js L367-372） | 未发现 SQL 注入；仅 LIKE 通配符未转义（极低） |
| 【良好】bcrypt cost 12、JWT secret 纯环境变量、AUTH_BYPASS 生产拒绝启动、admin 44 条路由全带 `requireAuth+requireRole('admin')` | `server/utils/password.js`、`config/index.js` L77/L99-102、`admin.routes.js` L12-84 | 安全基线扎实 |
| 【潜在】logout 无 token 吊销 | `auth.controller.js` L91-95 | refresh token 30 天内无法服务端吊销 |

### E. 文件处理

| 发现 | 位置 | 说明 |
|---|---|---|
| 【已确认·良好】Zip Slip 防护 | `electron/zip-service.js` `assertSafeArchivePaths` L72-87 | 解压前枚举条目，拒绝 `..`/绝对路径/盘符 |
| 【已确认】pandoc 转换无超时 | `electron/services/export-routes.js` `runPandoc` L188-247 `execFile` | 未设 timeout/maxBuffer，恶意/超大输入可挂死；对比 font 子集化有 120s 超时 |
| 【已确认】multer 无限制 | `electron/local-server.js` L36-39 | memoryStorage、无 fileFilter、无 limits；缓解：仅监听 127.0.0.1 |
| 【已确认】本地服务无鉴权 + CORS 放行 `file://`/origin null | `electron/local-server.js` L46-57 | 本机任意浏览器页面可跨域调用导出/去背景/模型代理（简单请求不受 CORS 阻断），可作"借用用户 AI Key"跳板 |

## 10. 现有自动化测试情况

**规模**：约 123 个 Vitest 测试文件（wpx-app ~98 + electron 25）+ 9 个 Playwright E2E spec（约 27 用例，仅 Chromium）。

| 类别 | 覆盖 | 缺口 |
|---|---|---|
| 前端单测 | useAiChat 系列、useLocalCommands（45KB）、useMarkdownFormatter、documentFile、slideExport、zipApi、hermes/jcode/model stores 等 | EditorCore 组件级较薄 |
| Electron 单测 | export-service/paper-layout/font-embedder、zip、pptx-import、hermes/jcode/token/model 密钥、knowledge | main.js 启动逻辑、自动更新、剪贴板无测试 |
| E2E | auth-workflow（15 用例）、ai-assistant-edit-save、paper-and-focus、font、settings、table、image 等 9 场景 | 仅 Chromium 单浏览器；依赖本地 ffmpeg（缺失已致上次运行 failed：`ai-document-edit.spec.js` 环境性失败） |
| 服务端 | **零测试**（`server/package.json` test 脚本为 `echo "No tests yet"`） | JWT 鉴权、auth、admin.controller（27KB）、DB 层全部无测试 |
| CI | 仅 `.github/workflows/electron-build.yml`（tag 触发的三平台打包发布） | **CI 不跑任何 vitest/playwright**；无 coverage 脚本（已装 @vitest/coverage-v8 却从未统计） |

**失效迹象**：`wpx-app/test-results/.last-run.json` status=failed（1 个用例，ffmpeg 环境问题非断言失败）；E2E 结果全靠本地手动维护。

## 11. 已确认 Bug 清单

| 编号 | 问题 | 状态 |
|---|---|---|
| B-01 | E2E `ai-document-edit.spec.js` 运行失败（本地缺 playwright ffmpeg 二进制，`browserContext.newPage` 报 Executable doesn't exist） | 已确认（环境性，非功能断言失败） |
| B-02 | `GET /api/health` 公开返回 PG 主机 + 全量用户 email/roles | 已确认（`api/admin/handler.js` L117-175） |
| B-03 | 内置 8 款字体二进制缺失，`getBuiltInFonts()` 扫描的 `resources/fonts/built-in/` 不存在 | 已确认（代码内路径与仓库现状不符；若安装包另行携带则不算缺陷，需与打包流程核实） |
| B-04 | 智能模板 API IDOR：任意已认证用户可读写删他人模板 | 已确认（代码审查，未实际发送写请求验证） |
| B-05 | 文件 IPC（read/write-document/write-binary）无路径白名单 | 已确认（代码层） |

## 12. 潜在风险清单（静态发现，需运行验证）

| 编号 | 风险 | 位置 |
|---|---|---|
| R-01 | 模型 API Key 弱加密落盘 + Hermes 明文 .env + Key 回传渲染层 | `model-secrets-store.js`、`hermes-env.js`、`model-ipc.js` |
| R-02 | 文档保存无原子写/备份/重试；3s 强关窗口 | `documentFile.js`、`main.js` L718-743 |
| R-03 | pandoc/LaTeX 转换无超时；multer 无大小限制；本地服务无鉴权 CORS 放行 file:// | `export-routes.js`、`local-server.js` |
| R-04 | 登录/注册/anysearch 无限流；logout 无 token 吊销 | `auth.routes.js`、`anysearch.routes.js`、`auth.controller.js` |
| R-05 | AI `setContent` 整段覆盖无确认/快照 | `useHtmlImporter.js` 等 |
| R-06 | 模型流式请求无整体超时 | `model-fetch-bridge.js` |
| R-07 | RAG 默认 embedding 可能落哈希伪向量 | `wpx-app/src/server/knowledge-service.py` L102-134 |
| R-08 | `server/`/`_server/`/`api/admin/server/` 三份镜像漂移 | 全仓 |
| R-09 | JWT secret 缺失无启动期 fail-fast | `server/config/index.js` L77 |
| R-10 | CSP unsafe-eval + sandbox:false 纵深防御弱化 | `main.js` L871-886 |

## 13. P0 / P1 / P2 问题优先级

### P0（严重）

| 编号 | 名称 | 模块 | 位置 | 依据 | 建议修复 | 建议回归 |
|---|---|---|---|---|---|---|
| P0-1 | `/api/health` 公开泄露数据库主机与全量用户 email+roles | 服务端/serverless | `api/admin/handler.js` L117-175 | 代码逐行核对 | 立即移除诊断细节或加 admin 鉴权；下线 pgProbe.users 输出 | 匿名 GET /api/health 应仅返回 ok |
| P0-2 | 智能模板 IDOR（读/改/删他人模板） | 服务端 | `server/controllers/user-memory.controller.js` L192-225 | SQL 仅 WHERE id，无 user_id 校验 | update/delete/get 增加 `AND user_id=$n`；测试覆盖越权 | 越权 403 + 归属用例 |
| P0-3 | 渲染进程可经 IPC 任意路径读写文件 | Electron | `electron/main.js` L1017-1080 | 仅校验字符串类型 | fs IPC 增加路径归一化 + 根目录白名单校验（参照 zip-service 模式） | 尝试写 userData 外路径应被拒绝 |

### P1（重要）

| 编号 | 名称 | 模块 | 位置 |
|---|---|---|---|
| P1-1 | 模型 API Key 弱加密（路径派生密钥）+ Hermes 明文 .env | Electron | `model-secrets-store.js` L13-16、`hermes-env.js` |
| P1-2 | 文档保存无原子写/备份/重试（核心数据链路） | 前端/主进程 | `documentFile.js` L296-302 |
| P1-3 | 本地服务无鉴权 + CORS 放行 file://，可被本机网页借用 AI Key | Electron | `local-server.js` L46-57 |
| P1-4 | 服务端零测试（auth/admin/DB 全裸奔）+ CI 不跑任何测试 | 测试体系 | `server/package.json`、`.github/workflows/` |
| P1-5 | pandoc 无超时 + multer 无大小限制（本地 DoS 面） | Electron | `export-routes.js` L237、`local-server.js` L36 |
| P1-6 | 登录/注册无 rate limit；anysearch 公开无鉴权 | 服务端 | `auth.routes.js`、`anysearch.routes.js` |
| P1-7 | 内置字体二进制缺失（打包口径待核实） | 桌面端 | `resources/fonts/built-in/` |
| P1-8 | E2E 环境脆弱（ffmpeg 缺失已致失败；仅 Chromium） | 测试体系 | `playwright.config.js` |

### P2（一般）

| 编号 | 名称 | 模块 | 位置 |
|---|---|---|---|
| P2-1 | 主进程 3s 强关窗口、无强杀前 flush | Electron | `main.js` L718-743 |
| P2-2 | AI 流无整体超时 | Electron | `model-fetch-bridge.js` |
| P2-3 | AI setContent 整段覆盖无确认/快照 | 前端 | `useHtmlImporter.js` |
| P2-4 | CSP unsafe-eval / sandbox:false | Electron | `main.js` L871 |
| P2-5 | 三份 server 镜像漂移、landing/admin 与 wpx-app 依赖版本分叉 | 工程化 | 全仓 |
| P2-6 | 根目录调试残留物未清理、.gitignore 不完整 | 工程化 | 根目录 |
| P2-7 | README 口径（56 条指令实为 64；5 模板实为 6；MD↔Tiptap 非严格双向） | 文档 | README |
| P2-8 | RAG 默认哈希 embedding；JWT secret 无 fail-fast；logout 无吊销 | 服务端/前端 | — |

## 14. 下一阶段调试建议

1. **先修 P0-1**（一处改动即可消除用户数据泄露，风险收益比最高）。
2. **补服务端最小测试**：为 `middleware/auth.js`、`auth.controller.js`、`smart-template` 越权路径建立 vitest/supertest 用例，再谈回归。
3. **在 CI 加测试步骤**：electron-build.yml 中 `npm run test` + `test:zip`（E2E 可暂缓）。
4. **执行 E2E 前**先修本地环境（安装 Playwright ffmpeg：`npx playwright install`），再复跑确认 B-01 是否仅环境问题。
5. **桌面端数据链路专项**：模拟保存失败/强杀窗口场景，验证草稿兜底。
6. **待执行事项清单**（有副作用，均未执行，需你确认）：
   - 各子项目 `npm install`（若 node_modules 不全）
   - `npx playwright install`（补 ffmpeg/浏览器）
   - 运行 `npm run test`、`test:zip`、`test:e2e`（只读验证类，写 test-results 目录）
   - 启动本地 server + PG/Redis 做鉴权冒烟（需提供本地数据库或使用 mock）

## 15. 是否具备进入正式功能调试的条件

**结论：基本具备，建议先处理 1 项前置问题。**

- ✅ 代码与远程对齐、结构清晰、前端/主进程单测体系完善（约 123 个测试文件）、核心功能实现完整度高。
- ⚠️ 前置条件：① P0-1（/api/health 泄露）应在任何公开环境测试前修复；② 本地依赖与 Playwright 二进制需安装（待办事项）；③ 服务端调试需可用的 PG/Redis 环境。
- 服务端安全修复（P0-2/P0-3）可与逐模块调试并行推进，不阻塞桌面端功能调试。

---

*报告依据静态代码审查生成；所有【已确认】均指代码层可复现证据，未向生产环境发送任何写请求；未读取/输出任何 .env 值。*
