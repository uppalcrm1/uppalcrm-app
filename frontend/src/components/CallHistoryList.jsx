import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Phone, PhoneIncoming, PhoneOutgoing, CheckCircle, XCircle, Clock } from 'lucide-react';
import { twilioAPI } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

const CallHistoryList = ({ leadId = null, contactId = null }) => {
  const [filters, setFilters] = useState({
    direction: '', // '', 'inbound', 'outbound'
    limit: 50,
    offset: 0
  });

  const { data, isLoading } = useQuery({
    queryKey: ['callHistory', filters, leadId, contactId],
    queryFn: () => twilioAPI.getCallHistory({ ...filters, leadId, contactId })
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const calls = data?.calls || [];

  const getStatusBadge = (status) => {
    const statusMap = {
      completed: { color: 'green', label: 'Completed' },
      'in-progress': { color: 'blue', label: 'In Progress' },
      ringing: { color: 'yellow', label: 'Ringing' },
      failed: { color: 'red', label: 'Failed' },
      busy: { color: 'orange', label: 'Busy' },
      'no-answer': { color: 'gray', label: 'No Answer' }
    };

    const { color, label } = statusMap[status] || { color: 'gray', label: status };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${color}-100 text-${color}-700`}>
        {label}
      </span>
    );
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{1})(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `+${match[1]} (${match[2]}) ${match[3]}-${match[4]}`;
    }
    return phone;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
          All Calls
        </button>
        <button
          onClick={() => setFilters({ ...filters, direction: 'outbound' })}
          className={`px-4 py-2 rounded-lg ${
            filters.direction === 'outbound'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <PhoneOutgoing className="w-4 h-4 inline mr-1" />
          Outbound
        </button>
        <button
          onClick={() => setFilters({ ...filters, direction: 'inbound' })}
          className={`px-4 py-2 rounded-lg ${
            filters.direction === 'inbound'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <PhoneIncoming className="w-4 h-4 inline mr-1" />
          Inbound
        </button>
      </div>

      {/* Calls List */}
      {calls.length === 0 ? (
        <div className="text-center py-12">
          <Phone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No phone calls yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => (
            <div
              key={call.id}
              className="p-4 rounded-lg border bg-white border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {call.direction === 'outbound' ? (
                    <PhoneOutgoing className="w-5 h-5 text-green-600" />
                  ) : (
                    <PhoneIncoming className="w-5 h-5 text-blue-600" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">
                      {call.direction === 'outbound'
                        ? `To: ${formatPhoneNumber(call.to_number)}`
                        : `From: ${formatPhoneNumber(call.from_number)}`}
                    </p>
                    {(call.lead_first_name || call.contact_first_name) && (
                      <p className="text-sm text-gray-600">
                        {call.lead_first_name || call.contact_first_name} {call.lead_last_name || call.contact_last_name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {getStatusBadge(call.twilio_status)}
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(call.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Call Details */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Duration</p>
                  <p className="font-medium text-gray-900">{formatDuration(call.duration_seconds)}</p>
                </div>
                {call.outcome && (
                  <div>
                    <p className="text-gray-600">Outcome</p>
                    <p className="font-medium text-gray-900 capitalize">{call.outcome.replace('_', ' ')}</p>
                  </div>
                )}
                {call.has_recording && (
                  <div>
                    <p className="text-gray-600">Recording</p>
                    <a
                      href={call.recording_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Play
                    </a>
                  </div>
                )}
              </div>

              {/* Notes */}
              {call.notes && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-600">Notes:</p>
                  <p className="text-sm text-gray-900">{call.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CallHistoryList;
