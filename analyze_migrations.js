const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function getSchemaInfo() {
  try {
    console.log('Connecting to database...');
    await client.connect();

    // Get all tables
    const tablesResult = await client.query(`
      SELECT table_name, table_schema
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_name;
    `);

    console.log('\n=== TABLES ===');
    const tables = {};
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      console.log(`\nTable: ${tableName}`);

      // Get columns
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);

      console.log('  Columns:');
      tables[tableName] = {
        columns: {},
        indexes: [],
        constraints: []
      };

      for (const col of columnsResult.rows) {
        const colInfo = `${col.column_name} (${col.data_type}${col.character_maximum_length ? '(' + col.character_maximum_length + ')' : ''})${col.is_nullable === 'NO' ? ' NOT NULL' : ''}${col.column_default ? ' DEFAULT ' + col.column_default : ''}`;
        console.log(`    - ${colInfo}`);
        tables[tableName].columns[col.column_name] = {
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          default: col.column_default
        };
      }

      // Get indexes
      const indexesResult = await client.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = $1
        AND schemaname NOT IN ('pg_catalog', 'information_schema');
      `, [tableName]);

      if (indexesResult.rows.length > 0) {
        console.log('  Indexes:');
        for (const idx of indexesResult.rows) {
          console.log(`    - ${idx.indexname}`);
          tables[tableName].indexes.push(idx.indexname);
        }
      }

      // Get constraints
      const constraintsResult = await client.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = $1;
      `, [tableName]);

      if (constraintsResult.rows.length > 0) {
        console.log('  Constraints:');
        for (const constraint of constraintsResult.rows) {
          console.log(`    - ${constraint.constraint_name} (${constraint.constraint_type})`);
          tables[tableName].constraints.push(constraint.constraint_name);
        }
      }
    }

    // Get all views
    console.log('\n\n=== VIEWS ===');
    const viewsResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_type = 'VIEW'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_name;
    `);

    const views = [];
    for (const view of viewsResult.rows) {
      console.log(`\nView: ${view.table_name}`);
      views.push(view.table_name);
    }

    // Get functions
    console.log('\n\n=== FUNCTIONS/PROCEDURES ===');
    const functionsResult = await client.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY routine_name;
    `);

    const functions = [];
    for (const func of functionsResult.rows) {
      console.log(`${func.routine_name} (${func.routine_type})`);
      functions.push(func.routine_name);
    }

    await client.end();

    return { tables, views, functions };
  } catch (error) {
    console.error('Database error:', error);
    process.exit(1);
  }
}

async function getMigrationInfo() {
  const migrationsDir = path.join(__dirname, 'database', 'migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  console.log('\n\n=== ANALYZING MIGRATIONS ===');
  const migrations = [];

  for (const file of files) {
    if (!file.endsWith('.sql') && !file.endsWith('.js')) continue;

    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const migration = {
      file,
      content,
      creates: {
        tables: [],
        columns: [],
        indexes: [],
        functions: [],
        views: []
      },
      modifies: {
        tables: [],
        columns: [],
        constraints: []
      },
      drops: []
    };

    // Parse CREATE TABLE
    const createTableMatches = content.matchAll(/CREATE\s+(?:TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?[\w_]+?"?\.)?(?:"?([\w_]+)"?)/gi);
    for (const match of createTableMatches) {
      migration.creates.tables.push(match[1]);
    }

    // Parse CREATE INDEX
    const createIndexMatches = content.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(?:"?([\w_]+)"?)/gi);
    for (const match of createIndexMatches) {
      migration.creates.indexes.push(match[1]);
    }

    // Parse CREATE FUNCTION
    const createFunctionMatches = content.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:"?([\w_]+)"?)/gi);
    for (const match of createFunctionMatches) {
      migration.creates.functions.push(match[1]);
    }

    // Parse CREATE VIEW
    const createViewMatches = content.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:"?([\w_]+)"?)/gi);
    for (const match of createViewMatches) {
      migration.creates.views.push(match[1]);
    }

    // Parse ALTER TABLE
    const alterTableMatches = content.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:"?[\w_]+?"?\.)?(?:"?([\w_]+)"?)/gi);
    for (const match of alterTableMatches) {
      if (!migration.modifies.tables.includes(match[1])) {
        migration.modifies.tables.push(match[1]);
      }
    }

    // Parse ADD COLUMN
    const addColumnMatches = content.matchAll(/ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?([\w_]+)"?)/gi);
    for (const match of addColumnMatches) {
      migration.modifies.columns.push(match[1]);
    }

    // Parse DROP
    const dropMatches = content.matchAll(/DROP\s+(?:TABLE|INDEX|FUNCTION|VIEW|CONSTRAINT)\s+(?:IF\s+EXISTS\s+)?(?:"?([\w_]+)"?)/gi);
    for (const match of dropMatches) {
      migration.drops.push(match[1]);
    }

    migrations.push(migration);
  }

  return migrations;
}

