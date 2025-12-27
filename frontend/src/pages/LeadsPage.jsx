import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  UserPlus,
  Mail,
  Phone,
  Building,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  MessageSquare
} from 'lucide-react'
import { leadsAPI, usersAPI, contactsAPI } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ConvertLeadModal from '../components/ConvertLeadModal'
import DynamicLeadForm from '../components/DynamicLeadForm'
import InteractionsTimeline from '../components/InteractionsTimeline'
import TaskManager from '../components/TaskManager'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'

const LEAD_STATUSES = [
  { value: 'new', label: 'New', color: 'blue' },
  { value: 'contacted', label: 'Contacted', color: 'yellow' },
  { value: 'qualified', label: 'Qualified', color: 'purple' },
  { value: 'proposal', label: 'Proposal', color: 'indigo' },
  { value: 'negotiation', label: 'Negotiation', color: 'pink' },
  { value: 'converted', label: 'Converted', color: 'green' },
  { value: 'lost', label: 'Lost', color: 'red' }
]

const LEAD_PRIORITIES = [
  { value: 'low', label: 'Low', color: 'gray' },
  { value: 'medium', label: 'Medium', color: 'yellow' },
  { value: 'high', label: 'High', color: 'red' }
]

const LEAD_SOURCES = [
  'website', 'referral', 'social', 'cold-call', 'email', 'advertisement', 'trade-show', 'other'
]

