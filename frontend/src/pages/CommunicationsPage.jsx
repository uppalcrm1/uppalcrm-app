import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Phone, Send, Settings } from 'lucide-react';
import { twilioAPI } from '../services/api';
import SendSMSModal from '../components/SendSMSModal';
import ConversationList from '../components/ConversationList';
import ConversationView from '../components/ConversationView';
import CallHistoryList from '../components/CallHistoryList';
import TwilioConfigModal from '../components/TwilioConfigModal';
import LoadingSpinner from '../components/LoadingSpinner';

const CommunicationsPage = () => {
  const [activeTab, setActiveTab] = useState('sms');
  const [showSendSMS, setShowSendSMS] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState(null);
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

  // Get conversations
  const { data: conversationsData, isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: twilioAPI.getConversations,
    enabled: config?.configured && activeTab === 'sms',
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Get selected conversation messages
  const { data: conversationData, isLoading: conversationLoading } = useQuery({
    queryKey: ['conversation', selectedPhone],
    queryFn: () => twilioAPI.getConversation(selectedPhone),
    enabled: !!selectedPhone,
    refetchInterval: 10000 // Refresh every 10 seconds when viewing
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
            New Message
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
              onClick={() => {
                setActiveTab('sms');
                setSelectedPhone(null);
              }}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'sms'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <MessageSquare className="w-4 h-4 inline mr-2" />
              Messages
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
        {activeTab === 'sms' && (
          <div className="flex h-[600px]">
            {/* Conversation List */}
            <div className={`${selectedPhone ? 'hidden md:block' : ''} w-full md:w-1/3 border-r border-gray-200 overflow-y-auto`}>
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-700">Conversations</h3>
              </div>
              <ConversationList
                conversations={conversationsData?.conversations}
                selectedPhone={selectedPhone}
                onSelectConversation={setSelectedPhone}
                isLoading={conversationsLoading}
              />
            </div>

            {/* Conversation View */}
            <div className={`${selectedPhone ? '' : 'hidden md:flex'} flex-1 ${!selectedPhone ? 'items-center justify-center' : ''}`}>
              {selectedPhone ? (
                <ConversationView
                  phoneNumber={selectedPhone}
                  messages={conversationData?.messages}
                  contactInfo={conversationData?.contactInfo}
                  isLoading={conversationLoading}
                  onBack={() => setSelectedPhone(null)}
                  onSendMessage={() => {
                    queryClient.invalidateQueries(['conversation', selectedPhone]);
                    queryClient.invalidateQueries(['conversations']);
                    queryClient.invalidateQueries(['twilioStats']);
                  }}
                />
              ) : (
                <div className="text-center">
                  <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Select a conversation</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Choose a conversation from the list to view messages
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'calls' && (
          <div className="p-6">
            <CallHistoryList />
          </div>
        )}
      </div>

      {/* Modals */}
      {showSendSMS && (
        <SendSMSModal
          onClose={() => setShowSendSMS(false)}
          onSuccess={() => {
            queryClient.invalidateQueries(['conversations']);
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
