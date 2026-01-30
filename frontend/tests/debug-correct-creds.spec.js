import { test } from '@playwright/test'

const BASE_URL = 'https://uppalcrm-frontend-devtest.onrender.com'

test('Debug: Login with user provided credentials', async ({ page }) => {
  console.log('\n🔓 Using credentials provided by user:')
  console.log('   Email: admin@staging.uppalcrm.com')
  console.log('   Password: staging123')

  // Monitor all requests and responses
  const requests = []
  const responses = []

  page.on('request', (request) => {
    if (request.url().includes('/auth/') || request.url().includes('/login')) {
      requests.push({
        method: request.method(),
        url: request.url(),
        status: 'pending'
      })
      console.log(`📤 Request: ${request.method()} ${request.url()}`)
    }
  })

  page.on('response', (response) => {
    if (response.url().includes('/auth/') || response.url().includes('/login')) {
      responses.push({
        url: response.url(),
        status: response.status()
      })
      console.log(`📥 Response: ${response.status()} ${response.url()}`)
    }
  })

  console.log('\n✅ Navigating to login page...')
  await page.goto(`${BASE_URL}/login`)
  await page.waitForLoadState('networkidle')

  console.log('📧 Filling email...')
  await page.locator('input[type="email"]').first().fill('admin@staging.uppalcrm.com')

  console.log('🔑 Filling password...')
  await page.locator('input[type="password"]').first().fill('staging123')

  console.log('🚀 Clicking sign in button...')
  await page.locator('button[type="submit"]').first().click()

  // Wait for any network activity
  console.log('⏳ Waiting for response...')
  await page.waitForTimeout(5000)

  // Check if we got redirected
  const currentUrl = page.url()
  console.log(`\n📍 Current URL after login: ${currentUrl}`)

  if (currentUrl.includes('/dashboard')) {
    console.log('✅ Successfully logged in and redirected to dashboard!')

    // Check localStorage
    const token = await page.evaluate(() => localStorage.getItem('authToken'))
    if (token) {
      console.log(`✅ Auth token stored: ${token.substring(0, 30)}...`)
    }

    const user = await page.evaluate(() => {
      const userData = localStorage.getItem('user')
      return userData ? JSON.parse(userData) : null
    })
    if (user) {
      console.log(`✅ User: ${user.email}`)
      console.log(`✅ Timezone: ${user.timezone}`)
    }
  } else {
    console.log('❌ Still on login page - credentials may be wrong or API error')

    // Check for error messages
    const errorText = await page.locator('[role="alert"], .error, .error-message').textContent()
    if (errorText) {
      console.log(`\n⚠️  Error message: ${errorText}`)
    }

    // Try to see what the backend is returning
    console.log('\n🔍 Checking API endpoints...')

    // Test if API is reachable
    try {
      const healthResponse = await page.request.get(
        'https://uppalcrm-api-devtest.onrender.com/api/health'
      )
      console.log(`Health check: ${healthResponse.status()}`)
    } catch (e) {
      console.log(`Health check failed: ${e.message}`)
    }

    // List all captured requests/responses
    console.log(`\n📋 Captured ${requests.length} requests and ${responses.length} responses`)
    requests.forEach((req, i) => {
      console.log(`  [${i}] ${req.method} ${req.url}`)
    })
    responses.forEach((res, i) => {
      console.log(`  [${i}] ${res.status} ${res.url}`)
    })
  }
})
