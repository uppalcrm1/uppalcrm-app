import React, { useState, useRef, useEffect } from 'react'
import { Columns, Eye, EyeOff, RotateCcw } from 'lucide-react'

const ColumnSelector = ({ columns, visibleColumns, onColumnToggle, onReset }) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleToggle = (columnKey) => {
    onColumnToggle(columnKey)
  }

  const handleResetToDefaults = () => {
    onReset()
    setIsOpen(false)
  }

  const visibleCount = Object.values(visibleColumns).filter(Boolean).length
  const totalCount = columns.length

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-outline btn-md flex items-center gap-2"
        title="Manage visible columns"
      >
        <Columns size={16} />
        <span>Columns</span>
        <span className="text-xs text-gray-500">({visibleCount}/{totalCount})</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Manage Columns</h3>
              <button
                onClick={handleResetToDefaults}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                title="Reset to default columns"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Select which columns to display in the table
            </p>
          </div>

          {/* Column List */}
          <div className="max-h-96 overflow-y-auto py-2">
            {columns.map((column) => {
              const isVisible = visibleColumns[column.key]
              const isDisabled = column.required

              return (
                <label
                  key={column.key}
                  className={`flex items-center px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors ${
                    isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => !isDisabled && handleToggle(column.key)}
                    disabled={isDisabled}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {isVisible ? (
                        <Eye size={14} className="text-green-600" />
                      ) : (
                        <EyeOff size={14} className="text-gray-400" />
                      )}
                      <span className="text-sm font-medium text-gray-900">
                        {column.label}
                      </span>
                      {column.required && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          Required
                        </span>
                      )}
                    </div>
                    {column.description && (
                      <p className="text-xs text-gray-500 mt-0.5 ml-6">
                        {column.description}
                      </p>
                    )}
                  </div>
                </label>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">
                {visibleCount} of {totalCount} columns visible
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ColumnSelector
