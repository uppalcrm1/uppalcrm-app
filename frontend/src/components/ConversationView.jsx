import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Send, ArrowLeft, User, Phone, Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { twilioAPI } from '../services/api';

export default function ConversationView({
  phoneNumber,
  messages,
  contactInfo,
  isLoading,
  onBack,
  onSendMessage
}) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const sendMutation = useMutation({
    mutationFn: (messageData) => twilioAPI.sendSMS(messageData),
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries(['conversation', phoneNumber]);
      queryClient.invalidateQueries(['conversations']);
      if (onSendMessage) onSendMessage();
    }
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    sendMutation.mutate({
      to: phoneNumber,
      body: newMessage.trim(),
      leadId: contactInfo?.type === 'lead' ? contactInfo.id : null,
      contactId: contactInfo?.type === 'contact' ? contactInfo.id : null
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case 'sent':
        return <Check className="h-3 w-3 text-gray-400" />;
      case 'queued':
      case 'sending':
        return <Clock className="h-3 w-3 text-gray-400" />;
      case 'failed':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-gray-200 bg-white">
        <button
          onClick={onBack}
          className="mr-3 p-1 hover:bg-gray-100 rounded-full md:hidden"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex items-center flex-1">
          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
            <User className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              {contactInfo?.name || phoneNumber}
            </h3>
            {contactInfo?.name && (
              <p className="text-xs text-gray-500">{phoneNumber}</p>
            )}
          </div>
        </div>
        <a
          href={`tel:${phoneNumber}`}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          <Phone className="h-5 w-5 text-gray-600" />
        </a>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages && messages.length > 0 ? (
          <>
            {messages.map((message, index) => {
              const isOutbound = message.direction === 'outbound';
              const showDate = index === 0 ||
                new Date(message.created_at).toDateString() !==
                new Date(messages[index - 1].created_at).toDateString();

              return (
                <div key={message.id}>
                  {showDate && (
                    <div className="text-center my-4">
                      <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm">
                        {format(new Date(message.created_at), 'MMMM d, yyyy')}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                        isOutbound
                          ? 'bg-indigo-600 text-white rounded-br-md'
                          : 'bg-white text-gray-900 rounded-bl-md shadow-sm'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                      <div className={`flex items-center justify-end mt-1 space-x-1 ${
                        isOutbound ? 'text-indigo-200' : 'text-gray-400'
                      }`}>
                        <span className="text-xs">
                          {format(new Date(message.created_at), 'h:mm a')}
                        </span>
                        {isOutbound && getStatusIcon(message.twilio_status)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No messages yet. Start the conversation!</p>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-200 bg-white">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={sendMutation.isPending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sendMutation.isPending}
            className="p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendMutation.isPending ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
        {sendMutation.isError && (
          <p className="mt-2 text-xs text-red-600">
            Failed to send message. Please try again.
          </p>
        )}
      </form>
    </div>
  );
}
