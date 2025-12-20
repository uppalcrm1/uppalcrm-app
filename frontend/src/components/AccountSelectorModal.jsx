import React, { useState, useEffect } from 'react';
import { Search, X, Package, User, CreditCard } from 'lucide-react';

/**
 * AccountSelectorModal
 * Modal for selecting an account before creating a transaction
 * Ensures every transaction is linked to an account (business rule enforcement)
 */
const AccountSelectorModal = ({ accounts, isOpen, onSelect, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter accounts based on search query
  const filteredAccounts = accounts.filter(account => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      (account.account_name || '').toLowerCase().includes(query) ||
      (account.contact_name || '').toLowerCase().includes(query) ||
      (account.mac_address || '').toLowerCase().includes(query) ||
      (account.edition || '').toLowerCase().includes(query)
    );
  });

  // Reset search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Select Account for Transaction</h2>
            <p className="text-sm text-gray-600 mt-1">Choose which account to record payment for</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by account name, contact, MAC address, or product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
              autoFocus
            />
          </div>
        </div>

        {/* Account List */}
        <div className="overflow-y-auto max-h-96">
          {filteredAccounts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery ? 'No accounts found' : 'No accounts available'}
              </h3>
              <p className="text-gray-600">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : 'Create an account before recording transactions'}
              </p>
            </div>
          ) : (
            filteredAccounts.map((account) => (
              <button
                key={account.id}
                onClick={() => {
                  onSelect(account);
                  onClose();
                }}
                className="w-full text-left px-6 py-4 hover:bg-gray-50 border-b border-gray-100 transition-colors focus:bg-blue-50 focus:outline-none"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {/* Account Name */}
                    <p className="font-medium text-gray-900 mb-1">
                      {account.account_name || 'Unnamed Account'}
                    </p>

                    {/* Details Row */}
                    <div className="flex flex-wrap gap-3 text-sm">
                      {/* Contact */}
                      {account.contact_name && (
                        <span className="flex items-center text-gray-600">
                          <User size={12} className="mr-1" />
                          {account.contact_name}
                        </span>
                      )}

                      {/* MAC Address */}
                      {account.mac_address && (
                        <span className="flex items-center text-gray-600 font-mono">
                          {account.mac_address}
                        </span>
                      )}

                      {/* Product */}
                      {account.edition && (
                        <span className="flex items-center text-blue-600">
                          <CreditCard size={12} className="mr-1" />
                          {account.edition}
                        </span>
                      )}

                      {/* Price */}
                      {account.price && (
                        <span className="flex items-center text-green-600 font-semibold">
                          ${parseFloat(account.price).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Select Indicator */}
                  <div className="ml-4">
                    <div className="text-blue-600 text-sm font-medium">Select →</div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600">
            Showing {filteredAccounts.length} of {accounts.length} accounts
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccountSelectorModal;
