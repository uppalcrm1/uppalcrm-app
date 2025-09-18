const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = process.env.PORT || 3000;

// Determine API target based on environment
const API_TARGET = process.env.VITE_API_URL
  ? process.env.VITE_API_URL.replace('/api', '') // Remove /api suffix if present
  : 'http://localhost:3004';

console.log('🔧 Frontend Server Configuration:', {
  NODE_ENV: process.env.NODE_ENV,
  VITE_API_URL: process.env.VITE_API_URL,
  API_TARGET: API_TARGET,
  PORT: port
});

// Only set up proxy in development or when API_TARGET is localhost
if (API_TARGET.includes('localhost')) {
  console.log('📡 Setting up API proxy to:', API_TARGET);

  // Proxy API requests to backend
  app.use('/api', createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
    pathRewrite: {
      '^/api': '/api'
    }
  }));

  // Proxy health checks
  app.use('/health', createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true
  }));
} else {
  console.log('🌐 Production mode: No proxy needed, frontend will use environment API URL');
}

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle SPA routing - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Frontend server running on port ${port}`);
});