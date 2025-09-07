const { query } = require('../database/connection');

class EngagementTracker {
  
  static init() {
    console.log('📊 Initializing engagement tracking...');
    
    // Track daily engagement manually (we'll call this from a cron job in server.js)
    console.log('✅ Engagement tracking initialized');
  }
  
  static async trackDailyEngagement() {
    try {
      console.log('📈 Calculating daily engagement scores...');
      
      const organizations = await query(`SELECT id FROM organizations WHERE is_active = true`);
      
      for (const org of organizations.rows) {
        await this.calculateEngagementScore(org.id);
      }
      
      console.log('✅ Daily engagement tracking completed');
      
    } catch (error) {
      console.error('❌ Error tracking engagement:', error);
    }
  }
  
  static async calculateEngagementScore(organizationId) {
    try {
      const activityData = await query(`
        SELECT 
          COUNT(DISTINCT u.id) FILTER (WHERE u.last_login >= CURRENT_DATE) as active_users_today,
          COUNT(DISTINCT u.id) as total_users,
          (SELECT COUNT(*) FROM leads WHERE organization_id = $1 AND DATE(created_at) = CURRENT_DATE) as leads_created_today,
          (SELECT COUNT(*) FROM contacts WHERE organization_id = $1 AND DATE(created_at) = CURRENT_DATE) as contacts_created_today
        FROM users u
        WHERE u.organization_id = $1 AND u.is_active = true
      `, [organizationId]);
      
      const data = activityData.rows[0];
      
      // Calculate engagement score (0-100)
      let score = 0;
      
      // User activity (40 points max)
      if (data.total_users > 0) {
        const userActivityRatio = data.active_users_today / data.total_users;
        score += Math.min(userActivityRatio * 40, 40);
      }
      
      // Lead creation activity (30 points max)
      score += Math.min(data.leads_created_today * 5, 30);
      
      // Contact creation activity (30 points max)  
      score += Math.min(data.contacts_created_today * 3, 30);
      
      // Store engagement data
      await query(`
        INSERT INTO organization_engagement (
          organization_id, date, total_logins, unique_users_active, 
          leads_created, contacts_created, engagement_score
        ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6)
        ON CONFLICT (organization_id, date) DO UPDATE SET
          total_logins = EXCLUDED.total_logins,
          unique_users_active = EXCLUDED.unique_users_active,
          leads_created = EXCLUDED.leads_created,
          contacts_created = EXCLUDED.contacts_created,
          engagement_score = EXCLUDED.engagement_score
      `, [
        organizationId, data.active_users_today, data.active_users_today,
        data.leads_created_today, data.contacts_created_today, Math.round(score)
      ]);
      
    } catch (error) {
      console.error(`Error calculating engagement for org ${organizationId}:`, error);
    }
  }
}

module.exports = EngagementTracker;