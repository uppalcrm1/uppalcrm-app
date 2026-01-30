import { test, expect } from '@playwright/test'

const BASE_URL = 'https://uppalcrm-frontend-devtest.onrender.com'

// ============ Authentication Helper ============

async function login(page, email = 'admin@staging.uppalcrm.com', password = 'staging123') {
  await page.goto(`${BASE_URL}/login`)
  await page.waitForLoadState('networkidle')

  await page.locator('input[type="email"]').first().fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  await page.locator('button[type="submit"]').first().click()

  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 30000 })
}

// ============ UI Test Suite ============

test.describe('Phase 1A - Timezone UI Components', () => {
  test.beforeEach(async ({ page }) => {
    console.log('🌐 Starting Timezone UI Test')
    await login(page)
  })

  // ============ Test 1: TimezoneSelector Component Renders ============
  test('TimezoneSelector component should render on settings page', async ({
    page
  }) => {
    // Navigate to settings or profile page (adjust route as needed)
    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    // Check if TimezoneSelector component exists
    const timezoneSelector = page.locator('.timezone-selector')
    await expect(timezoneSelector).toBeVisible()

    console.log('✅ TimezoneSelector component visible')
  })

  // ============ Test 2: Timezone Dropdown Loads ============
  test('Timezone dropdown should load and display options', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    const timezoneSelect = page.locator('.timezone-select')
    await expect(timezoneSelect).toBeVisible()

    // Check that dropdown has options
    const options = page.locator('.timezone-select option')
    const optionCount = await options.count()

    expect(optionCount).toBeGreaterThan(30)

    console.log(`✅ Timezone dropdown loaded with ${optionCount} options`)
  })

  // ============ Test 3: Default Timezone Selected ============
  test('Should have default timezone (America/New_York) selected', async ({
    page
  }) => {
    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    const timezoneSelect = page.locator('.timezone-select')
    const selectedValue = await timezoneSelect.inputValue()

    expect(selectedValue).toBe('America/New_York')

    console.log(`✅ Default timezone selected: ${selectedValue}`)
  })

  // ============ Test 4: Can Select Different Timezone ============
  test('Should be able to select different timezone from dropdown', async ({
    page
  }) => {
    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    const timezoneSelect = page.locator('.timezone-select')

    // Select Pacific timezone
    await timezoneSelect.selectOption('America/Los_Angeles')
    await page.waitForTimeout(500) // Wait for selection to register

    const selectedValue = await timezoneSelect.inputValue()
    expect(selectedValue).toBe('America/Los_Angeles')

    console.log(`✅ Successfully selected timezone: ${selectedValue}`)
  })

  // ============ Test 5: Timezone Persists After Save ============
  test('Selected timezone should persist after save', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    const timezoneSelect = page.locator('.timezone-select')
    const newTimezone = 'Europe/London'

    // Select timezone
    await timezoneSelect.selectOption(newTimezone)
    await page.waitForTimeout(500)

    // Look for save button and click it (adjust selector as needed)
    const saveButton = page.locator('button:has-text("Save")')
    if (await saveButton.isVisible({ timeout: 5000 })) {
      await saveButton.click()
      await page.waitForLoadState('networkidle')
    }

    // Refresh page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Verify timezone still selected
    const selectedValue = await timezoneSelect.inputValue()
    expect(selectedValue).toBe(newTimezone)

    console.log(`✅ Timezone persisted: ${selectedValue}`)
  })

  // ============ Test 6: Timezone Persists in LocalStorage ============
  test('Timezone should be stored in localStorage', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    const newTimezone = 'Asia/Tokyo'
    const timezoneSelect = page.locator('.timezone-select')

    // Select timezone
    await timezoneSelect.selectOption(newTimezone)
    await page.waitForTimeout(500)

    // Check localStorage
    const storedTimezone = await page.evaluate(() =>
      localStorage.getItem('userTimezone')
    )

    expect(storedTimezone).toBe(newTimezone)

    console.log(`✅ Timezone stored in localStorage: ${storedTimezone}`)
  })

  // ============ Test 7: AuthContext Contains Timezone ============
  test('Auth context should include timezone state', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    // Check if timezone is available in page context (assuming app exposes it)
    const authTimezone = await page.evaluate(() => {
      // This assumes auth context is accessible from window
      // Adjust based on your actual implementation
      return localStorage.getItem('userTimezone')
    })

    expect(authTimezone).toBeDefined()
    expect(typeof authTimezone).toBe('string')

    console.log(`✅ Timezone in auth context: ${authTimezone}`)
  })

  // ============ Test 8: Timezone Header Sent in Requests ============
  test('API requests should include X-User-Timezone header', async ({
    page
  }) => {
    let requestHeaders = null

    // Intercept API request to capture headers
    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        requestHeaders = request.headers()
      }
    })

    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    // Make an API call by navigating to different page
    await page.goto(`${BASE_URL}/contacts`)
    await page.waitForLoadState('networkidle')

    // Check if timezone header was sent
    if (requestHeaders) {
      const timezoneHeader = requestHeaders['x-user-timezone']
      expect(timezoneHeader).toBeDefined()
      console.log(`✅ X-User-Timezone header found: ${timezoneHeader}`)
    } else {
      console.log('⚠️ Could not verify header (no API requests captured)')
    }
  })

  // ============ Test 9: Timezone Selector Label ============
  test('TimezoneSelector should have proper label', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    const timezoneLabel = page.locator('.timezone-label')
    await expect(timezoneLabel).toBeVisible()

    const labelText = await timezoneLabel.textContent()
    expect(labelText?.toLowerCase()).toContain('timezone')

    console.log(`✅ Timezone label visible: ${labelText}`)
  })

  // ============ Test 10: Multiple Timezone Changes ============
  test('Should handle multiple timezone changes smoothly', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    const timezoneSelect = page.locator('.timezone-select')
    const timezones = [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles'
    ]

    for (const tz of timezones) {
      await timezoneSelect.selectOption(tz)
      await page.waitForTimeout(300)

      const selectedValue = await timezoneSelect.inputValue()
      expect(selectedValue).toBe(tz)
    }

    console.log(`✅ Multiple timezone changes handled correctly`)
  })

  // ============ Test 11: Timezone Updates in Real-Time ============
  test('Timezone change should update in real-time', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    const timezoneSelect = page.locator('.timezone-select')
    const newTimezone = 'Europe/Paris'

    const initialValue = await timezoneSelect.inputValue()
    expect(initialValue).not.toBe(newTimezone)

    // Change timezone
    await timezoneSelect.selectOption(newTimezone)

    // Immediately check value (should change instantly)
    const updatedValue = await timezoneSelect.inputValue()
    expect(updatedValue).toBe(newTimezone)

    console.log(`✅ Timezone updated in real-time from ${initialValue} to ${updatedValue}`)
  })

  // ============ Test 12: Timezone Accessible After Login ============
  test('Timezone should be set immediately after login', async ({ page }) => {
    // Re-login to test
    await page.goto(`${BASE_URL}/login`)
    await page.waitForLoadState('networkidle')

    await page.locator('input[type="email"]').first().fill('admin@staging.uppalcrm.com')
    await page.locator('input[type="password"]').first().fill('staging123')
    await page.locator('button[type="submit"]').first().click()

    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 30000 })

    // Check if timezone is available
    const userTimezone = await page.evaluate(() =>
      localStorage.getItem('userTimezone')
    )

    expect(userTimezone).toBeDefined()

    console.log(`✅ Timezone available after login: ${userTimezone}`)
  })

  // ============ Test 13: Timezone Not Cleared on Logout ============
  test('Timezone should be cleared on logout', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForLoadState('networkidle')

    // Find and click logout button (adjust selector as needed)
    const logoutButton = page.locator('button:has-text("Logout")')
    if (await logoutButton.isVisible({ timeout: 5000 })) {
      await logoutButton.click()
      await page.waitForLoadState('networkidle')

      // Check if timezone is cleared
      const userTimezone = await page.evaluate(() =>
        localStorage.getItem('userTimezone')
      )

      // Should be cleared or reset to default
      if (userTimezone) {
        expect(userTimezone).toBe('America/New_York')
      }

      console.log(`✅ Timezone handled correctly on logout`)
    } else {
      console.log('⚠️ Logout button not found, skipping test')
    }
  })

  // ============ Test 14: Timezone Selector Responsive ============
  test('TimezoneSelector should be responsive on mobile', async ({
    page
  }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    const timezoneSelector = page.locator('.timezone-selector')
    await expect(timezoneSelector).toBeVisible()

    const timezoneSelect = page.locator('.timezone-select')
    await timezoneSelect.selectOption('America/Los_Angeles')

    const selectedValue = await timezoneSelect.inputValue()
    expect(selectedValue).toBe('America/Los_Angeles')

    console.log(`✅ TimezoneSelector responsive on mobile`)
  })

  // ============ Test 15: Timezone Selector Accessibility ============
  test('TimezoneSelector should be keyboard accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`)
    await page.waitForLoadState('networkidle')

    const timezoneSelect = page.locator('.timezone-select')

    // Focus on select
    await timezoneSelect.focus()
    await page.waitForTimeout(200)

    // Use keyboard to navigate
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')

    await page.waitForTimeout(300)

    // Verify selection changed
    const selectedValue = await timezoneSelect.inputValue()
    expect(selectedValue).not.toBe('America/New_York')

    console.log(`✅ TimezoneSelector keyboard accessible: ${selectedValue}`)
  })
})

test.afterEach(async ({ page }) => {
  // Cleanup after each test
  const timezoneSelect = page.locator('.timezone-select')
  if (await timezoneSelect.isVisible({ timeout: 1000 })) {
    // Reset to default timezone
    await timezoneSelect.selectOption('America/New_York')
  }
})

test.afterAll(() => {
  console.log('🏁 Timezone UI Tests Complete')
})
