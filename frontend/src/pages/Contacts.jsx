import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
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
  Eye,
  Users,
  Smartphone,
  Key,
  PlayCircle,
  ArrowRightLeft
} from 'lucide-react'
import { contactsAPI, usersAPI } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ColumnSelector from '../components/ColumnSelector'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import ContactDetail from '../components/ContactDetail'
import ContactForm from '../components/ContactForm'
import ConvertLeadModal from '../components/ConvertLeadModal'
import api from '../services/api'

// Define available columns with metadata
const COLUMN_DEFINITIONS = [
  { key: 'name', label: 'Name', description: 'Contact name', required: true },
  { key: 'email', label: 'Email', description: 'Email address', required: false },
  { key: 'phone', label: 'Phone', description: 'Phone number', required: false },
  { key: 'company', label: 'Company', description: 'Company name', required: false },
  { key: 'status', label: 'Status', description: 'Contact status', required: false },
  { key: 'type', label: 'Type', description: 'Contact type', required: false },
  { key: 'accounts', label: 'Accounts', description: 'Number of accounts', required: false },
  { key: 'transactions', label: 'Transactions', description: 'Number of transactions', required: false },
  { key: 'value', label: 'Value', description: 'Contact value', required: false },
  { key: 'assigned', label: 'Assigned', description: 'Assigned team member', required: false },
  { key: 'created', label: 'Created', description: 'Creation date', required: false }
]

