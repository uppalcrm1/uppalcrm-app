import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Play, Save, Loader, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { saveAs } from 'file-saver';
import { reportsAPI } from '../services/api';
import FieldSelector from '../components/reports/FieldSelector';
import FilterBuilder from '../components/reports/FilterBuilder';
import ReportPreview from '../components/reports/ReportPreview';
import DynamicChart from '../components/reports/DynamicChart';

/**
 * Report Builder Page
 * Full-featured report builder with 3-column layout
 */
const ReportBuilderPage = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // For editing existing reports
  const queryClient = useQueryClient();

  // Report configuration state
  const [config, setConfig] = useState({
    dataSource: 'leads',
    fields: [],
    filters: [],
    groupBy: [],
    orderBy: [],
    limit: 1000,
    chartType: 'table'
  });

  // Report metadata state
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);

  // UI state
  const [reportResults, setReportResults] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Fetch data sources
  const { data: dataSources } = useQuery({
    queryKey: ['dataSources'],
    queryFn: () => reportsAPI.getDataSources()
  });

  // Fetch fields for selected data source
  const { data: fieldsData, isLoading: fieldsLoading } = useQuery({
    queryKey: ['fields', config.dataSource],
    queryFn: () => reportsAPI.getFields(config.dataSource),
    enabled: !!config.dataSource
  });

  // Fetch existing report if editing
  const { data: existingReport } = useQuery({
    queryKey: ['savedReport', id],
    queryFn: () => reportsAPI.getSavedReport(id),
    enabled: !!id
  });

  // Load existing report data
  useEffect(() => {
    if (existingReport?.data) {
      const report = existingReport.data;
      setConfig(report.config);
      setReportName(report.name);
      setReportDescription(report.description || '');
      setIsFavorite(report.is_favorite || false);
    }
  }, [existingReport]);

  // Execute report mutation
  const executeReportMutation = useMutation({
    mutationFn: (reportConfig) => reportsAPI.executeReport(reportConfig),
    onSuccess: (response) => {
      setReportResults(response.data);
      toast.success(`Report executed successfully! ${response.rowCount} rows returned.`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to execute report');
    }
  });

  // Save report mutation
  const saveReportMutation = useMutation({
    mutationFn: (data) => {
      if (id) {
        return reportsAPI.updateSavedReport(id, data);
      } else {
        return reportsAPI.createSavedReport(data);
      }
    },
    onSuccess: (response) => {
      toast.success(id ? 'Report updated successfully!' : 'Report saved successfully!');
      queryClient.invalidateQueries(['savedReports']);
      if (!id && response.data?.id) {
        navigate(`/reports/builder/${response.data.id}`);
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to save report');
    }
  });

  // Handlers
  const handleDataSourceChange = (dataSource) => {
    setConfig(prev => ({
      ...prev,
      dataSource,
      fields: [], // Reset fields when changing data source
      filters: []
    }));
    setReportResults(null); // Clear results
  };

  const handleFieldsChange = (fields) => {
    setConfig(prev => ({ ...prev, fields }));
  };

  const handleFiltersChange = (filters) => {
    setConfig(prev => ({ ...prev, filters }));
  };

  const handleExecuteReport = () => {
    if (config.fields.length === 0) {
      toast.error('Please select at least one field');
      return;
    }

    setIsExecuting(true);
    executeReportMutation.mutate(config, {
      onSettled: () => setIsExecuting(false)
    });
  };

  const handleSaveReport = () => {
    if (!reportName) {
      toast.error('Please enter a report name');
      return;
    }

    if (config.fields.length === 0) {
      toast.error('Please select at least one field');
      return;
    }

    saveReportMutation.mutate({
      name: reportName,
      description: reportDescription,
      config,
      is_favorite: isFavorite
    });
  };

  const handleExportCSV = async () => {
    if (config.fields.length === 0) {
      toast.error('Please select at least one field');
      return;
    }

    if (!reportResults || reportResults.length === 0) {
      toast.error('Please run the report first');
      return;
    }

    try {
      // Call the CSV export API
      const blob = await reportsAPI.exportCSV({
        ...config,
        reportName: reportName || 'report'
      });

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const sanitizedName = (reportName || 'report')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const filename = `${sanitizedName}-${timestamp}.csv`;

      // Download the file
      saveAs(blob, filename);
      toast.success('Report exported successfully!');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export report to CSV');
    }
  };

  const fields = fieldsData?.data?.all || [];
  const categorizedFields = fieldsData?.data?.categorized;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/reports')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              {id ? 'Edit Report' : 'Create Report'}
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportCSV}
              disabled={!reportResults || reportResults.length === 0}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleExecuteReport}
              disabled={isExecuting || config.fields.length === 0}
              className="btn btn-secondary flex items-center space-x-2"
            >
              {isExecuting ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span>Run Report</span>
            </button>

            <button
              onClick={handleSaveReport}
              disabled={saveReportMutation.isLoading}
              className="btn btn-primary flex items-center space-x-2"
            >
              {saveReportMutation.isLoading ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{id ? 'Update' : 'Save'} Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN - Configuration */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Configuration</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Data Source Selector */}
            <div className="p-4 border-b border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Source
              </label>
              <select
                value={config.dataSource}
                onChange={(e) => handleDataSourceChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {dataSources?.data?.map(ds => (
                  <option key={ds.id} value={ds.id}>
                    {ds.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {dataSources?.data?.find(ds => ds.id === config.dataSource)?.description}
              </p>
            </div>

            {/* Field Selector */}
            <div className="border-b border-gray-200">
              {fieldsLoading ? (
                <div className="p-4 text-center text-gray-500">
                  Loading fields...
                </div>
              ) : (
                <FieldSelector
                  fields={fields}
                  selectedFields={config.fields}
                  onChange={handleFieldsChange}
                  categorized={!!categorizedFields}
                />
              )}
            </div>

            {/* Filter Builder */}
            <div className="p-4">
              <FilterBuilder
                filters={config.filters}
                onChange={handleFiltersChange}
                fields={fields}
              />
            </div>
          </div>
        </div>

        {/* CENTER COLUMN - Preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 bg-white m-4 rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            {/* View Toggle */}
            {reportResults && reportResults.length > 0 && (
              <div className="px-4 py-2 border-b border-gray-200 flex items-center space-x-2">
                <button
                  onClick={() => setConfig(prev => ({ ...prev, chartType: 'table' }))}
                  className={`px-3 py-1 text-sm rounded ${
                    config.chartType === 'table'
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setConfig(prev => ({ ...prev, chartType: 'line' }))}
                  className={`px-3 py-1 text-sm rounded ${
                    config.chartType === 'line'
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Line Chart
                </button>
                <button
                  onClick={() => setConfig(prev => ({ ...prev, chartType: 'bar' }))}
                  className={`px-3 py-1 text-sm rounded ${
                    config.chartType === 'bar'
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Bar Chart
                </button>
                <button
                  onClick={() => setConfig(prev => ({ ...prev, chartType: 'pie' }))}
                  className={`px-3 py-1 text-sm rounded ${
                    config.chartType === 'pie'
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Pie Chart
                </button>
                <button
                  onClick={() => setConfig(prev => ({ ...prev, chartType: 'area' }))}
                  className={`px-3 py-1 text-sm rounded ${
                    config.chartType === 'area'
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Area Chart
                </button>
              </div>
            )}

            {/* Preview Content */}
            <div className="flex-1 overflow-hidden">
              {config.chartType === 'table' ? (
                <ReportPreview
                  data={reportResults}
                  isLoading={isExecuting}
                  error={executeReportMutation.error}
                  fields={fields.filter(f => config.fields.includes(f.name))}
                />
              ) : (
                <div className="h-full p-4">
                  {isExecuting ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    <DynamicChart
                      data={reportResults}
                      chartType={config.chartType}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Actions & Metadata */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Report Details</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Report Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Report Name *
              </label>
              <input
                type="text"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                placeholder="My Custom Report"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Report Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Brief description of this report..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Favorite Toggle */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="favorite"
                checked={isFavorite}
                onChange={(e) => setIsFavorite(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="favorite" className="text-sm font-medium text-gray-700">
                Mark as favorite
              </label>
            </div>

            {/* Configuration Summary */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Data Source:</span>
                  <span className="font-medium text-gray-900">
                    {dataSources?.data?.find(ds => ds.id === config.dataSource)?.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Fields Selected:</span>
                  <span className="font-medium text-gray-900">{config.fields.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Filters:</span>
                  <span className="font-medium text-gray-900">{config.filters.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Limit:</span>
                  <span className="font-medium text-gray-900">{config.limit} rows</span>
                </div>
              </div>
            </div>

            {/* Results Info */}
            {reportResults && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Results</h3>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-2xl font-bold text-blue-900 mb-1">
                    {reportResults.length}
                  </div>
                  <div className="text-xs text-blue-700">rows returned</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportBuilderPage;
