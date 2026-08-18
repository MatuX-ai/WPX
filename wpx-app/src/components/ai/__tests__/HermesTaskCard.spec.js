/**
 * HermesTaskCard.spec.js —— HermesTaskCard 组件单元测试（M3-C 新增）
 *
 * 被测：wpx-app/src/components/ai/HermesTaskCard.vue
 * 运行：npm --prefix wpx-app run test -- HermesTaskCard
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import HermesTaskCard from '../HermesTaskCard.vue'

// ══════════════════════════════════════════════════════════════
// 1. Mock clipboard
// ══════════════════════════════════════════════════════════════
const clipboardWriteText = vi.fn()
vi.stubGlobal('navigator', {
  clipboard: {
    writeText: clipboardWriteText,
  },
})

// ══════════════════════════════════════════════════════════════
// 2. Helper
// ══════════════════════════════════════════════════════════════
function mountCard(props = {}) {
  return mount(HermesTaskCard, {
    props: {
      task: '',
      status: 'idle',
      steps: [],
      result: '',
      error: '',
      ...props,
    },
  })
}

// ══════════════════════════════════════════════════════════════
// 3. Tests
// ══════════════════════════════════════════════════════════════

describe('HermesTaskCard — 渲染状态 idle（默认）', () => {
  it('标题显示"+"Hermes 任务"+"', () => {
    const w = mountCard()
    expect(w.find('.hermes-task-card__title').text()).toBe('Hermes 任务')
  })

  it('根元素 class 含 --muted', () => {
    const w = mountCard()
    expect(w.classes()).toContain('hermes-task-card--muted')
  })

  it('无 spinner（running 专属）', () => {
    const w = mountCard()
    expect(w.find('.hermes-task-card__spinner').exists()).toBe(false)
  })

  it('dismiss 按钮存在（非 running 态）', () => {
    const w = mountCard()
    expect(w.find('.hermes-task-card__dismiss').exists()).toBe(true)
  })

  it('无 task 段落、无 steps 列表、无 result pre、无 footer 操作区', () => {
    const w = mountCard()
    expect(w.find('.hermes-task-card__task').exists()).toBe(false)
    expect(w.find('.hermes-task-card__steps').exists()).toBe(false)
    expect(w.find('.hermes-task-card__result').exists()).toBe(false)
    expect(w.find('.hermes-task-card__actions').exists()).toBe(false)
  })
})

describe('HermesTaskCard — 渲染状态 running', () => {
  it('标题显示"+"Hermes 执行中…"+"', () => {
    const w = mountCard({ status: 'running' })
    expect(w.find('.hermes-task-card__title').text()).toBe('Hermes 执行中…')
  })

  it('class 含 --info', () => {
    const w = mountCard({ status: 'running' })
    expect(w.classes()).toContain('hermes-task-card--info')
  })

  it('spinner 存在', () => {
    const w = mountCard({ status: 'running' })
    expect(w.find('.hermes-task-card__spinner').exists()).toBe(true)
  })

  it('dismiss 按钮不存在（running 态禁止关闭）', () => {
    const w = mountCard({ status: 'running' })
    expect(w.find('.hermes-task-card__dismiss').exists()).toBe(false)
  })

  it('无 footer 操作区', () => {
    const w = mountCard({ status: 'running' })
    expect(w.find('.hermes-task-card__actions').exists()).toBe(false)
  })
})

describe('HermesTaskCard — 渲染状态 done', () => {
  it('标题显示"+"Hermes 完成"+"', () => {
    const w = mountCard({ status: 'done', result: '结论：选 A' })
    expect(w.find('.hermes-task-card__title').text()).toBe('Hermes 完成')
  })

  it('class 含 --ok', () => {
    const w = mountCard({ status: 'done' })
    expect(w.classes()).toContain('hermes-task-card--ok')
  })

  it('result pre 元素显示内容', () => {
    const w = mountCard({ status: 'done', result: '结论：选 A' })
    const pre = w.find('.hermes-task-card__result')
    expect(pre.exists()).toBe(true)
    expect(pre.text()).toBe('结论：选 A')
  })

  it('footer 操作区存在，含"复制结果"+"插入文档"两个按钮', () => {
    const w = mountCard({ status: 'done', result: '内容' })
    const footer = w.find('.hermes-task-card__actions')
    expect(footer.exists()).toBe(true)
    const btns = footer.findAll('button')
    expect(btns).toHaveLength(2)
    expect(btns[0].text()).toBe('复制结果')
    expect(btns[1].text()).toBe('插入文档')
  })

  it('dismiss 按钮存在', () => {
    const w = mountCard({ status: 'done' })
    expect(w.find('.hermes-task-card__dismiss').exists()).toBe(true)
  })
})

describe('HermesTaskCard — 渲染状态 error', () => {
  it('标题显示"+"Hermes 失败"+"', () => {
    const w = mountCard({ status: 'error', error: '网关不可用' })
    expect(w.find('.hermes-task-card__title').text()).toBe('Hermes 失败')
  })

  it('class 含 --error', () => {
    const w = mountCard({ status: 'error' })
    expect(w.classes()).toContain('hermes-task-card--error')
  })

  it('error 段落显示错误文本', () => {
    const w = mountCard({ status: 'error', error: '网关不可用' })
    expect(w.find('.hermes-task-card__error').text()).toBe('网关不可用')
  })

  it('无 result pre（error 态不显示结果）', () => {
    const w = mountCard({ status: 'error', error: 'x', result: '不应显示' })
    expect(w.find('.hermes-task-card__result').exists()).toBe(false)
  })

  it('无 footer 操作区', () => {
    const w = mountCard({ status: 'error', error: 'x' })
    expect(w.find('.hermes-task-card__actions').exists()).toBe(false)
  })

  it('dismiss 按钮存在', () => {
    const w = mountCard({ status: 'error', error: 'x' })
    expect(w.find('.hermes-task-card__dismiss').exists()).toBe(true)
  })
})

describe('HermesTaskCard — task 原文渲染', () => {
  it('task prop 显示为「」包裹的文本', () => {
    const w = mountCard({ task: '调研三款方案' })
    expect(w.find('.hermes-task-card__task').text()).toBe('「调研三款方案」')
  })

  it('task 为空时不渲染 task 段落', () => {
    const w = mountCard({ task: '' })
    expect(w.find('.hermes-task-card__task').exists()).toBe(false)
  })
})

describe('HermesTaskCard — steps 有序列表', () => {
  it('steps 数组按序渲染为 ol>li', () => {
    const steps = ['连接网关', '执行中', '完成']
    const w = mountCard({ status: 'running', steps })
    const ol = w.find('.hermes-task-card__steps')
    expect(ol.exists()).toBe(true)
    const lis = ol.findAll('li')
    expect(lis).toHaveLength(3)
    expect(lis[0].text()).toBe('连接网关')
    expect(lis[1].text()).toBe('执行中')
    expect(lis[2].text()).toBe('完成')
  })

  it('steps 为空数组时不渲染 ol', () => {
    const w = mountCard({ steps: [] })
    expect(w.find('.hermes-task-card__steps').exists()).toBe(false)
  })
})

describe('HermesTaskCard — 交互：复制结果', () => {
  beforeEach(() => clipboardWriteText.mockClear())

  it('done 态点击"复制结果"调用 clipboard.writeText(result)', async () => {
    const w = mountCard({ status: 'done', result: '结论：选 A' })
    await w.find('.hermes-task-card__actions button').trigger('click')
    expect(clipboardWriteText).toHaveBeenCalledWith('结论：选 A')
  })

  it('error 态点击"复制结果"回退到 error 文本', async () => {
    // handleCopy: text = result || error || task
    // 当 result='' 时回退到 error
    const w = mountCard({ status: 'error', error: '失败原因', result: '' })
    const copyBtn = w.findAll('.hermes-task-card__btn').at(0)
    await copyBtn.trigger('click')
    expect(clipboardWriteText).toHaveBeenCalledWith('失败原因')
  })

  it('三者皆空时 copy 不被调用', async () => {
    const w = mountCard({ status: 'done', result: '', error: '', task: '' })
    const copyBtn = w.findAll('.hermes-task-card__btn').at(0)
    await copyBtn.trigger('click')
    expect(clipboardWriteText).not.toHaveBeenCalled()
  })

  it('clipboard 不存在时不抛错', async () => {
    vi.stubGlobal('navigator', { clipboard: undefined })
    const w = mountCard({ status: 'done', result: '内容' })
    const copyBtn = w.findAll('.hermes-task-card__btn').at(0)
    await expect(copyBtn.trigger('click')).resolves.not.toThrow()
  })
})

describe('HermesTaskCard — 交互：插入文档', () => {
  it('done 态点击"插入文档" emit("insert", result)', async () => {
    const w = mountCard({ status: 'done', result: '结论：选 A' })
    const insertBtn = w.findAll('.hermes-task-card__btn').at(1)
    await insertBtn.trigger('click')
    expect(w.emitted('insert')).toHaveLength(1)
    expect(w.emitted('insert')[0]).toEqual(['结论：选 A'])
  })

  it('result 为空时不 emit("insert")', async () => {
    const w = mountCard({ status: 'done', result: '' })
    const insertBtn = w.findAll('.hermes-task-card__btn').at(1)
    await insertBtn.trigger('click')
    expect(w.emitted('insert')).toBeUndefined()
  })
})

describe('HermesTaskCard — 交互：dismiss', () => {
  it('idle 态点击 dismiss emit("dismiss")', async () => {
    const w = mountCard({ status: 'idle' })
    await w.find('.hermes-task-card__dismiss').trigger('click')
    expect(w.emitted('dismiss')).toHaveLength(1)
  })

  it('done 态点击 dismiss emit("dismiss")', async () => {
    const w = mountCard({ status: 'done', result: 'x' })
    await w.find('.hermes-task-card__dismiss').trigger('click')
    expect(w.emitted('dismiss')).toHaveLength(1)
  })

  it('error 态点击 dismiss emit("dismiss")', async () => {
    const w = mountCard({ status: 'error', error: 'x' })
    await w.find('.hermes-task-card__dismiss').trigger('click')
    expect(w.emitted('dismiss')).toHaveLength(1)
  })

  it('running 态无 dismiss 按钮（不测试点击）', () => {
    const w = mountCard({ status: 'running' })
    expect(w.find('.hermes-task-card__dismiss').exists()).toBe(false)
  })
})

describe('HermesTaskCard — 无障碍属性', () => {
  it('根元素 role="status"', () => {
    const w = mountCard()
    expect(w.attributes('role')).toBe('status')
  })

  it('spinner 有 aria-hidden="true"', () => {
    const w = mountCard({ status: 'running' })
    expect(w.find('.hermes-task-card__spinner').attributes('aria-hidden')).toBe('true')
  })

  it('dot 有 aria-hidden="true"', () => {
    const w = mountCard()
    expect(w.find('.hermes-task-card__dot').attributes('aria-hidden')).toBe('true')
  })

  it('dismiss 按钮 aria-label="关闭"', () => {
    const w = mountCard()
    expect(w.find('.hermes-task-card__dismiss').attributes('aria-label')).toBe('关闭')
  })
})

describe('HermesTaskCard — props 响应式更新', () => {
  it('status 从 running → done → error 同步更新 class 和内容', async () => {
    const w = mountCard({ status: 'running' })
    expect(w.classes()).toContain('hermes-task-card--info')

    await w.setProps({ status: 'done', result: '结果文本' })
    expect(w.classes()).toContain('hermes-task-card--ok')
    expect(w.find('.hermes-task-card__result').text()).toBe('结果文本')
    expect(w.find('.hermes-task-card__actions').exists()).toBe(true)

    await w.setProps({ status: 'error', error: '错误' })
    expect(w.classes()).toContain('hermes-task-card--error')
    expect(w.find('.hermes-task-card__error').text()).toBe('错误')
    expect(w.find('.hermes-task-card__result').exists()).toBe(false)
  })
})
