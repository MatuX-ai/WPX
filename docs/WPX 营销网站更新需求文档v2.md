# WPX 营销网站更新需求文档

**版本**：V2.1（Hermes / v0.1.26 同步版）
**基础文档**：[WPX 营销网站需求文档（有趣版）.md](./WPX营销网站需求文档（有趣版）.md)（V1.1 风格基调，沿用）
**当前营销站版本**：landing（prowpx.com）
**对应桌面端版本**：v0.1.26（package.json；公开发布安装包以 GitHub Releases latest 为准，可能略滞后）
**最后更新**：2026-08-24
**状态**：V2.0（对齐至 v0.1.18）已落地 · **V2.1（Hermes / 记忆 / SKILL.md）已同步文案**

---

## 0. 背景与本次更新的必要性

### 0.1 现状摘要（V2.1）

- **桌面端已迭代至 v0.1.26**：在 v0.1.18 营销基线之上，落地 Hermes Agent（M1–M4）、SKILL.md、四层本地 AI 记忆、文库 Node 内嵌路由，并**删除**平台 `free-quota` 代码。
- **V1.1 完全免费模式**继续有效：无平台 Token 计费、无公共模型额度。
- **V2.0 清单**（对齐 v0.1.16→v0.1.18）已在营销站落地；本版（V2.1）补齐 Hermes 簇曝光与版本徽章。

### 0.2 V2.0 曾存在的不一致（历史 · 已处理）

| # | 不一致 | 影响 | 严重度 | V2.1 状态 |
|---|---|---|---|---|
| 1 | Hero 区写 "v1.0 · 全新发布" | 用户误以为还是 1.0 旧版 | 🔴 高 | ✅ 现为 v0.1.26 |
| 2 | FAQ 区仍讲 "Token 计费 / 每日 100M 免费额度" | 与 V1.1 完全免费直接冲突 | 🔴 严重 | ✅ 已清除 |
| 3 | SectionFeatures 仅 6 项基础卡片 | 演示文稿 / 多窗口等不可见 | 🔴 高 | ✅ 已扩展 + Hermes |
| 4 | SectionSkills 仅 6 项静态技能 | Skills 32+ / 本地指令未提 | 🟠 中 | ✅ |
| 5 | ChangelogView 只到 v1.0.0 | 与实际脱节 | 🔴 高 | ✅ 至 v0.1.26 |
| 6 | DocsView 文档索引滞后 | 新文档无入口 | 🟠 中 | ✅ 含 Hermes 主题 |

### 0.3 V2.1 新增目标

1. **风格沿用**：保持「有趣版」叛逆 / 幽默 / 极客气质。
2. **内容同步到 v0.1.26**：Hermes Agent、SKILL.md、四层记忆、free-quota 删除、文库 Node 路由。
3. **下载诚实**：产品徽章显示 v0.1.26；下载跳转 GitHub Releases latest（安装包发布可能略滞后）。

---

## 0A. V2.1 实施清单（Hermes 批次 · 2026-08-24）

| 项 | 文件 | 状态 |
|---|---|---|
| Hero 版本徽章 | `HomeView.vue` | ✅ `v0.1.26 · Hermes Agent 已接入` |
| Changelog 顶条 | `ChangelogView.vue` | ✅ v0.1.26 条目 |
| Features Hermes 卡 | `SectionFeatures.vue` | ✅ |
| Docs 三主题 | `DocsView.vue` | ✅ Hermes / SKILL.md / 四层记忆 |
| FAQ Hermes | `SectionFAQ.vue` | ✅ |
| Footer / Download / SEO / FreePledge | 对应组件 + `seo.js` | ✅ |

以下为 **V2.0 原文**（对齐 v0.1.16 的详细规格，保留作历史参考；实施状态以 0A 与落地代码为准）。

---

## 1. 适用范围

- 路径范围：`landing/` 目录下全部视图 / 组件 / 路由 / 静态资源
- 子站：仅 `landing/`（`admin/`、`wpx-app/` 不在本文档范围）
- 不含：第三方依赖升级、CDN 域名切换、Vercel 部署配置变更（除非随动）
- 数据源：`git log`、`docs/` 需求文档、`landing/dist/` 已发布产物、`package.json` 版本

