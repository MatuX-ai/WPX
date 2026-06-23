import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ExportFontConfirm from '@/components/fonts/ExportFontConfirm.vue'

const sampleFonts = [
  {
    fontId: 'founder-lanting-hei',
    name: '方正兰亭黑',
    charCount: 12,
    tokenCost: 12,
    deduplicated: false,
  },
]

function mountExportFontConfirm(props = {}) {
  return mount(ExportFontConfirm, {
    props: {
      visible: true,
      fonts: sampleFonts,
      totalCost: 12,
      balance: 500,
      sufficient: true,
      shortfall: 0,
      ...props,
    },
    global: {
      stubs: {
        Teleport: true,
      },
    },
    attachTo: document.body,
  })
}

describe('ExportFontConfirm', () => {
  it('4. 展示商业字体字数与 Token 消耗', () => {
    const wrapper = mountExportFontConfirm()

    expect(wrapper.text()).toContain('本次导出包含商业字体')
    expect(wrapper.text()).toContain('方正兰亭黑')
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('总计消耗')
    expect(wrapper.text()).toContain('500')

    wrapper.unmount()
  })

  it('7. 余额不足时确认按钮置灰并显示提示', () => {
    const wrapper = mountExportFontConfirm({
      totalCost: 100,
      balance: 30,
      sufficient: false,
      shortfall: 70,
    })

    const confirmButton = wrapper.get('button.export-font-confirm__btn--primary')
    expect(confirmButton.attributes('disabled')).toBeDefined()
    expect(confirmButton.text()).toBe('余额不足')
    expect(wrapper.text()).toContain('还差 70 Token')

    wrapper.unmount()
  })

  it('访客模式下显示登录引导', () => {
    const wrapper = mountExportFontConfirm({ isGuest: true })

    expect(wrapper.text()).toContain('使用商业字体需要登录并拥有 Token，登录后即可使用')
    expect(wrapper.text()).toContain('登录')
    expect(wrapper.text()).not.toContain('总计消耗')

    wrapper.unmount()
  })
})
