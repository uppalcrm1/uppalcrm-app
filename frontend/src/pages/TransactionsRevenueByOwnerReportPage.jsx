import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import TransactionsRevenueByOwnerReport from '../components/reports/TransactionsRevenueByOwnerReport';

/**
 * Transaction Revenue by Owner Report Page
 * Displays the standard pre-built report for revenue grouped by lead owner
 */
const TransactionsRevenueByOwnerReportPage = () => {
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
      <TransactionsRevenueByOwnerReport />
    </div>
  );
};

export default TransactionsRevenueByOwnerReportPage;
