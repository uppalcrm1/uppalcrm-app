# Sentiment Analysis & Churn Detection

## Overview

Azure Text Analytics has been integrated into UppalCRM to automatically analyze customer communications for sentiment and predict churn risk. This helps identify unhappy customers early so your team can take proactive action to prevent churn.

## Features

- **Real-time Sentiment Analysis**: Analyzes customer emails, messages, and support tickets
- **Churn Risk Scoring**: Calculates churn probability from 0.0 (low risk) to 1.0 (critical risk)
- **Automated Alerts**: Generates critical alerts for customers with very negative sentiment
- **ROI Tracking**: Potential to save $500,000+ annually by preventing customer churn

## Architecture

### Components Created

1. **Azure Text Analytics Resource**
   - Name: `uppalcrm-text-analytics`
   - Resource Group: `uppalcrm-resources`
   - Location: Canada Central
   - Tier: F0 (Free - 5,000 transactions/month)

2. **Sentiment Analysis Service** (`services/sentimentAnalysis.js`)
   - Core functions for sentiment analysis
   - Churn risk calculation
   - Alert generation

3. **Environment Variables** (`.env`)
   - `AZURE_TEXT_ANALYTICS_ENDPOINT`: API endpoint URL
   - `AZURE_TEXT_ANALYTICS_KEY`: API subscription key

## How It Works

### Sentiment Scoring

Azure returns sentiment scores for positive, neutral, and negative sentiment. We convert this to a single score:

```
Overall Sentiment = positive + (neutral × 0.5)
```

This gives a score from 0.0 (100% negative) to 1.0 (100% positive).

### Churn Risk Levels

| Sentiment Score | Risk Level | Risk Score | Action Required |
|----------------|------------|------------|-----------------|
| ≥ 0.7 | Low | 10% | Continue normal engagement |
| 0.5 - 0.69 | Medium | 30% | Monitor for changes |
| 0.3 - 0.49 | High | 70% | Contact within 24 hours |
| < 0.3 | **Critical** | 95% | **Immediate attention required** |

### Alert Generation

When sentiment drops below 0.3 (30%), the system automatically generates a critical alert:

```javascript
{
  type: 'churn_risk',
  priority: 'critical',
  customer: { id, name, email },
  sentimentScore: 0.065,
  message: 'Customer sent email with very negative sentiment',
  action: 'Contact customer immediately to address concerns'
}
```

## API Usage

### Analyze a Customer Email

```javascript
const sentimentService = require('./services/sentimentAnalysis');

const analysis = await sentimentService.analyzeCustomerEmail(
  emailText,
  { id: 123, name: 'John Smith', email: 'john@example.com' }
);

console.log(analysis);
// {
//   customer: { id, name, email },
//   sentiment: {
//     sentiment: 0.065,  // 6.5% positive
//     label: 'negative',
//     scores: { positive: 0.05, neutral: 0.03, negative: 0.92 }
//   },
//   churnRisk: {
//     riskLevel: 'critical',
//     riskScore: 0.95,
//     action: 'immediate_attention',
//     message: '🚨 URGENT: Customer is highly dissatisfied...'
//   },
//   analyzedAt: '2025-01-15T10:30:00.000Z',
//   emailPreview: 'I am very disappointed with...'
// }
```

### Generate Alert for High-Risk Customer

```javascript
const alert = sentimentService.generateChurnAlert(analysis);

if (alert) {
  // Send to notification system
  console.log('CRITICAL ALERT:', alert.message);
  // Notify sales team, update CRM, etc.
}
```

### Check if Immediate Attention Needed

```javascript
const needsHelp = sentimentService.needsImmediateAttention(0.25); // true
```

## Testing

Run the test script to see sentiment analysis in action:

```bash
node test-sentiment-analysis.js
```

This tests with 4 sample customer emails ranging from very positive to very negative sentiment.

## Integration Roadmap

### Phase 1: Email Processing (Current)
- ✅ Azure Text Analytics resource created
- ✅ Sentiment analysis service built
- ✅ Alert generation working
- ✅ Test script validated

### Phase 2: Database Integration
- [ ] Add `sentiment_score` field to contacts table
- [ ] Add `churn_risk_level` field to contacts table
- [ ] Store sentiment history for trend analysis
- [ ] Create `churn_alerts` table for tracking alerts

### Phase 3: Real-Time Processing
- [ ] Hook into email receiving webhook
- [ ] Analyze support ticket submissions automatically
- [ ] Process customer feedback forms
- [ ] Analyze chat transcripts

