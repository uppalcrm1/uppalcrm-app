/**
 * Test Script for Azure Sentiment Analysis and Churn Detection
 *
 * This script demonstrates:
 * 1. Analyzing customer support emails for sentiment
 * 2. Calculating churn risk based on sentiment
 * 3. Generating alerts for unhappy customers
 */

require('dotenv').config();
const sentimentService = require('./services/sentimentAnalysis');

// Sample customer emails representing different sentiment levels
const sampleEmails = [
  {
    customer: { id: 1, name: 'Happy Customer', email: 'happy@example.com' },
    email: `Hi team! I just wanted to reach out and say thank you for the excellent
    service. Your support team has been incredibly helpful, and the product is working
    perfectly. I'm very satisfied with everything and will definitely recommend you to others!`
  },
  {
    customer: { id: 2, name: 'Neutral Customer', email: 'neutral@example.com' },
    email: `Hello, I wanted to inquire about the status of my recent request. I submitted
    a ticket last week and haven't heard back yet. Can you please provide an update?
    Thanks for your time.`
  },
  {
    customer: { id: 3, name: 'Frustrated Customer', email: 'frustrated@example.com' },
    email: `I'm disappointed with the recent service issues. The system has been down
    multiple times this week, and it's affecting my business. This is not what I expected
    when I signed up. I need this resolved quickly or I may need to reconsider my subscription.`
  },
  {
    customer: { id: 4, name: 'Very Angry Customer', email: 'angry@example.com' },
    email: `This is absolutely unacceptable! I've been trying to get support for THREE WEEKS
    and nobody responds. Your product is broken, your support is terrible, and I'm completely
    fed up. I want a full refund immediately and I'm canceling my subscription. This has been
    the worst customer experience I've ever had. DO NOT renew my account!`
  }
];

/**
 * Run sentiment analysis on all sample emails
 */
async function testSentimentAnalysis() {
  console.log('\n🔍 TESTING AZURE TEXT ANALYTICS - SENTIMENT ANALYSIS & CHURN DETECTION\n');
  console.log('=' .repeat(80));

  const results = [];

  for (const sample of sampleEmails) {
    try {
      console.log(`\n📧 Analyzing email from: ${sample.customer.name}`);
      console.log(`   Email preview: "${sample.email.substring(0, 100)}..."`);

      const analysis = await sentimentService.analyzeCustomerEmail(
        sample.email,
        sample.customer
      );

      // Generate alert if needed
      const alert = sentimentService.generateChurnAlert(analysis);

      // Display results
      console.log(`\n   📊 SENTIMENT ANALYSIS:`);
      console.log(`      Overall Sentiment: ${(analysis.sentiment.sentiment * 100).toFixed(1)}% positive`);
      console.log(`      Label: ${analysis.sentiment.label.toUpperCase()}`);
      console.log(`      Scores: Positive: ${(analysis.sentiment.scores.positive * 100).toFixed(1)}%, ` +
                  `Neutral: ${(analysis.sentiment.scores.neutral * 100).toFixed(1)}%, ` +
                  `Negative: ${(analysis.sentiment.scores.negative * 100).toFixed(1)}%`);

      console.log(`\n   ⚠️  CHURN RISK ASSESSMENT:`);
      console.log(`      Risk Level: ${analysis.churnRisk.riskLevel.toUpperCase()}`);
      console.log(`      Risk Score: ${(analysis.churnRisk.riskScore * 100).toFixed(1)}%`);
      console.log(`      Recommended Action: ${analysis.churnRisk.action.replace(/_/g, ' ').toUpperCase()}`);
      console.log(`      Message: ${analysis.churnRisk.message}`);

      if (alert) {
        console.log(`\n   🚨 ALERT GENERATED:`);
        console.log(`      Type: ${alert.type}`);
        console.log(`      Priority: ${alert.priority.toUpperCase()}`);
        console.log(`      Message: ${alert.message}`);
        console.log(`      Action: ${alert.action}`);
      }

      results.push({ customer: sample.customer.name, analysis, alert });

      console.log('\n' + '-'.repeat(80));

    } catch (error) {
      console.error(`   ❌ Error analyzing email: ${error.message}`);
    }
  }

  // Summary
  console.log('\n\n📈 SUMMARY\n');
  console.log('=' .repeat(80));

  const criticalCustomers = results.filter(r => r.alert !== null);
  const highRiskCustomers = results.filter(r =>
    r.analysis.churnRisk.riskLevel === 'high' || r.analysis.churnRisk.riskLevel === 'critical'
  );

  console.log(`Total emails analyzed: ${results.length}`);
  console.log(`Customers needing immediate attention: ${criticalCustomers.length}`);
  console.log(`High/Critical churn risk customers: ${highRiskCustomers.length}`);

  if (criticalCustomers.length > 0) {
    console.log(`\n🚨 CRITICAL ALERTS:`);
    criticalCustomers.forEach(r => {
      console.log(`   - ${r.customer}: ${r.alert.message}`);
    });
  }

  console.log('\n' + '='.repeat(80));

  return results;
}

