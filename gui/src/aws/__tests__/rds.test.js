import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSend = vi.hoisted(() => vi.fn())

vi.mock('@aws-sdk/client-rds', () => ({
  RDSClient: vi.fn(() => ({ send: mockSend })),
  DescribeDBClustersCommand: vi.fn(),
  DescribeDBInstancesCommand: vi.fn(),
}))

vi.mock('../config', () => ({
  clientConfig: {
    endpoint: 'http://localhost:4566',
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  },
}))

import { listDbClusters, listDbInstances } from '../rds'

describe('rds service', () => {
  beforeEach(() => mockSend.mockReset())

  describe('listDbClusters', () => {
    it('returns clusters from the API response', async () => {
      const clusters = [
        { DBClusterIdentifier: 'cluster-1', Engine: 'aurora', Status: 'available' },
      ]
      mockSend.mockResolvedValueOnce({ DBClusters: clusters })
      expect(await listDbClusters()).toEqual(clusters)
    })

    it('returns empty array when DBClusters is undefined', async () => {
      mockSend.mockResolvedValueOnce({})
      expect(await listDbClusters()).toEqual([])
    })
  })

  describe('listDbInstances', () => {
    it('returns instances from the API response', async () => {
      const instances = [{ DBInstanceIdentifier: 'instance-1', DBInstanceClass: 'db.t3.micro' }]
      mockSend.mockResolvedValueOnce({ DBInstances: instances })
      expect(await listDbInstances()).toEqual(instances)
    })

    it('returns empty array when DBInstances is undefined', async () => {
      mockSend.mockResolvedValueOnce({})
      expect(await listDbInstances()).toEqual([])
    })
  })
})
