class WebSocketService {
  constructor() {
    this.connection = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isConnecting = false;
    this.heartbeatInterval = null;
    this.lastHeartbeat = null;
  }

// Initialize WebSocket connection
  async connect(url = 'ws://localhost:8080/api/ws') {
    if (this.isConnecting || (this.connection && this.connection.readyState === WebSocket.OPEN)) {
      return this.getConnectionStatus();
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        // For demo purposes, simulate WebSocket connection
        // In production, this would be a real WebSocket connection to your Node.js backend
        this.connection = this.createMockWebSocket();
        
        this.connection.onopen = () => {
          console.log('WebSocket connected successfully');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          
          // Notify listeners of connection status
          this.notifyListeners('connection_status', { connected: true, timestamp: new Date().toISOString() });
          
          resolve(this.getConnectionStatus());
        };

        this.connection.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.connection.onclose = (event) => {
          console.log('WebSocket connection closed:', event.code, event.reason);
          this.isConnecting = false;
          this.stopHeartbeat();
          
          // Notify listeners of disconnection
          this.notifyListeners('connection_status', { connected: false, timestamp: new Date().toISOString() });
          
          // Attempt reconnection if not intentionally closed
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };
this.connection.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          
          // Safely serialize error object to prevent DataCloneError
          const safeErrorData = this.serializeErrorSafely(error);
          this.notifyListeners('connection_error', { 
            error: safeErrorData, 
            timestamp: new Date().toISOString() 
          });
          
          // Reject with safe error object
          reject(this.serializeErrorSafely(error));
        };

} catch (error) {
        this.isConnecting = false;
        reject(this.serializeErrorSafely(error));
      }
    });
  }

  // Create mock WebSocket for demo purposes
  createMockWebSocket() {
    const mockWS = {
      readyState: 1, // OPEN
      send: (data) => {
        console.log('Sending WebSocket message:', data);
      },
      close: () => {
        console.log('Closing mock WebSocket');
        if (mockWS.onclose) {
          mockWS.onclose({ code: 1000, reason: 'Normal closure' });
        }
      }
    };

    // Simulate connection opening
    setTimeout(() => {
      if (mockWS.onopen) {
        mockWS.onopen();
      }
    }, 100);

    // Simulate periodic messages for demo
    this.startMockMessages(mockWS);

    return mockWS;
  }

// Enhanced mock message simulation with payment flow updates
  startMockMessages(mockWS) {
    const messageTypes = [
      'approval_request_submitted',
      'approval_status_changed',
      'approval_comment_added',
      'price-approvals',
      'payment_flow_update',
      'vendor_payment_processed',
      'admin_payment_confirmed',
      'payment_proof_uploaded',
      'amount_auto_matched',
      'vendor_payment_confirmed',
      'system_notification'
    ];

    setInterval(() => {
      if (mockWS.readyState === 1 && Math.random() > 0.7) {
        const messageType = messageTypes[Math.floor(Math.random() * messageTypes.length)];
        const mockMessage = this.generateMockMessage(messageType);
        
        if (mockWS.onmessage) {
          mockWS.onmessage({ data: JSON.stringify(mockMessage) });
        }
      }
    }, 15000); // Every 15 seconds
  }

