import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import DynamicLeadForm from '../components/DynamicLeadForm'
import ConvertLeadModal from '../components/ConvertLeadModal'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import LeadViews from './LeadViews'
import { leadsAPI, contactsAPI } from '../services/api'
import toast from 'react-hot-toast'

const Leads = () => {
  const queryClient = useQueryClient()

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [selectedLead, setSelectedLead] = useState(null)

  // Handle lead creation
  const handleAddLead = () => {
    setSelectedLead(null)
    setShowCreateModal(true)
  }

  // Handle lead editing
  const handleEditLead = (lead) => {
    setSelectedLead(lead)
    setShowEditModal(true)
  }

  // Handle lead deletion
  const handleDeleteLead = (lead) => {
    setSelectedLead(lead)
    setShowDeleteModal(true)
  }

  // Handle lead conversion
  const handleConvertLead = (lead) => {
    setSelectedLead(lead)
    setShowConvertModal(true)
  }

  // Modal close handlers
  const handleCloseModals = () => {
    setShowCreateModal(false)
    setShowEditModal(false)
    setShowDeleteModal(false)
    setShowConvertModal(false)
    setSelectedLead(null)
  }

  // Handle successful form submission
  const handleFormSuccess = () => {
    handleCloseModals()
    queryClient.invalidateQueries({ queryKey: ['leads'] })
    queryClient.invalidateQueries({ queryKey: ['leadStats'] })
  }

  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    if (!selectedLead) return

    try {
      await leadsAPI.deleteLead(selectedLead.id)
      toast.success('Lead deleted successfully')
      handleFormSuccess()
    } catch (error) {
      console.error('Error deleting lead:', error)
      console.error('Error response:', error.response?.data)

      // Show specific error message from backend
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Failed to delete lead'
      const errorDetail = error.response?.data?.detail

      toast.error(errorMessage, {
        duration: 5000
      })

      // Log detail for debugging
      if (errorDetail) {
        console.error('Delete error detail:', errorDetail)
      }
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Main Content */}
      <LeadViews
        onAddLead={handleAddLead}
        onEditLead={handleEditLead}
        onDeleteLead={handleDeleteLead}
        onConvertLead={handleConvertLead}
      />

      {/* Create Lead Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleCloseModals}
          ></div>
          <div className="relative w-full max-w-4xl bg-white shadow-xl rounded-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Add New Lead</h3>
                <p className="mt-1 text-sm text-gray-600">Create a new lead in your CRM</p>
              </div>
              <button
                onClick={handleCloseModals}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <DynamicLeadForm
                isOpen={showCreateModal}
                onClose={handleCloseModals}
                onSuccess={handleFormSuccess}
                mode="create"
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {showEditModal && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleCloseModals}
          ></div>
          <div className="relative w-full max-w-4xl bg-white shadow-xl rounded-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Edit Lead</h3>
                <p className="mt-1 text-sm text-gray-600">Update lead information</p>
              </div>
              <button
                onClick={handleCloseModals}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <DynamicLeadForm
                isOpen={showEditModal}
                onClose={handleCloseModals}
                onSuccess={handleFormSuccess}
                mode="edit"
                leadData={selectedLead}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedLead && (
        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={handleCloseModals}
          onConfirm={handleConfirmDelete}
          title="Delete Lead"
          message={`Are you sure you want to delete the lead "${selectedLead.first_name} ${selectedLead.last_name}"? This action cannot be undone.`}
          confirmButtonText="Delete Lead"
          isDestructive={true}
        />
      )}

      {/* Convert Lead Modal */}
      {showConvertModal && selectedLead && (
        <ConvertLeadModal
          lead={selectedLead}
          onClose={handleCloseModals}
          onSubmit={async (conversionData) => {
            try {
              await contactsAPI.convertFromLead(conversionData)
              toast.success('Lead converted to contact successfully')
              handleFormSuccess()
            } catch (error) {
              console.error('Error converting lead:', error)
              toast.error(error.response?.data?.message || 'Failed to convert lead')
            }
          }}
          isLoading={false}
        />
      )}
    </div>
  )
}

export default Leads