#!/usr/bin/env node

/**
 * Create subscription helper functions
 */

const { query } = require('../database/connection');

async function createFunctions() {
  console.log('⚙️  Creating subscription helper functions...\n');

  const functions = [
    // 1. Updated trigger function
    `CREATE OR REPLACE FUNCTION update_updated_at_column()
     RETURNS TRIGGER AS $$
     BEGIN
       NEW.updated_at = CURRENT_TIMESTAMP;
       RETURN NEW;
     END;
     $$ language 'plpgsql'`,

    // 2. Invoice number generator
    `CREATE OR REPLACE FUNCTION generate_invoice_number()
     RETURNS VARCHAR(50) AS $$
     DECLARE
       year_month VARCHAR(6);
       sequence_num INTEGER;
       invoice_num VARCHAR(50);
     BEGIN
       year_month := TO_CHAR(NOW(), 'YYYYMM');

       SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 8) AS INTEGER)), 0) + 1
       INTO sequence_num
       FROM subscription_invoices
       WHERE invoice_number LIKE 'INV-' || year_month || '%';

       invoice_num := 'INV-' || year_month || LPAD(sequence_num::TEXT, 4, '0');

       RETURN invoice_num;
     END;
     $$ LANGUAGE plpgsql`,

    // 3. Feature access checker
    `CREATE OR REPLACE FUNCTION has_feature_access(org_id UUID, feature_key VARCHAR)
     RETURNS BOOLEAN AS $$
     DECLARE
       has_access BOOLEAN := FALSE;
     BEGIN
       SELECT COALESCE(pfm.is_included, FALSE)
       INTO has_access
       FROM organization_subscriptions os
       JOIN plan_feature_mappings pfm ON pfm.subscription_plan_id = os.subscription_plan_id
       JOIN plan_features pf ON pf.id = pfm.plan_feature_id
       WHERE os.organization_id = org_id
       AND os.status IN ('trial', 'active')
       AND pf.feature_key = feature_key
       AND pf.is_active = TRUE;

       RETURN COALESCE(has_access, FALSE);
     END;
     $$ LANGUAGE plpgsql`,

    // 4. Current usage getter
    `CREATE OR REPLACE FUNCTION get_current_usage(org_id UUID)
     RETURNS TABLE(
       active_users INTEGER,
       total_contacts INTEGER,
       total_leads INTEGER,
       storage_used_gb DECIMAL,
       api_calls INTEGER,
       custom_fields_used INTEGER
     ) AS $$
     BEGIN
       RETURN QUERY
       SELECT
         (SELECT COUNT(*)::INTEGER FROM users WHERE organization_id = org_id AND is_active = TRUE),
         (SELECT COUNT(*)::INTEGER FROM contacts WHERE organization_id = org_id),
         (SELECT COUNT(*)::INTEGER FROM leads WHERE organization_id = org_id),
         0.0::DECIMAL,
         0::INTEGER,
         (SELECT COUNT(DISTINCT field_name)::INTEGER
          FROM contact_custom_fields
          WHERE organization_id = org_id
          UNION
          SELECT 0 WHERE NOT EXISTS (
            SELECT 1 FROM contact_custom_fields WHERE organization_id = org_id
          )
          LIMIT 1);
     END;
     $$ LANGUAGE plpgsql`,

    // 5. Usage limits checker
    `CREATE OR REPLACE FUNCTION check_usage_limits(org_id UUID, usage_type VARCHAR, additional_count INTEGER DEFAULT 1)
     RETURNS BOOLEAN AS $$
     DECLARE
       current_count INTEGER;
       plan_limit INTEGER;
       can_add BOOLEAN := TRUE;
     BEGIN
       SELECT
         CASE usage_type
           WHEN 'users' THEN sp.max_users
           WHEN 'contacts' THEN sp.max_contacts
           WHEN 'leads' THEN sp.max_leads
           WHEN 'custom_fields' THEN sp.max_custom_fields
         END
       INTO plan_limit
       FROM organization_subscriptions os
       JOIN subscription_plans sp ON sp.id = os.subscription_plan_id
       WHERE os.organization_id = org_id AND os.status IN ('trial', 'active');

       IF plan_limit IS NULL THEN
         RETURN TRUE;
       END IF;

       SELECT
         CASE usage_type
           WHEN 'users' THEN (SELECT COUNT(*) FROM users WHERE organization_id = org_id AND is_active = TRUE)
           WHEN 'contacts' THEN (SELECT COUNT(*) FROM contacts WHERE organization_id = org_id)
           WHEN 'leads' THEN (SELECT COUNT(*) FROM leads WHERE organization_id = org_id)
           WHEN 'custom_fields' THEN COALESCE((SELECT COUNT(DISTINCT field_name) FROM contact_custom_fields WHERE organization_id = org_id), 0)
           ELSE 0
         END
       INTO current_count;

       can_add := (current_count + additional_count) <= plan_limit;

       RETURN can_add;
     END;
     $$ LANGUAGE plpgsql`
  ];

  for (let i = 0; i < functions.length; i++) {
    try {
      await query(functions[i]);
      console.log(`✅ Created function ${i + 1}/${functions.length}`);
    } catch (error) {
      console.error(`❌ Error creating function ${i + 1}:`, error.message);
    }
  }

  console.log('\n✅ All functions created successfully!');
}

if (require.main === module) {
  createFunctions()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createFunctions;