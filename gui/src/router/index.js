import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'

export const navigationItems = [
  { path: '/', title: 'Dashboard', icon: 'mdi-view-dashboard-outline' },
  { path: '/s3', title: 'S3', icon: 'mdi-bucket-outline' },
  { path: '/dynamodb', title: 'DynamoDB', icon: 'mdi-database-outline' },
  { path: '/sqs', title: 'SQS', icon: 'mdi-message-outline' },
  { path: '/sns', title: 'SNS', icon: 'mdi-bullhorn-outline' },
  { path: '/lambda', title: 'Lambda', icon: 'mdi-lambda' },
  { path: '/rds', title: 'RDS', icon: 'mdi-database-cog-outline' },
  { path: '/secrets', title: 'Secrets & Parameters', icon: 'mdi-shield-key-outline' },
  { path: '/cognito', title: 'Cognito', icon: 'mdi-account-key-outline' },
  { path: '/eventbridge', title: 'EventBridge', icon: 'mdi-calendar-clock-outline' },
  {
    path: '/stepfunctions',
    title: 'Step Functions',
    icon: 'mdi-transit-connection-variant',
  },
]

const routes = [
  { path: '/', component: () => import('../views/DashboardView.vue'), meta: navigationItems[0] },
  { path: '/s3', component: () => import('../views/S3View.vue'), meta: navigationItems[1] },
  { path: '/dynamodb', component: () => import('../views/DynamoDbView.vue'), meta: navigationItems[2] },
  { path: '/sqs', component: () => import('../views/SqsView.vue'), meta: navigationItems[3] },
  { path: '/sns', component: () => import('../views/SnsView.vue'), meta: navigationItems[4] },
  { path: '/lambda', component: () => import('../views/LambdaView.vue'), meta: navigationItems[5] },
  { path: '/rds', component: () => import('../views/RdsView.vue'), meta: navigationItems[6] },
  { path: '/secrets', component: () => import('../views/SecretsView.vue'), meta: navigationItems[7] },
  { path: '/cognito', component: () => import('../views/CognitoView.vue'), meta: navigationItems[8] },
  {
    path: '/eventbridge',
    component: () => import('../views/EventBridgeView.vue'),
    meta: navigationItems[9],
  },
  {
    path: '/stepfunctions',
    component: () => import('../views/StepFunctionsView.vue'),
    meta: navigationItems[10],
  },
  {
    path: '/:pathMatch(.*)*',
    component: () => import('../views/NotFoundView.vue'),
    meta: { title: 'Not found' },
  },
]

export const router = createRouter({
  history:
    import.meta.env.VITE_ROUTER_MODE === 'hash'
      ? createWebHashHistory(import.meta.env.BASE_URL)
      : createWebHistory(import.meta.env.BASE_URL),
  routes,
})
