const { pool } = require('../database/connection');
const { AppError } = require('../utils/errors');

/**
 * Field Mapping Template Service
 * Handles template-based field mapping configurations
 */

/**
 * Get all available templates (system + organization templates)
 */
exports.getAllTemplates = async (organizationId, filters = {}) => {
  const { template_type, applies_to_entity, search } = filters;

  let query = `
    SELECT
      fmt.id,
      fmt.template_name,
      fmt.description,
      fmt.template_type,
      fmt.is_system_template,
      fmt.icon,
      fmt.color,
      fmt.created_at,
      fmt.updated_at,
      COUNT(fmti.id) as mapping_count
    FROM field_mapping_templates fmt
    LEFT JOIN field_mapping_template_items fmti ON fmt.id = fmti.template_id
    WHERE (fmt.is_system_template = true OR fmt.organization_id = $1)
      AND fmt.is_active = true
  `;

  const params = [organizationId];
  let paramIndex = 2;

  if (template_type) {
    query += ` AND fmt.template_type = $${paramIndex}`;
    params.push(template_type);
    paramIndex++;
  }

  if (applies_to_entity) {
    query += ` AND EXISTS (
      SELECT 1 FROM field_mapping_template_items fmti2
      WHERE fmti2.template_id = fmt.id
        AND fmti2.applies_to_entity = $${paramIndex}
    )`;
    params.push(applies_to_entity);
    paramIndex++;
  }

  if (search) {
    query += ` AND (fmt.template_name ILIKE $${paramIndex} OR fmt.description ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  query += `
    GROUP BY fmt.id, fmt.template_name, fmt.description, fmt.template_type, 
             fmt.is_system_template, fmt.icon, fmt.color, fmt.created_at, fmt.updated_at
    ORDER BY fmt.is_system_template DESC, fmt.template_name ASC
  `;

  const result = await pool.query(query, params);
  
  // Transform to match frontend expectations
  return result.rows.map(row => ({
    id: row.id,
    name: row.template_name,
    description: row.description,
    template_type: row.template_type,
    is_system: row.is_system_template,
    icon: row.icon,
    color: row.color,
    mapping_count: parseInt(row.mapping_count) || 0,
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
};

/**
 * Get template details including all field mappings
 */
exports.getTemplateById = async (organizationId, templateId) => {
  const templateQuery = `
    SELECT 
      id,
      template_name,
      description,
      template_type,
      is_system_template,
      icon,
      color,
      created_at,
      updated_at
    FROM field_mapping_templates
    WHERE id = $1
      AND (is_system_template = true OR organization_id = $2)
      AND is_active = true
  `;

  const templateResult = await pool.query(templateQuery, [templateId, organizationId]);

  if (templateResult.rows.length === 0) {
    return null;
  }

  const template = templateResult.rows[0];

  // Get template items (mappings)
  const itemsQuery = `
    SELECT
      id,
      source_entity_type,
      target_entity_type,
      applies_to_entity,
      source_field_name,
      target_field_name,
      transformation_rule,
      is_required,
      priority
    FROM field_mapping_template_items
    WHERE template_id = $1
    ORDER BY priority ASC, source_field_name ASC
  `;

  const itemsResult = await pool.query(itemsQuery, [templateId]);

  // Transform to match frontend expectations
  return {
    id: template.id,
    name: template.template_name,
    description: template.description,
    template_type: template.template_type,
    is_system: template.is_system_template,
    icon: template.icon,
    color: template.color,
    created_at: template.created_at,
    updated_at: template.updated_at,
    mappings: itemsResult.rows
  };
};

/**
 * Create a custom template from existing mappings
 */
exports.createTemplate = async (templateData) => {
  const {
    organization_id,
    template_name,
    description,
    template_type = 'custom',
    applies_to_entities = ['contacts', 'accounts', 'transactions'],
    icon,
    color,
    source_mappings // Array of field_mapping_configuration IDs
  } = templateData;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create template
    const templateQuery = `
      INSERT INTO field_mapping_templates (
        organization_id, template_name, description, template_type,
        icon, color, is_system_template
      ) VALUES ($1, $2, $3, $4, $5, $6, false)
      RETURNING *
    `;

    const templateParams = [
      organization_id,
      template_name,
      description,
      template_type,
      icon,
      color
    ];

    const templateResult = await client.query(templateQuery, templateParams);
    const template = templateResult.rows[0];

    // Create template items from source mappings
    let displayOrder = 0;
    for (const mappingId of source_mappings) {
      // Verify mapping belongs to organization
      const mappingQuery = `
        SELECT id, target_entity
        FROM field_mapping_configurations
        WHERE id = $1 AND organization_id = $2 AND is_active = true
      `;

      const mappingResult = await client.query(mappingQuery, [mappingId, organization_id]);

      if (mappingResult.rows.length > 0) {
        const mapping = mappingResult.rows[0];

        const itemQuery = `
          INSERT INTO field_mapping_template_items (
            template_id, source_mapping_id, applies_to_entity,
            is_included_by_default, display_order
          ) VALUES ($1, $2, $3, true, $4)
        `;

        await client.query(itemQuery, [
          template.id,
          mappingId,
          mapping.target_entity,
          displayOrder++
        ]);
      }
    }

    await client.query('COMMIT');

    // Return full template with mappings
    return await exports.getTemplateById(organization_id, template.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Apply a template to an organization
 */
exports.applyTemplate = async (organizationId, templateId, options = {}) => {
  const {
    override_existing = false,
    field_mappings_to_include = null // If null, include all
  } = options;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get template with all mappings
    const template = await exports.getTemplateById(organizationId, templateId);

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    let created = 0;
    let skipped = 0;

    for (const item of template.mappings) {
      // Skip if not in include list (when specified)
      if (field_mappings_to_include && !field_mappings_to_include.includes(item.source_mapping_id)) {
        skipped++;
        continue;
      }

      // Check if mapping already exists
      const existingQuery = `
        SELECT id FROM field_mapping_configurations
        WHERE organization_id = $1
          AND source_field = $2
          AND target_field = $3
          AND target_entity = $4
          AND is_active = true
      `;

      const existingResult = await client.query(existingQuery, [
        organizationId,
        item.source_field,
        item.target_field,
        item.applies_to_entity
      ]);

      if (existingResult.rows.length > 0) {
        if (override_existing) {
          // Update existing mapping
          const updateQuery = `
            UPDATE field_mapping_configurations
            SET
              source_field_type = $1,
              source_field_path = $2,
              target_field_type = $3,
              target_field_path = $4,
              transformation_type = $5,
              transformation_rule_id = $6,
              default_value = $7,
              display_label = $8,
              help_text = $9,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $10
          `;

          await client.query(updateQuery, [
            item.source_field_type,
            item.source_field_path,
            item.target_field_type,
            item.target_field_path,
            item.transformation_type,
            item.transformation_rule_id,
            item.default_value,
            item.display_label,
            item.help_text,
            existingResult.rows[0].id
          ]);

          created++; // Count as created for reporting
        } else {
          skipped++;
        }
      } else {
        // Create new mapping
        const createQuery = `
          INSERT INTO field_mapping_configurations (
            organization_id, source_entity, source_field, source_field_type, source_field_path,
            target_entity, target_field, target_field_type, target_field_path,
            transformation_type, transformation_rule_id, default_value,
            is_editable_on_convert, is_required_on_convert, is_visible_on_convert,
            display_order, display_label, help_text
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        `;

        await client.query(createQuery, [
          organizationId,
          'leads', // Default source entity
          item.source_field,
          item.source_field_type,
          item.source_field_path,
          item.applies_to_entity,
          item.target_field,
          item.target_field_type,
          item.target_field_path,
          item.transformation_type,
          item.transformation_rule_id,
          item.default_value,
          item.is_editable_on_convert !== false,
          item.is_required_on_convert === true,
          item.is_visible_on_convert !== false,
          item.display_order,
          item.display_label,
          item.help_text
        ]);

        created++;
      }
    }

    // Track template usage
    const usageQuery = `
      INSERT INTO field_mapping_statistics (
        organization_id, template_id, event_type, event_count
      ) VALUES ($1, $2, 'template_applied', 1)
      ON CONFLICT (organization_id, template_id, event_type)
      DO UPDATE SET
        event_count = field_mapping_statistics.event_count + 1,
        last_event_at = CURRENT_TIMESTAMP
    `;

    await client.query(usageQuery, [organizationId, templateId]);

    await client.query('COMMIT');

    return {
      created,
      skipped,
      total: template.mappings.length
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Delete a custom template
 */
exports.deleteTemplate = async (organizationId, templateId) => {
  const query = `
    UPDATE field_mapping_templates
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
      AND organization_id = $2
      AND is_system_template = false
    RETURNING id
  `;

  const result = await pool.query(query, [templateId, organizationId]);
  return result.rows[0];
};

/**
 * Get template usage statistics
 */
exports.getTemplateUsageStats = async (organizationId, templateId) => {
  const query = `
    SELECT
      event_type,
      event_count,
      last_event_at
    FROM field_mapping_statistics
    WHERE organization_id = $1
      AND template_id = $2
    ORDER BY event_type
  `;

  const result = await pool.query(query, [organizationId, templateId]);
  return result.rows;
};
