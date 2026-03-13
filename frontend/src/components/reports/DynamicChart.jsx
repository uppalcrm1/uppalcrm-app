import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';

// Maximum number of slices for pie chart before grouping remainder into "Other"
const MAX_PIE_SLICES = 10;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Check if a field is a date field based on metadata.
 */
const isDateField = (fieldName, fieldsMeta = []) => {
  const meta = fieldsMeta.find(f => f.name === fieldName);
  if (meta) return meta.type === 'date';
  return false;
};

/**
 * Determine if a field is truly numeric based on field metadata.
 * Falls back to heuristic only when metadata is unavailable.
 */
const isNumericField = (fieldName, fieldsMeta = []) => {
  const meta = fieldsMeta.find(f => f.name === fieldName);
  if (meta) {
    return meta.type === 'number';
  }
  // No metadata — never treat uuid/date-looking values as numeric
  return false;
};

/**
 * Format a date value into a short readable month label like "Feb 2026".
 * Returns null if the value cannot be parsed as a date.
 */
const toMonthLabel = (value) => {
  if (!value) return 'Unknown';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return null;
  }
};

/**
 * Format a date value into a short readable label like "Feb 4, 2026".
 */
const formatDateLabel = (value) => {
  if (!value) return 'Unknown';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  } catch {
    return String(value);
  }
};

/**
 * Bucket date-keyed data by month, summing numeric fields.
 * Returns the original data if xAxisKey is not a date or bucketing isn't needed.
 */
const bucketByMonth = (rows, xAxisKey, numericKeys, fieldsMeta) => {
  if (!rows || rows.length === 0) return rows;
  if (!isDateField(xAxisKey, fieldsMeta)) return rows;

  const groups = {};
  rows.forEach(row => {
    const label = toMonthLabel(row[xAxisKey]) || 'Unknown';
    if (!groups[label]) {
      groups[label] = { [xAxisKey]: label, _count: 0 };
      numericKeys.forEach(k => { groups[label][k] = 0; });
    }
    groups[label]._count += 1;
    numericKeys.forEach(k => {
      groups[label][k] += (parseFloat(row[k]) || 0);
    });
  });

  // Sort chronologically
  return Object.values(groups).sort((a, b) => {
    const parse = (lbl) => {
      const parts = lbl.split(' ');
      if (parts.length !== 2) return 0;
      const mi = MONTH_NAMES.indexOf(parts[0]);
      const yr = parseInt(parts[1], 10);
      return yr * 100 + mi;
    };
    return parse(a[xAxisKey]) - parse(b[xAxisKey]);
  });
};

/**
 * For data where the x-axis is a date but there are few enough rows
 * that we don't need monthly bucketing, just format the labels nicely.
 */
const formatDateLabelsInData = (rows, xAxisKey, fieldsMeta) => {
  if (!rows || rows.length === 0) return rows;
  if (!isDateField(xAxisKey, fieldsMeta)) return rows;

  return rows.map(row => ({
    ...row,
    [xAxisKey]: formatDateLabel(row[xAxisKey])
  }));
};

/**
 * Auto-aggregate raw data for chart display.
 * Groups by the first text/select/date field (xAxisKey) and SUMs numeric fields.
 * If data is already aggregated (groupBy was used server-side), returns as-is.
 */
const aggregateData = (rawData, xAxisKey, numericKeys) => {
  if (!rawData || rawData.length === 0) return rawData;

  // If there are ≤30 rows, data is likely already aggregated or small enough
  if (rawData.length <= 30) return rawData;

  const groups = {};
  rawData.forEach(row => {
    const groupKey = String(row[xAxisKey] ?? 'Unknown');
    if (!groups[groupKey]) {
      groups[groupKey] = { [xAxisKey]: groupKey, _count: 0 };
      numericKeys.forEach(k => { groups[groupKey][k] = 0; });
    }
    groups[groupKey]._count += 1;
    numericKeys.forEach(k => {
      groups[groupKey][k] += (parseFloat(row[k]) || 0);
    });
  });

  const result = Object.values(groups);

  // If grouping produced only 1 group (e.g. all source=renewal), fall back to
  // a date-based aggregation if a date field exists in the data
  if (result.length <= 1) {
    const allKeys = Object.keys(rawData[0] || {});
    // Look for a date-ish field in the raw data
    const dateCandidates = allKeys.filter(k => {
      if (k === xAxisKey) return false;
      const sample = rawData[0][k];
      if (typeof sample === 'string' && /\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}/.test(sample)) return true;
      if (sample instanceof Date) return true;
      return false;
    });

    if (dateCandidates.length > 0) {
      const dateKey = dateCandidates[0];
      const dateGroups = {};
      rawData.forEach(row => {
        const rawDate = row[dateKey];
        // Normalize to YYYY-MM format for monthly buckets
        let monthKey;
        try {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          } else {
            monthKey = 'Unknown';
          }
        } catch {
          monthKey = 'Unknown';
        }

        if (!dateGroups[monthKey]) {
          dateGroups[monthKey] = { [dateKey]: monthKey, _count: 0 };
          numericKeys.forEach(k => { dateGroups[monthKey][k] = 0; });
        }
        dateGroups[monthKey]._count += 1;
        numericKeys.forEach(k => {
          dateGroups[monthKey][k] += (parseFloat(row[k]) || 0);
        });
      });

      return Object.values(dateGroups).sort((a, b) =>
        String(a[dateKey]).localeCompare(String(b[dateKey]))
      );
    }
  }

  // Sort by largest numeric value descending
  if (numericKeys.length > 0) {
    result.sort((a, b) => (b[numericKeys[0]] || 0) - (a[numericKeys[0]] || 0));
  }

  return result;
};

/**
 * Cap pie chart data to MAX_PIE_SLICES, grouping the rest into "Other".
 */
const capPieSlices = (pieData) => {
  if (pieData.length <= MAX_PIE_SLICES) return pieData;

  const top = pieData.slice(0, MAX_PIE_SLICES);
  const rest = pieData.slice(MAX_PIE_SLICES);
  const otherValue = rest.reduce((sum, item) => sum + (item.value || 0), 0);

  return [
    ...top,
    { name: 'Other', value: otherValue, fill: '#9ca3af' }
  ];
};

/**
 * DynamicChart Component
 * Renders different chart types based on chartType prop.
 * Accepts optional `fields` metadata array to properly identify numeric vs non-numeric fields.
 * Auto-aggregates raw data when many rows are present.
 */
const DynamicChart = ({ data = [], chartType = 'line', config = {}, fields = [] }) => {
  // Colors for charts
  const COLORS = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // orange
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316'  // orange-red
  ];

  // If no data, show empty state
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full border-2 border-dashed border-gray-300 rounded-lg">
        <div className="text-center">
          <div className="text-gray-500 text-lg font-medium mb-2">No Data to Display</div>
          <div className="text-gray-400 text-sm">
            Run the report to see chart visualization
          </div>
        </div>
      </div>
    );
  }

  // Get keys for visualization using field metadata for proper type detection
  const dataKeys = Object.keys(data[0] || {});

  // Determine numeric keys using field metadata (not parseFloat heuristic)
  const numericKeys = dataKeys.filter(key => isNumericField(key, fields));

  // X-axis: pick the non-numeric field with the most unique values
  // This avoids labelling every bar "renewal" when source is filtered to one value
  const nonNumericKeys = dataKeys.filter(key => !numericKeys.includes(key));
  const xAxisKey = useMemo(() => {
    if (nonNumericKeys.length === 0) return dataKeys[0];
    if (nonNumericKeys.length === 1) return nonNumericKeys[0];

    // Score each candidate by number of unique values in the data
    let bestKey = nonNumericKeys[0];
    let bestUniqueCount = 0;
    for (const key of nonNumericKeys) {
      const uniqueVals = new Set(data.map(row => row[key]));
      if (uniqueVals.size > bestUniqueCount) {
        bestUniqueCount = uniqueVals.size;
        bestKey = key;
      }
    }
    return bestKey;
  }, [data, nonNumericKeys.join(',')]);

  const yAxisKeys = numericKeys.filter(key => key !== xAxisKey);

  // Auto-aggregate data for chart display, then apply date bucketing
  const chartData = useMemo(() => {
    let processed = aggregateData(data, xAxisKey, yAxisKeys);

    // If x-axis is a date field, bucket by month for cleaner charts
    if (isDateField(xAxisKey, fields)) {
      // If there are many unique date values, bucket by month
      const uniqueDates = new Set(processed.map(r => toMonthLabel(r[xAxisKey])));
      if (processed.length > uniqueDates.size || processed.length > 12) {
        processed = bucketByMonth(processed, xAxisKey, yAxisKeys, fields);
      } else {
        // Few enough distinct dates — just format them readably
        processed = formatDateLabelsInData(processed, xAxisKey, fields);
      }
    }

    return processed;
  }, [data, xAxisKey, yAxisKeys.join(','), fields]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Format Y-axis tick
  const formatYAxis = (value) => {
    if (typeof value !== 'number') return value;

    // If value is large, use K/M notation
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toLocaleString();
  };

  // Show aggregation notice
  const isAggregated = chartData !== data;
  const AggregationNotice = () => isAggregated ? (
    <div className="text-xs text-gray-500 text-center pb-1">
      Data auto-grouped by <strong>{xAxisKey}</strong> ({chartData.length} groups from {data.length} rows) — use Group By for custom aggregation
    </div>
  ) : null;

  // Render based on chart type
  switch (chartType) {
    case 'line':
      return (
        <div className="h-full flex flex-col">
          <AggregationNotice />
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey={xAxisKey}
                  stroke="#6b7280"
                  tick={{ fontSize: 12 }}
                  angle={chartData.length > 10 ? -45 : 0}
                  textAnchor={chartData.length > 10 ? 'end' : 'middle'}
                  height={chartData.length > 10 ? 80 : 60}
                />
                <YAxis
                  stroke="#6b7280"
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatYAxis}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                {yAxisKeys.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      );

    case 'bar':
      return (
        <div className="h-full flex flex-col">
          <AggregationNotice />
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey={xAxisKey}
                  stroke="#6b7280"
                  tick={{ fontSize: 12 }}
                  angle={chartData.length > 10 ? -45 : 0}
                  textAnchor={chartData.length > 10 ? 'end' : 'middle'}
                  height={chartData.length > 10 ? 80 : 60}
                />
                <YAxis
                  stroke="#6b7280"
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatYAxis}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                {yAxisKeys.map((key, index) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );

    case 'pie': {
      // For pie chart, use first numeric field
      const pieDataKey = yAxisKeys[0];
      if (!pieDataKey) {
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <div className="text-lg font-medium mb-2">No Numeric Field Available</div>
              <div className="text-sm">Select at least one numeric field (e.g. Amount) to display a pie chart.</div>
            </div>
          </div>
        );
      }

      // Transform aggregated data for pie chart
      const rawPieData = chartData.map((item, index) => ({
        name: String(item[xAxisKey] ?? 'Unknown'),
        value: parseFloat(item[pieDataKey]) || 0,
        fill: COLORS[index % COLORS.length]
      })).filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);

      // Cap slices to avoid rendering chaos
      const pieData = capPieSlices(rawPieData);

      return (
        <div className="h-full flex flex-col">
          <AggregationNotice />
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={Math.min(200, window.innerHeight * 0.3)}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: '#6b7280' }}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => {
                    if (typeof value === 'number') {
                      return value.toLocaleString();
                    }
                    return value;
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    case 'area':
      return (
        <div className="h-full flex flex-col">
          <AggregationNotice />
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <defs>
                  {yAxisKeys.map((key, index) => (
                    <linearGradient key={key} id={`color${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.1} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey={xAxisKey}
                  stroke="#6b7280"
                  tick={{ fontSize: 12 }}
                  angle={chartData.length > 10 ? -45 : 0}
                  textAnchor={chartData.length > 10 ? 'end' : 'middle'}
                  height={chartData.length > 10 ? 80 : 60}
                />
                <YAxis
                  stroke="#6b7280"
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatYAxis}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                {yAxisKeys.map((key, index) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={COLORS[index % COLORS.length]}
                    fillOpacity={1}
                    fill={`url(#color${key})`}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      );

    default:
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500">
            Unsupported chart type: {chartType}
          </div>
        </div>
      );
  }
};

export default DynamicChart;