---

## 2. 更新范围总览（V2.0 历史规格）

### 2.1 必须更新的页面（8 个）

| 路由 | 视图文件 | 主要更新点 |
|---|---|---|
| `/` | `views/HomeView.vue` | Hero 区版本号 / 副标题 / 浮窗徽标 |
| `/changelog` | `views/ChangelogView.vue` | 追加 v0.1.10 → v0.1.16 全部 6 个版本 |
| `/docs` | `views/DocsView.vue` | 文档章节索引重构（追加 6 大新功能入口） |
| `/skills` | `views/SkillsView.vue` | Skills 列表 32+ 完整化（新增教师 PPT 系） |
| `/` | `components/SectionFeatures.vue` | 卡片扩展至 9 项，含 jcode / 多窗口 / 源码编辑 |
| `/` | `components/SectionShowcase.vue` | 替换为"多窗口 vs IDE"对比截图区 |
| `/` | `components/SectionSkills.vue` | 升级为「64 条本地指令 + 32+ Skills」双轨展示 |
| `/` | `components/SectionFAQ.vue` | **全文重写**，移除 Token 计费相关所有表述 |

### 2.2 必须更新的组件（4 个）

| 组件 | 文件 | 主要更新点 |
|---|---|---|
| 顶部导航 | `components/NavBar.vue` | 中部导航新增"更新日志"和"技能"两个路由入口 |
| 承诺区 | `components/FreePledge.vue` | 收费对比表追加"按 Token 计费"列的删除说明 |
| 下载区 | `components/SectionDownload.vue` | 同步 v0.1.16 安装包实际大小、签名信息、GitHub 发布链路 |
| 页脚 | `components/Footer.vue` | 补充最近发布版本号、RSS/Subscribe、公众号（可选） |

### 2.3 推荐新增 / 升级的视图

| 路由 | 说明 | 优先级 |
|---|---|---|
| `/changelog` 升级为"时间轴 + 按版本折叠" | v0.1.10 之前的快照式展示不再合适 | 🟠 P1 |
| `/docs` 升级为"卡片矩阵 + 关键词检索" | 现有 4 大类 16 主题的层级无法容纳 26 份文档 | 🟠 P1 |
| 新增 `/features`（可选） | 把首页 Features 区抽出来单独成页，便于 SEO 收录 | 🟡 P2 |

---

## 3. 页面级更新需求

### 3.1 HomeView · 首屏

**位置**：`landing/src/views/HomeView.vue`

| 元素 | 当前文案 | 更新后 |
|---|---|---|
| 版本徽章 | "v1.0 · 全新发布" | "v0.1.16 · 已迭代 6 个版本" |
| 主标题 | "让写作更自由的 AI 文档编辑器" | 保持不变（沿用风格基调） |
| 副标题 | "多窗口编辑、AI 改写、虚拟纸张与文件管理融于一体" | "编辑器 + AI 助手 + 本地指令 + 演示文稿生成，多窗口一处搞定" |
| 4 个特性 chip | 仅基础项 | 重写为"多窗口独立 / 64 条本地指令 / 32+ Skills / 完全免费" |
| 浮窗徽标（左下） | "图片去背景" | 替换为"教师课件 PPT 一键生成" |
| 浮窗徽标（右上） | "7z 压缩" | 替换为"演示文稿生成器"或"PDF 离线 OCR" |

**新增**：Hero 区下方插入一行「最近更新」滚动条，从 git 最近 5 条 commit 自动生成（`git log --pretty=format:"%s" -5`，构建时静态嵌入）。

### 3.2 SectionFeatures · 核心特性区

**位置**：`landing/src/components/SectionFeatures.vue`

**当前状态**：6 张卡片（AI 改写 / 多窗口 / Skills / 虚拟纸张 / 7z / 账户配额）

**更新要求**：

