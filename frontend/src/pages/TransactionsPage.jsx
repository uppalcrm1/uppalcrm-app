import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  DollarSign,
  Search,
  Calendar,
  Download,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Eye,
  Edit,
  Trash2,
  FileText
} from 'lucide-react'
import { transactionsAPI } from '../services/api'
import EditTransactionModal from '../components/EditTransactionModal'

// Helper function to format currency
const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

// Helper function to format source
const formatSource = (source) => {
  if (!source) return 'Unknown'

  const sourceMap = {
    'website': 'Website',
    'phone': 'Phone',
    'email': 'Email',
    'referral': 'Referral',
    'walk_in': 'Walk-in',
    'walk-in': 'Walk-in',
    'partner': 'Partner',
    'social_media': 'Social Media',
    'social-media': 'Social Media',
    'other': 'Other'
  }

  return sourceMap[source.toLowerCase()] || source
}

// Helper function to format payment method
const formatPaymentMethod = (method) => {
  if (!method) return 'Unknown'

  const methodMap = {
    'credit_card': 'Credit Card',
    'credit card': 'Credit Card',
    'debit_card': 'Debit Card',
    'debit card': 'Debit Card',
    'paypal': 'PayPal',
    'bank_transfer': 'Bank Transfer',
    'bank transfer': 'Bank Transfer',
    'cash': 'Cash',
    'check': 'Check'
  }

  return methodMap[method.toLowerCase()] || method
}

