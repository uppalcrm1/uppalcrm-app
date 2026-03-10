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
        console.log(`\n📄 [${i + 1}/${contents.length}] FULL CONTENT OBJECT STRUCTURE:`);
        console.log(JSON.stringify(content, null, 2));

        // Log all available keys
        console.log(`\n   Available Keys: ${Object.keys(content).join(', ')}`);

        // Try common property names
        const displayName = content.friendly_name || content.name || content.title || content.display_name || 'Unknown';
        console.log(`\n   Display Name candidates: friendly_name=${content.friendly_name}, name=${content.name}, title=${content.title}`);
        console.log(`   SID: ${content.sid}`);
        console.log(`   Language: ${content.language}`);
        console.log(`   Approval: ${JSON.stringify(content.approval)}`);

        // Since approval is undefined, let's check for alternative structures
        if (!content.approval) {
          console.log(`   ⏭️  No approval object found. Checking for alternative approval structures...`);
          console.log(`   All properties: ${JSON.stringify(content, null, 2)}`);
          continue;
        }

        // Check different possible approval status structures
        let whatsappStatus = null;

        // Try: content.approval.whatsapp
        if (content.approval.whatsapp) {
          whatsappStatus = content.approval.whatsapp;
          console.log(`   WhatsApp Status (from .whatsapp): ${whatsappStatus}`);
        }
        // Try: content.approval['whatsapp']
        else if (content.approval['whatsapp']) {
          whatsappStatus = content.approval['whatsapp'];
          console.log(`   WhatsApp Status (from ['whatsapp']): ${whatsappStatus}`);
        }
        // Try: content.approval.channels.whatsapp
        else if (content.approval.channels && content.approval.channels.whatsapp) {
          whatsappStatus = content.approval.channels.whatsapp;
          console.log(`   WhatsApp Status (from .channels.whatsapp): ${whatsappStatus}`);
        }
        // Fallback - check for any approval property
        else {
          console.log(`   ⏭️  No WhatsApp approval found in structure`);
          continue;
        }

        if (!whatsappStatus || whatsappStatus !== 'approved') {
          console.log(`   ⏭️  Skipping - WhatsApp status is '${whatsappStatus}' (not 'approved')`);
          continue;
        }

        // Extract body preview from template variables
        let bodyPreview = '';
        if (content.variables && Array.isArray(content.variables)) {
          console.log(`   Variables found: ${content.variables.length}`);
          // Try different variable structures
          const bodyVar = content.variables.find(v =>
            v.type === 'body' ||
            v.key === 'body' ||
            v.name === 'body'
          );
          if (bodyVar) {
            bodyPreview = bodyVar.value || bodyVar.default || JSON.stringify(bodyVar);
            console.log(`   Body Preview: ${bodyPreview.substring(0, 80)}...`);
          }
        } else {
          console.log(`   No variables array found`);
        }

        // Map Twilio template to our format
        const template = {
          template_sid: content.sid, // Content SID (e.g., HX...)
          display_name: content.friendly_name || 'Unnamed Template',
          body_preview: bodyPreview || content.friendly_name || '',
          category: content.language || 'general',
          approval_status: whatsappStatus,
          created_at: content.date_created
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
