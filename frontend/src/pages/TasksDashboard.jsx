import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  CheckSquare,
  Square,
  Clock,
  User,
  Filter,
  ArrowUpDown,
  AlertCircle,
  CheckCircle,
  Calendar,
  TrendingUp,
  ListTodo,
  XCircle
} from 'lucide-react'
import { taskAPI } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'

const TasksDashboard = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Filter states
  const [assignedToFilter, setAssignedToFilter] = useState('all')
  const [leadOwnerFilter, setLeadOwnerFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [priorityFilter, setPriorityFilter] = useState('all')

  // Sort states
  const [sortBy, setSortBy] = useState('scheduled_at')
  const [sortOrder, setSortOrder] = useState('asc')

  // Fetch users for filter dropdowns
  const { data: usersData } = useQuery({
    queryKey: ['organizationUsers'],
    queryFn: () => taskAPI.getOrganizationUsers()
  })

  // Fetch all tasks
  const { data: tasksData, isLoading, error } = useQuery({
    queryKey: ['allTasks', assignedToFilter, leadOwnerFilter, statusFilter, priorityFilter, sortBy, sortOrder],
    queryFn: () => taskAPI.getAllTasks({
      assigned_to: assignedToFilter !== 'all' ? assignedToFilter : undefined,
      lead_owner: leadOwnerFilter !== 'all' ? leadOwnerFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      priority: priorityFilter !== 'all' ? priorityFilter : undefined,
      sort_by: sortBy,
      sort_order: sortOrder
    }),
    refetchInterval: 30000 // Refetch every 30 seconds
  })

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: ({ leadId, taskId }) => {
      // Use completeGeneralTask for tasks without leads (contact/account only)
      // Use completeTask for lead-specific tasks
      if (leadId) {
        return taskAPI.completeTask(leadId, taskId)
      } else {
        return taskAPI.completeGeneralTask(taskId)
      }
    },
    onMutate: async ({ taskId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['allTasks'] })

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData(['allTasks'])

      // Optimistically update
      queryClient.setQueryData(['allTasks'], (old) => {
        if (!old?.tasks) return old
        return {
          ...old,
          tasks: old.tasks.map(task =>
            task.id === taskId
              ? { ...task, status: 'completed', completed_at: new Date().toISOString() }
              : task
          )
        }
      })

      return { previousTasks }
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(['allTasks'], context.previousTasks)
      }
      console.error('Error completing task:', err)
      alert('Failed to complete task. Please try again.')
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ['allTasks'] })
      // Also invalidate tasks queries used by TaskManager component on lead pages
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      // Invalidate leads list to update task counts
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    }
  })

  // Calculate statistics
  const stats = useMemo(() => {
    if (!tasksData?.tasks) {
      return { total: 0, pending: 0, completed: 0, overdue: 0 }
    }

    const now = new Date()
    const tasks = tasksData.tasks

    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'scheduled' || t.status === 'pending').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => {
        const scheduledDate = new Date(t.scheduled_at)
        return (t.status === 'scheduled' || t.status === 'pending') && scheduledDate < now
      }).length
    }
  }, [tasksData])

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    if (!tasksData?.tasks) return []

    let tasks = [...tasksData.tasks]

    // Apply filters
    if (assignedToFilter !== 'all') {
      tasks = tasks.filter(t => t.assigned_to === assignedToFilter)
    }
    if (leadOwnerFilter !== 'all') {
      tasks = tasks.filter(t => t.lead_owner_id === leadOwnerFilter)
    }
    if (statusFilter !== 'all') {
      if (statusFilter === 'overdue') {
        const now = new Date()
        tasks = tasks.filter(t => {
          const scheduledDate = new Date(t.scheduled_at)
          return (t.status === 'scheduled' || t.status === 'pending') && scheduledDate < now
        })
      } else if (statusFilter === 'pending') {
        tasks = tasks.filter(t => t.status === 'scheduled' || t.status === 'pending')
      } else {
        tasks = tasks.filter(t => t.status === statusFilter)
      }
    }
    if (priorityFilter !== 'all') {
      tasks = tasks.filter(t => t.priority === priorityFilter)
    }

    // Apply sorting
    tasks.sort((a, b) => {
      let aVal, bVal

      switch (sortBy) {
        case 'scheduled_at':
          aVal = new Date(a.scheduled_at || 0)
          bVal = new Date(b.scheduled_at || 0)
          break
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 }
          aVal = priorityOrder[a.priority] || 0
          bVal = priorityOrder[b.priority] || 0
          break
        case 'created_at':
          aVal = new Date(a.created_at || 0)
          bVal = new Date(b.created_at || 0)
          break
        default:
          return 0
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })

    return tasks
  }, [tasksData, assignedToFilter, leadOwnerFilter, statusFilter, priorityFilter, sortBy, sortOrder])

  const handleCompleteTask = (task) => {
    if (task.status === 'completed') return

    completeTaskMutation.mutate({
      leadId: task.lead_id,
      taskId: task.id
    })
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const isOverdue = (task) => {
    if (task.status === 'completed' || task.status === 'cancelled') return false
    const scheduledDate = new Date(task.scheduled_at)
    return scheduledDate < new Date()
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Not scheduled'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) return <LoadingSpinner />

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load tasks</h2>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <ListTodo className="text-blue-600" />
                Tasks Dashboard
              </h1>
              <p className="text-gray-600 mt-1">Manage and track all tasks across your organization</p>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Tasks</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">{stats.total}</p>
                </div>
                <ListTodo className="text-blue-500" size={32} />
              </div>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border border-yellow-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">Pending</p>
                  <p className="text-3xl font-bold text-yellow-900 mt-1">{stats.pending}</p>
                </div>
                <Clock className="text-yellow-500" size={32} />
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Completed</p>
                  <p className="text-3xl font-bold text-green-900 mt-1">{stats.completed}</p>
                </div>
                <CheckCircle className="text-green-500" size={32} />
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Overdue</p>
                  <p className="text-3xl font-bold text-red-900 mt-1">{stats.overdue}</p>
                </div>
                <AlertCircle className="text-red-500" size={32} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Filter Label */}
          <div className="flex items-center gap-2 text-gray-700 font-medium">
            <Filter size={18} />
            <span>Filters:</span>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Assigned To Filter */}
          <select
            value={assignedToFilter}
            onChange={(e) => setAssignedToFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Assignees</option>
            {usersData?.users?.map(u => (
              <option key={u.id} value={u.id}>
                {u.first_name} {u.last_name}
              </option>
            ))}
          </select>

          {/* Lead Owner Filter */}
          <select
            value={leadOwnerFilter}
            onChange={(e) => setLeadOwnerFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Lead Owners</option>
            {usersData?.users?.map(u => (
              <option key={u.id} value={u.id}>
                {u.first_name} {u.last_name}
              </option>
            ))}
          </select>

          <div className="border-l border-gray-300 h-8 mx-2"></div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2 text-gray-700 font-medium">
            <ArrowUpDown size={18} />
            <span>Sort by:</span>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="scheduled_at">Scheduled Date</option>
            <option value="priority">Priority</option>
            <option value="created_at">Created Date</option>
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="px-6 py-6">
        {filteredTasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <CheckSquare size={48} className="text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No tasks found</h3>
            <p className="text-gray-600">
              {statusFilter === 'pending'
                ? 'All caught up! No pending tasks at the moment.'
                : 'Try adjusting your filters to see more tasks.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                      Done
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Task
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lead
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lead Owner
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned To
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Scheduled
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTasks.map((task) => (
                    <tr
                      key={task.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        isOverdue(task) ? 'bg-red-50' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleCompleteTask(task)}
                          disabled={task.status === 'completed' || completeTaskMutation.isPending}
                          className="text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {task.status === 'completed' ? (
                            <CheckSquare size={24} className="text-green-600" />
                          ) : (
                            <Square size={24} />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{task.subject}</div>
                          {task.description && (
                            <div className="text-gray-500 mt-1 line-clamp-2">{task.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {task.lead_id ? (
                          <button
                            onClick={() => navigate(`/leads/${task.lead_id}`)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            {task.lead_name || 'View Lead'}
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400">No lead</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {task.lead_owner_name || 'Unassigned'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {task.assigned_to_name || 'Unassigned'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} className={isOverdue(task) ? 'text-red-500' : 'text-gray-400'} />
                          <span className={`text-sm ${isOverdue(task) ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                            {formatDate(task.scheduled_at)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                          {task.priority || 'medium'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          task.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : task.status === 'cancelled'
                            ? 'bg-gray-100 text-gray-800'
                            : isOverdue(task)
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {task.status === 'completed' ? 'Completed' :
                           task.status === 'cancelled' ? 'Cancelled' :
                           isOverdue(task) ? 'Overdue' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TasksDashboard
