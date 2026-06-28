好的，以下是 WPX AI 本地指令系统的完整需求文档。

---

# WPX AI 本地指令系统需求文档

**版本**：V1.1（已实现）
**状态**：已实现 · LocalCommandMessage + useLocalCommands 已全面就绪
**关联文档**：PRD、AI 助手交互系统、CopilotKit 集成方案、[技术架构总览 V2.0](./WPX%20技术架构总览%20V2.0.md)
**最后更新**：2026-06-28

---

## 1. 概述

为 WPX 的 AI 对话窗增加**本地指令拦截层**。当用户输入的是确定性操作（如“删除”、“加粗”、“用思源黑体”）时，直接在前端执行，不调用大模型。这实现了零延迟响应、零 Token 消耗、离线可用。

**核心原则**：
- 本地指令优先于 AI 模型调用
- 匹配失败或条件不满足时，回退到 AI 模型处理
- 指令覆盖所有无需推理的确定性编辑器操作

---

## 2. 两层指令架构

```
用户输入
    ↓
┌──────────────────┐
│ 第一层：本地指令层  │ ← 正则匹配，毫秒级响应
│ (Local Commands)  │    离线可用，零Token消耗
└──────┬───────────┘
       │ 未命中 / 条件不满足
       ↓
┌──────────────────┐
│ 第二层：AI 模型层  │ ← 需要推理的复杂指令
│ (DeepSeek等)      │
└──────────────────┘
```

---

## 3. 为什么必须使用正则表达式

### 3.1 不用正则的问题

本地指令需要匹配用户的自然语言输入，中文表达高度灵活：

- “删除” = “删掉” = “去掉” = “把它删了” = “帮我删除”
- “加粗” = “粗体” = “变粗” = “bold”
- “用思源黑体” = “换成思源黑体” = “字体改成思源黑体”

如果用关键词或字符串相等判断，会出现：
- **误匹配**：“请帮我分析一下为什么要删除重复数据” → 关键词“删除”误触发
- **漏匹配**：“把这几个字变粗一点” → 关键词“加粗”未命中
- **代码膨胀**：需要穷举所有表达方式，`if` 分支爆炸

### 3.2 用正则的优势

| 优势 | 说明 |
|:---|:---|
| **精确匹配意图** | 用 `^删[除掉]?$` 精确匹配纯删除指令，不会误匹配长句中的“删除” |
| **灵活覆盖变体** | 一个正则可覆盖多种口语表达 |
| **性能极高** | 几十个正则遍历匹配仅需微秒级 |
| **易于维护** | 每个指令一个正则，清晰可读 |
| **支持优先级** | 长指令优先匹配，避免短指令抢先 |

### 3.3 正则使用规范

- **边界锚定**：优先使用 `^...$` 锚定，确保精确匹配
- **长指令优先**：先匹配长指令（如“用思源黑体”），再匹配短指令（如“删除”）
- **宽松匹配兜底**：对口语化表达，适当使用可选字符和通配

---

## 4. 完整本地指令清单

### 4.1 指令数据结构

```typescript
interface LocalCommand {
  id: string;                    // 唯一标识
  patterns: RegExp[];            // 匹配正则数组（任一命中即触发）
  condition: (context: CommandContext) => boolean;  // 前置条件检查
  action: (context: CommandContext) => CommandResult;  // 执行操作
  successMessage: string;        // 执行成功后的对话窗提示
  failureMessage: string;        // 条件不满足时的提示
  priority: number;              // 优先级（数字越大越优先匹配）
}
```

### 4.2 完整指令列表

#### 4.2.1 文本操作类

**CMD-001：删除选中文本**
```yaml
id: "delete-selection"
patterns:
  - /^(删除|删掉|去掉|去除|移除|清除)$/
  - /^(把.*删掉|帮.*删掉|请.*删除)$/
  - /^delete$/
condition: "编辑器有选中文本"
action: "删除选中文本，保留光标位置"
successMessage: "✅ 已删除选中文本"
failureMessage: "⚠️ 请先选中要删除的文字"
priority: 100
```

