import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProgressBar from '../ProgressBar.vue'
import { useZipStore } from '@/stores/zip'

describe('ProgressBar.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('7. 大文件压缩进度更新时，进度条百分比应同步显示', async () => {
    const zipStore = useZipStore()
    zipStore.operations = [
      {
        operationId: 'op-large',
        label: '正在压缩大文件…',
        type: 'compress',
        percent: 12,
        currentFile: 'I:\\data\\large.bin',
        status: 'running',
        error: '',
      },
    ]

    const wrapper = mount(ProgressBar)
    expect(wrapper.get('.zip-progress__percent').text()).toBe('12%')
    expect(wrapper.get('.zip-progress__fill').attributes('style')).toContain('width: 12%')

    zipStore.operations[0].percent = 67
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.zip-progress__percent').text()).toBe('67%')
    expect(wrapper.get('.zip-progress__fill').attributes('style')).toContain('width: 67%')
  })

  it('8. 取消后应显示“压缩已取消”状态', async () => {
    const zipStore = useZipStore()
    zipStore.operations = [
      {
        operationId: 'op-cancel',
        label: '正在压缩…',
        type: 'compress',
        percent: 35,
        currentFile: '',
        status: 'cancelled',
        error: '',
      },
    ]

    const wrapper = mount(ProgressBar)
    expect(wrapper.get('.zip-progress__title').text()).toBe('压缩已取消')
    expect(wrapper.text()).toContain('操作已取消')
  })
})
