<script setup>
/**
 * DocsView.vue
 * ------------------------------------------------------------
 * WPX 营销站 · 文档中心
 *
 *  - 三块快速入门卡片
 *  - 文档章节索引（6 大类 28 主题，按 v0.1.16 重构）
 *  - 主题卡片含"为什么推荐"钩子文案
 *  - 顶部关键词过滤（自动滚动到对应 anchor）
 *  - 底部 CTA：跳转 GitHub Wiki
 * ------------------------------------------------------------
 */
import { ref, computed } from 'vue'

/**
 * 章节详细内容映射
 *  - key = sections[].items[].id
 *  - bullets：要点列表（3-5 项），采用与 PR 文案一致的精简表达
 *  - tips：补充提示（0-2 项），可选
 *  - command：本地指令示例，可选
 *  - link：外链或路由跳转，可选
 *  设计原则：项目内一致事实信息优先；不确定的部分明确标“不保证”。不重复索引卡片的文案。
 */
const sectionDetails = {
  // ===== 入门指南 =====
  install: {
    bullets: [
      '操作系统：Windows 10 1909+ 或 Windows 11 任意版本（x64 / ARM64 均支持）',
      '运行时内置 Electron 28，无需用户预装 Node.js / .NET / Python',
      '内存建议 ≥ 8GB；处理 100+ 页文档 / Skills 输出建议 16GB',
      '初始安装约 280MB；首次启动后约 500MB（含 Skills 与字体缓存）',
      '完全离线可用；联网仅用于可选的字体下载与版本更新检查'
    ],
    tips: ['被 Windows Defender 拦截时选「更多信息 → 仍要运行」即可']
  },
  'first-run': {
    bullets: [
      '首次启动会进入 3 步引导：选择工作区目录 → 选择主题 → 勾选启用默认 Skills',
      '工作区目录建议选本地磁盘（如 D:\\WPX-Workspace），避免同步盘或网络盘',
      '后续可在「设置 → 通用」随时修改工作区、主题与默认 Skills'
    ],
    tips: ['跳过引导也能后续手动在「设置」重新开启 3 步教程']
  },
  documents: {
    bullets: [
      '本地文件树保存于工作区根目录下，原生支持 .md / .wpxdoc / .docx / .txt',
      '文件默认 5 秒自动保存；手动保存 Ctrl+S；Ctrl+Shift+S 另存为',
      '重命名 / 删除 / 移动均可通过侧边文件树右键操作，支持拖拽排序',
      '默认每篇文档独立窗口，多窗口可同时打开多份文档（见 #multi-window）'
    ],
    tips: ['.wpxdoc 是 WPX 原生 JSON 格式，含文档元数据与多窗口状态']
  },
  shortcuts: {
    bullets: [
      'Ctrl+S 保存当前文档；Ctrl+Shift+S 另存为 / 导出',
      'Ctrl+Shift+H 唤起 HTML 源码分屏编辑（与编辑器双向同步）',
      'Ctrl+K 唤起指令菜单面板；上下方向键选择，Enter 执行',
      'Ctrl+P 快速搜索文档；Ctrl+Shift+F 文件内全文搜索',
      'Esc 关闭当前浮窗 / 指令菜单 / Skills 弹层'
    ]
  },
  // ===== 编辑器核心 =====
  markdown: {
    bullets: [
      '编辑器内核采用 Tiptap，基于 ProseMirror 的可扩展富文本框架',
      '原生支持标准 Markdown 语法：**加粗** *斜体* `代码` > 引用 + 列表',
      '内置扩展：MathJax（行内 / 块级公式）、Mermaid（流程图 / 时序图）、代码块高亮',
      '工具栏可一键切换“所见即所得 / Markdown 源码”双模（Ctrl+Shift+H）'
    ],
    tips: ['不熟悉的语法可在 Skills 菜单一键插入模板']
  },
  paper: {
    bullets: [
      '虚拟纸张支持 A4 / A5 / Letter / 自定义尺寸（可在「设置 → 纸张」调整）',
      '自动分页 + 页码 + 页眉页脚，导出 PDF 时完整保留',
      '母版概念：同系列文档（如论文 / 报告）可套用一个母版统一格式'
    ],
    command: '/paper-a4 · /paper-letter · /paper-a5'
  },
  'multi-window': {
    bullets: [
      '同时打开多份文档，各窗口独立焦点与光标位置',
      '跨窗口拖拽素材：图片 / 表格块 / 引用片段可直接拖到另一窗口',
      '指令菜单面板可贴边于任意窗口，作为常驻助手面板',
      'Ctrl+1~9 一键切换已打开的文档窗口'
    ],
    tips: ['多窗口与 Skills 面板配合可实现「一边大纲、一边 Skills 生成」']
  },
  media: {
    bullets: [
      '插入图片：拖拽 / Ctrl+V 粘贴 / 菜单插入（支持 jpg / png / webp / gif）',
      '本地去背景：rembg 离线推理，一键移除背景，隐私无忧',
      '图片对齐：左 / 中 / 右 / 两端对齐四档，支持多张同步对齐',
      '批量插入：选中多张图片后插入可一键插入到同一行'
    ]
  },
  'html-source': {
    bullets: [
      '代码编辑器采用 CodeMirror 6，与 Tiptap 双向同步（任一侧改动都会同步到另一侧）',
      '分屏宽度可拖拽调整；Ctrl+Shift+H 一键唤起 / 隐藏',
      '支持语法高亮（HTML / CSS / JS）、括号匹配、折叠、自动缩进',
      '适合需要精细控制样式、嵌入复杂 HTML 结构的场景（如看板 / 公式块）'
    ]
  },
  focus: {
    bullets: [
      '进入 Focus 模式后自动应用 5 套 MD 排版模板之一（可在「设置」指定）',
      '5 套模板：经典 / 学术 / 极简 / 暖黄护眼 / 杂志风',
      'Focus 模式同时隐藏工具栏与文件树，进入“只看到纸与笔”的状态'
    ],
    command: '/focus'
  },
  // ===== Skills 与指令 =====
  'commands-panel': {
    bullets: [
      '浮窗（默认）与贴边（IDE 风格右侧栏）两种呈现模式可一键切换',
      '贴边后与多窗口配合：窗口 A 写大纲，窗口 B 打开 Skills 输出窗口',
      '支持自定义面板位置：左侧 / 右侧 / 浮动 / 隐藏（快捷键 Ctrl+B）',
      '面板中可触发全部 Skills 与 64 条本地指令'
    ]
  },
  'skills-overview': {
    bullets: [
      '32+ 内置 Skills + 64 条本地指令 = 96 项开箱即用能力',
      '按用户群分类：学生专用 16 + 教师专用 16 + 通用 8',
      'Skills 输出可直接插入文档，也可以「另存为新文档」独立编辑'
    ],
    tips: ['查看完整列表见 Skills 市场（/skills）']
  },
  'built-in-skills': {
    bullets: [
      '学生 16：论文大纲 / 文献综述 / 查重降重 / 开题报告 / GB/T 7714 引用 / 学术排版 / 答辩 PPT / 错题复盘 / 考前冲刺 / 作文批改 / 单词速记 / 实验报告 …',
      '教师 16：教案生成 / 课件 PPT / 作文批改 / 试卷命题 / 学情分析 / 听课记录 / 教学反思 / 学生评语 …',
      '通用 8：图片去背景 / 数据洞察 / 翻译 / 总结 / 引用 / 改写 / 演讲稿 / 周报生成',
      '自定义：无上限，可在「Skills 市场 → 自定义」创建'
    ]
  },
  'custom-skill': {
    bullets: [
      '创建入口：「Skills 市场 → 自定义 → 新建」',
      '模板由三部分组成：名称 + 提示词（Prompt） + 输出变量（可选）',
      '提示词中可使用 {selection} 占位，自动取当前选中的文本',
      '输出变量可定义 JSON Schema，WPX 会按结构解析为表格 / 列表插入文档'
    ],
    tips: ['优秀的提示词模板可在社区 GitHub Discussions 分享']
  },
  'ai-models': {
    bullets: [
      '入口：「设置 → 我的模型 → 添加模型」',
      '预设 8+ 国产 / 国外大模型：DeepSeek / 智谱 GLM / 通义千问 / 文心一言 / 豆包 / Kimi / 腾讯混元 / SiliconFlow / OpenAI / Anthropic / Ollama / LM Studio',
      '兼容 OpenAI Chat Completions 协议（含 /v1/chat/completions 与 /v1/embeddings）',
      'API Key 仅本机 AES 加密存储，不上传 WPX 服务器',
      '支持本地推理：Ollama（http://localhost:11434）、LM Studio'
    ],
    tips: ['推荐 DeepSeek-V3 / 智谱 GLM-4-Flash：中文能力强、价格低']
  },
  'local-commands': {
    bullets: [
      '入口：编辑器中输入 / 触发；或 Ctrl+K 唤起指令面板',
      '全部 64 条指令本地执行，不依赖网络 / 不调用任何 AI',
      '分为 6 类：文件 / 编辑 / 排版 / 视图 / 导出 / 实验',
      '常用指令：/focus · /paper-a4 · /export · /img-bg · /img-ocr · /7z-pack'
    ],
    tips: ['输入 /help 查看完整指令列表']
  },
  // ===== 导出与压缩 =====
  pdf: {
    bullets: [
      '双向互转：Markdown ↔ PDF ↔ DOCX ↔ Markdown',
      '中文字体子集化：PDF 体积自动下降 60%（仅嵌入文档用到的字符）',
      'PDF 导出可指定纸张（A4 / A5 / Letter）、页码位置、页眉页脚',
      'PDF 导入自动识别章节结构、转换为编辑器可编辑内容'
    ]
  },
  'lesson-ppt': {
    bullets: [
      '从教案大纲一键生成 PPT（含标题页 / 章节页 / 总结页）',
      '自动配色：根据课题类型选 6 套主题色（语文 / 数学 / 英语 / 物理 / 化学 / 生物）',
      '配图：自动从教材插图 / Skill 输出中提取可用图位',
      '导出格式：.pptx（可在 PowerPoint / Keynote / WPS 演示中继续编辑）'
    ],
    command: '/lesson-ppt'
  },
  'html-export': {
    bullets: [
      '一键导出 HTML 单文件 / 完整站点（含 / 不含资源文件夹）',
      '支持打包为 ZIP / 嵌入所有资源到单一 HTML',
      '可选一键部署到 Vercel / Netlify / GitHub Pages 等静态托管',
      '导出后文件完全可离线浏览，不依赖 WPX 运行时'
    ],
    tips: ['适合作为项目文档 / 个人博客 / 课程主页发布']
  },
  compress: {
    bullets: [
      '7z 压缩 / 解压（AES-256 加密，支持分卷）',
      '双击 .7z 文件可在 WPX 内直接预览压缩包内容',
      '批量压缩：选中多个文件右键「压缩为 7z」',
      '压缩算法可选：LZMA / LZMA2 / Bzip2 / PPMd'
    ],
    command: '/7z-pack · /7z-unpack'
  },
  // ===== 导入与转换 =====
  'web-import': {
    bullets: [
      '粘贴 URL 自动抓取正文（基于 Mozilla Readability 提取算法）',
      '智能排版：自动去除广告 / 侧边栏 / 评论区，保留章节结构',
      '可选保留图片 / 代码块 / 引用块，按需转换为本地图存储',
      '支持微信公众号 / 知乎 / Medium / Substack 等主流平台'
    ],
    tips: ['部分需要登录的页面可复制正文后在编辑器内 Ctrl+V 直接导入']
  },
  'pdf-ocr': {
    bullets: [
      '基于 pdfjs 解析 + tesseract.js 本地推理，完全离线，0 上传',
      '支持中 / 英 / 日 / 韩 / 法 / 德 / 俄等 100+ 语言',
      '扫描版 PDF 自动识别为可编辑文本，保留原始排版位置',
      '批量 OCR：文件夹内多份 PDF 一键识别并保存为新文档'
    ],
    tips: ['推荐使用 300 DPI 以上的扫描文件以获得最佳识别率']
  },
  excel: {
    bullets: [
      '支持 .xls（兼容旧版） / .xlsx（OOXML） / .csv',
      '表格块解析为原生表格块，可在编辑器中继续编辑',
      '大表格自动启用虚拟滚动，万行表格也不会卡顿',
      '支持导入后转置 / 排序 / 筛选（v0.1.17+）'
    ]
  },
  'md-sync': {
    bullets: [
      '编辑器与源码视图双向同步（任一侧改动后另一侧立即更新）',
      '支持段落级 / 行级光标同步，切换不丢焦点位置',
      '保留自定义样式：嵌入 HTML / 数学公式 / Mermaid 在两侧均能渲染',
      '适配 GitHub Flavored Markdown 规范'
    ]
  },
  jcode: {
    bullets: [
      '本地推理引擎（Rust 内核 + N-API 绑定），比纯 JS 快 5-10x',
      '用于本地 Markdown 智能排版 / 表格识别 / 公式转换',
      '不调用任何云端 AI，数据完全在本地处理',
      '可在「设置 → 实验」中开启 / 关闭'
    ],
    tips: ['是「本地优先」体验的重要支撑之一']
  },
  // ===== 开发者参考 =====
  ipc: {
    bullets: [
      '主进程 / 渲染进程通信基于 Electron IPC，封装为 wpx.ipc.* API',
      '内置通道：wpx.ipc.fs（文件系统）/ wpx.ipc.shell（外链）/ wpx.ipc.dialog（对话框）',
      '新增自定义通道：见「electron/ipc.js」与「preload/index.js」',
      '调试工具：Ctrl+Shift+I 打开 DevTools，IPC 日志在 Console'
    ]
  },
  plugins: {
    bullets: [
      '插件以 npm 包形式提供，需在「设置 → 插件」加载',
      '可扩展点：自定义 Skill / 自定义指令 / 自定义导出格式 / 自定义面板',
      '插件 API 文档：见 GitHub Wiki「插件开发」章节',
      '官方示例插件：wpx-plugin-todo / wpx-plugin-word-count / wpx-plugin-git'
    ]
  },
  cli: {
    bullets: [
      '命令行工具：wpx-cli（随桌面端安装包附带，位于安装目录 /bin）',
      '支持：批量导出 / 批量转换 / 运行 Skills / 执行测试',
      '脚本化部署：可结合 GitHub Actions 实现文档自动构建',
      '查看帮助：wpx-cli --help'
    ]
  }
}

