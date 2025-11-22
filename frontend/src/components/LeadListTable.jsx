import React, { useState, useMemo, useEffect, useCallback } from 'react'
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
import ColumnSelector from './ColumnSelector'
import InlineEditCell from './InlineEditCell'
import api from '../services/api'
import { leadsAPI } from '../services/api'

// Define system columns with metadata (comprehensive list)
const SYSTEM_COLUMN_DEFINITIONS = [
  { key: 'name', label: 'Name', description: 'Contact name and title', required: true },
  { key: 'email', label: 'Email', description: 'Email address', required: false },
  { key: 'phone', label: 'Phone', description: 'Phone number', required: false },
  { key: 'company', label: 'Company', description: 'Company name', required: false },
  { key: 'source', label: 'Source', description: 'Lead source', required: false },
  { key: 'status', label: 'Status', description: 'Lead status', required: false },
  { key: 'priority', label: 'Priority', description: 'Lead priority level', required: false },
  { key: 'value', label: 'Value', description: 'Estimated value', required: false },
  { key: 'assigned_to', label: 'Assigned To', description: 'Assigned team member', required: false },
  { key: 'next_follow_up', label: 'Next Follow Up', description: 'Next follow up date', required: false },
  { key: 'notes', label: 'Notes', description: 'Lead notes', required: false },
  { key: 'created_at', label: 'Created', description: 'Creation date', required: false },
  { key: 'updated_at', label: 'Updated', description: 'Last update date', required: false }
]

