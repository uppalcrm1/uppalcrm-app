import React, { useState, useEffect } from 'react'
import {
  Search,
  Filter,
  X,
  ChevronDown,
  Calendar,
  DollarSign,
  User,
  RefreshCw
} from 'lucide-react'

const LeadFilters = ({ filters, onFiltersChange, statuses, users, loading }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [localFilters, setLocalFilters] = useState(filters)

  // Debounce filter updates
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onFiltersChange(localFilters)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [localFilters, onFiltersChange])

  const updateFilter = (key, value) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const clearAllFilters = () => {
    const clearedFilters = {
      search: '',
      status: '',
      priority: '',
      assignedTo: '',
      source: '',
      dateFrom: '',
      dateTo: '',
      valueMin: '',
      valueMax: ''
    }
    setLocalFilters(clearedFilters)
  }

  const getActiveFilterCount = () => {
    return Object.values(localFilters).filter(value => value && value !== '').length
  }

  const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' }
  ]

  const SOURCE_OPTIONS = [
    { value: 'website', label: 'Website' },
    { value: 'referral', label: 'Referral' },
    { value: 'social', label: 'Social Media' },
    { value: 'cold-call', label: 'Cold Call' },
    { value: 'email', label: 'Email' },
    { value: 'advertisement', label: 'Advertisement' },
    { value: 'trade-show', label: 'Trade Show' },
    { value: 'other', label: 'Other' }
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Search Bar - Always Visible */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search leads by name, email, or company..."
              value={localFilters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            {localFilters.search && (
              <button
                onClick={() => updateFilter('search', '')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          {/* Filter Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md transition-colors ${
                isExpanded || getActiveFilterCount() > 0
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              {getActiveFilterCount() > 0 && (
                <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] h-[18px] flex items-center justify-center">
                  {getActiveFilterCount()}
                </span>
              )}
              <ChevronDown
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            </button>

            {getActiveFilterCount() > 0 && (
              <button
                onClick={clearAllFilters}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Filters - Collapsible */}
      {isExpanded && (
        <div className="p-4 bg-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={localFilters.status}
                onChange={(e) => updateFilter('status', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All statuses</option>
                {statuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={localFilters.priority}
                onChange={(e) => updateFilter('priority', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All priorities</option>
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Assigned To Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                Assigned To
              </label>
              <select
                value={localFilters.assignedTo}
                onChange={(e) => updateFilter('assignedTo', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All users</option>
                <option value="unassigned">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Source Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source
              </label>
              <select
                value={localFilters.source}
                onChange={(e) => updateFilter('source', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All sources</option>
                {SOURCE_OPTIONS.map((source) => (
                  <option key={source.value} value={source.value}>
                    {source.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Created From
              </label>
              <input
                type="date"
                value={localFilters.dateFrom}
                onChange={(e) => updateFilter('dateFrom', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Created To
              </label>
              <input
                type="date"
                value={localFilters.dateTo}
                onChange={(e) => updateFilter('dateTo', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Value Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Min Value
              </label>
              <input
                type="number"
                placeholder="0"
                value={localFilters.valueMin}
                onChange={(e) => updateFilter('valueMin', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Max Value
              </label>
              <input
                type="number"
                placeholder="1000000"
                value={localFilters.valueMax}
                onChange={(e) => updateFilter('valueMax', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              {getActiveFilterCount() > 0 ? (
                `${getActiveFilterCount()} filter${getActiveFilterCount() !== 1 ? 's' : ''} applied`
              ) : (
                'No filters applied'
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={clearAllFilters}
                disabled={getActiveFilterCount() === 0}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear all
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Collapse
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
        </div>
      )}
    </div>
  )
}

export default LeadFilters