/**
 * MAC Address Search Routes
 * Endpoints for searching MAC addresses across billing portals
 */

const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middleware/auth')
const MacAddressSearchService = require('../services/macAddressSearchService')
const portalConfigs = require('../config/billingPortals')

/**
 * POST /api/mac-search
 * Search for a MAC address across all configured portals
 */
router.post('/search', authenticateToken, async (req, res) => {
  try {
    const { macAddress } = req.body
    const organizationId = req.user.organization_id
    const { query } = require('../database/connection')

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

    // Initialize search service
    const searchService = new MacAddressSearchService(query, organizationId, portalConfigs)

    try {
      // Perform search
      const searchResults = await searchService.searchAcrossPortals(organizationId, macAddress)

      // Save to history
      await searchService.saveSearchHistory(organizationId, searchResults)

      // Send final results
      res.json(searchResults)
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

/**
 * POST /api/mac-search/quick
 * Quick search (non-blocking) - returns search ID for polling
 */
router.post('/quick', authenticateToken, async (req, res) => {
  try {
    const { macAddress } = req.body
    const organizationId = req.user.organization_id
    const { query } = require('../database/connection')
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
    const { query } = require('../database/connection')

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
    const { query } = require('../database/connection')
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
    const { query } = require('../database/connection')

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
    // Use first 32 bytes of key for AES-256
    const key = crypto.createHash('sha256').update(encryptionKey).digest()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    let encrypted = cipher.update(password, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    // Prepend IV to encrypted data (IV is public, only key is secret)
    encrypted = iv.toString('hex') + ':' + encrypted

    // Save to database using UPSERT
    await query(
      `INSERT INTO billing_portal_credentials (organization_id, portal_id, username, password)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id, portal_id)
       DO UPDATE SET username = $3, password = $4, updated_at = NOW()`,
      [organizationId, portalId, username, encrypted]
    )

    res.json({ success: true, message: 'Credentials saved successfully' })
  } catch (error) {
    console.error('Error saving credentials:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/mac-search/portals
 * Get list of available portals (default + custom)
 */
router.get('/portals', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.user.organization_id
    const { query } = require('../database/connection')

    // Get list of enabled default portals
    const enabledPortals = portalConfigs.portals.filter(p => p.enabled).map(p => ({
      id: p.id,
      name: p.name,
      url: p.url,
      isCustom: false
    }))

    // Get custom portals for this organization
    const customPortalsResult = await query(
      `SELECT id, name, url FROM custom_portals
       WHERE organization_id = $1 AND is_active = true
       ORDER BY created_at DESC`,
      [organizationId]
    )

    const customPortals = (customPortalsResult.rows || []).map(p => ({
      id: p.id,
      name: p.name,
      url: p.url,
      isCustom: true
    }))

    // Combine both lists
    const allPortals = [...enabledPortals, ...customPortals]

    // Check which ones have credentials configured and get username
    const credentialsResult = await query(
      `SELECT portal_id, username FROM billing_portal_credentials
       WHERE organization_id = $1`,
      [organizationId]
    )

    const credentialsByPortal = {}
    credentialsResult.rows.forEach(row => {
      credentialsByPortal[row.portal_id] = {
        configured: true,
        username: row.username
      }
    })

    const portalsWithStatus = allPortals.map(p => ({
      ...p,
      configured: !!credentialsByPortal[p.id],
      username: credentialsByPortal[p.id]?.username || ''
    }))

    res.json({
      portals: portalsWithStatus,
      totalPortals: portalsWithStatus.length,
      configuredPortals: credentialsResult.rows.length,
    })
  } catch (error) {
    console.error('Error fetching portals:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/mac-search/portals
 * Create a custom portal (admin only)
 */
router.post('/portals', authenticateToken, async (req, res) => {
  try {
    const { name, url } = req.body
    const organizationId = req.user.organization_id
    const { query } = require('../database/connection')

    // Validate input
    if (!name || !url) {
      return res.status(400).json({ error: 'Portal name and URL are required' })
    }

    // Check if user is admin
    const userResult = await query(
      `SELECT role FROM users WHERE id = $1 AND organization_id = $2`,
      [req.user.id, organizationId]
    )

    if (userResult.rows.length === 0 || (userResult.rows[0].role !== 'admin' && userResult.rows[0].role !== 'super_admin')) {
      return res.status(403).json({ error: 'Only admins can create portals' })
    }

    // Create custom portal
    const result = await query(
      `INSERT INTO custom_portals (organization_id, name, url, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id, name, url, created_at`,
      [organizationId, name, url]
    )

    res.status(201).json({
      message: 'Portal created successfully',
      portal: result.rows[0]
    })
  } catch (error) {
    console.error('Error creating portal:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/mac-search/portals/:portalId
 * Delete a custom portal (admin only)
 */
router.delete('/portals/:portalId', authenticateToken, async (req, res) => {
  try {
    const { portalId } = req.params
    const organizationId = req.user.organization_id
    const { query } = require('../database/connection')

    // Check if user is admin
    const userResult = await query(
      `SELECT role FROM users WHERE id = $1 AND organization_id = $2`,
      [req.user.id, organizationId]
    )

    if (userResult.rows.length === 0 || (userResult.rows[0].role !== 'admin' && userResult.rows[0].role !== 'super_admin')) {
      return res.status(403).json({ error: 'Only admins can delete portals' })
    }

    // Verify portal belongs to this organization
    const portalResult = await query(
      `SELECT id FROM custom_portals WHERE id = $1 AND organization_id = $2`,
      [portalId, organizationId]
    )

    if (portalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Portal not found' })
    }

    // Soft delete the portal
    await query(
      `UPDATE custom_portals SET is_active = false WHERE id = $1`,
      [portalId]
    )

    res.json({ message: 'Portal deleted successfully' })
  } catch (error) {
    console.error('Error deleting portal:', error)
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
