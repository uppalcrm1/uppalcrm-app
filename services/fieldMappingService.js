const { pool } = require('../database/connection');
const { AppError } = require('../utils/errors');

/**
 * Field Mapping Service
 * Core business logic for field mapping configuration and conversion
 */

/**
 * Get all field mappings for an organization
 */
exports.getAllMappings = async (organizationId, filters = {}) => {
  try {
    console.log('getAllMappings called with:', { organizationId, filters });
    
    const {
      target_entity_type,
      source_entity_type,
      include_inactive = false
    } = filters;

    let query = `
      SELECT *
      FROM field_mapping_configurations
      WHERE organization_id = $1
    `;

    const params = [organizationId];
    let paramIndex = 2;

    if (!include_inactive) {
      query += ` AND is_active = true`;
    }

    if (source_entity_type) {
      query += ` AND source_entity = $${paramIndex}`;
      params.push(source_entity_type);
      paramIndex++;
    }

    if (target_entity_type) {
      query += ` AND target_entity = $${paramIndex}`;
      params.push(target_entity_type);
      paramIndex++;
    }

    query += ` ORDER BY display_order ASC, created_at DESC`;

    console.log('Executing query:', query);
    console.log('With params:', params);

    const result = await pool.query(query, params);
    console.log('Query result:', result.rows.length, 'rows');
    return result.rows;
  } catch (error) {
    console.error('Error in getAllMappings:', error.message);
    console.error('Error stack:', error.stack);
    throw error;
  }
};

/**
 * Get a single field mapping by ID
 *//**
 * Get a specific field mapping by ID
 */
exports.getMappingById = async (organizationId, mappingId) => {
  const query = `
    SELECT *
    FROM field_mapping_configurations
    WHERE id = $1 AND organization_id = $2
  `;

  const result = await pool.query(query, [mappingId, organizationId]);
  return result.rows[0];
};

/**
 * Create a new field mapping
 */
exports.createMapping = async (mappingData) => {
  console.log('createMapping service called with:', JSON.stringify(mappingData, null, 2));

  const {
    organization_id,
    source_entity_type,
    target_entity_type,
    source_field_name,
    target_field_name,
    transformation_type = 'none',
    display_order = 100,
    is_active = true,
    is_required_on_convert = false
  } = mappingData;

  const query = `
    INSERT INTO field_mapping_configurations (
      organization_id, source_entity, target_entity,
      source_field, target_field,
      transformation_type, display_order, is_active, is_required_on_convert
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;

  const params = [
    organization_id,
    source_entity_type || 'leads',
    target_entity_type,
    source_field_name,
    target_field_name,
    transformation_type,
    display_order,
    is_active,
    is_required_on_convert
  ];

  console.log('Executing INSERT query with params:', params);

  try {
    const result = await pool.query(query, params);
    console.log('INSERT result:', result.rows[0]);
    return result.rows[0];
  } catch (error) {
    console.error('createMapping DB error:', error.message);
    console.error('createMapping DB error detail:', error.detail);
    throw error;
  }
};

/**
 * Update an existing field mapping
 */
exports.updateMapping = async (organizationId, mappingId, updates) => {
  const allowedFields = [
    'transformation_type',
    'is_required_on_convert',
    'display_order',
    'is_active'
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
        if (['display_order', 'is_required_on_convert', 'is_active'].includes(key)) {
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

  // Basic validation - check for duplicate mappings
  if (mappingData.organization_id && mappingData.source_field_name && mappingData.target_field_name) {
    const query = `
      SELECT id FROM field_mapping_configurations
      WHERE organization_id = $1
        AND source_entity = $2
        AND target_entity = $3
        AND source_field = $4
        AND target_field = $5
        AND is_active = true
    `;

    const result = await pool.query(query, [
      mappingData.organization_id,
      mappingData.source_entity_type || 'leads',
      mappingData.target_entity_type,
      mappingData.source_field_name,
      mappingData.target_field_name
    ]);

    if (result.rows.length > 0) {
      errors.push('A mapping with the same source and target fields already exists');
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
exports.generateConversionPreview = async (organizationId, leadId) => {
  // Get lead data
  const leadQuery = `SELECT * FROM leads WHERE id = $1 AND organization_id = $2`;
  const leadResult = await pool.query(leadQuery, [leadId, organizationId]);

  if (leadResult.rows.length === 0) {
    throw new AppError('Lead not found', 404);
  }

  const lead = leadResult.rows[0];

  // Get organization's active mappings
  const mappings = await exports.getAllMappings(organizationId);

  // Apply mappings to lead data
  const preview = {
    contacts: {},
    accounts: {},
    transactions: {}
  };

  for (const mapping of mappings) {
    const sourceValue = lead[mapping.source_field];

    // Simple transformation support
    let transformedValue = sourceValue;
    if (sourceValue && mapping.transformation_type) {
      switch (mapping.transformation_type) {
        case 'uppercase':
          transformedValue = String(sourceValue).toUpperCase();
          break;
        case 'lowercase':
          transformedValue = String(sourceValue).toLowerCase();
          break;
        case 'titlecase':
          transformedValue = String(sourceValue).replace(/\w\S*/g, txt =>
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
          );
          break;
        case 'trim':
          transformedValue = String(sourceValue).trim();
          break;
        default:
          transformedValue = sourceValue;
      }
    }

    // Add to preview by target entity
    const entity = mapping.target_entity;
    if (preview[entity]) {
      preview[entity][mapping.target_field] = {
        value: transformedValue,
        source_field: mapping.source_field,
        display_label: mapping.display_label || formatFieldLabel(mapping.target_field)
      };
    }
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
