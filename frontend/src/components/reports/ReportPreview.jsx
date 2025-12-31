import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner';

/**
 * ReportPreview Component
 * Displays report results in a table format with sorting and pagination
 */
const ReportPreview = ({ data = [], isLoading = false, error = null, fields = [] }) => {
  const [sortBy, setSortBy] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Handle sorting
  const handleSort = (fieldName) => {
    if (sortBy === fieldName) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(fieldName);
      setSortDirection('asc');
    }
  };

  // Sort data
  const sortedData = React.useMemo(() => {
    if (!sortBy || !data) return data || [];

    return [...data].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let comparison = 0;
      if (typeof aVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else {
        comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortBy, sortDirection]);

  // Paginate data
  const paginatedData = React.useMemo(() => {
    if (!sortedData) return [];
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return sortedData.slice(start, end);
  }, [sortedData, currentPage]);

  const totalPages = Math.ceil((sortedData?.length || 0) / itemsPerPage);

  // Format cell value
  const formatValue = (value, fieldName) => {
    if (value == null || value === '') return '-';

    // Get field metadata
    const field = fields.find(f => f.name === fieldName);

    // Format dates
    if (field?.type === 'date') {
      try {
        const date = new Date(value);
        return date.toLocaleDateString();
      } catch {
        return value;
      }
    }

    // Format numbers
    if (field?.type === 'number') {
      // Check if it's a currency field
      if (fieldName.includes('amount') || fieldName.includes('value') || fieldName.includes('price')) {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(value);
      }
      return value.toLocaleString();
    }

    // Truncate long text
    if (typeof value === 'string' && value.length > 50) {
      return (
        <span title={value}>
          {value.substring(0, 47)}...
        </span>
      );
    }

    return value;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-600 text-lg font-semibold mb-2">Error Loading Report</div>
          <div className="text-gray-600 text-sm">{error.message || 'An error occurred'}</div>
        </div>
      </div>
    );
  }

  // No data state
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg">
        <div className="text-center">
          <div className="text-gray-500 text-lg font-medium mb-2">No Data</div>
          <div className="text-gray-400 text-sm">
            Run the report to see results here
          </div>
        </div>
      </div>
    );
  }

  // Get column headers from first row of data or from fields
  const columns = fields.length > 0
    ? fields.map(f => ({ name: f.name, label: f.label }))
    : Object.keys(data[0] || {}).map(key => ({ name: key, label: key }));

  return (
    <div className="flex flex-col h-full">
      {/* Results summary */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing <span className="font-semibold">{paginatedData.length}</span> of{' '}
            <span className="font-semibold">{sortedData.length}</span> results
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.name}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort(col.name)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{col.label}</span>
                    {sortBy === col.name && (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td
                    key={col.name}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                  >
                    {formatValue(row[col.name], col.name)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportPreview;
