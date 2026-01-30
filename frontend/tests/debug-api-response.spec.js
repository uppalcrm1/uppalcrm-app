import { test, expect } from '@playwright/test'

const BASE_URL = 'https://uppalcrm-frontend-devtest.onrender.com'
const API_URL = 'https://uppalcrm-backend-devtest.onrender.com/api'

test('Debug: Check login API response', async ({ page }) => {
  console.log('\n🔍 Monitoring network requests...')

  let loginResponse = null
  let requestPayload = null

  // Capture the login POST request
  page.on('response', (response) => {
    const url = response.url()
    if (url.includes('/api/') && url.includes('login')) {
      console.log(`📤 Response: ${response.status()} ${url}`)
      loginResponse = response
    }
  })

  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('/api/') && url.includes('login')) {
      console.log(`📥 Request: ${request.method()} ${url}`)
      try {
        const postData = request.postDataJSON()
        console.log(`   Payload: ${JSON.stringify(postData)}`)
        requestPayload = postData
      } catch (e) {
        // Not JSON
      }
    }
  })

  await page.goto(`${BASE_URL}/login`)
  await page.waitForLoadState('networkidle')

  console.log('\n📧 Filling email: admin@testcompany.com')
  await page.locator('input[type="email"]').first().fill('admin@testcompany.com')

  console.log('🔑 Filling password: SecurePassword123!')
  await page.locator('input[type="password"]').first().fill('SecurePassword123!')

  console.log('🚀 Clicking sign in button')
  await page.locator('button[type="submit"]').first().click()

  // Wait for network activity
  console.log('⏳ Waiting for API response...')
  await page.waitForTimeout(5000)

  if (loginResponse) {
    console.log(`\n✅ Got login response: ${loginResponse.status()}`)
    try {
      const data = await loginResponse.json()
      console.log('📋 Response body:')
      console.log(JSON.stringify(data, null, 2))
    } catch (e) {
      const text = await loginResponse.text()
      console.log('📋 Response text:')
      console.log(text.substring(0, 500))
    }
  } else {
    console.log('\n❌ No login API response captured')
  }

  // Try direct API call
  console.log('\n🔄 Trying direct API call...')
  const response = await page.request.post(`${API_URL}/login`, {
    data: {
      email: 'admin@testcompany.com',
      password: 'SecurePassword123!'
    }
  })
  console.log(`API Response Status: ${response.status()}`)
  const data = await response.json()
  console.log('API Response:')
  console.log(JSON.stringify(data, null, 2))
})