**CMD-002：复制选中文本**
```yaml
id: "copy-selection"
patterns:
  - /^(复制|拷贝)$/
  - /^copy$/
condition: "编辑器有选中文本"
action: "复制选中文本到剪贴板"
successMessage: "✅ 已复制到剪贴板"
failureMessage: "⚠️ 请先选中要复制的文字"
priority: 100
```

**CMD-003：剪切选中文本**
```yaml
id: "cut-selection"
patterns:
  - /^(剪切|剪下)$/
  - /^cut$/
condition: "编辑器有选中文本"
action: "剪切选中文本到剪贴板"
successMessage: "✅ 已剪切到剪贴板"
failureMessage: "⚠️ 请先选中要剪切的文字"
priority: 100
```

**CMD-004：粘贴**
```yaml
id: "paste"
patterns:
  - /^(粘贴|贴上)$/
  - /^paste$/
condition: "剪贴板有文本内容"
action: "在光标位置粘贴剪贴板内容"
successMessage: "✅ 已粘贴"
failureMessage: "⚠️ 剪贴板为空"
priority: 100
```

**CMD-005：全选**
```yaml
id: "select-all"
patterns:
  - /^(全选|选择全部|选中所有)$/
  - /^select\s*all$/
condition: "编辑器有内容"
action: "选中编辑器全部内容"
successMessage: "✅ 已全选"
failureMessage: "⚠️ 文档为空"
priority: 100
```

**CMD-006：撤销**
```yaml
id: "undo"
patterns:
  - /^(撤销|回退|返回上一步|撤回)$/
  - /^undo$/
condition: "有可撤销的历史操作"
action: "撤销上一步操作"
successMessage: "✅ 已撤销"
failureMessage: "⚠️ 没有可撤销的操作"
priority: 100
```

**CMD-007：重做**
```yaml
id: "redo"
patterns:
  - /^(重做|恢复|取消撤销|前进)$/
  - /^redo$/
condition: "有可重做的已撤销操作"
action: "重做已撤销的操作"
successMessage: "✅ 已重做"
failureMessage: "⚠️ 没有可重做的操作"
priority: 100
```

#### 4.2.2 格式操作类

**CMD-008：加粗**
```yaml
id: "bold"
patterns:
  - /^(加粗|粗体|变粗|bold)$/
  - /^(把.*加粗|帮.*加粗)$/
condition: "编辑器有选中文本"
action: "切换选中文本的加粗状态"
successMessage: "✅ 已切换加粗"
failureMessage: "⚠️ 请先选中文字"
priority: 100
```

**CMD-009：斜体**
```yaml
id: "italic"
patterns:
  - /^(斜体|倾斜|变斜|italic)$/
  - /^(把.*变斜|帮.*变斜)$/
condition: "编辑器有选中文本"
action: "切换选中文本的斜体状态"
successMessage: "✅ 已切换斜体"
failureMessage: "⚠️ 请先选中文字"
priority: 100
```

**CMD-010：下划线**
```yaml
id: "underline"
patterns:
  - /^(下划线|加下划线|underline)$/
condition: "编辑器有选中文本"
action: "切换选中文本的下划线状态"
successMessage: "✅ 已切换下划线"
failureMessage: "⚠️ 请先选中文字"
priority: 100
```

**CMD-011：删除线**
```yaml
id: "strikethrough"
patterns:
  - /^(删除线|删划线|strikethrough)$/
condition: "编辑器有选中文本"
action: "切换选中文本的删除线状态"
successMessage: "✅ 已切换删除线"
failureMessage: "⚠️ 请先选中文字"
priority: 90
```

**CMD-012：上标**
```yaml
id: "superscript"
patterns:
  - /^(上标|superscript)$/
condition: "编辑器有选中文本"
action: "将选中文本设置为上标"
successMessage: "✅ 已设置为上标"
failureMessage: "⚠️ 请先选中文字"
priority: 90
```

**CMD-013：下标**
```yaml
id: "subscript"
patterns:
  - /^(下标|subscript)$/
condition: "编辑器有选中文本"
action: "将选中文本设置为下标"
successMessage: "✅ 已设置为下标"
failureMessage: "⚠️ 请先选中文字"
priority: 90
```

**CMD-014：字号增大**
```yaml
id: "font-size-up"
patterns:
  - /^(字号.*大|放大|变大|增大字号|加大字号)$/
  - /^(bigger|larger)$/
condition: "编辑器有选中文本"
action: "选中文本字号 +2"
successMessage: "✅ 字号已增大"
failureMessage: "⚠️ 请先选中文字"
priority: 90
```

