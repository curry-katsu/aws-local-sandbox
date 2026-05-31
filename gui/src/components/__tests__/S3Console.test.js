import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import S3Console from '../S3Console.vue'

vi.mock('../../aws/s3', () => ({
  listBuckets: vi.fn(),
  listObjects: vi.fn(),
  getObjectText: vi.fn(),
  putTextObject: vi.fn(),
  deleteObject: vi.fn(),
}))

import { listBuckets, listObjects } from '../../aws/s3'

// Vuetify is registered globally by src/test-utils/setup.js
function mountComponent(options = {}) {
  return mount(S3Console, {
    attachTo: document.body,
    ...options,
  })
}

describe('S3Console', () => {
  beforeEach(() => {
    vi.mocked(listBuckets).mockReset()
    vi.mocked(listObjects).mockReset()
    vi.mocked(listObjects).mockResolvedValue([])
  })

  it('renders the "S3 buckets" panel heading', async () => {
    vi.mocked(listBuckets).mockResolvedValue([])
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.text()).toContain('S3 buckets')
  })

  it('calls listBuckets once on mount', async () => {
    vi.mocked(listBuckets).mockResolvedValue([])
    mountComponent()
    await flushPromises()
    expect(listBuckets).toHaveBeenCalledOnce()
  })

  it('displays each bucket name in the side panel', async () => {
    vi.mocked(listBuckets).mockResolvedValue([
      { Name: 'bucket-alpha' },
      { Name: 'bucket-beta' },
    ])
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.text()).toContain('bucket-alpha')
    expect(wrapper.text()).toContain('bucket-beta')
  })

  it('shows empty-state prompt when no bucket is selected', async () => {
    vi.mocked(listBuckets).mockResolvedValue([])
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.text()).toContain('Choose an S3 bucket')
  })

  it('shows the error message when listBuckets rejects', async () => {
    vi.mocked(listBuckets).mockRejectedValue(new Error('Connection refused'))
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.text()).toContain('Connection refused')
  })

  it('auto-selects the first bucket and loads its objects', async () => {
    vi.mocked(listBuckets).mockResolvedValue([{ Name: 'first-bucket' }, { Name: 'second-bucket' }])
    vi.mocked(listObjects).mockResolvedValue([{ Key: 'readme.txt', Size: 256 }])
    const wrapper = mountComponent()
    await flushPromises()
    expect(listObjects).toHaveBeenCalledWith('first-bucket', '')
    expect(wrapper.text()).toContain('first-bucket')
  })

  it('shows the object loading status after objects load', async () => {
    vi.mocked(listBuckets).mockResolvedValue([{ Name: 'my-bucket' }])
    vi.mocked(listObjects).mockResolvedValue([{ Key: 'file.json', Size: 128 }])
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.text()).toContain('1 object(s) loaded')
  })

  it('shows the error message when listObjects rejects', async () => {
    vi.mocked(listBuckets).mockResolvedValue([{ Name: 'my-bucket' }])
    vi.mocked(listObjects).mockRejectedValue(new Error('Access denied'))
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.text()).toContain('Access denied')
  })
})
