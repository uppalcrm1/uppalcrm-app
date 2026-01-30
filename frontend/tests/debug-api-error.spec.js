import { test } from '@playwright/test'

const BASE_URL = 'https://uppalcrm-frontend-devtest.onrender.com'

test('Debug: Capture actual API error response', async ({ page }) => {
  console.log('\n🔍 Monitoring all network responses...')

  let loginError = null
  let loginSuccess = false

  // Intercept and log ALL responses
  page.on('response', async (response) => {
    const url = response.url()
    const status = response.status()

    if (url.includes('/auth/') || url.includes('/login')) {
      console.log(`\n📥 API Response: ${status} ${url}`)

      try {
        const contentType = response.headers()['content-type']
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json()
          console.log('📋 Response JSON:')
          console.log(JSON.stringify(data, null, 2))

          if (status === 200 || status === 201) {
            loginSuccess = true
          } else {
            loginError = data
          }
        } else {
          const text = await response.text()
          console.log('📋 Response Text:')
          console.log(text.substring(0, 500))
        }
      } catch (e) {
        console.log('⚠️ Could not parse response:', e.message)
      }
    }
  })

  // Monitor console messages
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`🔴 Console error: ${msg.text()}`)
    }
  })

  console.log('\n✅ Going to login page...')
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 60000 })

  console.log('📧 Filling email: admin@staging.uppalcrm.com')
  await page.locator('input[type="email"]').first().fill('admin@staging.uppalcrm.com')

  console.log('🔑 Filling password: staging123')
  await page.locator('input[type="password"]').first().fill('staging123')

  console.log('🚀 Clicking sign in...')
  await page.locator('button[type="submit"]').first().click()

  // Wait for network activity
  console.log('⏳ Waiting for API response...')
  await page.waitForTimeout(3000)

  if (loginSuccess) {
    console.log('\n✅ Login API returned success!')
  } else if (loginError) {
    console.log('\n❌ Login API returned error')
    console.log('Error details:')
    console.log(JSON.stringify(loginError, null, 2))
  } else {
    console.log('\n⚠️ No login API response captured')
    console.log('Trying direct API call to check backend...')

    const directResponse = await page.request.post(
      'https://uppalcrm-backend-devtest.onrender.com/api/auth/login',
      {
        data: {
          email: 'admin@staging.uppalcrm.com',
          password: 'staging123'
        }
      }
    )

    console.log(`\nDirect API Response Status: ${directResponse.status()}`)
    try {
      const data = await directResponse.json()
      console.log('Response:')
      console.log(JSON.stringify(data, null, 2))
    } catch (e) {
      const text = await directResponse.text()
      console.log('Response text:')
      console.log(text)
    }
  }
})