**CMD-015：字号减小**
```yaml
id: "font-size-down"
patterns:
  - /^(字号.*小|缩小|变小|减小字号)$/
  - /^(smaller)$/
condition: "编辑器有选中文本"
action: "选中文本字号 -2"
successMessage: "✅ 字号已减小"
failureMessage: "⚠️ 请先选中文字"
priority: 90
```

**CMD-016：清除格式**
```yaml
id: "clear-format"
patterns:
  - /^(清除格式|去掉格式|移除格式|清除样式)$/
  - /^clear\s*format$/
condition: "编辑器有选中文本"
action: "清除选中文本的所有格式，恢复为纯文本"
successMessage: "✅ 格式已清除"
failureMessage: "⚠️ 请先选中文字"
priority: 90
```

#### 4.2.3 字体切换类

**CMD-017 ~ CMD-026：切换字体**
```yaml
id: "font-{字体ID}"
patterns:
  - "用思源黑体":  /^(用|使用|换成|切换[为到]?)思源黑体$/
  - "用思源宋体":  /^(用|使用|换成|切换[为到]?)思源宋体$/
  - "用霞鹜文楷":  /^(用|使用|换成|切换[为到]?)霞鹜文楷$/
  - "用阿里巴巴普惠体": /^(用|使用|换成|切换[为到]?)阿里巴巴普惠体$/
  - "用HarmonyOS Sans": /^(用|使用|换成|切换[为到]?)HarmonyOS\s*Sans$/
  - "用JetBrains Mono": /^(用|使用|换成|切换[为到]?)JetBrains\s*Mono$/
  - "用黑体":      /^(用|使用|换成|切换[为到]?)黑体$/
  - "用宋体":      /^(用|使用|换成|切换[为到]?)宋体$/
  - "用楷体":      /^(用|使用|换成|切换[为到]?)楷体$/
  - "用默认字体":   /^(用|使用|换成|切换[为到]?)默认字体$/
condition: "编辑器有选中文本 或 光标在文本中"
action: "将选中文本（或光标所在段落）切换为指定字体"
successMessage: "✅ 已切换为{字体名称}"
failureMessage: "⚠️ 请先选中文字或点击到文字中"
priority: 95
```

#### 4.2.4 对齐操作类

**CMD-027：左对齐**
```yaml
id: "align-left"
patterns:
  - /^(左对齐|靠左|左排)$/
  - /^align\s*left$/
condition: "光标在段落中"
action: "设置当前段落为左对齐"
successMessage: "✅ 已左对齐"
failureMessage: "⚠️ 请先点击到段落中"
priority: 90
```

**CMD-028：居中对齐**
```yaml
id: "align-center"
patterns:
  - /^(居中|居中对齐|中对齐)$/
  - /^align\s*center$/
condition: "光标在段落中"
action: "设置当前段落为居中对齐"
successMessage: "✅ 已居中对齐"
failureMessage: "⚠️ 请先点击到段落中"
priority: 90
```

**CMD-029：右对齐**
```yaml
id: "align-right"
patterns:
  - /^(右对齐|靠右|右排)$/
  - /^align\s*right$/
condition: "光标在段落中"
action: "设置当前段落为右对齐"
successMessage: "✅ 已右对齐"
failureMessage: "⚠️ 请先点击到段落中"
priority: 90
```

**CMD-030：两端对齐**
```yaml
id: "align-justify"
patterns:
  - /^(两端对齐|左右对齐|分散对齐|justify)$/
condition: "光标在段落中"
action: "设置当前段落为两端对齐"
successMessage: "✅ 已两端对齐"
failureMessage: "⚠️ 请先点击到段落中"
priority: 90
```

#### 4.2.5 标题与段落类

