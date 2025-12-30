import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Plus, Search, Star, Trash2, Edit, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { dashboardsAPI } from '../services/api';

/**
 * Custom Dashboards Page
 * List all saved dashboards with management actions
 */
const CustomDashboardsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch saved dashboards
  const { data: dashboardsData, isLoading } = useQuery({
    queryKey: ['savedDashboards'],
    queryFn: () => dashboardsAPI.getSavedDashboards()
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => dashboardsAPI.deleteSavedDashboard(id),
    onSuccess: () => {
      toast.success('Dashboard deleted successfully');
      queryClient.invalidateQueries(['savedDashboards']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete dashboard');
    }
  });

  // Set default mutation
  const setDefaultMutation = useMutation({
    mutationFn: (id) => dashboardsAPI.setDefaultDashboard(id),
    onSuccess: () => {
      toast.success('Dashboard set as default');
      queryClient.invalidateQueries(['savedDashboards']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to set default');
    }
  });

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleSetDefault = (id) => {
    setDefaultMutation.mutate(id);
  };

  // Filter dashboards by search term
  const dashboards = dashboardsData?.data || [];
  const filteredDashboards = dashboards.filter(dashboard =>
    dashboard.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dashboard.description && dashboard.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <LayoutGrid className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">My Dashboards</h1>
        </div>

        <button
          onClick={() => navigate('/custom-dashboards/builder')}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Create Dashboard</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search dashboards..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Dashboards Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading dashboards...</p>
        </div>
      ) : filteredDashboards.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <LayoutGrid className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? 'No dashboards found' : 'No dashboards yet'}
          </h3>
          <p className="text-gray-500 mb-4">
            {searchTerm
              ? 'Try adjusting your search terms'
              : 'Create your first custom dashboard to get started'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => navigate('/custom-dashboards/builder')}
              className="btn btn-primary inline-flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Create Dashboard</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDashboards.map((dashboard) => (
            <div
              key={dashboard.id}
              className="bg-white border border-gray-200 rounded-lg hover:shadow-lg transition-shadow overflow-hidden"
            >
              {/* Card Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {dashboard.name}
                      </h3>
                      {dashboard.is_default && (
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      )}
                    </div>
                    {dashboard.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {dashboard.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Widgets:</span>
                    <span className="font-medium text-gray-900">
                      {dashboard.layout?.widgets?.length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Updated:</span>
                    <span className="font-medium text-gray-900">
                      {new Date(dashboard.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => navigate(`/custom-dashboards/view/${dashboard.id}`)}
                    className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded"
                    title="View dashboard"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => navigate(`/custom-dashboards/builder/${dashboard.id}`)}
                    className="text-gray-600 hover:text-gray-800 p-1 hover:bg-gray-100 rounded"
                    title="Edit dashboard"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(dashboard.id, dashboard.name)}
                    className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded"
                    title="Delete dashboard"
                    disabled={deleteMutation.isLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {!dashboard.is_default && (
                  <button
                    onClick={() => handleSetDefault(dashboard.id)}
                    className="text-xs text-gray-600 hover:text-blue-600 hover:underline"
                    disabled={setDefaultMutation.isLoading}
                  >
                    Set as Default
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomDashboardsPage;
