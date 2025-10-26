import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Edit,
  Trash2,
  Mail,
  Phone,
  Building,
  User,
  Calendar,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
  Filter
} from 'lucide-react'
import { format } from 'date-fns'
import LeadConversionButton from './LeadConversionButton'
import api from '../services/api'

const LeadListTable = ({
  leads,
  pagination,
  onPaginationChange,
  onEditLead,
  onDeleteLead,
  onBulkAction,
  users,
  statuses,
  loading
}) => {
  const navigate = useNavigate()
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' })
  const [selectedLeads, setSelectedLeads] = useState([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [fieldLabels, setFieldLabels] = useState({})

  // Fetch field configuration to get dynamic column labels
  useEffect(() => {
    const loadFieldConfiguration = async () => {
      try {
        // Fetch field configuration for leads entity type
        const response = await api.get('/custom-fields?entity_type=leads')

        // Create a mapping of field_name -> field_label for leads
        // Combine both system and custom fields
        const allFields = [
          ...(response.data.systemFields || []),
          ...(response.data.customFields || [])
        ]

        const labelMap = {}
        allFields.forEach(field => {
          // Store the label for each field
          labelMap[field.field_name] = field.field_label
        })

        setFieldLabels(labelMap)
        console.log('📋 Field labels loaded for leads:', labelMap)
      } catch (error) {
        console.error('❌ Error loading field configuration:', error)
        // Use default labels if API fails
        setFieldLabels({})
      }
    }

    loadFieldConfiguration()
  }, [])

  // Sort leads based on current sort configuration
  const sortedLeads = useMemo(() => {
    if (!leads) return []

    const sortableLeads = [...leads]
    sortableLeads.sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })

    return sortableLeads
  }, [leads, sortConfig])

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedLeads(leads.map(lead => lead.id))
    } else {
      setSelectedLeads([])
    }
  }

  const handleSelectLead = (leadId, checked) => {
    if (checked) {
      setSelectedLeads(prev => [...prev, leadId])
    } else {
      setSelectedLeads(prev => prev.filter(id => id !== leadId))
    }
  }

  const handleBulkDelete = () => {
    if (selectedLeads.length > 0 && onBulkAction) {
      onBulkAction(selectedLeads, 'delete')
      setSelectedLeads([])
      setShowBulkActions(false)
    }
  }

  const handleBulkExport = () => {
    if (selectedLeads.length > 0 && onBulkAction) {
      onBulkAction(selectedLeads, 'export')
      setShowBulkActions(false)
    }
  }

  // Helper function to get field label with fallback
  const getFieldLabel = (fieldName, defaultLabel) => {
    return fieldLabels[fieldName] || defaultLabel
  }

  const getStatusColor = (status) => {
    const statusColors = {
      new: 'bg-blue-100 text-blue-800',
      contacted: 'bg-yellow-100 text-yellow-800',
      qualified: 'bg-purple-100 text-purple-800',
      proposal: 'bg-indigo-100 text-indigo-800',
      negotiation: 'bg-pink-100 text-pink-800',
      converted: 'bg-green-100 text-green-800',
      lost: 'bg-red-100 text-red-800',
    }
    return statusColors[status] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityColor = (priority) => {
    const priorityColors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800',
    }
    return priorityColors[priority] || 'bg-gray-100 text-gray-800'
  }

  const SortableHeader = ({ children, sortKey, className = '' }) => (
    <th
      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 ${className}`}
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortConfig.key === sortKey && (
          sortConfig.direction === 'asc' ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )
        )}
      </div>
    </th>
  )

  // Pagination controls
  const PaginationControls = () => {
    const totalPages = Math.ceil(pagination.total / pagination.limit)
    const currentPage = pagination.page || 1

    const handlePageChange = (newPage) => {
      if (onPaginationChange) {
        onPaginationChange({
          ...pagination,
          page: newPage
        })
      }
    }

    const handleLimitChange = (newLimit) => {
      if (onPaginationChange) {
        onPaginationChange({
          ...pagination,
          limit: newLimit,
          page: 1
        })
      }
    }

    return (
      <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-gray-200">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-700">
            Showing {((currentPage - 1) * pagination.limit) + 1} to{' '}
            {Math.min(currentPage * pagination.limit, pagination.total)} of{' '}
            {pagination.total} results
          </span>

          <select
            value={pagination.limit}
            onChange={(e) => handleLimitChange(parseInt(e.target.value))}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <span className="text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">Loading leads...</div>
      </div>
    )
  }

  return (
    <div className="bg-white">
      {/* Bulk Actions Bar */}
      {selectedLeads.length > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3 flex items-center justify-between">
          <span className="text-sm text-blue-800">
            {selectedLeads.length} lead{selectedLeads.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkExport}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <button
              onClick={() => setSelectedLeads([])}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedLeads.length === leads.length && leads.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <SortableHeader sortKey="first_name">{getFieldLabel('first_name', 'Name')}</SortableHeader>
              <SortableHeader sortKey="email">{getFieldLabel('email', 'Email')}</SortableHeader>
              <SortableHeader sortKey="company">{getFieldLabel('company', 'Company')}</SortableHeader>
              <SortableHeader sortKey="status">{getFieldLabel('status', 'Status')}</SortableHeader>
              <SortableHeader sortKey="priority">{getFieldLabel('priority', 'Priority')}</SortableHeader>
              <SortableHeader sortKey="value">{getFieldLabel('value', 'Value')}</SortableHeader>
              <SortableHeader sortKey="assigned_to">{getFieldLabel('assigned_to', 'Assigned To')}</SortableHeader>
              <SortableHeader sortKey="created_at">{getFieldLabel('created_at', 'Created')}</SortableHeader>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedLeads.map((lead) => {
              const assignedUser = users.find(user => user.id === lead.assigned_to)
              const value = parseFloat(lead.value) || 0

              return (
                <tr
                  key={lead.id}
                  className={`hover:bg-gray-50 ${
                    selectedLeads.includes(lead.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedLeads.includes(lead.id)}
                      onChange={(e) => handleSelectLead(lead.id, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>

                  {/* Name */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <button
                        onClick={() => navigate(`/leads/${lead.id}`)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-900 hover:underline cursor-pointer text-left"
                      >
                        {lead.first_name} {lead.last_name}
                      </button>
                      {lead.title && (
                        <div className="text-sm text-gray-500">{lead.title}</div>
                      )}
                    </div>
                  </td>

                  {/* Contact */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      {lead.email && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Mail className="w-3 h-3" />
                          <a
                            href={`mailto:${lead.email}`}
                            className="hover:text-blue-600"
                          >
                            {lead.email}
                          </a>
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Phone className="w-3 h-3" />
                          <a
                            href={`tel:${lead.phone}`}
                            className="hover:text-blue-600"
                          >
                            {lead.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Company */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {lead.company && (
                      <div className="flex items-center gap-1 text-sm text-gray-900">
                        <Building className="w-3 h-3 text-gray-400" />
                        {lead.company}
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                        lead.status
                      )}`}
                    >
                      {statuses.find(s => s.value === lead.status)?.label || lead.status}
                    </span>
                  </td>

                  {/* Priority */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(
                        lead.priority
                      )}`}
                    >
                      {lead.priority}
                    </span>
                  </td>

                  {/* Value */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {value > 0 && (
                      <div className="flex items-center gap-1 text-sm font-semibold text-green-600">
                        <DollarSign className="w-3 h-3" />
                        {value.toLocaleString()}
                      </div>
                    )}
                  </td>

                  {/* Assigned To */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {assignedUser && (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <User className="w-3 h-3" />
                        {assignedUser.first_name} {assignedUser.last_name}
                      </div>
                    )}
                  </td>

                  {/* Created */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(lead.created_at), 'MMM d, yyyy')}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <LeadConversionButton
                        lead={lead}
                        variant="icon"
                        onSuccess={() => {
                          // Refresh data will be handled by the component's query invalidation
                        }}
                      />
                      <button
                        onClick={() => onEditLead(lead)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit lead"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteLead(lead)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete lead"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Empty State */}
        {sortedLeads.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-2">No leads found</div>
            <div className="text-sm text-gray-400">
              Try adjusting your filters or add your first lead
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.total > 0 && <PaginationControls />}
    </div>
  )
}

export default LeadListTable