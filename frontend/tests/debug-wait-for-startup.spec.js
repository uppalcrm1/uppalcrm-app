import { test } from '@playwright/test'

const BASE_URL = 'https://uppalcrm-frontend-devtest.onrender.com'

test('Debug: Wait for devtest service to fully startup, then login', async ({ page }) => {
  console.log('\n⏳ Waiting for devtest environment to fully initialize...')
  console.log('   (Render services take 30-60 seconds to wake up)')

  // Set longer timeout for this test
  test.setTimeout(120000)

  console.log('\n✅ Navigating to login page...')
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })

  console.log('⏳ Waiting for page to be fully ready...')
  // Wait for the page to be fully interactive
  await page.waitForLoadState('networkidle', { timeout: 60000 })

  console.log('✅ Page is ready, checking for login form...')

  // Wait for email input to be available
  await page.locator('input[type="email"]').first().waitFor({ state: 'visible', timeout: 30000 })
  console.log('✅ Login form found!')

  console.log('\n📧 Filling email: admin@staging.uppalcrm.com')
  await page.locator('input[type="email"]').first().fill('admin@staging.uppalcrm.com')

  console.log('🔑 Filling password: staging123')
  await page.locator('input[type="password"]').first().fill('staging123')

  console.log('🚀 Clicking sign in button...')
  await page.locator('button[type="submit"]').first().click()

  console.log('⏳ Waiting for dashboard redirect...')
  try {
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 30000 })
    console.log('\n✅ SUCCESS! Logged in and redirected to dashboard')
    console.log(`📍 URL: ${page.url()}`)

    // Check auth token
    const token = await page.evaluate(() => localStorage.getItem('authToken'))
    if (token) {
      console.log(`✅ Auth token: ${token.substring(0, 30)}...`)
    }

    // Check user data with timezone
    const user = await page.evaluate(() => {
      const userData = localStorage.getItem('user')
      return userData ? JSON.parse(userData) : null
    })
    if (user) {
      console.log(`✅ User: ${user.email}`)
      console.log(`✅ Timezone: ${user.timezone || 'NOT SET'}`)
    }
  } catch (error) {
    console.log('\n❌ Login failed')
    console.log(`Error: ${error.message}`)

    // Check current page
    const url = page.url()
    console.log(`Current URL: ${url}`)

    if (url.includes('/login')) {
      console.log('❌ Still on login page - credentials may be incorrect')

      // Take screenshot
      await page.screenshot({ path: 'debug-login-error.png' })
      console.log('📸 Screenshot saved for debugging')
    }

    throw error
  }
})
