import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Mail,
  Phone,
  Building,
  DollarSign,
  Users,
  ArrowRightLeft,
  Download
} from 'lucide-react'
import { contactsAPI, usersAPI } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import DataTable from '../components/shared/DataTable'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import ContactDetail from '../components/ContactDetail'
import ContactForm from '../components/ContactForm'
import ConvertLeadModal from '../components/ConvertLeadModal'
import InlineEditCell from '../components/InlineEditCell'
import { useFieldVisibility } from '../hooks/useFieldVisibility'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import DeleteConfirmModal from '../components/DeleteConfirmModal'

// Hardcoded special columns (not from field configuration)
const SPECIAL_COLUMNS = {
  accounts: { key: 'accounts', label: 'Accounts', description: 'Number of accounts', required: false, isSpecial: true, sortable: false },
  transactions: { key: 'transactions', label: 'Transactions', description: 'Number of transactions', required: false, isSpecial: true, sortable: false },
}

// Backend-supported sort columns
const SORTABLE_COLUMNS = new Set(['created_at', 'updated_at', 'first_name', 'last_name', 'company', 'status'])

// Build column definitions dynamically based on field configuration
// This will be set in the component using useFieldVisibility hook

const CONTACT_STATUSES = [
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'inactive', label: 'Inactive', color: 'gray' },
  { value: 'prospect', label: 'Prospect', color: 'blue' },
  { value: 'customer', label: 'Customer', color: 'purple' }
]

const CONTACT_TYPES = [
  { value: 'customer', label: 'Customer', color: 'green' },
  { value: 'prospect', label: 'Prospect', color: 'blue' },
  { value: 'partner', label: 'Partner', color: 'purple' },
  { value: 'vendor', label: 'Vendor', color: 'orange' }
]

const CONTACT_PRIORITIES = [
  { value: 'low', label: 'Low', color: 'gray' },
  { value: 'medium', label: 'Medium', color: 'yellow' },
  { value: 'high', label: 'High', color: 'red' }
]

const CONTACT_SOURCES = [
  'website', 'referral', 'social', 'cold-call', 'email', 'advertisement', 'trade-show', 'other'
]

