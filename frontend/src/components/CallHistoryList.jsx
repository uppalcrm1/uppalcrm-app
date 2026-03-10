import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Voicemail, Play, Pause } from 'lucide-react';
import { twilioAPI } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { formatPhoneNumber } from '../utils/formatPhone';

const CallHistoryList = ({ leadId = null, contactId = null, onMarkRead }) => {
  const [filters, setFilters] = useState({
    direction: '',
    status: '', // '', 'missed', 'voicemail'
    limit: 50,
    offset: 0
  });
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['callHistory', filters, leadId, contactId],
    queryFn: () => twilioAPI.getCallHistory({ ...filters, leadId, contactId })
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const calls = data?.calls || [];

  const getStatusBadge = (status, outcome) => {
    const statusMap = {
      completed: { color: 'green', label: 'Completed' },
      'in-progress': { color: 'blue', label: 'In Progress' },
      ringing: { color: 'yellow', label: 'Ringing' },
      failed: { color: 'red', label: 'Failed' },
      busy: { color: 'orange', label: 'Busy' },
      'no-answer': { color: 'gray', label: 'No Answer' },
      missed: { color: 'red', label: 'Missed' },
      voicemail: { color: 'purple', label: 'Voicemail' }
    };

    // Check call_status first, then twilio_status, then outcome
    const effectiveStatus = status === 'missed' || status === 'no-answer' || status === 'voicemail'
      ? status
      : outcome === 'no_answer' ? 'no-answer'
      : outcome === 'voicemail' ? 'voicemail'
      : outcome === 'busy' ? 'busy'
      : outcome === 'failed' ? 'failed'
      : status;

    const { color, label } = statusMap[effectiveStatus] || { color: 'gray', label: effectiveStatus || status };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${color}-100 text-${color}-700`}>
        {label}
      </span>
    );
  };

  const isMissedCall = (call) => {
    return call.call_status === 'missed' || call.call_status === 'no-answer' || call.call_status === 'voicemail'
      || call.outcome === 'no_answer' || call.outcome === 'busy' || call.outcome === 'voicemail' || call.outcome === 'failed';
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCallClick = (call) => {
    if (call.is_unread && onMarkRead) {
      const phoneNumber = call.direction === 'outbound' ? call.to_number : call.from_number;
      onMarkRead(phoneNumber, 'call');
    }
  };

  const handlePlayVoicemail = (call, e) => {
    e.stopPropagation();
    const url = call.voicemail_url || call.recording_url;
    if (!url) return;

    if (playingId === call.id) {
      // Toggle pause/play
      if (audioRef.current) {
        if (audioRef.current.paused) {
          audioRef.current.play();
        } else {
          audioRef.current.pause();
        }
      }
      return;
    }

    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(url);
    audio.play();
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(call.id);

    // Mark as read
    if (call.is_unread && onMarkRead) {
      const phoneNumber = call.direction === 'outbound' ? call.to_number : call.from_number;
      onMarkRead(phoneNumber, 'call');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilters({ ...filters, direction: '', status: '' })}
          className={`px-4 py-2 rounded-lg ${
            filters.direction === '' && filters.status === ''
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Calls
        </button>
        <button
          onClick={() => setFilters({ ...filters, direction: 'outbound', status: '' })}
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
          onClick={() => setFilters({ ...filters, direction: 'inbound', status: '' })}
          className={`px-4 py-2 rounded-lg ${
            filters.direction === 'inbound' && filters.status === ''
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <PhoneIncoming className="w-4 h-4 inline mr-1" />
          Inbound
        </button>
        <div className="border-l border-gray-300 mx-1" />
        <button
          onClick={() => setFilters({ ...filters, direction: '', status: 'missed' })}
          className={`px-4 py-2 rounded-lg ${
            filters.status === 'missed'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <PhoneMissed className="w-4 h-4 inline mr-1" />
          Missed
        </button>
        <button
          onClick={() => setFilters({ ...filters, direction: '', status: 'voicemail' })}
          className={`px-4 py-2 rounded-lg ${
            filters.status === 'voicemail'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Voicemail className="w-4 h-4 inline mr-1" />
          Voicemail
        </button>
      </div>

      {/* Calls List */}
      {calls.length === 0 ? (
        <div className="text-center py-12">
          <Phone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {filters.status === 'missed' ? 'No missed calls' : filters.status === 'voicemail' ? 'No voicemails' : 'No phone calls yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => {
            const missed = isMissedCall(call);
            const isUnread = call.is_unread;
            const hasVoicemail = call.voicemail_url || (call.has_recording && (call.call_status === 'voicemail' || call.outcome === 'voicemail'));

            return (
              <div
                key={call.id}
                onClick={() => handleCallClick(call)}
                className={`p-4 rounded-lg border bg-white border-gray-200 hover:shadow-md transition-shadow cursor-pointer ${
                  isUnread ? 'border-l-4 border-l-red-500 bg-red-50/30' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {/* Unread dot for missed calls */}
                    {isUnread && (
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                    )}
                    {/* Call direction / status icon */}
                    {missed ? (
                      <PhoneMissed className="w-5 h-5 text-red-500" />
                    ) : call.direction === 'outbound' ? (
                      <PhoneOutgoing className="w-5 h-5 text-green-600" />
                    ) : (
                      <PhoneIncoming className="w-5 h-5 text-blue-600" />
                    )}
                    <div>
                      <p className={`font-medium ${missed ? 'text-red-600' : 'text-gray-900'} ${isUnread ? 'font-semibold' : ''}`}>
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
                    {getStatusBadge(call.call_status || call.twilio_status, call.outcome)}
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
                  {/* Voicemail playback */}
                  {(hasVoicemail || call.has_recording) && (
                    <div>
                      <p className="text-gray-600">{hasVoicemail ? 'Voicemail' : 'Recording'}</p>
                      <button
                        onClick={(e) => handlePlayVoicemail(call, e)}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {playingId === call.id ? (
                          <><Pause className="w-4 h-4" /> Pause</>
                        ) : (
                          <><Play className="w-4 h-4" /> Play</>
                        )}
                      </button>
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CallHistoryList;
