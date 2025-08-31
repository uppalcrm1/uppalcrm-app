const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = process.env.PORT || 3000;

// Proxy API requests to backend
app.use('/api', createProxyMiddleware({
  target: 'https://uppalcrm-api.onrender.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api'
  }
}));

// Proxy health checks
app.use('/health', createProxyMiddleware({
  target: 'https://uppalcrm-api.onrender.com',
  changeOrigin: true
}));

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle SPA routing - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Frontend server running on port ${port}`);
});