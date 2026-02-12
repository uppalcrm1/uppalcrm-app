import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Calendar, AlertCircle } from 'lucide-react';

const AddTaskModal = ({ leadId, contactId, accountId, task, onClose, api }) => {
  const queryClient = useQueryClient();
  const isEditing = !!task;

  const [formData, setFormData] = useState({
    subject: task?.subject || '',
    description: task?.description || '',
    scheduled_at: task?.scheduled_at ? task.scheduled_at.slice(0, 16) : '',
    priority: task?.priority || 'medium',
    lead_id: task?.lead_id || leadId || null,
    contact_id: task?.contact_id || contactId || null,
    account_id: task?.account_id || accountId || null
  });

  const [errors, setErrors] = useState({});

  // Create/Update task mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (isEditing) {
        // For editing, use the lead-based endpoint if leadId exists
        if (formData.lead_id) {
          return api.updateTask(formData.lead_id, task.id, data);
        } else {
          // If no lead_id, we would need a general update endpoint
          // For now, throw error asking to use lead-based creation
          throw new Error('Cannot edit task without a lead ID');
        }
      } else {
        // For creation, use lead-based endpoint if leadId provided
        // Otherwise use general task creation endpoint
        if (formData.lead_id) {
          return api.createTask(formData.lead_id, data);
        } else {
          return api.taskAPI.createGeneralTask(data);
        }
      }
    },
    onSuccess: () => {
      // Invalidate relevant queries
      if (formData.lead_id) {
        queryClient.invalidateQueries(['tasks', formData.lead_id]);
      }
      queryClient.invalidateQueries(['tasks']);
      queryClient.invalidateQueries(['leads']);
      onClose();
    },
    onError: (error) => {
      console.error('Error saving task:', error);
    }
  });

  const validateForm = () => {
    const newErrors = {};

    if (!formData.subject.trim()) {
      newErrors.subject = 'Task subject is required';
    }

    if (!formData.scheduled_at) {
      newErrors.scheduled_at = 'Due date is required';
    }

    // Validate that at least one entity is selected
    if (!formData.lead_id && !formData.contact_id && !formData.account_id) {
      newErrors.entity = 'Task must be linked to at least one entity (Lead, Contact, or Account)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const submitData = {
      subject: formData.subject,
      description: formData.description,
      priority: formData.priority,
      scheduled_at: new Date(formData.scheduled_at).toISOString(),
      ...(formData.lead_id && { lead_id: formData.lead_id }),
      ...(formData.contact_id && { contact_id: formData.contact_id }),
      ...(formData.account_id && { account_id: formData.account_id })
    };

    saveMutation.mutate(submitData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Get minimum datetime (now)
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Task' : 'Add New Task'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={saveMutation.isPending}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task Subject *
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
              placeholder="e.g., Follow up with lead, Send proposal, Schedule meeting"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.subject ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={saveMutation.isPending}
              autoFocus
            />
            {errors.subject && (
              <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.subject}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Add any additional details or notes about this task..."
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={saveMutation.isPending}
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.description.length} characters
            </p>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date & Time *
            </label>
            <input
              type="datetime-local"
              value={formData.scheduled_at}
              onChange={(e) => handleChange('scheduled_at', e.target.value)}
              min={getMinDateTime()}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.scheduled_at ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={saveMutation.isPending}
            />
            {errors.scheduled_at && (
              <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.scheduled_at}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Choose when this task should be completed
            </p>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <div className="grid grid-cols-3 gap-3">
              {['low', 'medium', 'high'].map(priority => (
                <button
                  key={priority}
                  type="button"
                  onClick={() => handleChange('priority', priority)}
                  className={`px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                    formData.priority === priority
                      ? priority === 'high'
                        ? 'border-red-600 bg-red-50 text-red-700'
                        : priority === 'medium'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-600 bg-gray-50 text-gray-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                  disabled={saveMutation.isPending}
                >
                  {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
                </button>
              ))}
            </div>
          </div>

          {/* Entity Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Link to Entity *
              <span className="text-xs font-normal text-gray-500 ml-1">(at least one required)</span>
            </label>

            {/* Selected Entities - Show as chips */}
            {(formData.lead_id || formData.contact_id || formData.account_id) && (
              <div className="mb-3 flex flex-wrap gap-2">
                {formData.lead_id && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full">
                    <span className="text-sm text-blue-700">📌 Lead</span>
                    <button
                      type="button"
                      onClick={() => handleChange('lead_id', null)}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      ✕
                    </button>
                  </div>
                )}
                {formData.contact_id && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full">
                    <span className="text-sm text-green-700">👤 Contact</span>
                    <button
                      type="button"
                      onClick={() => handleChange('contact_id', null)}
                      className="text-green-500 hover:text-green-700"
                    >
                      ✕
                    </button>
                  </div>
                )}
                {formData.account_id && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-50 border border-purple-200 rounded-full">
                    <span className="text-sm text-purple-700">📊 Account</span>
                    <button
                      type="button"
                      onClick={() => handleChange('account_id', null)}
                      className="text-purple-500 hover:text-purple-700"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Entity Selection Info */}
            <p className="text-xs text-gray-500 mb-2">
              Select one or more entities to link this task to:
            </p>

            {/* Note: Entity selectors would require async data fetching */}
            {/* For now, show a message that entity linking is set via props */}
            {!leadId && !contactId && !accountId && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                💡 Tip: Open this modal from a Lead, Contact, or Account detail page to auto-link the task.
              </div>
            )}

            {errors.entity && (
              <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.entity}
              </p>
            )}
          </div>

          {/* Error Message */}
          {saveMutation.isError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {saveMutation.error?.response?.data?.error || 'Failed to save task. Please try again.'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={saveMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {saveMutation.isPending ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  Saving...
                </>
              ) : (
                <>{isEditing ? 'Update Task' : 'Create Task'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTaskModal;
