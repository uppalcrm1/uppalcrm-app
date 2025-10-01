import React, { useState } from 'react';
import {
  Edit3,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  MapPin,
  Users,
  Building2,
  Calendar,
  ExternalLink,
  Loader2
} from 'lucide-react';

export default function TrialSignupCard({
  signup,
  onStatusUpdate,
  onNotesUpdate,
  onConvert,
  isUpdating
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState(signup.notes || '');
  const [localUpdating, setLocalUpdating] = useState(false);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'contacted':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'qualified':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'converted':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

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
    setLocalUpdating(true);
    try {
      await onStatusUpdate(signup.id, newStatus);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
    setLocalUpdating(false);
  };

  const handleNotesUpdate = async () => {
    setLocalUpdating(true);
    try {
      await onNotesUpdate(signup.id, editedNotes);
      setIsEditingNotes(false);
    } catch (error) {
      console.error('Failed to update notes:', error);
    }
    setLocalUpdating(false);
  };

  const handleConvert = async () => {
    setLocalUpdating(true);
    try {
      await onConvert(signup.id);
    } catch (error) {
      console.error('Failed to convert signup:', error);
    }
    setLocalUpdating(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="h-12 w-12 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-lg font-medium text-white">
              {signup.full_name?.charAt(0) || 'U'}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{signup.full_name}</h3>
            <p className="text-sm text-gray-600">{signup.email}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={signup.status}
            onChange={(e) => handleStatusUpdate(e.target.value)}
            disabled={localUpdating || isUpdating}
            className="px-3 py-1 text-sm font-medium rounded-full border focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="pending">Pending</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="converted">Converted</option>
            <option value="rejected">Rejected</option>
          </select>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Building2 className="h-4 w-4" />
          <span>{signup.company || 'No company'}</span>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Users className="h-4 w-4" />
          <span>{signup.team_size || 'Not specified'} team</span>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <MapPin className="h-4 w-4" />
          <span>{signup.industry || 'Not specified'}</span>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Calendar className="h-4 w-4" />
          <span>{formatDate(signup.created_at)}</span>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center justify-between mb-4">
        <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(signup.status)}`}>
          {signup.status.charAt(0).toUpperCase() + signup.status.slice(1)}
        </span>

        {signup.status === 'qualified' && (
          <button
            onClick={handleConvert}
            disabled={localUpdating || isUpdating}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {localUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            <span>Convert to Organization</span>
          </button>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray-200 pt-4 space-y-4">
          {/* UTM Parameters */}
          {(signup.utm_source || signup.utm_medium || signup.utm_campaign) && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Marketing Attribution</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                {signup.utm_source && (
                  <div className="bg-gray-50 px-3 py-2 rounded">
                    <span className="font-medium">Source:</span> {signup.utm_source}
                  </div>
                )}
                {signup.utm_medium && (
                  <div className="bg-gray-50 px-3 py-2 rounded">
                    <span className="font-medium">Medium:</span> {signup.utm_medium}
                  </div>
                )}
                {signup.utm_campaign && (
                  <div className="bg-gray-50 px-3 py-2 rounded">
                    <span className="font-medium">Campaign:</span> {signup.utm_campaign}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Notes</h4>
              {!isEditingNotes ? (
                <button
                  onClick={() => setIsEditingNotes(true)}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleNotesUpdate}
                    disabled={localUpdating || isUpdating}
                    className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                  >
                    {localUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingNotes(false);
                      setEditedNotes(signup.notes || '');
                    }}
                    className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {isEditingNotes ? (
              <textarea
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                placeholder="Add notes about this signup..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                rows={3}
              />
            ) : (
              <div className="bg-gray-50 px-3 py-2 rounded-lg min-h-[2.5rem] text-sm text-gray-700">
                {signup.notes || 'No notes added yet.'}
              </div>
            )}
          </div>

          {/* Additional Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Phone:</span>
              <span className="ml-2 text-gray-600">{signup.phone || 'Not provided'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Country:</span>
              <span className="ml-2 text-gray-600">{signup.country || 'Not provided'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}