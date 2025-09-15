import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { 
  Settings, 
  Key, 
  Plus, 
  Copy, 
  Eye, 
  EyeOff,
  Trash2,
  BarChart3,
  Zap,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Clock,
  Activity,
  Shield,
  Globe,
  Info,
  X
} from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import toast from 'react-hot-toast'

// API functions for Zapier integration
const zapierAPI = {
  // API Keys management
  getApiKeys: async () => {
    const response = await fetch('/api/organizations/current/api-keys', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'X-Organization-Slug': localStorage.getItem('organizationSlug')
      }
    })
    if (!response.ok) throw new Error('Failed to fetch API keys')
    return response.json()
  },

  createApiKey: async (keyData) => {
    const response = await fetch('/api/organizations/current/api-keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'X-Organization-Slug': localStorage.getItem('organizationSlug')
      },
      body: JSON.stringify(keyData)
    })
    if (!response.ok) throw new Error('Failed to create API key')
    return response.json()
  },

  deleteApiKey: async (keyId) => {
    const response = await fetch(`/api/organizations/current/api-keys/${keyId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'X-Organization-Slug': localStorage.getItem('organizationSlug')
      }
    })
    if (!response.ok) throw new Error('Failed to delete API key')
    return response.json()
  },

  getUsageStats: async (keyId) => {
    const response = await fetch(`/api/organizations/current/api-keys/${keyId}/usage`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'X-Organization-Slug': localStorage.getItem('organizationSlug')
      }
    })
    if (!response.ok) throw new Error('Failed to fetch usage stats')
    return response.json()
  },

  getPermissions: async () => {
    const response = await fetch('/api/organizations/current/api-keys/permissions', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'X-Organization-Slug': localStorage.getItem('organizationSlug')
      }
    })
    if (!response.ok) throw new Error('Failed to fetch permissions')
    return response.json()
  },

  testWebhook: async (webhookId, apiKey) => {
    const response = await fetch(`/api/webhooks/test/${webhookId}`, {
      headers: {
        'X-API-Key': apiKey
      }
    })
    if (!response.ok) throw new Error('Failed to test webhook')
    return response.json()
  }
}

// Copy to clipboard utility
const copyToClipboard = async (text, label) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard!`)
  } catch (err) {
    toast.error('Failed to copy to clipboard')
  }
}

