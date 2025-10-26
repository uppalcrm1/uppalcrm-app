import React, { useState, useRef, useEffect } from 'react'
import { Check, X, Loader2 } from 'lucide-react'

/**
 * InlineEditCell - Reusable component for inline editing in tables
 *
 * Features:
 * - Click to edit with visual feedback
 * - Optimistic updates for instant UX
 * - Auto-save on blur/Enter
 * - Cancel on Escape
 * - Loading states and error handling
 * - Rollback on failure
 */
const InlineEditCell = ({
  // Data
  value,
  fieldName,
  fieldType = 'text',
  recordId,
  entityType,

  // Configuration
  placeholder = 'Click to edit...',
  options = [],          // For select fields
  users = [],            // For user-select
  prefix = '',           // For number fields (e.g., "$")
  validation = null,     // Custom validation function

  // Callbacks
  onSave,
  onError,

  // Styling
  className = '',
  disabled = false,
  readOnly = false,

  // Display
  displayValue = null,   // Custom display (e.g., for user names, formatted numbers)
  icon = null            // Optional icon to show before value
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [currentValue, setCurrentValue] = useState(value)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showSuccess, setShowSuccess] = useState(false)

  const inputRef = useRef(null)
  const originalValue = useRef(value)

  // Update current value when prop changes (e.g., from external update)
  useEffect(() => {
    setCurrentValue(value)
    originalValue.current = value
  }, [value])

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleClick = () => {
    if (disabled || readOnly || isSaving) return
    setIsEditing(true)
    setError(null)
  }

  const handleCancel = () => {
    setCurrentValue(originalValue.current)
    setIsEditing(false)
    setError(null)
  }

  const handleSave = async () => {
    // Don't save if value hasn't changed
    if (currentValue === originalValue.current) {
      setIsEditing(false)
      return
    }

    // Validate if validation function provided
    if (validation) {
      const validationResult = validation(currentValue)
      if (validationResult !== true) {
        setError(typeof validationResult === 'string' ? validationResult : 'Invalid value')
        return
      }
    }

    // Basic email validation
    if (fieldType === 'email' && currentValue && !isValidEmail(currentValue)) {
      setError('Invalid email format')
      return
    }

    // Exit edit mode immediately (optimistic)
    setIsEditing(false)
    setIsSaving(true)

    // Update original value for optimistic UI
    const previousValue = originalValue.current
    originalValue.current = currentValue

    try {
      // Call the onSave callback (should return a promise)
      await onSave(recordId, fieldName, currentValue)

      // Show success indicator briefly
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
      setError(null)

    } catch (err) {
      // Rollback on error
      console.error('Failed to save:', err)
      setCurrentValue(previousValue)
      originalValue.current = previousValue

      const errorMessage = err.response?.data?.message || err.message || 'Failed to save changes'
      setError(errorMessage)

      if (onError) {
        onError(err)
      }

      // Re-enter edit mode so user can fix
      setIsEditing(true)
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  const handleBlur = () => {
    // Small delay to allow click events on buttons to register
    setTimeout(() => {
      handleSave()
    }, 200)
  }

  // Email validation helper
  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  // Render input based on field type
  const renderInput = () => {
    const baseInputClass = `
      w-full px-2 py-1 text-sm border-2 border-blue-500 rounded
      focus:outline-none focus:ring-2 focus:ring-blue-500
      ${error ? 'border-red-500 focus:ring-red-500' : ''}
    `

    switch (fieldType) {
      case 'text':
      case 'email':
      case 'phone':
        return (
          <input
            ref={inputRef}
            type={fieldType}
            value={currentValue || ''}
            onChange={(e) => setCurrentValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={baseInputClass}
            disabled={isSaving}
          />
        )

      case 'number':
        return (
          <div className="flex items-center">
            {prefix && <span className="text-sm text-gray-600 mr-1">{prefix}</span>}
            <input
              ref={inputRef}
              type="number"
              value={currentValue || ''}
              onChange={(e) => setCurrentValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder={placeholder}
              className={baseInputClass}
              disabled={isSaving}
            />
          </div>
        )

      case 'select':
        return (
          <select
            ref={inputRef}
            value={currentValue || ''}
            onChange={(e) => {
              setCurrentValue(e.target.value)
              // Auto-save on select change
              setTimeout(() => handleSave(), 100)
            }}
            onKeyDown={handleKeyDown}
            className={baseInputClass}
            disabled={isSaving}
          >
            <option value="">Select...</option>
            {options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )

      case 'user-select':
        return (
          <select
            ref={inputRef}
            value={currentValue || ''}
            onChange={(e) => {
              setCurrentValue(e.target.value)
              // Auto-save on select change
              setTimeout(() => handleSave(), 100)
            }}
            onKeyDown={handleKeyDown}
            className={baseInputClass}
            disabled={isSaving}
          >
            <option value="">Unassigned</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.name || `${user.first_name} ${user.last_name}`}
              </option>
            ))}
          </select>
        )

      default:
        return (
          <input
            ref={inputRef}
            type="text"
            value={currentValue || ''}
            onChange={(e) => setCurrentValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={baseInputClass}
            disabled={isSaving}
          />
        )
    }
  }

  // Display value
  const getDisplayValue = () => {
    if (displayValue) return displayValue

    // For select fields, show label instead of value
    if (fieldType === 'select' && options.length > 0) {
      const option = options.find(opt => opt.value === currentValue)
      return option ? option.label : currentValue
    }

    // For user-select, show user name
    if (fieldType === 'user-select' && users.length > 0) {
      const user = users.find(u => u.id === currentValue || u.id === parseInt(currentValue))
      return user ? (user.name || `${user.first_name} ${user.last_name}`) : 'Unassigned'
    }

    // For numbers with prefix
    if (fieldType === 'number' && prefix && currentValue) {
      return `${prefix}${parseFloat(currentValue).toLocaleString()}`
    }

    return currentValue || <span className="text-gray-400 text-xs italic">{placeholder || 'Click to add...'}</span>
  }

  if (isEditing) {
    return (
      <div className={`inline-edit-cell editing ${className}`}>
        {renderInput()}
        {error && (
          <div className="text-xs text-red-600 mt-1">{error}</div>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={handleClick}
      className={`
        inline-edit-cell
        ${!disabled && !readOnly ? 'cursor-pointer hover:bg-gray-50' : ''}
        ${isSaving ? 'opacity-70' : ''}
        ${error ? 'bg-red-50' : ''}
        px-2 py-1 rounded transition-colors relative
        ${className}
      `}
      title={disabled ? 'This field cannot be edited' : 'Click to edit'}
      style={{ userSelect: 'none' }}
    >
      <div className="flex items-center gap-2 pointer-events-none">
        {icon && <span className="text-gray-400">{icon}</span>}
        <span className="flex-1">{getDisplayValue()}</span>

        {/* Status indicators */}
        {isSaving && (
          <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
        )}
        {showSuccess && (
          <Check className="w-3 h-3 text-green-600" />
        )}
        {error && (
          <X className="w-3 h-3 text-red-600" title={error} />
        )}
      </div>

      {error && (
        <div className="text-xs text-red-600 mt-1 pointer-events-none">{error}</div>
      )}
    </div>
  )
}

export default InlineEditCell
