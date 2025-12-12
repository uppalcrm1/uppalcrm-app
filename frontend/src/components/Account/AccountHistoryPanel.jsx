import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import api from '../../services/api';

const AccountHistoryPanel = ({ accountId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [accountId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      // Placeholder for future implementation
      // const response = await api.get(`/accounts/${accountId}/history`);
      // setHistory(response.data);
      setHistory([]); // Placeholder
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading history...</div>;
  }

  if (history.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <Clock size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No History</h3>
        <p className="text-gray-500">No history records available for this account.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Account History</h3>
      {/* Future: Implement history timeline */}
      <div className="space-y-4">
        {history.map((item, index) => (
          <div key={index} className="border-l-2 border-blue-500 pl-4 py-2">
            <p className="text-sm font-medium text-gray-900">{item.action}</p>
            <p className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AccountHistoryPanel;