// Enhanced mock message generation with payment flow updates
  generateMockMessage(type) {
    const baseMessage = {
      id: `msg_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type
    };

    switch (type) {
      case 'approval_request_submitted':
        return {
          ...baseMessage,
          data: {
            requestId: Math.floor(Math.random() * 1000) + 100,
            title: 'New approval request submitted',
            submittedBy: 'vendor_user',
            priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
          }
        };

      case 'approval_status_changed':
        return {
          ...baseMessage,
          data: {
requestId: Math.floor(Math.random() * 10) + 1,
            status: ['approved', 'rejected'][Math.floor(Math.random() * 2)],
            actionBy: 'admin_user'
          }
        };
      case 'price-approvals':
        return {
          ...baseMessage,
          data: {
            orderId: Math.floor(Math.random() * 100) + 1,
            requestId: Math.floor(Math.random() * 1000) + 100,
            status: ['approved', 'pending', 'rejected'][Math.floor(Math.random() * 3)],
            approvedBy: 'price_admin',
            priceChange: Math.floor(Math.random() * 1000) + 100,
            comments: 'Price approval processed automatically'
          }
        };

      // Enhanced Payment Flow Messages
      case 'payment_flow_update':
        return {
          ...baseMessage,
          data: {
            orderId: Math.floor(Math.random() * 100) + 1,
            flowStage: ['vendor_processed', 'admin_paid', 'proof_uploaded', 'amount_matched', 'vendor_confirmed'][Math.floor(Math.random() * 5)],
            amount: Math.floor(Math.random() * 5000) + 500,
            vendor: 'Fresh Foods Co.',
            status: 'updated'
          }
        };

      case 'vendor_payment_processed':
        return {
          ...baseMessage,
          data: {
            orderId: Math.floor(Math.random() * 100) + 1,
            vendorId: Math.floor(Math.random() * 3) + 1,
            amount: Math.floor(Math.random() * 5000) + 500,
            paymentMethod: ['jazzcash', 'easypaisa', 'bank'][Math.floor(Math.random() * 3)],
            timestamp: new Date().toISOString(),
            status: 'processed'
          }
        };

      case 'admin_payment_confirmed':
        return {
          ...baseMessage,
          data: {
            orderId: Math.floor(Math.random() * 100) + 1,
            adminId: 'admin_1',
            amount: Math.floor(Math.random() * 5000) + 500,
            proofUploaded: true,
            timestamp: new Date().toISOString(),
            status: 'confirmed'
          }
        };

      case 'payment_proof_uploaded':
        return {
          ...baseMessage,
          data: {
            orderId: Math.floor(Math.random() * 100) + 1,
            fileName: 'payment_proof_' + Date.now() + '.jpg',
            uploadedBy: 'admin_1',
            timestamp: new Date().toISOString(),
            status: 'uploaded'
          }
        };

      case 'amount_auto_matched':
        return {
          ...baseMessage,
          data: {
            orderId: Math.floor(Math.random() * 100) + 1,
            vendorAmount: Math.floor(Math.random() * 5000) + 500,
            adminAmount: Math.floor(Math.random() * 5000) + 500,
            matched: true,
            tolerance: 0.01,
            timestamp: new Date().toISOString()
          }
        };

      case 'vendor_payment_confirmed':
        return {
          ...baseMessage,
          data: {
            orderId: Math.floor(Math.random() * 100) + 1,
            vendorId: Math.floor(Math.random() * 3) + 1,
            confirmationMethod: 'receipt_verification',
            timestamp: new Date().toISOString(),
            status: 'confirmed'
          }
        };

      case 'approval_comment_added':
        return {
          ...baseMessage,
          data: {
            requestId: Math.floor(Math.random() * 10) + 1,
            commentBy: 'reviewer_user',
            preview: 'New comment added to approval request'
          }
        };

      case 'system_notification':
        return {
          ...baseMessage,
          data: {
            message: 'System maintenance scheduled for tonight',
            severity: 'info'
          }
        };

      default:
        return baseMessage;
    }
  }

  // Handle incoming WebSocket messages
  handleMessage(message) {
    console.log('Received WebSocket message:', message);

    // Route message to appropriate listeners
    const { type, data } = message;
    
    // Update last heartbeat if it's a heartbeat message
    if (type === 'heartbeat') {
      this.lastHeartbeat = new Date().toISOString();
      return;
    }

    // Notify all listeners
    this.notifyListeners(type, data);
    
    // Notify generic message listeners
    this.notifyListeners('message', message);
  }

  // Subscribe to specific message types
  subscribe(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType).add(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(eventType);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(eventType);
        }
      }
    };
  }

  // Notify listeners of specific event type
  notifyListeners(eventType, data) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket listener for ${eventType}:`, error);
        }
      });
    }
  }

  // Send message through WebSocket
  send(message) {
    if (this.connection && this.connection.readyState === WebSocket.OPEN) {
      const messageString = typeof message === 'string' ? message : JSON.stringify(message);
      this.connection.send(messageString);
      return true;
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
      return false;
    }
  }

  // Send heartbeat to maintain connection
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.connection && this.connection.readyState === WebSocket.OPEN) {
        this.send({ type: 'heartbeat', timestamp: new Date().toISOString() });
      }
    }, 30000); // Every 30 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Schedule reconnection attempt
  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`Scheduling WebSocket reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect().catch(error => {
          console.error('Reconnection attempt failed:', error);
        });
      } else {
console.error('Max reconnection attempts reached, giving up');
        this.notifyListeners('connection_failed', {
          reason: 'Max reconnection attempts exceeded',
          attempts: this.reconnectAttempts 
        });
      }
    }, delay);
  }

// Safe error serialization to prevent DataCloneError
  serializeErrorSafely(error) {
    if (!error) return 'Unknown error';
    
    try {
      // Handle different error types
      if (error instanceof Error) {
        return {
          name: error.name,
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        };
      }
      
      // Handle URL objects that can't be cloned
      if (error instanceof URL) {
        return {
          type: 'URL',
          href: error.href,
          origin: error.origin,
          pathname: error.pathname,
          timestamp: new Date().toISOString()
        };
      }
      
      // Handle DOM events or other non-serializable objects
      if (error.target && error.type) {
        return {
          type: 'Event',
          eventType: error.type,
          target: error.target.constructor.name,
          timestamp: new Date().toISOString()
        };
      }
      
      // Handle objects with non-serializable properties
      if (typeof error === 'object') {
        const serialized = {};
        for (const key in error) {
          try {
            const value = error[key];
            
// Skip functions and non-serializable objects
            if (typeof value === 'function') continue;
            
            // Skip DOM nodes
            if (value instanceof Node) continue;
            
            // Try to serialize the value
            JSON.stringify(value);
            serialized[key] = value;
          } catch (serializationError) {
            serialized[key] = String(error[key]);
          }
        }
        
        serialized.timestamp = new Date().toISOString();
        return serialized;
      }
      
      // For non-objects, return as string
      return String(error);
    } catch (error) {
      return 'Serialization failed: ' + String(error);
    }
  }
  // Safe message serialization to prevent DataCloneError
  serializeMessageSafely(message) {
    if (!message) return null;
    
    try {
      // Handle primitive types
      if (typeof message !== 'object' || message === null) {
        return message;
      }
      
      // Handle URL objects specifically - convert to plain object
      if (message instanceof URL) {
        return {
          type: 'URL',
          href: message.href,
          origin: message.origin,
          pathname: message.pathname,
          search: message.search,
          hash: message.hash,
          protocol: message.protocol,
          hostname: message.hostname,
          port: message.port
        };
      }
      
      // Handle Date objects
      if (message instanceof Date) {
        return {
          type: 'Date',
          value: message.toISOString()
        };
      }
      
      // Handle Error objects
      if (message instanceof Error) {
        return this.serializeErrorSafely(message);
      }
      
      // Handle arrays
      if (Array.isArray(message)) {
        return message.map(item => this.serializeMessageSafely(item));
      }
      
      // Handle plain objects
      const serialized = {};
      for (const key in message) {
        if (message.hasOwnProperty(key)) {
          try {
            const value = message[key];
            
            // Skip functions
            if (typeof value === 'function') {
              serialized[key] = '[Function]';
              continue;
            }
            
            // Skip DOM nodes
            if (value instanceof Node) {
              serialized[key] = `[${value.constructor.name}]`;
              continue;
            }
            
            // Skip Window objects
            if (typeof Window !== 'undefined' && value instanceof Window) {
              serialized[key] = `[${value.constructor.name}]`;
              continue;
            }
            
            // Handle URL objects
            if (value instanceof URL) {
              serialized[key] = {
                type: 'URL',
                href: value.href,
                origin: value.origin,
                pathname: value.pathname,
                search: value.search,
                hash: value.hash,
                protocol: value.protocol,
                hostname: value.hostname,
                port: value.port
              };
              continue;
            }
            
            // Handle nested objects recursively
            if (typeof value === 'object' && value !== null) {
              serialized[key] = this.serializeMessageSafely(value);
            } else {
              serialized[key] = value;
            }
          } catch (serializationError) {
            serialized[key] = String(message[key]);
          }
        }
      }
      
      return serialized;
    } catch (error) {
      return String(message);
    }
  }
  
  // Disconnect WebSocket
  disconnect() {
    if (this.connection) {
      this.stopHeartbeat();
      this.connection.close(1000, 'Client initiated disconnect');
      this.connection = null;
    }
    
    // Clear all listeners
    this.listeners.clear();
    this.reconnectAttempts = 0;
  }
  
  // Get connection status
  getConnectionStatus() {
    // Check if we're in a browser environment and WebSocket is available
    const isWebSocketAvailable = typeof WebSocket !== 'undefined';
    
    return {
      connected: isWebSocketAvailable && this.connection && this.connection.readyState === 1, // 1 = OPEN
      connecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      lastHeartbeat: this.lastHeartbeat,
      listenersCount: Array.from(this.listeners.values()).reduce((sum, set) => sum + set.size, 0),
      webSocketAvailable: isWebSocketAvailable
    };
  }
  
  // Enhanced methods for approval workflow and payment flow
  subscribeToApprovalUpdates(callback) {
    const unsubscribers = [
      this.subscribe('approval_request_submitted', callback),
      this.subscribe('approval_status_changed', callback),
      this.subscribe('approval_comment_added', callback),
      this.subscribe('price-approvals', callback)
    ];
    
    // Return function to unsubscribe from all approval events
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }
  
  // Enhanced payment flow subscription
  subscribeToPaymentFlowUpdates(callback) {
    const unsubscribers = [
      this.subscribe('payment_flow_update', callback),
      this.subscribe('vendor_payment_processed', callback),
      this.subscribe('admin_payment_confirmed', callback),
      this.subscribe('payment_proof_uploaded', callback),
      this.subscribe('amount_auto_matched', callback),
      this.subscribe('vendor_payment_confirmed', callback)
    ];
    
    // Return function to unsubscribe from all payment flow events
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }
  
  // Price approval specific subscription
  subscribeToPriceApprovals(callback) {
    return this.subscribe('price-approvals', callback);
  }
  
  // Send approval-specific messages
  sendApprovalMessage(type, data) {
    return this.send({
      type: `approval_${type}`,
      data,
      timestamp: new Date().toISOString()
    });
  }
  
  // Send payment flow messages
  sendPaymentFlowMessage(type, data) {
    return this.send({
      type: `payment_${type}`,
      data,
      timestamp: new Date().toISOString()
    });
  }
}

// Create singleton instance
export const webSocketService = new WebSocketService();

// Auto-connect on module load (with error handling)
webSocketService.connect().catch(error => {
  console.warn('Initial WebSocket connection failed, will retry:', error.message);
});

export default webSocketService;