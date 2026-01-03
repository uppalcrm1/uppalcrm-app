import React, { useState, useEffect } from 'react';
import { DollarSign, Save, RefreshCw, Info } from 'lucide-react';
import { transactionsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/currency';

const ExchangeRateSettings = () => {
  const [exchangeRate, setExchangeRate] = useState(1.25);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchExchangeRate();
  }, []);

  const fetchExchangeRate = async () => {
    try {
      setLoading(true);
      const response = await transactionsAPI.getExchangeRate();
      setExchangeRate(response.exchange_rate_usd_to_cad);
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      toast.error('Failed to load exchange rate');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (exchangeRate <= 0) {
      toast.error('Exchange rate must be greater than 0');
      return;
    }

    try {
      setSaving(true);
      await transactionsAPI.updateExchangeRate(exchangeRate);
      toast.success('Exchange rate updated successfully');
    } catch (error) {
      console.error('Error updating exchange rate:', error);
      toast.error('Failed to update exchange rate');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card max-w-2xl">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card max-w-2xl">
      <div className="flex items-center mb-6">
        <DollarSign className="text-blue-600 mr-2" size={24} />
        <div>
          <h3 className="text-lg font-semibold">Currency Exchange Rate</h3>
          <p className="text-sm text-gray-600">Configure USD to CAD conversion rate</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Exchange Rate Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            USD to CAD Exchange Rate
          </label>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-500 text-sm">1 USD =</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value))}
                  className="input pl-20"
                  placeholder="1.25"
                />
                <span className="absolute right-3 top-3 text-gray-500 text-sm">CAD</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Current rate: <span className="font-medium">100 USD = {(100 * exchangeRate).toFixed(2)} CAD</span>
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || exchangeRate <= 0}
              className="btn btn-primary"
            >
              {saving ? (
                <>
                  <RefreshCw size={16} className="mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} className="mr-2" />
                  Save Rate
                </>
              )}
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="text-blue-600 mr-2 flex-shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-2">
                How This Works
              </h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• All revenue reports display totals in <strong>CAD</strong></li>
                <li>• Transactions in USD are automatically converted to CAD using this rate</li>
                <li>• Update this rate whenever the exchange rate changes</li>
                <li>• Revenue calculations use the current rate at the time of reporting</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Example Conversions */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Example Conversions
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-sm text-gray-700">$100.00 USD</span>
              <span className="text-sm font-medium text-gray-900">
                → {formatCurrency(100 * exchangeRate, 'CAD')}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-sm text-gray-700">$500.00 USD</span>
              <span className="text-sm font-medium text-gray-900">
                → {formatCurrency(500 * exchangeRate, 'CAD')}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-700">$1,000.00 USD</span>
              <span className="text-sm font-medium text-gray-900">
                → {formatCurrency(1000 * exchangeRate, 'CAD')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExchangeRateSettings;
