import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI } from '../../services/api';

/**
 * WidgetConfigModal Component
 * Modal for configuring dashboard widgets
 */
const WidgetConfigModal = ({ widget, onSave, onClose }) => {
  const [config, setConfig] = useState({
    title: widget?.title || '',
    type: widget?.type || 'kpi',
    ...widget?.config
  });

  // Fetch saved reports for chart/report widgets
  const { data: savedReports } = useQuery({
    queryKey: ['savedReports'],
    queryFn: () => reportsAPI.getSavedReports(),
    enabled: config.type === 'chart' || config.type === 'report'
  });

  // Fetch data sources
  const { data: dataSources } = useQuery({
    queryKey: ['dataSources'],
    queryFn: () => reportsAPI.getDataSources()
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...widget,
      title: config.title,
      config: {
        ...config,
        title: undefined // Remove title from config
      }
    });
  };

  const renderConfigForm = () => {
    switch (config.type) {
      case 'kpi':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Source
              </label>
              <select
                value={config.dataSource || 'leads'}
                onChange={(e) => setConfig({ ...config, dataSource: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {dataSources?.data?.map(ds => (
                  <option key={ds.id} value={ds.id}>{ds.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Metric
              </label>
              <select
                value={config.metric || 'COUNT(*)'}
                onChange={(e) => setConfig({ ...config, metric: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="COUNT(*)">Total Count</option>
                <option value="SUM(value)">Sum of Value</option>
                <option value="AVG(value)">Average Value</option>
                <option value="MAX(value)">Maximum Value</option>
                <option value="MIN(value)">Minimum Value</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Label
              </label>
              <input
                type="text"
                value={config.label || ''}
                onChange={(e) => setConfig({ ...config, label: e.target.value })}
                placeholder="e.g., Total Leads"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        );

      case 'chart':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Saved Report
              </label>
              <select
                value={config.reportId || ''}
                onChange={(e) => setConfig({ ...config, reportId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a report...</option>
                {savedReports?.data?.map(report => (
                  <option key={report.id} value={report.id}>
                    {report.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                The chart will use the report's configured chart type
              </p>
            </div>
          </div>
        );

      case 'recent_items':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Source
              </label>
              <select
                value={config.dataSource || 'leads'}
                onChange={(e) => setConfig({ ...config, dataSource: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {dataSources?.data?.map(ds => (
                  <option key={ds.id} value={ds.id}>{ds.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Items
              </label>
              <input
                type="number"
                value={config.limit || 5}
                onChange={(e) => setConfig({ ...config, limit: parseInt(e.target.value) })}
                min="1"
                max="20"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        );

      case 'report':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Saved Report
              </label>
              <select
                value={config.reportId || ''}
                onChange={(e) => setConfig({ ...config, reportId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a report...</option>
                {savedReports?.data?.map(report => (
                  <option key={report.id} value={report.id}>
                    {report.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                The report will be displayed as a table
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center text-gray-500">
            Widget type not supported
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {widget?.id ? 'Configure Widget' : 'Add Widget'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-4">
            {/* Widget Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Widget Title *
              </label>
              <input
                type="text"
                value={config.title}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                placeholder="My Widget"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Widget Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Widget Type
              </label>
              <select
                value={config.type}
                onChange={(e) => setConfig({ ...config, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="kpi">KPI Card</option>
                <option value="chart">Chart (from Report)</option>
                <option value="recent_items">Recent Items</option>
                <option value="report">Report Table</option>
              </select>
            </div>

            {/* Widget-specific Configuration */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Widget Configuration
              </h3>
              {renderConfigForm()}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              {widget?.id ? 'Update Widget' : 'Add Widget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WidgetConfigModal;
