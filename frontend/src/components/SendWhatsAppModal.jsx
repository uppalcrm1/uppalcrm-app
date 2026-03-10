import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, MessageCircle, Send } from 'lucide-react';
import { twilioAPI } from '../services/api';
import toast from 'react-hot-toast';

const SendWhatsAppModal = ({ onClose, onSuccess, defaultTo = '', leadId = null, contactId = null }) => {
  const queryClient = useQueryClient();
  const [messageType, setMessageType] = useState('freeform'); // 'freeform' | 'template'
  const [formData, setFormData] = useState({
    to_number: defaultTo,
    message: '',
    lead_id: leadId,
    contact_id: contactId
  });

  const sendMutation = useMutation({
    mutationFn: twilioAPI.sendWhatsApp,
    onSuccess: () => {
      toast.success('WhatsApp message sent successfully!');
      // Invalidate relevant queries
      queryClient.invalidateQueries(['smsHistory']);
      queryClient.invalidateQueries(['twilioStats']);
      queryClient.invalidateQueries(['interactions']);
      queryClient.invalidateQueries(['leadInteractions']);
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to send WhatsApp message');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.to_number) {
      toast.error('Please enter a phone number');
      return;
    }
    if (messageType === 'freeform' && !formData.message) {
      toast.error('Please enter a message');
      return;
    }
    sendMutation.mutate({
      ...formData,
      message: messageType === 'freeform' ? formData.message : '',
      use_template: messageType === 'template'
    });
  };

  // Calculate character count
  const characterCount = formData.message.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <MessageCircle className="w-5 h-5" style={{ color: '#25D366' }} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Send WhatsApp Message</h2>
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
          {/* Phone Number with WhatsApp Indicator */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To (Phone Number)
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
                <MessageCircle size={18} style={{ color: '#25D366' }} />
                <input
                  type="tel"
                  value={formData.to_number}
                  onChange={(e) => setFormData({ ...formData, to_number: e.target.value })}
                  placeholder="+1234567890"
                  className="flex-1 bg-transparent focus:outline-none text-gray-900"
                  required
                />
              </div>
            </div>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <MessageCircle size={14} />
              WhatsApp enabled number
            </p>
          </div>

          {/* Message Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message Type
            </label>
            <div className="flex gap-2 rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setMessageType('freeform')}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  messageType === 'freeform' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                }`}
              >
                Custom Message
              </button>
              <button
                type="button"
                onClick={() => setMessageType('template')}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  messageType === 'template' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                }`}
              >
                Renewal Template
              </button>
            </div>
          </div>

          {/* Message Body - Conditional based on type */}
          {messageType === 'freeform' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Type your WhatsApp message here..."
                rows="6"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-none"
                style={{ focusRing: '#25D366' }}
              />

              {/* Character Count */}
              <div className="flex items-center justify-between mt-2 text-sm">
                <p className="text-gray-500">
                  {characterCount} characters
                </p>
                <p className={characterCount > 4096 ? 'text-red-600' : 'text-gray-500'}>
                  Max: 4096 characters
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-gray-700">
              <p className="font-medium text-green-800 mb-1">Renewal Template</p>
              <p className="text-gray-600 italic">
                Sending the approved "renewal_customer" template via WhatsApp.
              </p>
            </div>
          )}

          {/* Error Message */}
          {sendMutation.isError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">
                {sendMutation.error?.response?.data?.error || 'Failed to send WhatsApp message'}
              </p>
            </div>
          )}

          {/* Success Message */}
          {sendMutation.isSuccess && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-600 flex items-center gap-2">
                <MessageCircle size={16} />
                Message sent successfully!
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
              disabled={sendMutation.isPending || !formData.to_number || (messageType === 'freeform' && !formData.message)}
              className="px-6 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#25D366' }}
            >
              {sendMutation.isPending ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 inline mr-2" />
                  Send WhatsApp
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendWhatsAppModal;