**CMD-031 ~ CMD-036：设置标题级别**
```yaml
id: "heading-{1-6}"
patterns:
  - "标题1":  /^(设为|设置|变成|改为)?标题[一1]$/
  - "标题2":  /^(设为|设置|变成|改为)?标题[二2]$/
  - "标题3":  /^(设为|设置|变成|改为)?标题[三3]$/
  - "标题4":  /^(设为|设置|变成|改为)?标题[四4]$/
  - "标题5":  /^(设为|设置|变成|改为)?标题[五5]$/
  - "标题6":  /^(设为|设置|变成|改为)?标题[六6]$/
condition: "光标在段落中"
action: "设置当前段落为对应标题级别"
successMessage: "✅ 已设为标题{级别}"
failureMessage: "⚠️ 请先点击到段落中"
priority: 95
```

**CMD-037：设为正文**
```yaml
id: "paragraph"
patterns:
  - /^(设为|设置|变成|改为)?正文$/
  - /^(设为|设置|变成|改为)?普通文本$/
condition: "光标在段落中"
action: "将当前标题恢复为正文段落"
successMessage: "✅ 已设为正文"
failureMessage: "⚠️ 请先点击到段落中"
priority: 90
```

**CMD-038：无序列表**
```yaml
id: "bullet-list"
patterns:
  - /^(无序列表|项目符号|bullet\s*list)$/
condition: "光标在段落中 或 有选中多段落"
action: "将段落转换为无序列表"
successMessage: "✅ 已转为无序列表"
failureMessage: "⚠️ 请先点击到段落中"
priority: 90
```

**CMD-039：有序列表**
```yaml
id: "ordered-list"
patterns:
  - /^(有序列表|编号列表|ordered\s*list)$/
condition: "光标在段落中 或 有选中多段落"
action: "将段落转换为有序列表"
successMessage: "✅ 已转为有序列表"
failureMessage: "⚠️ 请先点击到段落中"
priority: 90
```

**CMD-040：引用块**
```yaml
id: "blockquote"
patterns:
  - /^(引用|块引用|blockquote)$/
condition: "光标在段落中"
action: "将段落转换为引用块"
successMessage: "✅ 已转为引用块"
failureMessage: "⚠️ 请先点击到段落中"
priority: 90
```

**CMD-041：代码块**
```yaml
id: "code-block"
patterns:
  - /^(代码块|代码|code\s*block)$/
condition: "有选中文本 或 光标在段落中"
action: "将选中文本或当前段落转换为代码块"
successMessage: "✅ 已转为代码块"
failureMessage: "⚠️ 请先选中文字"
priority: 90
```

#### 4.2.6 插入操作类

**CMD-042：插入表格**
```yaml
id: "insert-table"
patterns:
  - /^(插入表格|新建表格|添加表格|创建表格)$/
  - /^table$/
condition: "编辑器可用"
action: "在光标位置插入一个 3x3 表格"
successMessage: "✅ 已插入 3×3 表格"
failureMessage: null
priority: 80
```

**CMD-043：插入图片**
```yaml
id: "insert-image"
patterns:
  - /^(插入图片|添加图片|导入图片|上传图片)$/
  - /^image$/
condition: "编辑器可用"
action: "打开系统文件选择器，选择图片插入到光标位置"
successMessage: "✅ 图片已插入"
failureMessage: "⚠️ 未选择图片"
priority: 80
```

**CMD-044：插入分隔线**
```yaml
id: "insert-hr"
patterns:
  - /^(插入分隔线|分割线|水平线|hr)$/
condition: "编辑器可用"
action: "在光标位置插入一条水平分隔线"
successMessage: "✅ 已插入分隔线"
failureMessage: null
priority: 80
```

**CMD-045：插入日期**
```yaml
id: "insert-date"
patterns:
  - /^(插入日期|当前日期|今天日期)$/
condition: "编辑器可用"
action: "在光标位置插入当前日期（YYYY-MM-DD 格式）"
successMessage: "✅ 已插入当前日期"
failureMessage: null
priority: 80
```

**CMD-046：插入时间**
```yaml
id: "insert-time"
patterns:
  - /^(插入时间|当前时间|现在时间)$/
condition: "编辑器可用"
action: "在光标位置插入当前时间（HH:MM 格式）"
successMessage: "✅ 已插入当前时间"
failureMessage: null
priority: 80
```

#### 4.2.7 视图操作类

**CMD-047：切换焦点模式**
```yaml
id: "toggle-focus-mode"
patterns:
  - /^(焦点模式|纸张模式|写作模式|专注模式)$/
  - /^(开启|关闭)(焦点模式|纸张模式)$/
condition: "编辑器可用"
action: "切换焦点写作模式的开关状态"
successMessage: "✅ 焦点模式已{开启/关闭}"
failureMessage: null
priority: 80
```

**CMD-048：切换暗色模式**
```yaml
id: "toggle-dark-mode"
patterns:
  - /^(暗色模式|深色模式|夜间模式|黑暗模式)$/
  - /^(dark\s*mode|night\s*mode)$/
condition: "无"
action: "切换应用主题为暗色/浅色"
successMessage: "✅ 已切换为{暗色/浅色}模式"
failureMessage: null
priority: 80
```

#### 4.2.8 文件操作类

**CMD-049：保存文档**
```yaml
id: "save"
patterns:
  - /^(保存|存盘|save)$/
  - /^(保存文档|保存文件)$/
condition: "文档有未保存修改"
action: "触发保存流程（弹出智能文库保存对话框）"
successMessage: "✅ 文档已保存"
failureMessage: "⚠️ 文档无修改，无需保存"
priority: 100
```

**CMD-050：新建文档**
```yaml
id: "new-document"
patterns:
  - /^(新建|新建文档|新建文件|new)$/
  - /^(创建新文档|开新文件)$/
condition: "无"
action: "新建空白文档（若当前有未保存修改则提示保存）"
successMessage: "✅ 已新建空白文档"
failureMessage: null
priority: 80
```

**CMD-051：导出 PDF**
```yaml
id: "export-pdf"
patterns:
  - /^(导出pdf|导出PDF|输出pdf|存为pdf|转pdf)$/
condition: "文档有内容"
action: "触发 PDF 导出流程"
successMessage: "✅ 正在导出 PDF..."
failureMessage: "⚠️ 文档为空，无法导出"
priority: 80
```

**CMD-052：导出 Word**
```yaml
id: "export-docx"
patterns:
  - /^(导出word|导出Word|输出word|存为word|转word|导出docx)$/
condition: "文档有内容"
action: "触发 Word 导出流程"
successMessage: "✅ 正在导出 Word..."
failureMessage: "⚠️ 文档为空，无法导出"
priority: 80
```

**CMD-053：导出 Markdown**
```yaml
id: "export-md"
patterns:
  - /^(导出markdown|导出md|导出Markdown)$/
condition: "文档有内容"
action: "触发 Markdown 导出下载"
successMessage: "✅ 正在导出 Markdown..."
failureMessage: "⚠️ 文档为空，无法导出"
priority: 80
```

#### 4.2.9 窗口操作类

**CMD-054：打开设置**
```yaml
id: "open-settings"
patterns:
  - /^(设置|打开设置|偏好设置|选项)$/
  - /^(settings|preferences)$/
condition: "无"
action: "打开设置页面"
successMessage: "✅ 已打开设置"
failureMessage: null
priority: 70
```

**CMD-055：打开字体商店**
```yaml
id: "open-font-market"
patterns:
  - /^(字体商店|字体市场|font\s*market)$/
condition: "无"
action: "打开字体商店页面"
successMessage: "✅ 已打开字体商店"
failureMessage: null
priority: 70
```

**CMD-056：打开文库**
```yaml
id: "open-library"
patterns:
  - /^(文库|知识库|打开文库|资料库)$/
condition: "无"
action: "打开智能文库面板"
successMessage: "✅ 已打开文库"
failureMessage: null
priority: 70
```

---

## 5. 指令数量统计

| 分类 | 数量 | 指令 ID 范围 |
|:---|:---|:---|
| 文本操作 | 7 | CMD-001 ~ CMD-007 |
| 格式操作 | 9 | CMD-008 ~ CMD-016 |
| 字体切换 | 10 | CMD-017 ~ CMD-026 |
| 对齐操作 | 4 | CMD-027 ~ CMD-030 |
| 标题与段落 | 11 | CMD-031 ~ CMD-041 |
| 插入操作 | 5 | CMD-042 ~ CMD-046 |
| 视图操作 | 2 | CMD-047 ~ CMD-048 |
| 文件操作 | 5 | CMD-049 ~ CMD-053 |
| 窗口操作 | 3 | CMD-054 ~ CMD-056 |
| **总计** | **56** | |

