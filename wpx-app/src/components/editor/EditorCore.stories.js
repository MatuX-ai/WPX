import EditorCore from './EditorCore.vue'
import {
  EMPTY_DOC,
  RICH_DOC,
  TABLE_DOC,
  IMAGE_DOC,
} from '@/storybook/fixtures/editor-content'

export default {
  title: 'Editor/EditorCore',
  component: EditorCore,
  argTypes: {
    content: { control: 'object' },
    placeholder: { control: 'text' },
  },
  args: {
    content: null,
    placeholder: '开始写作，支持 Markdown 快捷键（如 # 标题、**加粗**）…',
  },
  parameters: {
    layout: 'fullscreen',
  },
  // Wrapper for editor sizing
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div style="width:900px;margin:24px auto;font-family:Inter,system-ui,sans-serif"><story /></div>',
    }),
  ],
}

export const Empty = {
  args: {
    content: EMPTY_DOC,
  },
}

export const WithRichContent = {
  args: {
    content: RICH_DOC,
  },
}

export const WithSelection = {
  args: {
    content: RICH_DOC,
  },
  parameters: {
    selection: {
      text: 'Storybook',
      from: 30,
      to: 39,
      hasSelection: true,
    },
  },
}

export const WithTable = {
  args: {
    content: TABLE_DOC,
  },
}

export const WithImage = {
  args: {
    content: IMAGE_DOC,
  },
}

export const WithPlaceholder = {
  args: {
    content: EMPTY_DOC,
    placeholder: '请输入您的想法……',
  },
}
