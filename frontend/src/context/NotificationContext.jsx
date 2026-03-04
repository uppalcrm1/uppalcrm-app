import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { twilioAPI } from '../services/api';
import { ToastContainer } from '../components/ToastNotification';
import { useAuth } from '../contexts/AuthContext';
import { playNotificationSound } from '../utils/audio';
import { showBrowserNotification, flashTabTitle } from '../utils/notifications';

const NotificationContext = createContext();

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const auth = useAuth();
  const isAuthenticated = auth?.isAuthenticated || false;
  const [toasts, setToasts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [browserPermission, setBrowserPermission] = useState('default');
  const lastMessageIdRef = useRef(null);
  const queryClient = useQueryClient();

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
  }, []);

  const requestBrowserPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      return permission;
    }
    return 'denied';
  }, []);

  // Poll for new messages (only if authenticated)
  const { data: conversationsData } = useQuery({
    queryKey: ['notifications-check'],
    queryFn: twilioAPI.getConversations,
    refetchInterval: 15000, // Check every 15 seconds
    staleTime: 10000,
    enabled: isAuthenticated // Only run when authenticated
  });

  // Check for new messages and trigger notifications
  useEffect(() => {
    if (!conversationsData?.conversations) return;

    const conversations = conversationsData.conversations;
    if (conversations.length === 0) return;

    // Get the most recent message
    const latestConversation = conversations[0];
    const latestMessageTime = new Date(latestConversation.lastMessageAt).getTime();

    // If this is a new inbound message
    if (
      latestConversation.lastDirection === 'inbound' &&
      lastMessageIdRef.current &&
      latestMessageTime > lastMessageIdRef.current
    ) {
      // Show toast notification
      addToast({
        type: 'sms',
        title: 'New SMS Message',
        message: `From ${latestConversation.contactName || latestConversation.phoneNumber}: ${latestConversation.lastMessage.substring(0, 50)}...`,
        duration: 8000
      });

      // Show browser notification
      const senderName = latestConversation.contactName || latestConversation.phoneNumber;
      const preview = latestConversation.lastMessage?.substring(0, 100) || '';
      showBrowserNotification('💬 New SMS Message', {
        body: `From ${senderName}: ${preview}`,
        tag: `sms-${latestConversation.phoneNumber}`,
        requireInteraction: false
      });

      // Play two-tone notification beep
      playNotificationSound();

      // Flash the browser tab title
      flashTabTitle('💬 New Message!');

      // Invalidate conversations query to refresh UI
      queryClient.invalidateQueries(['conversations']);
    }

    lastMessageIdRef.current = latestMessageTime;

    // Calculate unread count (messages in last hour that are inbound)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentInbound = conversations.filter(c =>
      c.lastDirection === 'inbound' &&
      new Date(c.lastMessageAt).getTime() > oneHourAgo
    ).length;
    setUnreadCount(recentInbound);

  }, [conversationsData, queryClient]);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const value = {
    toasts,
    addToast,
    dismissToast,
    unreadCount,
    clearUnread,
    browserPermission,
    requestBrowserPermission
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </NotificationContext.Provider>
  );
}
