import { test } from '@playwright/test'

const BASE_URL = 'https://uppalcrm-frontend-devtest.onrender.com'

test('Debug: Inspect login page structure', async ({ page }) => {
  console.log('\n🔍 Navigating to login page...')
  await page.goto(`${BASE_URL}/login`)

  console.log('⏳ Waiting for network idle...')
  await page.waitForLoadState('networkidle')

  console.log('📄 Page title:', await page.title())
  console.log('📍 Page URL:', page.url())

  // Take screenshot
  await page.screenshot({ path: 'debug-screenshot.png' })
  console.log('✅ Screenshot saved: debug-screenshot.png')

  // Get all input fields
  const inputs = await page.locator('input').all()
  console.log(`\n📝 Found ${inputs.length} input fields:`)

  for (let i = 0; i < inputs.length; i++) {
    const type = await inputs[i].getAttribute('type')
    const name = await inputs[i].getAttribute('name')
    const id = await inputs[i].getAttribute('id')
    const placeholder = await inputs[i].getAttribute('placeholder')
    console.log(`  [${i}] type="${type}", name="${name}", id="${id}", placeholder="${placeholder}"`)
  }

  // Get all buttons
  const buttons = await page.locator('button').all()
  console.log(`\n🔘 Found ${buttons.length} buttons:`)

  for (let i = 0; i < buttons.length; i++) {
    const text = await buttons[i].textContent()
    const type = await buttons[i].getAttribute('type')
    console.log(`  [${i}] type="${type}", text="${text?.trim()}"`)
  }

  // Try to find form elements
  const forms = await page.locator('form').all()
  console.log(`\n📋 Found ${forms.length} forms`)

  // Check page content
  const bodyText = await page.locator('body').textContent()
  if (bodyText && bodyText.includes('Email')) {
    console.log('\n✅ Page contains "Email" text')
  } else {
    console.log('\n⚠️  Page does NOT contain "Email" text')
  }

  if (bodyText && bodyText.includes('Password')) {
    console.log('✅ Page contains "Password" text')
  } else {
    console.log('⚠️  Page does NOT contain "Password" text')
  }

  // Try different selectors
  console.log('\n🎯 Testing different selectors:')

  const selectors = [
    'input[type="email"]',
    'input[type="password"]',
    'input[name="email"]',
    'input[name="password"]',
    'button[type="submit"]',
    'button:has-text("Login")',
    'button:has-text("Sign In")',
    '#email',
    '#password',
  ]

  for (const selector of selectors) {
    try {
      const found = await page.locator(selector)
      const count = await found.count()
      if (count > 0) {
        console.log(`  ✅ "${selector}" found (${count} element(s))`)
      } else {
        console.log(`  ❌ "${selector}" NOT found`)
      }
    } catch (err) {
      console.log(`  ❌ "${selector}" error: ${err.message}`)
    }
  }
})
