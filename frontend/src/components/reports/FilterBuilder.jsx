import React from 'react';
import { Plus, X } from 'lucide-react';

/**
 * FilterBuilder Component
 * Dynamic filter builder with field, operator, and value inputs
 */
const FilterBuilder = ({ filters = [], onChange, fields = [] }) => {
  // Operator options by field type
  const getOperatorsForFieldType = (fieldType) => {
    const operators = {
      text: [
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Not Equals' },
        { value: 'contains', label: 'Contains' },
        { value: 'starts_with', label: 'Starts With' },
        { value: 'ends_with', label: 'Ends With' },
        { value: 'is_empty', label: 'Is Empty' },
        { value: 'is_not_empty', label: 'Is Not Empty' }
      ],
      number: [
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Not Equals' },
        { value: 'greater_than', label: 'Greater Than' },
        { value: 'less_than', label: 'Less Than' },
        { value: 'greater_than_or_equal', label: 'Greater Than or Equal' },
        { value: 'less_than_or_equal', label: 'Less Than or Equal' },
        { value: 'between', label: 'Between' }
      ],
      date: [
        { value: 'on', label: 'On' },
        { value: 'before', label: 'Before' },
        { value: 'after', label: 'After' },
        { value: 'between', label: 'Between' },
        { value: 'is_empty', label: 'Is Empty' },
        { value: 'is_not_empty', label: 'Is Not Empty' }
      ],
      select: [
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Not Equals' },
        { value: 'in', label: 'In' },
        { value: 'not_in', label: 'Not In' }
      ],
      uuid: [
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Not Equals' }
      ]
    };

    return operators[fieldType] || operators.text;
  };

  const addFilter = () => {
    onChange([
      ...filters,
      { field: '', operator: 'equals', value: '' }
    ]);
  };

  const removeFilter = (index) => {
    onChange(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index, updates) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], ...updates };

    // Reset operator when field changes
    if (updates.field) {
      const field = fields.find(f => f.name === updates.field);
      if (field) {
        const operators = getOperatorsForFieldType(field.type);
        newFilters[index].operator = operators[0].value;
        newFilters[index].value = '';
      }
    }

    onChange(newFilters);
  };

  const renderValueInput = (filter, index) => {
    const field = fields.find(f => f.name === filter.field);
    if (!field) return null;

    // No value needed for these operators
    if (['is_empty', 'is_not_empty'].includes(filter.operator)) {
      return (
        <div className="text-sm text-gray-400 italic">
          No value needed
        </div>
      );
    }

    // Between operator needs two inputs
    if (filter.operator === 'between') {
      const values = Array.isArray(filter.value) ? filter.value : ['', ''];
      return (
        <div className="flex items-center space-x-2">
          <input
            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
            value={values[0] || ''}
            onChange={(e) => updateFilter(index, { value: [e.target.value, values[1]] })}
            placeholder="Min"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <span className="text-gray-500 text-sm">to</span>
          <input
            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
            value={values[1] || ''}
            onChange={(e) => updateFilter(index, { value: [values[0], e.target.value] })}
            placeholder="Max"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      );
    }

    // Select field with options
    if (field.type === 'select' && field.options) {
      // IN/NOT IN operators allow multiple selections
      if (['in', 'not_in'].includes(filter.operator)) {
        return (
          <select
            multiple
            value={Array.isArray(filter.value) ? filter.value : [filter.value]}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, option => option.value);
              updateFilter(index, { value: selected });
            }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            size={Math.min(field.options.length, 4)}
          >
            {field.options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      }

      // Single select
      return (
        <select
          value={filter.value || ''}
          onChange={(e) => updateFilter(index, { value: e.target.value })}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select value...</option>
          {field.options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    // Default input
    return (
      <input
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        value={filter.value || ''}
        onChange={(e) => updateFilter(index, { value: e.target.value })}
        placeholder="Enter value..."
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
        <button
          onClick={addFilter}
          className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
        >
          <Plus className="h-4 w-4" />
          <span>Add Filter</span>
        </button>
      </div>

      {/* Filter List */}
      {filters.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-sm text-gray-500">No filters added</p>
          <button
            onClick={addFilter}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Add your first filter
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filters.map((filter, index) => {
            const field = fields.find(f => f.name === filter.field);
            const operators = field ? getOperatorsForFieldType(field.type) : [];

            return (
              <div
                key={index}
                className="flex items-start space-x-2 p-3 bg-gray-50 rounded-lg"
              >
                {/* Field Selector */}
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 mb-1">Field</label>
                  <select
                    value={filter.field || ''}
                    onChange={(e) => updateFilter(index, { field: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select field...</option>
                    {fields.map(f => (
                      <option key={f.name} value={f.name}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Operator Selector */}
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 mb-1">Operator</label>
                  <select
                    value={filter.operator || 'equals'}
                    onChange={(e) => updateFilter(index, { operator: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={!filter.field}
                  >
                    {operators.map(op => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Value Input */}
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 mb-1">Value</label>
                  {renderValueInput(filter, index)}
                </div>

                {/* Remove Button */}
                <div className="pt-6">
                  <button
                    onClick={() => removeFilter(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                    title="Remove filter"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FilterBuilder;
