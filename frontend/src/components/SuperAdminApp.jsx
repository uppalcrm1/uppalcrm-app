import React, { useState, useEffect } from 'react';
import SuperAdminLogin from './SuperAdminLogin';
import SuperAdminDashboard from './SuperAdminDashboard';
import LoadingSpinner from './LoadingSpinner';

const SuperAdminApp = () => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('superAdminToken');
    if (token) {
      fetch('/api/super-admin/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(response => {
        if (response.ok) {
          setAdmin({ token });
        } else {
          localStorage.removeItem('superAdminToken');
        }
      })
      .catch(() => {
        localStorage.removeItem('superAdminToken');
      })
      .finally(() => {
        setLoading(false);
      });
    } else {
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