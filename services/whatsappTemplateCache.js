const twilio = require('twilio');

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
      return cachedData.templates;
    }

    // Fetch fresh templates from Twilio
    const templates = await this.fetchFromTwilio(twilioClient);

    // Cache the results
    this.cache.set(cacheKey, {
      templates,
      expiresAt: Date.now() + this.CACHE_DURATION_MS
    });

    return templates;
  }

  /**
   * Fetch templates from Twilio Content API
   * Returns all available content items (Twilio only returns approved templates)
   */
  async fetchFromTwilio(twilioClient) {
    try {
      // Fetch all content items from Twilio
      const contents = await twilioClient.content.v1.contents.list({ limit: 100 });

      const templates = [];

      // Map each content item to our template format
      for (const content of contents) {
        const template = {
          template_sid: content.sid,
          display_name: content.friendlyName || 'Unnamed Template',
          body_preview: content.types && content.types['twilio/text']
            ? content.types['twilio/text'].body
            : '',
          category: content.language || 'general'
        };

        templates.push(template);
      }

      return templates;
    } catch (error) {
      console.error('Error fetching WhatsApp templates from Twilio:', error.message);
      // Return empty array on error - graceful degradation
      return [];
    }
  }

  /**
   * Invalidate cache for an organization
   */
  invalidate(organizationId) {
    this.cache.delete(organizationId);
  }

  /**
   * Invalidate all caches
   */
  invalidateAll() {
    this.cache.clear();
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
