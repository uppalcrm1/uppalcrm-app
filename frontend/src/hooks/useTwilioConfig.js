import { useQuery } from '@tanstack/react-query';
import { twilioAPI } from '../services/api';

/**
 * Custom hook to fetch and cache Twilio configuration
 * Provides access to whatsapp_enabled and other config settings
 */
export const useTwilioConfig = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['twilioConfig'],
    queryFn: twilioAPI.getConfig,
    // Cache for 5 minutes, refetch on window focus
    staleTime: 300000,
    gcTime: 600000,
  });

  return {
    config: data?.config,
    isConfigured: data?.configured ?? false,
    whatsappEnabled: data?.config?.whatsapp_enabled ?? false,
    isLoading,
    error,
  };
};
