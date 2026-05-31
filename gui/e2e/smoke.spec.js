import { expect, test } from '@playwright/test'

const ROUTES = [
  { path: '/', label: 'Dashboard' },
  { path: '/s3', label: 'S3' },
  { path: '/dynamodb', label: 'DynamoDB' },
  { path: '/sqs', label: 'SQS' },
  { path: '/sns', label: 'SNS' },
  { path: '/lambda', label: 'Lambda' },
  { path: '/rds', label: 'RDS' },
  { path: '/secrets', label: 'Secrets & Parameters' },
  { path: '/cognito', label: 'Cognito' },
  { path: '/eventbridge', label: 'EventBridge' },
  { path: '/stepfunctions', label: 'Step Functions' },
]

for (const { path, label } of ROUTES) {
  test(`${label} ページがクラッシュせずに表示される`, async ({ page }) => {
    const jsErrors = []
    page.on('pageerror', (err) => jsErrors.push(err.message))

    // Intercept AWS SDK requests so tests don't require Floci to be running
    await page.route('**/floci/**', (route) => route.fulfill({ status: 200, body: '{}' }))
    await page.route('http://localhost:4566/**', (route) =>
      route.fulfill({ status: 200, body: '{}' }),
    )

    await page.goto(path)

    // The navigation drawer is always rendered regardless of API results
    await expect(page.locator('.v-navigation-drawer')).toBeVisible({ timeout: 10_000 })

    // The app bar should always be rendered
    await expect(page.locator('.v-app-bar')).toBeVisible()

    // No unhandled JavaScript errors should occur
    expect(jsErrors, `Unexpected JS errors on ${path}: ${jsErrors.join(', ')}`).toHaveLength(0)
  })
}

test('ナビゲーションリンクがサイドバーに表示される', async ({ page }) => {
  await page.route('**/floci/**', (route) => route.fulfill({ status: 200, body: '{}' }))
  await page.goto('/')
  await expect(page.locator('.v-navigation-drawer')).toBeVisible({ timeout: 10_000 })

  const navItems = ['S3', 'DynamoDB', 'SQS', 'SNS', 'Lambda', 'RDS']
  for (const item of navItems) {
    await expect(page.locator('.v-navigation-drawer').getByText(item)).toBeVisible()
  }
})

test('存在しないパスは Not Found ページにルーティングされる', async ({ page }) => {
  const jsErrors = []
  page.on('pageerror', (err) => jsErrors.push(err.message))
  await page.route('**/floci/**', (route) => route.fulfill({ status: 200, body: '{}' }))

  await page.goto('/this-route-does-not-exist')
  await expect(page.locator('.v-navigation-drawer')).toBeVisible({ timeout: 10_000 })
  expect(jsErrors).toHaveLength(0)
})
