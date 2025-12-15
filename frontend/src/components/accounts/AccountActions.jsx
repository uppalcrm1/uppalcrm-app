import React, { useState } from 'react';
import { Trash2, RotateCcw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * AccountActions Component
 * Handles soft delete and restore operations for accounts
 */
export function AccountActions({ account, onDelete, onRestore, onRefresh }) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Deletion reason options
  const DELETION_REASONS = [
    'Customer requested cancellation',
    'Non-payment',
    'Duplicate account',
    'Fraudulent activity',
    'Trial expired - no conversion',
    'Customer switched to competitor',
    'Account no longer needed',
    'Data correction',
    'Other'
  ];

  const handleDelete = async () => {
    if (!deleteReason.trim()) {
      toast.error('Please select a reason for deletion');
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(account.id, deleteReason);
      setShowDeleteDialog(false);
      setDeleteReason('');
      toast.success(`Account "${account.account_name}" deleted successfully`);

      // Refresh the accounts list
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error(error.response?.data?.error || 'Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await onRestore(account.id);
      toast.success(`Account "${account.account_name}" restored successfully`);

      // Refresh the accounts list
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Restore failed:', error);
      toast.error(error.response?.data?.error || 'Failed to restore account');
    } finally {
      setIsRestoring(false);
    }
  };

  // If account is deleted, show restore button
  if (account.deleted_at) {
    return (
      <button
        onClick={handleRestore}
        disabled={isRestoring}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-300 rounded hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Restore Account"
      >
        <RotateCcw className="w-4 h-4" />
        {isRestoring ? 'Restoring...' : 'Restore'}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowDeleteDialog(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-300 rounded hover:bg-red-100 transition-colors"
        title="Delete Account"
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Delete Account
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {account.account_name}
                  </p>
                </div>
              </div>

              {/* Warning Message */}
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Important:</strong> This account will be marked as deleted but data will be preserved for audit purposes. You can restore it later if needed.
                </p>
              </div>

              {/* Account Details */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Account Name:</span>
                  <span className="font-medium text-gray-900">{account.account_name}</span>
                </div>
                {account.contact_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Customer:</span>
                    <span className="font-medium text-gray-900">{account.contact_name}</span>
                  </div>
                )}
                {account.product_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Product:</span>
                    <span className="font-medium text-gray-900">{account.product_name}</span>
                  </div>
                )}
                {account.mac_address && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">MAC Address:</span>
                    <span className="font-mono text-xs text-gray-900">{account.mac_address}</span>
                  </div>
                )}
              </div>

              {/* Reason Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for deletion: <span className="text-red-500">*</span>
                </label>
                <select
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  disabled={isDeleting}
                >
                  <option value="">Select a reason...</option>
                  {DELETION_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
                {!deleteReason && (
                  <p className="mt-1 text-xs text-gray-500">
                    Please select a reason to continue
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setDeleteReason('');
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  disabled={isDeleting || !deleteReason}
                >
                  {isDeleting ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Deleting...
                    </span>
                  ) : (
                    'Confirm Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AccountActions;