1. 卡片数量扩展为 **9 张**（3×3 网格）：
   - ✨ **AI 一键改写**（保留）
   - 🪟 **多窗口独立编辑器**（重命名并突出）
   - 🧑‍🏫 **演示文稿生成（PPT）**（新增，融合教师 PPT 学生大纲）
   - 🛠️ **本地指令系统 64 条**（新增，对应 commit `5ad2d33`）
   - 📄 **HTML 源码分屏编辑**（新增，对应 commit `14a21bf`）
   - 🔍 **PDF 离线 OCR**（新增，对应 commit `975b0b3`）
   - 📦 **7z 压缩 / 解压**（保留并刷新描述）
   - 📚 **免费开源字体 100+**（替换原"账户配额"）
   - 🎓 **内置学生 / 教师 Skills 32+**（刷新数字）

2. 删除 / 替换"账户与模型配额"卡片（V1.1 已无平台账户）。

3. 每个卡片增加一个「相关文档」链接（跳转 `/docs#...` 对应锚点），用于 SEO 内链。

### 3.3 SectionShowcase · 沉浸式纸面 / 多窗口

**位置**：`landing/src/components/SectionShowcase.vue`

**当前状态**：单卡片展示"虚拟纸张"。

**更新要求**：

- 二选一：
  - **方案 A（推荐）**：升级为"多窗口 IDE 风格编辑器"对比图，标识窗口并排、左侧大纲、右侧 AI dock。
  - **方案 B**：保留原虚拟纸张样式，但补充"分屏 HTML 源码编辑"子卡片。
- 标题改为：「在 WPX 里，一次看到三件事：左边大纲、右边 AI、底下指令面板。」
- 在卡片右下角加上"实际窗口截图"标注，参考素材：
  - `editor-current.png`、`editor-state.png`、`editor-state2.png`、`wpx-launch-final.png`（桌面端截图已归档）

### 3.4 SectionSkills · 内置技能

**位置**：`landing/src/components/SectionSkills.vue`

**当前状态**：6 项静态卡片。

**更新要求**：

1. 标题改为「**32+ Skills + 64 条本地指令** · 学生 / 教师 / 通用全覆盖」。
2. 卡片分两段展示：
   - **上段（精选 6 项）**：保留现风格的卡片网格，但更新文案与图标：
     - 🎓 论文排版
     - 🧑‍🏫 **教师教案 → 课件 PPT**（新增）
     - ✍️ AI 改写
     - 🪄 图片去背景
     - 🛠️ **64 条本地指令**（新增，例如 `/focus`、`/export`）
     - 📚 知识库
3. **下段（新增模块 "Skills 全景"）**：折叠区，明细列表展开「学生 16 / 教师 16 / 通用」共 32 项技能。点击展开后通过 chip 形式展示。
4. 文末增加「查看全部 Skills →」CTA 跳转 `/skills`。

### 3.5 SectionPricing · 收费说明

**位置**：`landing/src/components/SectionPricing.vue`

**当前状态**：已正确反映 V1.1 完全免费模式。✅ 无需改动。

仅一项追加：底部 "✓ 为什么是「完全免费」" 文案，可补充一句"v1.1 起已无 Token 计费，FAQ 中已删除 Token 相关说明"，强化一致感。

### 3.6 SectionFAQ · 常见问题（**关键**）

**位置**：`landing/src/components/SectionFAQ.vue`

**当前问题（必须立即修复）**：FAQ 第 1 / 2 / 3 条均提及「Token / 按需计费 / 每日 100M 免费额度 / 商业字体 Token」，与 V1.1 完全免费模式直接冲突，是本次更新最严重的对齐点。

**更新要求（6 条 FAQ 全部重写）**：

| Q | 答案要点 |
|---|---|
| WPX 是免费的吗？ | 工具本体永久免费，AI 算力与商用字体由用户自备 / 自导入，平台零抽成。 |
| 之前说"按需 Token 计费"怎么没了？ | V1.1 起撤掉平台内置大模型与商业字体售卖业务，旧 FAQ 已废弃。请以最新文档为准。 |
| AI 怎么用？ | 在桌面端「设置 → 我的模型」中配置 DeepSeek / 智谱 / 通义 / 文心 / 豆包 / Kimi / 混元 / SiliconFlow 等任一兼容 OpenAI 协议的 API；亦可接入 Ollama / LM Studio。 |
| 商用字体从哪来？ | 系统字体 / 开源字体（思源、霞鹜、阿里巴巴普惠等）直接用；商业字体自行采购授权后导入 `.ttf` / `.otf` / `.woff` / `.woff2`。 |
| 支持哪些平台？ | Windows（首发，Electron）；macOS 与 Linux 在路线图。 |
| 我的文档会上传吗？ | 默认完全本地化；只有主动调用云端 AI 时相关片段才会按服务商策略传输。 |

