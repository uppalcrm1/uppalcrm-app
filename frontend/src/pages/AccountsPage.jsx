import React, { useState } from 'react'
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

const AccountsPage = () => {
  const [accounts, setAccounts] = useState([])
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  // Mock data for demonstration
  const mockAccounts = [
    {
      id: 'ACC001',
      contact_name: 'John Doe',
      contact_email: 'john@example.com',
      software_edition: 'Gold Edition',
      device_name: 'MacBook Pro',
      mac_address: '00:1B:63:84:45:E6',
      status: 'active',
      billing_cycle: 'monthly',
      monthly_cost: 99,
      last_payment_date: '2024-10-01',
      next_renewal_date: '2024-11-01',
      days_until_expiry: 15,
      total_paid: 297
    },
    {
      id: 'ACC002',
      contact_name: 'Jane Smith',
      contact_email: 'jane@example.com',
      software_edition: 'Smart Edition',
      device_name: 'Windows Desktop',
      mac_address: '00:1B:63:84:45:E7',
      status: 'expiring_soon',
      billing_cycle: 'quarterly',
      monthly_cost: 79,
      last_payment_date: '2024-07-15',
      next_renewal_date: '2024-10-20',
      days_until_expiry: 3,
      total_paid: 237
    },
    {
      id: 'ACC003',
      contact_name: 'Bob Wilson',
      contact_email: 'bob@example.com',
      software_edition: 'Jio Edition',
      device_name: 'iPad Pro',
      mac_address: '00:1B:63:84:45:E8',
      status: 'expired',
      billing_cycle: 'annual',
      monthly_cost: 49,
      last_payment_date: '2023-10-10',
      next_renewal_date: '2024-10-10',
      days_until_expiry: -7,
      total_paid: 588
    }
  ]

  const displayAccounts = accounts.length > 0 ? accounts : mockAccounts

  // Calculate statistics
  const stats = {
    totalRevenue: displayAccounts.reduce((sum, acc) => {
      if (acc.status === 'active' || acc.status === 'expiring_soon') {
        return sum + acc.monthly_cost
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
        </div>
      </div>

      {/* Accounts Table */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Users size={20} className="mr-2" />
          Organization Accounts
        </h2>

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
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Account ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Contact</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Software Edition</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Device</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Monthly Cost</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Next Renewal</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayAccounts.map((account) => {
                  const statusBadge = getStatusBadge(account.status, account.days_until_expiry)
                  return (
                    <tr key={account.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm font-medium text-gray-900">
                          {account.id}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{account.contact_name}</p>
                          <p className="text-sm text-gray-600">{account.contact_email}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="badge badge-info">{account.software_edition}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="text-sm text-gray-900">{account.device_name}</p>
                          <p className="text-xs text-gray-500 font-mono">{account.mac_address}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={statusBadge.class}>
                          {statusBadge.icon}
                          {statusBadge.text}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-gray-900 font-semibold">${account.monthly_cost}</span>
                        <span className="text-xs text-gray-500 block">{account.billing_cycle}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center text-sm text-gray-900">
                          <Calendar size={12} className="mr-1" />
                          {account.next_renewal_date}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRecordPayment(account)}
                            className="btn btn-sm btn-primary"
                          >
                            <DollarSign size={14} className="mr-1" />
                            Payment
                          </button>
                          <button className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Eye size={16} />
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
    </div>
  )
}

export default AccountsPage
