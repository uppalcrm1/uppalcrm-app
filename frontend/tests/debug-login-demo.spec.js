import { test, expect } from '@playwright/test'

const BASE_URL = 'https://uppalcrm-frontend-devtest.onrender.com'

test('Debug: Try login with demo credentials shown on page', async ({ page }) => {
  console.log('\n🔓 Starting login with demo credentials...')
  await page.goto(`${BASE_URL}/login`)
  console.log('✅ Navigated to login page')

  await page.waitForLoadState('networkidle')

  console.log('📧 Filling email: admin@testcompany.com')
  const emailInput = page.locator('input[type="email"]').first()
  await emailInput.fill('admin@testcompany.com')
  console.log('✅ Email filled')

  console.log('🔑 Filling password: SecurePassword123!')
  const passwordInput = page.locator('input[type="password"]').first()
  await passwordInput.fill('SecurePassword123!')
  console.log('✅ Password filled')

  console.log('🚀 Clicking sign in button')
  const signInButton = page.locator('button[type="submit"]').first()
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
    }

    // Check if we can get user data
    const userData = await page.evaluate(() => localStorage.getItem('user'))
    if (userData) {
      const user = JSON.parse(userData)
      console.log(`✅ User data found: ${user.email}`)
      console.log(`✅ User timezone: ${user.timezone}`)
    }
  } catch (error) {
    console.log('❌ Login still failed')
    console.log('📍 Current URL:', page.url())

    // Take screenshot
    await page.screenshot({ path: 'debug-login-demo-failed.png' })
    throw error
  }
})
