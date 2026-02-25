#!/usr/bin/env node

const db = require('./database/connection');

async function toggleWhatsAppFlag(state) {
  try {
    if (!['on', 'off', 'true', 'false', '0', '1'].includes(state?.toLowerCase())) {
      console.log('Usage: node toggle-whatsapp-flag.js [on|off|true|false]');
      console.log('\nExample:');
      console.log('  node toggle-whatsapp-flag.js off    # Disable WhatsApp');
      console.log('  node toggle-whatsapp-flag.js on     # Enable WhatsApp');
      process.exit(1);
    }

    const enable = ['on', 'true', '1'].includes(state?.toLowerCase());

    // Update all twilio configs for all organizations
    const result = await db.query(`
      UPDATE twilio_config
      SET whatsapp_enabled = $1
      WHERE is_active = true
      RETURNING id, organization_id, whatsapp_enabled, whatsapp_number
    `, [enable]);

    if (result.rows.length === 0) {
      console.log('❌ No active Twilio configurations found');
      process.exit(1);
    }

    console.log(`\n✅ WhatsApp Feature Flag: ${enable ? '🟢 ENABLED' : '🔴 DISABLED'}\n`);
    console.log('Updated configurations:');
    result.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. Org ID: ${row.organization_id}`);
      console.log(`     WhatsApp Enabled: ${row.whatsapp_enabled}`);
      console.log(`     WhatsApp Number: ${row.whatsapp_number}`);
    });

    console.log('\n📝 Testing Instructions:');
    if (enable) {
      console.log('  1. Refresh the frontend (clear cache if needed)');
      console.log('  2. Go to Communications page → WhatsApp tab should be VISIBLE');
      console.log('  3. Go to New Message dropdown → "Send WhatsApp" should be VISIBLE');
      console.log('  4. Go to Lead detail → Green WhatsApp button should be VISIBLE');
      console.log('  5. Go to Contact detail → Green WhatsApp button should be VISIBLE');
      console.log('  6. Activity timeline → WhatsApp messages show with green icons');
    } else {
      console.log('  1. Refresh the frontend (clear cache if needed)');
      console.log('  2. Go to Communications page → WhatsApp tab should be HIDDEN');
      console.log('  3. Go to New Message dropdown → "Send WhatsApp" should be HIDDEN');
      console.log('  4. Go to Lead detail → Green WhatsApp button should be HIDDEN');
      console.log('  5. Go to Contact detail → Green WhatsApp button should be HIDDEN');
      console.log('  6. Activity timeline → WhatsApp messages still visible (read-only)');
    }

    console.log('\n✨ Feature flag toggled successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

const state = process.argv[2];
toggleWhatsAppFlag(state);