const sections = [
  {
    title: '入门指南',
    icon: '📘',
    color: 'from-primary-from/15 to-primary-to/10',
    items: [
      { id: 'install', name: '安装与系统要求', desc: 'Windows 10/11 · Electron 28+ · 推荐 8GB 内存', anchor: '#install' },
      { id: 'first-run', name: '首次启动配置', desc: '3 分钟跑通：从安装到第一篇文档', anchor: '#first-run' },
      { id: 'documents', name: '创建与管理文档', desc: '本地文件树、命名规范、自动保存策略', anchor: '#documents' },
      { id: 'shortcuts', name: '界面与快捷键', desc: 'Ctrl+S 保存、Ctrl+Shift+H 源码、Ctrl+K 唤起指令菜单', anchor: '#shortcuts' }
    ]
  },
  {
    title: '编辑器核心',
    icon: '✍️',
    color: 'from-accent-mint/15 to-primary-from/10',
    items: [
      { id: 'markdown', name: 'Markdown 语法与富文本', desc: 'Tiptap 为核心，MathJax / Mermaid / 代码块均有专门扩展', anchor: '#markdown' },
      { id: 'paper', name: '虚拟纸张与排版', desc: 'A4 / Letter / 自定义尺寸，母版 + 分页 + 页码', anchor: '#paper' },
      { id: 'multi-window', name: '多窗口工作流', desc: '同时打开多份文档，跨窗口拖拽素材，指令菜单可贴边', anchor: '#multi-window' },
      { id: 'media', name: '图片与媒体', desc: '去背景、滤镜、对齐、批量插入', anchor: '#media' },
      { id: 'html-source', name: 'HTML 源码分屏编辑（v0.1.13 新增）', desc: 'CodeMirror 6 + Tiptap 双向同步，拖拽宽度，Ctrl+Shift+H 唤起', anchor: '#html-source' },
      { id: 'focus', name: 'Focus 模式 MD 排版模板（v0.1.13 新增）', desc: '进入 Focus 自动应用 5 套 MD 排版模板', anchor: '#focus' }
    ]
  },
  {
    title: 'Skills 与指令',
    icon: '🧩',
    color: 'from-accent-yellow/20 to-accent-mint/10',
    items: [
      { id: 'commands-panel', name: '指令菜单面板', desc: '浮窗 ↔ 贴边（IDE 风格右侧栏）双模切换', anchor: '#commands-panel' },
      { id: 'skills-overview', name: 'Skills 与指令体系总览', desc: '32+ Skills + 64 条本地指令全景，按用户群分类', anchor: '#skills-overview' },
      { id: 'built-in-skills', name: '内置 Skills 清单', desc: '学生 16 + 教师 16 + 通用 8 + 自定义', anchor: '#built-in-skills' },
      { id: 'custom-skill', name: '自定义 Skill', desc: '写自己的模板与脚本，让 Skills 按你的流程改稿', anchor: '#custom-skill' },
      { id: 'ai-models', name: '大模型接入教程（DeepSeek / 智谱 / 通义 等，v0.1.10+ 新增）', desc: '兼容 OpenAI Chat Completions，覆盖 8+ 国产大模型预设', anchor: '#ai-models' },
      { id: 'local-commands', name: '本地指令系统 64 条（v0.1.13 新增）', desc: '输入 `/focus` `/export` `/paper-a4` 等立即生效', anchor: '#local-commands' }
    ]
  },
  {
    title: '导出与压缩',
    icon: '📤',
    color: 'from-primary-to/15 to-accent-yellow/15',
    items: [
      { id: 'pdf', name: 'PDF / DOCX / Markdown 互转', desc: '中文字体子集化，PDF 体积下降 60%', anchor: '#pdf' },
      { id: 'lesson-ppt', name: '演示文稿 PPT 导出（v0.1.15 新增）', desc: '从教案大纲一键生成 PPT，自动配色与配图', anchor: '#lesson-ppt' },
      { id: 'html-export', name: 'HTML 导出弹窗（v0.1.10 新增）', desc: '可打包 ZIP / 嵌入资源 / 一键部署到静态托管', anchor: '#html-export' },
      { id: 'compress', name: '7z 压缩 / 解压', desc: 'AES-256 加密，分卷打包，双击 .7z 直接预览', anchor: '#compress' }
    ]
  },
  {
    title: '导入与转换',
    icon: '📥',
    color: 'from-accent-mint/20 to-primary-from/15',
    items: [
      { id: 'web-import', name: '网页导入与智能排版（v0.1.10 新增）', desc: '粘贴 URL 自动抓取正文 + 去广告 + 智能排版', anchor: '#web-import' },
      { id: 'pdf-ocr', name: 'PDF OCR 离线处理（v0.1.10 新增）', desc: 'pdfjs + tesseract.js，本地推理 0 上传', anchor: '#pdf-ocr' },
      { id: 'excel', name: 'Excel / WPS 表格导入（v0.1.16 新增）', desc: '支持 .xls / .xlsx，解析为表格块', anchor: '#excel' },
      { id: 'md-sync', name: 'Markdown 双向同步', desc: '编辑器和源码同步，写一次两边都对', anchor: '#md-sync' },
      { id: 'jcode', name: 'jcode 高性能 AI 引擎（v0.1.10 新增）', desc: 'Rust 内核加速，本地推理比纯 JS 快 5-10x', anchor: '#jcode' }
    ]
  },
  {
    title: '开发者参考',
    icon: '🧪',
    color: 'from-primary-from/15 to-accent-mint/15',
    items: [
      { id: 'ipc', name: '本地 API 与 IPC', desc: '主进程 / 渲染进程通信协议一览', anchor: '#ipc' },
      { id: 'plugins', name: '扩展插件开发', desc: '自定义 Skill · 自定义指令 · 自定义导出格式', anchor: '#plugins' },
      { id: 'cli', name: '命令行工具', desc: '脚本化批量导出 / 测试 / 部署', anchor: '#cli' }
    ]
  }
]

