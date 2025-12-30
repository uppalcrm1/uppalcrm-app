const db = require('../database/connection');

/**
 * Query Builder Service
 * Dynamically builds SQL queries from user-defined report configurations
 * with strict security validation and whitelisting
 */

// ============================================
// DATA SOURCE DEFINITIONS
// ============================================

const DATA_SOURCES = {
  leads: {
    table: 'leads',
    label: 'Leads',
    description: 'Prospects and potential customers',
    fields: {
      id: { type: 'uuid', label: 'Lead ID', filterable: false, groupable: false, sortable: true },
      full_name: {
        type: 'text',
        label: 'Full Name',
        filterable: false,
        groupable: false,
        sortable: true,
        sqlExpression: "CONCAT(first_name, ' ', last_name)"
      },
      first_name: { type: 'text', label: 'First Name', filterable: true, groupable: true, sortable: true },
      last_name: { type: 'text', label: 'Last Name', filterable: true, groupable: true, sortable: true },
      email: { type: 'text', label: 'Email', filterable: true, groupable: true, sortable: true },
      phone: { type: 'text', label: 'Phone', filterable: true, groupable: false, sortable: true },
      company: { type: 'text', label: 'Company', filterable: true, groupable: true, sortable: true },
      status: {
        type: 'select',
        label: 'Status',
        filterable: true,
        groupable: true,
        sortable: true,
        options: [
          { value: 'new', label: 'New' },
          { value: 'contacted', label: 'Contacted' },
          { value: 'qualified', label: 'Qualified' },
          { value: 'converted', label: 'Converted' },
          { value: 'lost', label: 'Lost' }
        ]
      },
      priority: {
        type: 'select',
        label: 'Priority',
        filterable: true,
        groupable: true,
        sortable: true,
        options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' }
        ]
      },
      source: { type: 'text', label: 'Source', filterable: true, groupable: true, sortable: true },
      value: { type: 'number', label: 'Value', filterable: true, groupable: false, sortable: true, aggregatable: true },
      created_at: { type: 'date', label: 'Created Date', filterable: true, groupable: true, sortable: true },
      updated_at: { type: 'date', label: 'Updated Date', filterable: true, groupable: true, sortable: true },
      assigned_to_id: { type: 'uuid', label: 'Assigned To ID', filterable: true, groupable: true, sortable: true }
    }
  },

  contacts: {
    table: 'contacts',
    label: 'Contacts',
    description: 'Customers who have made purchases',
    fields: {
      id: { type: 'uuid', label: 'Contact ID', filterable: false, groupable: false, sortable: true },
      full_name: {
        type: 'text',
        label: 'Full Name',
        filterable: false,
        groupable: false,
        sortable: true,
        sqlExpression: "CONCAT(first_name, ' ', last_name)"
      },
      first_name: { type: 'text', label: 'First Name', filterable: true, groupable: true, sortable: true },
      last_name: { type: 'text', label: 'Last Name', filterable: true, groupable: true, sortable: true },
      email: { type: 'text', label: 'Email', filterable: true, groupable: true, sortable: true },
      phone: { type: 'text', label: 'Phone', filterable: true, groupable: false, sortable: true },
      status: {
        type: 'select',
        label: 'Status',
        filterable: true,
        groupable: true,
        sortable: true,
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' }
        ]
      },
      created_at: { type: 'date', label: 'Created Date', filterable: true, groupable: true, sortable: true },
      updated_at: { type: 'date', label: 'Updated Date', filterable: true, groupable: true, sortable: true }
    }
  },

  accounts: {
    table: 'accounts',
    label: 'Accounts',
    description: 'Software licenses (one per device)',
    fields: {
      id: { type: 'uuid', label: 'Account ID', filterable: false, groupable: false, sortable: true },
      account_name: { type: 'text', label: 'Account Name', filterable: true, groupable: true, sortable: true },
      mac_address: { type: 'text', label: 'MAC Address', filterable: true, groupable: false, sortable: true },
      device_name: { type: 'text', label: 'Device Name', filterable: true, groupable: true, sortable: true },
      billing_cycle: {
        type: 'select',
        label: 'Billing Cycle',
        filterable: true,
        groupable: true,
        sortable: true,
        options: [
          { value: 'monthly', label: 'Monthly' },
          { value: 'quarterly', label: 'Quarterly' },
          { value: 'semi_annual', label: 'Semi-Annual' },
          { value: 'annual', label: 'Annual' }
        ]
      },
      billing_term_months: { type: 'number', label: 'Billing Term (Months)', filterable: true, groupable: true, sortable: true },
      license_status: {
        type: 'select',
        label: 'Status',
        filterable: true,
        groupable: true,
        sortable: true,
        options: [
          { value: 'active', label: 'Active' },
          { value: 'expired', label: 'Expired' },
          { value: 'cancelled', label: 'Cancelled' }
        ]
      },
      created_at: { type: 'date', label: 'Created Date', filterable: true, groupable: true, sortable: true },
      next_renewal_date: { type: 'date', label: 'Next Renewal Date', filterable: true, groupable: true, sortable: true },
      contact_id: { type: 'uuid', label: 'Contact ID', filterable: true, groupable: true, sortable: true }
    }
  },

  transactions: {
    table: 'transactions',
    label: 'Transactions',
    description: 'Payment and purchase records',
    fields: {
      id: { type: 'uuid', label: 'Transaction ID', filterable: false, groupable: false, sortable: true },
      amount: { type: 'number', label: 'Amount', filterable: true, groupable: false, sortable: true, aggregatable: true },
      transaction_date: { type: 'date', label: 'Transaction Date', filterable: true, groupable: true, sortable: true },
      payment_method: {
        type: 'select',
        label: 'Payment Method',
        filterable: true,
        groupable: true,
        sortable: true,
        options: [
          { value: 'credit_card', label: 'Credit Card' },
          { value: 'debit_card', label: 'Debit Card' },
          { value: 'paypal', label: 'PayPal' },
          { value: 'bank_transfer', label: 'Bank Transfer' },
          { value: 'cash', label: 'Cash' },
          { value: 'other', label: 'Other' }
        ]
      },
      source: { type: 'text', label: 'Source', filterable: true, groupable: true, sortable: true },
      billing_cycle: {
        type: 'select',
        label: 'Billing Cycle',
        filterable: true,
        groupable: true,
        sortable: true,
        options: [
          { value: 'monthly', label: 'Monthly' },
          { value: 'quarterly', label: 'Quarterly' },
          { value: 'semi_annual', label: 'Semi-Annual' },
          { value: 'annual', label: 'Annual' }
        ]
      },
      status: {
        type: 'select',
        label: 'Status',
        filterable: true,
        groupable: true,
        sortable: true,
        options: [
          { value: 'completed', label: 'Completed' },
          { value: 'pending', label: 'Pending' },
          { value: 'refunded', label: 'Refunded' },
          { value: 'voided', label: 'Voided' }
        ]
      },
      created_at: { type: 'date', label: 'Created Date', filterable: true, groupable: true, sortable: true },
      account_id: { type: 'uuid', label: 'Account ID', filterable: true, groupable: true, sortable: true }
    }
  }
};

