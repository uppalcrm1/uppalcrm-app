import React from 'react';
import { Building2, CreditCard, Monitor } from 'lucide-react';
import { formatDateOnly } from '../../utils/dateUtils';
import { formatBillingTerm } from '../../utils/billingHelpers';

const AccountDetailsPanel = ({ account }) => {
  return (
    <div className="space-y-6">
      {/* Account Information Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Building2 size={20} />
            Account Information
          </h3>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Account Name</p>
            <p className="text-sm font-medium text-gray-900">{account.account_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p className="text-sm font-medium text-gray-900">{account.license_status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Product</p>
            <p className="text-sm font-medium text-gray-900">{account.edition_name || account.edition}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Created Date</p>
            <p className="text-sm font-medium text-gray-900">
              {formatDateOnly(account.created_at)}
            </p>
          </div>
          {account.account_type && (
            <div>
              <p className="text-sm text-gray-500">Account Type</p>
              <p className="text-sm font-medium text-gray-900 capitalize">{account.account_type}</p>
            </div>
          )}
        </div>
      </div>

      {/* Device Information Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Monitor size={20} />
            Device Information
          </h3>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">MAC Address</p>
            <p className="text-sm font-mono font-medium text-gray-900">{account.mac_address || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Device Name</p>
            <p className="text-sm font-medium text-gray-900">{account.device_name || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Billing Information Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <CreditCard size={20} />
            Billing Information
          </h3>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Billing Cycle</p>
            <p className="text-sm font-medium text-gray-900">
              {account.billing_term_months ? formatBillingTerm(account.billing_term_months) : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Price</p>
            <p className="text-sm font-medium text-gray-900">
              {account.price ? `$${account.price}` : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Next Renewal</p>
            <p className="text-sm font-medium text-gray-900">
              {formatDateOnly(account.next_renewal_date)}
            </p>
          </div>
          {account.days_until_renewal != null && (
            <div>
              <p className="text-sm text-gray-500">Days Until Renewal</p>
              <p className="text-sm font-medium text-gray-900">
                {Math.floor(account.days_until_renewal)} days
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountDetailsPanel;
