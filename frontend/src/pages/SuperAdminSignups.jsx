import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  useSuperAdminTrialSignups,
  useUpdateSignupStatus,
  useAddSignupNotes,
  useConvertSignup,
  useDeleteSignup,
  useExtendTrial,
  useArchiveTrial,
  useConvertToPaid
} from '../contexts/SuperAdminContext';
import {
  Search,
  Filter,
  Download,
  Eye,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Building2,
  Mail,
  Phone,
  Globe,
  Calendar,
  TrendingUp,
  Loader2,
  ChevronDown,
  RefreshCw,
  Trash2
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'yellow' },
  { value: 'contacted', label: 'Contacted', color: 'blue' },
  { value: 'qualified', label: 'Qualified', color: 'purple' },
  { value: 'converted', label: 'Converted', color: 'green' },
  { value: 'rejected', label: 'Rejected', color: 'red' },
];

function StatusBadge({ status }) {
  const statusConfig = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  const colorClasses = {
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${colorClasses[statusConfig.color]}`}>
      {statusConfig.label}
    </span>
  );
}

function SignupCard({ signup, onUpdateStatus, onAddNotes, onConvert }) {
  const [showDetails, setShowDetails] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [notes, setNotes] = useState('');
  const [showNotesForm, setShowNotesForm] = useState(false);
  const [showConvertForm, setShowConvertForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [convertData, setConvertData] = useState({
    organization_name: signup.company,
    domain: '',
    admin_password: ''
  });

  const updateStatusMutation = useUpdateSignupStatus();
  const addNotesMutation = useAddSignupNotes();
  const convertMutation = useConvertSignup();
  const deleteMutation = useDeleteSignup();
  const extendTrialMutation = useExtendTrial();
  const archiveTrialMutation = useArchiveTrial();
  const convertToPaidMutation = useConvertToPaid();

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleStatusUpdate = async (newStatus) => {
    setIsUpdating(true);
    try {
      await updateStatusMutation.mutateAsync({
        id: signup.id,
        status: newStatus
      });
    } catch (error) {
      console.error('Failed to update status:', error);
    }
    setIsUpdating(false);
  };

  const handleAddNotes = async () => {
    if (!notes.trim()) return;

    try {
      await addNotesMutation.mutateAsync({
        id: signup.id,
        notes: notes.trim()
      });
      setNotes('');
      setShowNotesForm(false);
    } catch (error) {
      console.error('Failed to add notes:', error);
    }
  };

  const handleConvert = async () => {
    if (!convertData.organization_name || !convertData.domain || !convertData.admin_password) {
      return;
    }

    try {
      await convertMutation.mutateAsync({
        id: signup.id,
        ...convertData
      });
      setShowConvertForm(false);
    } catch (error) {
      console.error('Failed to convert signup:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(signup.id);
      setShowDeleteConfirm(false);
      toast.success(`Trial signup deleted successfully. ${signup.email} can now resubmit.`);
    } catch (error) {
      console.error('Failed to delete signup:', error);
      toast.error(error.message || 'Failed to delete trial signup');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Main Card */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-lg font-medium text-white">
                {signup.full_name?.charAt(0) || 'U'}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{signup.full_name}</h3>
              <p className="text-sm text-gray-600">{signup.company}</p>
              <div className="flex items-center space-x-2 mt-1">
                <StatusBadge status={signup.status} />
                {signup.is_recent && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    New
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="View details"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowNotesForm(!showNotesForm)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Add notes"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete signup"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Mail className="h-4 w-4" />
            <span>{signup.email}</span>
          </div>
          {signup.phone && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Phone className="h-4 w-4" />
              <span>{signup.phone}</span>
            </div>
          )}
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(signup.created_at)}</span>
          </div>
        </div>

        {/* Trial Info (if converted) */}
        {signup.status === 'converted' && signup.trial_end_date && (
          <div className={`mb-4 p-3 rounded-lg border ${
            signup.trial_urgency_color === 'red' ? 'bg-red-50 border-red-200' :
            signup.trial_urgency_color === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
            'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Trial: </span>
                  <span className={`font-semibold ${
                    signup.trial_urgency_color === 'red' ? 'text-red-700' :
                    signup.trial_urgency_color === 'yellow' ? 'text-yellow-700' :
                    'text-green-700'
                  }`}>
                    {signup.is_expired ? 'Expired' : `${signup.days_remaining} days remaining`}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Ends: {formatDate(signup.trial_end_date)}
                </div>
                {signup.trial_extended && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Extended {signup.trial_extension_count}x
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={async () => {
                    if (!signup.organization_id) {
                      toast.error('Organization ID not found');
                      return;
                    }
                    try {
                      await convertToPaidMutation.mutateAsync(signup.organization_id);
                      toast.success('Converted to paid account!');
                    } catch (error) {
                      toast.error('Failed to convert to paid');
                    }
                  }}
                  disabled={convertToPaidMutation.isPending}
                  className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {convertToPaidMutation.isPending ? 'Converting...' : 'Convert to Paid'}
                </button>
                {signup.can_extend && !signup.is_expired && (
                  <button
                    onClick={async () => {
                      try {
                        await extendTrialMutation.mutateAsync({ id: signup.id });
                        toast.success('Trial extended by 30 days');
                      } catch (error) {
                        toast.error('Failed to extend trial');
                      }
                    }}
                    disabled={extendTrialMutation.isPending}
                    className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {extendTrialMutation.isPending ? 'Extending...' : 'Extend +30 Days'}
                  </button>
                )}
                {signup.is_expired && (
                  <button
                    onClick={async () => {
                      try {
                        await archiveTrialMutation.mutateAsync(signup.id);
                        toast.success('Trial archived');
                      } catch (error) {
                        toast.error('Failed to archive trial');
                      }
                    }}
                    disabled={archiveTrialMutation.isPending}
                    className="px-3 py-1 text-xs font-medium bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    {archiveTrialMutation.isPending ? 'Archiving...' : 'Archive'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status.value}
                onClick={() => handleStatusUpdate(status.value)}
                disabled={isUpdating || signup.status === status.value}
                className={`
                  px-3 py-1 text-xs font-medium rounded-full transition-colors
                  ${signup.status === status.value
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : status.label}
              </button>
            ))}
          </div>

          {signup.status !== 'converted' && (
            <button
              onClick={() => setShowConvertForm(!showConvertForm)}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              Convert to Org
            </button>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {showDetails && (
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Contact Information</h4>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Industry:</span> {signup.industry || 'Not specified'}</div>
                <div><span className="font-medium">Team Size:</span> {signup.team_size || 'Not specified'}</div>
                {signup.website && (
                  <div className="flex items-center space-x-2">
                    <Globe className="h-4 w-4" />
                    <a href={signup.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {signup.website}
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">Marketing Data</h4>
              <div className="space-y-2 text-sm">
                {signup.utm_source && <div><span className="font-medium">Source:</span> {signup.utm_source}</div>}
                {signup.utm_campaign && <div><span className="font-medium">Campaign:</span> {signup.utm_campaign}</div>}
                {signup.utm_medium && <div><span className="font-medium">Medium:</span> {signup.utm_medium}</div>}
              </div>
            </div>
          </div>

          {signup.notes && (
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-3">Notes</h4>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap">{signup.notes}</pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notes Form */}
      {showNotesForm && (
        <div className="border-t border-gray-200 p-6">
          <h4 className="font-medium text-gray-900 mb-3">Add Notes</h4>
          <div className="space-y-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your notes here..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={3}
            />
            <div className="flex items-center space-x-3">
              <button
                onClick={handleAddNotes}
                disabled={!notes.trim() || addNotesMutation.isLoading}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addNotesMutation.isLoading ? 'Adding...' : 'Add Notes'}
              </button>
              <button
                onClick={() => {
                  setShowNotesForm(false);
                  setNotes('');
                }}
                className="px-4 py-2 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert Form */}
      {showConvertForm && (
        <div className="border-t border-gray-200 p-6">
          <h4 className="font-medium text-gray-900 mb-3">Convert to Organization</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
              <input
                type="text"
                value={convertData.organization_name}
                onChange={(e) => setConvertData({ ...convertData, organization_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
              <input
                type="text"
                value={convertData.domain}
                onChange={(e) => setConvertData({ ...convertData, domain: e.target.value })}
                placeholder="e.g., mycompany"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password</label>
              <input
                type="password"
                value={convertData.admin_password}
                onChange={(e) => setConvertData({ ...convertData, admin_password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-3 mt-4">
            <button
              onClick={handleConvert}
              disabled={!convertData.organization_name || !convertData.domain || !convertData.admin_password || convertMutation.isLoading}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {convertMutation.isLoading ? 'Converting...' : 'Convert to Organization'}
            </button>
            <button
              onClick={() => setShowConvertForm(false)}
              className="px-4 py-2 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Trial Signup</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-2">
                Are you sure you want to delete this trial signup?
              </p>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-900">{signup.full_name}</p>
                <p className="text-sm text-gray-600">{signup.email}</p>
                <p className="text-sm text-gray-600">{signup.company}</p>
              </div>
              <p className="text-sm text-gray-500 mt-3">
                This will allow the user to submit a new trial request with the same email address.
              </p>
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
                    Delete Signup
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

export default function SuperAdminSignups() {
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    utm_source: '',
    page: 1,
    limit: 20
  });

  const { data, isLoading, error, refetch } = useSuperAdminTrialSignups(filters);

  const signups = data?.signups || [];
  const pagination = data?.pagination || {};

  const filteredSignups = useMemo(() => {
    return signups.filter(signup => {
      return (
        (!filters.search ||
         signup.full_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
         signup.company?.toLowerCase().includes(filters.search.toLowerCase()) ||
         signup.email?.toLowerCase().includes(filters.search.toLowerCase())) &&
        (!filters.status || signup.status === filters.status) &&
        (!filters.utm_source || signup.utm_source === filters.utm_source)
      );
    });
  }, [signups, filters]);

  const stats = useMemo(() => {
    const total = signups.length;
    const pending = signups.filter(s => s.status === 'pending').length;
    const contacted = signups.filter(s => s.status === 'contacted').length;
    const converted = signups.filter(s => s.status === 'converted').length;
    const rejected = signups.filter(s => s.status === 'rejected').length;

    return { total, pending, contacted, converted, rejected };
  }, [signups]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Trial Signups</h3>
          <p className="text-gray-600 mb-4">{error.message}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trial Signups</h1>
          <p className="text-gray-600">Manage and convert trial signups to organizations</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Total</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-gray-600">Pending</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">{stats.contacted}</div>
          <div className="text-sm text-gray-600">Contacted</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-2xl font-bold text-green-600">{stats.converted}</div>
          <div className="text-sm text-gray-600">Converted</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          <div className="text-sm text-gray-600">Rejected</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                placeholder="Name, company, email..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
            <select
              value={filters.utm_source}
              onChange={(e) => setFilters({ ...filters, utm_source: e.target.value, page: 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Sources</option>
              <option value="google">Google</option>
              <option value="facebook">Facebook</option>
              <option value="linkedin">LinkedIn</option>
              <option value="direct">Direct</option>
              <option value="organic">Organic</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: '', search: '', utm_source: '', page: 1, limit: 20 })}
              className="w-full px-4 py-2 text-gray-600 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Signups List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : filteredSignups.length > 0 ? (
        <div className="space-y-4">
          {filteredSignups.map((signup) => (
            <SignupCard key={signup.id} signup={signup} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No trial signups found</h3>
          <p className="text-gray-600">Try adjusting your filters or check back later for new signups.</p>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between bg-white px-6 py-3 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm text-gray-700">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
              disabled={filters.page <= 1}
              className="px-3 py-1 text-sm font-medium text-gray-600 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm font-medium text-gray-900">
              Page {filters.page} of {pagination.pages}
            </span>
            <button
              onClick={() => setFilters({ ...filters, page: Math.min(pagination.pages, filters.page + 1) })}
              disabled={filters.page >= pagination.pages}
              className="px-3 py-1 text-sm font-medium text-gray-600 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}