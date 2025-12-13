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
  { key: 'name', label: 'Name', description: 'Customer full name', required: true },
  { key: 'email', label: 'Email', description: 'Customer email address', required: false },
  { key: 'phone', label: 'Phone', description: 'Customer phone number', required: false },
  { key: 'accounts', label: 'Accounts', description: 'Number of software licenses', required: false },
  { key: 'transactions', label: 'Transactions', description: 'Total number of purchases', required: false },
  { key: 'total_revenue', label: 'Total Revenue', description: 'Lifetime customer value', required: false },
  { key: 'customer_since', label: 'Customer Since', description: 'First purchase date', required: false },
  { key: 'last_contact', label: 'Last Contact', description: 'Last interaction date', required: false },
  { key: 'next_renewal', label: 'Next Renewal', description: 'Upcoming license expiry', required: false }
]

// Default visible columns
const DEFAULT_VISIBLE_COLUMNS = {
  name: true,
  email: true,
  phone: true,
  accounts: true,
  transactions: true,
  total_revenue: true,
  customer_since: true,
  last_contact: true,
  next_renewal: true
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
  const [stats, setStats] = useState(null) // Statistics from backend

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

  // Fetch contacts on component mount
  React.useEffect(() => {
    const fetchContacts = async () => {
      try {
        const response = await contactsAPI.getContacts()
        setContacts(response.contacts || [])
      } catch (error) {
        console.error('Error fetching contacts:', error)
      }
    }
    fetchContacts()
  }, [])

  // Fetch stats on component mount
  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await contactsAPI.getStats()
        setStats(response.stats)
      } catch (error) {
        console.error('Error fetching stats:', error)
      }
    }
    fetchStats()
  }, [])

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
              <p className="text-2xl font-bold text-gray-900">
                {stats?.total_contacts || displayContacts.length}
              </p>
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
                {stats?.active_contacts || displayContacts.filter(c => c.status === 'active').length}
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
                {stats?.total_accounts || 0}
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
                {stats?.total_revenue
                  ? `$${parseFloat(stats.total_revenue).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}`
                  : '$0.00'
                }
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
                  {visibleColumns.name && <th className="text-left py-3 px-4 font-medium text-gray-900">Name</th>}
                  {visibleColumns.email && <th className="text-left py-3 px-4 font-medium text-gray-900">Email</th>}
                  {visibleColumns.phone && <th className="text-left py-3 px-4 font-medium text-gray-900">Phone</th>}
                  {visibleColumns.accounts && <th className="text-center py-3 px-4 font-medium text-gray-900">Accounts</th>}
                  {visibleColumns.transactions && <th className="text-center py-3 px-4 font-medium text-gray-900">Transactions</th>}
                  {visibleColumns.total_revenue && <th className="text-left py-3 px-4 font-medium text-gray-900">Total Revenue</th>}
                  {visibleColumns.customer_since && <th className="text-left py-3 px-4 font-medium text-gray-900">Customer Since</th>}
                  {visibleColumns.last_contact && <th className="text-left py-3 px-4 font-medium text-gray-900">Last Contact</th>}
                  {visibleColumns.next_renewal && <th className="text-left py-3 px-4 font-medium text-gray-900">Next Renewal</th>}
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayContacts.map((contact) => {
                  // Helper functions for formatting
                  const formatCurrency = (amount) => {
                    if (!amount || isNaN(amount)) return '$0.00';
                    return parseFloat(amount).toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD'
                    });
                  };

                  const formatCustomerSince = (date) => {
                    if (!date) return 'N/A';
                    return new Date(date).toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric'
                    });
                  };

                  const formatRelativeTime = (date) => {
                    if (!date) return 'Never';
                    const now = new Date();
                    const past = new Date(date);
                    const diffMs = now - past;
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                    if (diffDays === 0) return 'Today';
                    if (diffDays === 1) return '1 day ago';
                    if (diffDays < 7) return `${diffDays} days ago`;
                    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
                    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
                    return `${Math.floor(diffDays / 365)} years ago`;
                  };

                  const getRenewalColor = (days) => {
                    if (!days || days < 0) return 'text-gray-500';
                    if (days <= 14) return 'text-red-600 font-bold';
                    if (days <= 30) return 'text-yellow-600 font-semibold';
                    return 'text-green-600';
                  };

                  const formatRenewal = (days) => {
                    if (!days || days < 0) return 'N/A';
                    if (days === 0) return 'Today';
                    if (days === 1) return '1 day';
                    return `${days} days`;
                  };

                  return (
                    <tr key={contact.id} className="border-b border-gray-100 hover:bg-gray-50">
                      {visibleColumns.name && (
                        <td className="py-4 px-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center mr-3">
                              <span className="text-white font-medium text-sm">
                                {contact.first_name?.[0]}{contact.last_name?.[0]}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {contact.first_name} {contact.last_name}
                              </p>
                            </div>
                          </div>
                        </td>
                      )}

                      {visibleColumns.email && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            {contact.email || 'N/A'}
                          </div>
                        </td>
                      )}

                      {visibleColumns.phone && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            {contact.phone || 'N/A'}
                          </div>
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

                      {visibleColumns.total_revenue && (
                        <td className="py-4 px-4">
                          <span className="text-gray-900 font-semibold">
                            {formatCurrency(contact.total_revenue)}
                          </span>
                        </td>
                      )}

                      {visibleColumns.customer_since && (
                        <td className="py-4 px-4 text-sm text-gray-600">
                          {formatCustomerSince(contact.customer_since)}
                        </td>
                      )}

                      {visibleColumns.last_contact && (
                        <td className="py-4 px-4">
                          <div className="flex items-center text-sm text-gray-600">
                            <Calendar size={14} className="mr-1 text-gray-400 flex-shrink-0" />
                            {formatRelativeTime(contact.last_interaction_date)}
                          </div>
                        </td>
                      )}

                      {visibleColumns.next_renewal && (
                        <td className="py-4 px-4">
                          <span className={getRenewalColor(contact.days_until_renewal)}>
                            {formatRenewal(contact.days_until_renewal)}
                          </span>
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
                  );
                })}
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
