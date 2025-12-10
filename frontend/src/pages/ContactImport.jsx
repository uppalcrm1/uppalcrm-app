import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ContactImport.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const ContactImport = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [file, setFile] = useState(null);
  const [importId, setImportId] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [fileBuffer, setFileBuffer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [importResult, setImportResult] = useState(null);

  // Field mapping state
  const [fieldMapping, setFieldMapping] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    notes: ''
  });

  // Import settings
  const [duplicateHandling, setDuplicateHandling] = useState('create_or_update');
  const [matchField, setMatchField] = useState('email');

  // CRM field options
  const crmFields = [
    { value: 'first_name', label: 'First Name' },
    { value: 'last_name', label: 'Last Name' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'company', label: 'Company' },
    { value: 'title', label: 'Job Title' },
    { value: 'notes', label: 'Notes' }
  ];

  // Reset form
  const resetForm = () => {
    setCurrentStep(1);
    setFile(null);
    setImportId(null);
    setHeaders([]);
    setTotalRows(0);
    setFileBuffer(null);
    setError(null);
    setImportResult(null);
    setFieldMapping({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      company: '',
      title: '',
      notes: ''
    });
  };

  // Step 1: Upload file
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Only CSV files are allowed');
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handleFileUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('authToken');
      const response = await axios.post(`${API_URL}/imports/contacts/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });

      const { importId, headers, totalRows, fileBuffer, message } = response.data;

      setImportId(importId);
      setHeaders(headers);
      setTotalRows(totalRows);
      setFileBuffer(fileBuffer);
      setCurrentStep(2);

      console.log(message);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || 'Failed to upload file');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Map fields
  const handleFieldMappingChange = (crmField, csvColumn) => {
    setFieldMapping(prev => ({
      ...prev,
      [crmField]: csvColumn
    }));
  };

  // Auto-map fields based on header names
  const autoMapFields = () => {
    const newMapping = { ...fieldMapping };

    headers.forEach(header => {
      const lowerHeader = header.toLowerCase();

      if (lowerHeader.includes('first') && lowerHeader.includes('name')) {
        newMapping.first_name = header;
      } else if (lowerHeader.includes('last') && lowerHeader.includes('name')) {
        newMapping.last_name = header;
      } else if (lowerHeader.includes('email')) {
        newMapping.email = header;
      } else if (lowerHeader.includes('phone') || lowerHeader.includes('mobile')) {
        newMapping.phone = header;
      } else if (lowerHeader.includes('company') || lowerHeader.includes('organization')) {
        newMapping.company = header;
      } else if (lowerHeader.includes('title') || lowerHeader.includes('job')) {
        newMapping.title = header;
      } else if (lowerHeader.includes('note')) {
        newMapping.notes = header;
      }
    });

    setFieldMapping(newMapping);
  };

  // Validate mapping
  const validateMapping = () => {
    if (!fieldMapping.first_name) {
      setError('First Name field is required');
      return false;
    }
    if (!fieldMapping.last_name) {
      setError('Last Name field is required');
      return false;
    }
    return true;
  };

  // Step 3: Start import
  const startImport = async () => {
    if (!validateMapping()) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.post(
        `${API_URL}/imports/contacts/${importId}/process`,
        {
          fieldMapping,
          duplicateHandling,
          matchField,
          fileBuffer
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      console.log('Import started:', response.data);
      setCurrentStep(3);
      pollImportStatus();
    } catch (err) {
      console.error('Import error:', err);
      setError(err.response?.data?.message || 'Failed to start import');
      setLoading(false);
    }
  };

  // Poll import status
  const pollImportStatus = async () => {
    const token = localStorage.getItem('authToken');
    const maxAttempts = 60; // 60 attempts = 30 seconds max
    let attempts = 0;

    const poll = setInterval(async () => {
      attempts++;

      try {
        const response = await axios.get(
          `${API_URL}/imports/contacts/${importId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        const importData = response.data;

        if (importData.status === 'completed' || importData.status === 'failed') {
          clearInterval(poll);
          setImportResult(importData);
          setLoading(false);
        }

        if (attempts >= maxAttempts) {
          clearInterval(poll);
          setError('Import is taking longer than expected. Please check the import history.');
          setLoading(false);
        }
      } catch (err) {
        console.error('Poll error:', err);
        clearInterval(poll);
        setError('Failed to check import status');
        setLoading(false);
      }
    }, 500); // Poll every 500ms
  };

  // Render steps
  const renderStep1 = () => (
    <div className="import-step">
      <h2>Step 1: Upload CSV File</h2>
      <p>Select a CSV file containing your contacts to import.</p>

      <div className="file-upload-area">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          disabled={loading}
          id="file-input"
        />
        <label htmlFor="file-input" className="file-label">
          {file ? file.name : 'Choose CSV file'}
        </label>
      </div>

      {file && (
        <div className="file-info">
          <p><strong>Selected file:</strong> {file.name}</p>
          <p><strong>Size:</strong> {(file.size / 1024).toFixed(2)} KB</p>
        </div>
      )}

      <div className="import-limits-info">
        <h3>Import Limits</h3>
        <ul>
          <li>Maximum file size: 10 MB</li>
          <li>Maximum contacts: 10,000 per file</li>
          <li>Supported format: CSV only</li>
        </ul>
      </div>

      <div className="step-actions">
        <button
          onClick={handleFileUpload}
          disabled={!file || loading}
          className="btn-primary"
        >
          {loading ? 'Uploading...' : 'Upload & Continue'}
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="import-step">
      <h2>Step 2: Map Fields</h2>
      <p>Map your CSV columns to CRM fields. First Name and Last Name are required.</p>

      <div className="mapping-info">
        <p><strong>File:</strong> {file?.name}</p>
        <p><strong>Total Rows:</strong> {totalRows} contacts</p>
      </div>

      <button onClick={autoMapFields} className="btn-secondary" style={{ marginBottom: '20px' }}>
        Auto-Map Fields
      </button>

      <div className="field-mapping-table">
        <table>
          <thead>
            <tr>
              <th>CRM Field</th>
              <th>CSV Column</th>
              <th>Required</th>
            </tr>
          </thead>
          <tbody>
            {crmFields.map(field => (
              <tr key={field.value}>
                <td>{field.label}</td>
                <td>
                  <select
                    value={fieldMapping[field.value]}
                    onChange={(e) => handleFieldMappingChange(field.value, e.target.value)}
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map(header => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </td>
                <td>
                  {field.value === 'first_name' || field.value === 'last_name' ? (
                    <span className="required-badge">Yes</span>
                  ) : (
                    <span className="optional-badge">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="import-settings">
        <h3>Import Settings</h3>

        <div className="setting-group">
          <label>Duplicate Handling:</label>
          <select value={duplicateHandling} onChange={(e) => setDuplicateHandling(e.target.value)}>
            <option value="create_or_update">Create new or update existing</option>
            <option value="create_only">Create new only (skip duplicates)</option>
            <option value="update_only">Update existing only (skip new)</option>
          </select>
        </div>

        <div className="setting-group">
          <label>Match Field (for duplicate detection):</label>
          <select value={matchField} onChange={(e) => setMatchField(e.target.value)}>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
          </select>
        </div>
      </div>

      <div className="step-actions">
        <button onClick={() => setCurrentStep(1)} className="btn-secondary">
          Back
        </button>
        <button
          onClick={startImport}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Starting Import...' : 'Start Import'}
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="import-step">
      <h2>Step 3: Import Results</h2>

      {loading && (
        <div className="import-progress">
          <div className="spinner"></div>
          <p>Importing contacts... Please wait.</p>
        </div>
      )}

      {importResult && (
        <div className="import-results">
          {importResult.status === 'completed' ? (
            <div className="result-success">
              <h3>✓ Import Completed Successfully!</h3>
              <div className="result-stats">
                <div className="stat-box">
                  <div className="stat-value">{importResult.total_rows}</div>
                  <div className="stat-label">Total Rows</div>
                </div>
                <div className="stat-box success">
                  <div className="stat-value">{importResult.successful_rows}</div>
                  <div className="stat-label">Successful</div>
                </div>
                <div className="stat-box error">
                  <div className="stat-value">{importResult.failed_rows}</div>
                  <div className="stat-label">Failed</div>
                </div>
              </div>

              {importResult.failed_rows > 0 && importResult.error_details && (
                <div className="error-details">
                  <h4>Errors:</h4>
                  <ul>
                    {importResult.error_details.slice(0, 10).map((error, index) => (
                      <li key={index}>
                        Row {error.row}: {error.error}
                      </li>
                    ))}
                  </ul>
                  {importResult.error_details.length > 10 && (
                    <p>... and {importResult.error_details.length - 10} more errors</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="result-error">
              <h3>✗ Import Failed</h3>
              <p>The import process encountered an error. Please try again.</p>
            </div>
          )}

          <div className="step-actions">
            <button onClick={resetForm} className="btn-primary">
              Import Another File
            </button>
            <button onClick={() => window.location.href = '/contacts'} className="btn-secondary">
              View Contacts
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="contact-import-container">
      <div className="import-header">
        <h1>Import Contacts</h1>
        <div className="import-steps-indicator">
          <div className={`step-indicator ${currentStep >= 1 ? 'active' : ''}`}>1. Upload</div>
          <div className={`step-indicator ${currentStep >= 2 ? 'active' : ''}`}>2. Map Fields</div>
          <div className={`step-indicator ${currentStep >= 3 ? 'active' : ''}`}>3. Results</div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="import-content">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </div>
    </div>
  );
};

export default ContactImport;
