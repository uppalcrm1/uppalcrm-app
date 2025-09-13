/**
 * Migration to add user management fields to users table
 * This ensures the users table has all the fields needed for the user management system
 */

const { query } = require('../database/connection');

const addUserManagementFields = async () => {
  try {
    console.log('🔧 Starting user management fields migration...');

    // Enable UUID extension if not exists
    await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Add missing columns to users table if they don't exist
    const alterations = [
      // Status field for active/inactive users
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`,
      
      // Track if user needs to change password on first login
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT false`,
      
      // Track failed login attempts for security
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0`,
      
      // Soft delete timestamp
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE`,
      
      // Who created this user (for audit trail)
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id)`,
      
      // Ensure we have proper password field
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`,
    ];

    for (const alteration of alterations) {
      try {
        await query(alteration);
        console.log('✅ Applied:', alteration.substring(0, 50) + '...');
      } catch (error) {
        if (error.code === '42701') { // Column already exists
          console.log('⏭️ Column already exists, skipping...');
        } else {
          console.error('❌ Error applying alteration:', error.message);
        }
      }
    }

    // Create indexes for better performance
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)`,
      `CREATE INDEX IF NOT EXISTS idx_users_organization_status ON users(organization_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,
      `CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by)`,
      `CREATE INDEX IF NOT EXISTS idx_users_email_org ON users(email, organization_id)`,
      `CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at)`,
    ];

    for (const index of indexes) {
      try {
        await query(index);
        console.log('✅ Created index:', index.substring(0, 50) + '...');
      } catch (error) {
        console.log('⏭️ Index already exists or cannot be created:', error.message);
      }
    }

    // Update existing users to have default values
    await query(`
      UPDATE users 
      SET status = 'active' 
      WHERE status IS NULL
    `);

    await query(`
      UPDATE users 
      SET is_first_login = false 
      WHERE is_first_login IS NULL
    `);

    await query(`
      UPDATE users 
      SET failed_login_attempts = 0 
      WHERE failed_login_attempts IS NULL
    `);

    // Migrate password field if needed
    const passwordCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN ('password', 'password_hash')
    `);

    const hasPassword = passwordCheck.rows.some(row => row.column_name === 'password');
    const hasPasswordHash = passwordCheck.rows.some(row => row.column_name === 'password_hash');

    if (hasPassword && !hasPasswordHash) {
      console.log('🔄 Migrating password to password_hash...');
      await query(`UPDATE users SET password_hash = password WHERE password_hash IS NULL AND password IS NOT NULL`);
    }

    console.log('✅ User management fields migration completed successfully!');
    
    // Show current table structure
    const tableInfo = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Current users table structure:');
    tableInfo.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Run migration if this file is executed directly
if (require.main === module) {
  addUserManagementFields()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addUserManagementFields };