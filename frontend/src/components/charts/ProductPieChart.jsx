import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

/**
 * Product Pie Chart
 * Displays revenue or accounts distribution by product
 */
const ProductPieChart = ({ data, dataKey = 'revenue', height = 300, title = 'Revenue' }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No product data available
      </div>
    );
  }

  // Color palette for products
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  // Format data for Recharts
  const chartData = data.map((item, index) => ({
    name: item.name || 'Unknown',
    value: dataKey === 'revenue' ? parseFloat(item.revenue) || 0 : parseInt(item.count) || 0,
    count: item.transactionCount || item.count || 0,
    color: COLORS[index % COLORS.length]
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900">{data.name}</p>
          <p className="text-sm font-semibold" style={{ color: data.color }}>
            {dataKey === 'revenue'
              ? `Revenue: $${data.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `Accounts: ${data.value.toLocaleString()}`
            }
          </p>
          {dataKey === 'revenue' && (
            <p className="text-xs text-gray-600">
              {data.count} transaction{data.count !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Custom label
  const renderLabel = (entry) => {
    const percent = ((entry.value / chartData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(0);
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

export default ProductPieChart;
