import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ExtractConflictDialog from '../ExtractConflictDialog.vue'

function mountConflictDialog(props = {}) {
  return mount(ExtractConflictDialog, {
    props: {
      visible: true,
      fileName: 'conflict.txt',
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

describe('ExtractConflictDialog.vue', () => {
  it('5. 选择覆盖并确认，应 emit overwrite', async () => {
    const wrapper = mountConflictDialog()

    const overwriteLabel = wrapper
      .findAll('.extract-conflict-dialog__option')
      .find((option) => option.text().includes('覆盖'))

    expect(overwriteLabel).toBeTruthy()
    await overwriteLabel.find('input[type="radio"]').setValue(true)
    await wrapper.get('button.extract-conflict-dialog__btn--primary').trigger('click')

    expect(wrapper.emitted('resolve')).toEqual([['overwrite']])
    wrapper.unmount()
  })

  it('6. 选择跳过并确认，应 emit skip', async () => {
    const wrapper = mountConflictDialog()

    const skipLabel = wrapper
      .findAll('.extract-conflict-dialog__option')
      .find((option) => option.text().includes('跳过'))

    expect(skipLabel).toBeTruthy()
    await skipLabel.find('input[type="radio"]').setValue(true)
    await wrapper.get('button.extract-conflict-dialog__btn--primary').trigger('click')

    expect(wrapper.emitted('resolve')).toEqual([['skip']])
    wrapper.unmount()
  })
})
