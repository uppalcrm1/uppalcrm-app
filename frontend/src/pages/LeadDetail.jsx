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
  Plus
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import LeadProgressBar from '../components/Lead/LeadProgressBar'
import LeadActivityTimeline from '../components/Lead/LeadActivityTimeline'
import AddActivityModal from '../components/Lead/AddActivityModal'
import LeadHistoryPanel from '../components/Lead/LeadHistoryPanel'
import DuplicateAlert from '../components/Lead/DuplicateAlert'

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
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    fetchLeadDetail()
  }, [id, refreshKey])

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

  const handleStatusUpdate = async (newStatus, reason) => {
    try {
      await api.put(`/leads/${id}/status`, { status: newStatus, reason })
      setRefreshKey(prev => prev + 1) // Trigger refresh
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

  const handleConvertToContact = async () => {
    try {
      // This would integrate with existing contact conversion logic
      const response = await api.post(`/leads/${id}/convert`)
      if (response.data.success) {
        navigate(`/contacts/${response.data.contactId}`)
      }
    } catch (err) {
      console.error('Error converting lead:', err)
      setError('Failed to convert lead to contact')
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
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/leads')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {lead.first_name} {lead.last_name}
                </h1>
                <div className="flex items-center space-x-4 mt-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                    {lead.status_name || lead.status}
                  </span>
                  <span className="text-sm text-gray-500">
                    {lead.company && `${lead.company} • `}
                    Owner: {lead.owner_first_name} {lead.owner_last_name}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleToggleFollow}
                className={`btn ${isFollowing ? 'btn-secondary' : 'btn-outline'}`}
              >
                {isFollowing ? <Star size={16} className="mr-2" /> : <StarOff size={16} className="mr-2" />}
                {isFollowing ? 'Following' : 'Follow'}
              </button>

              <button className="btn btn-outline">
                <Edit size={16} className="mr-2" />
                Edit
              </button>

              <button
                onClick={handleConvertToContact}
                className="btn btn-primary"
              >
                <UserPlus size={16} className="mr-2" />
                Convert
              </button>

              <button className="btn btn-outline p-2">
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
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon size={16} className="mr-2" />
                  {tab.label}
                  {tab.id === 'activities' && activityStats.length > 0 && (
                    <span className="ml-2 bg-gray-100 text-gray-600 py-1 px-2 rounded-full text-xs">
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
      <div className="flex-1 px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === 'details' && (
              <LeadDetailsPanel lead={lead} />
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
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Lead Summary</h3>

              <div className="space-y-4">
                <div className="flex items-center text-sm">
                  <Mail size={16} className="text-gray-400 mr-3" />
                  <span className="text-gray-600">{lead.email}</span>
                </div>

                {lead.phone && (
                  <div className="flex items-center text-sm">
                    <Phone size={16} className="text-gray-400 mr-3" />
                    <span className="text-gray-600">{lead.phone}</span>
                  </div>
                )}

                {lead.company && (
                  <div className="flex items-center text-sm">
                    <Building2 size={16} className="text-gray-400 mr-3" />
                    <span className="text-gray-600">{lead.company}</span>
                  </div>
                )}

                {lead.lead_value && (
                  <div className="flex items-center text-sm">
                    <DollarSign size={16} className="text-gray-400 mr-3" />
                    <span className="text-gray-600">${lead.lead_value.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex items-center text-sm">
                  <Calendar size={16} className="text-gray-400 mr-3" />
                  <span className="text-gray-600">
                    Created {new Date(lead.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Activity Stats */}
            {activityStats.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Activity Overview</h3>
                <div className="space-y-3">
                  {activityStats.map((stat) => (
                    <div key={stat.interaction_type} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 capitalize">
                        {stat.interaction_type}s
                      </span>
                      <span className="text-sm font-medium">{stat.count}</span>
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
const LeadDetailsPanel = ({ lead }) => {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">Lead Information</h2>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="btn btn-outline btn-sm"
          >
            <Edit size={16} className="mr-2" />
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact Information */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Contact Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">First Name</label>
                <div className="mt-1 text-sm text-gray-900">{lead.first_name}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name</label>
                <div className="mt-1 text-sm text-gray-900">{lead.last_name}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <div className="mt-1 text-sm text-gray-900">{lead.email}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <div className="mt-1 text-sm text-gray-900">{lead.phone || 'Not provided'}</div>
              </div>
            </div>
          </div>

          {/* Lead Information */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Lead Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Company</label>
                <div className="mt-1 text-sm text-gray-900">{lead.company || 'Not provided'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Source</label>
                <div className="mt-1 text-sm text-gray-900">{lead.source_name || lead.lead_source || 'Not specified'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Lead Value</label>
                <div className="mt-1 text-sm text-gray-900">
                  {lead.lead_value ? `$${lead.lead_value.toLocaleString()}` : 'Not specified'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Priority</label>
                <div className="mt-1 text-sm text-gray-900 capitalize">{lead.priority || 'Medium'}</div>
              </div>
            </div>
          </div>

          {/* Address Information */}
          {(lead.address || lead.city || lead.state || lead.postal_code) && (
            <div className="md:col-span-2">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Address Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Address</label>
                  <div className="mt-1 text-sm text-gray-900">{lead.address || 'Not provided'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">City</label>
                  <div className="mt-1 text-sm text-gray-900">{lead.city || 'Not provided'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">State</label>
                  <div className="mt-1 text-sm text-gray-900">{lead.state || 'Not provided'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Postal Code</label>
                  <div className="mt-1 text-sm text-gray-900">{lead.postal_code || 'Not provided'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {lead.notes && (
            <div className="md:col-span-2">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Notes</h3>
              <div className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{lead.notes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LeadDetail