// ============================================
// OPERATOR DEFINITIONS
// ============================================

const OPERATORS = {
  // Text operators
  equals: { sql: '=', types: ['text', 'select', 'uuid'] },
  not_equals: { sql: '!=', types: ['text', 'select', 'uuid'] },
  contains: { sql: 'ILIKE', types: ['text'], valueFn: (val) => `%${val}%` },
  starts_with: { sql: 'ILIKE', types: ['text'], valueFn: (val) => `${val}%` },
  ends_with: { sql: 'ILIKE', types: ['text'], valueFn: (val) => `%${val}` },
  is_empty: { sql: 'IS NULL', types: ['text'], noValue: true },
  is_not_empty: { sql: 'IS NOT NULL', types: ['text'], noValue: true },

  // Number operators
  greater_than: { sql: '>', types: ['number'] },
  less_than: { sql: '<', types: ['number'] },
  greater_than_or_equal: { sql: '>=', types: ['number'] },
  less_than_or_equal: { sql: '<=', types: ['number'] },

  // Date operators
  before: { sql: '<', types: ['date'] },
  after: { sql: '>', types: ['date'] },
  on: { sql: '=', types: ['date'] },

  // Multi-value operators
  in: { sql: 'IN', types: ['text', 'select', 'uuid'], array: true },
  not_in: { sql: 'NOT IN', types: ['text', 'select', 'uuid'], array: true },
  between: { sql: 'BETWEEN', types: ['number', 'date'], range: true }
};

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate report configuration
 */
