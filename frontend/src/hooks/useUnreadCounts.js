import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { twilioAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * Custom hook for managing unread conversation counts.
 * Uses React Query with 30-second polling for real-time badge updates.
 */
export function useUnreadCounts() {
  const auth = useAuth();
  const isAuthenticated = auth?.isAuthenticated || false;
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['unreadCounts'],
    queryFn: twilioAPI.getUnreadCounts,
    staleTime: Infinity, // Don't auto-refetch; rely on websocket invalidations
    enabled: isAuthenticated,
    placeholderData: { sms: 0, whatsapp: 0, calls: 0, total: 0 }
  });

  const counts = data || { sms: 0, whatsapp: 0, calls: 0, total: 0 };

  // Mark a single conversation as read and update counts
  const markAsRead = useCallback(async (conversationPhone, channel) => {
    try {
      await twilioAPI.markRead({ conversation_phone: conversationPhone, channel });
      // Immediately refetch unread counts
      queryClient.invalidateQueries({ queryKey: ['unreadCounts'] });
      // Also refresh the conversation list so is_unread flag updates
      queryClient.invalidateQueries({ queryKey: ['conversations', channel] });
    } catch (error) {
      console.error('Failed to mark conversation as read:', error);
    }
  }, [queryClient]);

  // Mark all conversations in a channel as read
  const markAllAsRead = useCallback(async (channel) => {
    try {
      await twilioAPI.markAllRead({ channel });
      queryClient.invalidateQueries({ queryKey: ['unreadCounts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations', channel] });
      if (channel === 'call') {
        queryClient.invalidateQueries({ queryKey: ['callHistory'] });
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, [queryClient]);

  // Increment a specific channel count (for real-time WebSocket updates)
  const incrementCount = useCallback((channel) => {
    queryClient.setQueryData(['unreadCounts'], (old) => {
      if (!old) return { sms: 0, whatsapp: 0, calls: 0, total: 0, [channel]: 1 };
      const updated = { ...old };
      if (channel === 'sms') updated.sms = (updated.sms || 0) + 1;
      else if (channel === 'whatsapp') updated.whatsapp = (updated.whatsapp || 0) + 1;
      else if (channel === 'call' || channel === 'calls') updated.calls = (updated.calls || 0) + 1;
      updated.total = (updated.sms || 0) + (updated.whatsapp || 0) + (updated.calls || 0);
      return updated;
    });
  }, [queryClient]);

  return {
    counts,
    isLoading,
    refetch,
    markAsRead,
    markAllAsRead,
    incrementCount
  };
}