### 3.7 HomeView 嵌入的「FreePledge · 我们的承诺」

**位置**：`landing/src/components/FreePledge.vue`

**更新要求**：

1. 标题改为「**完全免费 · 没有任何附加项**」。
2. 收费对比表的"WPS 商业字体 ¥X"行下方追加一行："Token 计费（已停用）" → WPS 列空 / WPX 列"不适用"。
3. 底部新增一行小字："本文最后随 v0.1.16 同步生效；之前版本若仍提 Token 计费，已作废。"

### 3.8 ChangelogView · 更新日志

**位置**：`landing/src/views/ChangelogView.vue`

**更新要求**：在现有 v1.0.0 之上，**新增倒序 6 个版本**，日期对齐 git commit 时间：

| 版本 | 日期 | 摘要（建议文案） |
|---|---|---|
| **v0.1.16** | 2026-06-29 | Excel 导入支持 + 标题字号 / 段距 / 列表优化 |
| **v0.1.15** | 2026-06-29 | **教师教案 → 课件 PPT** 全流程上线 |
| **v0.1.14** | 2026-06-29 | AI Chat 显示 DeepSeek 思考过程 + 图片对齐修复 |
| **v0.1.13** | 2026-06-29 | Focus 模式排版提示 / 本地指令 64 条 / HTML 源码编辑 / IDE 风格 dock |
| **v0.1.12** | 2026-06-29 | electron-builder 打包优化 + 图片删除修复 |
| **v0.1.11** | 2026-06-28 | 7 项中风险安全加固 + 版本递增 |
| **v0.1.10** | 2026-06-28 | 演示文稿生成器 / HTML 导出弹窗 / 本地指令 56 条 / MD-HTML 智能排版 / jcode 高性能 AI 引擎 / PDF 离线 OCR |

每条 change 需引用对应 `docs/` 中的需求文档链接（例如 `feat(lesson-ppt)` 对应 [WPX 教师教案生成课件 PPT 需求文档](./WPX教师教案生成课件PPT需求文档.md)）。

**结构升级**：

1. 顶部增加「订阅 GitHub Releases」CTA。
2. 时间轴改为「按版本折叠 / 展开」交互，移动端默认收起。

### 3.9 DocsView · 文档中心

**位置**：`landing/src/views/DocsView.vue`

**当前问题**：4 大类 16 主题，无法覆盖新增的 10+ 份核心文档。

**更新要求**：重构为 **6 大类 28 主题**：

| 大类 | 子主题（示例） |
|---|---|
| **入门指南**（4 项） | 安装与系统要求 / 首次启动配置 / 创建与管理文档 / 界面与快捷键 |
| **编辑器核心**（6 项） | Markdown 语法富文本 / 虚拟纸张与排版 / 多窗口工作流 / 图片与媒体 / HTML 源码分屏编辑（新增） / Focus 模式排版模板（新增） |
| **AI 与 Skills**（6 项） | AI 助手面板 / Skills 体系总览 / 内置 Skills 清单 / 自定义 Skill / **大模型接入教程（DeepSeek / 智谱 / 通义等，新增）** / **本地指令系统 64 条（新增）** |
| **导出与压缩**（4 项） | PDF / DOCX / Markdown 互转 / 演示文稿 PPT 导出（新增） / HTML 导出弹窗（新增） / 7z 压缩解压 |
| **导入与转换**（5 项） | 网页导入与智能排版（新增） / PDF OCR 离线处理（新增） / Excel / Word 文档导入（新增） / Markdown 双向同步 / jcode 高性能引擎（新增） |
| **开发者参考**（3 项） | 本地 API 与 IPC / 扩展插件开发 / 命令行工具 |

