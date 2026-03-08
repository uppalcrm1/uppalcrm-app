import React, { useMemo, useCallback } from 'react'
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react'
import ColumnSelector from '../ColumnSelector'
import InlineEditCell from '../InlineEditCell'

/**
 * DataTable — Shared table component for all CRM list views.
 *
 * Handles the "table shell": headers, pagination, checkboxes, bulk action bar,
 * column selector, empty/loading states. The caller owns all business-specific
 * rendering via renderCell and renderRowActions.
 *
 * Phase 1: Extracted from LeadListTable.jsx (the most feature-complete module).
 * Phase 2 will migrate Contacts, Accounts, and Transactions.
 */
const DataTable = ({
  // Data
  data = [],
  loading = false,
  entityName = 'Record',
  entityType,

  // Row identification
  rowKey = 'id',

  // Columns
  columns = [],
  visibleColumns = {},
  onColumnToggle,
  onColumnsReset,

  // Sorting
  sortConfig = { key: null, direction: 'asc' },
  onSort,

  // Pagination
  pagination = { page: 1, limit: 20, total: 0 },
  onPaginationChange,
  pageSizeOptions = [10, 20, 50, 100],

  // Selection & Bulk Actions
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  bulkActions = [],

  // Cell Rendering
  renderCell,
  renderRowActions,

  // Row Styling
  getRowClassName,

  // Inline Editing (for custom fields)
  onInlineEdit,

  // Empty State
  emptyIcon: EmptyIcon,
  emptyMessage = 'No records found',
  emptySubMessage = 'Try adjusting your filters',
}) => {
  // Resolve entityType for InlineEditCell
  const resolvedEntityType = entityType || (entityName.toLowerCase() + 's')

  // Get unique key for a row
  const getRowKey = useCallback((row) => {
    if (typeof rowKey === 'function') return rowKey(row)
    return row[rowKey]
  }, [rowKey])

  // Visible columns split
  const visibleSystemColumns = useMemo(() =>
    columns.filter(col => !col.isCustom && visibleColumns[col.key]),
    [columns, visibleColumns]
  )

  const visibleCustomColumns = useMemo(() =>
    columns.filter(col => col.isCustom && visibleColumns[col.key]),
    [columns, visibleColumns]
  )

  // Entity labels
  const entityCount = pagination.total || 0
  const entityLabel = entityCount === 1 ? entityName : `${entityName}s`

  // Selection handlers
  const handleSelectAll = useCallback((checked) => {
    if (!onSelectionChange) return
    if (checked) {
      onSelectionChange(data.map(row => getRowKey(row)))
    } else {
      onSelectionChange([])
    }
  }, [data, getRowKey, onSelectionChange])

  const handleSelectRow = useCallback((rowId, checked) => {
    if (!onSelectionChange) return
    if (checked) {
      onSelectionChange([...selectedIds, rowId])
    } else {
      onSelectionChange(selectedIds.filter(id => id !== rowId))
    }
  }, [selectedIds, onSelectionChange])

  // SortableHeader sub-component
  const SortableHeader = ({ children, sortKey, className = '' }) => (
    <th
      className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 ${className}`}
      onClick={() => onSort && onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortConfig.key === sortKey && (
          sortConfig.direction === 'asc' ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )
        )}
      </div>
    </th>
  )

  // Pagination controls sub-component
  const PaginationControls = () => {
    const totalPages = Math.ceil(pagination.total / pagination.limit)
    const currentPage = pagination.page || 1

    const handlePageChange = (newPage) => {
      if (onPaginationChange) {
        onPaginationChange({
          ...pagination,
          page: newPage
        })
      }
    }

    const handleLimitChange = (newLimit) => {
      if (onPaginationChange) {
        onPaginationChange({
          ...pagination,
          limit: newLimit,
          page: 1
        })
      }
    }

    return (
      <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-700">
            Showing {((currentPage - 1) * pagination.limit) + 1} to{' '}
            {Math.min(currentPage * pagination.limit, pagination.total)} of{' '}
            {pagination.total} results
          </span>

          <select
            value={pagination.limit}
            onChange={(e) => handleLimitChange(parseInt(e.target.value))}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>{size} per page</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <span className="text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // Render custom field cell with InlineEditCell (generic across all modules)
  const renderCustomFieldCell = (row, column) => {
    const customValue = row.custom_fields?.[column.key]

    if (onInlineEdit && column.editable !== false) {
      const commonProps = {
        value: customValue,
        fieldName: column.key,
        recordId: getRowKey(row),
        entityType: resolvedEntityType,
        onSave: onInlineEdit,
        className: 'text-sm',
        isCustomField: true,
      }

      if (column.fieldType === 'select' && column.fieldOptions) {
        return (
          <InlineEditCell
            {...commonProps}
            fieldType="select"
            options={column.fieldOptions.map(opt =>
              typeof opt === 'string' ? { value: opt, label: opt } : opt
            )}
          />
        )
      }

      return (
        <InlineEditCell
          {...commonProps}
          fieldType={column.fieldType || 'text'}
        />
      )
    }

    // Read-only display for non-editable custom fields
    return <span className="text-sm text-gray-600">{customValue || '—'}</span>
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">Loading {entityName.toLowerCase()}s...</div>
      </div>
    )
  }

  return (
    <div className="bg-white">
      {/* Toolbar */}
      <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {entityCount} {entityLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ColumnSelector
            columns={columns}
            visibleColumns={visibleColumns}
            onColumnToggle={onColumnToggle}
            onReset={onColumnsReset}
          />
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectable && selectedIds.length > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-blue-800">
            {selectedIds.length} {entityName.toLowerCase()}{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            {bulkActions.map((action, idx) => {
              const Icon = action.icon
              return (
                <button
                  key={idx}
                  onClick={action.onClick}
                  className={`px-3 py-1 text-sm rounded flex items-center gap-1 ${
                    action.variant === 'danger'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {action.label}
                </button>
              )
            })}
            <button
              onClick={() => onSelectionChange([])}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* Select All Checkbox */}
              {selectable && (
                <th className="px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === data.length && data.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
              )}

              {/* System Column Headers */}
              {visibleSystemColumns.map(column => {
                if (column.sortable === false) {
                  return (
                    <th key={column.key} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {column.label}
                    </th>
                  )
                }
                return (
                  <SortableHeader key={column.key} sortKey={column.sortKey || column.key}>
                    {column.label}
                  </SortableHeader>
                )
              })}

              {/* Custom Field Column Headers */}
              {visibleCustomColumns.map(column => (
                <th key={column.key} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {column.label}
                </th>
              ))}

              {/* Actions Header */}
              {renderRowActions && (
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row) => {
              const rowId = getRowKey(row)
              const isSelected = selectable && selectedIds.includes(rowId)
              const extraClassName = getRowClassName ? getRowClassName(row) : ''

              return (
                <tr key={rowId} className={`${isSelected ? 'bg-blue-50' : ''} ${extraClassName}`}>
                  {/* Row Checkbox */}
                  {selectable && (
                    <td className="px-3 py-3 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectRow(rowId, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                  )}

                  {/* System Column Cells */}
                  {visibleSystemColumns.map(column => (
                    <td key={column.key} className={column.cellClassName || 'px-3 py-3 whitespace-nowrap'}>                     
                      {renderCell(row, column)}
                    </td>
                  ))}

                  {/* Custom Field Cells */}
                  {visibleCustomColumns.map(column => (
                    <td key={column.key} className="px-3 py-3 whitespace-nowrap">
                      {renderCustomFieldCell(row, column)}
                    </td>
                  ))}

                  {/* Row Actions */}
                  {renderRowActions && (
                    <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
                      {renderRowActions(row)}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Empty State */}
        {data.length === 0 && (
          <div className="text-center py-12">
            {EmptyIcon && <EmptyIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />}
            <div className="text-gray-500 mb-2">{emptyMessage}</div>
            <div className="text-sm text-gray-400">{emptySubMessage}</div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.total > 0 && <PaginationControls />}
    </div>
  )
}

export default DataTable
