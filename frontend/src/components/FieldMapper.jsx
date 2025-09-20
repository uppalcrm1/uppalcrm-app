import React, { useState, useEffect } from 'react';
import { ChevronDown, Info, AlertTriangle } from 'lucide-react';

const FieldMapper = ({
  csvHeaders,
  sampleData,
  suggestedMappings,
  importType,
  onMappingChange,
  onOptionsChange,
  fieldMapping,
  importOptions
}) => {
  const [mappings, setMappings] = useState(fieldMapping || {});
  const [options, setOptions] = useState({
    skip_duplicates: true,
    update_existing: false,
    validate_emails: true,
    batch_size: 1000,
    ...importOptions
  });

  // Available database fields for mapping
  const availableFields = {
    leads: [
      { key: 'first_name', label: 'First Name', required: true },
      { key: 'last_name', label: 'Last Name', required: true },
      { key: 'email', label: 'Email', required: false },
      { key: 'phone', label: 'Phone', required: false },
      { key: 'company', label: 'Company', required: false },
      { key: 'title', label: 'Job Title', required: false },
      { key: 'status', label: 'Status', required: false },
      { key: 'source', label: 'Lead Source', required: false },
      { key: 'notes', label: 'Notes', required: false },
      { key: 'website', label: 'Website', required: false },
      { key: 'address', label: 'Address', required: false },
      { key: 'city', label: 'City', required: false },
      { key: 'state', label: 'State', required: false },
      { key: 'zip_code', label: 'ZIP Code', required: false },
      { key: 'country', label: 'Country', required: false }
    ],
    contacts: [
      { key: 'first_name', label: 'First Name', required: true },
      { key: 'last_name', label: 'Last Name', required: true },
      { key: 'email', label: 'Email', required: false },
      { key: 'phone', label: 'Phone', required: false },
      { key: 'company', label: 'Company', required: false },
      { key: 'title', label: 'Job Title', required: false },
      { key: 'notes', label: 'Notes', required: false },
      { key: 'website', label: 'Website', required: false },
      { key: 'address', label: 'Address', required: false },
      { key: 'city', label: 'City', required: false },
      { key: 'state', label: 'State', required: false },
      { key: 'zip_code', label: 'ZIP Code', required: false },
      { key: 'country', label: 'Country', required: false }
    ]
  };

  const fields = availableFields[importType] || [];

  useEffect(() => {
    // Initialize with suggested mappings
    if (suggestedMappings && Object.keys(mappings).length === 0) {
      setMappings(suggestedMappings);
    }
  }, [suggestedMappings]);

  useEffect(() => {
    onMappingChange(mappings);
  }, [mappings, onMappingChange]);

  useEffect(() => {
    onOptionsChange(options);
  }, [options, onOptionsChange]);

  const handleMappingChange = (csvHeader, dbField) => {
    setMappings(prev => ({
      ...prev,
      [csvHeader]: dbField
    }));
  };

  const handleOptionChange = (option, value) => {
    setOptions(prev => ({
      ...prev,
      [option]: value
    }));
  };

  const getUsedFields = () => {
    return Object.values(mappings).filter(Boolean);
  };

  const isFieldUsed = (fieldKey) => {
    return getUsedFields().includes(fieldKey);
  };

  const getRequiredFieldsStatus = () => {
    const requiredFields = fields.filter(field => field.required);
    const mappedRequiredFields = requiredFields.filter(field =>
      getUsedFields().includes(field.key)
    );

    return {
      total: requiredFields.length,
      mapped: mappedRequiredFields.length,
      missing: requiredFields.filter(field => !getUsedFields().includes(field.key))
    };
  };

  const requiredStatus = getRequiredFieldsStatus();
  const isValid = requiredStatus.mapped === requiredStatus.total;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">Field Mapping</h3>
            <p className="text-sm text-blue-700 mt-1">
              Map your CSV columns to database fields. Required fields are marked with an asterisk (*).
            </p>
          </div>
        </div>
      </div>

      {/* Required Fields Status */}
      {!isValid && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-orange-800">Missing Required Fields</h4>
              <p className="text-sm text-orange-700 mt-1">
                The following required fields are not mapped: {' '}
                <span className="font-medium">
                  {requiredStatus.missing.map(field => field.label).join(', ')}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mapping Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">Field Mappings</h3>
        </div>

        <div className="divide-y divide-gray-200">
          {csvHeaders.map((header, index) => (
            <div key={header} className="p-4">
              <div className="flex items-center justify-between space-x-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-900">
                    {header}
                  </label>
                  {sampleData[0] && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      Sample: "{sampleData[0][header]}"
                    </p>
                  )}
                </div>

                <div className="flex-1">
                  <div className="relative">
                    <select
                      value={mappings[header] || ''}
                      onChange={(e) => handleMappingChange(header, e.target.value)}
                      className="w-full pl-3 pr-10 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 appearance-none"
                    >
                      <option value="">Skip this field</option>
                      {fields.map(field => (
                        <option
                          key={field.key}
                          value={field.key}
                          disabled={isFieldUsed(field.key) && mappings[header] !== field.key}
                        >
                          {field.label}{field.required ? ' *' : ''}
                          {isFieldUsed(field.key) && mappings[header] !== field.key ? ' (already used)' : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Import Options */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">Import Options</h3>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900">
                Skip Duplicates
              </label>
              <p className="text-xs text-gray-500">
                Skip records that already exist based on email address
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={options.skip_duplicates}
                onChange={(e) => handleOptionChange('skip_duplicates', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900">
                Update Existing Records
              </label>
              <p className="text-xs text-gray-500">
                Update existing records with new data instead of skipping
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={options.update_existing}
                onChange={(e) => handleOptionChange('update_existing', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900">
                Validate Email Addresses
              </label>
              <p className="text-xs text-gray-500">
                Check email format and reject invalid emails
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={options.validate_emails}
                onChange={(e) => handleOptionChange('validate_emails', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Batch Size
            </label>
            <select
              value={options.batch_size}
              onChange={(e) => handleOptionChange('batch_size', parseInt(e.target.value))}
              className="w-32 pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={2000}>2000</option>
              <option value={5000}>5000</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Number of records to process at once
            </p>
          </div>
        </div>
      </div>

      {/* Validation Summary */}
      <div className={`p-4 rounded-lg border ${isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center space-x-2">
          {isValid ? (
            <>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium text-green-800">
                Ready to import ({Object.keys(mappings).filter(key => mappings[key]).length} fields mapped)
              </span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-sm font-medium text-red-800">
                Missing required fields ({requiredStatus.missing.length} required fields not mapped)
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FieldMapper;