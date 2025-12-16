import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CreditCard,
  Plus,
  Search,
  DollarSign,
  Users,
  Calendar,
  Edit2,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  Filter
} from 'lucide-react'
import ColumnSelector from '../components/ColumnSelector'
import InlineEditCell from '../components/InlineEditCell'
import CreateTransactionModal from '../components/CreateTransactionModal'
import { AccountActions } from '../components/accounts/AccountActions'
import { accountsAPI } from '../services/api'
import toast from 'react-hot-toast'

// Define available columns with metadata (10 columns as per spec)
const COLUMN_DEFINITIONS = [
  { key: 'account_name', label: 'Account Name', description: 'Custom account name', required: true },
  { key: 'mac_address', label: 'MAC Address', description: 'Device MAC address', required: false },
  { key: 'device', label: 'Device', description: 'Device name/type', required: false },
  { key: 'product', label: 'Product', description: 'Product type (Gold, Jio, Smart)', required: false },
  { key: 'contact', label: 'Contact', description: 'Customer name', required: false },
  { key: 'accounts_count', label: 'Accounts', description: 'Total accounts for contact', required: false },
  { key: 'transactions_count', label: 'Transactions', description: 'Transactions for this account', required: false },
  { key: 'created_date', label: 'Created Date', description: 'Account creation date', required: false },
  { key: 'next_renewal', label: 'Next Renewal', description: 'Renewal date', required: false },
  { key: 'actions', label: 'Actions', description: 'Account actions', required: true }
]

// Default visible columns
const DEFAULT_VISIBLE_COLUMNS = {
  account_name: true,
  mac_address: true,
  device: true,
  product: true,
  contact: true,
  accounts_count: true,
  transactions_count: true,
  created_date: true,
  next_renewal: true,
  actions: true
}

// Product options (internal variable name can stay as SOFTWARE_EDITION_OPTIONS for database compatibility)
const SOFTWARE_EDITION_OPTIONS = [
  { value: 'gold', label: 'Gold' },
  { value: 'smart', label: 'Smart' },
  { value: 'jio', label: 'Jio' }
]

// Status options
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'expiring_soon', label: 'Expiring Soon' },
  { value: 'expired', label: 'Expired' }
]

// Billing cycle options
const BILLING_CYCLE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi-annual', label: 'Semi-Annual' },
  { value: 'annual', label: 'Annual' }
]

// Helper function to format dates
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Helper function to get renewal date color based on days until renewal
const getRenewalColor = (daysUntil) => {
  if (daysUntil == null) return 'text-gray-400';
  if (daysUntil <= 7) return 'text-red-600 font-semibold';
  if (daysUntil <= 30) return 'text-yellow-600 font-medium';
  return 'text-green-600';
}

