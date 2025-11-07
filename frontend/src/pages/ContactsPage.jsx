import React, { useState } from 'react'
import {
  UserCheck,
  Plus,
  Search,
  Mail,
  Phone,
  Building2,
  Calendar,
  Edit2,
  Trash2,
  Eye,
  Filter
} from 'lucide-react'
import ColumnSelector from '../components/ColumnSelector'
import InlineEditCell from '../components/InlineEditCell'
import { contactsAPI } from '../services/api'

// Define available columns with metadata
const COLUMN_DEFINITIONS = [
  { key: 'contact', label: 'Contact', description: 'Contact name and email', required: true },
  { key: 'company', label: 'Company', description: 'Company name', required: false },
  { key: 'status', label: 'Status', description: 'Contact status', required: false },
  { key: 'accounts', label: 'Accounts', description: 'Number of accounts', required: false },
  { key: 'spent', label: 'Total Spent', description: 'Total amount spent', required: false },
  { key: 'last_contact', label: 'Last Contact', description: 'Last contact date', required: false }
]

// Default visible columns
const DEFAULT_VISIBLE_COLUMNS = {
  contact: true,
  company: true,
  status: true,
  accounts: true,
  spent: true,
  last_contact: true
}

// Status options for dropdown
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'trial', label: 'Trial' }
]

