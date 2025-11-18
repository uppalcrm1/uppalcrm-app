import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Phone, Send, Settings, Plus } from 'lucide-react';
import { twilioAPI } from '../services/api';
import SendSMSModal from '../components/SendSMSModal';
import SMSHistoryList from '../components/SMSHistoryList';
import CallHistoryList from '../components/CallHistoryList';
import TwilioConfigModal from '../components/TwilioConfigModal';
import LoadingSpinner from '../components/LoadingSpinner';

const CommunicationsPage = () => {
  const [activeTab, setActiveTab] = useState('sms'); // 'sms', 'calls', 'templates'
  const [showSendSMS, setShowSendSMS] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const queryClient = useQueryClient();

  // Check Twilio configuration
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['twilioConfig'],
    queryFn: twilioAPI.getConfig
  });

  // Get statistics
  const { data: stats } = useQuery({
    queryKey: ['twilioStats'],
    queryFn: twilioAPI.getStats,
    enabled: config?.configured
  });

  if (configLoading) {
    return <LoadingSpinner />;
  }

  // If Twilio not configured, show setup screen
  if (!config?.configured) {
    return (
      <div className="max-w-2xl mx-auto mt-16">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Set Up Twilio Integration
          </h2>
          <p className="text-gray-600 mb-6">
            Connect your Twilio account to send SMS messages and make phone calls directly from your CRM.
          </p>
          <button
            onClick={() => setShowConfig(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Configure Twilio
          </button>
        </div>

        {showConfig && (
          <TwilioConfigModal
            onClose={() => setShowConfig(false)}
            onSuccess={() => queryClient.invalidateQueries(['twilioConfig'])}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Communications</h1>
          <p className="text-gray-600">Manage SMS messages and phone calls</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowConfig(true)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Settings
          </button>
          <button
            onClick={() => setShowSendSMS(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Send className="w-4 h-4 inline mr-2" />
            Send SMS
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total SMS</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.sms.total_sms || 0}
                </p>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {stats.sms.sent || 0} sent • {stats.sms.received || 0} received
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Delivered</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.sms.delivered || 0}
                </p>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-bold">✓</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Calls</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.calls.total_calls || 0}
                </p>
              </div>
              <Phone className="w-8 h-8 text-purple-600" />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {stats.calls.answered || 0} answered
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Cost</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${((parseFloat(stats.sms.total_sms_cost || 0) + parseFloat(stats.calls.total_call_cost || 0))).toFixed(2)}
                </p>
              </div>
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-gray-600 font-bold">$</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('sms')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'sms'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <MessageSquare className="w-4 h-4 inline mr-2" />
              SMS Messages
            </button>
            <button
              onClick={() => setActiveTab('calls')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'calls'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Phone className="w-4 h-4 inline mr-2" />
              Phone Calls
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'sms' && <SMSHistoryList />}
          {activeTab === 'calls' && <CallHistoryList />}
        </div>
      </div>

      {/* Modals */}
      {showSendSMS && (
        <SendSMSModal
          onClose={() => setShowSendSMS(false)}
          onSuccess={() => {
            queryClient.invalidateQueries(['smsHistory']);
            queryClient.invalidateQueries(['twilioStats']);
          }}
        />
      )}

      {showConfig && (
        <TwilioConfigModal
          onClose={() => setShowConfig(false)}
          onSuccess={() => queryClient.invalidateQueries(['twilioConfig'])}
        />
      )}
    </div>
  );
};

export default CommunicationsPage;
