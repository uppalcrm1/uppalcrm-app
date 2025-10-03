import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TrialBanner() {
  const [trialInfo, setTrialInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const navigate = useNavigate();

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004/api';

  useEffect(() => {
    fetchTrialInfo();
  }, []);

  const fetchTrialInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('🔍 TrialBanner: Fetching trial info from:', `${API_BASE_URL}/organizations/current/trial-info`);
      const response = await fetch(`${API_BASE_URL}/organizations/current/trial-info`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 TrialBanner: Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ TrialBanner: Trial info received:', data);
        setTrialInfo(data);
      } else {
        const errorData = await response.json();
        console.error('❌ TrialBanner: Error response:', errorData);
      }
    } catch (error) {
      console.error('❌ TrialBanner: Failed to fetch trial info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show if loading, dismissed, or not in trial
  if (isLoading || isDismissed || !trialInfo?.show_banner) {
    return null;
  }

  const { days_remaining, trial_expires_at, urgency_color } = trialInfo;

  const getBannerColor = () => {
    switch (urgency_color) {
      case 'red':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'yellow':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getIcon = () => {
    switch (urgency_color) {
      case 'red':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'yellow':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      default:
        return <CheckCircle className="h-5 w-5 text-blue-600" />;
    }
  };

  const getMessage = () => {
    if (days_remaining === 0) {
      return 'Your trial expires today!';
    } else if (days_remaining === 1) {
      return 'Your trial expires tomorrow!';
    } else if (days_remaining <= 7) {
      return `Your trial expires in ${days_remaining} days`;
    } else {
      return `Trial active - ${days_remaining} days remaining`;
    }
  };

  const expiryDate = new Date(trial_expires_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className={`relative border-b ${getBannerColor()}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getIcon()}
            <div>
              <p className="font-semibold text-sm">
                {getMessage()}
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                Trial ends on {expiryDate}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/settings/billing')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                urgency_color === 'red'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : urgency_color === 'yellow'
                  ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Upgrade Now
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 hover:bg-black/10 rounded transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