const ContactsPage = () => {
  const [contacts, setContacts] = useState([])
  const [localContacts, setLocalContacts] = useState([]) // For optimistic updates
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  // Load column visibility from localStorage or use defaults
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('contactspage_visible_columns')
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE_COLUMNS
  })

  // Column visibility handlers
  const handleColumnToggle = (columnKey) => {
    const newVisibleColumns = {
      ...visibleColumns,
      [columnKey]: !visibleColumns[columnKey]
    }
    setVisibleColumns(newVisibleColumns)
    localStorage.setItem('contactspage_visible_columns', JSON.stringify(newVisibleColumns))
  }

  const handleResetColumns = () => {
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    localStorage.setItem('contactspage_visible_columns', JSON.stringify(DEFAULT_VISIBLE_COLUMNS))
  }

  // Inline edit handler with optimistic updates
  const handleFieldUpdate = async (recordId, fieldName, newValue) => {
    // Optimistic update: immediately update local state
    setLocalContacts(prevContacts =>
      prevContacts.map(contact =>
        contact.id === recordId
          ? { ...contact, [fieldName]: newValue }
          : contact
      )
    )

    try {
      // Make API call to update the contact
      await contactsAPI.updateContact(recordId, { [fieldName]: newValue })

      // Also update the main contacts state for consistency
      setContacts(prevContacts =>
        prevContacts.map(contact =>
          contact.id === recordId
            ? { ...contact, [fieldName]: newValue }
            : contact
        )
      )
    } catch (error) {
      // Error is thrown back to InlineEditCell for rollback
      console.error('Failed to update contact:', error)
      throw error
    }
  }

  // Use localContacts for display (optimistic updates), fallback to contacts
  const displayContacts = localContacts.length > 0 ? localContacts : contacts

  // Initialize localContacts when contacts changes
  React.useEffect(() => {
    setLocalContacts(contacts)
  }, [contacts])

  const getStatusBadge = (status) => {
    const badges = {
      active: 'badge badge-success',
      inactive: 'badge badge-gray',
      trial: 'badge badge-warning'
    }
    return badges[status] || 'badge badge-gray'
  }

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      trial: 'bg-yellow-100 text-yellow-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-600 mt-1">Manage your customer contacts</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary btn-md"
        >
          <Plus size={16} className="mr-2" />
          Add Contact
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Contacts</p>
              <p className="text-2xl font-bold text-gray-900">{displayContacts.length}</p>
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <UserCheck className="text-primary-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Contacts</p>
              <p className="text-2xl font-bold text-gray-900">
                {displayContacts.filter(c => c.status === 'active').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <UserCheck className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Accounts</p>
              <p className="text-2xl font-bold text-gray-900">
                {displayContacts.reduce((sum, c) => sum + c.total_accounts, 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${displayContacts.reduce((sum, c) => sum + c.total_spent, 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-purple-600 text-xl font-bold">$</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts by name, email, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input w-full sm:w-48"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="trial">Trial</option>
          </select>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="card">
        {/* Toolbar - Always visible */}
        <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              {displayContacts.length} {displayContacts.length === 1 ? 'Contact' : 'Contacts'}
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

        {displayContacts.length === 0 ? (
          <div className="text-center py-12">
            <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
            <p className="text-gray-600 mb-6">Get started by adding your first contact</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary btn-md"
            >
              <Plus size={16} className="mr-2" />
              Add Contact
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  {visibleColumns.contact && <th className="text-left py-3 px-4 font-medium text-gray-900">Contact</th>}
                  {visibleColumns.company && <th className="text-left py-3 px-4 font-medium text-gray-900">Company</th>}
                  {visibleColumns.status && <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>}
                  {visibleColumns.accounts && <th className="text-left py-3 px-4 font-medium text-gray-900">Accounts</th>}
                  {visibleColumns.spent && <th className="text-left py-3 px-4 font-medium text-gray-900">Total Spent</th>}
                  {visibleColumns.last_contact && <th className="text-left py-3 px-4 font-medium text-gray-900">Last Contact</th>}
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayContacts.map((contact) => (
                  <tr key={contact.id} className="border-b border-gray-100">
                    {visibleColumns.contact && (
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center mr-3">
                            <span className="text-white font-medium">
                              {contact.first_name[0]}{contact.last_name[0]}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 mb-1">
                              {contact.first_name} {contact.last_name}
                            </p>
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              <InlineEditCell
                                value={contact.email}
                                fieldName="email"
                                fieldType="email"
                                recordId={contact.id}
                                entityType="contacts"
                                onSave={handleFieldUpdate}
                                placeholder="Add email..."
                                className="text-xs"
                              />
                            </div>
                            {contact.phone && (
                              <div className="flex items-center gap-1 text-xs text-gray-600 mt-0.5">
                                <Phone className="w-3 h-3" />
                                <a href={`tel:${contact.phone}`} className="hover:text-blue-600">
                                  {contact.phone}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    )}
                    {visibleColumns.company && (
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1">
                          <Building2 size={14} className="text-gray-400 flex-shrink-0" />
                          <InlineEditCell
                            value={contact.company}
                            fieldName="company"
                            fieldType="text"
                            recordId={contact.id}
                            entityType="contacts"
                            onSave={handleFieldUpdate}
                            placeholder="Add company..."
                            className="text-sm"
                          />
                        </div>
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="py-4 px-4">
                        <InlineEditCell
                          value={contact.status}
                          fieldName="status"
                          fieldType="select"
                          recordId={contact.id}
                          entityType="contacts"
                          onSave={handleFieldUpdate}
                          options={STATUS_OPTIONS}
                          displayValue={
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(contact.status)}`}>
                              {STATUS_OPTIONS.find(s => s.value === contact.status)?.label || contact.status}
                            </span>
                          }
                        />
                      </td>
                    )}
                    {visibleColumns.accounts && (
                      <td className="py-4 px-4">
                        <span className="text-gray-900 font-medium">{contact.total_accounts}</span>
                      </td>
                    )}
                    {visibleColumns.spent && (
                      <td className="py-4 px-4">
                        <span className="text-gray-900 font-medium">${contact.total_spent}</span>
                      </td>
                    )}
                    {visibleColumns.last_contact && (
                      <td className="py-4 px-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar size={12} className="mr-1" />
                          {contact.last_contact}
                        </div>
                      </td>
                    )}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <button className="p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded-lg">
                          <Eye size={16} />
                        </button>
                        <button className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Edit2 size={16} />
                        </button>
                        <button className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Contact Modal - Placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Add New Contact</h2>
            <p className="text-gray-600 mb-4">Contact creation form will be implemented here</p>
            <button
              onClick={() => setShowCreateModal(false)}
              className="btn btn-secondary btn-md w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ContactsPage
