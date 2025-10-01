import React, { useState } from 'react';
import {
  X,
  Building2,
  Users,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  CreditCard,
  Clock
} from 'lucide-react';

export default function ConversionModal({
  isOpen,
  onClose,
  signup,
  onConvert,
  isConverting
}) {
  const [formData, setFormData] = useState({
    organizationName: signup?.company || '',
    planType: 'trial',
    trialDays: '14',
    seats: '5',
    notes: ''
  });

  const [errors, setErrors] = useState({});

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.organizationName.trim()) {
      newErrors.organizationName = 'Organization name is required';
    }

    if (formData.planType === 'trial') {
      if (!formData.trialDays || parseInt(formData.trialDays) <= 0) {
        newErrors.trialDays = 'Trial days must be greater than 0';
      }
    }

    if (!formData.seats || parseInt(formData.seats) <= 0) {
      newErrors.seats = 'Number of seats must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onConvert({
        signupId: signup.id,
        organizationData: {
          name: formData.organizationName,
          plan_type: formData.planType,
          trial_days: formData.planType === 'trial' ? parseInt(formData.trialDays) : null,
          seats: parseInt(formData.seats),
          notes: formData.notes,
          contact_email: signup.email,
          contact_name: signup.full_name,
          contact_phone: signup.phone,
          industry: signup.industry,
          country: signup.country
        }
      });
      onClose();
    } catch (error) {
      console.error('Conversion failed:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!isOpen || !signup) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Convert Trial Signup
                </h3>
                <p className="text-sm text-gray-600">
                  Create organization for {signup.full_name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Signup Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Signup Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">Email:</span>
                <span className="font-medium">{signup.email}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">Company:</span>
                <span className="font-medium">{signup.company || 'Not specified'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">Team Size:</span>
                <span className="font-medium">{signup.team_size || 'Not specified'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">Industry:</span>
                <span className="font-medium">{signup.industry || 'Not specified'}</span>
              </div>
              {signup.phone && (
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Phone:</span>
                  <span className="font-medium">{signup.phone}</span>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">Signed up:</span>
                <span className="font-medium">{formatDate(signup.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Conversion Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Organization Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organization Name *
              </label>
              <input
                type="text"
                value={formData.organizationName}
                onChange={(e) => handleInputChange('organizationName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.organizationName ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter organization name"
              />
              {errors.organizationName && (
                <p className="mt-1 text-sm text-red-600">{errors.organizationName}</p>
              )}
            </div>

            {/* Plan Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Plan Type *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="relative">
                  <input
                    type="radio"
                    name="planType"
                    value="trial"
                    checked={formData.planType === 'trial'}
                    onChange={(e) => handleInputChange('planType', e.target.value)}
                    className="sr-only"
                  />
                  <div className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    formData.planType === 'trial'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <Clock className="h-5 w-5 text-indigo-600" />
                      <div>
                        <div className="font-medium text-gray-900">Trial Plan</div>
                        <div className="text-sm text-gray-600">Start with a free trial</div>
                      </div>
                    </div>
                  </div>
                </label>

                <label className="relative">
                  <input
                    type="radio"
                    name="planType"
                    value="paid"
                    checked={formData.planType === 'paid'}
                    onChange={(e) => handleInputChange('planType', e.target.value)}
                    className="sr-only"
                  />
                  <div className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    formData.planType === 'paid'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <CreditCard className="h-5 w-5 text-green-600" />
                      <div>
                        <div className="font-medium text-gray-900">Paid Plan</div>
                        <div className="text-sm text-gray-600">Direct to paid subscription</div>
                      </div>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Trial Days (only if trial selected) */}
            {formData.planType === 'trial' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trial Duration (days) *
                </label>
                <select
                  value={formData.trialDays}
                  onChange={(e) => handleInputChange('trialDays', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.trialDays ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                </select>
                {errors.trialDays && (
                  <p className="mt-1 text-sm text-red-600">{errors.trialDays}</p>
                )}
              </div>
            )}

            {/* Number of Seats */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Seats *
              </label>
              <input
                type="number"
                min="1"
                value={formData.seats}
                onChange={(e) => handleInputChange('seats', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.seats ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter number of seats"
              />
              {errors.seats && (
                <p className="mt-1 text-sm text-red-600">{errors.seats}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Conversion Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Add any notes about this conversion..."
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isConverting}
                className="px-6 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Converting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Convert to Organization</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}