// Helper function to format date to yyyy-mm-dd
const formatDate = (dateString) => {
  if (!dateString) return 'N/A'

  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'N/A'

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const TransactionsPage = () => {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterMethod, setFilterMethod] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)

  // Fetch transactions on component mount
  useEffect(() => {
    fetchTransactions()
  }, [])

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const response = await transactionsAPI.getTransactions()
      setTransactions(response.transactions || [])
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate statistics
  const stats = {
    totalRevenue: transactions
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0),
    totalTransactions: transactions.length,
    completedTransactions: transactions.filter(t => t.status === 'completed').length,
    pendingTransactions: transactions.filter(t => t.status === 'pending').length,
    failedTransactions: transactions.filter(t => t.status === 'failed').length,
    avgTransaction: 0
  }

  // Calculate average transaction
  if (stats.completedTransactions > 0) {
    stats.avgTransaction = stats.totalRevenue / stats.completedTransactions
  }

  // Calculate this month revenue
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthlyRevenue = transactions
    .filter(t => {
      const transDate = new Date(t.payment_date || t.created_at)
      return t.status === 'completed' && transDate >= firstDayOfMonth
    })
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)

  // Filter transactions
  const filteredTransactions = transactions.filter(transaction => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        (transaction.transaction_id || '').toLowerCase().includes(query) ||
        (transaction.account_name || '').toLowerCase().includes(query) ||
        (transaction.contact_name || '').toLowerCase().includes(query)
      if (!matchesSearch) return false
    }

    // Status filter
    if (filterStatus !== 'all' && transaction.status !== filterStatus) {
      return false
    }

    // Payment method filter
    if (filterMethod !== 'all' && transaction.payment_method !== filterMethod) {
      return false
    }

    // Source filter
    if (filterSource !== 'all' && transaction.source !== filterSource) {
      return false
    }

    return true
  })

  const getStatusBadge = (status) => {
    const badges = {
      completed: {
        class: 'bg-green-100 text-green-800',
        icon: <CheckCircle size={12} className="mr-1" />,
        text: 'Completed'
      },
      pending: {
        class: 'bg-yellow-100 text-yellow-800',
        icon: <Clock size={12} className="mr-1" />,
        text: 'Pending'
      },
      failed: {
        class: 'bg-red-100 text-red-800',
        icon: <XCircle size={12} className="mr-1" />,
        text: 'Failed'
      },
      refunded: {
        class: 'bg-blue-100 text-blue-800',
        icon: <XCircle size={12} className="mr-1" />,
        text: 'Refunded'
      }
    }
    return badges[status] || badges.completed
  }

  const handleView = (id) => {
    console.log('View transaction:', id)
    // TODO: Navigate to transaction details page
  }

  const handleEdit = (transaction) => {
    setSelectedTransaction(transaction)
    setShowEditModal(true)
  }

  const handleEditSuccess = () => {
    setShowEditModal(false)
    setSelectedTransaction(null)
    fetchTransactions() // Refresh the list
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        await transactionsAPI.deleteTransaction(id)
        fetchTransactions() // Refresh the list
      } catch (error) {
        console.error('Error deleting transaction:', error)
        alert('Failed to delete transaction')
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600 mt-1">Track all payment transactions and revenue</p>
        </div>
        <button className="btn btn-primary btn-md">
          <Download size={16} className="mr-2" />
          Export Report
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Revenue */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.totalRevenue)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        {/* Total Transactions */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Transactions</p>
              <p className="text-2xl font-bold text-blue-600">{stats.totalTransactions}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        {/* This Month */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">This Month</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(monthlyRevenue)}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="text-purple-600" size={24} />
            </div>
          </div>
        </div>

        {/* Average Transaction */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Average Transaction</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(stats.avgTransaction)}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-orange-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>

          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            className="input"
          >
            <option value="all">All Methods</option>
            <option value="Credit Card">Credit Card</option>
            <option value="PayPal">PayPal</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cash">Cash</option>
            <option value="Check">Check</option>
          </select>

          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="input"
          >
            <option value="all">All Sources</option>
            <option value="website">Website</option>
            <option value="phone">Phone</option>
            <option value="email">Email</option>
            <option value="referral">Referral</option>
            <option value="walk-in">Walk-in</option>
            <option value="partner">Partner</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card">
        {/* Toolbar */}
        {!loading && filteredTransactions.length > 0 && (
          <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-gray-700" />
              <span className="text-sm font-medium text-gray-700">
                {filteredTransactions.length} {filteredTransactions.length === 1 ? 'Transaction' : 'Transactions'}
              </span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading transactions...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
            <p className="text-gray-600">
              {searchQuery || filterStatus !== 'all' || filterMethod !== 'all' || filterSource !== 'all'
                ? 'Try adjusting your filters'
                : 'Transaction records will appear here once they are created'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Payment Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Transaction ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Account Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Contact Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Source</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Pay Method</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => {
                  const statusBadge = getStatusBadge(transaction.status)
                  return (
                    <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                      {/* Column 1: Payment Date */}
                      <td className="py-4 px-4">
                        <div className="flex items-center text-sm text-gray-900 font-mono">
                          <Calendar size={14} className="mr-2 text-gray-400" />
                          {formatDate(transaction.payment_date)}
                        </div>
                      </td>

                      {/* Column 2: Transaction ID */}
                      <td className="py-4 px-4">
                        <span className="text-sm font-medium text-gray-900">
                          {transaction.transaction_id || 'Unknown'}
                        </span>
                      </td>

                      {/* Column 3: Account Name */}
                      <td className="py-4 px-4">
                        {transaction.account_id ? (
                          <Link
                            to={`/accounts/${transaction.account_id}`}
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {transaction.account_name || 'Unknown Account'}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-500">No account</span>
                        )}
                      </td>

                      {/* Column 4: Contact Name */}
                      <td className="py-4 px-4">
                        {transaction.contact_id ? (
                          <Link
                            to={`/contacts/${transaction.contact_id}`}
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {transaction.contact_name || 'Unknown Contact'}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-500">No contact</span>
                        )}
                      </td>

                      {/* Column 5: Amount */}
                      <td className="py-4 px-4">
                        <span className="text-sm font-semibold text-green-600">
                          {formatCurrency(transaction.amount)}
                        </span>
                      </td>

                      {/* Column 6: Source */}
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-700">
                          {formatSource(transaction.source)}
                        </span>
                      </td>

                      {/* Column 7: Pay Method */}
                      <td className="py-4 px-4">
                        <div className="flex items-center text-sm text-gray-700">
                          <CreditCard size={14} className="mr-2 text-gray-400" />
                          {formatPaymentMethod(transaction.payment_method)}
                        </div>
                      </td>

                      {/* Column 8: Actions */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleView(transaction.id)}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleEdit(transaction)}
                            className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                            title="Edit Transaction"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(transaction.id)}
                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                            title="Delete Transaction"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Transaction Modal */}
      {showEditModal && selectedTransaction && (
        <EditTransactionModal
          transaction={selectedTransaction}
          onClose={() => {
            setShowEditModal(false)
            setSelectedTransaction(null)
          }}
          onSuccess={handleEditSuccess}
          isOpen={showEditModal}
        />
      )}
    </div>
  )
}

export default TransactionsPage