const Contacts = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // Use field visibility hook for all field configuration
  const { fieldConfig, loading: fieldConfigLoading, isFieldVisible, getVisibleFields, getFieldLabel } = useFieldVisibility('contacts')

  // State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [selectedContact, setSelectedContact] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState('list') // 'list' or 'detail'
  const [loadingEditContact, setLoadingEditContact] = useState(false)
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' })
  const [selectedContacts, setSelectedContacts] = useState([])
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [contactToDelete, setContactToDelete] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Debounced search - separate immediate input from debounced API calls
  // Must be defined early, before currentFilters uses it
  const debouncedSearch = useDebouncedValue(searchTerm, 300)

  // Build dynamic column definitions from field configuration
  const { COLUMN_DEFINITIONS, DEFAULT_VISIBLE_COLUMNS } = React.useMemo(() => {
    // Collect ALL available fields for the column picker
    // Note: We include all fields here (not just show_in_list_view=true)
    // so users can toggle any field as a column option
    const columns = []
    const addedFields = new Set()

    // Add system fields - include ALL fields so they're available in column picker
    if (Array.isArray(fieldConfig)) {
      fieldConfig
        .filter(f => f.overall_visibility !== 'hidden')
        .forEach(field => {
          // Special handling: combine first_name and last_name into a single 'name' column
          if (field.field_name === 'first_name') {
            if (!addedFields.has('name')) {
              columns.push({
                key: 'name',
                sortKey: 'first_name',
                label: 'Name',
                type: 'text',
                isCustom: false,
                description: 'Contact name',
                required: true
              })
              addedFields.add('name')
            }
          } else if (field.field_name === 'last_name') {
            // Skip last_name since we combine it with first_name
            return
          } else {
            // Add other fields normally
            const isSortable = SORTABLE_COLUMNS.has(field.field_name)
            columns.push({
              key: field.field_name,
              label: field.field_label,
              type: field.field_type,
              isCustom: false,
              description: `${field.field_label}`,
              required: field.is_required,
              ...(isSortable ? {} : { sortable: false })
            })
            addedFields.add(field.field_name)
          }
        })
    }

    // Add special columns (accounts, transactions)
    columns.push(SPECIAL_COLUMNS.accounts)
    columns.push(SPECIAL_COLUMNS.transactions)

    // Create default visible columns object
    // Columns should be visible by default only if show_in_list_view=true
    const defaultVisibleCols = {}
    columns.forEach(col => {
      if (col.isSpecial) {
        // Special columns (accounts, transactions, actions) show by default
        defaultVisibleCols[col.key] = true
      } else if (col.key === 'name') {
        // Composite name field shows by default
        defaultVisibleCols[col.key] = true
      } else {
        // Other fields: check the field config's show_in_list_view setting
        const fieldDef = fieldConfig.find(f => f.field_name === col.key)
        defaultVisibleCols[col.key] = fieldDef?.show_in_list_view !== false
      }
    })

    return {
      COLUMN_DEFINITIONS: columns,
      DEFAULT_VISIBLE_COLUMNS: defaultVisibleCols
    }
  }, [fieldConfig])

  // Load column visibility from localStorage or use defaults
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('contacts_visible_columns')
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE_COLUMNS
  })

  // Build filters - use debouncedSearch for API calls, not searchParams
  const currentFilters = React.useMemo(() => ({
    page: parseInt(searchParams.get('page')) || 1,
    limit: parseInt(searchParams.get('limit')) || 20,
    search: debouncedSearch || '',  // ← Use debounced value, not from URL
    status: searchParams.get('status') || '',
    type: searchParams.get('type') || '',
    priority: searchParams.get('priority') || '',
    assigned_to: searchParams.get('assigned_to') || '',
    source: searchParams.get('source') || '',
    sort: sortConfig.key === 'name' ? 'first_name' : sortConfig.key,
    order: sortConfig.direction,
  }), [searchParams, debouncedSearch, sortConfig])

  // Update URL with new filters
  const updateFilters = (newFilters) => {
    const params = new URLSearchParams()
    Object.entries({ ...currentFilters, ...newFilters }).forEach(([key, value]) => {
      if (value) params.set(key, value.toString())
    })
    setSearchParams(params)
  }

  // Memoize active filter count (exclude sort/order/limit/page from count)
  const activeFilterCount = React.useMemo(() => {
    const { page, limit, sort, order, ...filters } = currentFilters
    return Object.values(filters).filter(v => v && v !== '').length
  }, [currentFilters])

  // Clear selection when filters, search, pagination, or sort changes
  useEffect(() => {
    setSelectedContacts([])
  }, [debouncedSearch, sortConfig, searchParams.get('page'), searchParams.get('status'), searchParams.get('type'), searchParams.get('priority'), searchParams.get('source')])

  // Sort handler - toggles direction, same pattern as LeadListTable
  const handleSort = useCallback((key) => {
    setSortConfig(prev => {
      const direction = prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
      return { key, direction }
    })
    // Reset to page 1 when sort changes
    updateFilters({ page: 1 })
  }, [])

  // Pagination change handler for DataTable
  const handlePaginationChange = useCallback((newPagination) => {
    updateFilters({
      page: newPagination.page,
      limit: newPagination.limit
    })
  }, [])

  // Column visibility handlers
  const handleColumnToggle = (columnKey) => {
    const newVisibleColumns = {
      ...visibleColumns,
      [columnKey]: !visibleColumns[columnKey]
    }
    setVisibleColumns(newVisibleColumns)
    localStorage.setItem('contacts_visible_columns', JSON.stringify(newVisibleColumns))
    console.log('📋 Column visibility updated:', newVisibleColumns)
  }

  const handleResetColumns = () => {
    // Reset to defaults
    setVisibleColumns({ ...DEFAULT_VISIBLE_COLUMNS })
    localStorage.setItem('contacts_visible_columns', JSON.stringify(DEFAULT_VISIBLE_COLUMNS))
    console.log('📋 Columns reset to defaults (respecting field configuration)')
  }

  // Sync URL when debounced value changes (after 300ms of no typing)
  // Guard clause prevents infinite loop on mount
  useEffect(() => {
    // Skip if search is already in sync with URL
    const currentSearch = searchParams.get('search') || ''
    if (currentSearch === debouncedSearch) return

    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      if (debouncedSearch.trim()) {
        newParams.set('search', debouncedSearch)
      } else {
        newParams.delete('search')
      }
      newParams.set('page', '1')
      return newParams
    })
  }, [debouncedSearch])

  // Sync searchTerm when URL changes externally (back button, etc.)
  useEffect(() => {
    const urlSearch = searchParams.get('search') || ''
    if (urlSearch !== searchTerm) {
      setSearchTerm(urlSearch)
    }
  }, [searchParams.get('search')])

  // Fetch contacts
  const { data: contactsData, isLoading: contactsLoading, isFetching: contactsFetching } = useQuery({
    queryKey: ['contacts', currentFilters],
    queryFn: () => contactsAPI.getContacts(currentFilters),
    keepPreviousData: true,
    staleTime: 30000,
  })

  // Fetch users for assignment
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.getUsers({ limit: 100 })
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: contactsAPI.createContact,
    onSuccess: (response) => {
      queryClient.invalidateQueries(['contacts'])
      toast.success('Contact created successfully')
      setShowCreateModal(false)
      // Optionally navigate to the new contact's detail page
      if (response?.contact?.id) {
        navigate(`/contacts/${response.contact.id}`)
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create contact')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => contactsAPI.updateContact(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['contacts'])
      toast.success('Contact updated successfully')
      setShowEditModal(false)
      setSelectedContact(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update contact')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: contactsAPI.deleteContact,
    onSuccess: () => {
      queryClient.invalidateQueries(['contacts'])
      toast.success('Contact deleted successfully')
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete contact')
    }
  })

  // Bulk export selected contacts as CSV (client-side)
  const handleBulkExport = useCallback(() => {
    if (selectedContacts.length === 0) return
    const allContacts = contactsData?.contacts || []
    const selected = allContacts.filter(c => selectedContacts.includes(c.id))
    const headers = ['Name', 'Email', 'Phone', 'Company', 'Status', 'Type', 'Source', 'Priority', 'Created At']
    const rows = selected.map(c => [
      c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim(),
      c.email || '', c.phone || '', c.company || '', c.status || '',
      c.type || '', c.source || '', c.priority || '', c.created_at || ''
    ])
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contacts_selected_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    toast.success(`Exported ${selected.length} contacts`)
  }, [selectedContacts, contactsData])

  // Export all contacts matching current filters (server-side)
  const handleExportAll = useCallback(async () => {
    try {
      const exportData = await contactsAPI.exportContacts(currentFilters)
      const blob = new Blob([exportData], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contacts_export_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Contacts exported successfully')
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export contacts')
    }
  }, [currentFilters])

  // Bulk delete selected contacts
  const handleBulkDelete = useCallback(async () => {
    if (selectedContacts.length === 0) return
    setBulkDeleting(true)
    try {
      await Promise.all(selectedContacts.map(id => contactsAPI.deleteContact(id)))
      queryClient.invalidateQueries(['contacts'])
      toast.success(`Successfully deleted ${selectedContacts.length} contacts`)
      setSelectedContacts([])
      setShowBulkDeleteModal(false)
    } catch (error) {
      console.error('Bulk delete failed:', error)
      toast.error('Failed to delete some contacts')
    } finally {
      setBulkDeleting(false)
    }
  }, [selectedContacts, queryClient])

  // Inline edit handler
  const handleFieldUpdate = async (recordId, fieldName, newValue, isCustomField = false) => {
    try {
      const isCustom = isCustomField || COLUMN_DEFINITIONS.some(col => col.key === fieldName && col.isCustom)

      if (isCustom) {
        const allContacts = contactsData?.contacts || []
        const currentContact = allContacts.find(c => c.id === recordId)
        await contactsAPI.updateContact(recordId, {
          custom_fields: {
            ...(currentContact?.custom_fields || {}),
            [fieldName]: newValue
          }
        })
      } else {
        await contactsAPI.updateContact(recordId, { [fieldName]: newValue })
      }
      queryClient.invalidateQueries(['contacts'])
    } catch (error) {
      console.error('Failed to update contact:', error)
      throw error
    }
  }

  // Handler to fetch full contact before opening edit modal
  const handleEditContact = async (contactFromList) => {
    try {
      setLoadingEditContact(true)
      const response = await contactsAPI.getContact(contactFromList.id)
      setSelectedContact(response.contact)
      setShowEditModal(true)
    } catch (error) {
      console.error('Failed to load contact for editing:', error)
      toast.error('Failed to load contact details')
    } finally {
      setLoadingEditContact(false)
    }
  }

  const getStatusBadgeColor = (status) => {
    const statusConfig = CONTACT_STATUSES.find(s => s.value === status)
    return statusConfig ? statusConfig.color : 'gray'
  }

  const getTypeBadgeColor = (type) => {
    const typeConfig = CONTACT_TYPES.find(t => t.value === type)
    return typeConfig ? typeConfig.color : 'gray'
  }

  const getPriorityBadgeColor = (priority) => {
    const priorityConfig = CONTACT_PRIORITIES.find(p => p.value === priority)
    return priorityConfig ? priorityConfig.color : 'gray'
  }

  // Helper function to get field value from contact (handles custom fields)
  const getFieldValue = (contact, fieldName) => {
    // Check if it's a custom field
    if (contact.custom_fields && contact.custom_fields[fieldName]) {
      return contact.custom_fields[fieldName]
    }
    // Otherwise get from contact object
    return contact[fieldName]
  }

  // Render cell content based on field type and name
  const renderCellContent = (contact, column) => {
    const value = getFieldValue(contact, column.key)

    // Handle special columns
    switch (column.key) {
      case 'name':
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleViewContact(contact)
            }}
            className="font-semibold text-blue-600 hover:text-blue-800 hover:underline text-left"
          >
            {contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unnamed Contact'}
          </button>
        )

      case 'email':
        return (
          <InlineEditCell
            value={value}
            fieldName="email"
            fieldType="email"
            recordId={contact.id}
            entityType="contacts"
            onSave={handleFieldUpdate}
            placeholder="Add email..."
            icon={<Mail size={14} />}
            className="text-sm"
          />
        )

      case 'phone':
        return (
          <InlineEditCell
            value={value}
            fieldName="phone"
            fieldType="text"
            recordId={contact.id}
            entityType="contacts"
            onSave={handleFieldUpdate}
            placeholder="Add phone..."
            icon={<Phone size={14} />}
            className="text-sm"
          />
        )

      case 'company':
        return (
          <InlineEditCell
            value={value}
            fieldName="company"
            fieldType="text"
            recordId={contact.id}
            entityType="contacts"
            onSave={handleFieldUpdate}
            placeholder="Add company..."
            icon={<Building size={14} />}
            className="text-sm"
          />
        )

      case 'status':
        return (
          <InlineEditCell
            value={value}
            fieldName="status"
            fieldType="select"
            recordId={contact.id}
            entityType="contacts"
            onSave={handleFieldUpdate}
            options={CONTACT_STATUSES.map(s => ({ value: s.value, label: s.label }))}
            displayValue={
              <span className={`badge badge-${getStatusBadgeColor(value)}`}>
                {CONTACT_STATUSES.find(s => s.value === value)?.label || value || '—'}
              </span>
            }
          />
        )

      case 'type':
        return (
          <InlineEditCell
            value={value}
            fieldName="type"
            fieldType="select"
            recordId={contact.id}
            entityType="contacts"
            onSave={handleFieldUpdate}
            options={CONTACT_TYPES.map(t => ({ value: t.value, label: t.label }))}
            displayValue={
              <span className={`badge badge-${getTypeBadgeColor(value)}`}>
                {CONTACT_TYPES.find(t => t.value === value)?.label || value || '—'}
              </span>
            }
          />
        )

      case 'priority':
        return (
          <InlineEditCell
            value={value}
            fieldName="priority"
            fieldType="select"
            recordId={contact.id}
            entityType="contacts"
            onSave={handleFieldUpdate}
            options={CONTACT_PRIORITIES.map(p => ({ value: p.value, label: p.label }))}
            displayValue={
              <span className={`badge badge-${getPriorityBadgeColor(value)}`}>
                {CONTACT_PRIORITIES.find(p => p.value === value)?.label || value || '—'}
              </span>
            }
          />
        )

      case 'value':
        return (
          <InlineEditCell
            value={value}
            fieldName="value"
            fieldType="number"
            recordId={contact.id}
            entityType="contacts"
            onSave={handleFieldUpdate}
            placeholder="Add value..."
            prefix="$"
            icon={<DollarSign size={14} />}
            className="text-sm font-semibold text-green-600"
          />
        )

      case 'assigned_to':
        return (
          <InlineEditCell
            value={value}
            fieldName="assigned_to"
            fieldType="user-select"
            recordId={contact.id}
            entityType="contacts"
            onSave={handleFieldUpdate}
            users={usersData?.users || []}
            className="text-sm"
          />
        )

      case 'created_at':
        return (
          <div className="text-sm text-gray-600">
            {value ? format(new Date(value), 'MMM d, yyyy') : '—'}
          </div>
        )

      case 'next_follow_up':
        return (
          <InlineEditCell
            value={value}
            fieldName="next_follow_up"
            fieldType="date"
            recordId={contact.id}
            entityType="contacts"
            onSave={handleFieldUpdate}
            placeholder="Set date..."
            className="text-sm"
          />
        )

      case 'last_contact_date':
        return (
          <div className="text-sm text-gray-600">
            {value ? format(new Date(value), 'MMM d, yyyy') : '—'}
          </div>
        )

      case 'accounts':
        return (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
            {contact.accounts_count || 0}
          </span>
        )

      case 'transactions':
        return (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-semibold text-sm">
            {contact.transactions_count || 0}
          </span>
        )

      case 'source':
        return (
          <InlineEditCell
            value={value}
            fieldName="source"
            fieldType="select"
            recordId={contact.id}
            entityType="contacts"
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
        )

      // Default rendering for other text/select/number fields
      default:
        if (column.type === 'date') {
          return value ? (
            <div className="text-sm text-gray-600">{format(new Date(value), 'MMM d, yyyy')}</div>
          ) : (
            <span className="text-gray-500">—</span>
          )
        }
        if (column.type === 'select') {
          return <span className="text-gray-900">{value || '—'}</span>
        }
        return value ? (
          <span className="text-gray-900">{String(value).substring(0, 50)}</span>
        ) : (
          <span className="text-gray-500">—</span>
        )
    }
  }

  const handleViewContact = (contact) => {
    // Navigate to contact detail page
    navigate(`/contacts/${contact.id}`)
  }

  const handleBackToList = () => {
    setViewMode('list')
    setSelectedContact(null)
  }

  // Render row actions for DataTable
  const renderRowActions = useCallback((contact) => (
    <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => handleEditContact(contact)}
        disabled={loadingEditContact}
        className="p-1 text-gray-600 hover:text-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Edit Contact"
      >
        <Edit size={16} />
      </button>
      <button
        onClick={() => {
          setContactToDelete(contact)
          setShowDeleteModal(true)
        }}
        className="p-1 text-gray-600 hover:text-red-600"
        title="Delete Contact"
      >
        <Trash2 size={16} />
      </button>
    </div>
  ), [loadingEditContact])

  // Empty state helper
  const hasActiveFilters = !!(currentFilters.search || currentFilters.status || currentFilters.type || currentFilters.priority || currentFilters.source)

  if ((contactsLoading && !contactsData) || fieldConfigLoading) {
    return <LoadingSpinner className="mt-8" />
  }

  // Show contact detail view
  if (viewMode === 'detail' && selectedContact) {
    return (
      <ContactDetail
        contact={selectedContact}
        onBack={handleBackToList}
        onEdit={(contact) => handleEditContact(contact)}
        onDelete={(id) => {
          if (window.confirm('Are you sure you want to delete this contact?')) {
            deleteMutation.mutate(id)
            handleBackToList()
          }
        }}
      />
    )
  }

  const contacts = contactsData?.contacts || []
  const pagination = contactsData?.pagination || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-600">Manage customer relationships and software licensing</p>
        </div>
        <div className="flex items-center space-x-3 mt-4 sm:mt-0">
          <button
            onClick={handleExportAll}
            className="btn btn-secondary btn-md"
            title="Export all contacts matching current filters"
          >
            <Download size={16} className="mr-2" />
            Export
          </button>
          <button
            onClick={() => setShowConvertModal(true)}
            className="btn btn-secondary btn-md"
          >
            <ArrowRightLeft size={16} className="mr-2" />
            Convert Lead
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary btn-md"
          >
            <Plus size={16} className="mr-2" />
            Add Contact
          </button>
        </div>
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
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
            {activeFilterCount > 0 && (
              <span className="ml-2 bg-primary-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                {activeFilterCount}
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
                  {CONTACT_STATUSES.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={currentFilters.type}
                  onChange={(e) => updateFilters({ type: e.target.value, page: 1 })}
                  className="select"
                >
                  <option value="">All Types</option>
                  {CONTACT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
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
                  {CONTACT_PRIORITIES.map(priority => (
                    <option key={priority.value} value={priority.value}>{priority.label}</option>
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
                  {CONTACT_SOURCES.map(source => (
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

      {/* Contacts List */}
      <div className="card">
        <DataTable
          data={contacts}
          loading={contactsLoading && !contactsData}
          entityName="Contact"
          entityType="contacts"
          rowKey="id"
          columns={COLUMN_DEFINITIONS}
          visibleColumns={visibleColumns}
          onColumnToggle={handleColumnToggle}
          onColumnsReset={handleResetColumns}
          sortConfig={sortConfig}
          onSort={handleSort}
          pagination={pagination}
          onPaginationChange={handlePaginationChange}
          pageSizeOptions={[20, 50, 100]}
          selectable
          selectedIds={selectedContacts}
          onSelectionChange={setSelectedContacts}
          bulkActions={[
            { label: 'Export', icon: Download, onClick: handleBulkExport },
            { label: 'Delete', icon: Trash2, onClick: () => setShowBulkDeleteModal(true), variant: 'danger' },
          ]}
          renderCell={renderCellContent}
          renderRowActions={renderRowActions}
          onInlineEdit={handleFieldUpdate}
          emptyIcon={Users}
          emptyMessage="No contacts found"
          emptySubMessage={hasActiveFilters ? "Try adjusting your search criteria or filters" : "Get started by adding your first contact"}
        />
        {/* Empty state action buttons — shown below DataTable's empty state */}
        {contacts.length === 0 && !contactsLoading && (
          <div className="flex items-center justify-center space-x-3 pb-8 -mt-4">
            <button
              onClick={() => setShowConvertModal(true)}
              className="btn btn-secondary btn-md"
            >
              <ArrowRightLeft size={16} className="mr-2" />
              Convert Lead
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary btn-md"
            >
              <Plus size={16} className="mr-2" />
              Add Contact
            </button>
          </div>
        )}
      </div>

      {/* Create Contact Modal */}
      {showCreateModal && (
        <ContactForm
          onClose={() => setShowCreateModal(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          users={usersData?.users || []}
          isLoading={createMutation.isPending}
        />
      )}

      {/* Edit Contact Modal */}
      {showEditModal && selectedContact && (
        <ContactForm
          contact={selectedContact}
          onClose={() => {
            setShowEditModal(false)
            setSelectedContact(null)
          }}
          onSubmit={(data) => updateMutation.mutate({ id: selectedContact.id, data })}
          users={usersData?.users || []}
          isLoading={updateMutation.isPending}
        />
      )}

      {/* Bulk Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Contacts"
        message={`Are you sure you want to delete ${selectedContacts.length} contact${selectedContacts.length !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmButtonText={`Delete ${selectedContacts.length} Contact${selectedContacts.length !== 1 ? 's' : ''}`}
        isDestructive
        loading={bulkDeleting}
      />

      {/* Single Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setContactToDelete(null) }}
        onConfirm={() => {
          if (contactToDelete) {
            deleteMutation.mutate(contactToDelete.id)
            setShowDeleteModal(false)
            setContactToDelete(null)
          }
        }}
        title="Delete Contact"
        message={`Are you sure you want to delete ${contactToDelete?.name || contactToDelete?.first_name || 'this contact'}? This action cannot be undone.`}
        confirmButtonText="Delete"
        isDestructive
        loading={deleteMutation.isPending}
      />

      {/* Convert Lead Modal */}
      {showConvertModal && (
        <ConvertLeadModal
          onClose={() => setShowConvertModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries(['contacts'])
            queryClient.invalidateQueries(['leads'])
            setShowConvertModal(false)
          }}
        />
      )}
    </div>
  )
}

export default Contacts