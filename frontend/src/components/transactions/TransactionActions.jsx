import React, { useState } from 'react';
import { XCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * TransactionActions Component
 * Handles void (soft delete) operations for transactions
 */
export function TransactionActions({ transaction, onVoid, onRefresh }) {
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  // Void reason options
  const VOID_REASONS = [
    'Duplicate entry',
    'Data entry error',
    'Fraudulent transaction',
    'Payment reversed',
    'Refund issued',
    'Wrong amount entered',
    'Wrong account',
    'Administrative correction',
    'Other'
  ];

  const handleVoid = async () => {
    if (!voidReason.trim()) {
      toast.error('Please select a reason for voiding this transaction');
      return;
    }

    setIsVoiding(true);
    try {
      await onVoid(transaction.id, voidReason);
      setShowVoidDialog(false);
      setVoidReason('');
      toast.success(`Transaction voided successfully`);

      // Refresh the transactions list
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Void failed:', error);
      toast.error(error.response?.data?.error || 'Failed to void transaction');
    } finally {
      setIsVoiding(false);
    }
  };

  // If transaction is already voided, don't show button
  if (transaction.is_void || transaction.deleted_at) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded">
        <XCircle className="w-3 h-3" />
        Voided
      </span>
    );
  }

  // Don't allow voiding of certain statuses
  if (transaction.status === 'pending' || transaction.status === 'failed') {
    return (
      <span className="text-xs text-gray-400">
        N/A
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowVoidDialog(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
        title="Void Transaction"
      >
        <XCircle className="w-3.5 h-3.5" />
        Void
      </button>

      {/* Void Confirmation Dialog */}
      {showVoidDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Void Transaction
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    This action will mark the transaction as invalid
                  </p>
                </div>
              </div>

              {/* Critical Warning */}
              <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-1">⚠️ Critical Warning</p>
                    <p>
                      Voiding this transaction will mark it as invalid for accounting purposes.
                      This action should only be used for errors or fraud. The transaction will
                      be excluded from all revenue calculations.
                    </p>
                  </div>
                </div>
              </div>

              {/* Transaction Details */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-semibold text-lg text-gray-900">
                    ${parseFloat(transaction.amount).toFixed(2)} {transaction.currency || 'USD'}
                  </span>
                </div>
                {transaction.payment_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Date:</span>
                    <span className="font-medium text-gray-900">
                      {new Date(transaction.payment_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                )}
                {transaction.payment_method && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Method:</span>
                    <span className="font-medium text-gray-900">{transaction.payment_method}</span>
                  </div>
                )}
                {transaction.account_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Account:</span>
                    <span className="font-medium text-gray-900">{transaction.account_name}</span>
                  </div>
                )}
                {transaction.contact_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Customer:</span>
                    <span className="font-medium text-gray-900">{transaction.contact_name}</span>
                  </div>
                )}
                {transaction.transaction_reference && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Reference:</span>
                    <span className="font-mono text-xs text-gray-900">{transaction.transaction_reference}</span>
                  </div>
                )}
              </div>

              {/* Reason Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for voiding: <span className="text-red-500">*</span>
                </label>
                <select
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  disabled={isVoiding}
                >
                  <option value="">Select a reason...</option>
                  {VOID_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  This reason will be recorded in the audit log for compliance purposes.
                </p>
              </div>

              {/* Impact Notice */}
              <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>Impact:</strong> This transaction will:
                </p>
                <ul className="mt-1 text-xs text-blue-800 list-disc list-inside space-y-0.5">
                  <li>Be marked as "Voided" in all reports</li>
                  <li>Be excluded from revenue calculations</li>
                  <li>Remain visible to administrators</li>
                  <li>Be logged in the audit trail</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowVoidDialog(false);
                    setVoidReason('');
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={isVoiding}
                >
                  Cancel
                </button>
                <button
                  onClick={handleVoid}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  disabled={isVoiding || !voidReason}
                >
                  {isVoiding ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Voiding...
                    </span>
                  ) : (
                    'Confirm Void'
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

export default TransactionActions;
