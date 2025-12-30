import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Save, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { dashboardsAPI } from '../services/api';
import WidgetContainer from '../components/dashboards/WidgetContainer';
import WidgetConfigModal from '../components/dashboards/WidgetConfigModal';

/**
 * Dashboard Builder Page
 * Build/edit custom dashboards with drag-and-drop widgets
 */
const DashboardBuilderPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();

  // Dashboard state
  const [dashboardName, setDashboardName] = useState('');
  const [dashboardDescription, setDashboardDescription] = useState('');
  const [widgets, setWidgets] = useState([]);
  const [showWidgetModal, setShowWidgetModal] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);

  // Fetch existing dashboard if editing
  const { data: existingDashboard } = useQuery({
    queryKey: ['savedDashboard', id],
    queryFn: () => dashboardsAPI.getSavedDashboard(id),
    enabled: !!id
  });

  // Load existing dashboard data
  useEffect(() => {
    if (existingDashboard?.data) {
      const dashboard = existingDashboard.data;
      setDashboardName(dashboard.name);
      setDashboardDescription(dashboard.description || '');
      setWidgets(dashboard.layout?.widgets || []);
    }
  }, [existingDashboard]);

  // Save dashboard mutation
  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (id) {
        return dashboardsAPI.updateSavedDashboard(id, data);
      } else {
        return dashboardsAPI.createSavedDashboard(data);
      }
    },
    onSuccess: (response) => {
      toast.success(id ? 'Dashboard updated successfully!' : 'Dashboard saved successfully!');
      queryClient.invalidateQueries(['savedDashboards']);
      if (!id && response.data?.id) {
        navigate(`/custom-dashboards/builder/${response.data.id}`);
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to save dashboard');
    }
  });

  // Handle save dashboard
  const handleSave = () => {
    if (!dashboardName) {
      toast.error('Please enter a dashboard name');
      return;
    }

    saveMutation.mutate({
      name: dashboardName,
      description: dashboardDescription,
      layout: { widgets }
    });
  };

  // Handle add widget
  const handleAddWidget = () => {
    setEditingWidget({
      id: `widget-${Date.now()}`,
      type: 'kpi',
      title: 'New Widget',
      config: {},
      position: {
        x: 0,
        y: Infinity, // Put it at the bottom
        w: 4,
        h: 4
      }
    });
    setShowWidgetModal(true);
  };

  // Handle configure widget
  const handleConfigureWidget = (widget) => {
    setEditingWidget(widget);
    setShowWidgetModal(true);
  };

  // Handle save widget from modal
  const handleSaveWidget = (updatedWidget) => {
    if (widgets.find(w => w.id === updatedWidget.id)) {
      // Update existing widget
      setWidgets(widgets.map(w => w.id === updatedWidget.id ? updatedWidget : w));
    } else {
      // Add new widget
      setWidgets([...widgets, updatedWidget]);
    }
    setShowWidgetModal(false);
    setEditingWidget(null);
  };

  // Handle remove widget
  const handleRemoveWidget = (widgetId) => {
    if (window.confirm('Are you sure you want to remove this widget?')) {
      setWidgets(widgets.filter(w => w.id !== widgetId));
    }
  };

  // Handle layout change (drag/resize)
  const handleLayoutChange = (layout) => {
    setWidgets(widgets.map(widget => {
      const layoutItem = layout.find(l => l.i === widget.id);
      if (layoutItem) {
        return {
          ...widget,
          position: {
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h
          }
        };
      }
      return widget;
    }));
  };

  // Convert widgets to grid layout format
  const layout = widgets.map(widget => ({
    i: widget.id,
    x: widget.position?.x || 0,
    y: widget.position?.y || 0,
    w: widget.position?.w || 4,
    h: widget.position?.h || 4,
    minW: 2,
    minH: 2
  }));

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/custom-dashboards')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              {id ? 'Edit Dashboard' : 'Create Dashboard'}
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleAddWidget}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Widget</span>
            </button>

            <button
              onClick={handleSave}
              disabled={saveMutation.isLoading}
              className="btn btn-primary flex items-center space-x-2"
            >
              {saveMutation.isLoading ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{id ? 'Update' : 'Save'} Dashboard</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Dashboard Settings */}
        <div className="w-80 bg-white border-r border-gray-200 p-4 overflow-y-auto">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Dashboard Settings</h2>

          <div className="space-y-4">
            {/* Dashboard Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dashboard Name *
              </label>
              <input
                type="text"
                value={dashboardName}
                onChange={(e) => setDashboardName(e.target.value)}
                placeholder="My Dashboard"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Dashboard Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={dashboardDescription}
                onChange={(e) => setDashboardDescription(e.target.value)}
                placeholder="Brief description..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Widget Summary */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Widgets:</span>
                  <span className="font-medium text-gray-900">{widgets.length}</span>
                </div>
              </div>
            </div>

            {/* Widget Library */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Widget Library</h3>
              <div className="space-y-2">
                <button
                  onClick={handleAddWidget}
                  className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm border border-gray-200"
                >
                  <div className="font-medium text-gray-900">KPI Card</div>
                  <div className="text-xs text-gray-500">Display a single metric</div>
                </button>
                <button
                  onClick={handleAddWidget}
                  className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm border border-gray-200"
                >
                  <div className="font-medium text-gray-900">Chart</div>
                  <div className="text-xs text-gray-500">Visualize report data</div>
                </button>
                <button
                  onClick={handleAddWidget}
                  className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm border border-gray-200"
                >
                  <div className="font-medium text-gray-900">Recent Items</div>
                  <div className="text-xs text-gray-500">Show latest records</div>
                </button>
                <button
                  onClick={handleAddWidget}
                  className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm border border-gray-200"
                >
                  <div className="font-medium text-gray-900">Report Table</div>
                  <div className="text-xs text-gray-500">Embed a saved report</div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Center - Dashboard Canvas */}
        <div className="flex-1 p-6 overflow-auto">
          {widgets.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-gray-400 text-lg font-medium mb-2">
                  No widgets yet
                </div>
                <div className="text-gray-500 text-sm mb-4">
                  Click "Add Widget" to start building your dashboard
                </div>
                <button
                  onClick={handleAddWidget}
                  className="btn btn-primary inline-flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Widget</span>
                </button>
              </div>
            </div>
          ) : (
            <GridLayout
              className="layout"
              layout={layout}
              cols={12}
              rowHeight={60}
              width={1200}
              onLayoutChange={handleLayoutChange}
              isDraggable={true}
              isResizable={true}
              compactType="vertical"
              preventCollision={false}
            >
              {widgets.map((widget) => (
                <div key={widget.id}>
                  <WidgetContainer
                    widget={widget}
                    onConfigure={handleConfigureWidget}
                    onRemove={handleRemoveWidget}
                  >
                    <WidgetPlaceholder widget={widget} />
                  </WidgetContainer>
                </div>
              ))}
            </GridLayout>
          )}
        </div>
      </div>

      {/* Widget Config Modal */}
      {showWidgetModal && (
        <WidgetConfigModal
          widget={editingWidget}
          onSave={handleSaveWidget}
          onClose={() => {
            setShowWidgetModal(false);
            setEditingWidget(null);
          }}
        />
      )}
    </div>
  );
};

/**
 * Widget Placeholder Component
 * Shows a preview of what the widget will display
 */
const WidgetPlaceholder = ({ widget }) => {
  switch (widget.type) {
    case 'kpi':
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-4xl font-bold text-blue-600 mb-2">-</div>
          <div className="text-sm text-gray-600">{widget.config?.label || 'KPI Metric'}</div>
        </div>
      );

    case 'chart':
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          <div className="text-center">
            <div className="text-sm">Chart Preview</div>
            <div className="text-xs mt-1">
              {widget.config?.reportId ? 'Report selected' : 'Select a report'}
            </div>
          </div>
        </div>
      );

    case 'recent_items':
      return (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      );

    case 'report':
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          <div className="text-center">
            <div className="text-sm">Report Table</div>
            <div className="text-xs mt-1">
              {widget.config?.reportId ? 'Report selected' : 'Select a report'}
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          Unknown widget type
        </div>
      );
  }
};

export default DashboardBuilderPage;
