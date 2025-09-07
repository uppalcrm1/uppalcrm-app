const { Pool } = require('pg');

/**
 * Comprehensive Database Migration Verification
 * Checks the current state of the contact management database migration
 */

// Render PostgreSQL connection
const pool = new Pool({
  connectionString: "postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database",
  ssl: {
    rejectUnauthorized: false
  }
});

const verificationResults = {
  tables: {},
  columns: {},
  indexes: {},
  foreignKeys: {},
  rlsPolicies: {},
  defaultData: {},
  functions: {},
  migrationAudit: {}
};

async function checkTableExistence() {
  console.log('\n🔍 CHECKING TABLE EXISTENCE\n');
  
  const expectedTables = [
    'contacts',
    'software_editions', 
    'accounts',
    'device_registrations',
    'software_licenses',
    'trials',
    'license_transfers',
    'downloads_activations',
    'contacts_backup'
  ];

  try {
    const result = await pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const existingTables = result.rows.map(row => row.table_name);
    
    for (const table of expectedTables) {
      const exists = existingTables.includes(table);
      verificationResults.tables[table] = exists;
      console.log(`${exists ? '✅' : '❌'} ${table}: ${exists ? 'EXISTS' : 'MISSING'}`);
    }

    console.log(`\n📊 Total tables found: ${existingTables.length}`);
    console.log(`📊 Expected tables: ${expectedTables.length}`);
    
    // Show any unexpected tables
    const unexpectedTables = existingTables.filter(table => !expectedTables.includes(table));
    if (unexpectedTables.length > 0) {
      console.log('\n🔍 Unexpected tables found:');
      unexpectedTables.forEach(table => console.log(`   - ${table}`));
    }

  } catch (error) {
    console.error('❌ Error checking table existence:', error.message);
    throw error;
  }
}

async function checkColumnStructures() {
  console.log('\n🔍 CHECKING COLUMN STRUCTURES\n');

  const expectedStructures = {
    contacts: [
      { column_name: 'id', data_type: 'uuid' },
      { column_name: 'tenant_id', data_type: 'uuid' },
      { column_name: 'name', data_type: 'character varying' },
      { column_name: 'email', data_type: 'character varying' },
      { column_name: 'phone', data_type: 'character varying' },
      { column_name: 'company', data_type: 'character varying' },
      { column_name: 'status', data_type: 'character varying' },
      { column_name: 'source', data_type: 'character varying' },
      { column_name: 'tags', data_type: 'ARRAY' },
      { column_name: 'notes', data_type: 'text' },
      { column_name: 'created_at', data_type: 'timestamp with time zone' },
      { column_name: 'updated_at', data_type: 'timestamp with time zone' }
    ],
    software_editions: [
      { column_name: 'id', data_type: 'uuid' },
      { column_name: 'name', data_type: 'character varying' },
      { column_name: 'description', data_type: 'text' },
      { column_name: 'features', data_type: 'ARRAY' },
      { column_name: 'price', data_type: 'numeric' },
      { column_name: 'trial_duration_hours', data_type: 'integer' }
    ],
    accounts: [
      { column_name: 'id', data_type: 'uuid' },
      { column_name: 'contact_id', data_type: 'uuid' },
      { column_name: 'username', data_type: 'character varying' },
      { column_name: 'password_hash', data_type: 'character varying' },
      { column_name: 'status', data_type: 'character varying' },
      { column_name: 'created_at', data_type: 'timestamp with time zone' }
    ]
  };

  for (const [tableName, expectedColumns] of Object.entries(expectedStructures)) {
    if (!verificationResults.tables[tableName]) {
      console.log(`⏭️  Skipping ${tableName} - table doesn't exist`);
      continue;
    }

    try {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      const actualColumns = result.rows;
      verificationResults.columns[tableName] = {
        expected: expectedColumns.length,
        actual: actualColumns.length,
        columns: actualColumns
      };

      console.log(`\n📋 ${tableName.toUpperCase()} COLUMNS:`);
      
      for (const expectedCol of expectedColumns) {
        const actualCol = actualColumns.find(col => col.column_name === expectedCol.column_name);
        const exists = !!actualCol;
        const typeMatch = exists && (actualCol.data_type === expectedCol.data_type || 
                                    actualCol.data_type.includes(expectedCol.data_type));
        
        console.log(`${exists ? (typeMatch ? '✅' : '⚠️ ') : '❌'} ${expectedCol.column_name}: ${exists ? actualCol.data_type : 'MISSING'}`);
      }

    } catch (error) {
      console.error(`❌ Error checking ${tableName} columns:`, error.message);
      verificationResults.columns[tableName] = { error: error.message };
    }
  }
}

