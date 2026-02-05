import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { 
  Plus, 
  Building, 
  Edit, 
  Trash2, 
  MapPin, 
  CreditCard, 
  Calendar,
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { contactsAPI } from '../services/api'
import LoadingSpinner from './LoadingSpinner'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const ACCOUNT_STATUSES = [
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'inactive', label: 'Inactive', color: 'gray' },
  { value: 'suspended', label: 'Suspended', color: 'red' },
  { value: 'cancelled', label: 'Cancelled', color: 'red' },
  { value: 'on_hold', label: 'On Hold', color: 'yellow' }
]

const AccountManagement = ({ contactId }) => {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const queryClient = useQueryClient()

  // Fetch accounts
  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['accounts', contactId],
    queryFn: () => contactsAPI.getAccounts(contactId),
  })

  // Create account mutation
  const createMutation = useMutation({
    mutationFn: (accountData) => contactsAPI.createAccount(contactId, accountData),
    onSuccess: () => {
      queryClient.invalidateQueries(['accounts', contactId])
      toast.success('Account created successfully')
      setShowCreateModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create account')
    }
  })

  const accounts = accountsData?.accounts || []

  const getStatusBadgeColor = (status) => {
    const statusConfig = ACCOUNT_STATUSES.find(s => s.value === status)
    return statusConfig ? statusConfig.color : 'gray'
  }

  if (isLoading) {
    return <LoadingSpinner className="py-8" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Software Accounts</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary btn-sm"
        >
          <Plus size={16} className="mr-2" />
          Create Account
        </button>
      </div>

      {/* Accounts List */}
      {accounts.length === 0 ? (
        <div className="text-center py-8">
          <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts found</h3>
          <p className="text-gray-600 mb-6">Create software accounts to manage billing and licensing</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary btn-md"
          >
            <Plus size={16} className="mr-2" />
            Create Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {accounts.map((account) => (
            <div key={account.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center mr-3">
                    <Building className="text-white" size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{account.account_name}</h4>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`badge badge-${getStatusBadgeColor(account.account_status)}`}>
                    {ACCOUNT_STATUSES.find(s => s.value === account.account_status)?.label || account.account_status}
                  </span>
                  <button
                    onClick={() => setSelectedAccount(account)}
                    className="p-1 text-gray-600 hover:text-primary-600"
                  >
                    <Edit size={16} />
                  </button>
                </div>
              </div>

              {/* Account Details */}
              <div className="space-y-3 text-sm">
                {/* Contact Info */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Contact:</span>
                  <span className="text-gray-900">{account.first_name} {account.last_name}</span>
                </div>

                {/* Payment Terms */}
                {account.payment_terms && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Payment Terms:</span>
                    <span className="text-gray-900">{account.payment_terms}</span>
                  </div>
                )}

                {/* Credit Limit */}
                {account.credit_limit > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Credit Limit:</span>
                    <span className="text-gray-900">${account.credit_limit.toLocaleString()}</span>
                  </div>
                )}

                {/* Addresses */}
                {account.billing_address && Object.keys(account.billing_address).length > 0 && (
                  <div>
                    <span className="text-gray-600 block mb-1">Billing Address:</span>
                    <div className="text-gray-900 text-xs bg-gray-50 p-2 rounded">
                      <AddressDisplay address={account.billing_address} />
                    </div>
                  </div>
                )}

                {account.shipping_address && Object.keys(account.shipping_address).length > 0 && (
                  <div>
                    <span className="text-gray-600 block mb-1">Shipping Address:</span>
                    <div className="text-gray-900 text-xs bg-gray-50 p-2 rounded">
                      <AddressDisplay address={account.shipping_address} />
                    </div>
                  </div>
                )}

                {/* Created Date */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-gray-600">Created:</span>
                  <span className="text-gray-900">{format(new Date(account.created_at), 'MMM d, yyyy')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Account Modal */}
      {showCreateModal && (
        <CreateAccountModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
        />
      )}

      {/* Edit Account Modal */}
      {selectedAccount && (
        <EditAccountModal
          account={selectedAccount}
          onClose={() => setSelectedAccount(null)}
          onSubmit={(data) => {
            // Would implement update functionality here
            toast.info('Account update functionality coming soon')
            setSelectedAccount(null)
          }}
          isLoading={false}
        />
      )}
    </div>
  )
}

// Helper component to display addresses
const AddressDisplay = ({ address }) => {
  const parts = [
    address.street,
    [address.city, address.state].filter(Boolean).join(', '),
    address.zip_code,
    address.country
  ].filter(Boolean)

  return (
    <div className="space-y-1">
      {parts.map((part, index) => (
        <div key={index}>{part}</div>
      ))}
    </div>
  )
}

// Create Account Modal
const CreateAccountModal = ({ onClose, onSubmit, isLoading }) => {
  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    defaultValues: {
      account_status: 'active',
      credit_limit: 0
    }
  })

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block w-full max-w-2xl px-6 py-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Create Software Account</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Account Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Name *</label>
                <input
                  {...register('account_name', { required: 'Account name is required' })}
                  className={`input ${errors.account_name ? 'border-red-500' : ''}`}
                  placeholder="Acme Inc - Software License Account"
                />
                {errors.account_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.account_name.message}</p>
                )}
              </div>

              {/* Account Status */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Status</label>
                <select {...register('account_status')} className="select">
                  {ACCOUNT_STATUSES.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>

              {/* Payment Terms */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms</label>
                <input
                  {...register('payment_terms')}
                  className="input"
                  placeholder="Net 30, COD, etc."
                />
              </div>

              {/* Credit Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Credit Limit ($)</label>
                <input
                  {...register('credit_limit', {
                    min: { value: 0, message: 'Credit limit must be positive' }
                  })}
                  type="number"
                  min="0"
                  step="0.01"
                  className={`input ${errors.credit_limit ? 'border-red-500' : ''}`}
                  placeholder="0"
                />
                {errors.credit_limit && (
                  <p className="mt-1 text-sm text-red-600">{errors.credit_limit.message}</p>
                )}
              </div>
            </div>

            {/* Billing Address */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Billing Address</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Street</label>
                  <input
                    {...register('billing_address.street')}
                    className="input"
                    placeholder="123 Main Street"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input
                    {...register('billing_address.city')}
                    className="input"
                    placeholder="San Francisco"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <input
                    {...register('billing_address.state')}
                    className="input"
                    placeholder="CA"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code</label>
                  <input
                    {...register('billing_address.zip_code')}
                    className="input"
                    placeholder="94102"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <input
                    {...register('billing_address.country')}
                    className="input"
                    placeholder="United States"
                  />
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Shipping Address</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Street</label>
                  <input
                    {...register('shipping_address.street')}
                    className="input"
                    placeholder="123 Main Street"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input
                    {...register('shipping_address.city')}
                    className="input"
                    placeholder="San Francisco"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <input
                    {...register('shipping_address.state')}
                    className="input"
                    placeholder="CA"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code</label>
                  <input
                    {...register('shipping_address.zip_code')}
                    className="input"
                    placeholder="94102"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <input
                    {...register('shipping_address.country')}
                    className="input"
                    placeholder="United States"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary btn-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary btn-md"
              >
                {isLoading ? <LoadingSpinner size="sm" /> : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Edit Account Modal (simplified - would implement full edit functionality)
const EditAccountModal = ({ account, onClose, onSubmit, isLoading }) => {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block w-full max-w-md px-6 py-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Edit Account</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <div className="text-center py-4">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">{account.account_name}</h4>
            <p className="text-gray-600 mb-6">Account editing functionality coming soon</p>
            <button onClick={onClose} className="btn btn-primary btn-md">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AccountManagement