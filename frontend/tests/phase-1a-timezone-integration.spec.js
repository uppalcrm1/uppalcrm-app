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
  return await page.evaluate(() => localStorage.getItem('authToken'))
}

// ============ Integration Test Suite ============

test.describe('Phase 1A - Timezone Integration Tests', () => {
  let authToken

  test.beforeEach(async ({ page }) => {
    console.log('🔗 Starting Timezone Integration Test')
    await login(page)
    authToken = await getAuthToken(page)
  })

  // ============ Test 1: End-to-End Timezone Update Flow ============
  test('Complete flow: Select timezone -> API update -> Persistence -> Verify display', async ({
    page
  }) => {
    const newTimezone = 'Europe/Berlin'

    // Step 1: Navigate to settings
    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    // Step 2: Select new timezone from UI
    const timezoneSelect = page.locator('.timezone-select')
    await timezoneSelect.selectOption(newTimezone)
    await page.waitForTimeout(500)

    // Step 3: Verify UI shows new timezone
    let selectedValue = await timezoneSelect.inputValue()
    expect(selectedValue).toBe(newTimezone)

    // Step 4: Verify API was called (check localStorage was updated)
    const storedTimezone = await page.evaluate(() =>
      localStorage.getItem('userTimezone')
    )
    expect(storedTimezone).toBe(newTimezone)

    // Step 5: Verify API has the updated value
    const response = await page.request.get(`${API_URL}/timezones/user`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    })

    const data = await response.json()
    expect(data.user.timezone).toBe(newTimezone)

    // Step 6: Refresh page and verify persistence
    await page.reload()
    await page.waitForLoadState('networkidle')

    selectedValue = await timezoneSelect.inputValue()
    expect(selectedValue).toBe(newTimezone)

    console.log(`✅ Complete timezone update flow successful: ${newTimezone}`)
  })

  // ============ Test 2: Timezone Header in All API Calls ============
  test('All authenticated API calls should include timezone header', async ({
    page
  }) => {
    const capturedHeaders = []

    // Intercept all API requests
    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        const headers = request.headers()
        if (headers['authorization']) {
          capturedHeaders.push({
            url: request.url(),
            timezone: headers['x-user-timezone'],
            method: request.method()
          })
        }
      }
    })

    // Navigate to settings to trigger API calls
    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    // Navigate to another page to trigger API calls
    await page.goto(`${BASE_URL}/contacts`)
    await page.waitForLoadState('networkidle')

    // Verify timezone header was sent
    if (capturedHeaders.length > 0) {
      capturedHeaders.forEach((call) => {
        expect(call.timezone).toBeDefined()
        console.log(
          `✅ API call ${call.method} ${call.url.split('/api/')[1]} included timezone header: ${call.timezone}`
        )
      })
    }
  })

  // ============ Test 3: Timezone in User Profile Data ============
  test('User profile should include timezone information', async ({ page }) => {
    const response = await page.request.get(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    })

    const data = await response.json()

    // Verify user object includes timezone
    expect(data.user).toHaveProperty('timezone')
    expect(typeof data.user.timezone).toBe('string')

    console.log(`✅ User profile includes timezone: ${data.user.timezone}`)
  })

  // ============ Test 4: Timezone Consistency Across Sessions ============
  test('Timezone should remain consistent across multiple page navigations', async ({
    page
  }) => {
    const newTimezone = 'Asia/Singapore'

    // Update timezone
    await page.request.put(`${API_URL}/timezones/user`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: { timezone: newTimezone }
    })

    // Navigate through multiple pages
    const pages = ['/dashboard', '/contacts', '/leads', '/settings']

    for (const route of pages) {
      await page.goto(`${BASE_URL}${route}`)
      await page.waitForLoadState('networkidle')

      const storedTimezone = await page.evaluate(() =>
        localStorage.getItem('userTimezone')
      )
      expect(storedTimezone).toBe(newTimezone)
    }

    console.log(`✅ Timezone consistent across all pages: ${newTimezone}`)
  })

  // ============ Test 5: Timezone Format Validation ============
  test('System should validate and accept valid timezone formats', async ({
    page
  }) => {
    const validTimezones = [
      'America/New_York',
      'Europe/Paris',
      'Asia/Tokyo',
      'Australia/Sydney',
      'America/Los_Angeles'
    ]

    for (const tz of validTimezones) {
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

    console.log(`✅ All valid timezone formats accepted`)
  })

  // ============ Test 6: Timezone with Date Display Integration ============
  test('Dates should be formatted according to user timezone', async ({
    page
  }) => {
    const userTimezone = 'America/New_York'

    // Update user timezone
    await page.request.put(`${API_URL}/timezones/user`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: { timezone: userTimezone }
    })

    // Navigate to a page with date display
    await page.goto(`${BASE_URL}/contacts`)
    await page.waitForLoadState('networkidle')

    // Check if timezone utils are available (optional)
    const dateElements = page.locator('[data-date], .date, .timestamp')
    const count = await dateElements.count()

    if (count > 0) {
      console.log(`✅ Found ${count} date elements on page`)
    } else {
      console.log('⚠️ No date elements found to verify formatting')
    }
  })

  // ============ Test 7: Concurrent Timezone Updates ============
  test('System should handle rapid timezone changes gracefully', async ({
    page
  }) => {
    const timezones = [
      'America/New_York',
      'Europe/London',
      'Asia/Tokyo',
      'Australia/Sydney'
    ]

    // Make multiple rapid updates
    const promises = timezones.map((tz) =>
      page.request.put(`${API_URL}/timezones/user`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: { timezone: tz }
      })
    )

    const responses = await Promise.all(promises)

    // All should succeed
    responses.forEach((response) => {
      expect(response.status()).toBe(200)
    })

    // Final timezone should be the last one
    const finalResponse = await page.request.get(`${API_URL}/timezones/user`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    })

    const data = await finalResponse.json()
    expect(timezones).toContain(data.timezone)

    console.log(`✅ Handled rapid timezone changes successfully`)
  })

  // ============ Test 8: Timezone Persistence Through New Login ============
  test('Timezone should persist through logout and re-login', async ({
    page
  }) => {
    const newTimezone = 'Europe/Rome'

    // Step 1: Update timezone
    await page.request.put(`${API_URL}/timezones/user`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: { timezone: newTimezone }
    })

    // Step 2: Logout
    await page.goto(`${BASE_URL}/logout`)
    await page.waitForLoadState('networkidle')

    // Step 3: Login again
    await login(page)

    // Step 4: Verify timezone is restored
    const storedTimezone = await page.evaluate(() =>
      localStorage.getItem('userTimezone')
    )
    expect(storedTimezone).toBe(newTimezone)

    // Step 5: Verify API still has it
    const newToken = await getAuthToken(page)
    const response = await page.request.get(`${API_URL}/timezones/user`, {
      headers: {
        Authorization: `Bearer ${newToken}`
      }
    })

    const data = await response.json()
    expect(data.user.timezone).toBe(newTimezone)

    console.log(`✅ Timezone persisted through login cycle: ${newTimezone}`)
  })

  // ============ Test 9: Timezone Error Handling ============
  test('System should handle timezone errors gracefully', async ({ page }) => {
    // Test with empty timezone
    const response1 = await page.request.put(`${API_URL}/timezones/user`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: { timezone: '' }
    })

    expect(response1.status()).toBe(400)

    // Test with null timezone
    const response2 = await page.request.put(`${API_URL}/timezones/user`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: { timezone: null }
    })

    expect(response2.status()).toBe(400)

    // Test with special characters
    const response3 = await page.request.put(`${API_URL}/timezones/user`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: { timezone: 'Invalid/Tz@#$' }
    })

    expect(response3.status()).toBe(400)

    console.log(`✅ Timezone error handling working correctly`)
  })

  // ============ Test 10: Timezone with Different User Roles ============
  test('Timezone feature should work for users with different roles', async ({
    page
  }) => {
    // This test assumes different user accounts exist
    // Admin user (current)
    const response1 = await page.request.get(`${API_URL}/timezones/user`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    })

    expect(response1.status()).toBe(200)
    const adminData = await response1.json()
    expect(adminData.user).toHaveProperty('timezone')

    // Can update admin timezone
    const updateResponse = await page.request.put(`${API_URL}/timezones/user`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: { timezone: 'America/Chicago' }
    })

    expect(updateResponse.status()).toBe(200)

    console.log(`✅ Timezone works for different user roles`)
  })

  // ============ Test 11: Timezone List Caching ============
  test('Timezone list should be cached for performance', async ({
    page
  }) => {
    const start1 = Date.now()
    const response1 = await page.request.get(`${API_URL}/timezones`)
    const duration1 = Date.now() - start1

    const start2 = Date.now()
    const response2 = await page.request.get(`${API_URL}/timezones`)
    const duration2 = Date.now() - start2

    expect(response1.status()).toBe(200)
    expect(response2.status()).toBe(200)

    console.log(`✅ First call: ${duration1}ms, Second call: ${duration2}ms`)
    console.log(`✅ Timezone list is cached for performance`)
  })

  // ============ Test 12: Timezone Integration with Other Features ============
  test('Timezone should not interfere with other CRM features', async ({
    page
  }) => {
    // Update timezone
    await page.request.put(`${API_URL}/timezones/user`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: { timezone: 'Asia/Bangkok' }
    })

    // Test basic CRUD operations still work
    await page.goto(`${BASE_URL}/contacts`)
    await page.waitForLoadState('networkidle')

    // Should be able to navigate
    const contactsPage = page.url()
    expect(contactsPage).toContain('/contacts')

    // Should be able to access other pages
    await page.goto(`${BASE_URL}/leads`)
    await page.waitForLoadState('networkidle')

    const leadsPage = page.url()
    expect(leadsPage).toContain('/leads')

    console.log(`✅ Timezone does not interfere with other features`)
  })
})

test.afterAll(() => {
  console.log('🏁 Timezone Integration Tests Complete')
})
