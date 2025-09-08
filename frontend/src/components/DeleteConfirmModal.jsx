import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, organizationName, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-red-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Confirm Deletion</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-700 mb-3">
            Are you sure you want to permanently delete the organization:
          </p>
          <p className="font-semibold text-gray-900 bg-gray-100 p-2 rounded">
            "{organizationName}"
          </p>
          <p className="text-red-600 text-sm mt-3 font-medium">
            ⚠️ This action cannot be undone and will delete:
          </p>
          <ul className="text-sm text-gray-600 mt-2 ml-4 list-disc">
            <li>All organization users and admin accounts</li>
            <li>All contacts and customer data</li>
            <li>All organization settings and preferences</li>
            <li>All related notes and history</li>
          </ul>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Deleting...
              </div>
            ) : (
              'Delete Organization'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;