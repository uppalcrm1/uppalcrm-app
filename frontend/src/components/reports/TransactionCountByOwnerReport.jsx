import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../LoadingSpinner';
import { reportingAPI } from '../../services/api';

/**
 * Transaction Count by Owner Report
 * Standard pre-built report showing transaction count grouped by lead owner at time of conversion
 */
const TransactionCountByOwnerReport = () => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [chartType, setChartType] = useState('table'); // 'table', 'bar', 'pie'

  // Fetch transaction count by owner
  const { data: reportData, isLoading, error, refetch } = useQuery({
    queryKey: ['transactionCountByOwner', { year: selectedYear, month: selectedMonth }],
    queryFn: () => reportingAPI.getTransactionCountByOwner(selectedYear, selectedMonth)
  });

  // Format month display
  const monthDisplay = new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!reportData?.data?.data) return [];
    return reportData.data.data.map(item => ({
      ...item,
      displayPercentage: `${item.percentage}%`
    }));
  }, [reportData]);

  // Colors for charts
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#f97316', '#06b6d4'];

  // Handle month change
  const handleMonthChange = (direction) => {
    let newMonth = selectedMonth + direction;
    let newYear = selectedYear;

    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }

    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  // Handle CSV export
  const handleExportCSV = () => {
    if (!reportData?.data?.data) return;

    const data = reportData.data.data;
    const summary = reportData.data.summary;

    // Create CSV content
    const headers = ['Owner Name', 'Transaction Count', 'Percentage', 'Total Revenue'];
    const rows = data.map(item => [
      item.ownerName,
      item.count,
      `${item.percentage}%`,
      `$${item.amount.toFixed(2)}`
    ]);

    // Add summary
    rows.push([]);
    rows.push(['SUMMARY', '', '', '']);
    rows.push(['Total Transactions', summary.totalTransactions, '100%', `$${summary.totalAmount.toFixed(2)}`]);
    rows.push(['Top Owner', summary.topOwner, `${summary.topOwnerPercentage}%`, '']);
    rows.push(['Period', `${monthDisplay}`, '', '']);

    // Escape CSV values
    const escapeCSV = (value) => {
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csv = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `transaction-count-by-owner-${timestamp}.csv`);
    link.click();

    toast.success('Report exported successfully!');
  };

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-lg p-6">
        <div className="text-red-700">
          <p className="font-semibold">Error loading report</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transaction Count by Owner</h2>
          <p className="text-gray-600 text-sm mt-1">View transaction volume by lead owner at time of conversion</p>
        </div>
      </div>

      {/* Filter and Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Month Selector */}
          <div className="flex items-center space-x-3">
            <Calendar className="h-5 w-5 text-gray-400" />
            <button
              onClick={() => handleMonthChange(-1)}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              title="Previous month"
            >
              ←
            </button>
            <div className="min-w-48 text-center font-semibold text-gray-900">
              {monthDisplay}
            </div>
            <button
              onClick={() => handleMonthChange(1)}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              title="Next month"
            >
              →
            </button>
          </div>

          {/* Chart Type Selector */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setChartType('table')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                chartType === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                chartType === 'bar'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Bar Chart
            </button>
            <button
              onClick={() => setChartType('pie')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                chartType === 'pie'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pie Chart
            </button>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExportCSV}
            disabled={isLoading || !reportData?.data?.data}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      )}

      {/* Summary Cards */}
      {!isLoading && reportData?.data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Transactions */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm font-medium mb-2">Total Transactions</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.data.summary.totalTransactions}</p>
              <p className="text-xs text-gray-500 mt-2">in {monthDisplay}</p>
            </div>

            {/* Top Owner */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm font-medium mb-2">Top Owner</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.data.summary.topOwner}</p>
              <p className="text-xs text-gray-500 mt-2">{reportData.data.summary.topOwnerCount} transactions</p>
            </div>

            {/* Top Owner Percentage */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm font-medium mb-2">Top Owner %</p>
              <p className="text-3xl font-bold text-purple-600">
                {reportData.data.summary.topOwnerPercentage}%
              </p>
              <p className="text-xs text-gray-500 mt-2">of total transactions</p>
            </div>
          </div>

          {/* Content */}
          {chartData.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-12 text-center">
              <p className="text-gray-500">No transactions found for {monthDisplay}</p>
            </div>
          ) : (
            <>
              {/* Table View */}
              {chartType === 'table' && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Owner Name</th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Count</th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Percentage</th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.map((row, index) => (
                        <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.ownerName}</td>
                          <td className="px-6 py-4 text-sm text-right text-gray-900">{row.count}</td>
                          <td className="px-6 py-4 text-sm text-right text-gray-600">{row.percentage}%</td>
                          <td className="px-6 py-4 text-sm text-right text-gray-900 font-medium">${row.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                      {/* Total Row */}
                      <tr className="bg-gray-50 border-t-2 border-gray-300">
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">TOTAL</td>
                        <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">{reportData.data.summary.totalTransactions}</td>
                        <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">100%</td>
                        <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">${reportData.data.summary.totalAmount.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bar Chart View */}
              {chartType === 'bar' && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="ownerName" />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => {
                          if (typeof value === 'number') return value;
                          return value;
                        }}
                      />
                      <Legend />
                      <Bar dataKey="count" fill="#3b82f6" name="Transaction Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Pie Chart View */}
              {chartType === 'pie' && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="count"
                        nameKey="ownerName"
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        label={(entry) => `${entry.ownerName} (${entry.percentage}%)`}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => {
                          if (name === 'count') return [value, 'Transactions'];
                          return value;
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default TransactionCountByOwnerReport;
