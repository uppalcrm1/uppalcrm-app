import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, DollarSign, Package, Check, X } from 'lucide-react'
import { productsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/LoadingSpinner'
import axios from 'axios'

const AdminProducts = () => {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [fieldConfig, setFieldConfig] = useState({ systemFields: [] })

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'USD',
    allowed_billing_cycles: ['monthly', 'annual'],
    is_active: true,
    is_default: false,
    display_order: 0,
    color: 'blue',
    features: []
  })

  const [newFeature, setNewFeature] = useState('')

  useEffect(() => {
    fetchProducts()
    fetchFieldConfiguration()
  }, [includeInactive])

  const fetchFieldConfiguration = async () => {
    try {
      const token = localStorage.getItem('token')
      const organizationSlug = localStorage.getItem('organizationSlug')

      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/custom-fields?entity_type=product`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-organization-slug': organizationSlug
          }
        }
      )

      if (response.data) {
        setFieldConfig(response.data)
        console.log('Product field configuration loaded:', response.data)
      }
    } catch (error) {
      console.error('Error fetching field configuration:', error)
      // Continue with default hardcoded fields if API fails
    }
  }

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const response = await productsAPI.getProducts(includeInactive)
      setProducts(response.products || [])
    } catch (error) {
      console.error('Error fetching products:', error)
      toast.error('Failed to fetch products')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (product = null) => {
    if (product) {
      setEditingProduct(product)
      setFormData({
        name: product.name,
        description: product.description || '',
        price: product.price,
        currency: product.currency || 'USD',
        allowed_billing_cycles: product.allowed_billing_cycles || ['monthly', 'annual'],
        is_active: product.is_active,
        is_default: product.is_default,
        display_order: product.display_order || 0,
        color: product.color || 'blue',
        features: product.features || []
      })
    } else {
      setEditingProduct(null)
      setFormData({
        name: '',
        description: '',
        price: '',
        currency: 'USD',
        allowed_billing_cycles: ['monthly', 'annual'],
        is_active: true,
        is_default: false,
        display_order: 0,
        color: 'blue',
        features: []
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingProduct(null)
    setNewFeature('')
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleBillingCycleToggle = (cycle) => {
    setFormData(prev => ({
      ...prev,
      allowed_billing_cycles: prev.allowed_billing_cycles.includes(cycle)
        ? prev.allowed_billing_cycles.filter(c => c !== cycle)
        : [...prev.allowed_billing_cycles, cycle]
    }))
  }

  const handleAddFeature = () => {
    if (newFeature.trim()) {
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, newFeature.trim()]
      }))
      setNewFeature('')
    }
  }

  const handleRemoveFeature = (index) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate required fields based on field configuration
    if (isFieldRequired('name') && !formData.name) {
      toast.error('Product Name is required')
      return
    }

    if (isFieldRequired('price') && !formData.price) {
      toast.error('Price is required')
      return
    }

    if (formData.allowed_billing_cycles.length === 0) {
      toast.error('At least one billing cycle must be selected')
      return
    }

    try {
      // Build product data, only including fields with valid values
      const productData = { ...formData }

      // Handle price field - only include if it has a valid value
      if (formData.price && formData.price !== '' && !isNaN(parseFloat(formData.price))) {
        productData.price = parseFloat(formData.price)
      } else {
        // Remove price if empty, null, or invalid (handles both hidden and empty cases)
        delete productData.price
      }

      // Remove hidden fields
      if (!isFieldVisible('description')) {
        delete productData.description
      }
      if (!isFieldVisible('features')) {
        delete productData.features
      }
      if (!isFieldVisible('currency')) {
        delete productData.currency
      }

      if (editingProduct) {
        await productsAPI.updateProduct(editingProduct.id, productData)
        toast.success('Product updated successfully')
      } else {
        await productsAPI.createProduct(productData)
        toast.success('Product created successfully')
      }

      handleCloseModal()
      fetchProducts()
    } catch (error) {
      console.error('Error saving product:', error)
      toast.error(error.response?.data?.message || 'Failed to save product')
    }
  }

  const handleDelete = async (productId, productName) => {
    if (!window.confirm(`Are you sure you want to deactivate "${productName}"?`)) {
      return
    }

    try {
      await productsAPI.deleteProduct(productId)
      toast.success('Product deactivated successfully')
      fetchProducts()
    } catch (error) {
      console.error('Error deleting product:', error)
      toast.error(error.response?.data?.message || 'Failed to delete product')
    }
  }

  // Helper functions to check field configuration
  const isFieldVisible = (fieldName) => {
    if (!fieldConfig || !fieldConfig.systemFields) return true // Show by default if config not loaded

    const field = fieldConfig.systemFields.find(f =>
      f.field_name === fieldName || f.field_name === fieldName.toLowerCase()
    )

    // If field not in config, show it (for backward compatibility)
    // If field is in config, check is_enabled (true means visible, false means hidden)
    return !field || field.is_enabled !== false
  }

  const isFieldRequired = (fieldName) => {
    if (!fieldConfig || !fieldConfig.systemFields) {
      // Default required fields if config not loaded
      return fieldName === 'name' || fieldName === 'product_name'
    }

    const field = fieldConfig.systemFields.find(f =>
      f.field_name === fieldName || f.field_name === fieldName.toLowerCase()
    )

    return field ? field.is_required === true : false
  }

  const billingCycleOptions = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'semi-annual', label: 'Semi-Annual' },
    { value: 'annual', label: 'Annual' }
  ]

  const colorOptions = [
    'blue', 'green', 'purple', 'yellow', 'red', 'pink', 'indigo', 'gray'
  ]

  if (loading && products.length === 0) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600">Manage subscription products and pricing</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="btn btn-primary"
        >
          <Plus size={20} className="mr-2" />
          Add Product
        </button>
      </div>

      {/* Show Inactive Toggle */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="includeInactive"
          checked={includeInactive}
          onChange={(e) => setIncludeInactive(e.target.checked)}
          className="mr-2"
        />
        <label htmlFor="includeInactive" className="text-sm text-gray-700">
          Show inactive products
        </label>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Billing Cycles
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Default
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                  No products found. Click "Add Product" to create one.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className={!product.is_active ? 'opacity-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full bg-${product.color}-500 mr-3`}></div>
                      <div className="text-sm font-medium text-gray-900">{product.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 max-w-xs truncate">
                      {product.description || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      ${product.price} {product.currency}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {product.allowed_billing_cycles?.map((cycle) => (
                        <span key={cycle} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                          {cycle}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {product.is_active ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                        <Check size={12} className="mr-1" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                        <X size={12} className="mr-1" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {product.is_default && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                        Default
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleOpenModal(product)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      <Edit size={16} />
                    </button>
                    {product.is_active && (
                      <button
                        onClick={() => handleDelete(product.id, product.name)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={handleCloseModal}></div>

            <div className="inline-block w-full max-w-2xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white rounded-lg shadow-xl">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </h3>
                </div>

                <div className="bg-white px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                  {/* Name - Always visible (core field) */}
                  {isFieldVisible('name') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Product Name {isFieldRequired('name') && '*'}
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="input w-full"
                        required={isFieldRequired('name')}
                      />
                    </div>
                  )}

                  {/* Description */}
                  {isFieldVisible('description') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description {isFieldRequired('description') && '*'}
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        className="input w-full"
                        rows="3"
                        required={isFieldRequired('description')}
                      />
                    </div>
                  )}

                  {/* Price and Currency */}
                  <div className="grid grid-cols-2 gap-4">
                    {isFieldVisible('price') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Price {isFieldRequired('price') && '*'}
                        </label>
                        <input
                          type="number"
                          name="price"
                          value={formData.price}
                          onChange={handleInputChange}
                          className="input w-full"
                          step="0.01"
                          min="0"
                          required={isFieldRequired('price')}
                        />
                      </div>
                    )}
                    {isFieldVisible('currency') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Currency {isFieldRequired('currency') && '*'}
                        </label>
                        <input
                          type="text"
                          name="currency"
                          value={formData.currency}
                          onChange={handleInputChange}
                          className="input w-full"
                          maxLength="3"
                          required={isFieldRequired('currency')}
                        />
                      </div>
                    )}
                  </div>

                  {/* Billing Cycles */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Allowed Billing Cycles *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {billingCycleOptions.map((option) => (
                        <label key={option.value} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.allowed_billing_cycles.includes(option.value)}
                            onChange={() => handleBillingCycleToggle(option.value)}
                            className="mr-2"
                          />
                          <span className="text-sm">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Color and Display Order */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Color
                      </label>
                      <select
                        name="color"
                        value={formData.color}
                        onChange={handleInputChange}
                        className="select w-full"
                      >
                        {colorOptions.map((color) => (
                          <option key={color} value={color}>
                            {color.charAt(0).toUpperCase() + color.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Display Order
                      </label>
                      <input
                        type="number"
                        name="display_order"
                        value={formData.display_order}
                        onChange={handleInputChange}
                        className="input w-full"
                      />
                    </div>
                  </div>

                  {/* Features */}
                  {isFieldVisible('features') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Features {isFieldRequired('features') && '*'}
                      </label>
                      <div className="space-y-2">
                        {formData.features.map((feature, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={feature}
                              readOnly
                              className="input flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveFeature(index)}
                              className="btn btn-outline btn-sm text-red-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newFeature}
                            onChange={(e) => setNewFeature(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddFeature())}
                            placeholder="Add a feature..."
                            className="input flex-1"
                          />
                          <button
                            type="button"
                            onClick={handleAddFeature}
                            className="btn btn-outline btn-sm"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Checkboxes */}
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={formData.is_active}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <span className="text-sm">Active</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="is_default"
                        checked={formData.is_default}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <span className="text-sm">Set as default product</span>
                    </label>
                  </div>
                </div>

                <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    {editingProduct ? 'Update Product' : 'Create Product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminProducts
