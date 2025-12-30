const { Parser } = require('json2csv');

/**
 * CSV Export Service
 * Handles conversion of report data to CSV format
 */

/**
 * Export data to CSV format
 * @param {Array} data - Array of data objects
 * @param {Array} fields - Array of field configurations
 * @returns {String} CSV string with UTF-8 BOM
 */
const exportToCSV = (data, fields = []) => {
  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }

  try {
    // If fields are provided with metadata, use them to configure the CSV
    let csvFields;
    if (fields && fields.length > 0) {
      csvFields = fields.map(field => {
        if (typeof field === 'string') {
          return { label: field, value: field };
        }
        return {
          label: field.label || field.name,
          value: field.name,
          default: '-'
        };
      });
    } else {
      // Auto-detect fields from first data row
      const firstRow = data[0];
      csvFields = Object.keys(firstRow).map(key => ({
        label: key,
        value: key,
        default: '-'
      }));
    }

    // Create parser with custom options
    const parser = new Parser({
      fields: csvFields,
      defaultValue: '-',
      quote: '"',
      escapedQuote: '""',
      delimiter: ',',
      eol: '\n',
      excelStrings: false,
      withBOM: true // Add UTF-8 BOM for Excel compatibility
    });

    // Parse data to CSV
    const csv = parser.parse(data);

    return csv;
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    throw new Error(`Failed to export to CSV: ${error.message}`);
  }
};

/**
 * Generate filename for CSV export
 * @param {String} reportName - Name of the report
 * @returns {String} Filename with timestamp
 */
const generateFilename = (reportName = 'report') => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const sanitizedName = reportName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${sanitizedName}-${timestamp}.csv`;
};

/**
 * Format data for CSV export
 * Handles special cases like dates, numbers, booleans
 * @param {Array} data - Raw data array
 * @returns {Array} Formatted data array
 */
const formatDataForExport = (data) => {
  if (!data || data.length === 0) return data;

  return data.map(row => {
    const formattedRow = {};

    Object.keys(row).forEach(key => {
      let value = row[key];

      // Handle null/undefined
      if (value === null || value === undefined) {
        formattedRow[key] = '';
        return;
      }

      // Handle dates
      if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) {
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            formattedRow[key] = date.toISOString().split('T')[0]; // YYYY-MM-DD
            return;
          }
        } catch (e) {
          // If date parsing fails, use original value
        }
      }

      // Handle booleans
      if (typeof value === 'boolean') {
        formattedRow[key] = value ? 'Yes' : 'No';
        return;
      }

      // Handle arrays (convert to comma-separated)
      if (Array.isArray(value)) {
        formattedRow[key] = value.join(', ');
        return;
      }

      // Handle objects (convert to JSON string)
      if (typeof value === 'object') {
        formattedRow[key] = JSON.stringify(value);
        return;
      }

      // Use value as-is
      formattedRow[key] = value;
    });

    return formattedRow;
  });
};

module.exports = {
  exportToCSV,
  generateFilename,
  formatDataForExport
};
