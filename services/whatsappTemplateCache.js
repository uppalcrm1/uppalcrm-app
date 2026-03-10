const twilio = require('twilio');
const db = require('../database/connection');

/**
 * WhatsApp Template Cache Service
 * Fetches templates from Twilio Content API and caches for 5 minutes
 */
class WhatsAppTemplateCache {
  constructor() {
    this.cache = new Map(); // orgId -> { templates, expiresAt }
    this.CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get cached templates or fetch fresh from Twilio
   */
  async getTemplates(organizationId, twilioClient) {
    const cacheKey = organizationId;
    const cachedData = this.cache.get(cacheKey);

    // Return cached data if not expired
    if (cachedData && Date.now() < cachedData.expiresAt) {
      console.log('📦 Returning cached WhatsApp templates for org:', organizationId);
      return cachedData.templates;
    }

    // Fetch fresh templates from Twilio
    console.log('🔄 Fetching fresh WhatsApp templates from Twilio for org:', organizationId);
    const templates = await this.fetchFromTwilio(twilioClient);

    // Cache the results
    this.cache.set(cacheKey, {
      templates,
      expiresAt: Date.now() + this.CACHE_DURATION_MS
    });

    console.log(`✅ Cached ${templates.length} WhatsApp templates (expires in 5 min)`);
    return templates;
  }

  /**
   * Fetch templates from Twilio Content API
   * Filters for approved WhatsApp templates
   */
  async fetchFromTwilio(twilioClient) {
    try {
      console.log('\n🔍 === TWILIO CONTENT API FETCH START ===');

      // Check if content API exists
      if (!twilioClient.content || !twilioClient.content.v1 || !twilioClient.content.v1.contents) {
        console.error('❌ Twilio content API not available on this client');
        return [];
      }

      // Fetch all content items from Twilio
      console.log('📡 Calling twilioClient.content.v1.contents.list()...');
      const contents = await twilioClient.content.v1.contents.list({ limit: 100 });

      console.log(`✅ Received ${contents.length} total items from Twilio`);
      if (contents.length === 0) {
        console.log('⚠️  No content items found in Twilio account');
        return [];
      }

      const templates = [];

      // Filter and map each content item
      for (let i = 0; i < contents.length; i++) {
        const content = contents[i];
        console.log(`\n📄 [${i + 1}/${contents.length}] Processing: ${content.friendlyName}`);
        console.log(`   SID: ${content.sid}`);
        console.log(`   Language: ${content.language}`);

        // Get friendly name (use camelCase property)
        const displayName = content.friendlyName || 'Unnamed Template';
        console.log(`   Display Name: ${displayName}`);

        // Extract body from types.twilio/text.body
        let bodyPreview = '';
        if (content.types && content.types['twilio/text'] && content.types['twilio/text'].body) {
          bodyPreview = content.types['twilio/text'].body;
          console.log(`   Body Preview: ${bodyPreview.substring(0, 80)}...`);
        } else {
          console.log(`   ⚠️  No body text found in types`);
        }

        // Fetch approval status for this content using direct REST API
        console.log(`   📋 Fetching approval status via REST API...`);
        let whatsappApprovalStatus = null;

        try {
          // Use the approval endpoint from the content object
          const approvalUrl = content.links.approval_fetch;
          console.log(`   Approval URL: ${approvalUrl}`);

          // Make direct HTTP request to get approvals
          const response = await twilioClient.request({
            method: 'GET',
            uri: approvalUrl
          });

          const approvals = response.approval_requests || [];
          console.log(`   Found ${approvals.length} approval requests`);

          if (approvals && approvals.length > 0) {
            // Find WhatsApp approval
            const whatsappApproval = approvals.find(a => a.channel === 'whatsapp');
            if (whatsappApproval) {
              whatsappApprovalStatus = whatsappApproval.status;
              console.log(`   ✅ WhatsApp Approval Status: ${whatsappApprovalStatus}`);
            } else {
              console.log(`   ⏭️  No WhatsApp approval request found`);
              console.log(`   Available channels: ${approvals.map(a => a.channel).join(', ')}`);
              continue;
            }
          } else {
            console.log(`   ⏭️  No approval requests found for this content`);
            continue;
          }
        } catch (approvalError) {
          console.log(`   ⚠️  Could not fetch approval status: ${approvalError.message}`);
          // Don't continue - try to extract approval status from the response error
          // For now, skip this template if we can't verify approval
          continue;
        }

        // Only include approved templates
        if (whatsappApprovalStatus !== 'approved') {
          console.log(`   ⏭️  Skipping - WhatsApp status is '${whatsappApprovalStatus}' (not 'approved')`);
          continue;
        }

        // Map Twilio template to our format
        const template = {
          template_sid: content.sid, // Content SID (e.g., HX...)
          display_name: displayName,
          body_preview: bodyPreview,
          category: content.language || 'general',
          approval_status: whatsappApprovalStatus,
          created_at: content.dateCreated
        };

        templates.push(template);
        console.log(`   ✅ ADDED to templates`);
      }

      console.log(`\n🎯 === RESULT: ${templates.length} approved WhatsApp templates ===\n`);
      return templates;
    } catch (error) {
      console.error('\n❌ === TWILIO API ERROR ===');
      console.error('Error Message:', error.message);
      console.error('Error Code:', error.code);
      console.error('Full Error:', JSON.stringify(error, null, 2));
      console.error('=========================\n');
      // Return empty array on error - graceful degradation
      return [];
    }
  }

  /**
   * Invalidate cache for an organization
   * Useful when new templates are added in Twilio
   */
  invalidate(organizationId) {
    this.cache.delete(organizationId);
    console.log('🗑️ Cache invalidated for org:', organizationId);
  }

  /**
   * Invalidate all caches
   */
  invalidateAll() {
    this.cache.clear();
    console.log('🗑️ All template caches cleared');
  }

  /**
   * Get cache stats for monitoring
   */
  getStats() {
    return {
      cachedOrgs: this.cache.size,
      items: Array.from(this.cache.entries()).map(([orgId, data]) => ({
        orgId,
        templateCount: data.templates.length,
        expiresIn: Math.round((data.expiresAt - Date.now()) / 1000) + 's'
      }))
    };
  }
}

module.exports = new WhatsAppTemplateCache();
