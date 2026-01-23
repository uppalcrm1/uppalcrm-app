#!/usr/bin/env node

const migrationRunner = require('./migrationRunner');

async function main() {
  const command = process.argv[2] || 'run';

  try {
    switch (command) {
      case 'status':
        const status = await migrationRunner.status();
        console.log('\n📊 Migration Status:');
        console.log(`   Applied: ${status.applied}`);
        console.log(`   Pending: ${status.pending}`);
        if (status.pendingMigrations.length > 0) {
          console.log('\n   Pending migrations:');
          status.pendingMigrations.forEach(m => console.log(`   - ${m}`));
        }
        break;

      case 'run':
        console.log('🚀 Running pending migrations...\n');
        const results = await migrationRunner.runPending();
        console.log(`\n✅ Completed ${results.length} migration(s)`);
        break;

      default:
        console.log('Usage: node runMigrations.js [status|run]');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration error:', error);
    process.exit(1);
  }
}

main();
