import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ArchivePreview from '../ArchivePreview.vue'
import { useZipStore } from '@/stores/zip'

vi.mock('vue3-draggable-resizable', () => ({
  default: {
    name: 'Vue3DraggableResizable',
    template: '<div class="draggable-stub"><slot /></div>',
  },
  DraggableContainer: {
    name: 'DraggableContainer',
    template: '<div class="draggable-container-stub"><slot /></div>',
  },
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

import { pickExtractDirectory } from '@/utils/zipApi'

vi.mock('@/utils/zipApi', () => ({
  zipFeatureAvailable: () => true,
  isPasswordRelatedError: () => false,
  pickExtractDirectory: vi.fn(),
}))

describe('ArchivePreview.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('9. 压缩包预览窗口应正确显示文件列表', async () => {
    const zipStore = useZipStore()
    vi.spyOn(zipStore, 'loadArchiveEntries').mockResolvedValue([
      {
        name: 'docs/readme.txt',
        size: 128,
        compressedSize: 64,
        date: '2024-05-01 10:00:00',
        isDirectory: false,
      },
      {
        name: 'assets/logo.png',
        size: 4096,
        compressedSize: 2048,
        date: '2024-05-01 10:01:00',
        isDirectory: false,
      },
      {
        name: 'assets/',
        size: 0,
        compressedSize: 0,
        date: '2024-05-01 10:01:00',
        isDirectory: true,
      },
    ])

    const wrapper = mount(ArchivePreview, {
      props: {
        visible: true,
        archivePath: 'C:\\demo\\preview.zip',
        stackIndex: 0,
      },
      global: {
        stubs: {
          PasswordDialog: true,
          Teleport: true,
        },
      },
    })

    await flushPromises()

    expect(zipStore.loadArchiveEntries).toHaveBeenCalledWith('C:\\demo\\preview.zip', undefined)
    expect(wrapper.text()).toContain('readme.txt')
    expect(wrapper.text()).toContain('logo.png')
    expect(wrapper.findAll('tbody tr').length).toBe(3)
  })

  it('10. 选择性解压应仅提交勾选文件', async () => {
    pickExtractDirectory.mockResolvedValue({
      ok: true,
      directoryPath: 'C:\\demo\\output',
    })

    const zipStore = useZipStore()
    vi.spyOn(zipStore, 'loadArchiveEntries').mockResolvedValue([
      {
        name: 'alpha.txt',
        size: 10,
        compressedSize: 8,
        date: '2024-05-01 10:00:00',
        isDirectory: false,
      },
      {
        name: 'beta.txt',
        size: 20,
        compressedSize: 12,
        date: '2024-05-01 10:00:00',
        isDirectory: false,
      },
    ])

    const runExtractSpy = vi.spyOn(zipStore, 'runExtract').mockResolvedValue({ ok: true })

    const wrapper = mount(ArchivePreview, {
      props: {
        visible: true,
        archivePath: 'C:\\demo\\selective.zip',
      },
      global: {
        stubs: {
          PasswordDialog: true,
          Teleport: true,
        },
      },
    })

    await flushPromises()

    const rowCheckboxes = wrapper.findAll('tbody input[type="checkbox"]')
    expect(rowCheckboxes.length).toBe(2)

    await rowCheckboxes[1].setValue(false)

    const extractButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('解压所选'))

    expect(extractButton).toBeTruthy()
    await extractButton.trigger('click')
    await flushPromises()

    expect(runExtractSpy).toHaveBeenCalled()
    const payload = runExtractSpy.mock.calls[0][0]
    expect(payload.files).toEqual(['alpha.txt'])
    expect(payload.outputDir).toBe('C:\\demo\\output')
  })
})
