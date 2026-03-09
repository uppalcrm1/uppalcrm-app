import React, { useState, useRef, useEffect } from 'react'
import { Columns, Eye, EyeOff, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react'

const ColumnSelector = ({ columns, visibleColumns, onColumnToggle, onReset, columnOrder, onColumnOrderChange }) => {
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

  // Build ordered list of system columns for display
  const systemColumns = columns.filter(c => !c.isCustom)
  const orderedSystemColumns = columnOrder && columnOrder.length > 0
    ? [...systemColumns].sort((a, b) => {
        const aIdx = columnOrder.indexOf(a.key)
        const bIdx = columnOrder.indexOf(b.key)
        const aPos = aIdx === -1 ? 999 + systemColumns.indexOf(a) : aIdx
        const bPos = bIdx === -1 ? 999 + systemColumns.indexOf(b) : bIdx
        return aPos - bPos
      })
    : systemColumns

  // Move a column up or down in order
  const moveColumn = (columnKey, direction) => {
    if (!onColumnOrderChange) return
    const currentOrder = orderedSystemColumns.map(c => c.key)
    const idx = currentOrder.indexOf(columnKey)
    if (idx === -1) return
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= currentOrder.length) return
    const newOrder = [...currentOrder]
    ;[newOrder[idx], newOrder[newIdx]] = [newOrder[newIdx], newOrder[idx]]
    onColumnOrderChange(newOrder)
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
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Manage Columns</h3>
              <button
                onClick={handleResetToDefaults}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                title="Reset to default columns and order"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Toggle visibility and reorder columns
            </p>
          </div>

          {/* Column List */}
          <div className="max-h-96 overflow-y-auto py-2">
            {/* System Fields Section */}
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              System Fields
            </div>
            {orderedSystemColumns.map((column, index) => {
              const isVisible = visibleColumns[column.key]
              const isDisabled = column.required

              return (
                <div
                  key={column.key}
                  className={`flex items-center px-4 py-1.5 hover:bg-gray-50 transition-colors ${
                    isDisabled ? 'opacity-60' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => !isDisabled && handleToggle(column.key)}
                    disabled={isDisabled}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isVisible ? (
                        <Eye size={12} className="text-green-600 flex-shrink-0" />
                      ) : (
                        <EyeOff size={12} className="text-gray-400 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {column.label}
                      </span>
                      {column.required && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          Required
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Reorder arrows */}
                  {onColumnOrderChange && (
                    <div className="flex items-center gap-0.5 ml-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveColumn(column.key, 'up') }}
                        disabled={index === 0}
                        className={`p-0.5 rounded ${index === 0 ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer'}`}
                        title="Move up"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveColumn(column.key, 'down') }}
                        disabled={index === orderedSystemColumns.length - 1}
                        className={`p-0.5 rounded ${index === orderedSystemColumns.length - 1 ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer'}`}
                        title="Move down"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Custom Fields Section */}
            {columns.some(c => c.isCustom) && (
              <>
                <div className="px-4 py-2 mt-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-t border-gray-200">
                  Custom Fields
                </div>
                {columns.filter(c => c.isCustom).map((column) => {
                  const isVisible = visibleColumns[column.key]

                  return (
                    <div
                      key={column.key}
                      className="flex items-center px-4 py-1.5 hover:bg-gray-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => handleToggle(column.key)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isVisible ? (
                            <Eye size={12} className="text-green-600 flex-shrink-0" />
                          ) : (
                            <EyeOff size={12} className="text-gray-400 flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {column.label}
                          </span>
                          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            Custom
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
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
