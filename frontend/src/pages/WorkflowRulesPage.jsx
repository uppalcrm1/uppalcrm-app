import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Zap, Plus, Play, Edit2, Trash2, ToggleRight, ToggleLeft, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { workflowAPI } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import WorkflowRuleModal from '../components/WorkflowRuleModal'

const WorkflowRulesPage = () => {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  // Fetch all workflow rules
  const { data: rulesData, isLoading, error } = useQuery({
    queryKey: ['workflowRules'],
    queryFn: () => workflowAPI.getRules()
  })

  const rules = rulesData?.data || []

  // Toggle rule enabled status
  const toggleRuleMutation = useMutation({
    mutationFn: async (rule) => {
      // Transform camelCase to camelCase for API (API expects camelCase)
      const updateData = {
        name: rule.name,
        description: rule.description,
        entityType: rule.entityType,
        triggerType: rule.triggerType,
        triggerConditions: rule.triggerConditions,
        actionType: rule.actionType,
        actionConfig: rule.actionConfig,
        runMode: rule.runMode,
        preventDuplicates: rule.preventDuplicates,
        isEnabled: !rule.isEnabled  // Toggle the value
      }
      return workflowAPI.updateRule(rule.id, updateData)
    },
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflowRules'] })
      const newState = !variables.isEnabled
      toast.success(newState ? 'Rule enabled' : 'Rule disabled')
    },
    onError: (error) => {
      console.error('Error toggling rule:', error)
      toast.error('Failed to update rule')
    }
  })

  // Execute rule immediately
  const executeRuleMutation = useMutation({
    mutationFn: (ruleId) => workflowAPI.executeRule(ruleId),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['workflowRules'] })
      const result = response.data
      toast.success(`Rule executed: ${result.tasksCreated} tasks created, ${result.recordsSkippedDuplicate} duplicates skipped`)
    },
    onError: (error) => {
      console.error('Error executing rule:', error)
      toast.error('Failed to execute rule')
    }
  })

  // Execute all rules
  const executeAllMutation = useMutation({
    mutationFn: () => workflowAPI.executeAll(),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['workflowRules'] })
      toast.success('All rules executed')
    },
    onError: (error) => {
      console.error('Error executing all rules:', error)
      toast.error('Failed to execute rules')
    }
  })

  // Delete rule
  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId) => workflowAPI.deleteRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowRules'] })
      setDeleteConfirmId(null)
      toast.success('Rule deleted')
    },
    onError: (error) => {
      console.error('Error deleting rule:', error)
      toast.error('Failed to delete rule')
    }
  })

  const handleCreateNew = () => {
    setEditingRule(null)
    setShowModal(true)
  }

  const handleEdit = (rule) => {
    setEditingRule(rule)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingRule(null)
  }

  const handleSaveRule = () => {
    queryClient.invalidateQueries({ queryKey: ['workflowRules'] })
    handleCloseModal()
  }

  const formatTriggerInfo = (rule) => {
    if (rule.triggerType === 'renewal_within_days') {
      const days = rule.triggerConditions?.days || 0
      return `Account renewal within ${days} days`
    }
    return rule.triggerType
  }

  const formatActionInfo = (rule) => {
    const actionConfig = rule.actionConfig || {}
    const priority = actionConfig.priority || 'medium'
    const daysBefore = actionConfig.days_before_due || 0
    return `Create task • Priority: ${priority} • Due: ${daysBefore} days before`
  }

  const formatRunMode = (mode) => {
    const modeMap = {
      'manual_and_auto': 'Manual + Auto',
      'manual_only': 'Manual Only',
      'auto_only': 'Auto Only'
    }
    return modeMap[mode] || mode
  }

  const formatLastRun = (rule) => {
    if (!rule.lastRunAt) return 'Never'
    const date = new Date(rule.lastRunAt)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Zap className="h-8 w-8 text-primary-600" />
                <h1 className="text-3xl font-bold text-gray-900">Workflow Rules</h1>
              </div>
              <p className="text-gray-600">Automate task creation based on account renewals</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => executeAllMutation.mutate()}
                disabled={executeAllMutation.isPending || rules.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Play size={18} />
                Run All Rules
              </button>
              <button
                onClick={handleCreateNew}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus size={18} />
                New Rule
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">Error loading rules</p>
              <p className="text-sm text-red-700 mt-1">{error.message}</p>
            </div>
          </div>
        )}

        {rules.length === 0 ? (
          // Empty State
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No workflow rules yet</h3>
            <p className="text-gray-600 mb-6">Create your first rule to automate task creation based on account renewals</p>
            <button
              onClick={handleCreateNew}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus size={18} />
              Create Your First Rule
            </button>
          </div>
        ) : (
          // Rules List
          <div className="grid grid-cols-1 gap-6">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md transition-all p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left side - Rule info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <button
                        onClick={() => toggleRuleMutation.mutate(rule)}
                        disabled={toggleRuleMutation.isPending}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        title={rule.isEnabled ? 'Click to disable rule' : 'Click to enable rule'}
                      >
                        {rule.isEnabled ? (
                          <ToggleRight className="h-6 w-6 text-green-600" />
                        ) : (
                          <ToggleLeft className="h-6 w-6 text-gray-400" />
                        )}
                      </button>
                      <h3 className="text-lg font-semibold text-gray-900">{rule.name}</h3>
                    </div>

                    {rule.description && (
                      <p className="text-gray-600 text-sm mb-3">{rule.description}</p>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <p className="text-gray-500 font-medium">Trigger</p>
                        <p className="text-gray-900">{formatTriggerInfo(rule)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 font-medium">Action</p>
                        <p className="text-gray-900 truncate">{formatActionInfo(rule)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 font-medium">Run Mode</p>
                        <p className="text-gray-900">
                          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {formatRunMode(rule.runMode)}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 font-medium">Last Run</p>
                        <p className="text-gray-900">{formatLastRun(rule)}</p>
                      </div>
                    </div>

                    {rule.preventDuplicates && (
                      <div className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded inline-block">
                        ✓ Duplicate prevention enabled
                      </div>
                    )}
                  </div>

                  {/* Right side - Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => executeRuleMutation.mutate(rule.id)}
                      disabled={executeRuleMutation.isPending}
                      title="Run this rule immediately"
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play size={18} />
                    </button>
                    <button
                      onClick={() => handleEdit(rule)}
                      title="Edit rule"
                      className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setDeleteConfirmId(deleteConfirmId === rule.id ? null : rule.id)}
                        title="Delete rule"
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                      {deleteConfirmId === rule.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50">
                          <p className="text-sm text-gray-900 font-medium mb-3">Delete rule?</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => deleteRuleMutation.mutate(rule.id)}
                              disabled={deleteRuleMutation.isPending}
                              className="flex-1 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="flex-1 px-3 py-1 bg-gray-200 text-gray-900 text-sm rounded hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <WorkflowRuleModal
          rule={editingRule}
          onClose={handleCloseModal}
          onSave={handleSaveRule}
        />
      )}
    </div>
  )
}

export default WorkflowRulesPage