// 关键词过滤
const keyword = ref('')
const filtered = computed(() => {
  if (!keyword.value.trim()) return sections
  const k = keyword.value.toLowerCase()
  return sections
    .map((s) => ({ ...s, items: s.items.filter((i) => i.name.toLowerCase().includes(k) || i.desc.toLowerCase().includes(k)) }))
    .filter((s) => s.items.length > 0)
})

const totalTopics = computed(() => sections.reduce((a, s) => a + s.items.length, 0))

const quickStarts = [
  {
    title: '快速上手',
    icon: '🚀',
    desc: '10 分钟内创建你的第一个 WPX 文档',
    points: ['安装与首次启动', '创建/打开/保存文档', '基础快捷键速查', '切换界面语言'],
    accent: 'from-primary-from/15 to-primary-to/10'
  },
  {
    title: '核心功能',
    icon: '🧩',
    desc: '把多窗口、虚拟纸张、Skills 用到极致',
    points: ['多窗口独立编辑', '虚拟纸张与分页', 'Skills 启用与提示词', '图片编辑器（去背景）'],
    accent: 'from-accent-mint/20 to-primary-from/10'
  },
  {
    title: '进阶技巧',
    icon: '🛠️',
    desc: '把 WPX 改造成最懂你的工作台',
    points: ['自定义 Skill 提示词', '字体管理（导入 / 商用）', '本地指令 64 条', '命令行与脚本化导出'],
    accent: 'from-accent-yellow/20 to-accent-mint/15'
  }
]
</script>

