const axios = require('axios');

/**
 * Azure Text Analytics Service for Sentiment Analysis and Churn Detection
 *
 * Features:
 * - Analyzes customer support emails for sentiment (0.0 = negative, 1.0 = positive)
 * - Calculates churn risk based on sentiment scores
 * - Identifies unhappy customers early to prevent churn
 * - Generates alerts for high-risk customers
 */

const AZURE_ENDPOINT = process.env.AZURE_TEXT_ANALYTICS_ENDPOINT || 'https://canadacentral.api.cognitive.microsoft.com/';
const AZURE_KEY = process.env.AZURE_TEXT_ANALYTICS_KEY;

if (!AZURE_KEY) {
  console.warn('⚠️  AZURE_TEXT_ANALYTICS_KEY not set - sentiment analysis will not work');
}

/**
 * Analyze sentiment of text using Azure Text Analytics
 * @param {string} text - The text to analyze (email, message, etc.)
 * @returns {Promise<Object>} - Sentiment analysis results
 * @returns {number} result.sentiment - Score from 0.0 (negative) to 1.0 (positive)
 * @returns {string} result.label - 'positive', 'negative', or 'neutral'
 * @returns {Object} result.scores - Detailed confidence scores
 */
async function analyzeSentiment(text) {
  if (!AZURE_KEY) {
    throw new Error('Azure Text Analytics API key not configured');
  }

  try {
    const response = await axios.post(
      `${AZURE_ENDPOINT}/text/analytics/v3.1/sentiment`,
      {
        documents: [
          {
            id: '1',
            language: 'en',
            text: text
          }
        ]
      },
      {
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const result = response.data.documents[0];

    // Calculate overall sentiment score (0.0 to 1.0)
    const sentimentScore = calculateSentimentScore(result.confidenceScores);

    return {
      sentiment: sentimentScore,
      label: result.sentiment,
      scores: result.confidenceScores,
      detailedSentences: result.sentences || []
    };
  } catch (error) {
    console.error('Error analyzing sentiment:', error.response?.data || error.message);
    throw new Error(`Azure Text Analytics error: ${error.response?.data?.error?.message || error.message || 'Unknown error'}`);
  }
}

/**
 * Calculate normalized sentiment score (0.0 = very negative, 1.0 = very positive)
 * @param {Object} scores - Confidence scores from Azure
 * @returns {number} - Normalized score 0.0-1.0
 */
function calculateSentimentScore(scores) {
  // Azure returns: { positive: X, neutral: Y, negative: Z }
  // Convert to 0-1 scale where 0 = negative, 0.5 = neutral, 1 = positive
  return scores.positive + (scores.neutral * 0.5);
}

/**
 * Calculate churn risk based on sentiment score and organization settings
 * @param {number} sentimentScore - Score from 0.0 to 1.0
 * @param {Object} orgSettings - Organization AI settings (optional)
 * @returns {Object} - Churn risk assessment
 */
function calculateChurnRisk(sentimentScore, orgSettings = null) {
  // Convert sentiment score (0.0-1.0) to percentage (0-100)
  const sentimentPercent = sentimentScore * 100;

  // Use organization's custom thresholds or defaults
  const thresholds = {
    critical: orgSettings?.churn_threshold_critical ?? 30,
    high: orgSettings?.churn_threshold_high ?? 50,
    medium: orgSettings?.churn_threshold_medium ?? 70
  };

  let riskLevel, riskScore, color, action;

  if (sentimentPercent >= thresholds.medium) {
    riskLevel = 'low';
    riskScore = 0.1;
    color = 'green';
    action = 'none';
  } else if (sentimentPercent >= thresholds.high) {
    riskLevel = 'medium';
    riskScore = 0.3;
    color = 'yellow';
    action = 'monitor';
  } else if (sentimentPercent >= thresholds.critical) {
    riskLevel = 'high';
    riskScore = 0.7;
    color = 'orange';
    action = 'contact_soon';
  } else {
    riskLevel = 'critical';
    riskScore = 0.95;
    color = 'red';
    action = 'immediate_attention';
  }

  return {
    riskLevel,
    riskScore,
    color,
    action,
    message: getChurnRiskMessage(riskLevel),
    thresholdsUsed: thresholds // Include for transparency
  };
}

/**
 * Get human-readable churn risk message
 */
function getChurnRiskMessage(riskLevel) {
  const messages = {
    low: 'Customer is satisfied. Continue normal engagement.',
    medium: 'Customer sentiment is neutral. Monitor for changes.',
    high: 'Customer shows signs of dissatisfaction. Reach out within 24 hours.',
    critical: '🚨 URGENT: Customer is highly dissatisfied. Immediate action required!'
  };
  return messages[riskLevel];
}

/**
 * Analyze customer email and determine churn risk
 * @param {string} emailText - The customer email content
 * @param {Object} customer - Customer information
 * @param {Object} orgSettings - Organization AI settings (optional)
 * @returns {Promise<Object>} - Complete analysis with sentiment and churn risk
 */
async function analyzeCustomerEmail(emailText, customer = {}, orgSettings = null) {
  try {
    // Check if sentiment analysis is enabled for this organization
    if (orgSettings && !orgSettings.sentiment_enabled) {
      throw new Error('Sentiment analysis is disabled for this organization');
    }

    const sentimentResult = await analyzeSentiment(emailText);
    const churnRisk = calculateChurnRisk(sentimentResult.sentiment, orgSettings);

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email
      },
      sentiment: sentimentResult,
      churnRisk,
      analyzedAt: new Date().toISOString(),
      emailPreview: emailText.substring(0, 200) + '...'
    };
  } catch (error) {
    console.error('Error analyzing customer email:', error);
    throw error;
  }
}

