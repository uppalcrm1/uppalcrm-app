import React, { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { workflowAPI } from '../services/api'

const WorkflowRuleModal = ({ rule, onClose, onSave }) => {
  const queryClient = useQueryClient()
  const isEditing = !!rule
  const [activeTab, setActiveTab] = useState(1)
  const [errors, setErrors] = useState({})

  const [formData, setFormData] = useState({
    name: rule?.name || '',
    description: rule?.description || '',
    entity_type: rule?.entity_type || 'account',
    trigger_type: rule?.trigger_type || 'renewal_within_days',
    trigger_conditions: rule?.trigger_conditions || { days: 14 },
    action_type: rule?.action_type || 'create_task',
    action_config: rule?.action_config || {
      subject_template: 'Renewal Reminder - {{account_name}}',
      description_template: 'Follow up on renewal for {{account_name}} - {{renewal_date}} ({{days_remaining}} days)',
      priority: 'high',
      days_before_due: 14,
      assign_to: null
    },
    run_mode: rule?.run_mode || 'manual_and_auto',
    prevent_duplicates: rule?.prevent_duplicates !== false,
    is_enabled: rule?.is_enabled !== false
  })

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (isEditing) {
        return workflowAPI.updateRule(rule.id, data)
      } else {
        return workflowAPI.createRule(data)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowRules'] })
      toast.success(isEditing ? 'Rule updated' : 'Rule created')
      onSave()
    },
    onError: (error) => {
      console.error('Error saving rule:', error)
      toast.error('Failed to save rule')
    }
  })

  const validateForm = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Rule name is required'
    }

    if (formData.trigger_type === 'renewal_within_days') {
      const days = formData.trigger_conditions?.days
      if (!days || days < 1 || days > 90) {
        newErrors.days = 'Days must be between 1 and 90'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    saveMutation.mutate(formData)
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    })
    // Clear error for this field
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: undefined
      })
    }
  }

  const handleTriggerConditionChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      trigger_conditions: {
        ...formData.trigger_conditions,
        [name]: parseInt(value)
      }
    })
    if (errors.days) {
      setErrors({
        ...errors,
        days: undefined
      })
    }
  }

  const handleActionConfigChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      action_config: {
        ...formData.action_config,
        [name]: type === 'checkbox' ? checked : value
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? 'Edit Workflow Rule' : 'Create Workflow Rule'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6 flex-shrink-0">
          <div className="flex gap-8">
            {[
              { id: 1, label: 'Basic Info' },
              { id: 2, label: 'Trigger' },
              { id: 3, label: 'Action' },
              { id: 4, label: 'Schedule' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
          <form id="workflow-form" onSubmit={handleSubmit} className="p-6">
          {/* Tab 1: Basic Info */}
          {activeTab === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Rule Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Renewal Reminder"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {errors.name && (
                  <p className="text-sm text-red-600 mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="What does this rule do?"
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <input
                  type="checkbox"
                  name="is_enabled"
                  id="is_enabled"
                  checked={formData.is_enabled}
                  onChange={handleInputChange}
                  className="rounded"
                />
                <label htmlFor="is_enabled" className="text-sm font-medium text-gray-900">
                  Rule is enabled
                </label>
              </div>
            </div>
          )}

          {/* Tab 2: Trigger */}
          {activeTab === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Entity Type
                </label>
                <select
                  name="entity_type"
                  value={formData.entity_type}
                  onChange={handleInputChange}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                >
                  <option value="account">Account</option>
                </select>
                <p className="text-xs text-gray-500 mt-2">Only Account entity type is currently supported</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Trigger Type
                </label>
                <select
                  name="trigger_type"
                  value={formData.trigger_type}
                  onChange={handleInputChange}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                >
                  <option value="renewal_within_days">Account Renewal Within N Days</option>
                </select>
                <p className="text-xs text-gray-500 mt-2">Only renewal_within_days is currently supported</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Number of Days *
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    name="days"
                    value={formData.trigger_conditions?.days || ''}
                    onChange={handleTriggerConditionChange}
                    min="1"
                    max="90"
                    className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <span className="text-gray-600">days before renewal</span>
                </div>
                {errors.days && (
                  <p className="text-sm text-red-600 mt-1">{errors.days}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">Enter a value between 1 and 90 days</p>
              </div>
            </div>
          )}

          {/* Tab 3: Action */}
          {activeTab === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Action Type
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700">
                  Create Task
                </div>
                <p className="text-xs text-gray-500 mt-2">Currently only task creation is supported</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Task Subject Template *
                </label>
                <input
                  type="text"
                  name="subject_template"
                  value={formData.action_config?.subject_template || ''}
                  onChange={handleActionConfigChange}
                  placeholder="e.g., Renewal Reminder - {account_name}"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-2">Variables (use double braces): account_name, renewal_date, days_remaining</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Task Description Template *
                </label>
                <textarea
                  name="description_template"
                  value={formData.action_config?.description_template || ''}
                  onChange={handleActionConfigChange}
                  placeholder="e.g., Follow up on renewal for {account_name} - {renewal_date}"
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-2">Variables (use double braces): account_name, renewal_date, days_remaining</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Priority
                  </label>
                  <select
                    name="priority"
                    value={formData.action_config?.priority || 'medium'}
                    onChange={handleActionConfigChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Days Before Due
                  </label>
                  <input
                    type="number"
                    name="days_before_due"
                    value={formData.action_config?.days_before_due || ''}
                    onChange={handleActionConfigChange}
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <input
                  type="checkbox"
                  name="prevent_duplicates"
                  id="prevent_duplicates"
                  checked={formData.prevent_duplicates}
                  onChange={handleActionConfigChange}
                  className="rounded"
                />
                <label htmlFor="prevent_duplicates" className="text-sm font-medium text-gray-900">
                  Prevent duplicate task creation
                </label>
              </div>
            </div>
          )}

          {/* Tab 4: Schedule */}
          {activeTab === 4 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  When should this rule run?
                </label>
                <div className="space-y-3">
                  {[
                    { value: 'manual_and_auto', label: 'Manual & Auto', desc: 'Can be run manually and runs automatically daily at 6:00 AM UTC' },
                    { value: 'manual_only', label: 'Manual Only', desc: 'Only runs when manually triggered' },
                    { value: 'auto_only', label: 'Auto Only', desc: 'Runs automatically daily at 6:00 AM UTC only' }
                  ].map(option => (
                    <label key={option.value} className="flex items-start gap-3 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="run_mode"
                        value={option.value}
                        checked={formData.run_mode === option.value}
                        onChange={handleInputChange}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{option.label}</p>
                        <p className="text-sm text-gray-600">{option.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          </form>
        </div>

        {/* Form Actions Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex gap-3 justify-end flex-shrink-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="workflow-form"
            disabled={saveMutation.isPending}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saveMutation.isPending ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Saving...
              </>
            ) : isEditing ? (
              'Update Rule'
            ) : (
              'Create Rule'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default WorkflowRuleModal
