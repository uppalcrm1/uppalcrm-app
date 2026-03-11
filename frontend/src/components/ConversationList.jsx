import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, ArrowDownLeft, ArrowUpRight, User, UserPlus, UserRoundPlus } from 'lucide-react';
import { formatPhoneNumber } from '../utils/formatPhone';

export default function ConversationList({ conversations, selectedPhone, onSelectConversation, isLoading, channel = 'sms', onCreateContact, onCreateLead }) {
  const [openMenuPhone, setOpenMenuPhone] = useState(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No conversations</h3>
        <p className="mt-1 text-sm text-gray-500">Send an SMS to start a conversation.</p>
      </div>
    );
  }

  // Unread dot color based on channel
  const dotColor = channel === 'whatsapp' ? 'bg-green-500' : 'bg-blue-500';

  const handleCreateClick = (e, phoneNumber) => {
    e.stopPropagation();
    setOpenMenuPhone(openMenuPhone === phoneNumber ? null : phoneNumber);
  };

  return (
    <div className="divide-y divide-gray-200">
      {conversations.map((conversation) => {
        const isUnread = conversation.isUnread;
        const isSelected = selectedPhone === conversation.phoneNumber;
        const hasName = !!conversation.contactName;

        return (
          <div
            key={conversation.phoneNumber}
            onClick={() => onSelectConversation(conversation.phoneNumber)}
            className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
              isSelected ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
            } ${isUnread && !isSelected ? 'bg-blue-50/30' : ''}`}
          >
            <div className="flex items-start space-x-3">
              {/* Unread dot */}
              <div className="flex-shrink-0 flex items-center">
                {isUnread && (
                  <div className={`w-2.5 h-2.5 rounded-full ${dotColor} mr-2`} />
                )}
                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="h-5 w-5 text-gray-500" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className={`text-sm truncate ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'}`}>
                      {hasName ? conversation.contactName : formatPhoneNumber(conversation.phoneNumber)}
                    </p>
                    {/* Create Contact/Lead button for unknown numbers */}
                    {!hasName && (
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={(e) => handleCreateClick(e, conversation.phoneNumber)}
                          className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-indigo-600 transition-colors"
                          title="Create Contact or Lead"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                        </button>
                        {openMenuPhone === conversation.phoneNumber && (
                          <div className="absolute left-0 top-6 z-20 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuPhone(null);
                                onCreateContact?.(conversation.phoneNumber);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <UserPlus className="h-3.5 w-3.5 text-indigo-600" />
                              Create Contact
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuPhone(null);
                                onCreateLead?.(conversation.phoneNumber);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <UserRoundPlus className="h-3.5 w-3.5 text-green-600" />
                              Create Lead
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 flex-shrink-0 ml-2">
                    {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
                  </p>
                </div>
                {hasName && (
                  <p className="text-xs text-gray-500">{formatPhoneNumber(conversation.phoneNumber)}</p>
                )}
                <div className="mt-1 flex items-center">
                  {conversation.lastDirection === 'inbound' ? (
                    <ArrowDownLeft className="h-3 w-3 text-green-500 mr-1 flex-shrink-0" />
                  ) : (
                    <ArrowUpRight className="h-3 w-3 text-blue-500 mr-1 flex-shrink-0" />
                  )}
                  <p className={`text-sm truncate ${isUnread ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                    {conversation.lastMessage}
                  </p>
                </div>
                <div className="mt-1 flex items-center space-x-2 text-xs text-gray-400">
                  <span>{conversation.messageCount} messages</span>
                  <span>•</span>
                  <span className="text-green-600">{conversation.inboundCount} in</span>
                  <span>•</span>
                  <span className="text-blue-600">{conversation.outboundCount} out</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
