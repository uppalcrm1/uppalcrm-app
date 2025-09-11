import React, { useState, useEffect } from 'react';
import SuperAdminLogin from './SuperAdminLogin';
import SuperAdminDashboard from './SuperAdminDashboard';
import LoadingSpinner from './LoadingSpinner';

const SuperAdminApp = () => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('superAdminToken');
    console.log('🔑 SuperAdminApp token check:', token ? `${token.substring(0, 20)}...` : 'null');
    
    if (token) {
      console.log('🔄 Validating token with dashboard API...');
      fetch('/api/super-admin/dashboard', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      .then(response => {
        console.log('📡 Token validation response:', response.status);
        if (response.ok) {
          console.log('✅ Token is valid, setting admin state');
          setAdmin({ token });
        } else {
          console.error('❌ Token validation failed, removing token');
          localStorage.removeItem('superAdminToken');
        }
      })
      .catch((error) => {
        console.error('❌ Token validation error:', error);
        localStorage.removeItem('superAdminToken');
      })
      .finally(() => {
        setLoading(false);
      });
    } else {
      console.log('ℹ️ No token found, showing login');
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner className="w-12 h-12 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return !admin ? <SuperAdminLogin onLogin={setAdmin} /> : <SuperAdminDashboard />;
};

export default SuperAdminApp;