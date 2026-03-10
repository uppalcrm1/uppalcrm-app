import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ToastContainer } from '../components/ToastNotification';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
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
  const [browserPermission, setBrowserPermission] = useState('default');
  const queryClient = useQueryClient();
  const { on, off } = useWebSocket();

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

  // Listen for incoming messages via WebSocket to show notifications
  useEffect(() => {
    const handleIncomingSMSNotification = (data) => {
      const senderName = data.contactName || data.from;
      const preview = data.body?.substring(0, 100) || '';

      // Show toast notification
      addToast({
        type: 'sms',
        title: 'New SMS Message',
        message: `From ${senderName}: ${data.body?.substring(0, 50)}...`,
        duration: 8000
      });

      // Show browser notification
      showBrowserNotification('💬 New SMS Message', {
        body: `From ${senderName}: ${preview}`,
        tag: `sms-${data.from}`,
        renotify: true,
        requireInteraction: false
      });

      // Play notification sound
      playNotificationSound();

      // Flash the browser tab title
      flashTabTitle('💬 New Message!');
    };

    on('incoming-sms', handleIncomingSMSNotification);
    return () => off('incoming-sms', handleIncomingSMSNotification);
  }, [on, off, addToast]);

  // WebSocket listener: when incoming SMS/WhatsApp arrives, increment unread counts
  useEffect(() => {
    const handleIncomingSMS = (data) => {
      const channel = data.channel || 'sms';

      // Increment the unread count in React Query cache
      queryClient.setQueryData(['unreadCounts'], (old) => {
        if (!old) return { sms: channel === 'sms' ? 1 : 0, whatsapp: channel === 'whatsapp' ? 1 : 0, calls: 0, total: 1 };
        const updated = { ...old };
        if (channel === 'sms') updated.sms = (updated.sms || 0) + 1;
        else if (channel === 'whatsapp') updated.whatsapp = (updated.whatsapp || 0) + 1;
        updated.total = (updated.sms || 0) + (updated.whatsapp || 0) + (updated.calls || 0);
        return updated;
      });

      // Invalidate conversation lists to get updated is_unread flags
      queryClient.invalidateQueries({ queryKey: ['conversations', channel] });
    };

    const handleIncomingCall = (data) => {
      // For missed calls, increment the calls unread count
      queryClient.setQueryData(['unreadCounts'], (old) => {
        if (!old) return { sms: 0, whatsapp: 0, calls: 1, total: 1 };
        const updated = { ...old };
        updated.calls = (updated.calls || 0) + 1;
        updated.total = (updated.sms || 0) + (updated.whatsapp || 0) + (updated.calls || 0);
        return updated;
      });
    };

    on('incoming-sms', handleIncomingSMS);
    on('incoming-call', handleIncomingCall);

    return () => {
      off('incoming-sms', handleIncomingSMS);
      off('incoming-call', handleIncomingCall);
    };
  }, [on, off, queryClient]);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const value = {
    toasts,
    addToast,
    dismissToast,
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
