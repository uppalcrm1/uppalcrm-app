import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  Plus,
  Edit2,
  Trash2,
  Play,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2
} from 'lucide-react'
import { fieldMappingAPI, fieldMappingTemplateAPI } from '../../services/api'
import toast from 'react-hot-toast'
import CreateEditMappingModal from '../../components/fieldMapping/CreateEditMappingModal'
import ConversionPreviewModal from '../../components/fieldMapping/ConversionPreviewModal'

const AdminFieldMappings = () => {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingMapping, setEditingMapping] = useState(null)
  const [expandedTemplate, setExpandedTemplate] = useState(null)

  // Fetch field mappings
  const { data: mappingsData, isLoading: loadingMappings } = useQuery({
    queryKey: ['field-mappings'],
    queryFn: fieldMappingAPI.getAll
  })

  // Fetch templates
  const { data: templatesData, isLoading: loadingTemplates } = useQuery({
    queryKey: ['field-mapping-templates'],
    queryFn: fieldMappingTemplateAPI.getAll
  })

  // Delete mapping mutation
  const deleteMutation = useMutation({
    mutationFn: fieldMappingAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['field-mappings'])
      toast.success('Field mapping deleted successfully')
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete mapping')
    }
  })

  // Apply template mutation
  const applyTemplateMutation = useMutation({
    mutationFn: fieldMappingTemplateAPI.apply,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['field-mappings'])
      toast.success(`Applied template: ${data.appliedMappings} mappings created`)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to apply template')
    }
  })

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this field mapping?')) return
    deleteMutation.mutate(id)
  }

  const handleEdit = (mapping) => {
    setEditingMapping(mapping)
    setShowCreateModal(true)
  }

  const handleApplyTemplate = async (templateId) => {
    if (!confirm('This will create new field mappings based on the template. Continue?')) return
    applyTemplateMutation.mutate(templateId)
  }

  const mappings = mappingsData?.fieldMappings || []
  const templates = templatesData?.templates || []

  // Group mappings by source → target
  const groupedMappings = mappings.reduce((acc, mapping) => {
    const key = `${mapping.source_entity_type} → ${mapping.target_entity_type}`
    if (!acc[key]) acc[key] = []
    acc[key].push(mapping)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6" />
            Lead Conversion Field Mappings
          </h2>
          <p className="text-gray-600 mt-1">
            Configure how lead fields are mapped when converting to contacts and accounts
          </p>
        </div>
        <button
          onClick={() => {
            setEditingMapping(null)
            setShowCreateModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Create Mapping
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-blue-900 font-medium">How Field Mappings Work</p>
            <p className="text-blue-700 mt-1">
              When converting a lead to a contact/account, these mappings automatically transfer data from lead fields to the corresponding contact/account fields. 
              You can apply pre-built templates or create custom mappings.
            </p>
          </div>
        </div>
      </div>

      {/* System Templates Section */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            Quick Start Templates
          </h3>
          <p className="text-sm text-gray-600 mt-1">Apply a pre-built template to instantly configure field mappings</p>
        </div>

        {loadingTemplates ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
            <p className="text-gray-500 mt-2">Loading templates...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>No templates available</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {templates.map((template) => (
              <div key={template.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{template.name}</h4>
                      {template.is_system && (
                        <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded">
                          System
                        </span>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                    )}
                    
                    {/* Show mappings preview when expanded */}
                    {expandedTemplate === template.id && template.mappings && (
                      <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
                        <p className="text-xs font-medium text-gray-700 mb-2">
                          Included Mappings ({template.mappings.length}):
                        </p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {template.mappings.map((mapping, idx) => (
                            <div key={idx} className="text-xs text-gray-600 flex items-center gap-2">
                              <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200">
                                {mapping.source_field_name}
                              </span>
                              <ArrowRightLeft className="w-3 h-3 text-gray-400" />
                              <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200">
                                {mapping.target_field_name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => setExpandedTemplate(expandedTemplate === template.id ? null : template.id)}
                      className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300"
                    >
                      {expandedTemplate === template.id ? 'Hide' : 'Preview'}
                    </button>
                    <button
                      onClick={() => handleApplyTemplate(template.id)}
                      disabled={applyTemplateMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {applyTemplateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current Mappings Section */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Current Field Mappings</h3>
          <p className="text-sm text-gray-600 mt-1">Active field mappings for lead conversion</p>
        </div>

        {loadingMappings ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
            <p className="text-gray-500 mt-2">Loading mappings...</p>
          </div>
        ) : mappings.length === 0 ? (
          <div className="p-8 text-center">
            <ArrowRightLeft className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No field mappings configured</p>
            <p className="text-gray-500 text-sm mt-1">
              Apply a template above or create custom mappings to get started
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {Object.entries(groupedMappings).map(([groupKey, groupMappings]) => (
              <div key={groupKey} className="p-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4" />
                  {groupKey}
                </h4>
                <div className="space-y-2">
                  {groupMappings.map((mapping) => (
                    <div
                      key={mapping.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="font-mono text-sm bg-white px-3 py-1.5 rounded border border-gray-300">
                            {mapping.source_field_name}
                          </span>
                          <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                          <span className="font-mono text-sm bg-white px-3 py-1.5 rounded border border-gray-300">
                            {mapping.target_field_name}
                          </span>
                        </div>
                        
                        {mapping.transformation_rule && (
                          <span className="text-xs text-gray-500 px-2 py-1 bg-white rounded border border-gray-200">
                            {mapping.transformation_rule}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-1 ml-4">
                        <button
                          onClick={() => handleEdit(mapping)}
                          className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-white rounded"
                          title="Edit mapping"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(mapping.id)}
                          disabled={deleteMutation.isPending}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-white rounded disabled:opacity-50"
                          title="Delete mapping"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <CreateEditMappingModal
          mapping={editingMapping}
          onClose={() => {
            setShowCreateModal(false)
            setEditingMapping(null)
          }}
          onSuccess={() => {
            queryClient.invalidateQueries(['field-mappings'])
            setShowCreateModal(false)
            setEditingMapping(null)
          }}
        />
      )}
    </div>
  )
}

export default AdminFieldMappings
