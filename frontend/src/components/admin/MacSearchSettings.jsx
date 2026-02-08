import React, { useState, useEffect } from 'react'
import { Settings, Save, AlertCircle, CheckCircle, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

const MacSearchSettings = () => {
  const { user } = useAuth()
  const [macSearchEnabled, setMacSearchEnabled] = useState(false)
  const [portals, setPortals] = useState([])
  const [credentials, setCredentials] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [showPasswords, setShowPasswords] = useState({})
  const [showAddPortal, setShowAddPortal] = useState(false)
  const [newPortalName, setNewPortalName] = useState('')
  const [newPortalUrl, setNewPortalUrl] = useState('')
  const [isAddingPortal, setIsAddingPortal] = useState(false)

  // Fetch portals and current configuration
  useEffect(() => {
    if (user?.organization_id) {
      fetchSettings()
    }
  }, [user?.organization_id])

  const fetchSettings = async () => {
    try {
      setLoading(true)

      // Get feature status
      const { data: orgData } = await api.get(`/organizations/${user?.organization_id}`)
      setMacSearchEnabled(orgData.mac_search_enabled || false)

      // Get available portals
      const { data: portalsData } = await api.get('/mac-search/portals')
      setPortals(portalsData.portals || [])

      // Initialize credentials state with saved usernames
      const credState = {}
      portalsData.portals?.forEach(p => {
        credState[p.id] = {
          username: p.username || '',
          password: '',
          configured: p.configured
        }
      })
      setCredentials(credState)
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to load settings: ' + error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleFeature = async (enabled) => {
    try {
      await api.patch(`/organizations/${user?.organization_id}`, {
        mac_search_enabled: enabled,
      })
      setMacSearchEnabled(enabled)
      setMessage({
        type: 'success',
        text: `MAC search ${enabled ? 'enabled' : 'disabled'} successfully`,
      })
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to update setting: ' + error.message,
      })
    }
  }

  const handleCredentialChange = (portalId, field, value) => {
    setCredentials(prev => ({
      ...prev,
      [portalId]: {
        ...prev[portalId],
        [field]: value,
      },
    }))
  }

  const handleSaveCredentials = async (portalId) => {
    try {
      setSaving(true)
      const cred = credentials[portalId]

      if (!cred.username || !cred.password) {
        setMessage({
          type: 'error',
          text: 'Username and password are required',
        })
        return
      }

      await api.post('/mac-search/portal-credentials', {
        portalId: portalId,
        username: cred.username,
        password: cred.password,
      })

      setMessage({
        type: 'success',
        text: 'Credentials saved successfully',
      })

      // Update configured status
      setCredentials(prev => ({
        ...prev,
        [portalId]: {
          ...prev[portalId],
          configured: true,
        },
      }))
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to save credentials: ' + error.message,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAddPortal = async () => {
    try {
      if (!newPortalName.trim() || !newPortalUrl.trim()) {
        setMessage({
          type: 'error',
          text: 'Portal name and URL are required',
        })
        return
      }

      setIsAddingPortal(true)
      await api.post('/mac-search/portals', {
        name: newPortalName,
        url: newPortalUrl,
      })

      setMessage({
        type: 'success',
        text: 'Portal created successfully',
      })

      // Reset form and reload portals
      setNewPortalName('')
      setNewPortalUrl('')
      setShowAddPortal(false)
      await fetchSettings()
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to create portal: ' + error.message,
      })
    } finally {
      setIsAddingPortal(false)
    }
  }

  const handleDeletePortal = async (portalId, portalName) => {
    if (!window.confirm(`Are you sure you want to delete "${portalName}"?`)) {
      return
    }

    try {
      await api.delete(`/mac-search/portals/${portalId}`)

      setMessage({
        type: 'success',
        text: 'Portal deleted successfully',
      })

      // Reload portals
      await fetchSettings()
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to delete portal: ' + error.message,
      })
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="text-blue-600" size={28} />
          MAC Address Search Settings
        </h2>
        <p className="text-gray-600 mt-2">
          Configure which billing portals to search and manage portal access credentials
        </p>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
          ) : (
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
          )}
          <p className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </p>
        </div>
      )}

      {/* Feature Toggle */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Enable MAC Search Feature</h3>
            <p className="text-gray-600 text-sm mt-1">
              Allow users in this organization to search for MAC addresses across billing portals
            </p>
          </div>
          <button
            onClick={() => handleToggleFeature(!macSearchEnabled)}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              macSearchEnabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                macSearchEnabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Add Custom Portal */}
      {macSearchEnabled && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Add Custom Portal</h3>
            {!showAddPortal && (
              <button
                onClick={() => setShowAddPortal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus size={16} />
                Add Portal
              </button>
            )}
          </div>

          {showAddPortal && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Portal Name
                </label>
                <input
                  type="text"
                  value={newPortalName}
                  onChange={(e) => setNewPortalName(e.target.value)}
                  placeholder="e.g., Custom Billing Portal"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Portal URL
                </label>
                <input
                  type="url"
                  value={newPortalUrl}
                  onChange={(e) => setNewPortalUrl(e.target.value)}
                  placeholder="https://billing.example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAddPortal}
                  disabled={isAddingPortal}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-sm font-medium"
                >
                  {isAddingPortal ? 'Creating...' : 'Create Portal'}
                </button>
                <button
                  onClick={() => {
                    setShowAddPortal(false)
                    setNewPortalName('')
                    setNewPortalUrl('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Portal Credentials */}
      {macSearchEnabled && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Portal Credentials</h3>
          <p className="text-gray-600 text-sm">
            Configure access credentials for each billing portal. Passwords are encrypted and never stored in plain text.
          </p>

          {portals.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-600">
              No portals available. Please contact your administrator to add portals.
            </div>
          ) : (
            <div className="space-y-4">
              {portals.map(portal => (
                <div key={portal.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start">
                    {/* Portal Info */}
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{portal.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{portal.url}</p>
                      {portal.isCustom && <p className="text-xs text-blue-600 mt-1">Custom Portal</p>}
                      <div className="mt-3">
                        {credentials[portal.id]?.configured ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                            <CheckCircle size={14} />
                            Configured
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                            <AlertCircle size={14} />
                            Not Configured
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delete button for custom portals */}
                    {portal.isCustom && (
                      <button
                        onClick={() => handleDeletePortal(portal.id, portal.name)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete portal"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3 mt-4">
                    {/* Username Field */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        value={credentials[portal.id]?.username || ''}
                        onChange={(e) =>
                          handleCredentialChange(portal.id, 'username', e.target.value)
                        }
                        placeholder="Enter portal username"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>

                    {/* Password Field */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords[portal.id] ? 'text' : 'password'}
                          value={credentials[portal.id]?.password || ''}
                          onChange={(e) =>
                            handleCredentialChange(portal.id, 'password', e.target.value)
                          }
                          placeholder="Enter portal password"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswords(prev => ({
                              ...prev,
                              [portal.id]: !prev[portal.id],
                            }))
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showPasswords[portal.id] ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Save Button */}
                    <button
                      onClick={() => handleSaveCredentials(portal.id)}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-sm font-medium"
                    >
                      <Save size={16} />
                      {saving ? 'Saving...' : 'Save Credentials'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Warning */}
      {!macSearchEnabled && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-blue-800">
            <p className="font-semibold">MAC search feature is disabled</p>
            <p className="mt-1">
              Enable the feature above to configure portal credentials and allow users to search for MAC addresses.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default MacSearchSettings