并在每张卡片下加 1 ~ 2 行"为什么推荐"的钩子文案（例：「HTML 源码分屏编辑，CodeMirror 6 与 Tiptap 双向同步，拖拽宽度，大文件警告」）。

### 3.10 SkillsView · 技能全景

**位置**：`landing/src/views/SkillsView.vue`

**更新要求**：

1. 新增「教师课件 PPT 一键生成」专项卡片，引导教师用户。
2. 增加筛选条：**学生 / 教师 / 通用**，默认显示全部。
3. 每张技能卡片底部追加"立即体验"按钮（点击触发彩蛋：「将会为你下载 WPX，并预装此 Skill」）。

### 3.11 NavBar · 顶部导航

**位置**：`landing/src/components/NavBar.vue`

**更新要求**：中部导航从 `[功能, 下载]` 扩展为 `[功能, 技能, 更新日志, 下载, 关于]`，路由与现有 `views/` 对齐。

### 3.12 Footer · 页脚

**位置**：`landing/src/components/Footer.vue`

**更新要求**：

1. 顶部增加「当前桌面端版本：v0.1.16」。
2. 增加订阅链接：「订阅更新」（指向 GitHub Releases 的 atom feed）。
3. 一句俏皮话维持风格："Made with ❤️ and a lot of midnight snacks." —— 已沿用，保留。

---

## 4. 文案与定价一致性原则

### 4.1 必须遵守的四条规约

| 规约 | 示例 |
|---|---|
| ❶ 不再出现 "Token 计费" / "按需 Token" / "商业字体 Token" | 旧 FAQ 中第 1-3 条全部清理 |
| ❷ 不再出现 "WPS 商业字体 ¥89" 等数字 | 改为"WPS 商业字体按字数收费" |
| ❸ 不再出现 "AI 算力平台免费额度" 等表达 | "自带 API Key，平台零抽成" |
| ❹ 版本徽章始终与桌面端对齐 | v1.0 / v0.1.16 应同步，不允许滞后超过 2 个 minor |

### 4.2 一致性检查清单

在每次发布前需对齐检查：

- [ ] Hero 区版本号
- [ ] ChangelogView 最新一条
- [ ] Footer「当前桌面端版本」
- [ ] SectionPricing 三张卡的"完全免费"徽章
- [ ] FAQ 区是否仍含 Token 计费措辞
- [ ] docs 链接是否指向实际存在的需求文档

---

## 5. 视觉与微交互建议

### 5.1 沿用现有调色板

不要修改 Tailwind 主题色，仅调整：

- `primary-from` / `primary-via` / `primary-to`：保持蓝紫渐变
- `accent-mint` / `accent-yellow`：保留薄荷绿与活力黄
- 新增 `accent-red-soft` 用于"已废弃"标识（仅 FAQ 与对比表使用）

### 5.2 微交互补充

1. **特性卡片 hover**：从 `-translate-y-1` 增强为 `-translate-y-1.5` + 微缩放（保持与现有风格一致）。
2. **Changelog 时间轴**：版本卡片右上角加 ⏱ 时间（保留仪式感）。
3. **新特性 chip**：在 `SectionFeatures` 中加"新增"小红角标，淡入动画 0.6s。

### 5.3 必须遵守的可达性约束

- 所有 emoji 图标必须带 `role="img"` + `aria-label`。
- 颜色对比度 ≥ 4.5:1（FAQ 中绿色 / 红色必须保持可读）。
- 折叠区必须支持键盘展开（`details/summary`）。
- reduced-motion 用户：动画自动降级为瞬时呈现。

---

## 6. SEO 与分享

### 6.1 关键词新增

在 `landing/src/config/seo.js` 中追加元数据：

- 「演示文稿生成器」「PPT 生成」「多窗口编辑器」「HTML 源码编辑」
- 「完全免费编辑器」「无 Token 文档编辑器」
- 「教师课件自动生成」「离线 PDF OCR」

### 6.2 OG 图更新

`landing/public/og-image.svg` 替换：

- 标题改为 "WPX · 多窗口 AI 文档编辑器 · 完全免费"
- 副标题："多窗口 / AI 助手 / 演示文稿 / 本地指令 · v0.1.16"

