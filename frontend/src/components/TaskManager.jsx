import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckSquare,
  Square,
  Plus,
  Filter,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import { format, formatDistanceToNow, isToday, isTomorrow, isPast } from 'date-fns';
import { taskAPI } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import AddTaskModal from './AddTaskModal';

// Task statistics component
const TaskStats = ({ stats }) => {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Tasks</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <CheckSquare className="w-8 h-8 text-blue-500" />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
          </div>
          <Clock className="w-8 h-8 text-orange-500" />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Completed</p>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Overdue</p>
            <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
          </div>
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
      </div>
    </div>
  );
};

// Priority badge component
const PriorityBadge = ({ priority }) => {
  const colors = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-red-100 text-red-700'
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[priority] || colors.medium}`}>
      {priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'Medium'}
    </span>
  );
};

// Due date badge component
const DueDateBadge = ({ scheduledAt }) => {
  if (!scheduledAt) return null;

  const date = new Date(scheduledAt);
  const isOverdue = isPast(date) && !isToday(date);
  const isDueToday = isToday(date);
  const isDueTomorrow = isTomorrow(date);

  let colorClass = 'bg-gray-100 text-gray-700';
  let label = format(date, 'MMM d, yyyy');

  if (isOverdue) {
    colorClass = 'bg-red-100 text-red-700';
    label = `Overdue: ${format(date, 'MMM d')}`;
  } else if (isDueToday) {
    colorClass = 'bg-orange-100 text-orange-700';
    label = 'Due Today';
  } else if (isDueTomorrow) {
    colorClass = 'bg-yellow-100 text-yellow-700';
    label = 'Due Tomorrow';
  }

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${colorClass}`}>
      <Calendar className="w-3 h-3" />
      {label}
    </span>
  );
};

// Individual task card component
const TaskCard = ({ task, onComplete, onEdit, onDelete }) => {
  const [showDescription, setShowDescription] = useState(false);
  const isCompleted = task.status === 'completed';
  const isOverdue = task.status === 'scheduled' && isPast(new Date(task.scheduled_at)) && !isToday(new Date(task.scheduled_at));

  return (
    <div className={`bg-white rounded-lg border ${isOverdue ? 'border-red-300' : 'border-gray-200'} p-4 hover:shadow-md transition-shadow`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => !isCompleted && onComplete(task)}
          disabled={isCompleted}
          className={`mt-1 flex-shrink-0 ${isCompleted ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-110'} transition-transform`}
        >
          {isCompleted ? (
            <CheckSquare className="w-5 h-5 text-green-600" />
          ) : (
            <Square className="w-5 h-5 text-gray-400 hover:text-blue-600" />
          )}
        </button>

        {/* Task content */}
        <div className="flex-1 min-w-0">
          {/* Title and badges */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1">
              <h4 className={`font-medium ${isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                {task.subject}
              </h4>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <DueDateBadge scheduledAt={task.scheduled_at} />
                <PriorityBadge priority={task.priority} />
                {isCompleted && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Completed
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            {!isCompleted && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEdit(task)}
                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                  title="Edit task"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(task)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                  title="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Description toggle */}
          {task.description && (
            <>
              <button
                onClick={() => setShowDescription(!showDescription)}
                className="text-sm text-blue-600 hover:text-blue-800 mb-1"
              >
                {showDescription ? 'Hide details' : 'Show details'}
              </button>
              {showDescription && (
                <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded mt-2">
                  {task.description}
                </p>
              )}
            </>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
            {task.user_first_name && (
              <span>Assigned to: {task.user_first_name} {task.user_last_name}</span>
            )}
            {task.created_at && (
              <span>Created {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</span>
            )}
            {task.completed_at && (
              <span className="text-green-600">
                Completed {formatDistanceToNow(new Date(task.completed_at), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Main TaskManager component
const TaskManager = ({ leadId }) => {
  const [filter, setFilter] = useState('all'); // all, pending, completed, overdue
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const queryClient = useQueryClient();

  // Fetch tasks
  const { data, isLoading, error } = useQuery({
    queryKey: ['tasks', leadId, filter],
    queryFn: async () => {
      const params = {};
      if (filter === 'pending') params.status = 'scheduled';
      if (filter === 'completed') params.status = 'completed';
      if (filter === 'overdue') params.overdue = 'true';

      return await taskAPI.getTasks(leadId, params);
    }
  });

  // Complete task mutation
  const completeMutation = useMutation({
    mutationFn: ({ taskId }) => taskAPI.completeTask(leadId, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', leadId]);
      queryClient.invalidateQueries(['leads']);
      // Also invalidate allTasks query used by TasksDashboard
      queryClient.invalidateQueries(['allTasks']);
    },
    onError: (error) => {
      console.error('Error completing task:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to complete task';
      alert(`Error: ${errorMessage}\n\nPlease refresh the page and try again.`);
    }
  });

  // Delete task mutation
  const deleteMutation = useMutation({
    mutationFn: (taskId) => taskAPI.deleteTask(leadId, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', leadId]);
      queryClient.invalidateQueries(['leads']);
      // Also invalidate allTasks query used by TasksDashboard
      queryClient.invalidateQueries(['allTasks']);
    }
  });

  const handleComplete = (task) => {
    // Validate task ID before attempting to complete
    if (!task || !task.id) {
      console.error('Invalid task: missing ID', task);
      alert('Error: Invalid task ID. Please refresh the page and try again.');
      return;
    }

    // Validate leadId prop
    if (!leadId) {
      console.error('Invalid leadId prop', leadId);
      alert('Error: Invalid lead ID. Please refresh the page and try again.');
      return;
    }

    if (window.confirm(`Mark "${task.subject}" as completed?`)) {
      completeMutation.mutate({ taskId: task.id });
    }
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setShowAddModal(true);
  };

  const handleDelete = (task) => {
    if (window.confirm(`Delete task "${task.subject}"? This action cannot be undone.`)) {
      deleteMutation.mutate(task.id);
    }
  };

  const handleAddTask = () => {
    setEditingTask(null);
    setShowAddModal(true);
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-red-600">Error loading tasks: {error.message}</div>;

  const tasks = data?.tasks || [];
  const stats = data?.stats || { total: 0, pending: 0, completed: 0, overdue: 0 };

  // Filter buttons
  const filterButtons = [
    { key: 'all', label: 'All Tasks', count: stats.total },
    { key: 'pending', label: 'Pending', count: stats.pending },
    { key: 'completed', label: 'Completed', count: stats.completed },
    { key: 'overdue', label: 'Overdue', count: stats.overdue }
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Tasks & Activities</h2>
        <button
          onClick={handleAddTask}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      {/* Statistics */}
      <TaskStats stats={stats} />

      {/* Filters */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        {filterButtons.map(btn => (
          <button
            key={btn.key}
            onClick={() => setFilter(btn.key)}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              filter === btn.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {btn.label} ({btn.count})
          </button>
        ))}
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <CheckSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No tasks found</p>
          <p className="text-sm text-gray-500 mt-1">
            {filter === 'all' ? 'Create your first task to get started' : `No ${filter} tasks`}
          </p>
          <button
            onClick={handleAddTask}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add Task
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={handleComplete}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Task Modal */}
      {showAddModal && (
        <AddTaskModal
          leadId={leadId}
          task={editingTask}
          onClose={() => {
            setShowAddModal(false);
            setEditingTask(null);
          }}
          api={taskAPI}
        />
      )}
    </div>
  );
};

export default TaskManager;
