/**
 * Phase 1: Database Visibility Constraints Tests
 * Tests for database schema constraints and defaults
 */

const { Pool } = require('pg');

// Database connection for tests
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

describe('Database Visibility Constraints', () => {

  // ============================================
  // TEST SUITE 1: Column Existence
  // ============================================

  describe('Visibility Columns Exist', () => {

    test('custom_field_definitions table has overall_visibility column', async () => {
      const query = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'custom_field_definitions'
        AND column_name = 'overall_visibility';
      `;

      const result = await pool.query(query);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].column_name).toBe('overall_visibility');
      expect(result.rows[0].data_type).toBe('character varying');
    });

    test('custom_field_definitions table has visibility_logic column', async () => {
      const query = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'custom_field_definitions'
        AND column_name = 'visibility_logic';
      `;

      const result = await pool.query(query);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].column_name).toBe('visibility_logic');
    });

    test('default_field_configurations table has overall_visibility column', async () => {
      const query = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'default_field_configurations'
        AND column_name = 'overall_visibility';
      `;

      const result = await pool.query(query);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].column_name).toBe('overall_visibility');
    });

    test('default_field_configurations table has visibility_logic column', async () => {
      const query = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'default_field_configurations'
        AND column_name = 'visibility_logic';
      `;

      const result = await pool.query(query);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].column_name).toBe('visibility_logic');
    });
  });

  // ============================================
  // TEST SUITE 2: Default Values
  // ============================================

  describe('Default Values', () => {

    test('overall_visibility defaults to "visible" for custom_field_definitions', async () => {
      const query = `
        SELECT column_default
        FROM information_schema.columns
        WHERE table_name = 'custom_field_definitions'
        AND column_name = 'overall_visibility';
      `;

      const result = await pool.query(query);
      expect(result.rows[0].column_default).toContain('visible');
    });

    test('visibility_logic defaults to "master_override" for custom_field_definitions', async () => {
      const query = `
        SELECT column_default
        FROM information_schema.columns
        WHERE table_name = 'custom_field_definitions'
        AND column_name = 'visibility_logic';
      `;

      const result = await pool.query(query);
      expect(result.rows[0].column_default).toContain('master_override');
    });

    test('overall_visibility defaults to "visible" for default_field_configurations', async () => {
      const query = `
        SELECT column_default
        FROM information_schema.columns
        WHERE table_name = 'default_field_configurations'
        AND column_name = 'overall_visibility';
      `;

      const result = await pool.query(query);
      expect(result.rows[0].column_default).toContain('visible');
    });

    test('visibility_logic defaults to "master_override" for default_field_configurations', async () => {
      const query = `
        SELECT column_default
        FROM information_schema.columns
        WHERE table_name = 'default_field_configurations'
        AND column_name = 'visibility_logic';
      `;

      const result = await pool.query(query);
      expect(result.rows[0].column_default).toContain('master_override');
    });
  });

  // ============================================
  // TEST SUITE 3: Check Constraints
  // ============================================

  describe('Check Constraints', () => {

    test('overall_visibility has CHECK constraint for custom_field_definitions', async () => {
      const query = `
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'custom_field_definitions'
        AND constraint_name LIKE '%overall_visibility%';
      `;

      const result = await pool.query(query);
      // Should have a CHECK constraint
      const checkConstraints = result.rows.filter(r => r.constraint_type === 'CHECK');
      expect(checkConstraints.length).toBeGreaterThan(0);
    });

    test('visibility_logic has CHECK constraint for custom_field_definitions', async () => {
      const query = `
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'custom_field_definitions'
        AND constraint_name LIKE '%visibility_logic%';
      `;

      const result = await pool.query(query);
      const checkConstraints = result.rows.filter(r => r.constraint_type === 'CHECK');
      expect(checkConstraints.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // TEST SUITE 4: Indexes
  // ============================================

  describe('Performance Indexes', () => {

    test('idx_custom_fields_visibility index exists', async () => {
      const query = `
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'custom_field_definitions'
        AND indexname = 'idx_custom_fields_visibility';
      `;

      const result = await pool.query(query);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].indexname).toBe('idx_custom_fields_visibility');
    });

    test('idx_default_fields_visibility index exists', async () => {
      const query = `
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'default_field_configurations'
        AND indexname = 'idx_default_fields_visibility';
      `;

      const result = await pool.query(query);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].indexname).toBe('idx_default_fields_visibility');
    });

    test('custom_fields_visibility index includes organization_id', async () => {
      const query = `
        SELECT indexdef
        FROM pg_indexes
        WHERE tablename = 'custom_field_definitions'
        AND indexname = 'idx_custom_fields_visibility';
      `;

      const result = await pool.query(query);
      expect(result.rows[0].indexdef).toContain('organization_id');
      expect(result.rows[0].indexdef).toContain('overall_visibility');
    });
  });

  // ============================================
  // TEST SUITE 5: Data Integrity
  // ============================================

  describe('Data Integrity', () => {

    test('all existing custom_field_definitions have overall_visibility set', async () => {
      const query = `
        SELECT COUNT(*) as null_count
        FROM custom_field_definitions
        WHERE overall_visibility IS NULL;
      `;

      const result = await pool.query(query);
      expect(parseInt(result.rows[0].null_count)).toBe(0);
    });

    test('all existing custom_field_definitions have visibility_logic set', async () => {
      const query = `
        SELECT COUNT(*) as null_count
        FROM custom_field_definitions
        WHERE visibility_logic IS NULL;
      `;

      const result = await pool.query(query);
      expect(parseInt(result.rows[0].null_count)).toBe(0);
    });

    test('overall_visibility values are valid (visible or hidden)', async () => {
      const query = `
        SELECT COUNT(*) as invalid_count
        FROM custom_field_definitions
        WHERE overall_visibility NOT IN ('visible', 'hidden');
      `;

      const result = await pool.query(query);
      expect(parseInt(result.rows[0].invalid_count)).toBe(0);
    });

    test('visibility_logic values are valid', async () => {
      const query = `
        SELECT COUNT(*) as invalid_count
        FROM custom_field_definitions
        WHERE visibility_logic NOT IN ('master_override', 'context_based');
      `;

      const result = await pool.query(query);
      expect(parseInt(result.rows[0].invalid_count)).toBe(0);
    });
  });

  // ============================================
  // TEST SUITE 6: Query Performance
  // ============================================

  describe('Query Performance', () => {

    test('filtering by overall_visibility uses index', async () => {
      const query = `
        EXPLAIN (FORMAT JSON)
        SELECT * FROM custom_field_definitions
        WHERE organization_id = $1
        AND overall_visibility = 'hidden'
        LIMIT 10;
      `;

      const result = await pool.query(query, ['test-org']);
      const plan = result.rows[0][0];

      // Check if index is used in the plan
      const planStr = JSON.stringify(plan);
      expect(planStr).toContain('idx_custom_fields_visibility');
    });
  });

  // Cleanup after tests
  afterAll(async () => {
    await pool.end();
  });
});
