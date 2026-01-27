import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import TransactionsRevenueBySourceReport from '../components/reports/TransactionsRevenueBySourceReport';

/**
 * Transactions Revenue by Source Report Page
 * Displays the standard pre-built report for revenue grouped by source
 */
const TransactionsRevenueBySourceReportPage = () => {
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
      <TransactionsRevenueBySourceReport />
    </div>
  );
};

export default TransactionsRevenueBySourceReportPage;
