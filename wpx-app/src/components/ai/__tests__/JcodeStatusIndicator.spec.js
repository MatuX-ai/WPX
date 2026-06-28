import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import JcodeStatusIndicator from '@/components/ai/JcodeStatusIndicator.vue'

describe('JcodeStatusIndicator — 状态颜色映射', () => {
  beforeEach(() => {
    // noop
  })

  it('未安装时不渲染圆点', () => {
    const wrapper = mount(JcodeStatusIndicator, {
      props: { status: { installed: false, state: 'stopped' } },
    })
    expect(wrapper.find('.jcode-status-dot').exists()).toBe(false)
  })

  it('installed=true 但 state 缺失时回落为 stopped 颜色', () => {
    const wrapper = mount(JcodeStatusIndicator, {
      props: { status: { installed: true } },
    })
    const dot = wrapper.find('.jcode-status-dot')
    expect(dot.exists()).toBe(true)
    expect(dot.classes()).toContain('jcode-status-dot--stopped')
  })

  it('state=starting 显示蓝色脉动样式', () => {
    const wrapper = mount(JcodeStatusIndicator, {
      props: { status: { installed: true, state: 'starting' } },
    })
    const dot = wrapper.find('.jcode-status-dot')
    expect(dot.classes()).toContain('jcode-status-dot--starting')
    expect(wrapper.attributes('title')).toContain('启动中')
  })

  it('state=running 显示绿色样式 + 版本 tooltip', () => {
    const wrapper = mount(JcodeStatusIndicator, {
      props: { status: { installed: true, state: 'running', version: '0.9.2' } },
    })
    const dot = wrapper.find('.jcode-status-dot')
    expect(dot.classes()).toContain('jcode-status-dot--running')
    expect(wrapper.attributes('title')).toContain('运行中')
    expect(wrapper.attributes('title')).toContain('0.9.2')
  })

  it('state=sleeping 显示黄色样式 + 休眠提示', () => {
    const wrapper = mount(JcodeStatusIndicator, {
      props: { status: { installed: true, state: 'sleeping' } },
    })
    const dot = wrapper.find('.jcode-status-dot')
    expect(dot.classes()).toContain('jcode-status-dot--sleeping')
    expect(wrapper.attributes('title')).toContain('空闲休眠')
  })

  it('state=failed 显示红色样式 + 错误信息', () => {
    const wrapper = mount(JcodeStatusIndicator, {
      props: { status: { installed: true, state: 'failed', lastError: '端口占用' } },
    })
    const dot = wrapper.find('.jcode-status-dot')
    expect(dot.classes()).toContain('jcode-status-dot--failed')
    expect(wrapper.attributes('title')).toContain('端口占用')
  })

  it('state=stopped 显示灰色样式', () => {
    const wrapper = mount(JcodeStatusIndicator, {
      props: { status: { installed: true, state: 'stopped' } },
    })
    const dot = wrapper.find('.jcode-status-dot')
    expect(dot.classes()).toContain('jcode-status-dot--stopped')
    expect(wrapper.attributes('title')).toContain('未运行')
  })

  it('状态值大小写不敏感：主进程大写状态也能正确归类', () => {
    const wrapper = mount(JcodeStatusIndicator, {
      props: { status: { installed: true, state: 'RUNNING', version: '0.9.0' } },
    })
    const dot = wrapper.find('.jcode-status-dot')
    expect(dot.classes()).toContain('jcode-status-dot--running')
    expect(wrapper.attributes('title')).toContain('运行中')
  })

  it('包含 aria-label 与 role=status 供辅助技术读取', () => {
    const wrapper = mount(JcodeStatusIndicator, {
      props: { status: { installed: true, state: 'running' } },
    })
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-label')).toBeTruthy()
  })
})
