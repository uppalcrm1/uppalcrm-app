import { test, expect } from '@playwright/test'

const BASE_URL = 'https://uppalcrm-frontend-devtest.onrender.com'

test('Debug: Try actual login with provided credentials', async ({ page }) => {
  console.log('\n🔓 Starting login test...')
  await page.goto(`${BASE_URL}/login`)
  console.log('✅ Navigated to login page')

  console.log('⏳ Waiting for network idle...')
  await page.waitForLoadState('networkidle')
  console.log('✅ Network idle')

  console.log('📧 Filling email: admin@staging.uppalcrm.com')
  const emailInput = page.locator('input[type="email"]').first()
  await emailInput.waitFor({ state: 'visible', timeout: 10000 })
  await emailInput.fill('admin@staging.uppalcrm.com')
  console.log('✅ Email filled')

  console.log('🔑 Filling password: staging123')
  const passwordInput = page.locator('input[type="password"]').first()
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 })
  await passwordInput.fill('staging123')
  console.log('✅ Password filled')

  console.log('🚀 Clicking sign in button')
  const signInButton = page.locator('button[type="submit"]').first()
  await signInButton.waitFor({ state: 'visible', timeout: 10000 })
  await signInButton.click()
  console.log('✅ Button clicked')

  console.log('⏳ Waiting for dashboard...')
  try {
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 30000 })
    console.log('✅ Successfully logged in! Redirected to dashboard')
    console.log('📍 Current URL:', page.url())

    // Check if we can get auth token from localStorage
    const token = await page.evaluate(() => localStorage.getItem('authToken'))
    if (token) {
      console.log(`✅ Auth token found: ${token.substring(0, 30)}...`)
    } else {
      console.log('⚠️ No auth token in localStorage')
    }

    // Check if we can get user data
    const userData = await page.evaluate(() => localStorage.getItem('user'))
    if (userData) {
      const user = JSON.parse(userData)
      console.log(`✅ User data found: ${user.email}`)
    } else {
      console.log('⚠️ No user data in localStorage')
    }
  } catch (error) {
    console.log('❌ Login failed or timeout')
    console.log('📍 Current URL:', page.url())
    console.log('❌ Error:', error.message)

    // Take screenshot for debugging
    await page.screenshot({ path: 'debug-login-failed.png' })
    console.log('📸 Screenshot saved: debug-login-failed.png')

    throw error
  }
})
