import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, DollarSign, User, Calendar, FileText,
  CreditCard, Tag, Clock, Building2
} from 'lucide-react';
import { transactionsAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const TransactionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTransactionDetail();
  }, [id]);

  const fetchTransactionDetail = async () => {
    try {
      setLoading(true);
      const response = await transactionsAPI.getTransaction(id);
      setTransaction(response.transaction || response);
    } catch (err) {
      setError('Failed to load transaction details');
      console.error(err);
      toast.error('Failed to load transaction details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      completed: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      failed: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-700'
    };
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount || 0);
  };

  if (loading) return <LoadingSpinner />;

  if (error && !transaction) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">{error}</div>
          <button onClick={() => navigate('/transactions')} className="btn btn-primary">
            Back to Transactions
          </button>
        </div>
      </div>
    );
  }

  if (!transaction) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Back button and transaction info */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/transactions')}
                className="text-blue-600 hover:text-blue-700 flex items-center gap-2 text-sm font-medium"
              >
                <ArrowLeft size={16} />
                Back to Transactions
              </button>
            </div>
          </div>

          {/* Transaction Header */}
          <div className="flex items-start justify-between mt-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {transaction.transaction_id || 'Transaction Details'}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                  {transaction.status || 'Unknown'}
                </span>
                <span className="text-sm text-gray-600">
                  {transaction.transaction_reference && `Ref: ${transaction.transaction_reference}`}
                </span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-600">Amount</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(transaction.amount, transaction.currency)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Transaction Details */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Transaction Details</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Payment Method</p>
                  <div className="flex items-center gap-2">
                    <CreditCard size={16} className="text-gray-400" />
                    <p className="text-sm font-medium text-gray-900">
                      {transaction.payment_method || 'N/A'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-1">Payment Date</p>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-gray-400" />
                    <p className="text-sm font-medium text-gray-900">
                      {transaction.payment_date
                        ? format(new Date(transaction.payment_date), 'MMM d, yyyy')
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-1">Source</p>
                  <div className="flex items-center gap-2">
                    <Tag size={16} className="text-gray-400" />
                    <p className="text-sm font-medium text-gray-900">
                      {transaction.source || 'N/A'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-1">Term</p>
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-gray-400" />
                    <p className="text-sm font-medium text-gray-900">
                      {transaction.term || 'N/A'}
                    </p>
                  </div>
                </div>

                {transaction.product_name && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600 mb-1">Product</p>
                    <p className="text-sm font-medium text-gray-900">
                      {transaction.product_name}
                    </p>
                  </div>
                )}

                {transaction.notes && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600 mb-1">Notes</p>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                      {transaction.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Related Entities */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Related Information</h2>
              <div className="space-y-4">
                {transaction.account_name && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Building2 size={20} className="text-purple-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Account</p>
                        <button
                          onClick={() => transaction.account_id && navigate(`/accounts/${transaction.account_id}`)}
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          {transaction.account_name}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {transaction.contact_name && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <User size={20} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Contact</p>
                        <button
                          onClick={() => transaction.contact_id && navigate(`/contacts/${transaction.contact_id}`)}
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          {transaction.contact_name}
                        </button>
                        {transaction.contact_email && (
                          <p className="text-xs text-gray-500">{transaction.contact_email}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Currency</span>
                  <span className="text-sm font-medium text-gray-900">
                    {transaction.currency || 'USD'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Amount</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </span>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold text-gray-900">Total</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Metadata Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Metadata</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Created At</p>
                  <p className="text-sm font-medium text-gray-900">
                    {transaction.created_at
                      ? format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')
                      : 'N/A'}
                  </p>
                </div>
                {transaction.updated_at && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Updated At</p>
                    <p className="text-sm font-medium text-gray-900">
                      {format(new Date(transaction.updated_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                )}
                {transaction.id && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Transaction ID</p>
                    <p className="text-xs font-mono text-gray-700 bg-gray-50 p-2 rounded break-all">
                      {transaction.id}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetail;