### 6.3 sitemap 自动化

在 `scripts/prerender.mjs` 中生成 `sitemap.xml` 时，把 `/changelog`、`/docs`、`/skills` 三个子路由的 `lastmod` 字段以 git 最新 commit 日期填充。

---

## 7. 性能与体积

| 指标 | 当前（dist 静态产物） | 目标 |
|---|---|---|
| 首页 HTML gzip | 已有 br/gz 压缩 | 保持 |
| 各 section chunk | 已按 `defineAsyncComponent` + `LazySection` 拆分 | 不退化 |
| 新增 `/changelog`、`/docs`、`/skills` chunk 总和 | < 250 KB gzip | 维持 |
| LCP（首屏） | < 2.5 s（Vercel CDN） | 维持 |

**建议**：在 `SectionFeatures.vue` 中追加日志截图时，使用 `<img loading="lazy" decoding="async" fetchpriority="low"`，避免 LCP 受影响。

---

## 8. 实施任务清单

> 拆分为 6 个独立子任务，按依赖顺序执行。

### T1 · 一致性止血（Highest priority）

- [ ] 重写 `landing/src/components/SectionFAQ.vue` 全 6 条（去 Token 化）
- [ ] 修改 `landing/src/views/HomeView.vue` Hero 版本徽章与浮窗文案
- [ ] 修改 `landing/src/components/FreePledge.vue` 对比表 + 底部小字
- [ ] 修改 `landing/src/components/Footer.vue` 顶部版本号 + 订阅入口
- [ ] 构建并验证 `landing/dist/` 不含字符串"Token"（grep 校验）

### T2 · 新功能曝光

- [ ] 扩展 `SectionFeatures.vue` 至 9 张卡片，删除"账户配额"
- [ ] 重写 `SectionSkills.vue` 为 6 + 折叠双轨
- [ ] 改造 `SectionShowcase.vue` 为多窗口 / HTML 源码分屏双卡片
- [ ] 修改 `SectionDownload.vue` 同步 v0.1.16 安装包大小与发布信息

### T3 · Changelog 与 Docs 同步

- [ ] 在 `ChangelogView.vue` 追加 v0.1.10 → v0.1.16 全部 6 条记录
- [ ] 重构 `DocsView.vue` 文档索引为 6 大类 28 主题
- [ ] 在每个 topic 卡片链接到 `docs/` 对应需求文档

### T4 · 导航与子页

- [ ] 修改 `NavBar.vue` 中部导航为 5 项路由
- [ ] 改造 `SkillsView.vue` 增加「教师 / 学生 / 通用」筛选
- [ ] 验证 prerender 7 个路由全部成功（`scripts/prerender.mjs`）

### T5 · SEO 与分享

- [ ] 更新 `landing/src/config/seo.js` 关键词
- [ ] 更新 `landing/public/og-image.svg`
- [ ] 更新 `prerender.mjs` 中 sitemap `lastmod` 字段逻辑

### T6 · 收尾验证

- [ ] `npm run build` 全量构建通过（含 SSR / prerender）
- [ ] 用 `node scripts/verify-landing.mjs`（若有）逐一截图首页 / Changelog / Docs
- [ ] 使用 axe-core 自动检测 a11y 是否达标
- [ ] 推送 Vercel 部署并比对 lighthouse 分数不下降

---

## 9. 验收标准

按以下 12 项逐一验收，全部通过后方可上线：

### 9.1 文案一致性

1. `grep -r "Token" landing/src/` 输出为 0
2. `grep -r "按需计费" landing/src/` 输出为 0
3. Hero 版本徽章 = "v0.1.16 · 已迭代 6 个版本"
4. Footer 顶部版本号 = `v0.1.16`
5. Changelog 时间轴最新一条为 v0.1.16

### 9.2 功能可见性

6. `SectionFeatures` 卡片数 = 9（包含多窗口 / 演示文稿 / 源码编辑 / PDF OCR / 64 条本地指令）
7. `SectionSkills` 描述中至少包含 "32+ Skills" 与 "64 条本地指令"
8. `DocsView` 包含 "大模型接入教程"、"本地指令系统"、"HTML 源码编辑"、"演示文稿生成"4 个新主题锚点

