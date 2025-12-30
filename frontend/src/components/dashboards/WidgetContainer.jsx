import React, { useState } from 'react';
import { Settings, X, Loader, AlertCircle } from 'lucide-react';

/**
 * WidgetContainer Component
 * Wrapper for dashboard widgets with title bar and actions
 */
const WidgetContainer = ({
  widget,
  children,
  onConfigure,
  onRemove,
  isLoading = false,
  error = null
}) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Widget Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900 truncate">
          {widget.title || 'Untitled Widget'}
        </h3>

        {/* Actions (shown on hover) */}
        <div className={`flex items-center space-x-2 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0'}`}>
          {onConfigure && (
            <button
              onClick={() => onConfigure(widget)}
              className="p-1 hover:bg-gray-200 rounded"
              title="Configure widget"
            >
              <Settings className="h-4 w-4 text-gray-600" />
            </button>
          )}
          {onRemove && (
            <button
              onClick={() => onRemove(widget.id)}
              className="p-1 hover:bg-red-100 rounded"
              title="Remove widget"
            >
              <X className="h-4 w-4 text-red-600" />
            </button>
          )}
        </div>
      </div>

      {/* Widget Content */}
      <div className="flex-1 p-4 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-2" />
            <p className="text-sm text-gray-600">{error}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default WidgetContainer;
