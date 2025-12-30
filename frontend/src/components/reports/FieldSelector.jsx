import React, { useState, useMemo } from 'react';
import { Search, CheckSquare, Square, ChevronDown, ChevronRight } from 'lucide-react';

/**
 * FieldSelector Component
 * Allows users to select fields to include in their report
 */
const FieldSelector = ({ fields = [], selectedFields = [], onChange, categorized = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({
    identification: true,
    demographic: true,
    activity: true,
    financial: true,
    dates: true
  });

  // Filter fields based on search term
  const filteredFields = useMemo(() => {
    if (!searchTerm) return fields;

    const lowerSearch = searchTerm.toLowerCase();
    return fields.filter(field =>
      field.label?.toLowerCase().includes(lowerSearch) ||
      field.name?.toLowerCase().includes(lowerSearch)
    );
  }, [fields, searchTerm]);

  // Group fields by category if categorized data is provided
  const groupedFields = useMemo(() => {
    if (!categorized) return { all: filteredFields };

    const groups = {
      identification: [],
      demographic: [],
      activity: [],
      financial: [],
      dates: []
    };

    filteredFields.forEach(field => {
      if (field.name?.includes('id')) {
        groups.identification.push(field);
      } else if (field.type === 'date') {
        groups.dates.push(field);
      } else if (field.type === 'number' || field.name?.includes('amount') || field.name?.includes('value')) {
        groups.financial.push(field);
      } else if (field.name?.includes('status') || field.name?.includes('priority') || field.name?.includes('source')) {
        groups.activity.push(field);
      } else {
        groups.demographic.push(field);
      }
    });

    return groups;
  }, [filteredFields, categorized]);

  const handleFieldToggle = (fieldName) => {
    if (selectedFields.includes(fieldName)) {
      onChange(selectedFields.filter(f => f !== fieldName));
    } else {
      onChange([...selectedFields, fieldName]);
    }
  };

  const handleSelectAll = () => {
    if (selectedFields.length === filteredFields.length) {
      onChange([]);
    } else {
      onChange(filteredFields.map(f => f.name));
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const getCategoryLabel = (category) => {
    const labels = {
      identification: 'Identification',
      demographic: 'Demographic',
      activity: 'Activity',
      financial: 'Financial',
      dates: 'Dates'
    };
    return labels[category] || category;
  };

  const renderFieldCheckbox = (field) => {
    const isSelected = selectedFields.includes(field.name);

    return (
      <div
        key={field.name}
        className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
        onClick={() => handleFieldToggle(field.name)}
      >
        {isSelected ? (
          <CheckSquare className="h-4 w-4 text-blue-600" />
        ) : (
          <Square className="h-4 w-4 text-gray-400" />
        )}
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">{field.label}</div>
          <div className="text-xs text-gray-500">{field.name}</div>
        </div>
        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
          {field.type}
        </span>
      </div>
    );
  };

  const renderCategorized = () => {
    return Object.entries(groupedFields).map(([category, categoryFields]) => {
      if (categoryFields.length === 0) return null;

      const isExpanded = expandedCategories[category];

      return (
        <div key={category} className="mb-4">
          <button
            onClick={() => toggleCategory(category)}
            className="flex items-center justify-between w-full p-2 hover:bg-gray-50 rounded"
          >
            <div className="flex items-center space-x-2">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
              <span className="text-sm font-semibold text-gray-700">
                {getCategoryLabel(category)}
              </span>
              <span className="text-xs text-gray-500">
                ({categoryFields.length})
              </span>
            </div>
          </button>

          {isExpanded && (
            <div className="ml-4 mt-2 space-y-1">
              {categoryFields.map(renderFieldCheckbox)}
            </div>
          )}
        </div>
      );
    });
  };

  const renderUncategorized = () => {
    return (
      <div className="space-y-1">
        {filteredFields.map(renderFieldCheckbox)}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Select Fields</h3>
          <span className="text-xs text-gray-500">
            {selectedFields.length} selected
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Select All / Deselect All */}
      <div className="px-4 py-2 border-b border-gray-200">
        <button
          onClick={handleSelectAll}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          {selectedFields.length === filteredFields.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Fields List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredFields.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No fields found
          </div>
        ) : categorized ? (
          renderCategorized()
        ) : (
          renderUncategorized()
        )}
      </div>
    </div>
  );
};

export default FieldSelector;