### 9.3 视觉与可达性

9. 首页移动端 375 / 768 / 1280 三档断点无溢出
10. axe-core 扫描首页无 critical / serious 级别问题
11. reduced-motion 用户首屏动画自动关闭

### 9.4 构建与发布

12. Vercel 部署后 lighthouse Performance ≥ 95 / Accessibility ≥ 95 / Best Practices ≥ 95 / SEO ≥ 95

---

## 10. 风险与回归测试点

| 风险 | 原因 | 缓解措施 |
|---|---|---|
| prerender 失败 | `/changelog` / `/docs` 子路由静态化失败 | `vite-plugin-prerender` 已在用，回滚方案：临时关闭 SSR |
| 大体积 SVG 阻塞 LCP | `og-image.svg` 内嵌大量文字 | 升级为 `og-image.webp` 或拆分为 description-only |
| FAQ 改动引发 SEO 漂移 | 关键词从 "Token 计费" 改为 "完全免费编辑器" | 在 sitemap 与 meta 中补足新关键词 |
| 文案 i18n 不齐 | 当前仅中文，未做英文版 | 本次仅做中文单语同步；英文版另立子任务 |

---

## 11. 不在本次范围（但值得规划）

- 多语言（英 / 日 / 韩）
- 博客 `/blog` 内容填充（现已路由通达）
- 用户社区 / 论坛入口
- A/B 测试基础设施（暂以人工 curl 校验）
- 嵌入 PerformanceObserver 上报至 Vercel Analytics

---

## 12. 关联文档索引

> 实施本需求时，建议同步打开以下文档做交叉参考：

- [WPX 营销网站需求文档（有趣版）](./WPX营销网站需求文档（有趣版）.md) ← 风格基调
- [WPX 技术架构总览 V2.0](./WPX技术架构总览V2.0.md)
- [WPX 多窗口独立编辑器架构设计](./WPX多窗口独立编辑器架构设计.md)
- [WPX AI 演示文稿生成器需求文档](./WPX演示文稿生成器需求文档.md)
- [WPX 教师教案生成课件 PPT 需求文档](./WPX教师教案生成课件PPT需求文档.md)
- [WPX HTML 源码编辑模式需求文档](./WPXHTML源码编辑模式需求文档.md)
- [WPX AI 本地指令系统需求文档](./WPXAI本地指令系统需求文档.md)
- [WPX 网页文件导入与智能排版需求文档](./WPX网页文件导入与智能排版需求文档.md)
- [WPX AI 助手帮助文档（国产大模型接入教程）](./WPXAI助手帮助文档（国产大模型接入教程）.md)
- [WPX 字体库需求文档](./WPX字体库需求文档.md)
- [WPX 集成 jcode 高性能 AI 引擎需求文档](./WPX集成jcode高性能AI引擎需求文档.md)

---

## 13. 给 Cursor / 工程师的任务拆解建议

按以下顺序分批下发，避免一次性堆叠太多文件：

1. **本批次**（T1 一致性止血）：
   - `SectionFAQ.vue` 全量重写
   - `HomeView.vue` Hero 段
   - `FreePledge.vue` 对比表
   - `Footer.vue` 顶部版本号
   - 命令行校验：`grep -r "Token" landing/src/` = 0

2. **次批次**（T2 新功能曝光）：
   - `SectionFeatures.vue` 9 卡
   - `SectionSkills.vue` 双轨
   - `SectionShowcase.vue` 双卡片
   - `SectionDownload.vue` 下载信息

3. **第三批次**（T3 Changelog + Docs）：
   - `ChangelogView.vue` 6 条记录
   - `DocsView.vue` 6 类 28 主题

4. **第四批次**（T4 导航 / 子页）：
   - `NavBar.vue` 5 项
   - `SkillsView.vue` 筛选

5. **第五批次**（T5 SEO / OG / sitemap）

6. **第六批次**（T6 验证 / 部署）

每个批次结束后，运行 `npm run build` + `grep` 校验 + 至少 3 个 Lighthouse 关键指标截图，再进入下一个批次。
