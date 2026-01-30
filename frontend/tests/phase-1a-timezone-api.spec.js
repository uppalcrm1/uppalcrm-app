import { test, expect } from '@playwright/test'

const BASE_URL = 'https://uppalcrm-frontend-devtest.onrender.com'
const API_URL = 'https://uppalcrm-backend-devtest.onrender.com/api'

// ============ Authentication Helper ============

async function login(page, email = 'admin@staging.uppalcrm.com', password = 'staging123') {
  await page.goto(`${BASE_URL}/login`)
  await page.waitForLoadState('networkidle')

  await page.locator('input[type="email"]').first().fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  await page.locator('button[type="submit"]').first().click()

  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 30000 })
}

async function getAuthToken(page) {
  // Get token from localStorage after login
  const token = await page.evaluate(() => localStorage.getItem('authToken'))
  return token
}

// ============ API Test Suite ============

test.describe('Phase 1A - Timezone API Endpoints', () => {
  let authToken

  test.beforeAll(async () => {
    console.log('🌐 Starting Timezone API Tests')
  })

  test.beforeEach(async ({ page }) => {
    // Login once to get auth token
    await login(page)
    authToken = await getAuthToken(page)
    console.log(`✅ Authenticated with token: ${authToken?.substring(0, 20)}...`)
  })

  // ============ Test 1: Get All Timezones ============
  test('GET /api/timezones - Should return all available timezones', async ({
    page
  }) => {
    const response = await page.request.get(`${API_URL}/timezones`)

    expect(response.status()).toBe(200)
    const data = await response.json()

    // Verify response structure
    expect(data).toHaveProperty('success', true)
    expect(data).toHaveProperty('data')
    expect(data).toHaveProperty('count')

    // Verify data is array
    expect(Array.isArray(data.data)).toBe(true)
    expect(data.count).toBeGreaterThan(30)

    // Verify each timezone has required fields
    data.data.forEach((tz) => {
      expect(tz).toHaveProperty('value')
      expect(tz).toHaveProperty('label')
      expect(tz).toHaveProperty('offset')

      // Verify value format (e.g., America/New_York)
      expect(typeof tz.value).toBe('string')
      expect(tz.value).toContain('/')

      // Verify label is descriptive
      expect(typeof tz.label).toBe('string')
      expect(tz.label.length).toBeGreaterThan(2)
    })

    console.log(`✅ Found ${data.count} timezones`)
  })

  // ============ Test 2: Verify Default Timezone Exists ============
  test('GET /api/timezones - Should include default America/New_York timezone', async ({
    page
  }) => {
    const response = await page.request.get(`${API_URL}/timezones`)
    const data = await response.json()

    const defaultTz = data.data.find((tz) => tz.value === 'America/New_York')
    expect(defaultTz).toBeDefined()
    expect(defaultTz.label).toContain('Eastern')

    console.log(`✅ Default timezone found: ${defaultTz.label}`)
  })

  // ============ Test 3: Verify International Timezones ============
  test('GET /api/timezones - Should include international timezones', async ({
    page
  }) => {
    const response = await page.request.get(`${API_URL}/timezones`)
    const data = await response.json()

    const expectedTimezones = [
      'America/Los_Angeles',
      'America/Chicago',
      'Europe/London',
      'Europe/Paris',
      'Asia/Tokyo',
      'Australia/Sydney'
    ]

    expectedTimezones.forEach((expectedTz) => {
      const found = data.data.find((tz) => tz.value === expectedTz)
      expect(found).toBeDefined()
    })

    console.log(`✅ All expected international timezones found`)
  })

  // ============ Test 4: Get User's Current Timezone ============
  test('GET /api/timezones/user - Should return current user timezone', async ({
    page
  }) => {
    const response = await page.request.get(`${API_URL}/timezones/user`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()

    // Verify response structure
    expect(data).toHaveProperty('success', true)
    expect(data).toHaveProperty('timezone')
    expect(data).toHaveProperty('user')

    // Verify user object
    expect(data.user).toHaveProperty('id')
    expect(data.user).toHaveProperty('email')
    expect(data.user).toHaveProperty('timezone')

    // Verify timezone is valid
    expect(typeof data.timezone).toBe('string')
    expect(data.timezone).toContain('/')

    console.log(`✅ User timezone: ${data.timezone}`)
  })

  // ============ Test 5: Update User Timezone ============
  test('PUT /api/timezones/user - Should successfully update user timezone', async ({
    page
  }) => {
    const newTimezone = 'America/Los_Angeles'

    const response = await page.request.put(`${API_URL}/timezones/user`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        timezone: newTimezone
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()

    // Verify success response
    expect(data).toHaveProperty('success', true)
    expect(data).toHaveProperty('message')
    expect(data.message).toContain('successfully')

    // Verify user object has updated timezone
    expect(data.user).toHaveProperty('timezone', newTimezone)

    console.log(`✅ Timezone updated to: ${newTimezone}`)
  })

  // ============ Test 6: Verify Timezone Persistence ============
  test('PUT /api/timezones/user - Updated timezone should persist', async ({
    page
  }) => {
    const newTimezone = 'Asia/Tokyo'

    // Update timezone
    await page.request.put(`${API_URL}/timezones/user`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        timezone: newTimezone
      }
    })

    // Get timezone again
    const response = await page.request.get(`${API_URL}/timezones/user`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    })

    const data = await response.json()
    expect(data.timezone).toBe(newTimezone)

    console.log(`✅ Timezone persistence verified: ${data.timezone}`)
  })

  // ============ Test 7: Invalid Timezone Rejection ============
  test('PUT /api/timezones/user - Should reject invalid timezone', async ({
    page
  }) => {
    const invalidTimezone = 'Invalid/Timezone'

    const response = await page.request.put(`${API_URL}/timezones/user`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        timezone: invalidTimezone
      }
    })

    expect(response.status()).toBe(400)
    const data = await response.json()

    expect(data).toHaveProperty('error')
    expect(data.message).toContain('Invalid timezone')

    console.log(`✅ Invalid timezone properly rejected`)
  })

  // ============ Test 8: Missing Timezone Field ============
  test('PUT /api/timezones/user - Should reject missing timezone field', async ({
    page
  }) => {
    const response = await page.request.put(`${API_URL}/timezones/user`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {}
    })

    expect(response.status()).toBe(400)
    const data = await response.json()

    expect(data).toHaveProperty('error')
    expect(data.message).toContain('required')

    console.log(`✅ Missing timezone field properly rejected`)
  })

  // ============ Test 9: Authentication Required ============
  test('GET /api/timezones/user - Should require authentication', async ({
    page
  }) => {
    const response = await page.request.get(`${API_URL}/timezones/user`)

    expect(response.status()).toBe(401)

    console.log(`✅ Authentication requirement enforced`)
  })

  // ============ Test 10: Timezone in JWT Token ============
  test('Auth token should include timezone claim', async ({ page }) => {
    // Decode JWT token
    const tokenParts = authToken.split('.')
    const payload = JSON.parse(
      Buffer.from(tokenParts[1], 'base64').toString('utf-8')
    )

    // Verify timezone is in JWT payload
    expect(payload).toHaveProperty('timezone')
    expect(typeof payload.timezone).toBe('string')

    console.log(`✅ JWT token contains timezone: ${payload.timezone}`)
  })

  // ============ Test 11: Multiple Timezone Updates ============
  test('PUT /api/timezones/user - Should handle multiple timezone changes', async ({
    page
  }) => {
    const timezones = [
      'America/New_York',
      'Europe/London',
      'Asia/Singapore',
      'Australia/Sydney'
    ]

    for (const tz of timezones) {
      const response = await page.request.put(`${API_URL}/timezones/user`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: { timezone: tz }
      })

      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.user.timezone).toBe(tz)
    }

    console.log(`✅ Multiple timezone changes successful`)
  })

  // ============ Test 12: Response Headers ============
  test('API responses should have correct headers', async ({ page }) => {
    const response = await page.request.get(`${API_URL}/timezones`)

    expect(response.headers()['content-type']).toContain('application/json')
    expect(response.ok()).toBe(true)

    console.log(`✅ Response headers correct`)
  })

  // ============ Test 13: Timezone List Performance ============
  test('GET /api/timezones - Should respond quickly', async ({ page }) => {
    const start = Date.now()
    const response = await page.request.get(`${API_URL}/timezones`)
    const duration = Date.now() - start

    expect(response.status()).toBe(200)
    expect(duration).toBeLessThan(5000) // Should respond in less than 5 seconds

    console.log(`✅ API response time: ${duration}ms`)
  })
})

test.afterAll(() => {
  console.log('🏁 Timezone API Tests Complete')
})