// Default visible columns
const DEFAULT_VISIBLE_COLUMNS = {
  name: true,
  email: true,
  company: true,
  status: true,
  priority: true,
  value: false,
  assigned_to: true,
  created_at: true
}

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
  const [columnDefinitions, setColumnDefinitions] = useState(SYSTEM_COLUMN_DEFINITIONS)

  // Load column visibility from localStorage or use defaults
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('leads_visible_columns')
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE_COLUMNS
  })

  // Local state for leads to enable optimistic updates
  const [localLeads, setLocalLeads] = useState(leads)

  // Sync local leads with prop leads
  useEffect(() => {
    setLocalLeads(leads)
  }, [leads])

  // Fetch field configuration to get dynamic column labels AND build column definitions
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

        // Build dynamic column definitions with custom fields
        const customFieldColumns = (response.data.customFields || [])
          .filter(f => f.is_enabled && (f.show_in_list_view !== false))
          .map(field => ({
            key: field.field_name,
            label: field.field_label,
            description: field.field_description || `Custom ${field.field_type} field`,
            required: false,
            isCustom: true,
            fieldType: field.field_type,
            fieldOptions: field.field_options
          }))

        // Combine system and custom field columns
        const allColumns = [...SYSTEM_COLUMN_DEFINITIONS, ...customFieldColumns]
        setColumnDefinitions(allColumns)
        console.log('📋 Column definitions updated:', allColumns.length, 'total columns')
        console.log('   - System columns:', SYSTEM_COLUMN_DEFINITIONS.length)
        console.log('   - Custom columns:', customFieldColumns.length)
      } catch (error) {
        console.error('❌ Error loading field configuration:', error)
        // Use default labels and system columns only if API fails
        setFieldLabels({})
        setColumnDefinitions(SYSTEM_COLUMN_DEFINITIONS)
      }
    }

    loadFieldConfiguration()
  }, [])

  // Sort leads based on current sort configuration
  const sortedLeads = useMemo(() => {
    if (!localLeads) return []

    const sortableLeads = [...localLeads]
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
  }, [localLeads, sortConfig])

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

  // Column visibility handlers
  const handleColumnToggle = (columnKey) => {
    const newVisibleColumns = {
      ...visibleColumns,
      [columnKey]: !visibleColumns[columnKey]
    }
    setVisibleColumns(newVisibleColumns)
    localStorage.setItem('leads_visible_columns', JSON.stringify(newVisibleColumns))
    console.log('📋 Column visibility updated:', newVisibleColumns)
  }

  const handleResetColumns = () => {
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    localStorage.setItem('leads_visible_columns', JSON.stringify(DEFAULT_VISIBLE_COLUMNS))
    console.log('📋 Columns reset to defaults')
  }

  // Inline edit handler with optimistic updates
  const handleFieldUpdate = async (recordId, fieldName, newValue, isCustomField = false) => {
    console.log(`📝 Updating lead ${recordId}: ${fieldName} = ${newValue}${isCustomField ? ' (custom field)' : ''}`)

    // Check if this is a custom field by looking at columnDefinitions
    const isCustom = isCustomField || columnDefinitions.some(col => col.key === fieldName && col.isCustom)

    // Optimistic update: immediately update local state
    setLocalLeads(prevLeads =>
      prevLeads.map(lead => {
        if (lead.id !== recordId) return lead

        if (isCustom) {
          // For custom fields, update the custom_fields object
          return {
            ...lead,
            custom_fields: {
              ...lead.custom_fields,
              [fieldName]: newValue
            }
          }
        } else {
          // For regular fields, update directly
          return { ...lead, [fieldName]: newValue }
        }
      })
    )

    // Save to server
    try {
      if (isCustom) {
        // For custom fields, update the custom_fields object
        const currentLead = localLeads.find(l => l.id === recordId)
        await leadsAPI.updateLead(recordId, {
          custom_fields: {
            ...(currentLead?.custom_fields || {}),
            [fieldName]: newValue
          }
        })
      } else {
        // For regular fields, update directly
        await leadsAPI.updateLead(recordId, { [fieldName]: newValue })
      }
      console.log(`✅ Successfully updated lead ${recordId}`)
    } catch (error) {
      console.error(`❌ Failed to update lead ${recordId}:`, error)
      // Error will be handled by InlineEditCell component (rollback)
      throw error
    }
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
      {/* Toolbar */}
      <div className="border-b border-gray-200 px-6 py-3 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {pagination.total || 0} {pagination.total === 1 ? 'Lead' : 'Leads'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ColumnSelector
            columns={columnDefinitions}
            visibleColumns={visibleColumns}
            onColumnToggle={handleColumnToggle}
            onReset={handleResetColumns}
          />
        </div>
      </div>

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
              {visibleColumns.name && <SortableHeader sortKey="first_name">{getFieldLabel('first_name', 'Name')}</SortableHeader>}
              {visibleColumns.email && <SortableHeader sortKey="email">{getFieldLabel('email', 'Email')}</SortableHeader>}
              {visibleColumns.company && <SortableHeader sortKey="company">{getFieldLabel('company', 'Company')}</SortableHeader>}
              {visibleColumns.status && <SortableHeader sortKey="status">{getFieldLabel('status', 'Status')}</SortableHeader>}
              {visibleColumns.priority && <SortableHeader sortKey="priority">{getFieldLabel('priority', 'Priority')}</SortableHeader>}
              {visibleColumns.value && <SortableHeader sortKey="value">{getFieldLabel('value', 'Value')}</SortableHeader>}
              {visibleColumns.assigned_to && <SortableHeader sortKey="assigned_to">{getFieldLabel('assigned_to', 'Assigned To')}</SortableHeader>}
              {visibleColumns.created_at && <SortableHeader sortKey="created_at">{getFieldLabel('created_at', 'Created')}</SortableHeader>}
              {visibleColumns.phone && <SortableHeader sortKey="phone">{getFieldLabel('phone', 'Phone')}</SortableHeader>}
              {visibleColumns.source && <SortableHeader sortKey="source">{getFieldLabel('source', 'Source')}</SortableHeader>}
              {visibleColumns.next_follow_up && <SortableHeader sortKey="next_follow_up">{getFieldLabel('next_follow_up', 'Next Follow Up')}</SortableHeader>}
              {visibleColumns.notes && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{getFieldLabel('notes', 'Notes')}</th>}
              {visibleColumns.updated_at && <SortableHeader sortKey="updated_at">{getFieldLabel('updated_at', 'Updated')}</SortableHeader>}
              {/* Custom Fields */}
              {columnDefinitions.filter(col => col.isCustom && visibleColumns[col.key]).map(col => (
                <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {col.label}
                </th>
              ))}
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
                  className={`${
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
                  {visibleColumns.name && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <button
                          onClick={() => navigate(`/leads/${lead.id}`)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-900 hover:underline cursor-pointer text-left block"
                        >
                          {lead.first_name} {lead.last_name}
                        </button>
                        {lead.title && (
                          <div className="text-xs text-gray-500 mt-0.5">{lead.title}</div>
                        )}
                      </div>
                    </td>
                  )}

                  {/* Email */}
                  {visibleColumns.email && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <InlineEditCell
                        value={lead.email}
                        fieldName="email"
                        fieldType="email"
                        recordId={lead.id}
                        entityType="leads"
                        onSave={handleFieldUpdate}
                        placeholder="Add email..."
                        icon={<Mail className="w-3 h-3" />}
                        className="text-sm"
                      />
                    </td>
                  )}

                  {/* Company */}
                  {visibleColumns.company && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <InlineEditCell
                        value={lead.company}
                        fieldName="company"
                        fieldType="text"
                        recordId={lead.id}
                        entityType="leads"
                        onSave={handleFieldUpdate}
                        placeholder="Add company..."
                        icon={<Building className="w-3 h-3 text-gray-400" />}
                      />
                    </td>
                  )}

                  {/* Status */}
                  {visibleColumns.status && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <InlineEditCell
                        value={lead.status}
                        fieldName="status"
                        fieldType="select"
                        recordId={lead.id}
                        entityType="leads"
                        onSave={handleFieldUpdate}
                        options={statuses}
                        displayValue={
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                              lead.status
                            )}`}
                          >
                            {statuses.find(s => s.value === lead.status)?.label || lead.status}
                          </span>
                        }
                      />
                    </td>
                  )}

                  {/* Priority */}
                  {visibleColumns.priority && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <InlineEditCell
                        value={lead.priority}
                        fieldName="priority"
                        fieldType="select"
                        recordId={lead.id}
                        entityType="leads"
                        onSave={handleFieldUpdate}
                        options={[
                          { value: 'low', label: 'Low' },
                          { value: 'medium', label: 'Medium' },
                          { value: 'high', label: 'High' }
                        ]}
                        displayValue={
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(
                              lead.priority
                            )}`}
                          >
                            {lead.priority}
                          </span>
                        }
                      />
                    </td>
                  )}

                  {/* Value */}
                  {visibleColumns.value && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <InlineEditCell
                        value={lead.value}
                        fieldName="value"
                        fieldType="number"
                        recordId={lead.id}
                        entityType="leads"
                        onSave={handleFieldUpdate}
                        placeholder="Add value..."
                        prefix="$"
                        icon={<DollarSign className="w-3 h-3 text-green-600" />}
                        className="text-sm font-semibold text-green-600"
                      />
                    </td>
                  )}

                  {/* Assigned To */}
                  {visibleColumns.assigned_to && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <InlineEditCell
                        value={lead.assigned_to}
                        fieldName="assigned_to"
                        fieldType="user-select"
                        recordId={lead.id}
                        entityType="leads"
                        onSave={handleFieldUpdate}
                        users={users}
                        icon={<User className="w-3 h-3" />}
                        className="text-sm"
                      />
                    </td>
                  )}

                  {/* Created */}
                  {visibleColumns.created_at && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(lead.created_at), 'MMM d, yyyy')}
                      </div>
                    </td>
                  )}

                  {/* Phone */}
                  {visibleColumns.phone && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <InlineEditCell
                        value={lead.phone}
                        fieldName="phone"
                        fieldType="text"
                        recordId={lead.id}
                        entityType="leads"
                        onSave={handleFieldUpdate}
                        placeholder="Add phone..."
                        icon={<Phone className="w-3 h-3 text-gray-400" />}
                        className="text-sm"
                      />
                    </td>
                  )}

                  {/* Source */}
                  {visibleColumns.source && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <InlineEditCell
                        value={lead.source}
                        fieldName="source"
                        fieldType="select"
                        recordId={lead.id}
                        entityType="leads"
                        onSave={handleFieldUpdate}
                        options={[
                          { value: 'website', label: 'Website' },
                          { value: 'referral', label: 'Referral' },
                          { value: 'social', label: 'Social Media' },
                          { value: 'cold-call', label: 'Cold Call' },
                          { value: 'email', label: 'Email' },
                          { value: 'advertisement', label: 'Advertisement' },
                          { value: 'trade-show', label: 'Trade Show' },
                          { value: 'other', label: 'Other' }
                        ]}
                        className="text-sm"
                      />
                    </td>
                  )}

                  {/* Next Follow Up */}
                  {visibleColumns.next_follow_up && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <InlineEditCell
                        value={lead.next_follow_up}
                        fieldName="next_follow_up"
                        fieldType="date"
                        recordId={lead.id}
                        entityType="leads"
                        onSave={handleFieldUpdate}
                        placeholder="Set date..."
                        icon={<Calendar className="w-3 h-3 text-blue-600" />}
                        className="text-sm"
                      />
                    </td>
                  )}

                  {/* Notes */}
                  {visibleColumns.notes && (
                    <td className="px-6 py-4 max-w-xs">
                      <InlineEditCell
                        value={lead.notes}
                        fieldName="notes"
                        fieldType="textarea"
                        recordId={lead.id}
                        entityType="leads"
                        onSave={handleFieldUpdate}
                        placeholder="Add notes..."
                        className="text-sm text-gray-600 truncate"
                      />
                    </td>
                  )}

                  {/* Updated */}
                  {visibleColumns.updated_at && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(lead.updated_at), 'MMM d, yyyy')}
                      </div>
                    </td>
                  )}

                  {/* Custom Fields */}
                  {columnDefinitions.filter(col => col.isCustom && visibleColumns[col.key]).map(col => {
                    const customValue = lead.custom_fields?.[col.key]

                    return (
                      <td key={col.key} className="px-6 py-4 whitespace-nowrap">
                        {col.fieldType === 'select' && col.fieldOptions ? (
                          <InlineEditCell
                            value={customValue}
                            fieldName={col.key}
                            fieldType="select"
                            recordId={lead.id}
                            entityType="leads"
                            onSave={handleFieldUpdate}
                            options={col.fieldOptions.map(opt =>
                              typeof opt === 'string'
                                ? { value: opt, label: opt }
                                : opt
                            )}
                            className="text-sm"
                            isCustomField={true}
                          />
                        ) : col.fieldType === 'date' ? (
                          <InlineEditCell
                            value={customValue}
                            fieldName={col.key}
                            fieldType="date"
                            recordId={lead.id}
                            entityType="leads"
                            onSave={handleFieldUpdate}
                            className="text-sm"
                            isCustomField={true}
                          />
                        ) : col.fieldType === 'number' ? (
                          <InlineEditCell
                            value={customValue}
                            fieldName={col.key}
                            fieldType="number"
                            recordId={lead.id}
                            entityType="leads"
                            onSave={handleFieldUpdate}
                            className="text-sm"
                            isCustomField={true}
                          />
                        ) : (
                          <InlineEditCell
                            value={customValue}
                            fieldName={col.key}
                            fieldType="text"
                            recordId={lead.id}
                            entityType="leads"
                            onSave={handleFieldUpdate}
                            className="text-sm"
                            isCustomField={true}
                          />
                        )}
                      </td>
                    )
                  })}

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