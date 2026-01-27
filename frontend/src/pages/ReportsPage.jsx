import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileBarChart, Plus, Star, Play, Edit, Trash2, Search, Filter, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { reportsAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

/**
 * Reports Page - List all saved reports
 */
const ReportsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [viewMode, setViewMode] = useState('all'); // 'all', 'standard', 'custom'

  // Fetch saved reports
  const { data: reportsData, isLoading } = useQuery({
    queryKey: ['savedReports', { favorite: filterFavorites || undefined }],
    queryFn: () => reportsAPI.getSavedReports({ favorite: filterFavorites || undefined })
  });

  // Delete report mutation
  const deleteReportMutation = useMutation({
    mutationFn: (id) => reportsAPI.deleteSavedReport(id),
    onSuccess: () => {
      toast.success('Report deleted successfully!');
      queryClient.invalidateQueries(['savedReports']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete report');
    }
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: (id) => reportsAPI.toggleFavorite(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['savedReports']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update favorite status');
    }
  });

  const handleDeleteReport = (id, name) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteReportMutation.mutate(id);
    }
  };

  const handleToggleFavorite = (e, id) => {
    e.stopPropagation();
    toggleFavoriteMutation.mutate(id);
  };

  const handleRunReport = (e, id) => {
    e.stopPropagation();
    navigate(`/reports/builder/${id}`);
  };

  // Filter reports by search term
  const filteredReports = React.useMemo(() => {
    if (!reportsData?.data) return [];

    return reportsData.data.filter(report => {
      const matchesSearch = !searchTerm ||
        report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.description?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
  }, [reportsData, searchTerm]);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FileBarChart className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        </div>

        <button
          onClick={() => navigate('/reports/builder')}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Create New Report</span>
        </button>
      </div>

      {/* Standard Reports Section */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Standard Reports</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Transactions by Source Report */}
          <div
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/reports/transactions-by-source')}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Transactions by Source</h3>
                <p className="text-sm text-gray-500 mt-1">
                  View transaction count grouped by source
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <span className="text-sm text-gray-600">Pre-built standard report</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/reports/transactions-by-source');
                }}
                className="btn btn-secondary flex items-center space-x-2 text-sm"
              >
                <Play className="h-3 w-3" />
                <span>View</span>
              </button>
            </div>
          </div>

          {/* Transactions Revenue by Source Report */}
          <div
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/reports/transactions-revenue-by-source')}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Transactions Revenue by Source</h3>
                <p className="text-sm text-gray-500 mt-1">
                  View revenue volume grouped by source
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <span className="text-sm text-gray-600">Pre-built standard report</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/reports/transactions-revenue-by-source');
                }}
                className="btn btn-secondary flex items-center space-x-2 text-sm"
              >
                <Play className="h-3 w-3" />
                <span>View</span>
              </button>
            </div>
          </div>

          {/* Transaction Count by Owner Report */}
          <div
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/reports/transactions-count-by-owner')}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Transaction Count by Owner</h3>
                <p className="text-sm text-gray-500 mt-1">
                  View transaction count by lead owner at conversion time
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <span className="text-sm text-gray-600">Pre-built standard report</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/reports/transactions-count-by-owner');
                }}
                className="btn btn-secondary flex items-center space-x-2 text-sm"
              >
                <Play className="h-3 w-3" />
                <span>View</span>
              </button>
            </div>
          </div>

          {/* Transaction Revenue by Owner Report */}
          <div
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/reports/transactions-revenue-by-owner')}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Transaction Revenue by Owner</h3>
                <p className="text-sm text-gray-500 mt-1">
                  View revenue by lead owner at conversion time
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <span className="text-sm text-gray-600">Pre-built standard report</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/reports/transactions-revenue-by-owner');
                }}
                className="btn btn-secondary flex items-center space-x-2 text-sm"
              >
                <Play className="h-3 w-3" />
                <span>View</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Reports Section */}
      <div className="space-y-4 mt-8 pt-8 border-t border-gray-200">
        <div className="flex items-center space-x-2">
          <FileBarChart className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Custom Reports</h2>
        </div>

        {/* Filters and Search */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Favorite Filter */}
          <button
            onClick={() => setFilterFavorites(!filterFavorites)}
            className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition-colors ${
              filterFavorites
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Star className={`h-4 w-4 ${filterFavorites ? 'fill-current' : ''}`} />
            <span className="text-sm font-medium">Favorites Only</span>
          </button>
        </div>
      </div>

      {/* Reports Grid */}
      {filteredReports.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <FileBarChart className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || filterFavorites ? 'No reports found' : 'No reports yet'}
          </h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || filterFavorites
              ? 'Try adjusting your search or filters'
              : 'Create your first custom report to get started'}
          </p>
          <button
            onClick={() => navigate('/reports/builder')}
            className="btn btn-primary"
          >
            Create Your First Report
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => navigate(`/reports/builder/${report.id}`)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                      {report.name}
                    </h3>
                    {report.is_favorite && (
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                    )}
                  </div>
                  {report.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {report.description}
                    </p>
                  )}
                </div>

                <button
                  onClick={(e) => handleToggleFavorite(e, report.id)}
                  className="p-1 hover:bg-gray-100 rounded"
                  title={report.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star
                    className={`h-5 w-5 ${
                      report.is_favorite ? 'text-yellow-500 fill-current' : 'text-gray-400'
                    }`}
                  />
                </button>
              </div>

              {/* Metadata */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Data Source:</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {report.config?.dataSource || 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Fields:</span>
                  <span className="font-medium text-gray-900">
                    {report.config?.fields?.length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Filters:</span>
                  <span className="font-medium text-gray-900">
                    {report.config?.filters?.length || 0}
                  </span>
                </div>
              </div>

              {/* Usage Stats */}
              <div className="flex items-center justify-between text-xs text-gray-500 mb-4 pt-4 border-t border-gray-200">
                <span>
                  Last run: {formatDate(report.last_run_at)}
                </span>
                <span>
                  Runs: {report.run_count || 0}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => handleRunReport(e, report.id)}
                  className="flex-1 btn btn-secondary flex items-center justify-center space-x-2 text-sm"
                >
                  <Play className="h-3 w-3" />
                  <span>Run</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/reports/builder/${report.id}`);
                  }}
                  className="flex-1 btn btn-secondary flex items-center justify-center space-x-2 text-sm"
                >
                  <Edit className="h-3 w-3" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteReport(report.id, report.name);
                  }}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                  title="Delete report"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Created/Updated */}
              <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-400">
                Created {formatDate(report.created_at)}
                {report.updated_at !== report.created_at && (
                  <> · Updated {formatDate(report.updated_at)}</>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {filteredReports.length > 0 && (
        <div className="text-sm text-gray-500 text-center">
          Showing {filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''}
          {filterFavorites && ' (favorites only)'}
        </div>
      )}
      </div>
    </div>
  );
};

export default ReportsPage;
