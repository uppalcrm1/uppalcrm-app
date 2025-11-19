import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, ArrowDownLeft, ArrowUpRight, User } from 'lucide-react';

export default function ConversationList({ conversations, selectedPhone, onSelectConversation, isLoading }) {
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

  return (
    <div className="divide-y divide-gray-200">
      {conversations.map((conversation) => (
        <div
          key={conversation.phoneNumber}
          onClick={() => onSelectConversation(conversation.phoneNumber)}
          className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
            selectedPhone === conversation.phoneNumber ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
          }`}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="h-5 w-5 text-gray-500" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {conversation.contactName || conversation.phoneNumber}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
                </p>
              </div>
              {conversation.contactName && (
                <p className="text-xs text-gray-500">{conversation.phoneNumber}</p>
              )}
              <div className="mt-1 flex items-center">
                {conversation.lastDirection === 'inbound' ? (
                  <ArrowDownLeft className="h-3 w-3 text-green-500 mr-1 flex-shrink-0" />
                ) : (
                  <ArrowUpRight className="h-3 w-3 text-blue-500 mr-1 flex-shrink-0" />
                )}
                <p className="text-sm text-gray-600 truncate">
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
      ))}
    </div>
  );
}