async function checkIndexes() {
  console.log('\n🔍 CHECKING INDEXES\n');

  try {
    const result = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);

    const indexes = result.rows;
    verificationResults.indexes = { count: indexes.length, indexes };

    console.log(`📊 Total indexes found: ${indexes.length}\n`);
    
    // Group by table
    const indexesByTable = {};
    indexes.forEach(idx => {
      if (!indexesByTable[idx.tablename]) {
        indexesByTable[idx.tablename] = [];
      }
      indexesByTable[idx.tablename].push(idx);
    });

    Object.keys(indexesByTable).forEach(table => {
      console.log(`📋 ${table.toUpperCase()}:`);
      indexesByTable[table].forEach(idx => {
        const isPrimary = idx.indexname.includes('_pkey');
        const isUnique = idx.indexdef.includes('UNIQUE');
        console.log(`   ${isPrimary ? '🔑' : isUnique ? '🔒' : '📇'} ${idx.indexname}`);
      });
    });

  } catch (error) {
    console.error('❌ Error checking indexes:', error.message);
    verificationResults.indexes = { error: error.message };
  }
}

async function checkForeignKeys() {
  console.log('\n🔍 CHECKING FOREIGN KEY RELATIONSHIPS\n');

  try {
    const result = await pool.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name
    `);

    const foreignKeys = result.rows;
    verificationResults.foreignKeys = { count: foreignKeys.length, relationships: foreignKeys };

    console.log(`📊 Total foreign key relationships: ${foreignKeys.length}\n`);

    if (foreignKeys.length > 0) {
      foreignKeys.forEach(fk => {
        console.log(`🔗 ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
    } else {
      console.log('⚠️  No foreign key relationships found');
    }

  } catch (error) {
    console.error('❌ Error checking foreign keys:', error.message);
    verificationResults.foreignKeys = { error: error.message };
  }
}