/**
 * Calculate ROI of sentiment analysis
 */
function calculateROI() {
  console.log('\n\n💰 ESTIMATED ROI OF SENTIMENT ANALYSIS\n');
  console.log('=' .repeat(80));

  const assumptions = {
    avgCustomerLifetimeValue: 5000, // $5,000 per customer
    churnRateWithoutAnalysis: 0.20, // 20% annual churn
    churnRateWithAnalysis: 0.10, // 10% annual churn (50% reduction)
    totalCustomers: 1000,
    costPerMonth: 0 // Free tier!
  };

  const customersLostWithout = assumptions.totalCustomers * assumptions.churnRateWithoutAnalysis;
  const customersLostWith = assumptions.totalCustomers * assumptions.churnRateWithAnalysis;
  const customersSaved = customersLostWithout - customersLostWith;
  const revenueSaved = customersSaved * assumptions.avgCustomerLifetimeValue;
  const annualCost = assumptions.costPerMonth * 12;
  const netBenefit = revenueSaved - annualCost;

  console.log(`Assumptions:`);
  console.log(`  - Average customer lifetime value: $${assumptions.avgCustomerLifetimeValue.toLocaleString()}`);
  console.log(`  - Total customers: ${assumptions.totalCustomers.toLocaleString()}`);
  console.log(`  - Churn rate without analysis: ${(assumptions.churnRateWithoutAnalysis * 100).toFixed(0)}%`);
  console.log(`  - Churn rate with analysis: ${(assumptions.churnRateWithAnalysis * 100).toFixed(0)}%`);
  console.log(`  - Azure Text Analytics cost: $${assumptions.costPerMonth}/month (Free tier!)`);

  console.log(`\nResults:`);
  console.log(`  - Customers saved from churning: ${customersSaved.toFixed(0)}`);
  console.log(`  - Revenue saved annually: $${revenueSaved.toLocaleString()}`);
  console.log(`  - Annual cost: $${annualCost.toLocaleString()}`);
  console.log(`  - Net benefit (ROI): $${netBenefit.toLocaleString()}`);

  console.log('\n' + '='.repeat(80));
}

// Run the tests
async function main() {
  try {
    await testSentimentAnalysis();
    calculateROI();

    console.log('\n✅ Sentiment analysis testing complete!\n');
    console.log('Next steps:');
    console.log('  1. Integrate with email processing pipeline');
    console.log('  2. Store sentiment scores in database');
    console.log('  3. Create dashboard for churn risk monitoring');
    console.log('  4. Set up automated alerts for sales/support teams');
    console.log('  5. Track ROI by monitoring churn rate reduction\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nMake sure AZURE_TEXT_ANALYTICS_KEY is set in your .env file\n');
    process.exit(1);
  }
}

main();
