import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

/**
 * Payment Methods Chart
 * Displays revenue distribution by payment method
 */
const PaymentMethodsChart = ({ data, height = 300 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No payment method data available
      </div>
    );
  }

  // Color palette for payment methods
  const COLORS = {
    'Credit Card': '#3b82f6',
    'credit_card': '#3b82f6',
    'PayPal': '#ffc439',
    'paypal': '#ffc439',
    'Bank Transfer': '#10b981',
    'bank_transfer': '#10b981',
    'Cash': '#22c55e',
    'cash': '#22c55e',
    'Check': '#8b5cf6',
    'check': '#8b5cf6',
    'Other': '#6b7280',
    'Not Specified': '#9ca3af'
  };

  // Format data for Recharts
  const chartData = data.map((item) => {
    const methodName = item.name || 'Not Specified';
    return {
      name: methodName,
      value: parseFloat(item.revenue) || 0,
      count: item.transactionCount || 0,
      color: COLORS[methodName] || COLORS[methodName.toLowerCase()] || '#6b7280'
    };
  });

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900">{data.name}</p>
          <p className="text-sm font-semibold" style={{ color: data.color }}>
            Revenue: ${data.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-600">
            {data.count} transaction{data.count !== 1 ? 's' : ''}
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom label
  const renderLabel = (entry) => {
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    const percent = ((entry.value / total) * 100).toFixed(0);
    return `${percent}%`;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderLabel}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '14px' }}
          formatter={(value, entry) => {
            const item = chartData.find(d => d.name === value);
            return (
              <span style={{ color: item?.color }}>
                {value}
              </span>
            );
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default PaymentMethodsChart;