async function checkRLSPolicies() {
  console.log('\n🔍 CHECKING ROW-LEVEL SECURITY POLICIES\n');

  try {
    // Check if RLS is enabled on tables
    const rlsResult = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        rowsecurity,
        forcerowsecurity
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    // Check existing policies
    const policiesResult = await pool.query(`
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `);

    verificationResults.rlsPolicies = {
      tables: rlsResult.rows,
      policies: policiesResult.rows
    };

    console.log(`📊 Tables with RLS status:`);
    rlsResult.rows.forEach(table => {
      const rlsEnabled = table.rowsecurity;
      console.log(`${rlsEnabled ? '✅' : '❌'} ${table.tablename}: RLS ${rlsEnabled ? 'ENABLED' : 'DISABLED'}`);
    });

    console.log(`\n📊 Total RLS policies: ${policiesResult.rows.length}`);
    if (policiesResult.rows.length > 0) {
      policiesResult.rows.forEach(policy => {
        console.log(`🛡️  ${policy.tablename}.${policy.policyname} (${policy.cmd})`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking RLS policies:', error.message);
    verificationResults.rlsPolicies = { error: error.message };
  }
}

async function checkDefaultData() {
  console.log('\n🔍 CHECKING DEFAULT SOFTWARE EDITIONS DATA\n');

  try {
    if (!verificationResults.tables.software_editions) {
      console.log('⏭️  Skipping software_editions data check - table doesn\'t exist');
      return;
    }

    const result = await pool.query(`
      SELECT id, name, description, price, trial_duration_hours
      FROM software_editions
      ORDER BY name
    `);

    const editions = result.rows;
    verificationResults.defaultData.software_editions = editions;

    console.log(`📊 Software editions found: ${editions.length}\n`);
    
    const expectedEditions = ['Gold', 'Jio', 'Smart'];
    expectedEditions.forEach(expected => {
      const found = editions.find(edition => edition.name === expected);
      console.log(`${found ? '✅' : '❌'} ${expected}: ${found ? 'EXISTS' : 'MISSING'}`);
      if (found) {
        console.log(`   Price: $${found.price}, Trial: ${found.trial_duration_hours}h`);
      }
    });

  } catch (error) {
    console.error('❌ Error checking default data:', error.message);
    verificationResults.defaultData = { error: error.message };
  }
}

async function checkUtilityFunctions() {
  console.log('\n🔍 CHECKING UTILITY FUNCTIONS\n');

  const expectedFunctions = [
    'generate_license_key',
    'generate_trial_key',
    'update_updated_at_column'
  ];

  try {
    const result = await pool.query(`
      SELECT 
        routine_name,
        routine_type,
        data_type
      FROM information_schema.routines 
      WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
      ORDER BY routine_name
    `);

    const functions = result.rows;
    verificationResults.functions = { count: functions.length, functions };

    console.log(`📊 Total functions found: ${functions.length}\n`);

    expectedFunctions.forEach(expected => {
      const found = functions.find(func => func.routine_name === expected);
      console.log(`${found ? '✅' : '❌'} ${expected}: ${found ? 'EXISTS' : 'MISSING'}`);
    });

    // Show all functions
    if (functions.length > 0) {
      console.log('\n📋 All functions:');
      functions.forEach(func => {
        console.log(`   🔧 ${func.routine_name}() → ${func.data_type}`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking functions:', error.message);
    verificationResults.functions = { error: error.message };
  }
}

async function checkMigrationAudit() {
  console.log('\n🔍 CHECKING MIGRATION AUDIT\n');

  try {
    if (!verificationResults.tables.contacts_backup) {
      console.log('❌ contacts_backup table not found - migration audit unavailable');
      return;
    }

    const result = await pool.query(`
      SELECT COUNT(*) as backup_count
      FROM contacts_backup
    `);

    const backupCount = result.rows[0].backup_count;
    verificationResults.migrationAudit.backup_count = backupCount;

    console.log(`📊 Backup records in contacts_backup: ${backupCount}`);

    // Check if original leads data exists
    try {
      const contactsResult = await pool.query(`
        SELECT COUNT(*) as contacts_count
        FROM contacts
      `);

      const contactsCount = contactsResult.rows[0].contacts_count;
      verificationResults.migrationAudit.contacts_count = contactsCount;

      console.log(`📊 Current contacts: ${contactsCount}`);

      if (backupCount > 0 && contactsCount === 0) {
        console.log('⚠️  Data exists in backup but contacts table is empty - migration incomplete');
      } else if (backupCount > 0 && contactsCount > 0) {
        console.log('✅ Migration appears to have preserved data');
      }

    } catch (error) {
      console.log('⚠️  Could not check contacts count:', error.message);
    }

  } catch (error) {
    console.error('❌ Error checking migration audit:', error.message);
    verificationResults.migrationAudit = { error: error.message };
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 MIGRATION VERIFICATION SUMMARY');
  console.log('='.repeat(80));

  const missingTables = Object.entries(verificationResults.tables)
    .filter(([table, exists]) => !exists)
    .map(([table]) => table);

  const existingTables = Object.entries(verificationResults.tables)
    .filter(([table, exists]) => exists)
    .map(([table]) => table);

  console.log(`\n✅ EXISTING TABLES (${existingTables.length}):`);
  existingTables.forEach(table => console.log(`   - ${table}`));

  if (missingTables.length > 0) {
    console.log(`\n❌ MISSING TABLES (${missingTables.length}):`);
    missingTables.forEach(table => console.log(`   - ${table}`));
  }

  // Identify critical issues
  const criticalIssues = [];
  
  if (!verificationResults.tables.contacts) {
    criticalIssues.push('❌ CRITICAL: contacts table is missing');
  }
  
  if (!verificationResults.tables.software_editions) {
    criticalIssues.push('❌ CRITICAL: software_editions table is missing');
  }

  if (verificationResults.foreignKeys?.count === 0) {
    criticalIssues.push('⚠️  WARNING: No foreign key relationships found');
  }

  if (verificationResults.defaultData?.software_editions?.length === 0) {
    criticalIssues.push('⚠️  WARNING: No software editions data found');
  }

  if (criticalIssues.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES FOUND:');
    criticalIssues.forEach(issue => console.log(`   ${issue}`));
  }

  console.log('\n📊 STATISTICS:');
  console.log(`   Tables: ${existingTables.length}/${Object.keys(verificationResults.tables).length}`);
  console.log(`   Indexes: ${verificationResults.indexes?.count || 0}`);
  console.log(`   Foreign Keys: ${verificationResults.foreignKeys?.count || 0}`);
  console.log(`   Functions: ${verificationResults.functions?.count || 0}`);
  console.log(`   Software Editions: ${verificationResults.defaultData?.software_editions?.length || 0}`);

  return {
    criticalIssues,
    missingTables,
    existingTables,
    verificationResults
  };
}

async function runVerification() {
  console.log('🚀 Starting Database Migration Verification');
  console.log('='.repeat(80));

  try {
    // Test connection first
    const client = await pool.connect();
    const result = await client.query('SELECT NOW(), current_database()');
    console.log('✅ Connected to database:', result.rows[0].current_database);
    console.log('✅ Server time:', result.rows[0].now);
    client.release();

    // Run all verification checks
    await checkTableExistence();
    await checkColumnStructures();
    await checkIndexes();
    await checkForeignKeys();
    await checkRLSPolicies();
    await checkDefaultData();
    await checkUtilityFunctions();
    await checkMigrationAudit();

    // Generate final report
    const report = await generateReport();
    
    return report;

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Export for use in other scripts
module.exports = {
  runVerification,
  verificationResults
};

// Run verification if called directly
if (require.main === module) {
  runVerification()
    .then(report => {
      console.log('\n✅ Verification completed');
      process.exit(report.criticalIssues.length > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('\n❌ Verification failed:', error.message);
      process.exit(1);
    });
}