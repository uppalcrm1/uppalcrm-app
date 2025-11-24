import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Edit,
  UserPlus,
  UserCheck,
  UserX,
  Star,
  StarOff,
  AlertTriangle,
  Phone,
  Mail,
  Calendar,
  Building2,
  MapPin,
  DollarSign,
  Clock,
  MoreVertical,
  Plus,
  User,
  FileText
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import LeadProgressBar from '../components/Lead/LeadProgressBar'
import LeadActivityTimeline from '../components/Lead/LeadActivityTimeline'
import AddActivityModal from '../components/Lead/AddActivityModal'
import LeadHistoryPanel from '../components/Lead/LeadHistoryPanel'
import DuplicateAlert from '../components/Lead/DuplicateAlert'
import DynamicLeadForm from '../components/DynamicLeadForm'
import LeadConversionModal from '../components/LeadConversionModal'

const LeadDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [lead, setLead] = useState(null)
  const [activityStats, setActivityStats] = useState([])
  const [duplicates, setDuplicates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('details')
  const [isFollowing, setIsFollowing] = useState(false)
  const [showAddActivity, setShowAddActivity] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showConversionModal, setShowConversionModal] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [customFields, setCustomFields] = useState([])
  const [fieldConfig, setFieldConfig] = useState({ systemFields: [], customFields: [] })
  const [loadingFieldConfig, setLoadingFieldConfig] = useState(true)

  useEffect(() => {
    fetchLeadDetail()
    fetchFieldConfig()
  }, [id, refreshKey])

  const fetchFieldConfig = async () => {
    try {
      setLoadingFieldConfig(true)
      const response = await api.get('/custom-fields/form-config')

      // Filter system fields to only show enabled ones that should be shown in forms
      const visibleSystemFields = (response.data.systemFields || []).filter(
        f => f.is_enabled && f.show_in_forms !== false && !f.hidden
      )

      // Filter custom fields to only show enabled ones that should be shown in detail view
      const visibleCustomFields = (response.data.customFields || []).filter(
        f => f.is_enabled && f.show_in_detail_view !== false
      )

      setFieldConfig({
        systemFields: visibleSystemFields,
        customFields: visibleCustomFields
      })
      setCustomFields(visibleCustomFields)
    } catch (err) {
      console.error('Error fetching field config:', err)
      // On error, show default fields to prevent breaking the UI
      setFieldConfig({ systemFields: [], customFields: [] })
      setCustomFields([])
    } finally {
      setLoadingFieldConfig(false)
    }
  }

  const fetchLeadDetail = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/leads/${id}/detail`)
      const { lead: leadData, activityStats: stats, duplicates: dups } = response.data

      setLead(leadData)
      setActivityStats(stats)
      setDuplicates(dups)
      setIsFollowing(!!leadData.is_following)
      setError('')
    } catch (err) {
      console.error('Error fetching lead detail:', err)
      setError('Failed to load lead details')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (newStatus, reason, isConversion = false) => {
    try {
      // If converting to contact, use the conversion endpoint
      if (isConversion && newStatus === 'converted') {
        await handleConvertToContact()
      } else {
        // Otherwise, just update the status
        await api.put(`/leads/${id}/status`, { status: newStatus, reason })
        setRefreshKey(prev => prev + 1) // Trigger refresh
      }
    } catch (err) {
      console.error('Error updating status:', err)
      setError('Failed to update lead status')
    }
  }

  const handleToggleFollow = async () => {
    try {
      const response = await api.post(`/leads/${id}/follow`)
      setIsFollowing(response.data.following)
    } catch (err) {
      console.error('Error toggling follow:', err)
      setError('Failed to update follow status')
    }
  }

  const handleConvertToContact = () => {
    setShowConversionModal(true)
  }

  const handleConversionSubmit = async (conversionData) => {
    try {
      setIsConverting(true)

      // Call the API to convert
      const response = await api.post(`/leads/${id}/convert`, conversionData)

      // Show success message
      const accountMsg = response.data.account
        ? `\nAccount: ${response.data.account.accountName}${response.data.account.productId ? ' (Product assigned)' : ''}`
        : ''

      alert(`✅ Lead converted successfully!\n\nContact: ${response.data.contact.firstName} ${response.data.contact.lastName}\nEmail: ${response.data.contact.email}${accountMsg}`)

      // Close modal
      setShowConversionModal(false)

      // Refresh the lead data to show updated status
      setRefreshKey(prev => prev + 1)

      // Navigate to contacts page (or contact detail if it exists)
      navigate('/contacts')
    } catch (err) {
      console.error('Error converting lead:', err)

      // Show specific error messages
      if (err.response?.status === 409) {
        setError('A contact with this email already exists!')
      } else if (err.response?.status === 400 && err.response?.data?.error === 'Lead already converted') {
        setError('This lead has already been converted!')
      } else {
        setError('Failed to convert lead to contact. Please try again.')
      }
    } finally {
      setIsConverting(false)
    }
  }

  const handleActivityAdded = () => {
    setShowAddActivity(false)
    setRefreshKey(prev => prev + 1)
  }

  if (loading) return <LoadingSpinner />

  if (error && !lead) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">{error}</div>
          <button
            onClick={() => navigate('/leads')}
            className="btn btn-primary"
          >
            Back to Leads
          </button>
        </div>
      </div>
    )
  }

  if (!lead) return null

  const tabs = [
    { id: 'details', label: 'Details', icon: Building2 },
    { id: 'activities', label: 'Activities', icon: Clock },
    { id: 'history', label: 'History', icon: Calendar }
  ]

  const getStatusColor = (status) => {
    const colors = {
      new: 'bg-gray-100 text-gray-800',
      contacted: 'bg-blue-100 text-blue-800',
      qualified: 'bg-purple-100 text-purple-800',
      proposal: 'bg-orange-100 text-orange-800',
      negotiation: 'bg-pink-100 text-pink-800',
      converted: 'bg-green-100 text-green-800',
      lost: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <button
                onClick={() => navigate('/leads')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors mt-1"
                title="Back to Leads"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {lead.first_name} {lead.last_name}
                </h1>
                <div className="flex items-center flex-wrap gap-3">
                  <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${getStatusColor(lead.status)}`}>
                    {lead.status_name || lead.status}
                  </span>
                  {lead.company && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <Building2 size={14} className="text-gray-400" />
                      <span className="font-medium">{lead.company}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <User size={14} className="text-gray-400" />
                    <span>Owner: {lead.owner_first_name} {lead.owner_last_name}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleFollow}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  isFollowing
                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {isFollowing ? <Star size={16} className="fill-current" /> : <StarOff size={16} />}
                {isFollowing ? 'Following' : 'Follow'}
              </button>

              <button
                onClick={() => setShowEditModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium text-sm hover:bg-gray-50 transition-all"
              >
                <Edit size={16} />
                Edit
              </button>

              <button
                onClick={handleConvertToContact}
                className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
              >
                <UserPlus size={16} />
                Convert to Contact
              </button>

              <button className="p-2 bg-white text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all">
                <MoreVertical size={16} />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <LeadProgressBar
              currentStatus={lead.status}
              onStatusChange={handleStatusUpdate}
              timeInCurrentStage={lead.time_in_current_stage}
            />
          </div>

          {/* Duplicate Alert */}
          {duplicates.length > 0 && (
            <DuplicateAlert duplicates={duplicates} leadId={id} />
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6">
          <nav className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-6 border-b-3 font-medium text-sm transition-all ${
                    isActive
                      ? 'border-b-blue-600 text-blue-600 bg-blue-50/50'
                      : 'border-b-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                  {tab.id === 'activities' && activityStats.length > 0 && (
                    <span className={`py-0.5 px-2 rounded-full text-xs font-semibold ${
                      isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {activityStats.reduce((sum, stat) => sum + parseInt(stat.count), 0)}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-8 bg-gray-50">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === 'details' && (
              <LeadDetailsPanel
                lead={lead}
                customFields={customFields}
                fieldConfig={fieldConfig}
                loadingFieldConfig={loadingFieldConfig}
              />
            )}

            {activeTab === 'activities' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold">Activities</h2>
                  <button
                    onClick={() => setShowAddActivity(true)}
                    className="btn btn-primary"
                  >
                    <Plus size={16} className="mr-2" />
                    Add Activity
                  </button>
                </div>
                <LeadActivityTimeline leadId={id} />
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                <h2 className="text-lg font-semibold mb-6">Change History</h2>
                <LeadHistoryPanel leadId={id} />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Lead Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-5 py-4 border-b border-gray-200">
                <h3 className="text-base font-semibold text-gray-900">Quick Info</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Mail size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 mb-0.5">Email</div>
                    <a href={`mailto:${lead.email}`} className="text-sm font-medium text-blue-600 hover:text-blue-700 truncate block">
                      {lead.email}
                    </a>
                  </div>
                </div>

                {lead.phone && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Phone size={16} className="text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 mb-0.5">Phone</div>
                      <a href={`tel:${lead.phone}`} className="text-sm font-medium text-green-600 hover:text-green-700">
                        {lead.phone}
                      </a>
                    </div>
                  </div>
                )}

                {lead.company && (
                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <Building2 size={16} className="text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 mb-0.5">Company</div>
                      <div className="text-sm font-medium text-gray-900 truncate">{lead.company}</div>
                    </div>
                  </div>
                )}

                {lead.lead_value && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                      <DollarSign size={16} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 mb-0.5">Value</div>
                      <div className="text-sm font-semibold text-amber-700">${lead.lead_value.toLocaleString()}</div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <Calendar size={16} className="text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 mb-0.5">Created</div>
                    <div className="text-sm font-medium text-gray-900">
                      {new Date(lead.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Stats */}
            {activityStats.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-4 border-b border-gray-200">
                  <h3 className="text-base font-semibold text-gray-900">Activity Stats</h3>
                </div>
                <div className="p-5 space-y-3">
                  {activityStats.map((stat) => (
                    <div key={stat.interaction_type} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {stat.interaction_type}s
                      </span>
                      <span className="text-lg font-bold text-indigo-600">{stat.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Activity Modal */}
      {showAddActivity && (
        <AddActivityModal
          leadId={id}
          onClose={() => setShowAddActivity(false)}
          onActivityAdded={handleActivityAdded}
        />
      )}

      {/* Edit Lead Modal */}
      {showEditModal && (
        <DynamicLeadForm
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false)
            setRefreshKey(prev => prev + 1)
          }}
          mode="edit"
          leadData={lead}
        />
      )}

      {/* Lead Conversion Modal */}
      {showConversionModal && lead && (
        <LeadConversionModal
          lead={lead}
          onClose={() => setShowConversionModal(false)}
          onConvert={handleConversionSubmit}
          isConverting={isConverting}
        />
      )}

      {/* Error Message */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
    </div>
  )
}

// Lead Details Panel Component
const LeadDetailsPanel = ({ lead, customFields = [], fieldConfig = { systemFields: [], customFields: [] }, loadingFieldConfig = false }) => {
  // Helper to check if a field should be visible
  const isFieldVisible = (fieldName) => {
    // During loading, show all fields to prevent layout shift
    if (loadingFieldConfig) {
      return true
    }

    // If no config loaded (error case), show all fields
    if (!fieldConfig.systemFields || fieldConfig.systemFields.length === 0) {
      return true
    }

    // Check if field is in the visible system fields list
    const field = fieldConfig.systemFields.find(f => f.field_name === fieldName)
    if (!field) {
      // Field not in config, default to hidden (field might be newly hidden)
      return false
    }

    // Field must be enabled, show_in_forms must be true, and not hidden
    return field.is_enabled && field.show_in_forms !== false && !field.hidden
  }

  // Map field names to lead object keys
  const fieldMapping = {
    firstName: 'first_name',
    lastName: 'last_name',
    email: 'email',
    phone: 'phone',
    company: 'company',
    source: 'source',
    status: 'status',
    potentialValue: 'lead_value',
    priority: 'priority',
    title: 'title',
    notes: 'notes',
    assignedTo: 'assigned_to',
    nextFollowUp: 'next_follow_up',
    address: 'address',
    city: 'city',
    state: 'state',
    postalCode: 'postal_code'
  }

  return (
    <div className="space-y-6">
      {loadingFieldConfig && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-700">Loading field configuration...</p>
        </div>
      )}

      {/* Contact Information Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Contact Information
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {isFieldVisible('firstName') && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">First Name</div>
                <div className="text-base font-semibold text-gray-900">{lead.first_name}</div>
              </div>
            )}
            {isFieldVisible('lastName') && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Last Name</div>
                <div className="text-base font-semibold text-gray-900">{lead.last_name}</div>
              </div>
            )}
            {isFieldVisible('email') && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Email</div>
                <div className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a href={`mailto:${lead.email}`} className="text-blue-600 hover:text-blue-700 hover:underline">
                    {lead.email}
                  </a>
                </div>
              </div>
            )}
            {isFieldVisible('phone') && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Phone</div>
                <div className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  {lead.phone ? (
                    <>
                      <Phone className="w-4 h-4 text-gray-400" />
                      <a href={`tel:${lead.phone}`} className="text-blue-600 hover:text-blue-700 hover:underline">
                        {lead.phone}
                      </a>
                    </>
                  ) : (
                    <span className="text-gray-400 italic">Not provided</span>
                  )}
                </div>
              </div>
            )}
            {isFieldVisible('title') && lead.title && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Title</div>
                <div className="text-base font-semibold text-gray-900">{lead.title}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lead Details Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-600" />
            Lead Details
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {isFieldVisible('company') && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Company</div>
                <div className="text-base font-semibold text-gray-900">
                  {lead.company || <span className="text-gray-400 italic font-normal">Not provided</span>}
                </div>
              </div>
            )}
            {isFieldVisible('source') && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Source</div>
                <div className="text-base font-semibold text-gray-900">
                  {lead.source_name || lead.source || lead.lead_source || <span className="text-gray-400 italic font-normal">Not specified</span>}
                </div>
              </div>
            )}
            {isFieldVisible('status') && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Status</div>
                <div className="text-base font-semibold">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    lead.status === 'new' ? 'bg-gray-100 text-gray-800' :
                    lead.status === 'contacted' ? 'bg-blue-100 text-blue-800' :
                    lead.status === 'qualified' ? 'bg-purple-100 text-purple-800' :
                    lead.status === 'proposal' ? 'bg-orange-100 text-orange-800' :
                    lead.status === 'negotiation' ? 'bg-pink-100 text-pink-800' :
                    lead.status === 'converted' ? 'bg-green-100 text-green-800' :
                    lead.status === 'lost' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {lead.status_name || lead.status || 'New'}
                  </span>
                </div>
              </div>
            )}
            {isFieldVisible('potentialValue') && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Potential Value</div>
                <div className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  {lead.lead_value || lead.potential_value ? (
                    <>
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span className="text-green-600">${(lead.lead_value || lead.potential_value).toLocaleString()}</span>
                    </>
                  ) : (
                    <span className="text-gray-400 italic font-normal">Not specified</span>
                  )}
                </div>
              </div>
            )}
            {isFieldVisible('priority') && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Priority</div>
                <div className="text-base font-semibold">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    lead.priority === 'high' ? 'bg-red-100 text-red-800' :
                    lead.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {lead.priority || 'Medium'}
                  </span>
                </div>
              </div>
            )}
            {isFieldVisible('assignedTo') && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Assigned To</div>
                <div className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  {lead.owner_first_name && lead.owner_last_name ? (
                    <span>{lead.owner_first_name} {lead.owner_last_name}</span>
                  ) : (
                    <span className="text-gray-400 italic font-normal">Not assigned</span>
                  )}
                </div>
              </div>
            )}
            {isFieldVisible('nextFollowUp') && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Next Follow-up</div>
                <div className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {lead.next_follow_up ? (
                    <span className="text-blue-600">
                      {new Date(lead.next_follow_up).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic font-normal">Not scheduled</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Address Information Card */}
      {(isFieldVisible('address') || isFieldVisible('city') || isFieldVisible('state') || isFieldVisible('postalCode')) &&
       (lead.address || lead.city || lead.state || lead.postal_code) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-green-50 to-teal-50 px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-600" />
              Address Information
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {isFieldVisible('address') && (
                <div className="sm:col-span-2">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Street Address</div>
                  <div className="text-base font-semibold text-gray-900">
                    {lead.address || <span className="text-gray-400 italic font-normal">Not provided</span>}
                  </div>
                </div>
              )}
              {isFieldVisible('city') && (
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">City</div>
                  <div className="text-base font-semibold text-gray-900">
                    {lead.city || <span className="text-gray-400 italic font-normal">Not provided</span>}
                  </div>
                </div>
              )}
              {isFieldVisible('state') && (
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">State</div>
                  <div className="text-base font-semibold text-gray-900">
                    {lead.state || <span className="text-gray-400 italic font-normal">Not provided</span>}
                  </div>
                </div>
              )}
              {isFieldVisible('postalCode') && (
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Postal Code</div>
                  <div className="text-base font-semibold text-gray-900">
                    {lead.postal_code || <span className="text-gray-400 italic font-normal">Not provided</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notes Card */}
      {isFieldVisible('notes') && lead.notes && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" />
              Notes
            </h3>
          </div>
          <div className="p-6">
            <div className="text-base text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-4 border border-gray-200">
              {lead.notes}
            </div>
          </div>
        </div>
      )}

      {/* Custom Fields Card */}
      {customFields.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-cyan-600" />
              Custom Fields
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {customFields.map(field => {
                const fieldValue = lead.custom_fields?.[field.field_name]
                if (!fieldValue && fieldValue !== 0) return null

                return (
                  <div key={field.field_name}>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      {field.field_label}
                    </div>
                    <div className="text-base font-semibold text-gray-900">
                      {field.field_type === 'select' && field.field_options ? (
                        // For select fields, show the label if it's an object option
                        (() => {
                          const option = field.field_options.find(
                            opt => (typeof opt === 'string' ? opt : opt.value) === fieldValue
                          )
                          return option
                            ? (typeof option === 'string' ? option : option.label)
                            : fieldValue
                        })()
                      ) : (
                        fieldValue || <span className="text-gray-400 italic font-normal">Not provided</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeadDetail