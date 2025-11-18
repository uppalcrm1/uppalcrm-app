import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Send, Inbox, CheckCircle, XCircle, Clock } from 'lucide-react';
import { twilioAPI } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

const SMSHistoryList = ({ leadId = null, contactId = null }) => {
  const [filters, setFilters] = useState({
    direction: '', // '', 'inbound', 'outbound'
    limit: 50,
    offset: 0
  });

  const { data, isLoading } = useQuery({
    queryKey: ['smsHistory', filters, leadId, contactId],
    queryFn: () => twilioAPI.getSMSHistory({ ...filters, leadId, contactId })
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const messages = data?.messages || [];

  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'sent':
      case 'queued':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <MessageSquare className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    // Format +1234567890 to +1 (234) 567-8900
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{1})(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `+${match[1]} (${match[2]}) ${match[3]}-${match[4]}`;
    }
    return phone;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilters({ ...filters, direction: '' })}
          className={`px-4 py-2 rounded-lg ${
            filters.direction === ''
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Messages
        </button>
        <button
          onClick={() => setFilters({ ...filters, direction: 'outbound' })}
          className={`px-4 py-2 rounded-lg ${
            filters.direction === 'outbound'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Send className="w-4 h-4 inline mr-1" />
          Sent
        </button>
        <button
          onClick={() => setFilters({ ...filters, direction: 'inbound' })}
          className={`px-4 py-2 rounded-lg ${
            filters.direction === 'inbound'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Inbox className="w-4 h-4 inline mr-1" />
          Received
        </button>
      </div>

      {/* Messages List */}
      {messages.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No SMS messages yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`p-4 rounded-lg border ${
                message.direction === 'outbound'
                  ? 'bg-blue-50 border-blue-200 ml-8'
                  : 'bg-gray-50 border-gray-200 mr-8'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {message.direction === 'outbound' ? (
                    <Send className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Inbox className="w-4 h-4 text-gray-600" />
                  )}
                  <span className="font-medium text-gray-900">
                    {message.direction === 'outbound'
                      ? `To: ${formatPhoneNumber(message.to_number)}`
                      : `From: ${formatPhoneNumber(message.from_number)}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(message.twilio_status)}
                  <span className="text-sm text-gray-500">
                    {new Date(message.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Message Body */}
              <p className="text-gray-700 whitespace-pre-wrap">{message.body}</p>

              {/* Related Lead/Contact */}
              {(message.lead_first_name || message.contact_first_name) && (
                <div className="mt-2 text-sm text-gray-600">
                  Related to: {message.lead_first_name || message.contact_first_name} {message.lead_last_name || message.contact_last_name}
                </div>
              )}

              {/* Error */}
              {message.error_message && (
                <div className="mt-2 text-sm text-red-600">
                  Error: {message.error_message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SMSHistoryList;
