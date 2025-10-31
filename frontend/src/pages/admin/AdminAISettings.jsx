import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { aiSettingsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  Brain,
  Settings,
  AlertCircle,
  Save,
  TestTube,
  TrendingUp,
  Mail,
  Slack,
  Loader,
  CheckCircle,
  XCircle,
  Info,
  BarChart3
} from 'lucide-react'

const AdminAISettings = () => {
  const { user: currentUser } = useAuth()
  const [settings, setSettings] = useState(null)
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState(null)

  // Form state
  const [formData, setFormData] = useState({
    sentiment_enabled: true,
    churn_threshold_critical: 30,
    churn_threshold_high: 50,
    churn_threshold_medium: 70,
    alert_on_critical: true,
    alert_on_high: false,
    alert_on_medium: false,
    alert_emails: [],
    alert_slack_webhook: '',
    alert_teams_webhook: ''
  })

  // Test panel state
  const [testText, setTestText] = useState('')
  const [testResult, setTestResult] = useState(null)

  // Alert email input
  const [emailInput, setEmailInput] = useState('')

  useEffect(() => {
    fetchSettings()
    fetchUsage()
  }, [])

  const fetchSettings = async () => {
    try {
      const data = await aiSettingsAPI.getSettings()
      setSettings(data.settings)

      // Populate form with current settings
      setFormData({
        sentiment_enabled: data.settings.feature_flags.sentiment_enabled,
        churn_threshold_critical: data.settings.thresholds.critical,
        churn_threshold_high: data.settings.thresholds.high,
        churn_threshold_medium: data.settings.thresholds.medium,
        alert_on_critical: data.settings.alerts.alert_on_critical,
        alert_on_high: data.settings.alerts.alert_on_high,
        alert_on_medium: data.settings.alerts.alert_on_medium,
        alert_emails: data.settings.notification_channels.emails || [],
        alert_slack_webhook: data.settings.notification_channels.slack_webhook || '',
        alert_teams_webhook: data.settings.notification_channels.teams_webhook || ''
      })

      setError(null)
    } catch (error) {
      console.error('Error fetching AI settings:', error)
      setError(error.response?.data?.message || 'Failed to load AI settings')
    } finally {
      setLoading(false)
    }
  }

  const fetchUsage = async () => {
    try {
      const data = await aiSettingsAPI.getUsage()
      setUsage(data.usage_statistics)
    } catch (error) {
      console.error('Error fetching usage:', error)
    }
  }

  const handleSliderChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: parseInt(value)
    }))
  }

  const handleToggleChange = (field) => {
    setFormData(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleAddEmail = () => {
    if (!emailInput.trim()) return

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailInput)) {
      toast.error('Please enter a valid email address')
      return
    }

    if (formData.alert_emails.includes(emailInput)) {
      toast.error('This email is already in the list')
      return
    }

    setFormData(prev => ({
      ...prev,
      alert_emails: [...prev.alert_emails, emailInput]
    }))
    setEmailInput('')
  }

  const handleRemoveEmail = (email) => {
    setFormData(prev => ({
      ...prev,
      alert_emails: prev.alert_emails.filter(e => e !== email)
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await aiSettingsAPI.updateSettings(formData)
      toast.success('AI settings saved successfully!')
      await fetchSettings()
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error(error.response?.data?.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!testText.trim()) {
      toast.error('Please enter some text to analyze')
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const data = await aiSettingsAPI.testSentiment({ text: testText })
      setTestResult(data.test_results)
      toast.success('Sentiment analysis completed!')
    } catch (error) {
      console.error('Error testing sentiment:', error)
      toast.error(error.response?.data?.message || 'Failed to analyze sentiment')
    } finally {
      setTesting(false)
    }
  }

  const getSentimentColor = (label) => {
    const colors = {
      positive: 'text-green-600',
      negative: 'text-red-600',
      neutral: 'text-yellow-600'
    }
    return colors[label] || 'text-gray-600'
  }

  const getChurnRiskColor = (level) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    }
    return colors[level] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
        <p className="text-gray-600">Loading AI settings...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Settings</h1>
          <p className="text-gray-600 mt-1">Configure sentiment analysis and churn detection</p>
        </div>
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-start">
            <AlertCircle className="text-red-600 mt-1" size={20} />
            <div className="ml-3">
              <h3 className="text-red-800 font-semibold">Error Loading Settings</h3>
              <p className="text-red-700 mt-1">{error}</p>
              <button
                onClick={() => {
                  setLoading(true)
                  setError(null)
                  fetchSettings()
                  fetchUsage()
                }}
                className="mt-3 btn btn-sm btn-outline text-red-600 hover:bg-red-100"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Settings</h1>
          <p className="text-gray-600 mt-1">Configure sentiment analysis and churn detection for your organization</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary btn-md"
        >
          {saving ? (
            <>
              <Loader size={16} className="mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save size={16} className="mr-2" />
              Save Changes
            </>
          )}
        </button>
      </div>

      {/* Usage Statistics */}
      {usage && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">This Month</p>
                <p className="text-2xl font-bold text-gray-900">{usage.current_month?.analyses || 0}</p>
                <p className="text-xs text-gray-500">analyses performed</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="text-blue-600" size={24} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Free Tier Remaining</p>
                <p className="text-2xl font-bold text-green-600">{usage.current_month?.remaining_free_tier || 5000}</p>
                <p className="text-xs text-gray-500">out of 5,000</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-green-600" size={24} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">All Time</p>
                <p className="text-2xl font-bold text-purple-600">{usage.all_time?.total_analyses || 0}</p>
                <p className="text-xs text-gray-500">total analyses</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Brain className="text-purple-600" size={24} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature Toggle */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-start">
            <Brain className="text-primary-600 mt-1 mr-3" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Sentiment Analysis</h3>
              <p className="text-sm text-gray-600 mt-1">
                Enable AI-powered sentiment analysis for customer emails and messages
              </p>
            </div>
          </div>
          <button
            onClick={() => handleToggleChange('sentiment_enabled')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.sentiment_enabled ? 'bg-primary-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.sentiment_enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Churn Risk Thresholds */}
      <div className="card">
        <div className="flex items-start mb-4">
          <Settings className="text-primary-600 mt-1 mr-3" size={24} />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Churn Risk Thresholds</h3>
            <p className="text-sm text-gray-600 mt-1">
              Configure sentiment score thresholds for different churn risk levels (0-100%)
            </p>
          </div>
        </div>

        <div className="space-y-6 mt-6">
          {/* Critical Threshold */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Critical Risk (&lt; {formData.churn_threshold_critical}%)
              </label>
              <span className="text-sm font-semibold text-red-600">
                {formData.churn_threshold_critical}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={formData.churn_threshold_critical}
              onChange={(e) => handleSliderChange('churn_threshold_critical', e.target.value)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600"
            />
            <p className="text-xs text-gray-500 mt-1">
              Sentiment below this triggers critical alerts
            </p>
          </div>

          {/* High Threshold */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                High Risk ({formData.churn_threshold_critical}% - {formData.churn_threshold_high}%)
              </label>
              <span className="text-sm font-semibold text-orange-600">
                {formData.churn_threshold_high}%
              </span>
            </div>
            <input
              type="range"
              min="30"
              max="70"
              value={formData.churn_threshold_high}
              onChange={(e) => handleSliderChange('churn_threshold_high', e.target.value)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
            />
            <p className="text-xs text-gray-500 mt-1">
              Sentiment between critical and this value
            </p>
          </div>

          {/* Medium Threshold */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Medium Risk ({formData.churn_threshold_high}% - {formData.churn_threshold_medium}%)
              </label>
              <span className="text-sm font-semibold text-yellow-600">
                {formData.churn_threshold_medium}%
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              value={formData.churn_threshold_medium}
              onChange={(e) => handleSliderChange('churn_threshold_medium', e.target.value)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-yellow-600"
            />
            <p className="text-xs text-gray-500 mt-1">
              Sentiment above this is considered low risk
            </p>
          </div>
        </div>
      </div>

      {/* Alert Preferences */}
      <div className="card">
        <div className="flex items-start mb-4">
          <AlertCircle className="text-primary-600 mt-1 mr-3" size={24} />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Alert Preferences</h3>
            <p className="text-sm text-gray-600 mt-1">
              Choose which risk levels should trigger alerts
            </p>
          </div>
        </div>

        <div className="space-y-3 mt-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.alert_on_critical}
              onChange={() => handleToggleChange('alert_on_critical')}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="ml-3 text-sm font-medium text-gray-700">
              Alert on critical risk
              <span className="ml-2 text-xs text-red-600">(Recommended)</span>
            </span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.alert_on_high}
              onChange={() => handleToggleChange('alert_on_high')}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="ml-3 text-sm font-medium text-gray-700">
              Alert on high risk
            </span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.alert_on_medium}
              onChange={() => handleToggleChange('alert_on_medium')}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="ml-3 text-sm font-medium text-gray-700">
              Alert on medium risk
            </span>
          </label>
        </div>
      </div>

      {/* Notification Channels */}
      <div className="card">
        <div className="flex items-start mb-4">
          <Mail className="text-primary-600 mt-1 mr-3" size={24} />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Notification Channels</h3>
            <p className="text-sm text-gray-600 mt-1">
              Configure where alerts should be sent
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Email Recipients */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alert Email Recipients
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()}
                placeholder="email@example.com"
                className="input flex-1"
              />
              <button
                onClick={handleAddEmail}
                className="btn btn-outline"
              >
                Add
              </button>
            </div>
            {formData.alert_emails.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {formData.alert_emails.map((email, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                  >
                    {email}
                    <button
                      onClick={() => handleRemoveEmail(email)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      <XCircle size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Slack Webhook */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Slack size={16} className="inline mr-2" />
              Slack Webhook URL
            </label>
            <input
              type="url"
              name="alert_slack_webhook"
              value={formData.alert_slack_webhook}
              onChange={handleInputChange}
              placeholder="https://hooks.slack.com/services/..."
              className="input"
            />
          </div>

          {/* Teams Webhook */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Microsoft Teams Webhook URL
            </label>
            <input
              type="url"
              name="alert_teams_webhook"
              value={formData.alert_teams_webhook}
              onChange={handleInputChange}
              placeholder="https://outlook.office.com/webhook/..."
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Test Panel */}
      <div className="card">
        <div className="flex items-start mb-4">
          <TestTube className="text-primary-600 mt-1 mr-3" size={24} />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Test Sentiment Analysis</h3>
            <p className="text-sm text-gray-600 mt-1">
              Try out sentiment analysis with sample text
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Message
            </label>
            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Enter a customer message to analyze... (e.g., 'I love this product!' or 'This is terrible!')"
              rows={4}
              className="input"
            />
          </div>

          <button
            onClick={handleTest}
            disabled={testing || !testText.trim()}
            className="btn btn-primary"
          >
            {testing ? (
              <>
                <Loader size={16} className="mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <TestTube size={16} className="mr-2" />
                Analyze Sentiment
              </>
            )}
          </button>

          {/* Test Results */}
          {testResult && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-3">Analysis Results</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Sentiment Score */}
                <div>
                  <p className="text-sm text-gray-600 mb-1">Sentiment Score</p>
                  <div className="flex items-center">
                    <p className={`text-2xl font-bold ${getSentimentColor(testResult.sentiment.label)}`}>
                      {testResult.sentiment.score_percentage}
                    </p>
                    <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                      testResult.sentiment.label === 'positive' ? 'bg-green-100 text-green-800' :
                      testResult.sentiment.label === 'negative' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {testResult.sentiment.label}
                    </span>
                  </div>
                  {testResult.sentiment.confidence_scores && (
                    <div className="mt-2 text-xs text-gray-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Positive:</span>
                        <span className="font-medium">{testResult.sentiment.confidence_scores.positive}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Neutral:</span>
                        <span className="font-medium">{testResult.sentiment.confidence_scores.neutral}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Negative:</span>
                        <span className="font-medium">{testResult.sentiment.confidence_scores.negative}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Churn Risk */}
                <div>
                  <p className="text-sm text-gray-600 mb-1">Churn Risk</p>
                  <div className="flex items-center">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getChurnRiskColor(testResult.churn_risk.level)}`}>
                      {testResult.churn_risk.level.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2">
                    {testResult.churn_risk.message}
                  </p>
                </div>
              </div>

              {/* Alert Status */}
              {testResult.alert && (
                <div className={`mt-4 p-3 rounded-lg ${
                  testResult.alert.would_trigger
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-green-50 border border-green-200'
                }`}>
                  <div className="flex items-start">
                    {testResult.alert.would_trigger ? (
                      <AlertCircle className="text-red-600 mt-0.5 mr-2" size={16} />
                    ) : (
                      <CheckCircle className="text-green-600 mt-0.5 mr-2" size={16} />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${
                        testResult.alert.would_trigger ? 'text-red-800' : 'text-green-800'
                      }`}>
                        {testResult.alert.would_trigger
                          ? `Alert would be triggered (${testResult.alert.priority})`
                          : 'No alert would be triggered'
                        }
                      </p>
                      {testResult.alert.message && (
                        <p className="text-xs text-gray-600 mt-1">{testResult.alert.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Processing Time */}
              {testResult.processing_time_ms && (
                <p className="text-xs text-gray-500 mt-3">
                  Processed in {testResult.processing_time_ms}ms
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-start">
          <Info className="text-blue-600 mt-1 mr-3" size={20} />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">About Sentiment Analysis</p>
            <p>
              AI-powered sentiment analysis helps you identify unhappy customers early and prevent churn.
              The system analyzes customer messages and assigns a sentiment score from 0% (very negative) to 100% (very positive).
              Based on your configured thresholds, it calculates churn risk and can trigger alerts to your team.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminAISettings
