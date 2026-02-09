/**
 * MAC Address Search Routes
 * Endpoints for searching MAC addresses across billing portals
 *
 * Uses PostgreSQL for data access, NOT Supabase
 * Route order: Specific routes MUST come before generic parameter routes
 */

const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middleware/auth')
const MacAddressSearchService = require('../services/macAddressSearchService')
const portalConfigs = require('../config/billingPortals')
const { query } = require('../database/connection')

/**
 * POST /api/mac-search/quick
 * Quick search (non-blocking) - returns search ID for polling
 */
router.post('/quick', authenticateToken, async (req, res) => {
  try {
    const { macAddress } = req.body
    const organizationId = req.user.organization_id
    const searchId = require('crypto').randomUUID()

    // Validate MAC address
    if (!macAddress || !/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(macAddress)) {
      return res.status(400).json({
        error: 'Invalid MAC address format',
      })
    }

    // Start background search (don't await)
    const searchService = new MacAddressSearchService(query, organizationId, portalConfigs)

    searchService.searchAcrossPortals(organizationId, macAddress).then(async (results) => {
      // Save results with search ID
      await query(
        `INSERT INTO mac_search_results (search_id, organization_id, mac_address, results, completed_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [searchId, organizationId, macAddress, JSON.stringify(results)]
      )

      await searchService.closeBrowser()
    })

    // Return search ID immediately
    res.json({
      status: 'searching',
      searchId: searchId,
      macAddress: macAddress,
    })
  } catch (error) {
    console.error('Quick search error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/mac-search/results/:searchId
 * Get results of a quick search
 */
router.get('/results/:searchId', authenticateToken, async (req, res) => {
  try {
    const { searchId } = req.params
    const organizationId = req.user.organization_id

    const result = await query(
      `SELECT * FROM mac_search_results
       WHERE search_id = $1 AND organization_id = $2`,
      [searchId, organizationId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Search results not found' })
    }

    const data = result.rows[0]
    res.json({
      status: data.completed_at ? 'completed' : 'searching',
      results: typeof data.results === 'string' ? JSON.parse(data.results) : data.results,
    })
  } catch (error) {
    console.error('Error fetching search results:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/mac-search/history
 * Get search history for organization
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.user.organization_id
    const { limit = 50, offset = 0 } = req.query

    const result = await query(
      `SELECT * FROM mac_search_history
       WHERE organization_id = $1
       ORDER BY searched_at DESC
       LIMIT $2 OFFSET $3`,
      [organizationId, parseInt(limit), parseInt(offset)]
    )

    res.json({
      results: result.rows || [],
      limit: parseInt(limit),
      offset: parseInt(offset),
    })
  } catch (error) {
    console.error('Error fetching search history:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/mac-search/portal-credentials
 * Save/update portal credentials for organization
 */
router.post('/portal-credentials', authenticateToken, async (req, res) => {
  try {
    const { portalId, username, password } = req.body
    const organizationId = req.user.organization_id

    // Check if user is admin
    const userResult = await query(
      `SELECT role FROM users WHERE id = $1 AND organization_id = $2`,
      [req.user.id, organizationId]
    )

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const userRole = userResult.rows[0].role
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only admins can manage portal credentials' })
    }

    // Encrypt password
    const crypto = require('crypto')
    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-secret-key-do-not-use-in-production'
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey.padEnd(32, '0')), iv)
    let encrypted = cipher.update(password, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const encryptedWithIv = iv.toString('hex') + ':' + encrypted

    // Save to database
    await query(
      `INSERT INTO billing_portal_credentials (organization_id, portal_id, username, password, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (organization_id, portal_id) DO UPDATE SET
       username = $3, password = $4, updated_at = NOW()`,
      [organizationId, portalId, username, encryptedWithIv]
    )

    res.json({ success: true, message: 'Credentials saved successfully' })
  } catch (error) {
    console.error('Error saving credentials:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/mac-search/portals
 * Get list of available portals
 */
router.get('/portals', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.user.organization_id

    // Get list of enabled portals
    const enabledPortals = portalConfigs.portals.filter(p => p.enabled).map(p => ({
      id: p.id,
      name: p.name,
      url: p.url,
      isCustom: p.isCustom || false,
    }))

    // Check which ones have credentials configured
    const result = await query(
      `SELECT portal_id FROM billing_portal_credentials
       WHERE organization_id = $1`,
      [organizationId]
    )

    const configuredPortalIds = (result.rows || []).map(c => c.portal_id)

    const portalsWithStatus = enabledPortals.map(p => ({
      ...p,
      configured: configuredPortalIds.includes(p.id),
    }))

    res.json({
      portals: portalsWithStatus,
      totalPortals: portalsWithStatus.length,
      configuredPortals: configuredPortalIds.length,
    })
  } catch (error) {
    console.error('Error fetching portals:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/mac-search/:macAddress
 * Search for a MAC address across all configured portals
 *
 * IMPORTANT: This route MUST be last because :macAddress is a generic parameter
 * that would match /history, /portals, /results, etc. if it came first!
 */
router.get('/:macAddress', authenticateToken, async (req, res) => {
  try {
    const { macAddress } = req.params
    const organizationId = req.user.organization_id

    // Validate MAC address format
    if (!macAddress || !/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(macAddress)) {
      return res.status(400).json({
        error: 'Invalid MAC address format. Expected format: 00:1A:79:B2:5A:58',
      })
    }

    // Check if organization has feature enabled
    const orgResult = await query(
      `SELECT mac_search_enabled FROM organizations WHERE id = $1`,
      [organizationId]
    )

    if (orgResult.rows.length === 0 || !orgResult.rows[0].mac_search_enabled) {
      return res.status(403).json({
        error: 'MAC search feature is not enabled for your organization',
      })
    }

    // Start search (this can be long-running)
    res.setHeader('Content-Type', 'application/json')

    // Send search started response
    res.write(JSON.stringify({ status: 'searching', macAddress }) + '\n')

    // Initialize search service (pass query function instead of supabase)
    const searchService = new MacAddressSearchService(query, organizationId, portalConfigs)

    try {
      // Perform search
      const searchResults = await searchService.searchAcrossPortals(organizationId, macAddress)

      // Save to history
      await query(
        `INSERT INTO mac_search_history (organization_id, mac_address, total_found, searched_at)
         VALUES ($1, $2, $3, NOW())`,
        [organizationId, macAddress, searchResults.totalFound || 0]
      )

      // Send final results
      res.write(JSON.stringify(searchResults) + '\n')
      res.end()
    } finally {
      // Clean up browser
      await searchService.closeBrowser()
    }
  } catch (error) {
    console.error('MAC search error:', error)
    res.status(500).json({
      error: 'Search failed: ' + error.message,
    })
  }
})

module.exports = router
