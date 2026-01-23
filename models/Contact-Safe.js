/**
 * HOTFIX: Safe version of findByOrganization that works with varying schemas
 * This wraps the complex query in try-catch and falls back to simple query
 */

const { query } = require('../database/connection');

/**
 * Safe findByOrganization with fallback
 */
async function findByOrganizationSafe(organizationId, options = {}) {
  try {
    // Try complex query first
    return await findByOrganizationComplex(organizationId, options);
  } catch (error) {
    console.log('⚠️  Complex query failed, falling back to simple query');
    console.log('Error:', error.message);
    // Fall back to simple query
    return await findByOrganizationSimple(organizationId, options);
  }
}

/**
 * Complex query with all aggregations (for production)
 */
async function findByOrganizationComplex(organizationId, options = {}) {
  // Check if tables exist
  const tablesCheck = await query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('accounts', 'transactions')
  `, []);

  const tableNames = tablesCheck.rows.map(r => r.table_name);
  const hasAccounts = tableNames.includes('accounts');
  const hasTransactions = tableNames.includes('transactions');

  if (!hasAccounts || !hasTransactions) {
    throw new Error('Required tables missing - falling back');
  }

  const {
    limit = 50,
    offset = 0,
    status,
    type,
    priority,
    assigned_to,
    source,
    search,
    sort = 'created_at',
    order = 'desc'
  } = options;

  let whereConditions = ['c.organization_id = $1'];
  const params = [organizationId];
  let paramCount = 1;

  if (status) {
    whereConditions.push(`COALESCE(c.contact_status, c.status) = $${++paramCount}`);
    params.push(status);
  }

  if (source) {
    whereConditions.push(`COALESCE(c.contact_source, c.source) ILIKE $${++paramCount}`);
    params.push(`%${source}%`);
  }

  if (search) {
    whereConditions.push(`(
      c.first_name ILIKE $${++paramCount} OR
      c.last_name ILIKE $${paramCount} OR
      COALESCE(c.name, c.first_name || ' ' || c.last_name) ILIKE $${paramCount} OR
      c.email ILIKE $${paramCount}
    )`);
    params.push(`%${search}%`);
  }

  const whereClause = whereConditions.join(' AND ');

  const query_text = `
    SELECT
      c.id,
      c.organization_id,
      c.first_name,
      c.last_name,
      COALESCE(c.name, c.first_name || ' ' || c.last_name) as name,
      c.email,
      c.phone,
      c.company,
      c.title,
      c.department,
      c.linkedin,
      COALESCE(c.contact_status, c.status, 'active') as status,
      c.source,
      c.priority,
      c.notes,
      c.custom_fields,
      c.created_at,
      c.updated_at,
      c.last_contact_date,
      c.next_follow_up,

      -- Calculated fields
      COUNT(DISTINCT a.id)::integer as accounts_count,
      COUNT(DISTINCT t.id)::integer as transactions_count,
      COALESCE(SUM(CASE WHEN t.status != 'cancelled' THEN t.amount ELSE 0 END), 0)::numeric as total_revenue,
      MIN(LEAST(t.transaction_date, a.created_at)) as customer_since,
      c.last_contact_date as last_interaction_date,
      MIN(CASE WHEN a.next_renewal_date > NOW() THEN a.next_renewal_date END) as next_renewal_date,
      EXTRACT(DAY FROM (MIN(CASE WHEN a.next_renewal_date > NOW() THEN a.next_renewal_date END) - NOW()))::integer as days_until_renewal

    FROM contacts c
    LEFT JOIN accounts a ON a.contact_id = c.id AND a.organization_id = c.organization_id
    LEFT JOIN transactions t ON (t.contact_id = c.id OR t.account_id = a.id) AND t.organization_id = c.organization_id

    WHERE ${whereClause}

    GROUP BY c.id, c.first_name, c.last_name, c.name, c.email, c.phone, c.company,
             c.title, c.department, c.linkedin, c.contact_status, c.status, c.source, c.priority,
             c.notes, c.custom_fields, c.created_at, c.updated_at, c.last_contact_date, c.next_follow_up

    ORDER BY c.${sort} ${order}
    LIMIT $${++paramCount} OFFSET $${++paramCount}
  `;

  params.push(limit, offset);

  const result = await query(query_text, params, organizationId);

  const contacts = result.rows.map(row => ({
    id: row.id,
    organization_id: row.organization_id,
    first_name: row.first_name,
    last_name: row.last_name,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    title: row.title,
    department: row.department,
    linkedin: row.linkedin,
    status: row.status,
    source: row.source,
    priority: row.priority,
    notes: row.notes,
    custom_fields: row.custom_fields || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_contact_date: row.last_contact_date,
    next_follow_up: row.next_follow_up,
    accounts_count: parseInt(row.accounts_count) || 0,
    transactions_count: parseInt(row.transactions_count) || 0,
    total_revenue: parseFloat(row.total_revenue) || 0,
    customer_since: row.customer_since,
    last_interaction_date: row.last_interaction_date,
    next_renewal_date: row.next_renewal_date,
    days_until_renewal: row.days_until_renewal ? parseInt(row.days_until_renewal) : null
  }));

  const countResult = await query(`
    SELECT COUNT(DISTINCT c.id) as total
    FROM contacts c
    WHERE ${whereClause}
  `, params.slice(0, -2), organizationId);

  return {
    contacts,
    pagination: {
      total: parseInt(countResult.rows[0].total),
      page: Math.floor(offset / limit) + 1,
      limit,
      pages: Math.ceil(countResult.rows[0].total / limit)
    }
  };
}

/**
 * Simple query without aggregations (fallback for staging)
 */
async function findByOrganizationSimple(organizationId, options = {}) {
  const {
    limit = 50,
    offset = 0,
    status,
    source,
    search,
    sort = 'created_at',
    order = 'desc'
  } = options;

  let whereConditions = ['c.organization_id = $1'];
  const params = [organizationId];
  let paramCount = 1;

  if (status) {
    whereConditions.push(`COALESCE(c.contact_status, c.status) = $${++paramCount}`);
    params.push(status);
  }

  if (source) {
    whereConditions.push(`COALESCE(c.contact_source, c.source) ILIKE $${++paramCount}`);
    params.push(`%${source}%`);
  }

  if (search) {
    whereConditions.push(`(
      c.first_name ILIKE $${++paramCount} OR
      c.last_name ILIKE $${paramCount} OR
      c.email ILIKE $${paramCount}
    )`);
    params.push(`%${search}%`);
  }

  const whereClause = whereConditions.join(' AND ');

  const query_text = `
    SELECT
      c.id,
      c.organization_id,
      c.first_name,
      c.last_name,
      COALESCE(c.name, c.first_name || ' ' || c.last_name) as name,
      c.email,
      c.phone,
      c.company,
      c.title,
      c.department,
      c.linkedin,
      COALESCE(c.contact_status, c.status, 'active') as status,
      c.source,
      c.priority,
      c.notes,
      c.custom_fields,
      c.created_at,
      c.updated_at,
      c.last_contact_date,
      c.next_follow_up,
      -- Default values for missing aggregations
      0 as accounts_count,
      0 as transactions_count,
      0 as total_revenue,
      NULL as customer_since,
      c.last_contact_date as last_interaction_date,
      NULL as next_renewal_date,
      NULL as days_until_renewal
    FROM contacts c
    WHERE ${whereClause}
    ORDER BY c.${sort} ${order}
    LIMIT $${++paramCount} OFFSET $${++paramCount}
  `;

  params.push(limit, offset);

  const result = await query(query_text, params, organizationId);

  const contacts = result.rows.map(row => ({
    id: row.id,
    organization_id: row.organization_id,
    first_name: row.first_name,
    last_name: row.last_name,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    title: row.title,
    department: row.department,
    linkedin: row.linkedin,
    status: row.status,
    source: row.source,
    priority: row.priority,
    notes: row.notes,
    custom_fields: row.custom_fields || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_contact_date: row.last_contact_date,
    next_follow_up: row.next_follow_up,
    accounts_count: 0,
    transactions_count: 0,
    total_revenue: 0,
    customer_since: null,
    last_interaction_date: row.last_contact_date,
    next_renewal_date: null,
    days_until_renewal: null
  }));

  const countResult = await query(`
    SELECT COUNT(c.id) as total
    FROM contacts c
    WHERE ${whereClause}
  `, params.slice(0, -2), organizationId);

  return {
    contacts,
    pagination: {
      total: parseInt(countResult.rows[0].total),
      page: Math.floor(offset / limit) + 1,
      limit,
      pages: Math.ceil(countResult.rows[0].total / limit)
    }
  };
}

module.exports = {
  findByOrganizationSafe,
  findByOrganizationComplex,
  findByOrganizationSimple
};
