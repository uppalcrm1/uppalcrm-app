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
  X
} from 'lucide-react'
import { leadsAPI, usersAPI, contactsAPI } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ConvertLeadModal from '../components/ConvertLeadModal'
import DynamicLeadForm from '../components/DynamicLeadForm'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  
  // State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [selectedLead, setSelectedLead] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  // Get current filters from URL
  const currentFilters = {
    page: parseInt(searchParams.get('page')) || 1,
    limit: parseInt(searchParams.get('limit')) || 20,
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    assigned_to: searchParams.get('assigned_to') || '',
    source: searchParams.get('source') || '',
  }

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
    onSuccess: () => {
      queryClient.invalidateQueries(['leads'])
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
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
      <div className="card">
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
      <div className="card">
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
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Lead</th>
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
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{lead.full_name}</p>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            {lead.email && (
                              <div className="flex items-center">
                                <Mail size={12} className="mr-1" />
                                {lead.email}
                              </div>
                            )}
                            {lead.phone && (
                              <div className="flex items-center">
                                <Phone size={12} className="mr-1" />
                                {lead.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
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
        <EditLeadModal
          lead={selectedLead}
          onClose={() => {
            setShowEditModal(false)
            setSelectedLead(null)
          }}
          onSubmit={(data) => updateMutation.mutate({ id: selectedLead.id, data })}
          users={usersData?.users || []}
          isLoading={updateMutation.isPending}
        />
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
    </div>
  )
}


// Edit Lead Modal Component
const EditLeadModal = ({ lead, onClose, onSubmit, users, isLoading }) => {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      ...lead,
      next_follow_up: lead.next_follow_up ? new Date(lead.next_follow_up).toISOString().slice(0, 16) : ''
    }
  })

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block w-full max-w-2xl px-6 py-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Edit Lead</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* First Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                <input
                  {...register('first_name', { required: 'First name is required' })}
                  className={`input ${errors.first_name ? 'border-red-500' : ''}`}
                />
                {errors.first_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.first_name.message}</p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                <input
                  {...register('last_name', { required: 'Last name is required' })}
                  className={`input ${errors.last_name ? 'border-red-500' : ''}`}
                />
                {errors.last_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.last_name.message}</p>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input {...register('title')} className="input" />
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                <input {...register('company')} className="input" />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  {...register('email', {
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Please enter a valid email'
                    }
                  })}
                  type="email"
                  className={`input ${errors.email ? 'border-red-500' : ''}`}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input {...register('phone')} type="tel" className="input" />
              </div>

              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
                <select {...register('source')} className="select">
                  <option value="">Select source</option>
                  {LEAD_SOURCES.map(source => (
                    <option key={source} value={source}>
                      {source.charAt(0).toUpperCase() + source.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select {...register('status')} className="select">
                  {LEAD_STATUSES.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select {...register('priority')} className="select">
                  {LEAD_PRIORITIES.map(priority => (
                    <option key={priority.value} value={priority.value}>{priority.label}</option>
                  ))}
                </select>
              </div>

              {/* Value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Potential Value ($)</label>
                <input
                  {...register('value', {
                    min: { value: 0, message: 'Value must be positive' }
                  })}
                  type="number"
                  min="0"
                  step="0.01"
                  className={`input ${errors.value ? 'border-red-500' : ''}`}
                />
                {errors.value && (
                  <p className="mt-1 text-sm text-red-600">{errors.value.message}</p>
                )}
              </div>

              {/* Assigned To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign To</label>
                <select {...register('assigned_to')} className="select">
                  <option value="">Unassigned</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Next Follow Up */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Next Follow Up</label>
                <input
                  {...register('next_follow_up')}
                  type="datetime-local"
                  className="input"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                {...register('notes')}
                rows={3}
                className="input resize-none"
              />
            </div>

            {/* Actions */}
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
                disabled={isLoading}
                className="btn btn-primary btn-md"
              >
                {isLoading ? <LoadingSpinner size="sm" /> : 'Update Lead'}
              </button>
            </div>
          </form>
        </div>
      </div>
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