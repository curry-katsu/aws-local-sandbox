import {
  DescribeDBClustersCommand,
  DescribeDBInstancesCommand,
  RDSClient,
} from '@aws-sdk/client-rds'
import { clientConfig } from './config'

const rds = new RDSClient(clientConfig)

export async function listDbClusters() {
  const result = await rds.send(new DescribeDBClustersCommand({}))
  return result.DBClusters || []
}

export async function listDbInstances() {
  const result = await rds.send(new DescribeDBInstancesCommand({}))
  return result.DBInstances || []
}
