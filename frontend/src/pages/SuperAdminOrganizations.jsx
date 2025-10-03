import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  useSuperAdminOrganizations,
  useDeleteOrganization,
  useExtendTrial,
  useFixTrialData,
  useConvertToPaid
} from '../contexts/SuperAdminContext';
import {
  Search,
  Building2,
  Users,
  Calendar,
  Globe,
  Loader2,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Clock,
  Filter,
  ArrowUp,
  CheckCircle
} from 'lucide-react';

function OrganizationCard({ organization }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const deleteMutation = useDeleteOrganization();
  const extendTrialMutation = useExtendTrial();
  const convertToPaidMutation = useConvertToPaid();

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(organization.id);
      setShowDeleteConfirm(false);
      toast.success(`Organization "${organization.name}" deleted successfully`);
    } catch (error) {
      console.error('Failed to delete organization:', error);
      toast.error(error.message || 'Failed to delete organization');
    }
  };

  const handleExtendTrial = async () => {
    // Find the trial signup for this organization
    try {
      // We'll need to pass the trial signup ID, not org ID
      // For now, show a message - will need to enhance the API
      toast.error('Trial extension requires trial signup ID. Use Trial Signups page instead.');
    } catch (error) {
      toast.error('Failed to extend trial');
    }
  };

  const handleConvertToPaid = async () => {
    try {
      await convertToPaidMutation.mutateAsync(organization.id);
      setShowConvertConfirm(false);
      toast.success(`"${organization.name}" successfully converted to paid!`);
    } catch (error) {
      console.error('Failed to convert to paid:', error);
      toast.error(error.message || 'Failed to convert to paid');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">{organization.name}</h3>
              {organization.is_trial ? (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                  TRIAL
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                  {organization.subscription_plan?.toUpperCase() || 'FREE'}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">/{organization.slug}</p>
            {organization.domain && (
              <div className="flex items-center space-x-1 mt-1">
                <Globe className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-500">{organization.domain}</span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Delete organization"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Trial Expiry Info */}
      {organization.is_trial && organization.trial_expires_at && (
        <div className={`mb-4 p-3 rounded-lg border ${
          organization.urgency_color === 'gray' ? 'bg-gray-50 border-gray-200' :
          organization.urgency_color === 'red' ? 'bg-red-50 border-red-200' :
          organization.urgency_color === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
          'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Clock className={`h-4 w-4 ${
                organization.urgency_color === 'gray' ? 'text-gray-500' :
                organization.urgency_color === 'red' ? 'text-red-600' :
                organization.urgency_color === 'yellow' ? 'text-yellow-600' :
                'text-green-600'
              }`} />
              <div className="text-sm">
                <span className="font-medium text-gray-700">Trial expires: </span>
                <span className={`font-semibold ${
                  organization.urgency_color === 'gray' ? 'text-gray-700' :
                  organization.urgency_color === 'red' ? 'text-red-700' :
                  organization.urgency_color === 'yellow' ? 'text-yellow-700' :
                  'text-green-700'
                }`}>
                  {organization.days_remaining === 0 ? 'Expired' : `${organization.days_remaining} days remaining`}
                </span>
                <span className="text-gray-500 ml-2">({formatDate(organization.trial_expires_at)})</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConvertConfirm(true)}
                className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Convert to Paid
              </button>
              <button
                onClick={() => toast.info('Use Trial Signups page to extend trials')}
                className="px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                View in Trials
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Users className="h-4 w-4" />
          <span>{organization.active_user_count} / {organization.user_count} users</span>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Calendar className="h-4 w-4" />
          <span>{formatDate(organization.created_at)}</span>
        </div>
        <div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            organization.is_active
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {organization.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            organization.trial_status === 'expired' ? 'bg-gray-100 text-gray-800' :
            organization.trial_status === 'active' ? 'bg-blue-100 text-blue-800' :
            'bg-purple-100 text-purple-800'
          }`}>
            {organization.trial_status || 'Active'}
          </span>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showConvertConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Convert to Paid Account</h3>
                <p className="text-sm text-gray-500">Mark this organization as paid</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                Mark this organization as paid? This will:
              </p>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-3">
                <p className="text-sm font-medium text-gray-900">{organization.name}</p>
                <p className="text-sm text-gray-600">Slug: {organization.slug}</p>
                <p className="text-sm text-gray-600">Plan: {organization.subscription_plan?.toUpperCase() || 'STARTER'}</p>
              </div>
              <ul className="text-sm text-green-600 space-y-1">
                <li>✓ Remove trial restrictions</li>
                <li>✓ Set status to "Converted"</li>
                <li>✓ Send confirmation email to admin</li>
                <li>✓ Grant full access to all features</li>
              </ul>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleConvertToPaid}
                disabled={convertToPaidMutation.isPending}
                className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {convertToPaidMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Converting...
                  </>
                ) : (
                  'Convert to Paid'
                )}
              </button>
              <button
                onClick={() => setShowConvertConfirm(false)}
                disabled={convertToPaidMutation.isPending}
                className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Organization</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                Are you sure you want to delete this organization? This will permanently delete:
              </p>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-3">
                <p className="text-sm font-medium text-gray-900">{organization.name}</p>
                <p className="text-sm text-gray-600">Slug: {organization.slug}</p>
                <p className="text-sm text-gray-600">Users: {organization.user_count}</p>
              </div>
              <ul className="text-sm text-red-600 space-y-1">
                <li>• All {organization.user_count} users</li>
                <li>• All leads and contacts</li>
                <li>• All custom fields and settings</li>
                <li>• All organization data</li>
              </ul>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {deleteMutation.isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Organization
                  </>
                )}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteMutation.isLoading}
                className="flex-1 px-4 py-2 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100 border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SuperAdminOrganizations() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, trial, paid, expired
  const { data, isLoading, error, refetch } = useSuperAdminOrganizations();
  const fixTrialDataMutation = useFixTrialData();

  const organizations = data?.organizations || [];

  // Filter organizations based on search and type
  const filteredOrganizations = useMemo(() => {
    let filtered = organizations;

    // Apply type filter
    if (filterType === 'trial') {
      filtered = filtered.filter(org => org.is_trial && org.trial_status === 'active');
    } else if (filterType === 'paid') {
      filtered = filtered.filter(org => !org.is_trial || org.trial_status === 'converted');
    } else if (filterType === 'expired') {
      filtered = filtered.filter(org => org.is_trial && org.trial_status === 'expired');
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(org =>
        org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (org.domain && org.domain.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    return filtered;
  }, [organizations, searchTerm, filterType]);

  const stats = {
    total: organizations.length,
    trial: organizations.filter(org => org.is_trial && org.trial_status === 'active').length,
    paid: organizations.filter(org => !org.is_trial || org.trial_status === 'converted').length,
    expired: organizations.filter(org => org.is_trial && org.trial_status === 'expired').length,
    active: organizations.filter(org => org.is_active).length,
    totalUsers: organizations.reduce((sum, org) => sum + (org.user_count || 0), 0)
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error loading organizations: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organizations <span className="text-xs text-green-600 font-normal">(v1.0.2)</span></h1>
          <p className="text-gray-600">Manage all organizations in the platform</p>
        </div>

        {stats.trial === 0 && stats.total > 0 && (
          <button
            onClick={async () => {
              console.log('🔧 Fix Trial Data button clicked');
              try {
                console.log('📤 Calling fixTrialDataMutation...');
                const result = await fixTrialDataMutation.mutateAsync();
                console.log('✅ Success:', result);
                console.log('📊 Before state:', result.before_state);
                console.log('📊 Updated orgs:', result.organizations);
                if (result.updated_count === 0) {
                  toast.error('No organizations were updated. Check console for current state.');
                } else {
                  toast.success(`Updated ${result.updated_count} organizations!`);
                }
              } catch (error) {
                console.error('❌ Error:', error);
                toast.error(error.message || 'Failed to fix trial data');
              }
            }}
            disabled={fixTrialDataMutation.isPending}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {fixTrialDataMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Fixing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Fix Trial Data
              </>
            )}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Organizations</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Building2 className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Trials</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.trial}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Paid Organizations</p>
              <p className="text-2xl font-bold text-purple-600">{stats.paid}</p>
            </div>
            <ArrowUp className="h-8 w-8 text-purple-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Expired Trials</p>
              <p className="text-2xl font-bold text-gray-600">{stats.expired}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-indigo-600">{stats.totalUsers}</p>
            </div>
            <Users className="h-8 w-8 text-indigo-400" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search organizations by name, slug, or domain..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white appearance-none cursor-pointer"
              >
                <option value="all">All Organizations</option>
                <option value="trial">Trial Only ({stats.trial})</option>
                <option value="paid">Paid Only ({stats.paid})</option>
                <option value="expired">Expired Trials ({stats.expired})</option>
              </select>
            </div>

            <button
              onClick={() => refetch()}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Active Filter Indicator */}
        {filterType !== 'all' && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-gray-600">Showing:</span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
              {filterType === 'trial' && `Active Trials (${filteredOrganizations.length})`}
              {filterType === 'paid' && `Paid Organizations (${filteredOrganizations.length})`}
              {filterType === 'expired' && `Expired Trials (${filteredOrganizations.length})`}
            </span>
            <button
              onClick={() => setFilterType('all')}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              Clear filter
            </button>
          </div>
        )}
      </div>

      {/* Organizations List */}
      <div className="space-y-4">
        {filteredOrganizations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">
              {searchTerm ? 'No organizations match your search' : 'No organizations found'}
            </p>
          </div>
        ) : (
          filteredOrganizations.map(org => (
            <OrganizationCard key={org.id} organization={org} />
          ))
        )}
      </div>
    </div>
  );
}
