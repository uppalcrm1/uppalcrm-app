import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Phone, Mail, Calendar, FileText, CheckSquare, Clock,
  CheckCircle, Trash2, Plus
} from 'lucide-react';
import { leadInteractionsAPI } from '../services/api';
import { format, formatDistanceToNow } from 'date-fns';
import LoadingSpinner from './LoadingSpinner';
import AddInteractionModal from './AddInteractionModal';

const INTERACTION_ICONS = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: FileText,
  task: CheckSquare
};

const INTERACTION_COLORS = {
  call: 'text-green-600 bg-green-100',
  email: 'text-blue-600 bg-blue-100',
  meeting: 'text-purple-600 bg-purple-100',
  note: 'text-gray-600 bg-gray-100',
  task: 'text-orange-600 bg-orange-100'
};

const InteractionsTimeline = ({ leadId }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const queryClient = useQueryClient();

  // Fetch interactions
  const { data, isLoading } = useQuery({
    queryKey: ['leadInteractions', leadId],
    queryFn: () => leadInteractionsAPI.getInteractions(leadId)
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (interactionId) =>
      leadInteractionsAPI.deleteInteraction(leadId, interactionId),
    onSuccess: () => {
      queryClient.invalidateQueries(['leadInteractions', leadId]);
      queryClient.invalidateQueries(['leads']);
    }
  });

  // Complete task mutation
  const completeMutation = useMutation({
    mutationFn: ({ interactionId, outcome, duration }) =>
      leadInteractionsAPI.completeInteraction(leadId, interactionId, { outcome, duration_minutes: duration }),
    onSuccess: () => {
      queryClient.invalidateQueries(['leadInteractions', leadId]);
    }
  });

  const handleDelete = (interactionId) => {
    if (window.confirm('Are you sure you want to delete this interaction?')) {
      deleteMutation.mutate(interactionId);
    }
  };

  const handleComplete = (interaction) => {
    const outcome = prompt('Outcome (optional):');
    const duration = interaction.interaction_type === 'call' || interaction.interaction_type === 'meeting'
      ? prompt('Duration in minutes:')
      : null;

    completeMutation.mutate({
      interactionId: interaction.id,
      outcome,
      duration: duration ? parseInt(duration) : null
    });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const interactions = data?.interactions || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Activity Timeline ({interactions.length})
        </h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Interaction
        </button>
      </div>

      {/* Timeline */}
      {interactions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No interactions yet</p>
          <p className="text-sm text-gray-500 mt-1">Start logging calls, emails, and meetings</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add First Interaction
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {interactions.map((interaction, index) => {
            const Icon = INTERACTION_ICONS[interaction.interaction_type];
            const colorClass = INTERACTION_COLORS[interaction.interaction_type];
            const isScheduled = interaction.status === 'scheduled';
            const isOverdue = isScheduled && new Date(interaction.scheduled_at) < new Date();

            return (
              <div
                key={interaction.id}
                className={`relative pl-8 pb-3 ${
                  index !== interactions.length - 1 ? 'border-l-2 border-gray-200 ml-4' : ''
                }`}
              >
                {/* Icon */}
                <div className={`absolute left-0 top-0 -ml-[1.125rem] w-9 h-9 rounded-full flex items-center justify-center ${colorClass}`}>
                  <Icon className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 capitalize">
                          {interaction.interaction_type}
                          {interaction.interaction_type === 'task' && interaction.priority && (
                            <span className="ml-2">
                              {interaction.priority === 'high' ? '🔴' :
                               interaction.priority === 'medium' ? '🟠' : '⚪'}
                            </span>
                          )}
                        </span>
                        {interaction.subject && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-700">{interaction.subject}</span>
                          </>
                        )}
                        {isScheduled && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            isOverdue
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {isOverdue ? 'Overdue' : 'Scheduled'}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-gray-700 text-sm mb-2 whitespace-pre-wrap">
                        {interaction.description}
                      </p>

                      {/* Metadata */}
                      <div className="flex flex-col gap-1 text-xs text-gray-500">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {isScheduled ? (
                              <span>
                                Scheduled for {format(new Date(interaction.scheduled_at), 'MMM d, yyyy h:mm a')}
                              </span>
                            ) : (
                              <span>
                                {formatDistanceToNow(new Date(interaction.created_at), { addSuffix: true })}
                              </span>
                            )}
                          </div>

                          {interaction.outcome && (
                            <>
                              <span>•</span>
                              <span>Outcome: {interaction.outcome}</span>
                            </>
                          )}

                          {interaction.duration_minutes && (
                            <>
                              <span>•</span>
                              <span>{interaction.duration_minutes} minutes</span>
                            </>
                          )}
                        </div>

                        {/* Task-specific metadata */}
                        {interaction.interaction_type === 'task' && (
                          <div className="flex items-center gap-4 flex-wrap">
                            {interaction.created_by_first_name && (
                              <span>
                                Created by {interaction.created_by_first_name} {interaction.created_by_last_name}
                              </span>
                            )}
                            {interaction.user_first_name && (
                              <>
                                <span>•</span>
                                <span>Assigned to {interaction.user_first_name} {interaction.user_last_name}</span>
                              </>
                            )}
                            {interaction.completed_at && (
                              <>
                                <span>•</span>
                                <span>Completed {formatDistanceToNow(new Date(interaction.completed_at), { addSuffix: true })}</span>
                              </>
                            )}
                            {interaction.priority && (
                              <>
                                <span>•</span>
                                <span className={`capitalize font-medium ${
                                  interaction.priority === 'high' ? 'text-red-600' :
                                  interaction.priority === 'medium' ? 'text-orange-600' :
                                  'text-gray-600'
                                }`}>
                                  {interaction.priority} priority
                                </span>
                              </>
                            )}
                          </div>
                        )}

                        {/* Non-task metadata (calls, emails, meetings, notes) */}
                        {interaction.interaction_type !== 'task' && interaction.created_by_first_name && (
                          <div className="flex items-center gap-4">
                            <span>by {interaction.created_by_first_name} {interaction.created_by_last_name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      {isScheduled && (
                        <button
                          onClick={() => handleComplete(interaction)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Mark as completed"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(interaction.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Interaction Modal */}
      {showAddModal && (
        <AddInteractionModal
          leadId={leadId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
};

export default InteractionsTimeline;