### Phase 4: Dashboard & Reporting
- [ ] Create "Churn Risk" dashboard widget
- [ ] Add sentiment trend charts to customer profiles
- [ ] Build "At-Risk Customers" report
- [ ] Display alert notifications in CRM

### Phase 5: Team Notifications
- [ ] Send Slack/email alerts to account managers
- [ ] Create automated tasks for high-risk customers
- [ ] Integrate with Azure Functions for notifications
- [ ] Set up escalation workflows

## Database Schema Changes

Add these fields to the `contacts` table:

```sql
ALTER TABLE contacts ADD COLUMN sentiment_score DECIMAL(3,2);
ALTER TABLE contacts ADD COLUMN churn_risk_level VARCHAR(20);
ALTER TABLE contacts ADD COLUMN last_sentiment_analysis TIMESTAMP;
```

Create a table to track sentiment over time:

```sql
CREATE TABLE sentiment_history (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER REFERENCES contacts(id),
  sentiment_score DECIMAL(3,2) NOT NULL,
  sentiment_label VARCHAR(20),
  churn_risk_level VARCHAR(20),
  source_type VARCHAR(50), -- 'email', 'ticket', 'chat', etc.
  source_text TEXT,
  analyzed_at TIMESTAMP DEFAULT NOW()
);
```

Create alerts table:

```sql
CREATE TABLE churn_alerts (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER REFERENCES contacts(id),
  alert_type VARCHAR(50) DEFAULT 'churn_risk',
  priority VARCHAR(20),
  sentiment_score DECIMAL(3,2),
  message TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by INTEGER REFERENCES users(id),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoint Example

Add a new endpoint to analyze customer messages:

```javascript
// routes/sentiment.js
router.post('/analyze', async (req, res) => {
  try {
    const { text, contact_id } = req.body;

    // Get customer info
    const contact = await db.query(
      'SELECT id, name, email FROM contacts WHERE id = $1',
      [contact_id]
    );

    // Analyze sentiment
    const analysis = await sentimentService.analyzeCustomerEmail(
      text,
      contact.rows[0]
    );

    // Save to database
    await db.query(`
      INSERT INTO sentiment_history
      (contact_id, sentiment_score, sentiment_label, churn_risk_level, source_text)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      contact_id,
      analysis.sentiment.sentiment,
      analysis.sentiment.label,
      analysis.churnRisk.riskLevel,
      text
    ]);

    // Update contact record
    await db.query(`
      UPDATE contacts
      SET sentiment_score = $1,
          churn_risk_level = $2,
          last_sentiment_analysis = NOW()
      WHERE id = $3
    `, [
      analysis.sentiment.sentiment,
      analysis.churnRisk.riskLevel,
      contact_id
    ]);

    // Generate alert if needed
    const alert = sentimentService.generateChurnAlert(analysis);
    if (alert) {
      await db.query(`
        INSERT INTO churn_alerts
        (contact_id, priority, sentiment_score, message)
        VALUES ($1, $2, $3, $4)
      `, [contact_id, alert.priority, alert.sentimentScore, alert.message]);

      // TODO: Send notification to team
    }

    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Cost & Limits

**Azure Text Analytics Free Tier (F0)**
- 5,000 text records per month
- Perfect for up to 166 customer emails analyzed per day
- No cost - completely free!

**If you need more:**
- Standard S tier: $1 per 1,000 text records
- For 10,000 emails/month: ~$10/month
- ROI: Saving 1 customer = $5,000 revenue vs $10 cost

## ROI Analysis

### Assumptions
- Average customer lifetime value: $5,000
- Total customers: 1,000
- Churn rate without analysis: 20% (200 customers/year)
- Churn rate with proactive intervention: 10% (100 customers/year)

### Results
- Customers saved from churning: **100 per year**
- Revenue saved annually: **$500,000**
- Annual cost: **$0** (free tier)
- **Net benefit: $500,000**

Even a 5% churn reduction saves $250,000 annually!

## Next Steps

1. **Immediate**: Integrate with support email webhook
2. **This Week**: Add database fields and store sentiment scores
3. **Next Week**: Build churn risk dashboard
4. **This Month**: Set up team notifications and alerts
5. **Ongoing**: Track churn rate reduction to measure actual ROI

## Support

- Azure Text Analytics Docs: https://learn.microsoft.com/azure/ai-services/language-service/sentiment-opinion-mining/
- Service File: `services/sentimentAnalysis.js`
- Test Script: `test-sentiment-analysis.js`
- Azure Resource: `uppalcrm-text-analytics` in `uppalcrm-resources`