// API Key Creation Modal
const CreateApiKeyModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    permissions: [],
    rate_limit_per_hour: 1000,
    expires_at: ''
  })
  const [selectedPermissions, setSelectedPermissions] = useState(new Set())
  
  const { data: permissionsData } = useQuery({
    queryKey: ['api-permissions'],
    queryFn: zapierAPI.getPermissions,
    enabled: isOpen
  })

  const createMutation = useMutation({
    mutationFn: zapierAPI.createApiKey,
    onSuccess: (data) => {
      onSuccess(data)
      onClose()
      setFormData({ name: '', permissions: [], rate_limit_per_hour: 1000, expires_at: '' })
      setSelectedPermissions(new Set())
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create API key')
    }
  })

  const handlePermissionToggle = (permission) => {
    const newSelected = new Set(selectedPermissions)
    if (newSelected.has(permission)) {
      newSelected.delete(permission)
    } else {
      newSelected.add(permission)
    }
    setSelectedPermissions(newSelected)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast.error('API key name is required')
      return
    }
    if (selectedPermissions.size === 0) {
      toast.error('At least one permission is required')
      return
    }

    createMutation.mutate({
      ...formData,
      permissions: Array.from(selectedPermissions),
      expires_at: formData.expires_at || null
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Create API Key</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* API Key Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Zapier Integration"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Permissions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permissions *
            </label>
            <div className="space-y-4 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-4">
              {permissionsData?.permissions?.map((category) => (
                <div key={category.category}>
                  <h4 className="font-medium text-gray-900 mb-2">{category.category}</h4>
                  <div className="space-y-2 ml-4">
                    {category.permissions.map((perm) => (
                      <label key={perm.value} className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedPermissions.has(perm.value)}
                          onChange={() => handlePermissionToggle(perm.value)}
                          className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{perm.label}</div>
                          <div className="text-xs text-gray-500">{perm.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rate Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rate Limit (requests per hour)
            </label>
            <input
              type="number"
              min="1"
              max="10000"
              value={formData.rate_limit_per_hour}
              onChange={(e) => setFormData({ ...formData, rate_limit_per_hour: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Expiration Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expiration Date (optional)
            </label>
            <input
              type="datetime-local"
              value={formData.expires_at}
              onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
            >
              {createMutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>Create API Key</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// API Key Success Modal (One-time display)
const ApiKeySuccessModal = ({ isOpen, onClose, apiKeyData }) => {
  const [showKey, setShowKey] = useState(false)

  if (!isOpen || !apiKeyData) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <div className="flex items-center space-x-3 mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
          <h2 className="text-xl font-semibold text-gray-900">API Key Created!</h2>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">Important Security Notice</p>
              <p className="mt-1">This is the only time the full API key will be displayed. Please copy and store it securely.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">API Key Name</label>
            <p className="text-gray-900 font-medium">{apiKeyData.api_key.name}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-50 border border-gray-300 rounded-md p-3 font-mono text-sm">
                {showKey ? apiKeyData.api_key.key : '••••••••••••••••••••••••••••••••••••••••'}
              </div>
              <button
                onClick={() => setShowKey(!showKey)}
                className="p-2 text-gray-500 hover:text-gray-700"
                title={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
              <button
                onClick={() => copyToClipboard(apiKeyData.api_key.key, 'API Key')}
                className="p-2 text-gray-500 hover:text-gray-700"
                title="Copy API key"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
            <div className="flex flex-wrap gap-2">
              {apiKeyData.api_key.permissions.map((permission) => (
                <span
                  key={permission}
                  className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs"
                >
                  {permission}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Got it, I've saved the key
          </button>
        </div>
      </div>
    </div>
  )
}

// Usage Statistics Component
const UsageStatsCard = ({ apiKey }) => {
  const [showDetails, setShowDetails] = useState(false)
  
  const { data: usageData, isLoading } = useQuery({
    queryKey: ['api-usage', apiKey.id],
    queryFn: () => zapierAPI.getUsageStats(apiKey.id),
    enabled: showDetails
  })

  if (isLoading) {
    return <LoadingSpinner className="py-4" />
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900">{apiKey.name}</h4>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          {showDetails ? 'Hide Details' : 'View Details'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-gray-500">Total Requests</div>
          <div className="font-medium">{apiKey.total_requests?.toLocaleString() || 0}</div>
        </div>
        <div>
          <div className="text-gray-500">Last Used</div>
          <div className="font-medium">
            {apiKey.last_used_at ? new Date(apiKey.last_used_at).toLocaleDateString() : 'Never'}
          </div>
        </div>
      </div>

      {showDetails && usageData && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Success Rate</div>
              <div className="font-medium text-green-600">
                {usageData.usage_statistics.success_rate}%
              </div>
            </div>
            <div>
              <div className="text-gray-500">Avg Response Time</div>
              <div className="font-medium">
                {usageData.usage_statistics.average_response_time_ms || 0}ms
              </div>
            </div>
            <div>
              <div className="text-gray-500">Unique IPs</div>
              <div className="font-medium">{usageData.usage_statistics.unique_source_ips}</div>
            </div>
            <div>
              <div className="text-gray-500">Rate Limit</div>
              <div className="font-medium">
                {usageData.rate_limit_status.current_count} / {usageData.rate_limit_status.limit}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Main Zapier Integration Page
const ZapierIntegrationPage = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [newApiKeyData, setNewApiKeyData] = useState(null)
  const [selectedTab, setSelectedTab] = useState('keys')

  // Fetch API keys
  const { data: apiKeysData, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: zapierAPI.getApiKeys
  })

  // Delete API key mutation
  const deleteMutation = useMutation({
    mutationFn: zapierAPI.deleteApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries(['api-keys'])
      toast.success('API key deactivated successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to deactivate API key')
    }
  })

  const handleCreateSuccess = (data) => {
    setNewApiKeyData(data)
    setShowSuccessModal(true)
    queryClient.invalidateQueries(['api-keys'])
  }

  const handleDeleteApiKey = (keyId, keyName) => {
    if (window.confirm(`Are you sure you want to deactivate the API key "${keyName}"? This action cannot be undone.`)) {
      deleteMutation.mutate(keyId)
    }
  }

  const webhookUrl = `${window.location.origin}/api/webhooks/leads`
  const apiKeysCount = apiKeysData?.api_keys?.length || 0
  const activeKeysCount = apiKeysData?.active_count || 0

  const tabs = [
    { id: 'keys', label: 'API Keys', icon: Key },
    { id: 'usage', label: 'Usage Stats', icon: BarChart3 },
    { id: 'setup', label: 'Setup Guide', icon: Zap }
  ]

  if (isLoading) {
    return <LoadingSpinner className="mt-8" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Zap className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Zapier Integration</h1>
            <p className="text-gray-600">Connect your CRM to 6,000+ apps with Zapier</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Key className="w-5 h-5 text-blue-600" />
              <div>
                <div className="text-sm text-blue-600 font-medium">API Keys</div>
                <div className="text-lg font-bold text-blue-900">{activeKeysCount} active</div>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Activity className="w-5 h-5 text-green-600" />
              <div>
                <div className="text-sm text-green-600 font-medium">Total Requests</div>
                <div className="text-lg font-bold text-green-900">
                  {apiKeysData?.api_keys?.reduce((sum, key) => sum + (key.total_requests || 0), 0)?.toLocaleString() || 0}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Globe className="w-5 h-5 text-purple-600" />
              <div>
                <div className="text-sm text-purple-600 font-medium">Webhook URL</div>
                <div className="text-xs text-purple-900 font-mono truncate">{webhookUrl}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  selectedTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* API Keys Tab */}
          {selectedTab === 'keys' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">API Keys Management</h2>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create API Key</span>
                </button>
              </div>

              {apiKeysData?.api_keys?.length === 0 ? (
                <div className="text-center py-12">
                  <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No API Keys Yet</h3>
                  <p className="text-gray-600 mb-4">Create your first API key to start integrating with Zapier</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    Create API Key
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {apiKeysData?.api_keys?.map((apiKey) => (
                    <div key={apiKey.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-gray-900">{apiKey.name}</h3>
                          <p className="text-sm text-gray-500 font-mono">{apiKey.key_prefix}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            apiKey.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {apiKey.status}
                          </span>
                          <button
                            onClick={() => copyToClipboard(apiKey.key_prefix, 'API Key Prefix')}
                            className="p-2 text-gray-400 hover:text-gray-600"
                            title="Copy API key prefix"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteApiKey(apiKey.id, apiKey.name)}
                            className="p-2 text-red-400 hover:text-red-600"
                            title="Deactivate API key"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Permissions</div>
                          <div className="font-medium">{apiKey.permissions?.length || 0} granted</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Rate Limit</div>
                          <div className="font-medium">{apiKey.rate_limit_per_hour}/hour</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Total Requests</div>
                          <div className="font-medium">{apiKey.total_requests?.toLocaleString() || 0}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Last Used</div>
                          <div className="font-medium">
                            {apiKey.last_used_at ? new Date(apiKey.last_used_at).toLocaleDateString() : 'Never'}
                          </div>
                        </div>
                      </div>

                      {apiKey.permissions && apiKey.permissions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-sm text-gray-500 mb-2">Permissions:</div>
                          <div className="flex flex-wrap gap-1">
                            {apiKey.permissions.map((permission) => (
                              <span
                                key={permission}
                                className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs"
                              >
                                {permission}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Usage Stats Tab */}
          {selectedTab === 'usage' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Usage Statistics</h2>
              
              {apiKeysData?.api_keys?.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Usage Data</h3>
                  <p className="text-gray-600">Create API keys and start making requests to see usage statistics</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {apiKeysData?.api_keys?.map((apiKey) => (
                    <UsageStatsCard key={apiKey.id} apiKey={apiKey} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Setup Guide Tab */}
          {selectedTab === 'setup' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Zapier Setup Guide</h2>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">Before you begin</p>
                    <p className="mt-1">Make sure you have created at least one API key with the appropriate permissions for your integration.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Step 1 */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
                    <h3 className="text-lg font-medium text-gray-900">Create a Zap in Zapier</h3>
                  </div>
                  <div className="ml-11 space-y-3">
                    <p className="text-gray-600">Start by creating a new Zap in your Zapier dashboard.</p>
                    <a
                      href="https://zapier.com/apps/webhook/integrations"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                    >
                      <span>Open Zapier Webhooks</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
                    <h3 className="text-lg font-medium text-gray-900">Configure the Webhook</h3>
                  </div>
                  <div className="ml-11 space-y-3">
                    <p className="text-gray-600">Set up the webhook to send data to your CRM:</p>
                    
                    <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
                          <div className="flex items-center space-x-2">
                            <code className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-sm font-mono">
                              {webhookUrl}
                            </code>
                            <button
                              onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
                              className="p-2 text-gray-500 hover:text-gray-700"
                              title="Copy webhook URL"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                          <code className="bg-white border border-gray-300 rounded px-3 py-2 text-sm font-mono">POST</code>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Headers</label>
                          <div className="bg-white border border-gray-300 rounded p-3">
                            <div className="space-y-2 text-sm font-mono">
                              <div className="flex justify-between">
                                <span className="text-gray-600">X-API-Key:</span>
                                <span className="text-gray-900">your-api-key-here</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Content-Type:</span>
                                <span className="text-gray-900">application/json</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
                    <h3 className="text-lg font-medium text-gray-900">Map Your Data</h3>
                  </div>
                  <div className="ml-11 space-y-3">
                    <p className="text-gray-600">Map the data from your trigger app to the lead fields:</p>
                    
                    <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">Required Fields:</div>
                      <ul className="space-y-1 text-sm text-gray-600">
                        <li>• <code className="bg-white px-1 rounded">first_name</code> - Contact's first name</li>
                        <li>• <code className="bg-white px-1 rounded">last_name</code> - Contact's last name</li>
                        <li>• <code className="bg-white px-1 rounded">email</code> - Contact's email address</li>
                      </ul>
                      
                      <div className="text-sm font-medium text-gray-700 mb-2 mt-4">Optional Fields:</div>
                      <ul className="space-y-1 text-sm text-gray-600">
                        <li>• <code className="bg-white px-1 rounded">phone</code> - Phone number</li>
                        <li>• <code className="bg-white px-1 rounded">company</code> - Company name</li>
                        <li>• <code className="bg-white px-1 rounded">lead_source</code> - Source of the lead</li>
                        <li>• <code className="bg-white px-1 rounded">notes</code> - Additional notes</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">4</div>
                    <h3 className="text-lg font-medium text-gray-900">Test Your Integration</h3>
                  </div>
                  <div className="ml-11 space-y-3">
                    <p className="text-gray-600">Test your Zap to make sure everything is working correctly:</p>
                    <ul className="space-y-1 text-sm text-gray-600 list-disc list-inside">
                      <li>Send a test request from Zapier</li>
                      <li>Check your CRM to see if the lead was created</li>
                      <li>Review the usage statistics in the "Usage Stats" tab</li>
                      <li>Turn on your Zap when testing is complete</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Support */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Need Help?</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>If you encounter any issues while setting up your integration:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Check that your API key has the required permissions</li>
                    <li>Verify that the webhook URL is correct</li>
                    <li>Review the usage statistics for error details</li>
                    <li>Contact support if you need additional assistance</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateApiKeyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />

      <ApiKeySuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        apiKeyData={newApiKeyData}
      />
    </div>
  )
}

export default ZapierIntegrationPage