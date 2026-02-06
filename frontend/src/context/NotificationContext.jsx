import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { twilioAPI } from '../services/api';
import { ToastContainer } from '../components/ToastNotification';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';

const NotificationContext = createContext();

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const auth = useAuth();
  const isAuthenticated = auth?.isAuthenticated || false;
  const { isConnected: wsConnected, on: wsOn, off: wsOff } = useWebSocket();
  const [toasts, setToasts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [browserPermission, setBrowserPermission] = useState('default');
  const [shouldPollSMS, setShouldPollSMS] = useState(false);
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

  // WebSocket listener for incoming SMS
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleIncomingSMS = (smsData) => {
      console.log('💬 Incoming SMS received via WebSocket:', smsData);

      // Show toast notification
      addToast({
        type: 'sms',
        title: 'New SMS Message',
        message: `From ${smsData.contactName || smsData.from}: ${smsData.body.substring(0, 50)}${smsData.body.length > 50 ? '...' : ''}`,
        duration: 8000
      });

      // Show browser notification
      if (browserPermission === 'granted') {
        showBrowserNotification(
          'New SMS Message',
          `From ${smsData.contactName || smsData.from}`,
          smsData.body
        );
      }

      // Play notification sound
      playNotificationSound();

      // Increment unread count
      setUnreadCount(prev => prev + 1);

      // Invalidate conversations query to refresh UI
      queryClient.invalidateQueries(['conversations']);
    };

    // Set up WebSocket listener
    wsOn('incoming-sms', handleIncomingSMS);

    // Return cleanup function
    return () => {
      wsOff('incoming-sms', handleIncomingSMS);
    };
  }, [isAuthenticated, browserPermission, queryClient, wsOn, wsOff, addToast, showBrowserNotification, playNotificationSound]);

  // Fallback polling for SMS if WebSocket is unavailable
  useEffect(() => {
    // Enable polling only if WebSocket is not connected
    setShouldPollSMS(!wsConnected && isAuthenticated);
  }, [wsConnected, isAuthenticated]);

  // Poll for new messages as fallback (only if WebSocket unavailable)
  const { data: conversationsData } = useQuery({
    queryKey: ['notifications-check'],
    queryFn: twilioAPI.getConversations,
    refetchInterval: shouldPollSMS ? 15000 : false, // Check every 15 seconds if polling enabled
    staleTime: 10000,
    enabled: shouldPollSMS // Only run when polling is enabled (WebSocket unavailable)
  });

  // Check for new messages from polling and trigger notifications
  useEffect(() => {
    if (!shouldPollSMS || !conversationsData?.conversations) return;

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
      console.log('💬 Incoming SMS received via polling (fallback)');

      // Show toast notification
      addToast({
        type: 'sms',
        title: 'New SMS Message',
        message: `From ${latestConversation.contactName || latestConversation.phoneNumber}: ${latestConversation.lastMessage.substring(0, 50)}...`,
        duration: 8000
      });

      // Show browser notification
      if (browserPermission === 'granted') {
        showBrowserNotification(
          'New SMS Message',
          `From ${latestConversation.contactName || latestConversation.phoneNumber}`,
          latestConversation.lastMessage
        );
      }

      // Play notification sound
      playNotificationSound();

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

  }, [conversationsData, browserPermission, queryClient, shouldPollSMS, addToast, showBrowserNotification, playNotificationSound]);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showBrowserNotification = useCallback((title, subtitle, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: `${subtitle}\n${body}`,
        icon: '/favicon.ico',
        tag: 'sms-notification',
        renotify: true
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto close after 10 seconds
      setTimeout(() => notification.close(), 10000);
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, 200);
    } catch (e) {
      console.log('Could not play notification sound');
    }
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
