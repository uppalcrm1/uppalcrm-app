import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Settings, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import CSVUploader from '../components/CSVUploader';
import FieldMapper from '../components/FieldMapper';
import LoadingSpinner from '../components/LoadingSpinner';

const ImportLeads = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [importError, setImportError] = useState(null);

  // File and import data
  const [uploadedFile, setUploadedFile] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [importJob, setImportJob] = useState(null);
  const [fieldMapping, setFieldMapping] = useState({});
  const [importOptions, setImportOptions] = useState({});

  const steps = [
    { id: 1, name: 'Upload CSV', icon: Upload, description: 'Select and upload your CSV file' },
    { id: 2, name: 'Map Fields', icon: Settings, description: 'Map CSV columns to database fields' },
    { id: 3, name: 'Import', icon: FileText, description: 'Start the import process' }
  ];

  const handleFileUpload = async (file) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('csvFile', file);
      formData.append('importType', 'leads');

      const response = await fetch('/api/import/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadedFile(data.importJob);
      setAnalysisData(data.analysis);
      setFieldMapping(data.analysis.suggestedMappings || {});
      setCurrentStep(2);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileRemove = () => {
    setUploadedFile(null);
    setAnalysisData(null);
    setFieldMapping({});
    setImportOptions({});
    setCurrentStep(1);
    setUploadError(null);
    setImportError(null);
  };

  const handleStartImport = async () => {
    setIsImporting(true);
    setImportError(null);

    try {
      const response = await fetch('/api/import/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          importJobId: uploadedFile.id,
          fieldMapping,
          importOptions
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed to start');
      }

      setImportJob(data);
      setCurrentStep(3);

      // Redirect to import status page after a short delay
      setTimeout(() => {
        navigate(`/import/status/${data.importJobId}`);
      }, 2000);

    } catch (error) {
      console.error('Import error:', error);
      setImportError(error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const canProceedToMapping = uploadedFile && analysisData;
  const canStartImport = canProceedToMapping && Object.keys(fieldMapping).some(key => fieldMapping[key]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={() => navigate('/leads')}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Import Leads</h1>
            <p className="text-gray-600 mt-1">Import leads from a CSV file</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center space-x-8">
          {steps.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            const isAccessible = step.id <= currentStep || (step.id === 2 && canProceedToMapping);

            return (
              <div key={step.id} className="flex items-center space-x-3">
                <div className={`
                  flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                  ${isCompleted
                    ? 'bg-green-500 border-green-500 text-white'
                    : isActive
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : isAccessible
                        ? 'border-gray-300 text-gray-400'
                        : 'border-gray-200 text-gray-300'
                  }
                `}>
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                    {step.name}
                  </h3>
                  <p className="text-xs text-gray-400">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-px w-12 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {currentStep === 1 && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload CSV File</h2>
            <CSVUploader
              onFileUpload={handleFileUpload}
              onFileRemove={handleFileRemove}
              uploadedFile={uploadedFile}
              isUploading={isUploading}
              error={uploadError}
            />

            {analysisData && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h3 className="text-sm font-medium text-green-800">File Analysis Complete</h3>
                </div>
                <div className="text-sm text-green-700">
                  <p>• {analysisData.totalRows} rows found</p>
                  <p>• {analysisData.headers.length} columns detected</p>
                  <p>• {Object.keys(analysisData.suggestedMappings || {}).length} field mappings suggested</p>
                </div>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="mt-3 btn btn-primary btn-sm"
                >
                  Continue to Field Mapping
                </button>
              </div>
            )}
          </div>
        )}

        {currentStep === 2 && analysisData && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Map CSV Fields</h2>
            <FieldMapper
              csvHeaders={analysisData.headers}
              sampleData={analysisData.sampleData}
              suggestedMappings={analysisData.suggestedMappings}
              importType="leads"
              onMappingChange={setFieldMapping}
              onOptionsChange={setImportOptions}
              fieldMapping={fieldMapping}
              importOptions={importOptions}
            />

            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => setCurrentStep(1)}
                className="btn btn-secondary"
              >
                Back to Upload
              </button>
              <button
                onClick={handleStartImport}
                disabled={!canStartImport || isImporting}
                className="btn btn-primary"
              >
                {isImporting ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Starting Import...
                  </>
                ) : (
                  'Start Import'
                )}
              </button>
            </div>

            {importError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <h4 className="text-sm font-medium text-red-800">Import Error</h4>
                </div>
                <p className="text-sm text-red-700 mt-1">{importError}</p>
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="p-6 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Import Started!</h2>
              <p className="text-gray-600 mb-6">
                Your leads import has been queued for processing. You'll be redirected to the status page to monitor progress.
              </p>
              <div className="flex items-center justify-center space-x-4">
                <LoadingSpinner size="sm" />
                <span className="text-sm text-gray-500">Redirecting...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportLeads;