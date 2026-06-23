export const EMPTY_MESSAGES = []

export const SIMPLE_USER_ASSISTANT = [
  { id: 'm1', role: 'user', content: '帮我把这段话改得更正式一些。' },
  { id: 'm2', role: 'assistant', content: '好的，已经为您润色。以下是修改后的版本：\n\n尊敬的客户，您好。非常感谢您对本次合作的关注。我们将全力以赴，确保项目按时交付。' },
]

export const RICH_MIXED = [
  {
    id: 'm3',
    role: 'user',
    content: '请总结这篇文章的核心观点。',
  },
  {
    id: 'm4',
    role: 'assistant',
    content: `## 核心观点

1. **组件化**是现代前端的基石
2. **Storybook** 让组件开发、测试、文档一体化
3. **Tiptap** 提供强大的富文本编辑能力

\`\`\`js
// 示例代码
const editor = useEditor({ content: '' })
const { html } = editor.getHTML()
\`\`\`

> 推荐阅读 [Storybook 官方文档](https://storybook.js.org)

### 更多细节
- 每个组件应有独立的状态管理
- 响应式设计需要考虑断点适配`,
  },
  {
    id: 'm5',
    role: 'assistant',
    content: '**加粗示例** *斜体示例* \`行内代码\` 普通文本。',
  },
  {
    id: 'm6',
    role: 'user',
    content: '很好，继续完善。',
  },
]
