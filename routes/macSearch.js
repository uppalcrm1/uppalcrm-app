/**
 * MAC Address Search Routes
 * Endpoints for searching MAC addresses across billing portals
 */

const express = require('express')
const router = express.Router()
const { authenticateToken } = require('./middleware/auth')
const MacAddressSearchService = require('./services/macAddressSearchService')
const portalConfigs = require('./config/billingPortals')

/**
 * POST /api/mac-search
 * Search for a MAC address across all configured portals
 */
router.post('/search', authenticateToken, async (req, res) => {
  try {
    const { macAddress } = req.body
    const organizationId = req.user.organization_id

    // Validate MAC address format
    if (!macAddress || !/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(macAddress)) {
      return res.status(400).json({
        error: 'Invalid MAC address format. Expected format: 00:1A:79:B2:5A:58',
      })
    }

    // Check if organization has feature enabled
    const { data: org, error: orgError } = await req.supabase
      .from('organizations')
      .select('mac_search_enabled')
      .eq('id', organizationId)
      .single()

    if (orgError || !org?.mac_search_enabled) {
      return res.status(403).json({
        error: 'MAC search feature is not enabled for your organization',
      })
    }

    // Start search (this can be long-running)
    res.setHeader('Content-Type', 'application/json')

    // Send search started response
    res.write(JSON.stringify({ status: 'searching', macAddress }) + '\n')

    // Initialize search service
    const searchService = new MacAddressSearchService(req.supabase, portalConfigs)

    try {
      // Perform search
      const searchResults = await searchService.searchAcrossPortals(organizationId, macAddress)

      // Save to history
      await searchService.saveSearchHistory(organizationId, searchResults)

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
    const searchService = new MacAddressSearchService(req.supabase, portalConfigs)

    searchService.searchAcrossPortals(organizationId, macAddress).then(async (results) => {
      // Save results with search ID
      await req.supabase.from('mac_search_results').insert({
        search_id: searchId,
        organization_id: organizationId,
        mac_address: macAddress,
        results: results,
        completed_at: new Date().toISOString(),
      })

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

    const { data, error } = await req.supabase
      .from('mac_search_results')
      .select('*')
      .eq('search_id', searchId)
      .eq('organization_id', organizationId)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Search results not found' })
    }

    res.json({
      status: data.completed_at ? 'completed' : 'searching',
      results: data.results,
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

    const { data, error } = await req.supabase
      .from('mac_search_history')
      .select('*')
      .eq('organization_id', organizationId)
      .order('searched_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    res.json({
      results: data || [],
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
    const { data: user } = await req.supabase
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .single()

    if (user?.role !== 'admin' && user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only admins can manage portal credentials' })
    }

    // Encrypt password
    const crypto = require('crypto')
    const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY || 'default-key')
    let encrypted = cipher.update(password, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // Save to database
    const { error } = await req.supabase.from('billing_portal_credentials').upsert({
      organization_id: organizationId,
      portal_id: portalId,
      username: username,
      password: encrypted,
      updated_at: new Date().toISOString(),
    })

    if (error) throw error

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
    }))

    // Check which ones have credentials configured
    const { data: credentials } = await req.supabase
      .from('billing_portal_credentials')
      .select('portal_id')
      .eq('organization_id', organizationId)

    const configuredPortalIds = (credentials || []).map(c => c.portal_id)

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

module.exports = router
