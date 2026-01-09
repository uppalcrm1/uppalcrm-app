const { pool } = require('../database/connection');
const transformationEngine = require('./transformationEngine');
const { AppError } = require('../utils/errors');

/**
 * Field Mapping Service
 * Core business logic for field mapping configuration and conversion
 */

/**
 * Get all field mappings for an organization
 */
exports.getAllMappings = async (organizationId, filters = {}) => {
  const {
    target_entity,
    source_entity = 'leads',
    include_system = true,
    search
  } = filters;

  let query = `
    SELECT
      fmc.*,
      ftr.rule_name as transformation_rule_name,
      ftr.description as transformation_rule_description
    FROM field_mapping_configurations fmc
    LEFT JOIN field_transformation_rules ftr ON fmc.transformation_rule_id = ftr.id
    WHERE fmc.organization_id = $1
      AND fmc.source_entity = $2
      AND fmc.is_active = true
  `;

  const params = [organizationId, source_entity];
  let paramIndex = 3;

  if (target_entity) {
    query += ` AND fmc.target_entity = $${paramIndex}`;
    params.push(target_entity);
    paramIndex++;
  }

  if (!include_system) {
    query += ` AND fmc.is_system_mapping = false`;
  }

  if (search) {
    query += ` AND (
      fmc.source_field ILIKE $${paramIndex} OR
      fmc.target_field ILIKE $${paramIndex} OR
      fmc.display_label ILIKE $${paramIndex}
    )`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  query += ` ORDER BY fmc.display_order ASC, fmc.created_at ASC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Get a specific field mapping by ID
 */
exports.getMappingById = async (organizationId, mappingId) => {
  const query = `
    SELECT
      fmc.*,
      ftr.rule_name as transformation_rule_name,
      ftr.transformation_code,
      ftr.description as transformation_rule_description
    FROM field_mapping_configurations fmc
    LEFT JOIN field_transformation_rules ftr ON fmc.transformation_rule_id = ftr.id
    WHERE fmc.id = $1 AND fmc.organization_id = $2
  `;

  const result = await pool.query(query, [mappingId, organizationId]);
  return result.rows[0];
};

/**
 * Create a new field mapping
 */
exports.createMapping = async (mappingData) => {
  const {
    organization_id,
    source_entity = 'leads',
    source_field,
    source_field_type,
    source_field_path,
    target_entity,
    target_field,
    target_field_type,
    target_field_path,
    is_editable_on_convert = true,
    is_required_on_convert = false,
    is_visible_on_convert = true,
    transformation_type = 'none',
    transformation_rule_id,
    default_value,
    default_value_type = 'static',
    display_order = 0,
    display_label,
    help_text
  } = mappingData;

  const query = `
    INSERT INTO field_mapping_configurations (
      organization_id, source_entity, source_field, source_field_type, source_field_path,
      target_entity, target_field, target_field_type, target_field_path,
      is_editable_on_convert, is_required_on_convert, is_visible_on_convert,
      transformation_type, transformation_rule_id, default_value, default_value_type,
      display_order, display_label, help_text
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    RETURNING *
  `;

  const params = [
    organization_id, source_entity, source_field, source_field_type, source_field_path,
    target_entity, target_field, target_field_type, target_field_path,
    is_editable_on_convert, is_required_on_convert, is_visible_on_convert,
    transformation_type, transformation_rule_id, default_value, default_value_type,
    display_order, display_label, help_text
  ];

  const result = await pool.query(query, params);
  return result.rows[0];
};

/**
 * Update an existing field mapping
 */
exports.updateMapping = async (organizationId, mappingId, updates) => {
  const allowedFields = [
    'source_field_type', 'source_field_path',
    'target_field_type', 'target_field_path',
    'is_editable_on_convert', 'is_required_on_convert', 'is_visible_on_convert',
    'transformation_type', 'transformation_rule_id',
    'default_value', 'default_value_type',
    'display_order', 'display_label', 'help_text'
  ];

  const setClauses = [];
  const params = [mappingId, organizationId];
  let paramIndex = 3;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      setClauses.push(`${key} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) {
    throw new AppError('No valid fields to update', 400);
  }

  const query = `
    UPDATE field_mapping_configurations
    SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND organization_id = $2
    RETURNING *
  `;

  const result = await pool.query(query, params);
  return result.rows[0];
};

/**
 * Delete a field mapping
 */
exports.deleteMapping = async (organizationId, mappingId) => {
  const query = `
    UPDATE field_mapping_configurations
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND organization_id = $2
    RETURNING id
  `;

  const result = await pool.query(query, [mappingId, organizationId]);
  return result.rows[0];
};

/**
 * Bulk update field mappings (e.g., for reordering)
 */
exports.bulkUpdateMappings = async (organizationId, updates) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let updated = 0;
    for (const update of updates) {
      const { id, ...fields } = update;

      const setClauses = [];
      const params = [id, organizationId];
      let paramIndex = 3;

      for (const [key, value] of Object.entries(fields)) {
        if (['display_order', 'is_visible_on_convert', 'is_editable_on_convert', 'is_required_on_convert'].includes(key)) {
          setClauses.push(`${key} = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
      }

      if (setClauses.length > 0) {
        const query = `
          UPDATE field_mapping_configurations
          SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND organization_id = $2
        `;
        await client.query(query, params);
        updated++;
      }
    }

    await client.query('COMMIT');
    return { updated };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Validate a field mapping configuration
 */
exports.validateMappingConfiguration = async (mappingData) => {
  const errors = [];
  const warnings = [];

  // Check field type compatibility
  if (mappingData.source_field_type && mappingData.target_field_type) {
    const compatible = areFieldTypesCompatible(
      mappingData.source_field_type,
      mappingData.target_field_type
    );

    if (!compatible) {
      errors.push(
        `Field type mismatch: ${mappingData.source_field_type} cannot be mapped to ${mappingData.target_field_type}`
      );
    }
  }

  // Check for duplicate mappings
  if (mappingData.organization_id && mappingData.source_field && mappingData.target_field) {
    const query = `
      SELECT id FROM field_mapping_configurations
      WHERE organization_id = $1
        AND source_field = $2
        AND target_field = $3
        AND target_entity = $4
        AND is_active = true
    `;

    const result = await pool.query(query, [
      mappingData.organization_id,
      mappingData.source_field,
      mappingData.target_field,
      mappingData.target_entity
    ]);

    if (result.rows.length > 0) {
      warnings.push('A mapping with the same source and target fields already exists');
    }
  }

  // Validate transformation rule if specified
  if (mappingData.transformation_rule_id) {
    const ruleQuery = `
      SELECT id, is_validated FROM field_transformation_rules
      WHERE id = $1 AND organization_id = $2
    `;

    const ruleResult = await pool.query(ruleQuery, [
      mappingData.transformation_rule_id,
      mappingData.organization_id
    ]);

    if (ruleResult.rows.length === 0) {
      errors.push('Specified transformation rule not found');
    } else if (!ruleResult.rows[0].is_validated) {
      warnings.push('The selected transformation rule has not been validated');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Check if two field types are compatible for mapping
 */
function areFieldTypesCompatible(sourceType, targetType) {
  const typeGroups = {
    text: ['text', 'varchar', 'string', 'email', 'phone', 'url'],
    number: ['number', 'integer', 'decimal', 'float', 'numeric'],
    boolean: ['boolean', 'bool'],
    date: ['date', 'datetime', 'timestamp'],
    json: ['json', 'jsonb', 'object', 'array']
  };

  for (const group of Object.values(typeGroups)) {
    if (group.includes(sourceType.toLowerCase()) && group.includes(targetType.toLowerCase())) {
      return true;
    }
  }

  // Text can be converted to anything
  if (typeGroups.text.includes(sourceType.toLowerCase())) {
    return true;
  }

  return false;
}

/**
 * Get available source fields that can be mapped
 */
exports.getAvailableSourceFields = async (organizationId, sourceEntity = 'leads') => {
  // Get table columns
  const tableFields = await getTableColumns(sourceEntity);

  // Get custom fields for this entity
  const customFieldsQuery = `
    SELECT field_name, field_type, field_label
    FROM custom_fields
    WHERE organization_id = $1
      AND entity_type = $2
      AND is_active = true
    ORDER BY field_label
  `;

  const customFieldsResult = await pool.query(customFieldsQuery, [organizationId, sourceEntity]);

  // Combine standard and custom fields
  const fields = [
    ...tableFields.map(f => ({
      field_name: f.column_name,
      field_type: f.data_type,
      field_label: formatFieldLabel(f.column_name),
      is_custom: false
    })),
    ...customFieldsResult.rows.map(f => ({
      field_name: f.field_name,
      field_type: f.field_type,
      field_label: f.field_label,
      is_custom: true,
      field_path: `custom_fields.${f.field_name}`
    }))
  ];

  return fields;
};

/**
 * Get available target fields for a given entity
 */
exports.getAvailableTargetFields = async (organizationId, targetEntity) => {
  return await exports.getAvailableSourceFields(organizationId, targetEntity);
};

/**
 * Get columns from a database table
 */
async function getTableColumns(tableName) {
  const query = `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = $1
      AND table_schema = 'public'
      AND column_name NOT IN ('id', 'organization_id', 'created_at', 'updated_at', 'deleted_at', 'is_deleted')
    ORDER BY ordinal_position
  `;

  const result = await pool.query(query, [tableName]);
  return result.rows;
}

/**
 * Format field name to human-readable label
 */
function formatFieldLabel(fieldName) {
  return fieldName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate conversion preview with field mappings applied
 */
exports.generateConversionPreview = async (organizationId, leadId, templateId = null) => {
  // Get lead data
  const leadQuery = `SELECT * FROM leads WHERE id = $1 AND organization_id = $2`;
  const leadResult = await pool.query(leadQuery, [leadId, organizationId]);

  if (leadResult.rows.length === 0) {
    throw new AppError('Lead not found', 404);
  }

  const lead = leadResult.rows[0];

  // Get field mappings (from template or organization defaults)
  let mappings;
  if (templateId) {
    // Get mappings from template
    const templateQuery = `
      SELECT fmti.*, fmc.*
      FROM field_mapping_template_items fmti
      JOIN field_mapping_configurations fmc ON fmti.source_mapping_id = fmc.id
      WHERE fmti.template_id = $1
    `;
    const templateResult = await pool.query(templateQuery, [templateId]);
    mappings = templateResult.rows;
  } else {
    // Get organization's active mappings
    mappings = await exports.getAllMappings(organizationId, { include_system: true });
  }

  // Apply mappings to lead data
  const preview = {
    contacts: {},
    accounts: {},
    transactions: {}
  };

  for (const mapping of mappings) {
    if (!mapping.is_visible_on_convert) continue;

    const sourceValue = getNestedValue(lead, mapping.source_field, mapping.source_field_path);

    let transformedValue = sourceValue;

    // Apply transformation
    if (sourceValue !== null && sourceValue !== undefined) {
      transformedValue = await transformationEngine.applyTransformation(
        sourceValue,
        mapping.transformation_type,
        mapping.transformation_rule_id,
        lead
      );
    }

    // Use default value if no source value
    if ((transformedValue === null || transformedValue === undefined) && mapping.default_value) {
      transformedValue = mapping.default_value;
    }

    // Add to preview
    const entity = mapping.target_entity;
    preview[entity][mapping.target_field] = {
      value: transformedValue,
      is_editable: mapping.is_editable_on_convert,
      is_required: mapping.is_required_on_convert,
      display_label: mapping.display_label || formatFieldLabel(mapping.target_field),
      help_text: mapping.help_text,
      source_field: mapping.source_field,
      was_auto_filled: transformedValue !== null && transformedValue !== undefined
    };
  }

  return preview;
};

/**
 * Get nested value from object using dot notation path
 */
function getNestedValue(obj, fieldName, fieldPath = null) {
  if (fieldPath) {
    const parts = fieldPath.split('.');
    let value = obj;
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) return null;
    }
    return value;
  }
  return obj[fieldName];
}