<template>
  <section class="wpx-section pt-32">
    <div class="wpx-container">
      <!-- Hero -->
      <div class="mx-auto max-w-3xl text-center">
        <span class="wpx-chip">文档</span>
        <h1 class="mt-4 text-2xl font-extrabold sm:text-3xl md:text-4xl lg:text-5xl">
          <span class="wpx-gradient-text">从这里开始你的 WPX 之旅</span>
        </h1>
        <p class="mt-4 text-dark/60">
          6 大类共 {{ totalTopics }} 主题 · 全随 v0.1.18 同步
        </p>

        <!-- 关键词过滤 -->
        <div class="mx-auto mt-6 max-w-md">
          <label class="relative block">
            <span class="sr-only">关键词搜索</span>
            <input
              v-model="keyword"
              type="search"
              placeholder="🔍 检索：HTML 源码 · OCR · 大模型 · 本地指令 …"
              class="w-full rounded-full border border-dark/10 bg-white px-5 py-2.5 text-sm shadow-sm transition-all focus:border-primary-from/50 focus:outline-none focus:ring-4 focus:ring-wpx-gradient-soft"
            />
          </label>
        </div>
      </div>

      <!-- Quick Start Cards -->
      <div class="mt-16 grid gap-6 md:grid-cols-3">
        <article
          v-for="card in quickStarts"
          :key="card.title"
          class="group relative overflow-hidden rounded-2xl border border-dark/5 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-wpx"
        >
          <div
            class="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r"
            :class="card.accent"
          />
          <div
            class="flex h-12 w-12 items-center justify-center rounded-xl bg-wpx-gradient-soft text-2xl"
          >
            {{ card.icon }}
          </div>
          <h2 class="mt-4 text-xl font-extrabold">
            <span class="wpx-gradient-text">{{ card.title }}</span>
          </h2>
          <p class="mt-2 text-sm text-dark/60">
            {{ card.desc }}
          </p>
          <ul class="mt-4 space-y-2">
            <li
              v-for="p in card.points"
              :key="p"
              class="flex items-center gap-2 text-sm text-dark/75"
            >
              <span
                class="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-wpx-gradient"
              />
              {{ p }}
            </li>
          </ul>
        </article>
      </div>

      <!-- TOC Sections -->
      <div class="mt-20">
        <h2 class="text-2xl font-extrabold md:text-3xl">文档章节索引</h2>
        <p class="mt-2 text-dark/60">
          已覆盖 markdown / 多窗口 / Skills / 本地指令 / OCR / 大模型接入 等全部桌面端能力。
        </p>

        <div v-if="filtered.length === 0" class="mt-10 rounded-2xl border border-dashed border-dark/10 bg-white p-10 text-center text-dark/40">
          没找到匹配「{{ keyword }}」的文档。可以试试：HTML、OCR、64、演示文稿。
        </div>

        <div v-else class="mt-10 grid gap-6 md:grid-cols-2">
          <div
            v-for="s in filtered"
            :key="s.title"
            class="rounded-2xl border border-dark/5 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-wpx"
          >
            <h3 class="flex items-center gap-2 text-lg font-bold">
              <span class="text-2xl">{{ s.icon }}</span>
              {{ s.title }}
              <span
                :class="['ml-auto inline-flex items-center rounded-full bg-gradient-to-r px-2.5 py-0.5 text-[10px] font-semibold text-white', s.color]"
              >
                {{ s.items.length }} 项
              </span>
            </h3>
            <ul class="mt-4 grid gap-2 sm:grid-cols-2">
              <li
                v-for="item in s.items"
                :key="item.id"
              >
                <a
                  :href="item.anchor"
                  class="block rounded-lg px-3 py-2 transition-colors hover:bg-wpx-gradient-soft hover:text-primary-600"
                >
                  <div class="text-sm font-medium text-dark/85">
                    {{ item.name }}
                  </div>
                  <div class="mt-0.5 text-[11px] leading-snug text-dark/50">
                    {{ item.desc }}
                  </div>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- ========== 章节详情区（提供每个索引项的真实错点） ========== -->
      <div id="chapter-details" class="mt-20">
        <h2 class="text-2xl font-extrabold md:text-3xl">章节详情</h2>
        <p class="mt-2 max-w-2xl text-dark/60">
          以下是上方 28 个索引项的完整要点速览。点击上方分类卡片 / 全站锄点链接 / 本页内 <code class="font-mono">#项名称</code> 都会滚动到对应位置。
        </p>

        <div class="mt-10 space-y-14">
          <section
            v-for="s in sections"
            :key="s.title"
            class="scroll-mt-24"
          >
            <h3 class="flex items-center gap-2 text-xl font-bold">
              <span class="text-2xl">{{ s.icon }}</span>
              {{ s.title }}
              <span class="ml-auto text-xs font-normal text-dark/40">
                {{ s.items.length }} 项
              </span>
            </h3>

            <div class="mt-5 grid gap-4 md:grid-cols-2">
              <article
                v-for="item in s.items"
                :id="item.id"
                :key="item.id"
                class="detail-card scroll-mt-24 rounded-2xl border border-dark/5 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-wpx"
              >
                <h4 class="text-base font-bold text-dark">
                  {{ item.name }}
                </h4>
                <p class="mt-1 text-xs text-dark/55">
                  {{ item.desc }}
                </p>

                <!-- 要点速览 -->
                <ul
                  v-if="sectionDetails[item.id]?.bullets?.length"
                  class="mt-3 space-y-1.5 text-sm text-dark/75"
                >
                  <li
                    v-for="(b, bi) in sectionDetails[item.id].bullets"
                    :key="bi"
                    class="flex items-start gap-2 leading-relaxed"
                  >
                    <span
                      aria-hidden="true"
                      class="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary-from"
                    />
                    <span>{{ b }}</span>
                  </li>
                </ul>

                <!-- 指令示例 -->
                <div
                  v-if="sectionDetails[item.id]?.command"
                  class="mt-3 flex flex-wrap items-center gap-1.5 text-xs"
                >
                  <span class="font-semibold text-dark/50">本地指令：</span>
                  <code
                    v-for="cmd in sectionDetails[item.id].command.split(' · ')"
                    :key="cmd"
                    class="rounded bg-wpx-gradient-soft px-1.5 py-0.5 font-mono text-primary-600"
                  >{{ cmd }}</code>
                </div>

                <!-- 小贴士 -->
                <div
                  v-if="sectionDetails[item.id]?.tips?.length"
                  class="mt-3 rounded-lg bg-wpx-gradient-soft/60 p-2.5 text-xs text-dark/70"
                >
                  <div
                    v-for="(t, ti) in sectionDetails[item.id].tips"
                    :key="ti"
                    class="flex items-start gap-1.5"
                  >
                    <span aria-hidden="true" class="shrink-0">💡</span>
                    <span>{{ t }}</span>
                  </div>
                </div>

                <!-- 返回索引 -->
                <div class="mt-3 flex items-center justify-between text-[11px] text-dark/40">
                  <span>项 ID：<code class="font-mono">{{ item.id }}</code></span>
                  <a
                    href="#chapter-details"
                    class="text-primary-600 transition-colors hover:underline"
                  >↑ 返回索引</a>
                </div>
              </article>
            </div>
          </section>
        </div>
      </div>

      <!-- Bottom CTA -->
      <div
        class="mt-20 rounded-3xl bg-wpx-gradient-soft p-10 text-center"
      >
        <h2 class="text-2xl font-extrabold md:text-3xl">
          <span class="wpx-gradient-text">文档与社区一起生长</span>
        </h2>
        <p class="mx-auto mt-3 max-w-xl text-dark/70">
          如果你发现文档有遗漏或错误，欢迎提交 PR；
          如果你有使用上的疑问，可以先到 GitHub Discussions 搜搜看。
        </p>
        <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://github.com/MatuX-ai/WPX/wiki"
            target="_blank"
            rel="noopener noreferrer"
            class="wpx-btn-primary"
          >
            前往 GitHub Wiki
          </a>
          <a
            href="https://github.com/MatuX-ai/WPX/discussions"
            target="_blank"
            rel="noopener noreferrer"
            class="wpx-btn-ghost"
          >
            加入社区讨论
          </a>
        </div>
      </div>
    </div>
  </section>
</template>