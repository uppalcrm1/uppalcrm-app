import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, UserCheck, CreditCard, Package, DollarSign } from 'lucide-react'
import { productsAPI } from '../services/api'
import LoadingSpinner from './LoadingSpinner'
import { BILLING_TERMS } from '../constants/transactions'

const LeadConversionModal = ({ lead, onClose, onConvert, isConverting }) => {
  const [createAccount, setCreateAccount] = useState(false)
  const [formData, setFormData] = useState({
    accountName: '',
    edition: '',
    deviceName: '',
    macAddress: '',
    term: '1', // Standardized: numeric months (1 = Monthly)
    price: '',
    productId: '',
    // Transaction fields
    paymentMethod: 'Credit Card',
    amount: ''
  })

  // Fetch active products - always fresh data, no caching
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', { active: true }],
    queryFn: () => productsAPI.getProducts(false), // false = only active products
    staleTime: 0, // Data is immediately stale - always refetch
    cacheTime: 0, // Don't cache the data
    refetchOnMount: 'always', // Always refetch when modal opens
    refetchOnWindowFocus: true // Refetch when window gains focus
  })

  const products = productsData?.products || []
  const defaultProduct = products.find(p => p.is_default)

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleProductChange = (e) => {
    const productId = e.target.value
    const selectedProduct = products.find(p => p.id === productId)

    setFormData(prev => ({
      ...prev,
      productId,
      price: selectedProduct?.price || '',
      edition: selectedProduct?.name || '',
      amount: selectedProduct?.price || '' // Auto-fill transaction amount
    }))
  }


  const handleSubmit = (e) => {
    e.preventDefault()

    const conversionData = {
      relationshipType: 'new_customer',
      createAccount,
      accountDetails: createAccount ? {
        accountName: formData.accountName || `${lead.first_name} ${lead.last_name}'s Account`,
        edition: formData.edition,
        deviceName: formData.deviceName,
        macAddress: formData.macAddress,
        term: formData.term, // Standardized: numeric months
        price: parseFloat(formData.price) || 0,
        productId: formData.productId || defaultProduct?.id || null
      } : undefined,
      transactionDetails: createAccount ? {
        paymentMethod: formData.paymentMethod,
        term: formData.term, // Standardized: numeric months
        amount: parseFloat(formData.amount) || 0,
        currency: 'USD',
        status: 'completed'
      } : undefined
    }

    onConvert(conversionData)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <div className="inline-block w-full max-w-2xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white rounded-lg shadow-xl">
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="bg-white px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Convert Lead to Contact</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {lead.first_name} {lead.last_name}
                    {lead.company && ` - ${lead.company}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="bg-white px-6 py-4 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Create Account Toggle */}
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="createAccount"
                    type="checkbox"
                    checked={createAccount}
                    onChange={(e) => setCreateAccount(e.target.checked)}
                    className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="createAccount" className="font-medium text-gray-700">
                    Create Account
                  </label>
                  <p className="text-gray-500">
                    Also create a subscription account for this contact
                  </p>
                </div>
              </div>

              {/* Account Details (shown when createAccount is true) */}
              {createAccount && (
                <div className="space-y-4 pl-7 border-l-2 border-primary-200">
                  <div className="flex items-center text-sm font-medium text-gray-700 mb-4">
                    <CreditCard size={16} className="mr-2" />
                    Account Details
                  </div>

                  {/* Product Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product <span className="text-red-500">*</span>
                    </label>
                    {productsLoading ? (
                      <div className="flex items-center justify-center py-2">
                        <LoadingSpinner size="sm" />
                      </div>
                    ) : products.length === 0 ? (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                        No products available. Please create products in Admin &gt; Products first.
                      </div>
                    ) : (
                      <select
                        name="productId"
                        value={formData.productId}
                        onChange={handleProductChange}
                        className="select w-full"
                        required
                      >
                        <option value="">
                          {defaultProduct ? `${defaultProduct.name} (Default)` : 'Select a product...'}
                        </option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} - ${product.price}/{product.allowed_billing_cycles?.[0] || 'month'}
                            {product.is_default && ' (Default)'}
                          </option>
                        ))}
                      </select>
                    )}
                    {formData.productId && (
                      <p className="mt-1 text-xs text-gray-500">
                        <Package size={12} className="inline mr-1" />
                        Selected product will be linked to the account
                      </p>
                    )}
                  </div>

                  {/* Account Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Account Name
                    </label>
                    <input
                      type="text"
                      name="accountName"
                      value={formData.accountName}
                      onChange={handleInputChange}
                      placeholder={`${lead.first_name} ${lead.last_name}'s Account`}
                      className="input w-full"
                    />
                  </div>

                  {/* Device Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Device Name
                      </label>
                      <input
                        type="text"
                        name="deviceName"
                        value={formData.deviceName}
                        onChange={handleInputChange}
                        placeholder="e.g., Device 001"
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        MAC Address
                      </label>
                      <input
                        type="text"
                        name="macAddress"
                        value={formData.macAddress}
                        onChange={handleInputChange}
                        placeholder="00:00:00:00:00:00"
                        className="input w-full"
                      />
                    </div>
                  </div>

                  {/* Billing Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Term
                      </label>
                      <select
                        name="term"
                        value={formData.term}
                        onChange={handleInputChange}
                        className="select w-full"
                      >
                        {BILLING_TERMS.map(term => (
                          <option key={term.value} value={term.value}>
                            {term.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Price
                      </label>
                      <div className="relative">
                        <DollarSign size={16} className="absolute left-3 top-3 text-gray-400" />
                        <input
                          type="number"
                          name="price"
                          value={formData.price}
                          onChange={handleInputChange}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className="input w-full pl-9"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Payment Details Section */}
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center text-sm font-medium text-gray-700 mb-4">
                      <CreditCard size={16} className="mr-2" />
                      Payment Details
                    </div>

                    <div className="space-y-4">
                      {/* Payment Method */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Payment Method <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="paymentMethod"
                          value={formData.paymentMethod}
                          onChange={handleInputChange}
                          className="select w-full"
                          required
                        >
                          <option value="Credit Card">Credit Card</option>
                          <option value="Debit Card">Debit Card</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Cash">Cash</option>
                          <option value="Check">Check</option>
                          <option value="PayPal">PayPal</option>
                          <option value="Stripe">Stripe</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      {/* Amount */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Amount <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <DollarSign size={16} className="absolute left-3 top-3 text-gray-400" />
                          <input
                            type="number"
                            name="amount"
                            value={formData.amount}
                            onChange={handleInputChange}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            className="input w-full pl-9"
                            required
                          />
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Auto-filled from product price
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Conversion Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <UserCheck className="text-blue-600 mt-0.5 mr-2" size={16} />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">What happens next:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Lead status will be set to "Converted"</li>
                      <li>• A new contact will be created with lead information</li>
                      {createAccount && <li>• A subscription account will be created and linked</li>}
                      {createAccount && formData.productId && <li>• Selected product will be assigned to the account</li>}
                      <li>• Lead history and notes will be preserved</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isConverting}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isConverting || (createAccount && products.length === 0)}
                className="btn btn-primary"
              >
                {isConverting ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Converting...</span>
                  </>
                ) : (
                  <>
                    <UserCheck size={16} className="mr-2" />
                    Convert to Contact
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LeadConversionModal