const LeadsPage = () => {
  console.log('🔴 LeadsPage RENDER', Date.now())
  console.log('🟢 DEPLOYMENT CHECK - Build timestamp:', new Date().toISOString())
  console.log('✅ TASK MANAGER INTEGRATION - Version 2.0 - Loaded:', new Date().toISOString())
  console.log('📦 TaskManager component imported:', typeof TaskManager)

  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()

  // State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [showInteractions, setShowInteractions] = useState(null)
  const [selectedLead, setSelectedLead] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [activeActivityTab, setActiveActivityTab] = useState('tasks') // tasks, interactions, all

  // Get current filters from URL - memoized to prevent unnecessary re-renders
  const currentFilters = React.useMemo(() => ({
    page: parseInt(searchParams.get('page')) || 1,
    limit: parseInt(searchParams.get('limit')) || 20,
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    assigned_to: searchParams.get('assigned_to') || '',
    source: searchParams.get('source') || '',
  }), [searchParams])

  console.log('🔵 currentFilters memoized:', currentFilters)

  // Update URL with new filters
  const updateFilters = (newFilters) => {
    const params = new URLSearchParams()
    Object.entries({ ...currentFilters, ...newFilters }).forEach(([key, value]) => {
      if (value) params.set(key, value.toString())
    })
    setSearchParams(params)
  }

  // Fetch leads
  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads', currentFilters],
    queryFn: () => leadsAPI.getLeads(currentFilters),
  })

  // Fetch users for assignment
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.getUsers({ limit: 100 })
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: leadsAPI.createLead,
    onSuccess: () => {
      queryClient.invalidateQueries(['leads'])
      toast.success('Lead created successfully')
      setShowCreateModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create lead')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => leadsAPI.updateLead(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries(['leads'])
      queryClient.invalidateQueries(['tasks', variables.id])
      toast.success('Lead updated successfully')
      setShowEditModal(false)
      setSelectedLead(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update lead')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: leadsAPI.deleteLead,
    onSuccess: () => {
      queryClient.invalidateQueries(['leads'])
      toast.success('Lead deleted successfully')
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete lead')
    }
  })

  const assignMutation = useMutation({
    mutationFn: ({ leadId, userId }) => leadsAPI.assignLead(leadId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads'])
      toast.success('Lead assigned successfully')
      setShowAssignModal(false)
      setSelectedLead(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to assign lead')
    }
  })

  const convertMutation = useMutation({
    mutationFn: (data) => contactsAPI.convertFromLead(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads'])
      queryClient.invalidateQueries(['contacts'])
      toast.success('Lead converted to contact successfully')
      setShowConvertModal(false)
      setSelectedLead(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to convert lead')
    }
  })

  const getStatusBadgeColor = (status) => {
    const statusConfig = LEAD_STATUSES.find(s => s.value === status)
    return statusConfig ? statusConfig.color : 'gray'
  }

  const getPriorityBadgeColor = (priority) => {
    const priorityConfig = LEAD_PRIORITIES.find(p => p.value === priority)
    return priorityConfig ? priorityConfig.color : 'gray'
  }

  if (leadsLoading) {
    return <LoadingSpinner className="mt-8" />
  }

  const leads = leadsData?.leads || []
  const pagination = leadsData?.pagination || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-600">Manage your sales pipeline and convert prospects</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary btn-md mt-4 sm:mt-0"
        >
          <Plus size={16} className="mr-2" />
          Add Lead
        </button>
      </div>

      {/* Filters & Search */}
      <div className="px-4 sm:px-6 lg:px-8 mb-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads..."
                value={currentFilters.search}
                onChange={(e) => updateFilters({ search: e.target.value, page: 1 })}
                className="input pl-10"
              />
            </div>
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn btn-secondary btn-md"
          >
            <Filter size={16} className="mr-2" />
            Filters
            {Object.values(currentFilters).filter(v => v && v !== 1 && v !== 20 && v !== '').length > 0 && (
              <span className="ml-2 bg-primary-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                {Object.values(currentFilters).filter(v => v && v !== 1 && v !== 20 && v !== '').length}
              </span>
            )}
          </button>
        </div>

        {/* Expandable Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={currentFilters.status}
                  onChange={(e) => updateFilters({ status: e.target.value, page: 1 })}
                  className="select"
                >
                  <option value="">All Statuses</option>
                  {LEAD_STATUSES.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={currentFilters.priority}
                  onChange={(e) => updateFilters({ priority: e.target.value, page: 1 })}
                  className="select"
                >
                  <option value="">All Priorities</option>
                  {LEAD_PRIORITIES.map(priority => (
                    <option key={priority.value} value={priority.value}>{priority.label}</option>
                  ))}
                </select>
              </div>

              {/* Assigned To Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                <select
                  value={currentFilters.assigned_to}
                  onChange={(e) => updateFilters({ assigned_to: e.target.value, page: 1 })}
                  className="select"
                >
                  <option value="">All Team Members</option>
                  <option value="null">Unassigned</option>
                  {usersData?.users?.map(user => (
                    <option key={user.id} value={user.id}>{user.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Source Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <select
                  value={currentFilters.source}
                  onChange={(e) => updateFilters({ source: e.target.value, page: 1 })}
                  className="select"
                >
                  <option value="">All Sources</option>
                  {LEAD_SOURCES.map(source => (
                    <option key={source} value={source}>{source.charAt(0).toUpperCase() + source.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Clear Filters */}
            {Object.values(currentFilters).filter(v => v && v !== 1 && v !== 20 && v !== '').length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setSearchParams(new URLSearchParams())}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Leads List */}
      <div className="w-full">
        <div className="bg-white border-t border-gray-200">
          {leads.length === 0 ? (
          <div className="text-center py-12">
            <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No leads found</h3>
            <p className="text-gray-600 mb-6">
              {currentFilters.search || currentFilters.status || currentFilters.priority 
                ? "Try adjusting your search criteria or filters"
                : "Get started by adding your first lead"
              }
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary btn-md"
            >
              <Plus size={16} className="mr-2" />
              Add Lead
            </button>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead className="bg-gray-50">
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Phone</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Company</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Priority</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Value</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Assigned</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Created</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
                      {/* Name Column */}
                      <td className="py-4 px-4">
                        <p className="font-medium text-gray-900">{lead.full_name}</p>
                      </td>

                      {/* Email Column */}
                      <td className="py-4 px-4">
                        {lead.email ? (
                          <div className="flex items-center text-sm text-gray-900">
                            <Mail size={14} className="mr-2 text-gray-400" />
                            <a href={`mailto:${lead.email}`} className="hover:text-primary-600">
                              {lead.email}
                            </a>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>

                      {/* Phone Column */}
                      <td className="py-4 px-4">
                        {lead.phone ? (
                          <div className="flex items-center text-sm text-gray-900">
                            <Phone size={14} className="mr-2 text-gray-400" />
                            <a href={`tel:${lead.phone}`} className="hover:text-primary-600">
                              {lead.phone}
                            </a>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>

                      {/* Company Column */}
                      <td className="py-4 px-4">
                        <div className="flex items-center text-gray-900">
                          {lead.company && (
                            <>
                              <Building size={14} className="mr-2 text-gray-400" />
                              {lead.company}
                            </>
                          )}
                          {!lead.company && <span className="text-gray-500">—</span>}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`badge badge-${getStatusBadgeColor(lead.status)}`}>
                          {LEAD_STATUSES.find(s => s.value === lead.status)?.label || lead.status}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`badge badge-${getPriorityBadgeColor(lead.priority)}`}>
                          {LEAD_PRIORITIES.find(p => p.value === lead.priority)?.label || lead.priority}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center text-gray-900">
                          <DollarSign size={14} className="mr-1" />
                          {lead.value?.toLocaleString() || 0}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {lead.assigned_user ? (
                          <div className="flex items-center">
                            <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center mr-2">
                              <span className="text-white text-xs font-medium">
                                {lead.assigned_user.first_name[0]}{lead.assigned_user.last_name[0]}
                              </span>
                            </div>
                            <span className="text-sm text-gray-900">{lead.assigned_user.full_name}</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedLead(lead)
                              setShowAssignModal(true)
                            }}
                            className="text-sm text-gray-500 hover:text-primary-600"
                          >
                            Assign
                          </button>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm text-gray-600">
                          {format(new Date(lead.created_at), 'MMM d, yyyy')}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedLead(lead)
                              setShowEditModal(true)
                            }}
                            className="p-1 text-gray-600 hover:text-primary-600"
                            title="Edit lead"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => setShowInteractions(lead.id)}
                            className="p-1 text-gray-600 hover:text-blue-600"
                            title="View Interactions"
                          >
                            <MessageSquare size={16} />
                          </button>
                          {(lead.status === 'qualified' || lead.status === 'converted') && (
                            <button
                              onClick={() => {
                                setSelectedLead(lead)
                                setShowConvertModal(true)
                              }}
                              className="p-1 text-gray-600 hover:text-green-600"
                              title="Convert to contact"
                            >
                              <UserPlus size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this lead?')) {
                                deleteMutation.mutate(lead.id)
                              }
                            }}
                            className="p-1 text-gray-600 hover:text-red-600"
                            title="Delete lead"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} leads
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => updateFilters({ page: pagination.page - 1 })}
                    disabled={pagination.page <= 1}
                    className="btn btn-secondary btn-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-2 text-sm text-gray-600">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => updateFilters({ page: pagination.page + 1 })}
                    disabled={pagination.page >= pagination.pages}
                    className="btn btn-secondary btn-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </div>

      {/* Create Lead Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={() => setShowCreateModal(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block w-full max-w-4xl px-6 py-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Add New Lead</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <DynamicLeadForm
                onSubmit={(data) => {
                  createMutation.mutate(data);
                  setShowCreateModal(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {showEditModal && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => {
              setShowEditModal(false)
              setSelectedLead(null)
            }}
          ></div>

          {/* Modal Content */}
          <div className="relative w-full max-w-4xl bg-white shadow-xl rounded-lg overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Edit Lead</h3>
                <p className="mt-1 text-sm text-gray-600">Update lead information</p>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedLead(null)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <DynamicLeadForm
                mode="edit"
                leadData={selectedLead}
                onSuccess={() => {
                  queryClient.invalidateQueries(['leads'])
                  setShowEditModal(false)
                  setSelectedLead(null)
                  toast.success('Lead updated successfully')
                }}
                onClose={() => {
                  setShowEditModal(false)
                  setSelectedLead(null)
                }}
                isOpen={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Assign Lead Modal */}
      {showAssignModal && selectedLead && (
        <AssignLeadModal
          lead={selectedLead}
          onClose={() => {
            setShowAssignModal(false)
            setSelectedLead(null)
          }}
          onSubmit={(userId) => assignMutation.mutate({ leadId: selectedLead.id, userId })}
          users={usersData?.users || []}
          isLoading={assignMutation.isPending}
        />
      )}

      {/* Convert Lead Modal */}
      {showConvertModal && selectedLead && (
        <ConvertLeadModal
          lead={selectedLead}
          onClose={() => {
            setShowConvertModal(false)
            setSelectedLead(null)
          }}
          onSubmit={(data) => convertMutation.mutate(data)}
          isLoading={convertMutation.isPending}
        />
      )}

      {/* Activities Modal (Tasks & Interactions) */}
      {showInteractions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900">Lead Activities</h2>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                  v2.0 TASKS
                </span>
              </div>
              <button
                onClick={() => setShowInteractions(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-6">
              <button
                onClick={() => setActiveActivityTab('tasks')}
                className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                  activeActivityTab === 'tasks'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Tasks & Follow-ups
              </button>
              <button
                onClick={() => setActiveActivityTab('interactions')}
                className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                  activeActivityTab === 'interactions'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                All Interactions
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeActivityTab === 'tasks' && (
                <TaskManager leadId={showInteractions} />
              )}
              {activeActivityTab === 'interactions' && (
                <InteractionsTimeline leadId={showInteractions} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Assign Lead Modal Component
const AssignLeadModal = ({ lead, onClose, onSubmit, users, isLoading }) => {
  const [selectedUserId, setSelectedUserId] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(selectedUserId || null)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block w-full max-w-md px-6 py-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Assign Lead</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Assign <strong>{lead.full_name}</strong> to a team member:
              </p>

              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="select"
                required
              >
                <option value="">Select team member</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary btn-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !selectedUserId}
                className="btn btn-primary btn-md"
              >
                {isLoading ? <LoadingSpinner size="sm" /> : 'Assign Lead'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LeadsPage
