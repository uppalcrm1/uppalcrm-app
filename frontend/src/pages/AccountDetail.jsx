import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, DollarSign, Plus,
  User, FileText, Clock
} from 'lucide-react';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import AccountDetailsPanel from '../components/Account/AccountDetailsPanel';
import AccountTransactionsList from '../components/Account/AccountTransactionsList';
import AccountHistoryPanel from '../components/Account/AccountHistoryPanel';
import CreateTransactionModal from '../components/CreateTransactionModal';

const AccountDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // State
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [relatedAccounts, setRelatedAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [showCreateTransactionModal, setShowCreateTransactionModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch account details
  useEffect(() => {
    fetchAccountDetail();
  }, [id, refreshKey]);

  const fetchAccountDetail = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/accounts/${id}/detail`);
      const { account: accountData, transactions: txnData, relatedAccounts: relatedData } = response.data;

      setAccount(accountData);
      setTransactions(txnData);
      setRelatedAccounts(relatedData);
    } catch (err) {
      setError('Failed to load account details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Tabs configuration
  const tabs = [
    { id: 'details', label: 'Details', icon: FileText },
    { id: 'transactions', label: 'Transactions', icon: DollarSign },
    { id: 'history', label: 'History', icon: Clock }
  ];

  // Status color
  const getStatusColor = () => {
    if (account?.license_status === 'active') {
      return account.days_until_renewal > 30
        ? 'bg-green-100 text-green-800'
        : 'bg-yellow-100 text-yellow-800';
    }
    return 'bg-red-100 text-red-800';
  };

  if (loading) return <LoadingSpinner />;
  if (error && !account) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">{error}</div>
          <button onClick={() => navigate('/accounts')} className="btn btn-primary">
            Back to Accounts
          </button>
        </div>
      </div>
    );
  }
  if (!account) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <button
                onClick={() => navigate('/accounts')}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="Back to Accounts"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {account.account_name || 'Unnamed Account'}
                </h1>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
                    {account.license_status || 'Unknown'}
                  </span>
                  {account.contact_name && (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <User size={16} />
                      <button
                        onClick={() => navigate(`/contacts/${account.contact_id}`)}
                        className="text-blue-600 hover:underline"
                      >
                        {account.contact_name}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateTransactionModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={16} className="mr-2" />
                Create Transaction
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6">
          <div className="flex gap-6 border-b border-gray-200">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-1 py-3 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={18} />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === 'details' && <AccountDetailsPanel account={account} />}
            {activeTab === 'transactions' && <AccountTransactionsList transactions={transactions} accountId={id} onRefresh={() => setRefreshKey(prev => prev + 1)} />}
            {activeTab === 'history' && <AccountHistoryPanel accountId={id} />}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Quick Info Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Info</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Contact</p>
                  <button
                    onClick={() => navigate(`/contacts/${account.contact_id}`)}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    {account.contact_name}
                  </button>
                  {account.contact_email && (
                    <p className="text-sm text-gray-600">{account.contact_email}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Product</p>
                  <p className="text-sm font-medium text-gray-900">
                    {account.edition_name || account.edition}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Next Renewal</p>
                  <p className="text-sm font-medium text-gray-900">
                    {account.next_renewal_date
                      ? new Date(account.next_renewal_date).toLocaleDateString()
                      : 'N/A'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Transactions</p>
                  <p className="text-sm font-medium text-gray-900">{transactions.length}</p>
                </div>
              </div>
            </div>

            {/* Related Accounts */}
            {relatedAccounts.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Other Accounts ({relatedAccounts.length})
                </h3>
                <div className="space-y-2">
                  {relatedAccounts.map((relAccount) => (
                    <button
                      key={relAccount.id}
                      onClick={() => {
                        navigate(`/accounts/${relAccount.id}`);
                        setRefreshKey(prev => prev + 1);
                      }}
                      className="w-full text-left p-2 rounded hover:bg-gray-50 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {relAccount.account_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {relAccount.edition} - {relAccount.license_status}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Transaction Modal */}
      <CreateTransactionModal
        isOpen={showCreateTransactionModal}
        account={account}
        onClose={() => setShowCreateTransactionModal(false)}
        onSuccess={() => setRefreshKey(prev => prev + 1)}
      />
    </div>
  );
};

export default AccountDetail;
