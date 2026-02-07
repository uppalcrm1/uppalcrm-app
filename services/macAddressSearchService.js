/**
 * MAC Address Search Service
 * Searches across multiple billing portals for a given MAC address
 */

const { chromium } = require('playwright')
const crypto = require('crypto')

class MacAddressSearchService {
  constructor(supabase, portalConfigs) {
    this.supabase = supabase
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
      const { data, error } = await this.supabase
        .from('billing_portal_credentials')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('portal_id', portalId)
        .single()

      if (error) throw error
      return data
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
      const browser = await this.initBrowser()
      page = await browser.newPage()
      page.setDefaultTimeout(timeout)

      // Navigate to login page
      await page.goto(`${portalConfig.url}${portalConfig.loginPath}`)
      await page.waitForLoadState('networkidle')

      // Login
      await page.locator('input[type="text"]').first().fill(credentials.username)
      await page.locator('input[type="password"]').first().fill(credentials.password)
      await page.locator('button:has-text("Log In"), button[type="submit"]').click()
      await page.waitForLoadState('networkidle')

      // Close modal if present
      if (await page.locator('#myModal, .modal').first().isVisible({ timeout: 1000 }).catch(() => false)) {
        await page.locator('button[data-dismiss="modal"], button.close').first().click()
        await page.waitForTimeout(500)
      }

      // Navigate to users list
      await page.goto(`${portalConfig.url}${portalConfig.usersListPath}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Search for MAC address
      const searchInputs = await page.locator('input[type="text"], input[placeholder*="search" i]').all()
      if (searchInputs.length > 0) {
        await searchInputs[0].fill(macAddress)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(1000)
      }

      // Extract results from table
      const results = []
      const rows = await page.locator(portalConfig.tableConfig.rowSelector).all()

      for (const row of rows) {
        const rowText = await row.textContent()

        // Check if this row contains the MAC address
        if (rowText && rowText.includes(macAddress)) {
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

      return {
        success: true,
        portalName: portalConfig.name,
        found: results.length > 0,
        results: results,
        error: null,
      }
    } catch (error) {
      console.error(`Error searching portal ${portalConfig.name}:`, error)
      return {
        success: false,
        portalName: portalConfig.name,
        found: false,
        results: [],
        error: error.message,
      }
    } finally {
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

      // Check organization setting to see if feature is enabled
      const { data: orgSettings } = await this.supabase
        .from('organization_settings')
        .select('mac_search_enabled')
        .eq('id', organizationId)
        .single()

      if (orgSettings && !orgSettings.mac_search_enabled) {
        return {
          ...results,
          status: 'disabled',
          error: 'MAC search feature is not enabled for this organization',
        }
      }

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
      const { error } = await this.supabase.from('mac_search_history').insert({
        organization_id: organizationId,
        mac_address: searchData.macAddress,
        results: searchData.portalResults,
        total_found: searchData.totalFound,
        searched_at: new Date().toISOString(),
      })

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error saving search history:', error)
      return false
    }
  }
}

module.exports = MacAddressSearchService
