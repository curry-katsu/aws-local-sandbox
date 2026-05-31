import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ResourceList from '../ResourceList.vue'

vi.mock('../../aws/resources', () => ({
  discoverResources: vi.fn(),
}))

import { discoverResources } from '../../aws/resources'

// Vuetify is registered globally by src/test-utils/setup.js
function mountComponent(options = {}) {
  return mount(ResourceList, {
    attachTo: document.body,
    ...options,
  })
}

describe('ResourceList', () => {
  beforeEach(() => {
    vi.mocked(discoverResources).mockReset()
  })

  it('renders the Resources heading', async () => {
    vi.mocked(discoverResources).mockResolvedValue({ resources: [], failedServices: [] })
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.text()).toContain('Resources')
  })

  it('calls discoverResources once on mount', async () => {
    vi.mocked(discoverResources).mockResolvedValue({ resources: [], failedServices: [] })
    mountComponent()
    await flushPromises()
    expect(discoverResources).toHaveBeenCalledOnce()
  })

  it('displays returned resources in the table', async () => {
    vi.mocked(discoverResources).mockResolvedValue({
      resources: [
        { service: 'S3', name: 'my-bucket', id: 'my-bucket' },
        { service: 'SQS', name: 'my-queue', id: 'http://localhost:4566/000000000000/my-queue' },
      ],
      failedServices: [],
    })
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.text()).toContain('my-bucket')
    expect(wrapper.text()).toContain('my-queue')
  })

  it('shows service type chips for each resource', async () => {
    vi.mocked(discoverResources).mockResolvedValue({
      resources: [{ service: 'DynamoDB', name: 'items-table', id: 'items-table' }],
      failedServices: [],
    })
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.text()).toContain('DynamoDB')
    expect(wrapper.text()).toContain('items-table')
  })

  it('shows partial-failure alert when some services fail', async () => {
    vi.mocked(discoverResources).mockResolvedValue({
      resources: [],
      failedServices: ['Lambda', 'RDS'],
    })
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.text()).toContain('Lambda')
    expect(wrapper.text()).toContain('RDS')
  })

  it('shows error message when discoverResources throws', async () => {
    vi.mocked(discoverResources).mockRejectedValue(new Error('Connection refused'))
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.text()).toContain('Connection refused')
  })

  it('shows empty-state row when no resources are returned', async () => {
    vi.mocked(discoverResources).mockResolvedValue({ resources: [], failedServices: [] })
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.text()).toContain('No resources found.')
  })

  it('calls discoverResources again when Refresh is clicked', async () => {
    vi.mocked(discoverResources).mockResolvedValue({ resources: [], failedServices: [] })
    const wrapper = mountComponent()
    await flushPromises()
    expect(discoverResources).toHaveBeenCalledTimes(1)

    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(discoverResources).toHaveBeenCalledTimes(2)
  })
})
