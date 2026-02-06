const User = require('../models/User');

/**
 * WebSocket authentication middleware
 * Authenticates incoming WebSocket connections using JWT token
 */
const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    // Verify JWT token
    const user = await User.verifyToken(token);
    if (!user) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }

    // Validate user ID and organization ID are valid UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!user.id || typeof user.id !== 'string' || !uuidRegex.test(user.id)) {
      console.error('Invalid user ID in WebSocket token:', {
        userId: user.id,
        email: user.email
      });
      return next(new Error('Authentication error: Invalid user ID'));
    }

    if (!user.organization_id || typeof user.organization_id !== 'string' || !uuidRegex.test(user.organization_id)) {
      console.error('Invalid organization ID in WebSocket token:', {
        organizationId: user.organization_id,
        userId: user.id,
        email: user.email
      });
      return next(new Error('Authentication error: Invalid organization ID'));
    }

    // Attach user context to socket
    socket.userId = user.id;
    socket.organizationId = user.organization_id;
    socket.userEmail = user.email;

    console.log(`✅ WebSocket connected: User ${socket.userEmail} (${socket.userId}) from Org ${socket.organizationId}`);

    next();
  } catch (error) {
    console.error('WebSocket authentication failed:', error);
    next(new Error(`Authentication error: ${error.message}`));
  }
};

module.exports = socketAuth;