async function compareSchemaAndMigrations() {
  const schemaInfo = await getSchemaInfo();
  const migrations = await getMigrationInfo();

  console.log('\n\n=== MIGRATION ANALYSIS ===');
  console.log(`Total migration files: ${migrations.length}`);

  const report = {
    redundant: [],
    necessary: [],
    problematic: [],
    summary: {}
  };

  for (const migration of migrations) {
    const issues = [];

    // Check if tables already exist
    for (const table of migration.creates.tables) {
      if (schemaInfo.tables[table]) {
        issues.push(`Table '${table}' already exists in schema`);
      }
    }

    // Check if indexes already exist
    for (const index of migration.creates.indexes) {
      let exists = false;
      for (const table of Object.values(schemaInfo.tables)) {
        if (table.indexes.includes(index)) {
          exists = true;
          break;
        }
      }
      if (exists) {
        issues.push(`Index '${index}' already exists in schema`);
      }
    }

    // Check if functions already exist
    for (const func of migration.creates.functions) {
      if (schemaInfo.functions.includes(func)) {
        issues.push(`Function '${func}' already exists in schema`);
      }
    }

    // Check if views already exist
    for (const view of migration.creates.views) {
      if (schemaInfo.views.includes(view)) {
        issues.push(`View '${view}' already exists in schema`);
      }
    }

    // Categorize migration
    if (issues.length > 0 && migration.creates.tables.length === 0 && migration.creates.indexes.length === 0) {
      report.redundant.push({
        file: migration.file,
        reason: issues,
        creates: migration.creates,
        modifies: migration.modifies
      });
    } else if (issues.length > 0) {
      report.problematic.push({
        file: migration.file,
        issues: issues,
        creates: migration.creates,
        modifies: migration.modifies,
        drops: migration.drops
      });
    } else {
      report.necessary.push({
        file: migration.file,
        creates: migration.creates,
        modifies: migration.modifies
      });
    }
  }

  console.log('\n\n=== REDUNDANT MIGRATIONS (Schema Already Exists) ===');
  console.log(`Count: ${report.redundant.length}`);
  for (const mig of report.redundant) {
    console.log(`\n${mig.file}`);
    console.log(`  Reason: ${mig.reason.join(', ')}`);
    if (mig.modifies.tables.length > 0) {
      console.log(`  Modifies tables: ${mig.modifies.tables.join(', ')}`);
    }
    if (mig.modifies.columns.length > 0) {
      console.log(`  Modifies columns: ${mig.modifies.columns.join(', ')}`);
    }
  }

  console.log('\n\n=== NECESSARY MIGRATIONS (Missing Schema) ===');
  console.log(`Count: ${report.necessary.length}`);
  for (const mig of report.necessary) {
    console.log(`\n${mig.file}`);
    if (mig.creates.tables.length > 0) {
      console.log(`  Creates tables: ${mig.creates.tables.join(', ')}`);
    }
    if (mig.creates.indexes.length > 0) {
      console.log(`  Creates indexes: ${mig.creates.indexes.join(', ')}`);
    }
    if (mig.creates.functions.length > 0) {
      console.log(`  Creates functions: ${mig.creates.functions.join(', ')}`);
    }
    if (mig.creates.views.length > 0) {
      console.log(`  Creates views: ${mig.creates.views.join(', ')}`);
    }
    if (mig.modifies.tables.length > 0) {
      console.log(`  Modifies tables: ${mig.modifies.tables.join(', ')}`);
    }
  }

  console.log('\n\n=== PROBLEMATIC MIGRATIONS ===');
  console.log(`Count: ${report.problematic.length}`);
  for (const mig of report.problematic) {
    console.log(`\n${mig.file}`);
    for (const issue of mig.issues) {
      console.log(`  Issue: ${issue}`);
    }
    if (mig.creates.tables.length > 0) {
      console.log(`  Creates tables: ${mig.creates.tables.join(', ')}`);
    }
    if (mig.modifies.tables.length > 0) {
      console.log(`  Modifies tables: ${mig.modifies.tables.join(', ')}`);
    }
  }

  console.log('\n\n=== SUMMARY ===');
  console.log(`Total migrations: ${migrations.length}`);
  console.log(`Redundant: ${report.redundant.length}`);
  console.log(`Necessary: ${report.necessary.length}`);
  console.log(`Problematic: ${report.problematic.length}`);
  console.log(`\nCurrent schema:`);
  console.log(`  Tables: ${Object.keys(schemaInfo.tables).length}`);
  console.log(`  Views: ${schemaInfo.views.length}`);
  console.log(`  Functions: ${schemaInfo.functions.length}`);

  // Save detailed report
  const reportPath = path.join(__dirname, 'migration_analysis_report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    statistics: {
      totalMigrations: migrations.length,
      redundant: report.redundant.length,
      necessary: report.necessary.length,
      problematic: report.problematic.length,
      currentSchema: {
        tables: Object.keys(schemaInfo.tables).length,
        views: schemaInfo.views.length,
        functions: schemaInfo.functions.length
      }
    },
    redundantMigrations: report.redundant,
    necessaryMigrations: report.necessary,
    problematicMigrations: report.problematic,
    currentSchema: schemaInfo
  }, null, 2));

  console.log(`\nDetailed report saved to: ${reportPath}`);
}

compareSchemaAndMigrations().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
