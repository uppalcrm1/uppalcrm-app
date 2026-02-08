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
      await page.goto(loginUrl)
      await page.waitForLoadState('networkidle')

      // Login
      console.log(`🔐 Logging in with username: ${credentials.username}`)
      await page.locator('input[type="text"]').first().fill(credentials.username)
      await page.locator('input[type="password"]').first().fill(credentials.password)
      await page.locator('button:has-text("Log In"), button[type="submit"]').click()
      await page.waitForLoadState('networkidle')
      console.log(`✅ Login successful`)

      // Close modal if present
      if (await page.locator('#myModal, .modal').first().isVisible({ timeout: 1000 }).catch(() => false)) {
        await page.locator('button[data-dismiss="modal"], button.close').first().click()
        await page.waitForTimeout(500)
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
      console.error(`❌ Error searching portal ${portalConfig.name}:`, error.message)
      console.error(`Stack trace:`, error.stack)
      return {
        success: false,
        portalName: portalConfig.name,
        found: false,
        results: [],
        error: error.message,
      }
    } finally {
      console.log(`🧹 Cleaning up resources for ${portalConfig.name}`)
      if (page) {
        await page.close()
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
