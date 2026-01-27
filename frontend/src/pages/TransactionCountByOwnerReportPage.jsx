import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import TransactionCountByOwnerReport from '../components/reports/TransactionCountByOwnerReport';

/**
 * Transaction Count by Owner Report Page
 * Displays the standard pre-built report for transaction count grouped by lead owner
 */
const TransactionCountByOwnerReportPage = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => navigate('/reports')}
          className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Back to Reports</span>
        </button>
      </div>

      {/* Report Component */}
      <TransactionCountByOwnerReport />
    </div>
  );
};

export default TransactionCountByOwnerReportPage;
