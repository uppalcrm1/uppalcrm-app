import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Phone, Mail, Calendar, FileText, CheckSquare } from 'lucide-react';
import { leadInteractionsAPI } from '../services/api';

const INTERACTION_TYPES = [
  { value: 'call', label: 'Phone Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'meeting', label: 'Meeting', icon: Calendar },
  { value: 'note', label: 'Note', icon: FileText },
  { value: 'task', label: 'Task', icon: CheckSquare }
];

const OUTCOMES = [
  'Successful',
  'No Answer',
  'Voicemail Left',
  'Callback Requested',
  'Meeting Scheduled',
  'Not Interested',
  'Follow Up Required',
  'Information Sent'
];

const AddInteractionModal = ({ leadId, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    interaction_type: 'call',
    subject: '',
    description: '',
    outcome: '',
    scheduled_at: '',
    duration_minutes: '',
    priority: 'medium'
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () => leadInteractionsAPI.createInteraction(leadId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries(['leadInteractions', leadId]);
      queryClient.invalidateQueries(['leads']);
      onSuccess?.();
      onClose();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate();
  };

  const selectedType = INTERACTION_TYPES.find(t => t.value === formData.interaction_type);
  const IconComponent = selectedType?.icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            {IconComponent && <IconComponent className="w-6 h-6 text-blue-600" />}
            <h2 className="text-xl font-semibold text-gray-900">Log Interaction</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Interaction Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Type *
            </label>
            <div className="grid grid-cols-5 gap-2">
              {INTERACTION_TYPES.map(type => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, interaction_type: type.value })}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      formData.interaction_type === type.value
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Brief summary (optional)..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed notes about this interaction..."
              rows="5"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.description.length} characters
            </p>
          </div>

          {/* Outcome (for calls, emails, meetings) */}
          {['call', 'email', 'meeting'].includes(formData.interaction_type) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Outcome
              </label>
              <select
                value={formData.outcome}
                onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select outcome...</option>
                {OUTCOMES.map(outcome => (
                  <option key={outcome} value={outcome}>{outcome}</option>
                ))}
              </select>
            </div>
          )}

          {/* Duration (for calls and meetings) */}
          {['call', 'meeting'].includes(formData.interaction_type) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                min="0"
                placeholder="15"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Scheduled Date/Time (for tasks and meetings) */}
          {['task', 'meeting'].includes(formData.interaction_type) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {formData.interaction_type === 'task' ? 'Schedule For' : 'Meeting Date/Time'}
              </label>
              <input
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to mark as completed now
              </p>
            </div>
          )}

          {/* Priority (for tasks only) */}
          {formData.interaction_type === 'task' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority *
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: 'low' })}
                  className={`px-4 py-3 rounded-lg border-2 transition-colors text-sm font-medium ${
                    formData.priority === 'low'
                      ? 'border-gray-500 bg-gray-50 text-gray-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  ⚪ Low
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: 'medium' })}
                  className={`px-4 py-3 rounded-lg border-2 transition-colors text-sm font-medium ${
                    formData.priority === 'medium'
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  🟠 Medium
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: 'high' })}
                  className={`px-4 py-3 rounded-lg border-2 transition-colors text-sm font-medium ${
                    formData.priority === 'high'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  🔴 High
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {createMutation.isError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">
                {createMutation.error?.response?.data?.error || 'Failed to create interaction'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !formData.description}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createMutation.isPending ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  Saving...
                </>
              ) : (
                'Save Interaction'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddInteractionModal;
