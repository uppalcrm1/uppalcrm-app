import React, { useState, useEffect } from 'react'
import {
  Sliders,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Save,
  X,
  Search,
  Settings,
  CheckCircle,
  AlertCircle,
  Move,
  ShieldAlert,
  GripVertical
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import api from '../../services/api'

// Phase 1b: CSS Animations
const animationStyles = `
  @keyframes slide-in-right {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .animate-slide-in-right {
    animation: slide-in-right 0.3s ease-out;
  }
`

const ENTITY_TYPES = [
  { id: 'universal', label: 'Universal Fields', icon: '🌐' },  // Universal fields tab
  { id: 'leads', label: 'Leads', icon: '👤' },
  { id: 'contacts', label: 'Contacts', icon: '✉️' },
  { id: 'accounts', label: 'Accounts', icon: '💼' },
  { id: 'transactions', label: 'Transactions', icon: '💰' },
  { id: 'product', label: 'Products', icon: '📦' }
]

const FIELD_TYPES = [
  { value: 'text', label: 'Text', description: 'Single line text input' },
  { value: 'textarea', label: 'Text Area', description: 'Multi-line text input' },
  { value: 'number', label: 'Number', description: 'Numeric input' },
  { value: 'email', label: 'Email', description: 'Email address' },
  { value: 'phone', label: 'Phone', description: 'Phone number' },
  { value: 'url', label: 'URL', description: 'Web address' },
  { value: 'date', label: 'Date', description: 'Date picker' },
  { value: 'datetime', label: 'Date & Time', description: 'Date and time picker' },
  { value: 'select', label: 'Select', description: 'Dropdown selection' },
  { value: 'multiselect', label: 'Multi-Select', description: 'Multiple selection' },
  { value: 'checkbox', label: 'Checkbox', description: 'True/false toggle' },
  { value: 'radio', label: 'Radio Buttons', description: 'Single choice from options' }
]

/**
 * Helper function to check if a field is the protected "Product Name" field
 */
const isProductNameField = (field, entityType) => {
  if (entityType !== 'product') return false
  if (!field) return false

  const fieldName = (field.field_name || '').toLowerCase()
  const fieldLabel = (field.field_label || '').toLowerCase()

  return (
    fieldName === 'product_name' ||
    fieldName === 'productname' ||
    fieldName === 'name' ||
    fieldLabel === 'product name' ||
    fieldLabel === 'name'
  )
}

/**
 * Sortable Row Component for drag-and-drop functionality
 */
const SortableRow = ({ field, entityType, isReorderMode, onEdit, onDelete, onToggleVisibility, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isProtectedField = isProductNameField(field, entityType)

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-gray-100 hover:bg-gray-50 transition-all ${
        !field.is_enabled ? 'bg-gray-50 opacity-60' : ''
      } ${isProtectedField ? 'bg-blue-50' : ''} ${isDragging ? 'shadow-lg' : ''}`}
    >
      {/* Drag Handle Column */}
      {isReorderMode && (
        <td className="py-4 px-4 cursor-move" {...attributes} {...listeners}>
          <GripVertical size={20} className="text-gray-400" />
        </td>
      )}
      {children}
    </tr>
  )
}

const AdminFields = () => {
  const [activeTab, setActiveTab] = useState('leads')
  const [fields, setFields] = useState([])
  const [systemFields, setSystemFields] = useState([])
  const [isCreating, setIsCreating] = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [isReorderMode, setIsReorderMode] = useState(false)
  const [pendingChanges, setPendingChanges] = useState({}) // Track unsaved visibility changes
  const [updatingFieldId, setUpdatingFieldId] = useState(null) // Phase 1b: Track which field is updating
  const [notifications, setNotifications] = useState([])
  const [formData, setFormData] = useState({
    field_name: '',
    field_label: '',
    field_description: '',
    field_type: 'text',
    entity_type: activeTab,  // Will be set to null for universal fields
    is_required: false,
    is_searchable: true,
    is_filterable: true,
    show_in_list_view: false,
    show_in_detail_view: true,
    show_in_create_form: true,
    show_in_edit_form: true,
    field_group: '',
    placeholder: '',
    default_value: '',
    field_options: [],
    validation_rules: {},
    // Phase 1: Master visibility toggle
    overall_visibility: 'visible',
    visibility_logic: 'master_override'
  })

  // Phase 1b: Notification helper
  const showNotification = (message, type = 'success') => {
    const id = Date.now()
    setNotifications(prev => [...prev, { id, message, type }])

    // Auto-remove after 3 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 3000)
  }

  // Load fields from API
  const loadFields = async (entityType) => {
    try {
      setLoading(true)
      setError(null)
      console.log('🔍 Loading fields for entity type:', entityType)

      // Special handling for universal fields tab
      if (entityType === 'universal') {
        // For universal fields, we need to fetch directly from the backend
        // We'll use leads as the entity_type parameter but filter for entity_type = null on the frontend
        const response = await api.get(`/custom-fields?entity_type=leads`)
        console.log('📦 API Response:', response.data)

        // Filter only fields where entity_type is null (universal fields)
        const universalFields = (response.data.customFields || []).filter(f => f.entity_type === null)
        console.log('🌐 Universal fields found:', universalFields.length)

        setFields(universalFields)
        setSystemFields([])  // No system fields for universal tab
      } else {
        const response = await api.get(`/custom-fields?entity_type=${entityType}`)
        console.log('📦 API Response:', response.data)
        console.log('📝 Custom fields received:', response.data.customFields)
        console.log('🔧 System fields received:', response.data.systemFields)
        console.log('📊 Number of custom fields:', response.data.customFields?.length || 0)
        console.log('📊 Number of system fields:', response.data.systemFields?.length || 0)
        if (response.data.customFields && response.data.customFields.length > 0) {
          console.log('📋 Custom field names:', response.data.customFields.map(f => f.field_name).join(', '))
        }
        if (response.data.systemFields && response.data.systemFields.length > 0) {
          console.log('📋 System field names:', response.data.systemFields.map(f => f.field_name).join(', '))
        }
        setFields(response.data.customFields || [])
        setSystemFields(response.data.systemFields || [])
      }
    } catch (err) {
      console.error('❌ Error loading fields:', err)
      console.error('❌ Error response:', err.response?.data)
      setError(err.response?.data?.message || 'Failed to load fields')
      setFields([])
      setSystemFields([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFields(activeTab)
  }, [activeTab])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSaveField = async () => {
    try {
      setLoading(true)
      setError(null)

      if (editingField) {
        // Update existing field - only send fields the backend expects
        const updateData = {
          field_label: formData.field_label,
          field_type: formData.field_type,
          field_options: formData.field_options,
          is_required: formData.is_required,
          // Phase 1: Include visibility fields
          overall_visibility: formData.overall_visibility,
          visibility_logic: formData.visibility_logic
        }

        // Check if trying to make Product Name field optional
        if (isProductNameField(editingField, activeTab) && !formData.is_required) {
          setError('The "Product Name" field must always be required and cannot be made optional')
          setLoading(false)
          return
        }

        // Check if this is a system field or custom field
        if (editingField.isSystemField) {
          // System fields use field_name as identifier and different endpoint
          updateData.entity_type = activeTab
          // Include visibility flags for system fields
          updateData.show_in_create_form = formData.show_in_create_form
          updateData.show_in_edit_form = formData.show_in_edit_form
          updateData.show_in_detail_view = formData.show_in_detail_view
          updateData.show_in_list_view = formData.show_in_list_view
          console.log('📤 Updating system field:', editingField.field_name, updateData)
          const response = await api.put(`/custom-fields/default/${editingField.field_name}`, updateData)
          console.log('✅ System field updated:', response.data)
          setSystemFields(prev => prev.map(f =>
            f.field_name === editingField.field_name ? response.data.field : f
          ))
          setSuccessMessage(`System field "${formData.field_label}" updated successfully`)
        } else {
          // Custom fields use id as identifier
          console.log('📤 Updating custom field:', editingField.id, updateData)
          const response = await api.put(`/custom-fields/${editingField.id}`, updateData)
          console.log('✅ Custom field updated:', response.data)
          setFields(prev => prev.map(f => f.id === editingField.id ? response.data.field : f))
          setSuccessMessage(`Custom field "${formData.field_label}" updated successfully`)
        }
        setEditingField(null)
        setIsCreating(false)

        // Auto-hide success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        // Create new field - only send fields the backend expects
        const fieldData = {
          entity_type: activeTab === 'universal' ? null : activeTab,
          field_name: formData.field_name,
          field_label: formData.field_label,
          field_type: formData.field_type,
          field_options: formData.field_options,
          is_required: formData.is_required,
          // Phase 1: Include visibility fields
          overall_visibility: formData.overall_visibility,
          visibility_logic: formData.visibility_logic
        }
        console.log('📤 Sending field data:', fieldData)
        const response = await api.post('/custom-fields', fieldData)
        console.log('✅ Field created:', response.data)
        setFields(prev => [...prev, response.data.field])
        setIsCreating(false)
        const scope = activeTab === 'universal' ? 'universal field (available in all modules)' : `${activeTab} field`
        setSuccessMessage(`Custom field "${formData.field_label}" created successfully as ${scope}`)

        // Auto-hide success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000)
      }
      resetForm()
    } catch (err) {
      console.error('Error saving field:', err)
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to save field')
    } finally {
      setLoading(false)
    }
  }

  const handleEditField = (field) => {
    // Normalize field_options to ensure it's an array of {value, label} objects
    let normalizedOptions = []
    if (field.field_options) {
      if (Array.isArray(field.field_options)) {
        normalizedOptions = field.field_options.map(option => {
          // If it's already an object with label/value, use it
          if (typeof option === 'object' && option !== null && option.label) {
            return option
          }
          // If it's a string, convert to {value, label}
          if (typeof option === 'string') {
            return {
              value: option.toLowerCase().replace(/\s+/g, '_'),
              label: option
            }
          }
          // Fallback
          return { value: '', label: '' }
        })
      }
    }

    // CRITICAL: Ensure all visibility flags are properly set from the field
    // If field is missing visibility flags, use defaults that allow all views
    setFormData({
      field_name: field.field_name || '',
      field_label: field.field_label || '',
      field_description: field.field_description || '',
      field_type: field.field_type || 'text',
      entity_type: field.entity_type || activeTab,
      is_required: field.is_required !== undefined ? field.is_required : false,
      is_searchable: field.is_searchable !== undefined ? field.is_searchable : true,
      is_filterable: field.is_filterable !== undefined ? field.is_filterable : true,
      show_in_list_view: field.show_in_list_view !== undefined ? field.show_in_list_view : false,
      show_in_detail_view: field.show_in_detail_view !== undefined ? field.show_in_detail_view : true,
      show_in_create_form: field.show_in_create_form !== undefined ? field.show_in_create_form : true,
      show_in_edit_form: field.show_in_edit_form !== undefined ? field.show_in_edit_form : true,
      field_group: field.field_group || '',
      placeholder: field.placeholder || '',
      default_value: field.default_value || '',
      field_options: normalizedOptions,
      validation_rules: field.validation_rules || {},
      // Phase 1: Master visibility toggle
      overall_visibility: field.overall_visibility || 'visible',
      visibility_logic: field.visibility_logic || 'master_override'
    })
    setEditingField(field)
    setIsCreating(true)
  }

  const handleDeleteField = async (field) => {
    // Check if this is the protected Product Name field
    if (isProductNameField(field, activeTab)) {
      setError('The "Product Name" field is a core field and cannot be deleted')
      return
    }

    if (confirm('Are you sure you want to delete this field? This action cannot be undone.')) {
      try {
        setLoading(true)
        setError(null)
        await api.delete(`/custom-fields/${field.id}`)
        setFields(prev => prev.filter(f => f.id !== field.id))
        setSuccessMessage(`Field "${field.field_label}" deleted successfully`)
        setTimeout(() => setSuccessMessage(null), 5000)
      } catch (err) {
        console.error('Error deleting field:', err)
        setError(err.response?.data?.error || err.response?.data?.message || 'Failed to delete field')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleToggleVisibility = (field, newValue) => {
    // Track the pending change instead of saving immediately
    const fieldKey = field.isSystemField ? `system_${field.field_name}` : `custom_${field.id}`
    setPendingChanges(prev => ({
      ...prev,
      [fieldKey]: {
        field,
        newValue
      }
    }))
  }

  const handleSaveVisibilityChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) {
      setError('No changes to save')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccessMessage(null)

      // Save all pending changes
      for (const [fieldKey, change] of Object.entries(pendingChanges)) {
        const { field, newValue } = change

        if (field.isSystemField) {
          await api.put(`/custom-fields/default/${field.field_name}`, {
            is_enabled: newValue,
            entity_type: activeTab
          })
          setSystemFields(prev => prev.map(f =>
            f.field_name === field.field_name ? { ...f, is_enabled: newValue } : f
          ))
        } else {
          await api.put(`/custom-fields/${field.id}`, {
            is_enabled: newValue
          })
          setFields(prev => prev.map(f =>
            f.id === field.id ? { ...f, is_enabled: newValue } : f
          ))
        }
      }

      setSuccessMessage(`Successfully saved ${Object.keys(pendingChanges).length} field visibility change(s)`)
      setPendingChanges({})

      // Auto-hide success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Error saving visibility changes:', err)
      setError(err.response?.data?.error || 'Failed to save changes')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelChanges = () => {
    setPendingChanges({})
    setSuccessMessage(null)
    setError(null)
  }

  // Get the display value for a field (considering pending changes)
  const getFieldVisibility = (field) => {
    const fieldKey = field.isSystemField ? `system_${field.field_name}` : `custom_${field.id}`
    if (pendingChanges[fieldKey]) {
      return pendingChanges[fieldKey].newValue
    }
    return field.is_enabled
  }

  const hasPendingChange = (field) => {
    const fieldKey = field.isSystemField ? `system_${field.field_name}` : `custom_${field.id}`
    return pendingChanges[fieldKey] !== undefined
  }

  const resetForm = () => {
    setFormData({
      field_name: '',
      field_label: '',
      field_description: '',
      field_type: 'text',
      is_required: false,
      is_searchable: true,
      is_filterable: true,
      show_in_list_view: false,
      show_in_detail_view: true,
      show_in_create_form: true,
      show_in_edit_form: true,
      field_group: '',
      placeholder: '',
      default_value: '',
      field_options: [],
      validation_rules: {},
      // Phase 1: Master visibility toggle
      overall_visibility: 'visible',
      visibility_logic: 'master_override'
    })
  }

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end - reorder fields
  const handleDragEnd = async (event) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const allFields = filteredFields
    const oldIndex = allFields.findIndex(f => f.id === active.id)
    const newIndex = allFields.findIndex(f => f.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Reorder locally first for immediate feedback
    const reorderedFields = arrayMove(allFields, oldIndex, newIndex)

    // Update the appropriate state
    if (searchQuery) {
      // If filtering, we need to update both system and custom fields
      const reorderedSystemFields = reorderedFields.filter(f => f.isSystemField)
      const reorderedCustomFields = reorderedFields.filter(f => !f.isSystemField)
      setSystemFields(reorderedSystemFields)
      setFields(reorderedCustomFields)
    } else {
      // Update the full lists
      const reorderedSystemFields = reorderedFields.filter(f => f.isSystemField)
      const reorderedCustomFields = reorderedFields.filter(f => !f.isSystemField)
      setSystemFields(reorderedSystemFields)
      setFields(reorderedCustomFields)
    }

    // Save new order to backend
    try {
      const updates = reorderedFields.map((field, index) => ({
        field,
        display_order: index + 1
      }))

      // Update each field's display_order
      for (const { field, display_order } of updates) {
        if (field.isSystemField) {
          await api.put(`/custom-fields/default/${field.field_name}`, {
            display_order,
            entity_type: activeTab
          })
        } else {
          await api.put(`/custom-fields/${field.id}`, {
            display_order
          })
        }
      }

      setSuccessMessage('Field order updated successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Error updating field order:', err)
      setError('Failed to save field order')
      // Reload fields to restore correct order
      loadFields(activeTab)
    }
  }

  const handleCancel = () => {
    setIsCreating(false)
    setEditingField(null)
    resetForm()
  }

  // Combine system fields and custom fields
  const allFields = [
    ...systemFields.map(f => ({ ...f, isSystemField: true })),
    ...fields.map(f => ({ ...f, isSystemField: false }))
  ]

  const filteredFields = allFields.filter(field =>
    field.field_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    field.field_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const needsOptions = ['select', 'multiselect', 'radio'].includes(formData.field_type)

  // Phase 1b: VisibilityStatusBadge Component
  const VisibilityStatusBadge = ({ field }) => {
    const isHidden = field.overall_visibility === 'hidden'
    const isUpdating = updatingFieldId === field.id || updatingFieldId === field.field_name

    const handleMasterToggle = async (newVisibility) => {
      setUpdatingFieldId(field.id || field.field_name)

      try {
        const endpoint = field.isSystemField
          ? `/custom-fields/default/${field.field_name}`
          : `/custom-fields/${field.id}`

        const response = await api.put(endpoint, {
          overall_visibility: newVisibility,
          entity_type: activeTab,
          // Phase 1: When hiding, auto-uncheck all contexts
          ...(newVisibility === 'hidden' && {
            show_in_create_form: false,
            show_in_edit_form: false,
            show_in_detail_view: false,
            show_in_list_view: false
          })
        })

        if (response.data) {
          showNotification(
            newVisibility === 'hidden'
              ? `${field.field_label} is now hidden everywhere`
              : `${field.field_label} is now visible`,
            'success'
          )
          // Reload fields to get updated data
          await loadFields(activeTab)
        }
      } catch (error) {
        console.error('Error updating visibility:', error)
        showNotification('Error updating field visibility', 'error')
      } finally {
        setUpdatingFieldId(null)
      }
    }

    return (
      <div className="flex items-center gap-2">
        <select
          value={field.overall_visibility || 'visible'}
          onChange={(e) => handleMasterToggle(e.target.value)}
          disabled={isUpdating}
          className={`
            text-sm border rounded px-3 py-1.5 min-w-[110px]
            transition-colors duration-200 font-medium
            ${isUpdating ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
            ${isHidden
              ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
              : 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
            }
          `}
        >
          <option value="visible">👁️ Visible</option>
          <option value="hidden">🚫 Hidden</option>
        </select>

        {isUpdating && (
          <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
        )}
      </div>
    )
  }

  // Phase 1b: ContextCheckboxes Component
  const ContextCheckboxes = ({ field }) => {
    const isHidden = field.overall_visibility === 'hidden'
    const isUpdating = updatingFieldId === field.id || updatingFieldId === field.field_name

    const handleContextToggle = async (contextField, value) => {
      if (isHidden) {
        showNotification('Cannot modify context when field is hidden. Change to "Visible" first.', 'warning')
        return
      }

      setUpdatingFieldId(field.id || field.field_name)

      try {
        const endpoint = field.isSystemField
          ? `/custom-fields/default/${field.field_name}`
          : `/custom-fields/${field.id}`

        const response = await api.put(endpoint, {
          [contextField]: value,
          entity_type: activeTab
        })

        if (response.data) {
          showNotification('Context visibility updated', 'success')
          await loadFields(activeTab)
        }
      } catch (error) {
        console.error('Error updating context:', error)
        showNotification('Error updating context visibility', 'error')
      } finally {
        setUpdatingFieldId(null)
      }
    }

    const contexts = [
      { key: 'show_in_create_form', label: 'Create', icon: '➕' },
      { key: 'show_in_edit_form', label: 'Edit', icon: '✏️' },
      { key: 'show_in_detail_view', label: 'Detail', icon: '👁️' },
      { key: 'show_in_list_view', label: 'List', icon: '📋' }
    ]

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          {contexts.map(({ key, label, icon }) => (
            <label
              key={key}
              className={`
                flex items-center gap-1.5 text-xs font-medium
                transition-all duration-200 px-2 py-1 rounded
                ${isHidden
                  ? 'opacity-40 cursor-not-allowed bg-gray-50'
                  : 'cursor-pointer hover:bg-blue-50 hover:text-blue-600'
                }
                ${isUpdating ? 'opacity-50' : ''}
              `}
            >
              <input
                type="checkbox"
                checked={field[key] !== false}
                onChange={(e) => handleContextToggle(key, e.target.checked)}
                disabled={isHidden || isUpdating}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{icon}</span>
              <span>{label}</span>
            </label>
          ))}
        </div>

        {/* Explanation text */}
        <div className="text-xs text-gray-500 italic">
          {isHidden ? (
            <span className="text-red-600">
              ⚠️ Context settings disabled - field is hidden everywhere
            </span>
          ) : (
            <span>
              Select where this field should appear
            </span>
          )}
        </div>
      </div>
    )
  }

  // Phase 1b: HiddenFieldWarning Component
  const HiddenFieldWarning = ({ field }) => {
    if (field.overall_visibility !== 'hidden') return null

    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
        <span className="text-red-600 text-lg flex-shrink-0">⚠️</span>
        <div className="text-sm text-red-700">
          <p className="font-medium mb-1">This field is hidden everywhere</p>
          <p className="text-xs">
            This field will not appear in any forms, lists, or views.
            Change the master visibility to "Visible" to configure where it should appear.
          </p>
        </div>
      </div>
    )
  }

  // Phase 1b: NotificationToast Component
  const NotificationToast = () => {
    return (
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {notifications.map(({ id, message, type }) => (
          <div
            key={id}
            className={`
              px-4 py-3 rounded-lg shadow-lg border
              animate-slide-in-right pointer-events-auto
              ${type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : ''}
              ${type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : ''}
              ${type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : ''}
            `}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {type === 'success' && '✅'}
                {type === 'error' && '❌'}
                {type === 'warning' && '⚠️'}
              </span>
              <span className="text-sm font-medium">{message}</span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Phase 1b: Animation Styles */}
      <style>{animationStyles}</style>

      {/* Phase 1b: Notification Toast */}
      <NotificationToast />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Field Configuration</h1>
          <p className="text-gray-600 mt-1">Customize fields for leads, contacts, accounts, transactions, and products</p>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="btn btn-primary btn-md"
          >
            <Plus size={16} className="mr-2" />
            Add Custom Field
          </button>
        )}
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3 animate-fade-in">
          <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">Success</p>
            <p className="text-sm text-green-700 mt-1">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-400 hover:text-green-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Entity Type Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px space-x-8">
            {ENTITY_TYPES.map(entity => (
              <button
                key={entity.id}
                onClick={() => {
                  setActiveTab(entity.id)
                  setIsCreating(false)
                  setEditingField(null)
                }}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === entity.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span className="mr-2">{entity.icon}</span>
                {entity.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Product Name Protection Notice (only show for Products tab) */}
      {activeTab === 'product' && !isCreating && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <ShieldAlert size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800">Protected Field</p>
            <p className="text-sm text-blue-700 mt-1">
              The "Product Name" field is a core field that is always required and cannot be deleted or made optional.
            </p>
          </div>
        </div>
      )}

      {/* Create/Edit Form */}
      {isCreating && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {editingField
                  ? editingField.isSystemField
                    ? 'Edit System Field'
                    : 'Edit Custom Field'
                  : 'Create Custom Field'}
              </h2>
              {editingField?.isSystemField && (
                <p className="text-xs text-blue-600 mt-1">
                  System fields have limited editing options
                </p>
              )}
              {/* Product Name field protection warning */}
              {editingField && isProductNameField(editingField, activeTab) && (
                <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                  <ShieldAlert size={14} />
                  This is a protected field - it must always be required
                </p>
              )}
            </div>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            {/* Universal Field Option - Only show when NOT on universal tab and NOT editing */}
            {activeTab !== 'universal' && !editingField && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.entity_type === null}
                    onChange={(e) => handleInputChange('entity_type', e.target.checked ? null : activeTab)}
                    className="mt-1 mr-3 h-4 w-4 text-blue-600 border-blue-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-blue-900">🌐 Make this a universal field</span>
                    <p className="text-xs text-blue-700 mt-1">
                      This field will be available across all modules (Leads, Contacts, Accounts, Transactions, Products)
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Warning when editing universal field */}
            {editingField && editingField.entity_type === null && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-orange-600 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-orange-900">Editing Universal Field</span>
                    <p className="text-xs text-orange-700 mt-1">
                      Changes to this field will affect all modules where it's used (Leads, Contacts, Accounts, Transactions)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Field Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.field_label}
                  onChange={(e) => handleInputChange('field_label', e.target.value)}
                  placeholder="e.g., Industry"
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">User-facing name shown in forms</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Field Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.field_name}
                  onChange={(e) => handleInputChange('field_name', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  placeholder="e.g., industry"
                  className="input"
                  disabled={editingField?.isSystemField}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {editingField?.isSystemField
                    ? 'System field names cannot be changed'
                    : 'Internal identifier (lowercase, no spaces)'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.field_description}
                onChange={(e) => handleInputChange('field_description', e.target.value)}
                placeholder="Help text for users"
                rows={2}
                className="input"
              />
            </div>

            {/* Field Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Field Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.field_type}
                onChange={(e) => handleInputChange('field_type', e.target.value)}
                className="input"
              >
                {FIELD_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label} - {type.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Field Options (for select/multiselect/radio) */}
            {needsOptions && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Field Options <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {formData.field_options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={option.label}
                        onChange={(e) => {
                          const newOptions = [...formData.field_options]
                          newOptions[index] = { value: e.target.value.toLowerCase().replace(/\s+/g, '_'), label: e.target.value }
                          handleInputChange('field_options', newOptions)
                        }}
                        placeholder="Option label"
                        className="input flex-1"
                      />
                      <button
                        onClick={() => {
                          const newOptions = formData.field_options.filter((_, i) => i !== index)
                          handleInputChange('field_options', newOptions)
                        }}
                        className="btn btn-sm btn-outline text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      handleInputChange('field_options', [...formData.field_options, { value: '', label: '' }])
                    }}
                    className="btn btn-sm btn-outline"
                  >
                    <Plus size={14} className="mr-1" />
                    Add Option
                  </button>
                </div>
              </div>
            )}

            {/* Additional Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Placeholder Text
                </label>
                <input
                  type="text"
                  value={formData.placeholder}
                  onChange={(e) => handleInputChange('placeholder', e.target.value)}
                  placeholder="e.g., Enter industry"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Value
                </label>
                <input
                  type="text"
                  value={formData.default_value}
                  onChange={(e) => handleInputChange('default_value', e.target.value)}
                  placeholder="Default value"
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Field Group
              </label>
              <input
                type="text"
                value={formData.field_group}
                onChange={(e) => handleInputChange('field_group', e.target.value)}
                placeholder="e.g., Company Information"
                className="input"
              />
              <p className="text-xs text-gray-500 mt-1">Group related fields together</p>
            </div>

            {/* Phase 1: Master Visibility Control */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900">
                    Master Visibility Control (Phase 1)
                  </label>
                  <p className="text-xs text-gray-600 mt-1">
                    Controls overall field visibility. When hidden, the field is invisible everywhere.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center cursor-pointer flex-1">
                    <input
                      type="radio"
                      name="overall_visibility"
                      value="visible"
                      checked={formData.overall_visibility === 'visible'}
                      onChange={(e) => handleInputChange('overall_visibility', e.target.value)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="ml-3">
                      <span className="text-sm font-medium text-gray-900">Visible</span>
                      <p className="text-xs text-gray-600">Field is visible where configured in context settings</p>
                    </span>
                  </label>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center cursor-pointer flex-1">
                    <input
                      type="radio"
                      name="overall_visibility"
                      value="hidden"
                      checked={formData.overall_visibility === 'hidden'}
                      onChange={(e) => handleInputChange('overall_visibility', e.target.value)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="ml-3">
                      <span className="text-sm font-medium text-gray-900">Hidden</span>
                      <p className="text-xs text-gray-600">Field is hidden everywhere, regardless of context settings</p>
                    </span>
                  </label>
                </div>
              </div>
              {formData.overall_visibility === 'hidden' && (
                <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700 flex items-start gap-2">
                  <span>⚠️</span>
                  <span>All context visibility settings below will be disabled when you save</span>
                </div>
              )}
            </div>

            {/* Field Settings Checkboxes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Field Settings
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_required}
                    onChange={(e) => handleInputChange('is_required', e.target.checked)}
                    disabled={editingField && isProductNameField(editingField, activeTab)}
                    className="mr-2 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className={`text-sm ${editingField && isProductNameField(editingField, activeTab) ? 'text-gray-400' : 'text-gray-700'}`}>
                    Required field
                    {editingField && isProductNameField(editingField, activeTab) && (
                      <span className="ml-2 text-xs text-orange-600">(always required)</span>
                    )}
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_searchable}
                    onChange={(e) => handleInputChange('is_searchable', e.target.checked)}
                    className="mr-2 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Searchable</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_filterable}
                    onChange={(e) => handleInputChange('is_filterable', e.target.checked)}
                    className="mr-2 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Filterable</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.show_in_list_view}
                    onChange={(e) => handleInputChange('show_in_list_view', e.target.checked)}
                    className="mr-2 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Show in list view</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.show_in_detail_view}
                    onChange={(e) => handleInputChange('show_in_detail_view', e.target.checked)}
                    className="mr-2 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Show in detail view</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.show_in_create_form}
                    onChange={(e) => handleInputChange('show_in_create_form', e.target.checked)}
                    className="mr-2 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Show in create form</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.show_in_edit_form}
                    onChange={(e) => handleInputChange('show_in_edit_form', e.target.checked)}
                    className="mr-2 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Show in edit form</span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button onClick={handleCancel} className="btn btn-outline">
                Cancel
              </button>
              <button
                onClick={handleSaveField}
                disabled={!formData.field_name || !formData.field_label}
                className="btn btn-primary"
              >
                <Save size={16} className="mr-2" />
                {editingField ? 'Update Field' : 'Create Field'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 1b: Fields List with New Grid Layout */}
      {!isCreating && (
        <div className="card">
          {/* Header with Search and Controls */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <div className="flex-1">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search fields..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-10"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 ml-4">
              <button
                onClick={() => setIsReorderMode(!isReorderMode)}
                className={`btn ${isReorderMode ? 'btn-primary' : 'btn-outline'} flex items-center gap-2`}
              >
                <Move size={16} />
                {isReorderMode ? 'Done Reordering' : 'Reorder Fields'}
              </button>
            </div>
          </div>

          {/* Phase 1b: Fields Grid */}
          {filteredFields.length === 0 ? (
            <div className="text-center py-12">
              <Sliders className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery ? 'No fields found' : 'No fields yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery
                  ? 'Try adjusting your search query'
                  : `Manage field visibility for ${ENTITY_TYPES.find(e => e.id === activeTab)?.label.toLowerCase()}`
                }
              </p>
              {!searchQuery && (
                <button onClick={() => setIsCreating(true)} className="btn btn-primary">
                  <Plus size={16} className="mr-2" />
                  Add Custom Field
                </button>
              )}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div className="space-y-1">
                {isReorderMode && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-800">
                      <Move size={16} />
                      <span className="text-sm font-medium">Drag and drop fields to reorder them</span>
                    </div>
                  </div>
                )}

                {/* Phase 1b: Grid Header */}
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700 uppercase">
                  <div className="col-span-3">Field</div>
                  <div className="col-span-2">Master Visibility</div>
                  <div className="col-span-5">Show In</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                {/* Phase 1b: Field Rows */}
                <SortableContext
                  items={filteredFields.map(f => f.id || f.field_name)}
                  strategy={verticalListSortingStrategy}
                >
                  {filteredFields.map((field) => (
                    <React.Fragment key={field.id || field.field_name}>
                      <SortableRow
                        field={field}
                        entityType={activeTab}
                        isReorderMode={isReorderMode}
                      >
                        <div className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                          {/* Drag Handle Column */}
                          {isReorderMode && (
                            <div className="col-span-0 flex items-center -ml-4">
                              <GripVertical size={20} className="text-gray-400" />
                            </div>
                          )}

                          {/* Field Info */}
                          <div className={`${isReorderMode ? 'col-span-3' : 'col-span-3'}`}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-lg">
                                {field.isSystemField ? '🔧' : '⭐'}
                              </span>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {field.field_label}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {field.field_name}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {field.isSystemField ? 'System Field' : 'Custom Field'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Master Visibility */}
                          <div className="col-span-2 flex items-center">
                            <VisibilityStatusBadge field={field} />
                          </div>

                          {/* Context Checkboxes */}
                          <div className="col-span-5 flex items-center">
                            <ContextCheckboxes field={field} />
                          </div>

                          {/* Actions */}
                          <div className="col-span-2 flex items-center justify-end gap-2">
                            {!field.isSystemField && (
                              <>
                                <button
                                  onClick={() => handleEditField(field)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit field"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleDeleteField(field)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete field"
                                >
                                  🗑️
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleEditField(field)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Field settings"
                            >
                              ⚙️
                            </button>
                          </div>
                        </div>
                      </SortableRow>

                      {/* Phase 1b: Hidden Field Warning (spans full width) */}
                      <div className="px-6">
                        <HiddenFieldWarning field={field} />
                      </div>
                    </React.Fragment>
                  ))}
                </SortableContext>
              </div>
            </DndContext>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminFields
