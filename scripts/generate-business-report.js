#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function generateBusinessReport() {
  console.log('📊 Generating Business Subscription Report...');

  const productionDbConfig = process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  } : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: false
  };

  const pool = new Pool(productionDbConfig);

  try {
    // Get all organizations with enhanced details
    const orgQuery = `
      SELECT
        o.id,
        o.organization_name,
        o.domain,
        o.is_active,
        o.trial_status,
        o.trial_expires_at,
        o.subscription_plan,
        o.subscription_status,
        o.created_at,
        o.admin_email,
        o.contact_name,
        (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id AND u.is_active = true) as active_user_count,
        (SELECT COUNT(*) FROM leads l WHERE l.organization_id = o.id) as lead_count,
        (SELECT COUNT(*) FROM contacts c WHERE c.organization_id = o.id) as contact_count
      FROM organizations o
      ORDER BY o.created_at DESC
    `;

    const result = await pool.query(orgQuery);
    const organizations = result.rows;

    console.log(`📋 Found ${organizations.length} organizations`);

    // Calculate statistics
    const stats = {
      total: organizations.length,
      active: organizations.filter(org => org.is_active).length,
      trial: organizations.filter(org => org.trial_status === 'active').length,
      paid: organizations.filter(org => org.subscription_status === 'active').length,
      totalUsers: organizations.reduce((sum, org) => sum + (parseInt(org.active_user_count) || 0), 0),
      totalLeads: organizations.reduce((sum, org) => sum + (parseInt(org.lead_count) || 0), 0),
      totalContacts: organizations.reduce((sum, org) => sum + (parseInt(org.contact_count) || 0), 0)
    };

    // Generate HTML report
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Business Subscription Report - UppalCRM</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #4f46e5, #7c3aed);
            color: white;
            padding: 30px;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }

        .header p {
            opacity: 0.9;
            font-size: 1.1rem;
        }

        .content {
            padding: 30px;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .stat-card {
            background: linear-gradient(135deg, #f8fafc, #e2e8f0);
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            border: 2px solid transparent;
            transition: border-color 0.3s;
        }

        .stat-card:hover {
            border-color: #4f46e5;
        }

        .stat-number {
            font-size: 2.5rem;
            font-weight: bold;
            color: #4f46e5;
        }

        .stat-label {
            color: #6b7280;
            font-weight: 600;
            margin-top: 5px;
        }

        .organizations-section {
            background: #f8fafc;
            border-radius: 10px;
            padding: 30px;
        }

        .org-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .org-table th {
            background: #4f46e5;
            color: white;
            padding: 15px 10px;
            text-align: left;
            font-weight: 600;
        }

        .org-table td {
            padding: 12px 10px;
            border-bottom: 1px solid #e5e7eb;
        }

        .org-table tr:hover {
            background: #f9fafb;
        }

        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
        }

        .status-active {
            background: #dcfce7;
            color: #166534;
        }

        .status-trial {
            background: #fef3c7;
            color: #92400e;
        }

        .status-inactive {
            background: #fee2e2;
            color: #991b1b;
        }

        .status-paid {
            background: #dbeafe;
            color: #1e40af;
        }

        .generated-time {
            text-align: center;
            margin-top: 30px;
            color: #6b7280;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Business Subscription Report</h1>
            <p>All Businesses Subscribed to UppalCRM</p>
        </div>

        <div class="content">
            <!-- Statistics -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${stats.total}</div>
                    <div class="stat-label">Total Organizations</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.active}</div>
                    <div class="stat-label">Active Organizations</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.trial}</div>
                    <div class="stat-label">Active Trials</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.paid}</div>
                    <div class="stat-label">Paid Subscriptions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.totalUsers}</div>
                    <div class="stat-label">Total Users</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.totalLeads}</div>
                    <div class="stat-label">Total Leads</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.totalContacts}</div>
                    <div class="stat-label">Total Contacts</div>
                </div>
            </div>

            <!-- Organizations Table -->
            <div class="organizations-section">
                <h3 style="margin-bottom: 20px;">🏢 All Organizations</h3>
                <table class="org-table">
                    <thead>
                        <tr>
                            <th>Organization</th>
                            <th>Domain</th>
                            <th>Status</th>
                            <th>Plan</th>
                            <th>Users</th>
                            <th>Leads</th>
                            <th>Contacts</th>
                            <th>Admin</th>
                            <th>Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${organizations.map(org => `
                            <tr>
                                <td><strong>${org.organization_name || 'N/A'}</strong></td>
                                <td>${org.domain || 'Not set'}</td>
                                <td>
                                    <span class="status-badge ${getStatusClass(org)}">
                                        ${getStatusText(org)}
                                    </span>
                                </td>
                                <td>${org.subscription_plan || 'Free'}</td>
                                <td>${org.active_user_count || 0}</td>
                                <td>${org.lead_count || 0}</td>
                                <td>${org.contact_count || 0}</td>
                                <td>${org.admin_email || org.contact_name || 'N/A'}</td>
                                <td>${formatDate(org.created_at)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="generated-time">
                📅 Report generated on ${new Date().toLocaleString()}
            </div>
        </div>
    </div>

    <script>
        function getStatusClass(org) {
            if (!org.is_active) return 'status-inactive';
            if (org.subscription_status === 'active') return 'status-paid';
            if (org.trial_status === 'active') return 'status-trial';
            return 'status-active';
        }

        function getStatusText(org) {
            if (!org.is_active) return 'Inactive';
            if (org.subscription_status === 'active') return 'Paid';
            if (org.trial_status === 'active') return 'Trial';
            return 'Active';
        }

        function formatDate(dateString) {
            if (!dateString) return 'Unknown';
            return new Date(dateString).toLocaleDateString();
        }
    </script>
</body>
</html>`;

    // Write the HTML file
    const reportPath = path.join(__dirname, '..', 'business-report.html');
    fs.writeFileSync(reportPath, htmlContent);

    console.log('✅ Business report generated successfully!');
    console.log(`📄 Report saved to: ${reportPath}`);
    console.log('🌐 Open the file in your browser to view your business subscriptions');

    // Also create a summary for the console
    console.log('\n📊 QUICK SUMMARY:');
    console.log(`   Total Organizations: ${stats.total}`);
    console.log(`   Active Organizations: ${stats.active}`);
    console.log(`   Active Trials: ${stats.trial}`);
    console.log(`   Paid Subscriptions: ${stats.paid}`);
    console.log(`   Total Users: ${stats.totalUsers}`);
    console.log(`   Total Leads: ${stats.totalLeads}`);
    console.log(`   Total Contacts: ${stats.totalContacts}`);

  } catch (error) {
    console.error('❌ Error generating report:', error.message);
  } finally {
    await pool.end();
  }
}

function getStatusClass(org) {
  if (!org.is_active) return 'status-inactive';
  if (org.subscription_status === 'active') return 'status-paid';
  if (org.trial_status === 'active') return 'status-trial';
  return 'status-active';
}

function getStatusText(org) {
  if (!org.is_active) return 'Inactive';
  if (org.subscription_status === 'active') return 'Paid';
  if (org.trial_status === 'active') return 'Trial';
  return 'Active';
}

function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  return new Date(dateString).toLocaleDateString();
}

generateBusinessReport();