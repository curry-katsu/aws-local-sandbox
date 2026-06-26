import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ConnectionSettingsDialog from '../ConnectionSettingsDialog.vue'

const settings = {
  endpoint: 'http://localhost:4566',
  debugBaseUrl: 'http://localhost:5180/debug',
  region: 'us-east-1',
}

function mountDialog() {
  return mount(ConnectionSettingsDialog, {
    attachTo: document.body,
    props: {
      modelValue: true,
      settings,
    },
    global: {
      stubs: {
        VDialog: {
          props: ['modelValue'],
          template: '<div><slot /></div>',
        },
      },
    },
  })
}

describe('ConnectionSettingsDialog', () => {
  it('renders the current connection settings', () => {
    const wrapper = mountDialog()
    expect(wrapper.text()).toContain('Connection settings')
    expect(wrapper.find('input[placeholder="http://localhost:4566"]').element.value).toBe(
      settings.endpoint,
    )
  })

  it('emits validated settings when saved', async () => {
    const wrapper = mountDialog()
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('http://localhost:14566')
    await inputs[1].setValue('http://localhost:15180/debug')
    await inputs[2].setValue('ap-northeast-1')

    await wrapper.findAll('button').at(-1).trigger('click')

    expect(wrapper.emitted('save')?.[0]).toEqual([
      {
        endpoint: 'http://localhost:14566',
        debugBaseUrl: 'http://localhost:15180/debug',
        region: 'ap-northeast-1',
      },
    ])
  })

  it('does not save invalid endpoint values', async () => {
    const wrapper = mountDialog()
    await wrapper.findAll('input')[0].setValue('localhost:4566')
    await wrapper.findAll('button').at(-1).trigger('click')

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.text()).toContain('Use an HTTP or HTTPS URL')
  })

  it('emits reset when reset defaults is clicked', async () => {
    const wrapper = mountDialog()
    await wrapper.findAll('button')[0].trigger('click')
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })
})