// Default visible columns
const DEFAULT_VISIBLE_COLUMNS = {
  name: true,
  email: true,
  phone: true,
  company: true,
  status: true,
  type: true,
  accounts: true,
  transactions: true,
  value: true,
  assigned: true,
  created: true
}

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
  
  // State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [selectedContact, setSelectedContact] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState('list') // 'list' or 'detail'
  const [fieldLabels, setFieldLabels] = useState({})
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '') // Local state for search input
  const isTypingRef = useRef(false) // Track if user is actively typing

  // Load column visibility from localStorage or use defaults
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('contacts_visible_columns')
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE_COLUMNS
  })

  // Fetch field configuration to get dynamic column labels
  useEffect(() => {
    const loadFieldConfiguration = async () => {
      try {
        const response = await api.get('/custom-fields?entity_type=contacts')
        const allFields = [
          ...(response.data.systemFields || []),
          ...(response.data.customFields || [])
        ]
        const labelMap = {}
        allFields.forEach(field => {
          labelMap[field.field_name] = field.field_label
        })
        setFieldLabels(labelMap)
        console.log('📋 Field labels loaded for contacts:', labelMap)
      } catch (error) {
        console.error('❌ Error loading field configuration:', error)
        setFieldLabels({})
      }
    }
    loadFieldConfiguration()
  }, [])

  // Sync search input from URL only when not typing
  useEffect(() => {
    const urlSearch = searchParams.get('search') || ''
    if (!isTypingRef.current && urlSearch !== searchInput) {
      setSearchInput(urlSearch)
    }
  }, [searchParams])

  // Debounce search input to update URL
  useEffect(() => {
    isTypingRef.current = true
    const timer = setTimeout(() => {
      const urlSearch = searchParams.get('search') || ''
      if (searchInput !== urlSearch) {
        const params = new URLSearchParams(searchParams)
        if (searchInput) {
          params.set('search', searchInput)
        } else {
          params.delete('search')
        }
        params.set('page', '1') // Reset to first page
        setSearchParams(params)
      }
      isTypingRef.current = false
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [searchInput])

  // Get current filters from URL
  const currentFilters = {
    page: parseInt(searchParams.get('page')) || 1,
    limit: parseInt(searchParams.get('limit')) || 20,
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    type: searchParams.get('type') || '',
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
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    localStorage.setItem('contacts_visible_columns', JSON.stringify(DEFAULT_VISIBLE_COLUMNS))
    console.log('📋 Columns reset to defaults')
  }

  // Helper function to get field label with fallback
  const getFieldLabel = (fieldName, defaultLabel) => {
    return fieldLabels[fieldName] || defaultLabel
  }

  // Fetch contacts
  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['contacts', currentFilters],
    queryFn: () => contactsAPI.getContacts(currentFilters),
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

  const handleViewContact = (contact) => {
    // Navigate to contact detail page
    navigate(`/contacts/${contact.id}`)
  }

  const handleBackToList = () => {
    setViewMode('list')
    setSelectedContact(null)
  }

  if (contactsLoading) {
    return <LoadingSpinner className="mt-8" />
  }

  // Show contact detail view
  if (viewMode === 'detail' && selectedContact) {
    return (
      <ContactDetail 
        contact={selectedContact}
        onBack={handleBackToList}
        onEdit={(contact) => {
          setSelectedContact(contact)
          setShowEditModal(true)
        }}
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
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
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
        {/* Toolbar - Always visible */}
        <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              {pagination.total || 0} {pagination.total === 1 ? 'Contact' : 'Contacts'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ColumnSelector
              columns={COLUMN_DEFINITIONS}
              visibleColumns={visibleColumns}
              onColumnToggle={handleColumnToggle}
              onReset={handleResetColumns}
            />
          </div>
        </div>

        {contacts.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
            <p className="text-gray-600 mb-6">
              {currentFilters.search || currentFilters.status || currentFilters.type 
                ? "Try adjusting your search criteria or filters"
                : "Get started by adding your first contact"
              }
            </p>
            <div className="flex items-center justify-center space-x-3">
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
        ) : (
          <>
            {/* Table Header */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    {visibleColumns.name && <th className="text-left py-3 px-4 font-medium text-gray-900">{getFieldLabel('name', 'Name')}</th>}
                    {visibleColumns.email && <th className="text-left py-3 px-4 font-medium text-gray-900">{getFieldLabel('email', 'Email')}</th>}
                    {visibleColumns.phone && <th className="text-left py-3 px-4 font-medium text-gray-900">{getFieldLabel('phone', 'Phone')}</th>}
                    {visibleColumns.company && <th className="text-left py-3 px-4 font-medium text-gray-900">{getFieldLabel('company', 'Company')}</th>}
                    {visibleColumns.status && <th className="text-left py-3 px-4 font-medium text-gray-900">{getFieldLabel('status', 'Status')}</th>}
                    {visibleColumns.type && <th className="text-left py-3 px-4 font-medium text-gray-900">{getFieldLabel('type', 'Type')}</th>}
                    {visibleColumns.accounts && <th className="text-center py-3 px-4 font-medium text-gray-900">Accounts</th>}
                    {visibleColumns.transactions && <th className="text-center py-3 px-4 font-medium text-gray-900">Transactions</th>}
                    {visibleColumns.value && <th className="text-left py-3 px-4 font-medium text-gray-900">{getFieldLabel('value', 'Value')}</th>}
                    {visibleColumns.assigned && <th className="text-left py-3 px-4 font-medium text-gray-900">{getFieldLabel('assigned_to', 'Assigned')}</th>}
                    {visibleColumns.created && <th className="text-left py-3 px-4 font-medium text-gray-900">{getFieldLabel('created_at', 'Created')}</th>}
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      {visibleColumns.name && (
                        <td className="py-4 px-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewContact(contact);
                            }}
                            className="font-semibold text-blue-600 hover:text-blue-800 hover:underline text-left"
                          >
                            {contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unnamed Contact'}
                          </button>
                        </td>
                      )}
                      {visibleColumns.email && (
                        <td className="py-4 px-4">
                          {contact.email ? (
                            <div className="flex items-center text-gray-900">
                              <Mail size={14} className="mr-2 text-gray-400" />
                              {contact.email}
                            </div>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.phone && (
                        <td className="py-4 px-4">
                          {contact.phone ? (
                            <div className="flex items-center text-gray-900">
                              <Phone size={14} className="mr-2 text-gray-400" />
                              {contact.phone}
                            </div>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.company && (
                        <td className="py-4 px-4">
                          <div className="flex items-center text-gray-900">
                            {contact.company && (
                              <>
                                <Building size={14} className="mr-2 text-gray-400" />
                                {contact.company}
                              </>
                            )}
                            {!contact.company && <span className="text-gray-500">—</span>}
                          </div>
                        </td>
                      )}
                      {visibleColumns.status && (
                        <td className="py-4 px-4">
                          <span className={`badge badge-${getStatusBadgeColor(contact.status)}`}>
                            {CONTACT_STATUSES.find(s => s.value === contact.status)?.label || contact.status}
                          </span>
                        </td>
                      )}
                      {visibleColumns.type && (
                        <td className="py-4 px-4">
                          <span className={`badge badge-${getTypeBadgeColor(contact.type)}`}>
                            {CONTACT_TYPES.find(t => t.value === contact.type)?.label || contact.type}
                          </span>
                        </td>
                      )}
                      {visibleColumns.accounts && (
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                            {contact.accounts_count || 0}
                          </span>
                        </td>
                      )}
                      {visibleColumns.transactions && (
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-semibold text-sm">
                            {contact.transactions_count || 0}
                          </span>
                        </td>
                      )}
                      {visibleColumns.value && (
                        <td className="py-4 px-4">
                          <div className="flex items-center text-gray-900">
                            <DollarSign size={14} className="mr-1" />
                            {contact.value?.toLocaleString() || 0}
                          </div>
                        </td>
                      )}
                      {visibleColumns.assigned && (
                        <td className="py-4 px-4">
                          {contact.assigned_user ? (
                            <div className="flex items-center">
                              <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center mr-2">
                                <span className="text-white text-xs font-medium">
                                  {contact.assigned_user.first_name[0]}{contact.assigned_user.last_name[0]}
                                </span>
                              </div>
                              <span className="text-sm text-gray-900">{contact.assigned_user.full_name}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Unassigned</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.created && (
                        <td className="py-4 px-4">
                          <div className="text-sm text-gray-600">
                            {format(new Date(contact.created_at), 'MMM d, yyyy')}
                          </div>
                        </td>
                      )}
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setSelectedContact(contact)
                              setShowEditModal(true)
                            }}
                            className="p-1 text-gray-600 hover:text-primary-600"
                            title="Edit Contact"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this contact?')) {
                                deleteMutation.mutate(contact.id)
                              }
                            }}
                            className="p-1 text-gray-600 hover:text-red-600"
                            title="Delete Contact"
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
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} contacts
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