/**
 * Check if customer needs immediate attention based on sentiment
 * @param {number} sentimentScore - Sentiment score 0.0-1.0
 * @param {Object} orgSettings - Organization AI settings (optional)
 * @returns {boolean} - True if immediate attention needed
 */
function needsImmediateAttention(sentimentScore, orgSettings = null) {
  const criticalThreshold = (orgSettings?.churn_threshold_critical ?? 30) / 100;
  return sentimentScore < criticalThreshold; // Critical churn risk
}

/**
 * Generate alert for customer with negative sentiment
 * @param {Object} analysis - Result from analyzeCustomerEmail()
 * @param {Object} orgSettings - Organization AI settings (optional)
 * @returns {Object|null} - Alert object for notification system, or null if no alert needed
 */
function generateChurnAlert(analysis, orgSettings = null) {
  const riskLevel = analysis.churnRisk.riskLevel;

  // Check if alerts are enabled for this risk level
  if (orgSettings) {
    const shouldAlert =
      (riskLevel === 'critical' && orgSettings.alert_on_critical) ||
      (riskLevel === 'high' && orgSettings.alert_on_high) ||
      (riskLevel === 'medium' && orgSettings.alert_on_medium);

    if (!shouldAlert) {
      return null;
    }
  } else {
    // Default behavior: only alert on critical
    if (!needsImmediateAttention(analysis.sentiment.sentiment, orgSettings)) {
      return null;
    }
  }

  // Determine priority based on risk level
  const priorityMap = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low'
  };

  return {
    type: 'churn_risk',
    priority: priorityMap[riskLevel] || 'medium',
    customer: analysis.customer,
    sentimentScore: analysis.sentiment.sentiment,
    riskLevel: riskLevel,
    message: `Customer ${analysis.customer.name} sent an email with ${analysis.sentiment.label} sentiment (${(analysis.sentiment.sentiment * 100).toFixed(1)}%)`,
    action: analysis.churnRisk.message,
    createdAt: new Date().toISOString(),
    notificationChannels: getNotificationChannels(orgSettings)
  };
}

/**
 * Get notification channels configured for the organization
 * @param {Object} orgSettings - Organization AI settings
 * @returns {Array} - List of enabled notification channels
 */
function getNotificationChannels(orgSettings) {
  if (!orgSettings) {
    return ['email']; // Default to email
  }

  const channels = [];

  if (orgSettings.alert_emails && orgSettings.alert_emails.length > 0) {
    channels.push('email');
  }
  if (orgSettings.alert_slack_webhook) {
    channels.push('slack');
  }
  if (orgSettings.alert_teams_webhook) {
    channels.push('teams');
  }
  if (orgSettings.alert_custom_webhook) {
    channels.push('custom');
  }

  return channels.length > 0 ? channels : ['email'];
}

module.exports = {
  analyzeSentiment,
  calculateChurnRisk,
  analyzeCustomerEmail,
  needsImmediateAttention,
  generateChurnAlert,
  calculateSentimentScore,
  getNotificationChannels
};
