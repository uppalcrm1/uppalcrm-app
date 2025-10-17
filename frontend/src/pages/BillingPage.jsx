import React, { useState } from 'react'
import {
  DollarSign,
  Search,
  Calendar,
  Download,
  Filter,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  FileText
} from 'lucide-react'

const BillingPage = () => {
  const [payments, setPayments] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterMethod, setFilterMethod] = useState('all')
  const [dateRange, setDateRange] = useState('all')

  // Mock payment data
  const mockPayments = [
    {
      id: 'PAY001',
      account_id: 'ACC001',
      contact_name: 'John Doe',
      contact_email: 'john@example.com',
      amount: 99,
      payment_date: '2024-10-01',
      payment_method: 'Credit Card',
      billing_cycle: 'monthly',
      status: 'completed',
      transaction_id: 'TXN-2024-001',
      notes: 'Renewal payment'
    },
    {
      id: 'PAY002',
      account_id: 'ACC002',
      contact_name: 'Jane Smith',
      contact_email: 'jane@example.com',
      amount: 237,
      payment_date: '2024-09-15',
      payment_method: 'PayPal',
      billing_cycle: 'quarterly',
      status: 'completed',
      transaction_id: 'TXN-2024-002',
      notes: 'Quarterly subscription'
    },
    {
      id: 'PAY003',
      account_id: 'ACC001',
      contact_name: 'John Doe',
      contact_email: 'john@example.com',
      amount: 99,
      payment_date: '2024-09-01',
      payment_method: 'Credit Card',
      billing_cycle: 'monthly',
      status: 'completed',
      transaction_id: 'TXN-2024-003',
      notes: 'Monthly renewal'
    },
    {
      id: 'PAY004',
      account_id: 'ACC003',
      contact_name: 'Bob Wilson',
      contact_email: 'bob@example.com',
      amount: 588,
      payment_date: '2024-08-10',
      payment_method: 'Bank Transfer',
      billing_cycle: 'annual',
      status: 'pending',
      transaction_id: 'TXN-2024-004',
      notes: 'Annual subscription - awaiting confirmation'
    },
    {
      id: 'PAY005',
      account_id: 'ACC004',
      contact_name: 'Alice Johnson',
      contact_email: 'alice@example.com',
      amount: 149,
      payment_date: '2024-08-05',
      payment_method: 'Credit Card',
      billing_cycle: 'monthly',
      status: 'failed',
      transaction_id: 'TXN-2024-005',
      notes: 'Payment declined - card expired'
    }
  ]

  const displayPayments = payments.length > 0 ? payments : mockPayments

  // Calculate statistics
  const stats = {
    totalRevenue: displayPayments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0),
    completedPayments: displayPayments.filter(p => p.status === 'completed').length,
    pendingPayments: displayPayments.filter(p => p.status === 'pending').length,
    failedPayments: displayPayments.filter(p => p.status === 'failed').length,
    avgPayment: displayPayments.filter(p => p.status === 'completed').length > 0
      ? displayPayments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0) /
        displayPayments.filter(p => p.status === 'completed').length
      : 0
  }

  const getStatusBadge = (status) => {
    const badges = {
      completed: {
        class: 'badge badge-success',
        icon: <CheckCircle size={12} className="mr-1" />,
        text: 'Completed'
      },
      pending: {
        class: 'badge badge-warning',
        icon: <Clock size={12} className="mr-1" />,
        text: 'Pending'
      },
      failed: {
        class: 'badge badge-danger',
        icon: <XCircle size={12} className="mr-1" />,
        text: 'Failed'
      }
    }
    return badges[status] || badges.completed
  }

  const getPaymentMethodIcon = (method) => {
    return <CreditCard size={14} className="mr-1" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Payments</h1>
          <p className="text-gray-600 mt-1">Track all payment transactions and revenue</p>
        </div>
        <button className="btn btn-primary btn-md">
          <Download size={16} className="mr-2" />
          Export Report
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600">
                ${stats.totalRevenue.toFixed(2)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Completed</p>
              <p className="text-2xl font-bold text-blue-600">{stats.completedPayments}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pendingPayments}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="text-yellow-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Payment</p>
              <p className="text-2xl font-bold text-purple-600">
                ${stats.avgPayment.toFixed(2)}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-purple-600" size={24} />
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
              placeholder="Search by contact or account..."
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
          </select>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="input"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <FileText size={20} className="mr-2" />
          Payment History
        </h2>

        {displayPayments.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No payments found</h3>
            <p className="text-gray-600">Payment records will appear here once they are recorded</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Payment ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Contact</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Account</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Method</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Cycle</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayPayments.map((payment) => {
                  const statusBadge = getStatusBadge(payment.status)
                  return (
                    <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm font-medium text-gray-900">
                          {payment.id}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{payment.contact_name}</p>
                          <p className="text-sm text-gray-600">{payment.contact_email}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm text-gray-700">{payment.account_id}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-lg font-bold text-green-600">
                          ${payment.amount}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center text-sm text-gray-900">
                          <Calendar size={12} className="mr-1" />
                          {payment.payment_date}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center text-sm text-gray-700">
                          {getPaymentMethodIcon(payment.payment_method)}
                          {payment.payment_method}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="badge badge-gray">
                          {payment.billing_cycle}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={statusBadge.class}>
                          {statusBadge.icon}
                          {statusBadge.text}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <button className="btn btn-sm btn-outline">
                          View Details
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination placeholder */}
        {displayPayments.length > 0 && (
          <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-600">
              Showing {displayPayments.length} payment(s)
            </p>
            <div className="flex gap-2">
              <button className="btn btn-sm btn-outline" disabled>Previous</button>
              <button className="btn btn-sm btn-outline" disabled>Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity Summary */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Summary</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="text-green-600 mr-3" size={20} />
              <div>
                <p className="font-medium text-gray-900">Completed Payments</p>
                <p className="text-sm text-gray-600">{stats.completedPayments} transactions</p>
              </div>
            </div>
            <p className="text-lg font-bold text-green-600">${stats.totalRevenue.toFixed(2)}</p>
          </div>

          {stats.pendingPayments > 0 && (
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center">
                <Clock className="text-yellow-600 mr-3" size={20} />
                <div>
                  <p className="font-medium text-gray-900">Pending Payments</p>
                  <p className="text-sm text-gray-600">Awaiting confirmation</p>
                </div>
              </div>
              <p className="text-lg font-bold text-yellow-600">{stats.pendingPayments}</p>
            </div>
          )}

          {stats.failedPayments > 0 && (
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center">
                <XCircle className="text-red-600 mr-3" size={20} />
                <div>
                  <p className="font-medium text-gray-900">Failed Payments</p>
                  <p className="text-sm text-gray-600">Requires attention</p>
                </div>
              </div>
              <p className="text-lg font-bold text-red-600">{stats.failedPayments}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BillingPage
