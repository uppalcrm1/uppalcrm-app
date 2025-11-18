import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Send } from 'lucide-react';
import { twilioAPI } from '../services/api';
import toast from 'react-hot-toast';

const SendSMSModal = ({ onClose, onSuccess, defaultTo = '', leadId = null, contactId = null }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    to: defaultTo,
    body: '',
    leadId,
    contactId,
    templateId: null
  });

  // Fetch templates
  const { data: templatesData } = useQuery({
    queryKey: ['smsTemplates'],
    queryFn: () => twilioAPI.getTemplates()
  });

  const templates = templatesData?.templates || [];

  const sendMutation = useMutation({
    mutationFn: twilioAPI.sendSMS,
    onSuccess: () => {
      toast.success('SMS sent successfully!');
      queryClient.invalidateQueries(['smsHistory']);
      queryClient.invalidateQueries(['twilioStats']);
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to send SMS');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMutation.mutate(formData);
  };

  const handleTemplateSelect = (template) => {
    setFormData({
      ...formData,
      body: template.body,
      templateId: template.id
    });
  };

  // Calculate character count and segments
  const characterCount = formData.body.length;
  const segmentCount = Math.ceil(characterCount / 160) || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Send SMS</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To (Phone Number)
            </label>
            <input
              type="tel"
              value={formData.to}
              onChange={(e) => setFormData({ ...formData, to: e.target.value })}
              placeholder="+1234567890"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Templates */}
          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Use Template (Optional)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {templates.slice(0, 4).map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleTemplateSelect(template)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-left"
                  >
                    <div className="font-medium text-gray-900">{template.name}</div>
                    <div className="text-xs text-gray-500 truncate">{template.body.substring(0, 50)}...</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message
            </label>
            <textarea
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              placeholder="Type your message here..."
              rows="6"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              required
            />

            {/* Character Count */}
            <div className="flex items-center justify-between mt-2 text-sm">
              <p className="text-gray-500">
                {characterCount} characters • {segmentCount} segment{segmentCount !== 1 ? 's' : ''}
              </p>
              <p className={characterCount > 1600 ? 'text-red-600' : 'text-gray-500'}>
                Max: 1600 characters
              </p>
            </div>
          </div>

          {/* Error Message */}
          {sendMutation.isError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">
                {sendMutation.error?.response?.data?.error || 'Failed to send SMS'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sendMutation.isPending || !formData.to || !formData.body}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendMutation.isPending ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 inline mr-2" />
                  Send SMS
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendSMSModal;
