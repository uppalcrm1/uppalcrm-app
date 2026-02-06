/**
 * WebSocket Service
 * Singleton service for managing real-time notifications
 */
class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // Maps userId to socket.id
  }

  /**
   * Initialize WebSocket service with Socket.IO instance
   */
  initialize(io) {
    this.io = io;
    console.log('✅ WebSocket service initialized');
  }

  /**
   * Register a connected user
   */
  registerUser(userId, socketId) {
    this.connectedUsers.set(userId, socketId);
  }

  /**
   * Unregister a disconnected user
   */
  unregisterUser(userId) {
    this.connectedUsers.delete(userId);
  }

  /**
   * Emit incoming call notification to organization room
   */
  emitIncomingCall(organizationId, callData) {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return;
    }

    const room = `org:${organizationId}`;
    const event = {
      callSid: callData.callSid,
      from: callData.from,
      to: callData.to,
      callerName: callData.callerName || null,
      leadId: callData.leadId || null,
      contactId: callData.contactId || null,
      timestamp: new Date().toISOString()
    };

    console.log(`📞 Emitting incoming call to ${room}:`, event);
    this.io.to(room).emit('incoming-call', event);
  }

  /**
   * Emit incoming SMS notification to organization room
   */
  emitIncomingSMS(organizationId, smsData) {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return;
    }

    const room = `org:${organizationId}`;
    const event = {
      messageSid: smsData.messageSid,
      from: smsData.from,
      to: smsData.to,
      body: this.sanitizeText(smsData.body),
      contactName: smsData.contactName || null,
      leadId: smsData.leadId || null,
      contactId: smsData.contactId || null,
      timestamp: new Date().toISOString()
    };

    console.log(`💬 Emitting incoming SMS to ${room}:`, { ...event, body: event.body.substring(0, 50) + '...' });
    this.io.to(room).emit('incoming-sms', event);
  }

  /**
   * Emit call accepted notification to organization room
   */
  emitCallAccepted(organizationId, callSid, userId) {
    if (!this.io) {
      console.warn('WebSocket service not initialized');
      return;
    }

    const room = `org:${organizationId}`;
    const event = {
      callSid,
      acceptedBy: userId,
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Emitting call accepted to ${room}:`, event);
    this.io.to(room).emit('call-accepted', event);
  }

  /**
   * Sanitize text to prevent XSS
   */
  sanitizeText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId) {
    return this.connectedUsers.has(userId);
  }
}

// Singleton instance
const websocketService = new WebSocketService();

module.exports = websocketService;
