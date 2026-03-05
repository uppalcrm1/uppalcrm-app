import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, MessageCircle, Phone, Send, Settings, PhoneCall, ChevronDown } from 'lucide-react';
import { twilioAPI } from '../services/api';
import { useTwilioConfig } from '../hooks/useTwilioConfig';
import { useNotifications } from '../context/NotificationContext';
import SendSMSModal from '../components/SendSMSModal';
import SendWhatsAppModal from '../components/SendWhatsAppModal';
import ConversationList from '../components/ConversationList';
import ConversationView from '../components/ConversationView';
import CallHistoryList from '../components/CallHistoryList';
import TwilioConfigModal from '../components/TwilioConfigModal';
import Dialpad from '../components/Dialpad';
import LoadingSpinner from '../components/LoadingSpinner';

const CommunicationsPage = () => {
  const [activeTab, setActiveTab] = useState('sms');
  const [showSendSMS, setShowSendSMS] = useState(false);
  const [showSendWhatsApp, setShowSendWhatsApp] = useState(false);
  const [showMessageMenu, setShowMessageMenu] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showDialpad, setShowDialpad] = useState(false);
  const [dialpadNumber, setDialpadNumber] = useState('');
  const [dialpadCallerName, setDialpadCallerName] = useState('');
  const [selectedPhone, setSelectedPhone] = useState(null);
  const queryClient = useQueryClient();
  const { clearUnread } = useNotifications();
  const { whatsappEnabled } = useTwilioConfig();

  // Clear unread count when viewing Communications page
  useEffect(() => {
    clearUnread();
  }, [clearUnread]);

  // Listen for dialpad open event (from incoming call acceptance)
  useEffect(() => {
    const handleOpenDialpad = (event) => {
      const { phoneNumber, callerName } = event.detail;
      setDialpadNumber(phoneNumber);
      setDialpadCallerName(callerName);
      setSelectedPhone(null);
      setShowDialpad(true);
    };

    window.addEventListener('openDialpadWithNumber', handleOpenDialpad);
    return () => window.removeEventListener('openDialpadWithNumber', handleOpenDialpad);
  }, []);

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

  // Get SMS conversations
  const { data: smsConversationsData, isLoading: smsConversationsLoading } = useQuery({
    queryKey: ['conversations', 'sms'],
    queryFn: () => twilioAPI.getConversations({ channel: 'sms' }),
    enabled: config?.configured && activeTab === 'sms',
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Get WhatsApp conversations
  const { data: whatsappConversationsData, isLoading: whatsappConversationsLoading } = useQuery({
    queryKey: ['conversations', 'whatsapp'],
    queryFn: () => twilioAPI.getConversations({ channel: 'whatsapp' }),
    enabled: config?.configured && activeTab === 'whatsapp',
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Determine which conversations to show based on active tab
  const conversationsData = activeTab === 'sms' ? smsConversationsData : whatsappConversationsData;
  const conversationsLoading = activeTab === 'sms' ? smsConversationsLoading : whatsappConversationsLoading;

  // Get selected conversation messages (with channel filter)
  const { data: conversationData, isLoading: conversationLoading } = useQuery({
    queryKey: ['conversation', selectedPhone, activeTab],
    queryFn: () => twilioAPI.getConversation(selectedPhone, { channel: activeTab === 'sms' ? 'sms' : 'whatsapp' }),
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
          <p className="text-gray-600">Manage SMS, WhatsApp messages and phone calls</p>
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
            onClick={() => setShowDialpad(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <PhoneCall className="w-4 h-4 inline mr-2" />
            New Call
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMessageMenu(!showMessageMenu)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              New Message
              <ChevronDown className="w-4 h-4" />
            </button>
            {showMessageMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10 border border-gray-200">
                <button
                  onClick={() => {
                    setShowSendSMS(true);
                    setShowMessageMenu(false);
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 ${whatsappEnabled ? 'border-b border-gray-100' : ''}`}
                >
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">Send SMS</p>
                    <p className="text-xs text-gray-500">Send a text message</p>
                  </div>
                </button>
                {whatsappEnabled && (
                  <button
                    onClick={() => {
                      setShowSendWhatsApp(true);
                      setShowMessageMenu(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" style={{ color: '#25D366' }} />
                    <div>
                      <p className="font-medium text-gray-900">Send WhatsApp</p>
                      <p className="text-xs text-gray-500">Send a WhatsApp message</p>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className={`grid gap-6 ${whatsappEnabled ? 'grid-cols-1 md:grid-cols-5' : 'grid-cols-1 md:grid-cols-4'}`}>
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

          {whatsappEnabled && (
            <div className="rounded-lg shadow-sm p-6 text-white" style={{ backgroundColor: '#25D366' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total WhatsApp</p>
                  <p className="text-2xl font-bold">
                    {stats.sms.total_whatsapp || 0}
                  </p>
                </div>
                <MessageCircle className="w-8 h-8" />
              </div>
              <p className="text-sm opacity-75 mt-2">
                Messages via WhatsApp
              </p>
            </div>
          )}

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
              Messages (SMS)
            </button>
            {whatsappEnabled && (
              <button
                onClick={() => {
                  setActiveTab('whatsapp');
                  setSelectedPhone(null);
                }}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'whatsapp'
                    ? 'border-b-2 text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                style={activeTab === 'whatsapp' ? { borderBottomColor: '#25D366', color: '#25D366' } : {}}
              >
                <MessageCircle className="w-4 h-4 inline mr-2" />
                WhatsApp
              </button>
            )}
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
        {(activeTab === 'sms' || activeTab === 'whatsapp') && (
          <div className="flex h-[600px]">
            {/* Conversation List */}
            <div className={`${selectedPhone ? 'hidden md:block' : ''} w-full md:w-1/3 border-r border-gray-200 overflow-y-auto`}>
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-700">
                  {activeTab === 'sms' ? 'SMS Conversations' : 'WhatsApp Conversations'}
                </h3>
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
                  channel={activeTab === 'sms' ? 'sms' : 'whatsapp'}
                  onBack={() => setSelectedPhone(null)}
                  onSendMessage={() => {
                    queryClient.invalidateQueries(['conversation', selectedPhone, activeTab]);
                    queryClient.invalidateQueries(['conversations', activeTab]);
                    queryClient.invalidateQueries(['twilioStats']);
                  }}
                />
              ) : (
                <div className="text-center">
                  {activeTab === 'sms' ? (
                    <>
                      <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">Select a conversation</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Choose a conversation from the list to view SMS messages
                      </p>
                    </>
                  ) : (
                    <>
                      <MessageCircle className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">Select a conversation</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Choose a conversation from the list to view WhatsApp messages
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'calls' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Call History</h3>
              <button
                onClick={() => setShowDialpad(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
              >
                <PhoneCall className="w-4 h-4 mr-2" />
                Open Dialpad
              </button>
            </div>
            <CallHistoryList />
          </div>
        )}
      </div>

      {/* Modals */}
      {showSendSMS && (
        <SendSMSModal
          onClose={() => setShowSendSMS(false)}
          onSuccess={() => {
            queryClient.invalidateQueries(['conversations', 'sms']);
            queryClient.invalidateQueries(['twilioStats']);
          }}
        />
      )}

      {showSendWhatsApp && (
        <SendWhatsAppModal
          onClose={() => setShowSendWhatsApp(false)}
          onSuccess={() => {
            queryClient.invalidateQueries(['conversations', 'whatsapp']);
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

      {showDialpad && (
        <Dialpad
          onClose={() => {
            setShowDialpad(false);
            setDialpadNumber('');
            setDialpadCallerName('');
          }}
          prefilledNumber={dialpadNumber}
          contactName={dialpadCallerName}
        />
      )}
    </div>
  );
};

export default CommunicationsPage;
