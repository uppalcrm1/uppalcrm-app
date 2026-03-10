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
      // Fetch all content items from Twilio
      const contents = await twilioClient.content.v1.contents.list({ limit: 100 });

      const templates = [];

      // Filter and map each content item
      for (const content of contents) {
        // Check if this content has approved WhatsApp status
        const whatsappApproval = content.approval?.whatsapp;

        if (!whatsappApproval || whatsappApproval !== 'approved') {
          continue; // Skip non-approved templates
        }

        // Extract body preview from template variables
        let bodyPreview = '';
        if (content.variables && Array.isArray(content.variables)) {
          // Find body in variables
          const bodyVar = content.variables.find(v => v.type === 'body');
          if (bodyVar && bodyVar.value) {
            bodyPreview = bodyVar.value;
          }
        }

        // Map Twilio template to our format
        const template = {
          template_sid: content.sid, // Content SID (e.g., HX...)
          display_name: content.friendly_name || 'Unnamed Template',
          body_preview: bodyPreview || content.friendly_name || '',
          category: content.language || 'general',
          approval_status: whatsappApproval,
          created_at: content.date_created
        };

        templates.push(template);
      }

      console.log(`📨 Found ${templates.length} approved WhatsApp templates from Twilio`);
      return templates;
    } catch (error) {
      console.error('❌ Error fetching templates from Twilio:', error);
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
