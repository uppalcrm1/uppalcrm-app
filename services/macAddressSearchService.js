/**
 * MAC Address Search Service
 * Searches across multiple billing portals for a given MAC address
 */

const { chromium } = require('playwright')
const crypto = require('crypto')

class MacAddressSearchService {
  constructor(query, organizationId, portalConfigs) {
    this.query = query
    this.organizationId = organizationId
    this.portalConfigs = portalConfigs
    this.browser = null
  }

  /**
   * Initialize browser instance
   */
  async initBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true })
    }
    return this.browser
  }

  /**
   * Close browser instance
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  /**
   * Get portal credentials for an organization
   */
  async getPortalCredentials(organizationId, portalId) {
    try {
      const result = await this.query(
        `SELECT * FROM billing_portal_credentials
         WHERE organization_id = $1 AND portal_id = $2`,
        [organizationId, portalId]
      )

      if (result.rows.length === 0) return null

      const credentials = result.rows[0]

      // Decrypt password
      if (credentials.password) {
        const encryptionKey = process.env.ENCRYPTION_KEY || 'default-secret-key-do-not-use-in-production'
        const key = crypto.createHash('sha256').update(encryptionKey).digest()

        // Extract IV from encrypted data
        const [ivHex, encryptedHex] = credentials.password.split(':')
        if (ivHex && encryptedHex) {
          const iv = Buffer.from(ivHex, 'hex')
          const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
          let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
          decrypted += decipher.final('utf8')
          credentials.password = decrypted
        }
      }

      return credentials
    } catch (error) {
      console.error(`Error fetching credentials for portal ${portalId}:`, error)
      return null
    }
  }

  /**
   * Decrypt credential (assuming they're encrypted in DB)
   */
  decryptCredential(encryptedValue, encryptionKey) {
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey)
      let decrypted = decipher.update(encryptedValue, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch (error) {
      console.error('Decryption failed:', error)
      return null
    }
  }

  /**
   * Wait for login form to be visible and ready
   */
  async waitForLoginForm(page, timeout = 15000) {
    const selectors = [
      'input[type="text"], input[name*="username" i], input[id*="username" i]',
      'input[placeholder*="username" i], input[placeholder*="email" i]',
    ]

    for (const selector of selectors) {
      try {
        console.log(`  🔍 Looking for selector: ${selector}`)
        await page.waitForSelector(selector, { timeout: 3000 })
        console.log(`  ✅ Found form element with selector: ${selector}`)
        return true
      } catch (e) {
        console.log(`  ⚠️  Selector not found: ${selector}`)
      }
    }

    // If no selector worked, log page content for debugging
    console.log('❌ Login form not found! Logging page content for debugging:')
    await this.debugPageStructure(page)

    throw new Error('Login form not found on page')
  }

  /**
   * Debug page structure - helps identify why login form can't be found
   */
  async debugPageStructure(page) {
    try {
      const inputs = await page.locator('input').count()
      const buttons = await page.locator('button').count()
      const forms = await page.locator('form').count()

      console.log(`\n📊 PAGE STRUCTURE DEBUG:`)
      console.log(`  Current URL: ${page.url()}`)
      console.log(`  Page title: ${await page.title()}`)
      console.log(`  Found ${forms} form(s), ${inputs} input field(s), ${buttons} button(s)`)

      // Log all input details
      if (inputs > 0) {
        console.log(`\n  📝 INPUT FIELDS FOUND:`)
        const inputElements = await page.locator('input').all()
        for (let i = 0; i < Math.min(10, inputElements.length); i++) {
          const type = await inputElements[i].getAttribute('type')
          const name = await inputElements[i].getAttribute('name')
          const id = await inputElements[i].getAttribute('id')
          const placeholder = await inputElements[i].getAttribute('placeholder')
          const cls = await inputElements[i].getAttribute('class')
          console.log(`    [${i}] type="${type}" name="${name}" id="${id}" placeholder="${placeholder}" class="${cls}"`)
        }
      }

      // Log all button details
      if (buttons > 0) {
        console.log(`\n  🔘 BUTTONS FOUND:`)
        const buttonElements = await page.locator('button').all()
        for (let i = 0; i < Math.min(5, buttonElements.length); i++) {
          const text = await buttonElements[i].textContent()
          const type = await buttonElements[i].getAttribute('type')
          const name = await buttonElements[i].getAttribute('name')
          const cls = await buttonElements[i].getAttribute('class')
          console.log(`    [${i}] text="${text.trim()}" type="${type}" name="${name}" class="${cls}"`)
        }
      }

      // Take screenshot for visual inspection
      const screenshotPath = `/tmp/ditto-login-debug-${Date.now()}.png`
      await page.screenshot({ path: screenshotPath })
      console.log(`\n  📸 Screenshot saved to: ${screenshotPath}`)

      // Log page source snippet
      const bodyText = await page.locator('body').textContent()
      const snippet = bodyText.substring(0, 500)
      console.log(`\n  📄 Page content snippet:\n${snippet}...`)

    } catch (error) {
      console.log(`  ⚠️  Could not debug page structure: ${error.message}`)
    }
  }

  /**
   * Login to portal with retry logic and multiple selector attempts
   */
  async loginToPortal(page, credentials, maxRetries = 2) {
    let lastError

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`  📝 Login attempt ${attempt}/${maxRetries}`)

        // Try multiple selectors for username field
        const usernameSelectors = [
          'input[name*="username" i]',
          'input[name*="email" i]',
          'input[id*="username" i]',
          'input[placeholder*="username" i]',
          'input[placeholder*="email" i]',
          'input[type="text"]', // Fallback
        ]

        let usernameFilled = false
        for (const selector of usernameSelectors) {
          try {
            const element = page.locator(selector).first()
            await element.waitFor({ state: 'visible', timeout: 5000 })
            await element.fill(credentials.username)
            console.log(`  ✅ Username filled using selector: ${selector}`)
            usernameFilled = true
            break
          } catch (e) {
            // Continue to next selector
          }
        }

        if (!usernameFilled) {
          throw new Error('Could not find or fill username field')
        }

        // Fill password field
        const passwordSelectors = [
          'input[name*="password" i]',
          'input[id*="password" i]',
          'input[placeholder*="password" i]',
          'input[type="password"]',
        ]

        let passwordFilled = false
        for (const selector of passwordSelectors) {
          try {
            const element = page.locator(selector).first()
            await element.waitFor({ state: 'visible', timeout: 5000 })
            await element.fill(credentials.password)
            console.log(`  ✅ Password filled using selector: ${selector}`)
            passwordFilled = true
            break
          } catch (e) {
            // Continue to next selector
          }
        }

        if (!passwordFilled) {
          throw new Error('Could not find or fill password field')
        }

        // Click login button
        const loginButtonSelectors = [
          'button:has-text("Log In")',
          'button:has-text("Login")',
          'button:has-text("Sign In")',
          'button[type="submit"]',
          'input[type="submit"]',
        ]

        let buttonClicked = false
        for (const selector of loginButtonSelectors) {
          try {
            const element = page.locator(selector).first()
            await element.waitFor({ state: 'visible', timeout: 5000 })
            await element.click()
            console.log(`  ✅ Login button clicked using selector: ${selector}`)
            buttonClicked = true
            break
          } catch (e) {
            // Continue to next selector
          }
        }

        if (!buttonClicked) {
          throw new Error('Could not find or click login button')
        }

        // Wait for navigation after login (with shorter timeout)
        await Promise.race([
          page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
          page.waitForTimeout(5000),
        ])

        // Verify we're logged in (check for common success indicators)
        await page.waitForTimeout(2000)
        const isLoggedIn = await this.verifyLogin(page)

        if (isLoggedIn) {
          console.log(`  ✅ Login verification successful`)
          return true
        } else {
          throw new Error('Login verification failed')
        }

      } catch (error) {
        lastError = error
        console.log(`  ⚠️  Login attempt ${attempt} failed: ${error.message}`)

        if (attempt < maxRetries) {
          console.log(`  ⏳ Waiting 2 seconds before retry...`)
          await page.waitForTimeout(2000)
        }
      }
    }

    throw new Error(`Login failed after ${maxRetries} attempts: ${lastError?.message}`)
  }

  /**
   * Verify that login was successful
   */
  async verifyLogin(page) {
    try {
      // Check if we're still on login page
      const url = page.url()
      if (url.includes('/login') || url.includes('/signin')) {
        console.log(`  📍 Still on login page: ${url}`)
        return false
      }

      // Check for common logout/profile elements (signs of successful login)
      const profileIndicators = [
        'a:has-text("Logout")',
        'a:has-text("Sign Out")',
        'button:has-text("Logout")',
        '[class*="profile"], [id*="profile"]',
        '[class*="user-menu"], [id*="user-menu"]',
      ]

      for (const indicator of profileIndicators) {
        const found = await page.locator(indicator).first().isVisible({ timeout: 2000 }).catch(() => false)
        if (found) {
          console.log(`  ✅ Found logout indicator: ${indicator}`)
          return true
        }
      }

      // If we're not on login page and made progress, consider it success
      console.log(`  ℹ️  Login appears successful (not on login page)`)
      return true
    } catch (error) {
      console.log(`  ⚠️  Could not verify login: ${error.message}`)
      return true // Give benefit of doubt
    }
  }

  /**
   * Search for MAC address in a single portal
   */
  async searchPortal(portalConfig, credentials, macAddress, timeout = 60000) {
    let page = null
    try {
      console.log(`🔍 Starting search in ${portalConfig.name}...`)
      const browser = await this.initBrowser()
      page = await browser.newPage()
      page.setDefaultTimeout(timeout)

      // Navigate to login page
      const loginUrl = `${portalConfig.url}${portalConfig.loginPath}`
      console.log(`📍 Navigating to: ${loginUrl}`)
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
        console.log('⚠️  Network idle timeout, continuing anyway...')
      })

      // Wait for login form to be ready
      console.log(`⏳ Waiting for login form to be ready...`)
      await this.waitForLoginForm(page, 10000)

      // Login with retry logic
      console.log(`🔐 Logging in with username: ${credentials.username}`)
      await this.loginToPortal(page, credentials)

      console.log(`✅ Login successful`)

      // Close modal if present
      try {
        const modal = page.locator('#myModal, .modal, [role="dialog"]').first()
        const isVisible = await modal.isVisible({ timeout: 2000 }).catch(() => false)
        if (isVisible) {
          console.log(`📭 Closing modal...`)
          const closeButton = page.locator('button[data-dismiss="modal"], button.close, button[aria-label="Close"]').first()
          await closeButton.click({ timeout: 2000 }).catch(() => {
            console.log(`⚠️  Could not close modal with button`)
          })
          await page.waitForTimeout(1000)
        }
      } catch (e) {
        console.log(`ℹ️  No modal to close`)
      }

      // Navigate to users list
      const usersUrl = `${portalConfig.url}${portalConfig.usersListPath}`
      console.log(`📋 Navigating to users list: ${usersUrl}`)
      await page.goto(usersUrl)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Search for MAC address
      console.log(`🔎 Searching for MAC: ${macAddress}`)
      const searchInputs = await page.locator('input[type="text"], input[placeholder*="search" i]').all()
      if (searchInputs.length > 0) {
        await searchInputs[0].fill(macAddress)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(1000)
        console.log(`✍️  Search input filled and submitted`)
      } else {
        console.warn(`⚠️  No search input found on page`)
      }

      // Extract results from table
      const results = []
      const rows = await page.locator(portalConfig.tableConfig.rowSelector).all()
      console.log(`📊 Found ${rows.length} rows in table`)

      for (const row of rows) {
        const rowText = await row.textContent()

        // Check if this row contains the MAC address
        if (rowText && rowText.includes(macAddress)) {
          console.log(`✨ Found matching MAC in row!`)
          const cells = await row.locator('td, [role="gridcell"]').all()

          const result = {
            portalId: portalConfig.id,
            portalName: portalConfig.name,
            macAddress: macAddress,
            accountName: cells[portalConfig.tableConfig.nameColumn] ? await cells[portalConfig.tableConfig.nameColumn].textContent() : 'N/A',
            status: cells[portalConfig.tableConfig.statusColumn] ? await cells[portalConfig.tableConfig.statusColumn].textContent() : 'N/A',
            expiryDate: cells[portalConfig.tableConfig.expiryColumn] ? await cells[portalConfig.tableConfig.expiryColumn].textContent() : 'N/A',
            foundAt: new Date().toISOString(),
          }

          // Clean up values
          result.accountName = result.accountName?.trim() || 'N/A'
          result.status = result.status?.trim() || 'N/A'
          result.expiryDate = result.expiryDate?.trim() || 'N/A'

          results.push(result)
        }
      }

      console.log(`📈 Search complete: Found ${results.length} matching MAC addresses`)

      return {
        success: true,
        portalName: portalConfig.name,
        found: results.length > 0,
        results: results,
        error: null,
      }
    } catch (error) {
      let errorMsg = error.message

      // Provide more helpful error messages
      if (error.message.includes('Timeout')) {
        errorMsg = `Portal timeout: ${error.message}. The portal took too long to respond. Try increasing the timeout or check portal connectivity.`
      } else if (error.message.includes('Login')) {
        errorMsg = `Login failed: ${error.message}. Check credentials or verify the login page structure hasn't changed.`
      } else if (error.message.includes('not found')) {
        errorMsg = `Element not found: ${error.message}. The portal page structure may have changed.`
      } else if (error.message.includes('Navigation')) {
        errorMsg = `Navigation failed: ${error.message}. The portal may be unreachable.`
      }

      console.error(`❌ Error searching portal ${portalConfig.name}: ${errorMsg}`)
      console.error(`Full error:`, error.message)

      return {
        success: false,
        portalName: portalConfig.name,
        found: false,
        results: [],
        error: errorMsg,
        errorType: error.name,
      }
    } finally {
      console.log(`🧹 Cleaning up resources for ${portalConfig.name}`)
      if (page) {
        try {
          await page.close()
        } catch (e) {
          console.log(`⚠️  Error closing page:`, e.message)
        }
      }
    }
  }

  /**
   * Search MAC address across all portals for an organization
   */
  async searchAcrossPortals(organizationId, macAddress) {
    const results = {
      macAddress: macAddress,
      searchStarted: new Date().toISOString(),
      portalResults: [],
      totalFound: 0,
      status: 'searching',
    }

    try {
      // Filter enabled portals
      const enabledPortals = this.portalConfigs.portals.filter(p => p.enabled)

      // Search each portal in parallel
      const searchPromises = enabledPortals.map(async (portal) => {
        const credentials = await this.getPortalCredentials(organizationId, portal.id)

        if (!credentials) {
          return {
            success: false,
            portalName: portal.name,
            found: false,
            results: [],
            error: 'No credentials configured',
          }
        }

        return this.searchPortal(portal, credentials, macAddress, portal.timeout)
      })

      const portalResults = await Promise.allSettled(searchPromises)

      // Collect results
      for (const result of portalResults) {
        if (result.status === 'fulfilled') {
          results.portalResults.push(result.value)
          if (result.value.found) {
            results.totalFound += result.value.results.length
          }
        } else {
          results.portalResults.push({
            success: false,
            error: 'Search failed: ' + result.reason?.message,
          })
        }
      }

      results.status = 'completed'
      results.searchCompleted = new Date().toISOString()

      return results
    } catch (error) {
      console.error('MAC address search failed:', error)
      return {
        ...results,
        status: 'error',
        error: error.message,
      }
    }
  }

  /**
   * Save search result to history (for audit/analytics)
   */
  async saveSearchHistory(organizationId, searchData) {
    try {
      await this.query(
        `INSERT INTO mac_search_history (organization_id, mac_address, results, total_found, searched_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          organizationId,
          searchData.macAddress,
          JSON.stringify(searchData.portalResults),
          searchData.totalFound,
        ]
      )
      return true
    } catch (error) {
      console.error('Error saving search history:', error)
      return false
    }
  }
}

module.exports = MacAddressSearchService