const AccountsPage = () => {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [localAccounts, setLocalAccounts] = useState([]) // For optimistic updates
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [showCreateTransactionModal, setShowCreateTransactionModal] = useState(false)
  const [selectedAccountForTransaction, setSelectedAccountForTransaction] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showDeleted, setShowDeleted] = useState(false)

  // Load column visibility from localStorage or use defaults
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('accounts_visible_columns')
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE_COLUMNS
  })

  // Column visibility handlers
  const handleColumnToggle = (columnKey) => {
    const newVisibleColumns = {
      ...visibleColumns,
      [columnKey]: !visibleColumns[columnKey]
    }
    setVisibleColumns(newVisibleColumns)
    localStorage.setItem('accounts_visible_columns', JSON.stringify(newVisibleColumns))
  }

  const handleResetColumns = () => {
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    localStorage.setItem('accounts_visible_columns', JSON.stringify(DEFAULT_VISIBLE_COLUMNS))
  }

  // Inline edit handler with optimistic updates
  const handleFieldUpdate = async (recordId, fieldName, newValue) => {
    // Optimistic update: immediately update local state
    setLocalAccounts(prevAccounts =>
      prevAccounts.map(account =>
        account.id === recordId
          ? { ...account, [fieldName]: newValue }
          : account
      )
    )

    try {
      // Make API call to update the account
      await accountsAPI.updateAccount(recordId, { [fieldName]: newValue })

      // Also update the main accounts state for consistency
      setAccounts(prevAccounts =>
        prevAccounts.map(account =>
          account.id === recordId
            ? { ...account, [fieldName]: newValue }
            : account
        )
      )
    } catch (error) {
      // Error is thrown back to InlineEditCell for rollback
      console.error('Failed to update account:', error)
      throw error
    }
  }

  // Soft delete handler
  const handleDeleteAccount = async (accountId, reason) => {
    try {
      await accountsAPI.softDeleteAccount(accountId, reason)
      // Refresh accounts list
      await fetchAccounts()
    } catch (error) {
      throw error // Let component handle error
    }
  }

  // Restore account handler
  const handleRestoreAccount = async (accountId) => {
    try {
      await accountsAPI.restoreAccount(accountId)
      // Refresh accounts list
      await fetchAccounts()
    } catch (error) {
      throw error // Let component handle error
    }
  }

  // Use localAccounts for display (optimistic updates), fallback to accounts
  const displayAccounts = localAccounts.length > 0 ? localAccounts : accounts

  // Initialize localAccounts when accounts changes
  React.useEffect(() => {
    setLocalAccounts(accounts)
  }, [accounts])

  // Fetch accounts function (moved outside useEffect to be callable)
  const fetchAccounts = React.useCallback(async () => {
    try {
      const response = await accountsAPI.getAccounts(showDeleted)
      console.log('API Response:', response)
      // Backend can return either 'accounts' or 'subscriptions' depending on endpoint
      const accountsData = response.accounts || response.subscriptions || []
      console.log('Accounts data:', accountsData)
      console.log('Accounts length:', accountsData.length)
      setAccounts(accountsData)
    } catch (error) {
      console.error('Error fetching accounts:', error)
    }
  }, [showDeleted])

  // Fetch accounts on component mount and when showDeleted changes
  React.useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  // Calculate statistics
  const stats = {
    totalRevenue: displayAccounts.reduce((sum, acc) => {
      if (acc.status === 'active' || acc.status === 'expiring_soon') {
        return sum + (parseFloat(acc.price) || 0)
      }
      return sum
    }, 0),
    totalAccounts: displayAccounts.length,
    activeUsers: displayAccounts.filter(acc => acc.status === 'active').length
  }

  const getStatusBadge = (status, daysUntilExpiry) => {
    if (status === 'active' && daysUntilExpiry > 7) {
      return {
        class: 'badge badge-success',
        icon: <CheckCircle size={12} className="mr-1" />,
        text: 'Active'
      }
    } else if (status === 'active' || status === 'expiring_soon') {
      return {
        class: 'badge badge-warning',
        icon: <Clock size={12} className="mr-1" />,
        text: `Expires in ${daysUntilExpiry}d`
      }
    } else {
      return {
        class: 'badge badge-danger',
        icon: <AlertCircle size={12} className="mr-1" />,
        text: 'Expired'
      }
    }
  }

  const handleRecordPayment = (account) => {
    setSelectedAccount(account)
    setShowPaymentModal(true)
  }

  const handleCreateTransaction = (account) => {
    // Validate account has contact
    if (!account.contact_id) {
      toast.error('Cannot create transaction: Account has no associated contact')
      return
    }
    setSelectedAccountForTransaction(account)
    setShowCreateTransactionModal(true)
  }

  const handleTransactionCreated = () => {
    setShowCreateTransactionModal(false)
    setSelectedAccountForTransaction(null)
    toast.success('Transaction created successfully')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Account Management</h1>
          <p className="text-gray-600 mt-1">Track software licenses, device registrations, and billing for customer accounts</p>
        </div>
        <button
          onClick={() => setShowPaymentModal(true)}
          className="btn btn-primary btn-md"
        >
          <DollarSign size={16} className="mr-2" />
          Record Payment
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Monthly Revenue</p>
              <p className="text-3xl font-bold text-green-600">${stats.totalRevenue.toFixed(2)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Accounts</p>
              <p className="text-3xl font-bold text-blue-600">{stats.totalAccounts}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <CreditCard className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Users</p>
              <p className="text-3xl font-bold text-purple-600">{stats.activeUsers}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="text-purple-600" size={24} />
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
              placeholder="Search accounts by contact, device, or MAC address..."
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
            <option value="expiring_soon">Expiring Soon</option>
            <option value="expired">Expired</option>
          </select>
          <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Show deleted</span>
          </label>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="card">
        {/* Toolbar */}
        {displayAccounts.length > 0 && (
          <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-gray-700" />
              <span className="text-sm font-medium text-gray-700">
                {displayAccounts.length} {displayAccounts.length === 1 ? 'Account' : 'Accounts'}
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
        )}

        {displayAccounts.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts found</h3>
            <p className="text-gray-600 mb-6">Start by recording your first account payment</p>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="btn btn-primary btn-md"
            >
              <DollarSign size={16} className="mr-2" />
              Record Payment
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  {visibleColumns.account_name && <th className="text-left py-3 px-4 font-medium text-gray-900">Account Name</th>}
                  {visibleColumns.mac_address && <th className="text-left py-3 px-4 font-medium text-gray-900">MAC Address</th>}
                  {visibleColumns.device && <th className="text-left py-3 px-4 font-medium text-gray-900">Device</th>}
                  {visibleColumns.product && <th className="text-left py-3 px-4 font-medium text-gray-900">Product</th>}
                  {visibleColumns.contact && <th className="text-left py-3 px-4 font-medium text-gray-900">Contact</th>}
                  {visibleColumns.accounts_count && <th className="text-center py-3 px-4 font-medium text-gray-900">Accounts</th>}
                  {visibleColumns.transactions_count && <th className="text-center py-3 px-4 font-medium text-gray-900">Transactions</th>}
                  {visibleColumns.created_date && <th className="text-left py-3 px-4 font-medium text-gray-900">Created Date</th>}
                  {visibleColumns.next_renewal && <th className="text-left py-3 px-4 font-medium text-gray-900">Next Renewal</th>}
                  {visibleColumns.actions && <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {displayAccounts.map((account) => {
                  const renewalColor = getRenewalColor(account.days_until_renewal)
                  return (
                    <tr key={account.id} className="border-b border-gray-100 hover:bg-gray-50">
                      {/* Column 1: Account Name */}
                      {visibleColumns.account_name && (
                        <td className="py-4 px-4">
                          <button
                            onClick={() => navigate(`/accounts/${account.id}`)}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                          >
                            {account.account_name || 'Unnamed Account'}
                          </button>
                        </td>
                      )}

                      {/* Column 2: MAC Address */}
                      {visibleColumns.mac_address && (
                        <td className="py-4 px-4">
                          <span className="font-mono text-sm text-gray-700">
                            {account.mac_address || 'N/A'}
                          </span>
                        </td>
                      )}

                      {/* Column 3: Device */}
                      {visibleColumns.device && (
                        <td className="py-4 px-4">
                          <span className="text-gray-900">
                            {account.device_name || 'Unknown Device'}
                          </span>
                        </td>
                      )}

                      {/* Column 4: Product */}
                      {visibleColumns.product && (
                        <td className="py-4 px-4">
                          <span className="font-medium text-blue-600">
                            {account.edition_name || account.edition || 'N/A'}
                          </span>
                        </td>
                      )}

                      {/* Column 5: Contact (clickable) */}
                      {visibleColumns.contact && (
                        <td className="py-4 px-4">
                          <a
                            href={`/contacts/${account.contact_id}`}
                            className="text-blue-600 hover:underline font-medium"
                          >
                            {account.contact_name || `${account.first_name || ''} ${account.last_name || ''}`.trim() || 'Unknown Contact'}
                          </a>
                        </td>
                      )}

                      {/* Column 6: Total Accounts for Contact */}
                      {visibleColumns.accounts_count && (
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                            {account.total_accounts_for_contact || 0}
                          </span>
                        </td>
                      )}

                      {/* Column 7: Transactions for THIS Account */}
                      {visibleColumns.transactions_count && (
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-semibold text-sm">
                            {account.transaction_count || 0}
                          </span>
                        </td>
                      )}

                      {/* Column 8: Created Date */}
                      {visibleColumns.created_date && (
                        <td className="py-4 px-4">
                          <span className="text-gray-600 text-sm">
                            {formatDate(account.created_at)}
                          </span>
                        </td>
                      )}

                      {/* Column 9: Next Renewal with Color Coding */}
                      {visibleColumns.next_renewal && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1">
                            <Calendar size={14} className={renewalColor} />
                            <span className={`text-sm ${renewalColor}`}>
                              {account.next_renewal_date ? formatDate(account.next_renewal_date) : 'N/A'}
                            </span>
                            {account.days_until_renewal != null && (
                              <span className="text-xs text-gray-500 ml-1">
                                ({Math.round(account.days_until_renewal)}d)
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Column 10: Actions */}
                      {visibleColumns.actions && (
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCreateTransaction(account)}
                              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Create Transaction"
                            >
                              <Plus size={16} />
                            </button>
                            <button
                              onClick={() => handleRecordPayment(account)}
                              className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg"
                              title="Record Payment"
                            >
                              <DollarSign size={16} />
                            </button>
                            <button
                              onClick={() => navigate(`/accounts/${account.id}`)}
                              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                            <AccountActions
                              account={account}
                              onDelete={handleDeleteAccount}
                              onRestore={handleRestoreAccount}
                              onRefresh={fetchAccounts}
                            />
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <DollarSign size={20} className="mr-2" />
              Record Payment
            </h2>

            {selectedAccount && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Account</p>
                <p className="font-medium">{selectedAccount.id} - {selectedAccount.contact_name}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-500">$</span>
                  <input
                    type="number"
                    placeholder="99.00"
                    className="input pl-8"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Date
                </label>
                <input
                  type="date"
                  className="input"
                  defaultValue={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select className="input">
                  <option>Credit Card</option>
                  <option>PayPal</option>
                  <option>Bank Transfer</option>
                  <option>Cash</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Billing Cycle
                </label>
                <select className="input">
                  <option>Monthly</option>
                  <option>Quarterly</option>
                  <option>Semi-Annual</option>
                  <option>Annual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  className="input"
                  rows="3"
                  placeholder="Add any notes about this payment..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="btn btn-secondary btn-md flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert('Payment recorded successfully!')
                  setShowPaymentModal(false)
                }}
                className="btn btn-primary btn-md flex-1"
              >
                <CheckCircle size={16} className="mr-2" />
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Transaction Modal */}
      {showCreateTransactionModal && selectedAccountForTransaction && (
        <CreateTransactionModal
          account={selectedAccountForTransaction}
          onClose={() => {
            setShowCreateTransactionModal(false)
            setSelectedAccountForTransaction(null)
          }}
          onSuccess={handleTransactionCreated}
          isOpen={showCreateTransactionModal}
        />
      )}
    </div>
  )
}

export default AccountsPage
