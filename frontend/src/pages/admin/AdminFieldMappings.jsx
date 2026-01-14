import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  Plus,
  Edit2,
  Trash2,
  Info,
  Loader2
} from 'lucide-react'
import { fieldMappingAPI } from '../../services/api'
import toast from 'react-hot-toast'
import CreateEditMappingModal from '../../components/fieldMapping/CreateEditMappingModal'

const AdminFieldMappings = () => {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingMapping, setEditingMapping] = useState(null)

  // Fetch field mappings
  const { data: mappingsData, isLoading: loadingMappings } = useQuery({
    queryKey: ['field-mappings'],
    queryFn: fieldMappingAPI.getAll
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

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this field mapping?')) return
    deleteMutation.mutate(id)
  }

  const handleEdit = (mapping) => {
    setEditingMapping(mapping)
    setShowCreateModal(true)
  }

  const mappings = mappingsData?.data || mappingsData?.fieldMappings || []

  // Group mappings by target entity
  const groupedMappings = mappings.reduce((acc, mapping) => {
    const targetEntity = mapping.target_entity || mapping.target_entity_type || 'unknown'
    const key = `Lead → ${targetEntity.charAt(0).toUpperCase() + targetEntity.slice(1)}`
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
            Configure how lead fields are mapped when converting to contacts, accounts, and transactions
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
              When converting a lead to a contact, account, or transaction, these mappings automatically
              transfer data from lead fields to the corresponding target fields. Create mappings for each
              field you want to transfer during conversion.
            </p>
          </div>
        </div>
      </div>

      {/* Current Mappings Section */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Field Mappings</h3>
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
              Click "Create Mapping" to add your first field mapping
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
                            {mapping.source_field || mapping.source_field_name}
                          </span>
                          <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                          <span className="font-mono text-sm bg-white px-3 py-1.5 rounded border border-gray-300">
                            {mapping.target_field || mapping.target_field_name}
                          </span>
                        </div>

                        {mapping.transformation_type && mapping.transformation_type !== 'none' && (
                          <span className="text-xs text-gray-500 px-2 py-1 bg-white rounded border border-gray-200">
                            {mapping.transformation_type}
                          </span>
                        )}

                        {mapping.is_required_on_convert && (
                          <span className="text-xs text-red-600 px-2 py-1 bg-red-50 rounded border border-red-200">
                            Required
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
                        {!mapping.is_system_mapping && (
                          <button
                            onClick={() => handleDelete(mapping.id)}
                            disabled={deleteMutation.isPending}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-white rounded disabled:opacity-50"
                            title="Delete mapping"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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