const validateConfig = (config) => {
  const errors = [];

  // Validate data source
  if (!config.dataSource || !DATA_SOURCES[config.dataSource]) {
    errors.push('Invalid or missing data source');
  }

  // Validate fields array
  if (!Array.isArray(config.fields) || config.fields.length === 0) {
    errors.push('Fields array is required and must not be empty');
  }

  // Validate each field exists in data source
  if (config.dataSource && DATA_SOURCES[config.dataSource]) {
    const validFields = Object.keys(DATA_SOURCES[config.dataSource].fields);
    config.fields?.forEach(field => {
      if (!validFields.includes(field)) {
        errors.push(`Invalid field: ${field}`);
      }
    });
  }

  // Validate filters
  if (config.filters && Array.isArray(config.filters)) {
    config.filters.forEach((filter, index) => {
      if (!filter.field || !filter.operator) {
        errors.push(`Filter ${index}: Missing field or operator`);
      }
      if (!OPERATORS[filter.operator]) {
        errors.push(`Filter ${index}: Invalid operator ${filter.operator}`);
      }
    });
  }

  // Validate limit
  if (config.limit && (typeof config.limit !== 'number' || config.limit < 1 || config.limit > 10000)) {
    errors.push('Limit must be a number between 1 and 10000');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Sanitize field name (ensure it's in whitelist)
 */
const sanitizeField = (field, dataSource) => {
  const validFields = DATA_SOURCES[dataSource]?.fields;
  if (!validFields || !validFields[field]) {
    throw new Error(`Invalid field: ${field}`);
  }
  return field;
};

// ============================================
// QUERY BUILDING FUNCTIONS
// ============================================

/**
 * Build SELECT clause
 */
const buildSelectClause = (fields, dataSource, groupBy = []) => {
  const sanitizedFields = fields.map(f => sanitizeField(f, dataSource));

  // If grouping, add aggregations for numeric fields not in groupBy
  if (groupBy && groupBy.length > 0) {
    const selectParts = sanitizedFields.map(field => {
      if (groupBy.includes(field)) {
        const fieldMeta = DATA_SOURCES[dataSource].fields[field];
        // Use SQL expression if available
        if (fieldMeta.sqlExpression) {
          return `${fieldMeta.sqlExpression} as ${field}`;
        }
        return field;
      }

      const fieldMeta = DATA_SOURCES[dataSource].fields[field];
      if (fieldMeta.aggregatable) {
        const expr = fieldMeta.sqlExpression || field;
        return `SUM(${expr}) as ${field}`;
      } else if (fieldMeta.type === 'number') {
        const expr = fieldMeta.sqlExpression || field;
        return `COUNT(${expr}) as ${field}_count`;
      } else {
        return null; // Skip non-aggregatable fields not in groupBy
      }
    }).filter(Boolean);

    return selectParts.join(', ');
  }

  // Build select list with SQL expressions
  const selectParts = sanitizedFields.map(field => {
    const fieldMeta = DATA_SOURCES[dataSource].fields[field];
    // Use SQL expression if available, otherwise use field name
    if (fieldMeta.sqlExpression) {
      return `${fieldMeta.sqlExpression} as ${field}`;
    }
    return field;
  });

  return selectParts.join(', ');
};

/**
 * Build WHERE clause from filters
 */
const buildWhereClause = (filters, dataSource, params) => {
  if (!filters || filters.length === 0) {
    return { clause: '', params };
  }

  const conditions = [];
  let paramIndex = params.length + 1;

  filters.forEach(filter => {
    const { field, operator, value } = filter;

    // Validate field
    const sanitizedField = sanitizeField(field, dataSource);
    const fieldMeta = DATA_SOURCES[dataSource].fields[field];

    // Validate operator
    const op = OPERATORS[operator];
    if (!op) {
      throw new Error(`Invalid operator: ${operator}`);
    }

    // Check operator is valid for field type
    if (!op.types.includes(fieldMeta.type)) {
      throw new Error(`Operator ${operator} not valid for field type ${fieldMeta.type}`);
    }

    // Build condition
    if (op.noValue) {
      conditions.push(`${sanitizedField} ${op.sql}`);
    } else if (op.array) {
      // IN operator
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error(`Operator ${operator} requires an array value`);
      }
      const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`${sanitizedField} ${op.sql} (${placeholders})`);
      params.push(...value);
    } else if (op.range) {
      // BETWEEN operator
      if (!Array.isArray(value) || value.length !== 2) {
        throw new Error(`Operator ${operator} requires a two-element array`);
      }
      conditions.push(`${sanitizedField} ${op.sql} $${paramIndex} AND $${paramIndex + 1}`);
      params.push(value[0], value[1]);
      paramIndex += 2;
    } else {
      // Standard operators
      const finalValue = op.valueFn ? op.valueFn(value) : value;
      conditions.push(`${sanitizedField} ${op.sql} $${paramIndex}`);
      params.push(finalValue);
      paramIndex++;
    }
  });

  return {
    clause: conditions.length > 0 ? conditions.join(' AND ') : '',
    params
  };
};

/**
 * Build GROUP BY clause
 */
const buildGroupByClause = (groupBy, dataSource) => {
  if (!groupBy || groupBy.length === 0) {
    return '';
  }

  const sanitizedFields = groupBy.map(f => sanitizeField(f, dataSource));
  return sanitizedFields.join(', ');
};

/**
 * Build ORDER BY clause
 */
const buildOrderByClause = (orderBy, dataSource) => {
  if (!orderBy || orderBy.length === 0) {
    return '';
  }

  const orderParts = orderBy.map(order => {
    const field = sanitizeField(order.field, dataSource);
    const fieldMeta = DATA_SOURCES[dataSource].fields[field];
    const direction = order.direction?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Use SQL expression if available
    if (fieldMeta.sqlExpression) {
      return `${fieldMeta.sqlExpression} ${direction}`;
    }
    return `${field} ${direction}`;
  });

  return orderParts.join(', ');
};

/**
 * Build complete SQL query
 */
const buildQuery = (config, organizationId) => {
  // Validate configuration
  const validation = validateConfig(config);
  if (!validation.valid) {
    throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
  }

  const { dataSource, fields, filters = [], groupBy = [], orderBy = [], limit = 1000 } = config;
  const table = DATA_SOURCES[dataSource].table;

  // Start with params array - organization_id is always first
  const params = [organizationId];

  // Build SELECT clause
  const selectClause = buildSelectClause(fields, dataSource, groupBy);

  // Build WHERE clause (include soft delete and organization filter)
  const whereResult = buildWhereClause(filters, dataSource, params);
  const filterWhere = whereResult.clause;
  const baseWhere = `organization_id = $1 AND deleted_at IS NULL`;
  const whereClause = filterWhere ? `${baseWhere} AND ${filterWhere}` : baseWhere;

  // Build GROUP BY clause
  const groupByClause = buildGroupByClause(groupBy, dataSource);

  // Build ORDER BY clause
  const orderByClause = buildOrderByClause(orderBy, dataSource);

  // Build final query
  let query = `SELECT ${selectClause} FROM ${table} WHERE ${whereClause}`;

  if (groupByClause) {
    query += ` GROUP BY ${groupByClause}`;
  }

  if (orderByClause) {
    query += ` ORDER BY ${orderByClause}`;
  }

  // Add limit (cap at 10000)
  const finalLimit = Math.min(limit || 1000, 10000);
  query += ` LIMIT ${finalLimit}`;

  return {
    query,
    params: whereResult.params
  };
};

/**
 * Execute a report query
 */
const executeReport = async (config, organizationId) => {
  const { query, params } = buildQuery(config, organizationId);

  console.log('Executing report query:', query);
  console.log('With params:', params);

  const result = await db.query(query, params, organizationId);
  return result.rows;
};

// ============================================
// METADATA FUNCTIONS
// ============================================

/**
 * Get all available data sources
 */
const getDataSources = () => {
  return Object.keys(DATA_SOURCES).map(key => ({
    id: key,
    label: DATA_SOURCES[key].label,
    description: DATA_SOURCES[key].description
  }));
};

/**
 * Get fields for a specific data source
 */
const getFieldsForDataSource = (dataSource) => {
  if (!DATA_SOURCES[dataSource]) {
    throw new Error(`Invalid data source: ${dataSource}`);
  }

  const fields = DATA_SOURCES[dataSource].fields;
  return Object.keys(fields).map(fieldName => ({
    name: fieldName,
    ...fields[fieldName]
  }));
};

/**
 * Get operators for a field type
 */
const getOperatorsForFieldType = (fieldType) => {
  return Object.keys(OPERATORS)
    .filter(opKey => OPERATORS[opKey].types.includes(fieldType))
    .map(opKey => ({
      value: opKey,
      label: opKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      requiresValue: !OPERATORS[opKey].noValue,
      isArray: OPERATORS[opKey].array || false,
      isRange: OPERATORS[opKey].range || false
    }));
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  buildQuery,
  executeReport,
  validateConfig,
  getDataSources,
  getFieldsForDataSource,
  getOperatorsForFieldType,
  DATA_SOURCES,
  OPERATORS
};
