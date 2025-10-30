# Multi-Tenant AI Configuration Guide

## Overview

UppalCRM now supports organization-specific AI configuration, allowing each tenant to customize their sentiment analysis and churn detection settings. This includes:

- Custom churn risk thresholds
- Flexible alert configuration
- Multiple notification channels (email, Slack, Teams, custom webhooks)
- Per-organization usage tracking
- Test mode for validating settings

## Table of Contents

- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Frontend Integration](#frontend-integration)
- [Testing](#testing)
- [Migration Guide](#migration-guide)
- [Troubleshooting](#troubleshooting)

## Database Schema

### Organization AI Settings Table

```sql
CREATE TABLE organization_ai_settings (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),

    -- Feature Toggles
    sentiment_enabled BOOLEAN DEFAULT true,
    churn_detection_enabled BOOLEAN DEFAULT true,
    auto_analyze_emails BOOLEAN DEFAULT false,
    auto_analyze_tickets BOOLEAN DEFAULT false,

    -- Churn Thresholds (0-100%)
    churn_threshold_critical INTEGER DEFAULT 30,  -- Below 30% = critical
    churn_threshold_high INTEGER DEFAULT 50,      -- 30-49% = high
    churn_threshold_medium INTEGER DEFAULT 70,    -- 50-69% = medium

    -- Alert Configuration
    alert_on_critical BOOLEAN DEFAULT true,
    alert_on_high BOOLEAN DEFAULT false,
    alert_on_medium BOOLEAN DEFAULT false,

    -- Notification Channels
    alert_emails TEXT[],
    alert_slack_webhook TEXT,
    alert_teams_webhook TEXT,
    alert_custom_webhook TEXT,

    -- Advanced Settings
    min_confidence_threshold DECIMAL(3,2) DEFAULT 0.60,
    analysis_language VARCHAR(10) DEFAULT 'en',

    -- Usage Tracking
    total_analyses INTEGER DEFAULT 0,
    analyses_this_month INTEGER DEFAULT 0,
    last_analysis_at TIMESTAMP
);
```

### Sentiment Analysis History Table

```sql
CREATE TABLE sentiment_analysis_history (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    entity_type VARCHAR(50),  -- 'contact', 'lead', 'ticket', 'email'
    entity_id UUID,

    -- Analysis Results
    sentiment_score DECIMAL(4,3),  -- 0.000 to 1.000
    sentiment_label VARCHAR(20),   -- 'positive', 'negative', 'neutral', 'mixed'
    confidence_scores JSONB,       -- { positive, neutral, negative }

    -- Churn Risk
    churn_risk_level VARCHAR(20),  -- 'low', 'medium', 'high', 'critical'
    churn_risk_score DECIMAL(4,3),

    -- Source
    source_type VARCHAR(50),
    source_text TEXT,

    -- Alert
    alert_generated BOOLEAN DEFAULT false,
    alert_sent_to TEXT[],

    analyzed_at TIMESTAMP DEFAULT NOW()
);
```

### Churn Alerts Table

```sql
CREATE TABLE churn_alerts (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    sentiment_analysis_id UUID REFERENCES sentiment_analysis_history(id),

    entity_type VARCHAR(50),
    entity_id UUID,

    alert_type VARCHAR(50) DEFAULT 'churn_risk',
    priority VARCHAR(20),  -- 'low', 'medium', 'high', 'critical'

    sentiment_score DECIMAL(4,3),
    risk_level VARCHAR(20),

    title TEXT,
    message TEXT,
    recommended_action TEXT,

    status VARCHAR(20) DEFAULT 'open',  -- 'open', 'acknowledged', 'resolved', 'dismissed'
    resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,

    notifications_sent INTEGER DEFAULT 0,
    notification_channels TEXT[],  -- ['email', 'slack', 'teams']

    created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

Base URL: `/api/organizations/current`

All endpoints require `authenticateToken` and `requireAdmin` middleware.

### 1. Get AI Settings

**GET** `/ai-settings`

Get the organization's current AI configuration.

**Response:**
```json
{
  "success": true,
  "settings": {
    "id": "uuid",
    "feature_flags": {
      "sentiment_enabled": true,
      "churn_detection_enabled": true,
      "auto_analyze_emails": false,
      "auto_analyze_tickets": false
    },
    "thresholds": {
      "critical": 30,
      "high": 50,
      "medium": 70
    },
    "alerts": {
      "alert_on_critical": true,
      "alert_on_high": false,
      "alert_on_medium": false
    },
    "notification_channels": {
      "emails": ["admin@company.com", "sales@company.com"],
      "slack_webhook": "https://hooks.slack.com/...",
      "teams_webhook": null,
      "custom_webhook": null
    },
    "advanced": {
      "min_confidence_threshold": 0.60,
      "analysis_language": "en"
    },
    "usage": {
      "total_analyses": 1250,
      "analyses_this_month": 45,
      "last_analysis_at": "2025-01-15T14:30:00Z"
    }
  }
}
```

### 2. Update AI Settings

**PUT** `/ai-settings`

Update organization's AI configuration.

**Request Body:**
```json
{
  "sentiment_enabled": true,
  "churn_threshold_critical": 25,
  "churn_threshold_high": 45,
  "churn_threshold_medium": 65,
  "alert_on_critical": true,
  "alert_on_high": true,
  "alert_emails": ["admin@company.com", "sales@company.com"],
  "alert_slack_webhook": "https://hooks.slack.com/services/..."
}
```

**Validation Rules:**
- `churn_threshold_*`: Integer between 0-100
- Thresholds must be ordered: `critical < high < medium`
- `alert_emails`: Maximum 10 email addresses
- Webhook URLs must be valid URIs
- `min_confidence_threshold`: Float between 0.0-1.0
- `analysis_language`: 2-character ISO 639-1 code

**Response:**
```json
{
  "success": true,
  "message": "AI settings updated successfully",
  "settings": { /* updated settings */ }
}
```

### 3. Test Sentiment Analysis

**POST** `/ai-settings/test`

Test sentiment analysis with sample text using the organization's current settings.

**Request Body:**
```json
{
  "text": "This is a test message to analyze sentiment. I am very unhappy with the service!",
  "entity_type": "email",  // optional: contact, lead, ticket, email, other
  "entity_id": "uuid"      // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sentiment analysis test completed",
  "test_results": {
    "sentiment": {
      "score": 0.065,
      "score_percentage": "6.5%",
      "label": "negative",
      "confidence_scores": {
        "positive": "5.0%",
        "neutral": "3.0%",
        "negative": "92.0%"
      }
    },
    "churn_risk": {
      "level": "critical",
      "score": 0.95,
      "color": "red",
      "recommended_action": "immediate_attention",
      "message": "🚨 URGENT: Customer is highly dissatisfied. Immediate action required!",
      "thresholds_used": {
        "critical": 30,
        "high": 50,
        "medium": 70
      }
    },
    "alert": {
      "would_trigger": true,
      "priority": "critical",
      "message": "Customer sent an email with negative sentiment (6.5%)",
      "action": "Contact customer immediately to address concerns",
      "notification_channels": ["email", "slack"]
    },
    "processing_time_ms": 342,
    "analyzed_text_preview": "This is a test message to analyze sentiment..."
  }
}
```

### 4. Get Usage Statistics

**GET** `/ai-settings/usage`

Get AI usage statistics for the current organization.

**Response:**
```json
{
  "success": true,
  "usage_statistics": {
    "all_time": {
      "total_analyses": 5420,
      "last_analysis": "2025-01-15T14:30:00Z"
    },
    "current_month": {
      "analyses": 156,
      "remaining_free_tier": 4844
    },
    "last_30_days": {
      "by_risk_level": [
        { "risk_level": "critical", "count": 12, "avg_sentiment": "0.145" },
        { "risk_level": "high", "count": 34, "avg_sentiment": "0.380" },
        { "risk_level": "medium", "count": 56, "avg_sentiment": "0.580" },
        { "risk_level": "low", "count": 142, "avg_sentiment": "0.820" }
      ],
      "alerts": [
        { "status": "open", "priority": "critical", "count": 5 },
        { "status": "resolved", "priority": "critical", "count": 7 },
        { "status": "open", "priority": "high", "count": 12 }
      ]
    }
  }
}
```

### 5. Reset to Defaults

**POST** `/ai-settings/reset-defaults`

Reset organization's AI settings to default values.

**Response:**
```json
{
  "success": true,
  "message": "AI settings reset to default values",
  "settings": { /* default settings */ }
}
```

## Frontend Integration

### React Hook Example

Create a custom hook to manage AI settings:

```javascript
// hooks/useAISettings.js
import { useState, useEffect } from 'react';
import api from '../services/api';

export function useAISettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/organizations/current/ai-settings');
      setSettings(response.data.settings);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates) => {
    try {
      const response = await api.put('/api/organizations/current/ai-settings', updates);
      setSettings(response.data.settings);
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const testSentiment = async (text) => {
    try {
      const response = await api.post('/api/organizations/current/ai-settings/test', { text });
      return response.data.test_results;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    error,
    updateSettings,
    testSentiment,
    refetch: fetchSettings
  };
}
```

### Settings Page Component

```javascript
// pages/AISettingsPage.jsx
import React, { useState } from 'react';
import { useAISettings } from '../hooks/useAISettings';

export default function AISettingsPage() {
  const { settings, loading, updateSettings, testSentiment } = useAISettings();
  const [testText, setTestText] = useState('');
  const [testResults, setTestResults] = useState(null);

  const handleUpdateThresholds = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    await updateSettings({
      churn_threshold_critical: parseInt(formData.get('critical')),
      churn_threshold_high: parseInt(formData.get('high')),
      churn_threshold_medium: parseInt(formData.get('medium'))
    });
  };

  const handleTest = async () => {
    const results = await testSentiment(testText);
    setTestResults(results);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="ai-settings">
      <h1>AI Configuration</h1>

      {/* Feature Toggles */}
      <section>
        <h2>Features</h2>
        <label>
          <input
            type="checkbox"
            checked={settings.feature_flags.sentiment_enabled}
            onChange={(e) => updateSettings({ sentiment_enabled: e.target.checked })}
          />
          Enable Sentiment Analysis
        </label>
      </section>

      {/* Thresholds */}
      <section>
        <h2>Churn Risk Thresholds</h2>
        <form onSubmit={handleUpdateThresholds}>
          <label>
            Critical (below this %):
            <input
              type="number"
              name="critical"
              min="0"
              max="100"
              defaultValue={settings.thresholds.critical}
            />
          </label>
          <label>
            High (below this %):
            <input
              type="number"
              name="high"
              min="0"
              max="100"
              defaultValue={settings.thresholds.high}
            />
          </label>
          <label>
            Medium (below this %):
            <input
              type="number"
              name="medium"
              min="0"
              max="100"
              defaultValue={settings.thresholds.medium}
            />
          </label>
          <button type="submit">Update Thresholds</button>
        </form>
      </section>

      {/* Test Tool */}
      <section>
        <h2>Test Sentiment Analysis</h2>
        <textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="Enter sample text to analyze..."
          rows={6}
        />
        <button onClick={handleTest}>Analyze</button>

        {testResults && (
          <div className="test-results">
            <h3>Results</h3>
            <p>Sentiment: {testResults.sentiment.score_percentage} ({testResults.sentiment.label})</p>
            <p>Churn Risk: {testResults.churn_risk.level}</p>
            <p>Alert: {testResults.alert.would_trigger ? 'YES' : 'NO'}</p>
          </div>
        )}
      </section>
    </div>
  );
}
```

## Testing

### Running Database Migration

```bash
# Connect to your database
psql $DATABASE_URL

# Run the migration
\i database/migrations/007_organization_ai_settings.sql

# Verify tables were created
\dt organization_ai_settings
\dt sentiment_analysis_history
\dt churn_alerts

# Check default settings were created
SELECT organization_id, sentiment_enabled, churn_threshold_critical
FROM organization_ai_settings;
```

### Testing API Endpoints

```bash
# 1. Get settings (should auto-create if not exists)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3004/api/organizations/current/ai-settings

# 2. Update settings
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "churn_threshold_critical": 25,
    "alert_on_high": true,
    "alert_emails": ["admin@example.com"]
  }' \
  http://localhost:3004/api/organizations/current/ai-settings

# 3. Test sentiment analysis
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I am extremely frustrated with your service. This is unacceptable!"
  }' \
  http://localhost:3004/api/organizations/current/ai-settings/test

# 4. Get usage stats
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3004/api/organizations/current/ai-settings/usage
```

### Testing with the Existing Test Script

Update `test-sentiment-analysis.js` to use organization settings:

```javascript
// Add at the top
const db = require('./db');

// In the test function, fetch org settings first
const settingsResult = await db.query(`
  SELECT * FROM organization_ai_settings WHERE organization_id = $1
`, [organizationId]);

const orgSettings = settingsResult.rows[0];

// Pass settings to analysis
const analysis = await sentimentService.analyzeCustomerEmail(
  sample.email,
  sample.customer,
  orgSettings  // <-- Add this parameter
);

// Generate alert with settings
const alert = sentimentService.generateChurnAlert(analysis, orgSettings);
```

## Migration Guide

### For Existing Deployments

1. **Backup Database**
   ```bash
   pg_dump $DATABASE_URL > backup_before_ai_settings.sql
   ```

2. **Run Migration**
   ```bash
   psql $DATABASE_URL -f database/migrations/007_organization_ai_settings.sql
   ```

3. **Verify Default Settings Created**
   ```sql
   SELECT COUNT(*) FROM organization_ai_settings;
   -- Should equal number of organizations
   ```

4. **Update Backend**
   - The `sentimentAnalysis.js` service is backward compatible
   - Passing `null` for `orgSettings` uses default thresholds
   - No breaking changes to existing code

5. **Deploy Frontend**
   - Add AI Settings page to admin navigation
   - Test configuration UI
   - Verify test functionality

### Backward Compatibility

The updated `sentimentAnalysis.js` is fully backward compatible:

```javascript
// Old way (still works - uses defaults)
const analysis = await sentimentService.analyzeCustomerEmail(emailText, customer);

// New way (uses custom settings)
const analysis = await sentimentService.analyzeCustomerEmail(emailText, customer, orgSettings);
```

## Troubleshooting

### Settings Not Found

**Problem:** API returns 404 for AI settings

**Solution:** Settings should auto-create on first GET request. If not:
```sql
INSERT INTO organization_ai_settings (organization_id)
VALUES ('your-org-uuid')
RETURNING *;
```

### Threshold Validation Errors

**Problem:** "Thresholds must be ordered: critical < high < medium"

**Solution:** Ensure thresholds follow the rule:
```javascript
critical < high < medium
// Example: 30 < 50 < 70 ✅
// Bad:      50 < 30 < 70 ❌
```

### Azure API Errors

**Problem:** "Failed to connect to Azure Text Analytics"

**Solution:**
1. Check environment variables are set:
   ```bash
   echo $AZURE_TEXT_ANALYTICS_ENDPOINT
   echo $AZURE_TEXT_ANALYTICS_KEY
   ```
2. Test Azure connectivity:
   ```bash
   curl -H "Ocp-Apim-Subscription-Key: $AZURE_TEXT_ANALYTICS_KEY" \
     "${AZURE_TEXT_ANALYTICS_ENDPOINT}/text/analytics/v3.1/sentiment"
   ```

### Alerts Not Generating

**Problem:** High-risk customers not triggering alerts

**Solution:**
1. Check `alert_on_*` flags are enabled:
   ```sql
   SELECT alert_on_critical, alert_on_high, alert_on_medium
   FROM organization_ai_settings
   WHERE organization_id = 'your-org-uuid';
   ```
2. Verify sentiment score is below threshold:
   ```javascript
   // If sentiment is 0.25 (25%) and critical threshold is 30:
   // Alert SHOULD trigger ✅

   // If sentiment is 0.35 (35%) and critical threshold is 30:
   // Alert will NOT trigger (not critical enough) ❌
   ```

### Permission Errors

**Problem:** "Forbidden" when accessing AI settings

**Solution:** AI settings endpoints require admin role:
```javascript
router.use(requireAdmin);  // Only admins can access
```

Check user role:
```sql
SELECT role FROM users WHERE id = 'user-uuid';
-- Should be 'admin' or 'super_admin'
```

## Best Practices

1. **Start Conservative**
   - Keep default thresholds (30/50/70) initially
   - Only alert on critical risks at first
   - Add more alert levels as you gain confidence

2. **Test Thoroughly**
   - Use the test endpoint before going live
   - Try various types of messages (positive, neutral, negative)
   - Verify alerts trigger as expected

3. **Monitor Usage**
   - Check monthly analysis count
   - Stay within Azure free tier (5,000/month)
   - Plan upgrade if needed

4. **Configure Notifications**
   - Add multiple alert emails for redundancy
   - Set up Slack for real-time alerts
   - Test webhooks before relying on them

5. **Regular Review**
   - Review churn alerts weekly
   - Adjust thresholds based on false positives
   - Track ROI of sentiment analysis

## Support

For questions or issues:
- GitHub Issues: [uppalcrm/uppal-crm-project/issues](https://github.com/uppalcrm/uppal-crm-project/issues)
- Documentation: `docs/SENTIMENT_ANALYSIS.md`
- Database Schema: `database/migrations/007_organization_ai_settings.sql`
- API Routes: `routes/ai-settings.js`
- Service: `services/sentimentAnalysis.js`