---

## 6. 交互设计

### 6.1 指令匹配成功

```
┌──────────────────────────────┐
│  用户输入："删除"             │
│                              │
│  ✅ 已删除选中文本            │ ← 绿色，无头像，左对齐
│                              │
│  [输入框继续可用]             │
└──────────────────────────────┘
```

- 回复消息使用特殊样式：绿色文字、`✓` 前缀、无 AI 头像。
- 执行结果即时反馈，不显示“正在输入...”动画。
- 输入框保持可用，用户可继续输入。

### 6.2 指令匹配但条件不满足

```
┌──────────────────────────────┐
│  用户输入："删除"             │
│                              │
│  ⚠️ 请先选中要删除的文字      │ ← 黄色，左对齐
│                              │
│  [输入框继续可用]             │
└──────────────────────────────┘
```

- 回复消息使用警告样式：黄色文字、`⚠️` 前缀。
- 不消耗任何资源，仅做提示。

### 6.3 指令未匹配

```
用户输入 → 本地指令层全部未命中 → 正常发送给 AI 模型
```

- 用户无感知，流程与现有 AI 对话完全一致。

---

## 7. 技术实现

### 7.1 新增文件

| 文件 | 用途 |
|:---|:---|
| `src/data/local-commands.js` | 56 个本地指令的完整定义 |
| `src/composables/useLocalCommands.js` | 本地指令匹配与执行引擎 |
| `src/components/ai/LocalCommandMessage.vue` | 本地指令结果的特殊消息样式 |

### 7.2 核心逻辑

```javascript
// useLocalCommands.js 核心流程
function processUserInput(input, context) {
  // 1. 按优先级排序所有指令
  const sortedCommands = allCommands.sort((a, b) => b.priority - a.priority);
  
  // 2. 逐个匹配
  for (const cmd of sortedCommands) {
    const matched = cmd.patterns.some(p => p.test(input.trim()));
    
    if (matched) {
      // 3. 检查前置条件
      if (cmd.condition(context)) {
        // 4. 执行操作
        const result = cmd.action(context);
        return { type: 'local', success: true, message: cmd.successMessage, result };
      } else {
        // 5. 条件不满足
        return { type: 'local', success: false, message: cmd.failureMessage };
      }
    }
  }
  
  // 6. 未匹配任何本地指令
  return { type: 'ai' };
}
```

### 7.3 集成到现有 AI 对话

修改 `useAiChat.js` 的消息发送逻辑：

```javascript
async function sendMessage(userInput) {
  // 先过本地指令层
  const localResult = processUserInput(userInput, {
    hasSelection: editorHasSelection(),
    clipboardContent: getClipboardContent(),
    cursorInParagraph: cursorInParagraph(),
    // ...其他上下文
  });
  
  if (localResult.type === 'local') {
    // 本地指令处理，直接添加回复消息
    addLocalMessage(localResult);
    return;
  }
  
  // 未匹配，走原有 AI 模型流程
  await sendToAI(userInput);
}
```

---

## 8. 扩展性设计

### 8.1 动态注册

```javascript
// 允许 skillhub 或插件动态注册本地指令
function registerLocalCommand(command) {
  allCommands.push(command);
}
```

### 8.2 用户自定义指令

未来在设置页面中，允许用户自定义快捷指令：

- 用户输入触发词 → 选择要执行的操作 → 保存为个人指令
- 例如：用户定义“改格式”= 清除格式 + 设为思源黑体 + 字号16

---

## 9. 验收标准

1. 输入“删除”（有选中文本），文本被删除，对话窗显示绿色提示。 ✅
2. 输入“删除”（无选中文本），对话窗显示黄色提示“请先选中文字”。 ✅
3. 输入“用思源黑体”（有选中文本），字体切换成功。 ✅
4. 输入“生成一份教案”，本地指令未匹配，正常发送给 AI 模型。 ✅
5. 输入“加粗”后立即输入“斜体”，两个指令依次执行，互不干扰。 ✅
6. 本地指令响应时间 < 50ms（毫秒级）。 ✅
7. 所有 56 个指令在对话窗 placeholder 中有示例引导。 ✅
8. 断网情况下，本地指令正常执行。 ✅

---