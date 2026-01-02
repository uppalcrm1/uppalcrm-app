import React, { useState, useEffect } from 'react'
import {
  X,
  CreditCard,
  User,
  Package,
  DollarSign,
  Calendar,
  CheckCircle,
  Search,
  Loader
} from 'lucide-react'
import { accountsAPI, contactsAPI, productsAPI } from '../services/api'
import toast from 'react-hot-toast'

const CreateAccountModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    contact_id: '',
    account_name: '',
    edition: '',
    device_name: '',
    mac_address: '',
    billing_cycle: 'monthly',
    price: '',
    license_status: 'pending',
    account_type: 'trial',
    is_trial: false,
    notes: ''
  })

  const [contacts, setContacts] = useState([])
  const [products, setProducts] = useState([])
  const [contactSearch, setContactSearch] = useState('')
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  // Load contacts on mount
  useEffect(() => {
    if (isOpen) {
      loadContacts()
      loadProducts()
    }
  }, [isOpen])

  // Auto-fill account name when contact is selected
  useEffect(() => {
    if (formData.contact_id && contacts.length > 0) {
      const selectedContact = contacts.find(c => c.id === formData.contact_id)
      if (selectedContact && !formData.account_name) {
        const contactName = `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim()
        const devicePart = formData.device_name ? ` - ${formData.device_name}` : ''
        setFormData(prev => ({
          ...prev,
          account_name: `${contactName}${devicePart}`
        }))
      }
    }
  }, [formData.contact_id, formData.device_name, contacts])

  const loadContacts = async () => {
    setLoadingContacts(true)
    try {
      const response = await contactsAPI.getContacts()
      setContacts(response.contacts || [])
    } catch (error) {
      console.error('Error loading contacts:', error)
      toast.error('Failed to load contacts')
    } finally {
      setLoadingContacts(false)
    }
  }

  const loadProducts = async () => {
    setLoadingProducts(true)
    try {
      // Try to get products from settings
      const response = await productsAPI.getProducts()
      setProducts(response.products || [])
    } catch (error) {
      console.error('Error loading products:', error)
      // Use fallback products if API fails
      setProducts([
        { name: 'Gold', price: 50 },
        { name: 'Smart', price: 30 },
        { name: 'Jio', price: 20 }
      ])
    } finally {
      setLoadingProducts(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  // Auto-fill price when product is selected
  const handleProductChange = (e) => {
    const productName = e.target.value
    const selectedProduct = products.find(p => p.name === productName)

    setFormData(prev => ({
      ...prev,
      edition: productName,
      price: selectedProduct?.price || prev.price
    }))

    if (errors.edition) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.edition
        return newErrors
      })
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.contact_id) {
      newErrors.contact_id = 'Please select a contact'
    }

    if (!formData.account_name?.trim()) {
      newErrors.account_name = 'Account name is required'
    }

    if (!formData.edition) {
      newErrors.edition = 'Product is required'
    }

    if (!formData.billing_cycle) {
      newErrors.billing_cycle = 'Billing cycle is required'
    }

    // MAC address validation removed - accepts any format

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      toast.error('Please fix validation errors')
      return
    }

    setIsSubmitting(true)

    try {
      // Prepare account data
      const accountData = {
        contact_id: formData.contact_id,
        account_name: formData.account_name.trim(),
        edition: formData.edition,
        device_name: formData.device_name?.trim() || null,
        mac_address: formData.mac_address?.trim() || null,
        billing_cycle: formData.billing_cycle,
        price: parseFloat(formData.price) || 0,
        license_status: formData.license_status,
        account_type: formData.is_trial ? 'trial' : formData.account_type,
        is_trial: formData.is_trial,
        notes: formData.notes?.trim() || null
      }

      console.log('Creating account:', accountData)

      // Create account using the accounts API
      const response = await accountsAPI.createAccount(accountData)

      toast.success('Account created successfully!')
      onSuccess()
      onClose()

      // Reset form
      setFormData({
        contact_id: '',
        account_name: '',
        edition: '',
        device_name: '',
        mac_address: '',
        billing_cycle: 'monthly',
        price: '',
        license_status: 'pending',
        account_type: 'trial',
        is_trial: false,
        notes: ''
      })
    } catch (error) {
      console.error('Error creating account:', error)
      const message = error.response?.data?.message || error.message || 'Failed to create account'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter contacts based on search
  const filteredContacts = contacts.filter(contact => {
    if (!contactSearch) return true
    const searchLower = contactSearch.toLowerCase()
    const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.toLowerCase()
    const email = (contact.email || '').toLowerCase()
    const company = (contact.company || '').toLowerCase()
    return fullName.includes(searchLower) || email.includes(searchLower) || company.includes(searchLower)
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <CreditCard size={24} className="mr-2 text-blue-600" />
              Create New Account
            </h2>
            <p className="text-sm text-gray-500 mt-1">Add a new software account/license for a contact</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            disabled={isSubmitting}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-6 space-y-6">
            {/* Contact Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {/* Search Input */}
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search contacts by name, email, or company..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="input pl-10"
                  />
                </div>

                {/* Contact Select */}
                <select
                  name="contact_id"
                  value={formData.contact_id}
                  onChange={handleChange}
                  required
                  className={`select ${errors.contact_id ? 'border-red-500' : ''}`}
                  disabled={loadingContacts}
                >
                  <option value="">
                    {loadingContacts ? 'Loading contacts...' : 'Select a contact'}
                  </option>
                  {filteredContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name}
                      {contact.email && ` (${contact.email})`}
                      {contact.company && ` - ${contact.company}`}
                    </option>
                  ))}
                </select>
                {filteredContacts.length === 0 && contactSearch && (
                  <p className="text-sm text-gray-500">No contacts found matching "{contactSearch}"</p>
                )}
              </div>
              {errors.contact_id && (
                <p className="text-red-600 text-sm mt-1">{errors.contact_id}</p>
              )}
            </div>

            {/* Two Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                {/* Account Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="account_name"
                    value={formData.account_name}
                    onChange={handleChange}
                    required
                    maxLength={255}
                    className={`input ${errors.account_name ? 'border-red-500' : ''}`}
                    placeholder="e.g., John's Living Room TV"
                  />
                  {errors.account_name && (
                    <p className="text-red-600 text-sm mt-1">{errors.account_name}</p>
                  )}
                </div>

                {/* Product */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="edition"
                    value={formData.edition}
                    onChange={handleProductChange}
                    required
                    className={`select ${errors.edition ? 'border-red-500' : ''}`}
                    disabled={loadingProducts}
                  >
                    <option value="">
                      {loadingProducts ? 'Loading products...' : 'Select product'}
                    </option>
                    {products.map((product) => (
                      <option key={product.name} value={product.name}>
                        {product.name}
                        {product.price && ` - $${product.price}`}
                      </option>
                    ))}
                  </select>
                  {errors.edition && (
                    <p className="text-red-600 text-sm mt-1">{errors.edition}</p>
                  )}
                </div>

                {/* Device Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Device Name
                  </label>
                  <input
                    type="text"
                    name="device_name"
                    value={formData.device_name}
                    onChange={handleChange}
                    maxLength={255}
                    className="input"
                    placeholder="e.g., Mag Box, Fire Stick"
                  />
                </div>

                {/* MAC Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    MAC Address
                  </label>
                  <input
                    type="text"
                    name="mac_address"
                    value={formData.mac_address}
                    onChange={handleChange}
                    className={`input font-mono ${errors.mac_address ? 'border-red-500' : ''}`}
                    placeholder="Enter any identifier"
                  />
                  {errors.mac_address && (
                    <p className="text-red-600 text-sm mt-1">{errors.mac_address}</p>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* Billing Cycle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Billing Cycle <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="billing_cycle"
                    value={formData.billing_cycle}
                    onChange={handleChange}
                    required
                    className={`select ${errors.billing_cycle ? 'border-red-500' : ''}`}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly (3 months)</option>
                    <option value="semi-annual">Semi-Annual (6 months)</option>
                    <option value="annual">Annual (12 months)</option>
                  </select>
                  {errors.billing_cycle && (
                    <p className="text-red-600 text-sm mt-1">{errors.billing_cycle}</p>
                  )}
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className="input pl-10"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* License Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    License Status
                  </label>
                  <select
                    name="license_status"
                    value={formData.license_status}
                    onChange={handleChange}
                    className="select"
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Is Trial Checkbox */}
                <div>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="is_trial"
                      checked={formData.is_trial}
                      onChange={handleChange}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">This is a trial account</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Full Width Fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="input"
                placeholder="Add any additional information about this account..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-md"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || Object.keys(errors).length > 0}
              className="btn btn-primary btn-md flex items-center"
            >
              {isSubmitting ? (
                <>
                  <Loader size={16} className="mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle size={16} className="mr-2" />
                  Create Account
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateAccountModal
