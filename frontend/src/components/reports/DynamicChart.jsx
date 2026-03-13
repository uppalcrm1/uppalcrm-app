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
  Cell,
  Label
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
 * If a category key is provided, preserves the category dimension.
 * Returns the original data if xAxisKey is not a date or bucketing isn't needed.
 */
const bucketByMonth = (rows, xAxisKey, numericKeys, fieldsMeta, categoryKey = null) => {
  if (!rows || rows.length === 0) return rows;
  if (!isDateField(xAxisKey, fieldsMeta)) return rows;

  const groups = {};
  rows.forEach(row => {
    const label = toMonthLabel(row[xAxisKey]) || 'Unknown';
    const catVal = categoryKey ? String(row[categoryKey] ?? 'Unknown') : null;
    const groupId = categoryKey ? `${label}|||${catVal}` : label;

    if (!groups[groupId]) {
      groups[groupId] = { [xAxisKey]: label, _count: 0 };
      if (categoryKey) groups[groupId][categoryKey] = catVal;
      numericKeys.forEach(k => { groups[groupId][k] = 0; });
    }
    groups[groupId]._count += 1;
    numericKeys.forEach(k => {
      groups[groupId][k] += (parseFloat(row[k]) || 0);
    });
  });

  // Sort chronologically
  return Object.values(groups).sort((a, b) => {
    const parse = (lbl) => {
      const parts = String(lbl).split(' ');
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
 * Pivot data by a category field.
 * Turns rows like:
 *   { month: "Feb 2026", source: "renewal", amount: 500 }
 *   { month: "Feb 2026", source: "new_sale", amount: 200 }
 * Into:
 *   { month: "Feb 2026", renewal: 500, new_sale: 200 }
 *
 * Returns { pivotedData, pivotKeys } where pivotKeys are the new series names.
 */
const pivotByCategory = (rows, xAxisKey, categoryKey, numericKey) => {
  if (!rows || rows.length === 0 || !categoryKey || !numericKey) {
    return { pivotedData: rows, pivotKeys: [] };
  }

  const grouped = {};
  const allCategories = new Set();

  rows.forEach(row => {
    const xVal = row[xAxisKey];
    const catVal = String(row[categoryKey] ?? 'Unknown');
    allCategories.add(catVal);

    if (!grouped[xVal]) {
      grouped[xVal] = { [xAxisKey]: xVal };
    }
    grouped[xVal][catVal] = (grouped[xVal][catVal] || 0) + (parseFloat(row[numericKey]) || 0);
  });

  const pivotKeys = Array.from(allCategories).sort();
  // Ensure every row has all category keys (default 0)
  const pivotedData = Object.values(grouped).map(row => {
    pivotKeys.forEach(k => { if (row[k] === undefined) row[k] = 0; });
    return row;
  });

  return { pivotedData, pivotKeys };
};

/**
 * Auto-aggregate raw data for chart display.
 * Groups by the first text/select/date field (xAxisKey) and SUMs numeric fields.
 * If data is already aggregated (groupBy was used server-side), returns as-is.
 */
const aggregateData = (rawData, xAxisKey, numericKeys, aggregation = 'sum') => {
  if (!rawData || rawData.length === 0) return rawData;

  // If there are ≤30 rows, data is likely already aggregated or small enough
  if (rawData.length <= 30) return rawData;

  const applyAgg = (acc, value, count) => {
    const num = parseFloat(value) || 0;
    switch (aggregation) {
      case 'count': return acc + 1;
      case 'avg': return acc + num; // divide later by _count
      case 'min': return count === 1 ? num : Math.min(acc, num);
      case 'max': return count === 1 ? num : Math.max(acc, num);
      default: return acc + num; // sum
    }
  };

  const groups = {};
  rawData.forEach(row => {
    const groupKey = String(row[xAxisKey] ?? 'Unknown');
    if (!groups[groupKey]) {
      groups[groupKey] = { [xAxisKey]: groupKey, _count: 0 };
      numericKeys.forEach(k => { groups[groupKey][k] = 0; });
    }
    groups[groupKey]._count += 1;
    numericKeys.forEach(k => {
      groups[groupKey][k] = applyAgg(groups[groupKey][k], row[k], groups[groupKey]._count);
    });
  });

  const result = Object.values(groups);

  // Finalize avg: divide accumulated sums by count
  if (aggregation === 'avg') {
    result.forEach(row => {
      numericKeys.forEach(k => {
        row[k] = row._count > 0 ? row[k] / row._count : 0;
      });
    });
  }

  // For count mode, replace numeric values with the count
  if (aggregation === 'count') {
    result.forEach(row => {
      numericKeys.forEach(k => {
        row[k] = row._count;
      });
    });
  }

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
          dateGroups[monthKey][k] = applyAgg(dateGroups[monthKey][k], row[k], dateGroups[monthKey]._count);
        });
      });

      const dateResult = Object.values(dateGroups).sort((a, b) =>
        String(a[dateKey]).localeCompare(String(b[dateKey]))
      );
      if (aggregation === 'avg') {
        dateResult.forEach(row => {
          numericKeys.forEach(k => { row[k] = row._count > 0 ? row[k] / row._count : 0; });
        });
      }
      if (aggregation === 'count') {
        dateResult.forEach(row => {
          numericKeys.forEach(k => { row[k] = row._count; });
        });
      }
      return dateResult;
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
 * Get human-readable label for a field name.
 */
const getFieldLabel = (fieldName, fieldsMeta = []) => {
  const meta = fieldsMeta.find(f => f.name === fieldName);
  return meta?.label || fieldName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

/**
 * Check if a field represents currency/money.
 */
const isCurrencyField = (fieldName) => {
  const lower = fieldName.toLowerCase();
  return ['amount', 'value', 'price', 'cost', 'revenue', 'total', 'balance', 'payment'].some(w => lower.includes(w));
};

/**
 * Format a value for display, with $ prefix for currency fields.
 */
const formatValue = (value, fieldName) => {
  if (typeof value !== 'number') return value;
  if (isCurrencyField(fieldName)) {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return value.toLocaleString();
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

    // Prefer date fields as x-axis when available (natural timeline)
    const dateField = nonNumericKeys.find(k => isDateField(k, fields));
    if (dateField) return dateField;

    // Otherwise score each candidate by number of unique values in the data
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

  // Category key: the other non-numeric, non-xAxis field used to split series
  // (e.g. "source" when x-axis is "transaction_date")
  const categoryKey = useMemo(() => {
    const candidates = nonNumericKeys.filter(k => k !== xAxisKey);
    if (candidates.length === 0) return null;
    // Pick the one with moderate cardinality (good for legend)
    let best = candidates[0];
    let bestCount = new Set(data.map(r => r[best])).size;
    for (const k of candidates.slice(1)) {
      const count = new Set(data.map(r => r[k])).size;
      // Prefer fields with 2-20 unique values (good for chart series)
      if (count >= 2 && count <= 20 && (bestCount < 2 || bestCount > 20 || count < bestCount)) {
        best = k;
        bestCount = count;
      }
    }
    // Only use as category if there are multiple distinct values
    return bestCount >= 2 ? best : null;
  }, [data, nonNumericKeys.join(','), xAxisKey]);

  const yAxisKeys = numericKeys.filter(key => key !== xAxisKey);

  // Build human-readable axis labels
  const xAxisLabel = getFieldLabel(xAxisKey, fields);
  const yAxisLabel = useMemo(() => {
    if (yAxisKeys.length === 0) return '';
    const hasGroupBy = config.groupBy && config.groupBy.length > 0;
    const willAggregate = data.length > 30 || hasGroupBy;
    const primaryField = getFieldLabel(yAxisKeys[0], fields);
    if (!willAggregate) return primaryField;
    const agg = (config.aggregation || 'sum').toLowerCase();
    const aggLabels = { sum: 'Sum', count: 'Count', avg: 'Avg', min: 'Min', max: 'Max' };
    return `${aggLabels[agg] || 'Sum'} of ${primaryField}`;
  }, [yAxisKeys, fields, config, data.length]);

  // Auto-aggregate data for chart display, then apply date bucketing and pivoting
  const { chartData, seriesKeys } = useMemo(() => {
    let processed = aggregateData(data, xAxisKey, yAxisKeys, config.aggregation || 'sum');

    // If x-axis is a date field, bucket by month for cleaner charts
    if (isDateField(xAxisKey, fields)) {
      const uniqueDates = new Set(processed.map(r => toMonthLabel(r[xAxisKey])));
      if (processed.length > uniqueDates.size || processed.length > 12) {
        processed = bucketByMonth(processed, xAxisKey, yAxisKeys, fields, categoryKey);
      } else {
        processed = formatDateLabelsInData(processed, xAxisKey, fields);
      }
    }

    // If there's a category field, pivot it into separate series
    if (categoryKey && yAxisKeys.length > 0) {
      const { pivotedData, pivotKeys } = pivotByCategory(
        processed, xAxisKey, categoryKey, yAxisKeys[0]
      );
      if (pivotKeys.length >= 2) {
        return { chartData: pivotedData, seriesKeys: pivotKeys };
      }
    }

    return { chartData: processed, seriesKeys: yAxisKeys };
  }, [data, xAxisKey, yAxisKeys.join(','), categoryKey, fields]);

  // Custom tooltip — hides zero values, formats currency
  const isCountMode = (config.aggregation || 'sum') === 'count';
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // Filter out zero-value entries
      const nonZeroPayload = payload.filter(entry => entry.value !== 0);
      if (nonZeroPayload.length === 0) return null;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {nonZeroPayload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {isCountMode ? entry.value.toLocaleString() : formatValue(entry.value, entry.dataKey || entry.name)}
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
    if (isCountMode) {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
      return value.toLocaleString();
    }
    const prefix = isCurrencyField(yAxisKeys[0] || '') ? '$' : '';
    if (value >= 1000000) {
      return `${prefix}${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${prefix}${(value / 1000).toFixed(1)}K`;
    }
    return `${prefix}${value.toLocaleString()}`;
  };

  // Show aggregation notice — only when client auto-grouped (not when user set Group By)
  const hasExplicitGroupBy = config.groupBy && config.groupBy.length > 0;
  const isAutoAggregated = chartData !== data && !hasExplicitGroupBy;
  const AggregationNotice = () => isAutoAggregated ? (
    <div className="text-xs text-gray-500 text-center pb-1">
      Data auto-grouped by <strong>{xAxisLabel}</strong> ({chartData.length} groups from {data.length} rows) — use Group By for custom aggregation
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
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 40, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey={xAxisKey}
                  stroke="#6b7280"
                  tick={{ fontSize: 12 }}
                  angle={chartData.length > 10 ? -45 : 0}
                  textAnchor={chartData.length > 10 ? 'end' : 'middle'}
                  height={chartData.length > 10 ? 80 : 60}
                >
                  <Label value={xAxisLabel} position="bottom" offset={chartData.length > 10 ? 65 : 5} style={{ fill: '#374151', fontSize: 13, fontWeight: 600 }} />
                </XAxis>
                <YAxis
                  stroke="#6b7280"
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatYAxis}
                >
                  <Label value={yAxisLabel} angle={-90} position="insideLeft" offset={-25} style={{ fill: '#374151', fontSize: 13, fontWeight: 600, textAnchor: 'middle' }} />
                </YAxis>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                {seriesKeys.map((key, index) => (
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
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 40, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey={xAxisKey}
                  stroke="#6b7280"
                  tick={{ fontSize: 12 }}
                  angle={chartData.length > 10 ? -45 : 0}
                  textAnchor={chartData.length > 10 ? 'end' : 'middle'}
                  height={chartData.length > 10 ? 80 : 60}
                >
                  <Label value={xAxisLabel} position="bottom" offset={chartData.length > 10 ? 65 : 5} style={{ fill: '#374151', fontSize: 13, fontWeight: 600 }} />
                </XAxis>
                <YAxis
                  stroke="#6b7280"
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatYAxis}
                >
                  <Label value={yAxisLabel} angle={-90} position="insideLeft" offset={-25} style={{ fill: '#374151', fontSize: 13, fontWeight: 600, textAnchor: 'middle' }} />
                </YAxis>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                {seriesKeys.map((key, index) => (
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
      // For pie chart — use seriesKeys if pivoted, else first numeric field
      const isPivoted = seriesKeys.length > 0 && seriesKeys[0] !== yAxisKeys[0];
      const pieDataKey = isPivoted ? null : yAxisKeys[0];
      if (!isPivoted && !pieDataKey) {
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
      let rawPieData;
      if (isPivoted) {
        // Pivoted: each series key becomes a pie slice, summed across all x-axis groups
        rawPieData = seriesKeys.map((key, index) => {
          const total = chartData.reduce((sum, row) => sum + (parseFloat(row[key]) || 0), 0);
          return { name: key, value: total, fill: COLORS[index % COLORS.length] };
        }).filter(item => item.value > 0)
          .sort((a, b) => b.value - a.value);
      } else {
        rawPieData = chartData.map((item, index) => ({
          name: String(item[xAxisKey] ?? 'Unknown'),
          value: parseFloat(item[pieDataKey]) || 0,
          fill: COLORS[index % COLORS.length]
        })).filter(item => item.value > 0)
          .sort((a, b) => b.value - a.value);
      }

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
                  label={({ name, value, percent }) => {
                    const formatted = isCurrencyField(yAxisKeys[0] || '')
                      ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : value.toLocaleString();
                    return `${name}: ${formatted} (${(percent * 100).toFixed(0)}%)`;
                  }}
                  labelLine={{ stroke: '#6b7280' }}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => {
                    if (typeof value === 'number') {
                      return formatValue(value, yAxisKeys[0] || '');
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
              <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 40, bottom: 30 }}>
                <defs>
                  {seriesKeys.map((key, index) => (
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
                >
                  <Label value={xAxisLabel} position="bottom" offset={chartData.length > 10 ? 65 : 5} style={{ fill: '#374151', fontSize: 13, fontWeight: 600 }} />
                </XAxis>
                <YAxis
                  stroke="#6b7280"
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatYAxis}
                >
                  <Label value={yAxisLabel} angle={-90} position="insideLeft" offset={-25} style={{ fill: '#374151', fontSize: 13, fontWeight: 600, textAnchor: 'middle' }} />
                </YAxis>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                {seriesKeys.map((key, index) => (
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
