// SessionService - Pure JavaScript service for session management
// No React dependencies - services should be framework-agnostic
/**
 * SessionService - Comprehensive session management for the application
 * Handles user authentication, session persistence, and state management
 */
class SessionService {
  constructor() {
    this.currentSession = null;
    this.listeners = [];
    this.isInitializing = false;
    this.storageKeys = {
      session: 'user_session',
      user: 'current_user',
      token: 'auth_token'
    };
    
    // Initialize on first access instead of constructor
    this._initialized = false;
    this._initializing = false;
  }
  
  // Ensure initialization before any operation
  async _ensureInitialized() {
    if (this._initialized) return;
    if (this._initializing) return;
    
    try {
      this._initializing = true;
      await this.initializeSession();
      this._initialized = true;
    } catch (error) {
      console.error('SessionService: Delayed initialization failed:', error);
      // Set basic fallback state
      this.currentSession = this.createMinimalSession();
      this._initialized = true;
    } finally {
      this._initializing = false;
    }
  }

  /**
   * Initialize session from storage or create new one
   */
  async initializeSession() {
    if (this.isInitializing) return this.currentSession;
    
    this.isInitializing = true;
    
    try {
      console.log('SessionService: Initializing session...');
      
      // Try to recover from storage first
      const storedSession = this.getStoredSession();
      
      if (storedSession && this.validateSessionData(storedSession)) {
        if (!this.isSessionExpired(storedSession)) {
          this.currentSession = storedSession;
          this.refreshSession();
          console.log('SessionService: Session recovered from storage');
        } else {
          console.log('SessionService: Stored session expired, creating new one');
          await this.createGuestSession();
        }
      } else {
        console.log('SessionService: No valid stored session, creating new one');
        await this.createGuestSession();
      }
      
      return this.currentSession;
      
    } catch (error) {
      console.error('SessionService: Error during initialization:', error);
      // Fallback to minimal session without async operations
      try {
        await this.createGuestSession();
      } catch (guestError) {
        console.error('SessionService: Guest session creation failed:', guestError);
        this.currentSession = this.createMinimalSession();
      }
      return this.currentSession;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Validate session data structure and required fields
   * @param {Object} session - Session object to validate
   * @returns {boolean} True if session is valid
   */
  validateSessionData(session) {
    try {
      if (!session || typeof session !== 'object') {
        return false;
      }
      
      // Check required fields
      const requiredFields = ['id', 'createdAt', 'expiresAt', 'user'];
      for (const field of requiredFields) {
        if (!session[field]) {
          console.warn(`SessionService: Missing required field: ${field}`);
          return false;
        }
      }
      
      // Validate user object
      if (!session.user || typeof session.user !== 'object') {
        console.warn('SessionService: Invalid user object');
        return false;
      }
      
      // Validate dates
      if (!this.isValidDate(session.createdAt) || !this.isValidDate(session.expiresAt)) {
        console.warn('SessionService: Invalid date fields');
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.error('SessionService: Error validating session:', error);
      return false;
    }
  }

  /**
   * Check if session has expired
   * @param {Object} session - Session to check
   * @returns {boolean} True if expired
   */
  isSessionExpired(session) {
    try {
      if (!session || !session.expiresAt) {
        return true;
      }
      
      const expiryTime = new Date(session.expiresAt);
      const currentTime = new Date();
      
      return currentTime >= expiryTime;
      
    } catch (error) {
      console.error('SessionService: Error checking expiry:', error);
      return true; // Assume expired on error
    }
  }

  /**
   * Get stored session from localStorage
   * @returns {Object|null} Stored session or null
   */
  getStoredSession() {
    try {
      const sessionData = localStorage.getItem(this.storageKeys.session);
      if (!sessionData) {
        return null;
      }
      
      const session = JSON.parse(sessionData);
      return session;
      
    } catch (error) {
      console.error('SessionService: Error retrieving stored session:', error);
      return null;
    }
  }

  /**
   * Clear stored session data
   */
  clearStoredSession() {
    try {
      Object.values(this.storageKeys).forEach(key => {
        localStorage.removeItem(key);
      });
      console.log('SessionService: Stored session cleared');
    } catch (error) {
      console.error('SessionService: Error clearing stored session:', error);
    }
  }

  /**
   * Validate if a string is a valid date
   * @param {string} dateString - Date string to validate
   * @returns {boolean} True if valid date
   */
  isValidDate(dateString) {
    try {
      const date = new Date(dateString);
      return date instanceof Date && !isNaN(date.getTime());
    } catch {
      return false;
    }
  }

  /**
   * Create a guest session for unauthenticated users
   * @returns {Promise<Object>} Created session
   */
  async createGuestSession() {
    try {
      console.log('SessionService: Creating guest session');
      
      const guestSession = this.createMinimalSession();
      guestSession.user = {
        id: 'guest',
        username: 'Guest User',
        role: 'guest',
        email: null,
        isGuest: true,
        permissions: this.getDefaultPermissions('guest')
      };
      guestSession.isEmergencySession = true;
      
      this.currentSession = guestSession;
      this.storeSession(guestSession);
      
      this.notifyListeners('session_created', { 
        session: guestSession,
        type: 'guest'
      });
      
      console.log('SessionService: Guest session created successfully');
      return guestSession;
      
    } catch (error) {
      console.error('SessionService: Error creating guest session:', error);
      throw error;
    }
  }

  /**
   * Create minimal session structure
   * @returns {Object} Basic session object
   */
  createMinimalSession() {
    const now = new Date();
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + 24); // 24 hour expiry
    
    return {
      id: this.generateSessionId(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiryTime.toISOString(),
      lastActivity: now.toISOString(),
      user: null,
      token: null,
      isEmergencySession: false
    };
  }

  /**
   * Get current active session
   * @returns {Promise<Object|null>} Current session or null
   */
  async getCurrentSession() {
    try {
      // If we have a current session, validate it
      if (this.currentSession) {
        if (this.validateSessionData(this.currentSession) && !this.isSessionExpired(this.currentSession)) {
          // Update last activity
          this.currentSession.lastActivity = new Date().toISOString();
          return this.currentSession;
        } else {
          console.log('SessionService: Current session invalid or expired');
          this.currentSession = null;
        }
      }
      
      // Try to initialize from storage
      await this.initializeSession();
      return this.currentSession;
      
    } catch (error) {
      console.error('SessionService: Critical error in getCurrentSession:', error);
      // Create emergency session as fallback
      try {
        await this.createGuestSession();
        return this.currentSession;
      } catch (fallbackError) {
        console.error('SessionService: Failed to create fallback session:', fallbackError);
        return null;
      }
    }
  }

  /**
   * Update user data in current session
   * @param {Object} userData - User data to update
   * @returns {Promise<Object>} Updated session
   */
  async updateUser(userData) {
    try {
      const session = await this.getCurrentSession();
      if (!session) {
        throw new Error('No active session to update');
      }

      // Update user data
      session.user = {
        ...session.user,
        ...userData
      };
      session.updatedAt = new Date().toISOString();
      session.lastActivity = new Date().toISOString();
      
      // Store updated session
      this.currentSession = session;
      this.storeSession(session);
      
      // Notify listeners
      this.notifyListeners('user_updated', { 
        session: session,
        userData 
      });
      
      console.log('SessionService: User updated successfully');
      return session;

    } catch (error) {
      console.error('SessionService: Error updating user:', error);
      throw error;
    }
  }

  /**
   * Refresh session expiry and activity
   * @param {Object} session - Optional session to refresh
   * @returns {Promise<Object>} Refreshed session
   */
  async refreshSession(session = null) {
    try {
      const sessionToRefresh = session || this.currentSession;
      if (!sessionToRefresh) {
        throw new Error('No session to refresh');
      }

      // Extend expiry by 24 hours
      const newExpiryTime = new Date();
      newExpiryTime.setHours(newExpiryTime.getHours() + 24);
      
      sessionToRefresh.expiresAt = newExpiryTime.toISOString();
      sessionToRefresh.updatedAt = new Date().toISOString();
      sessionToRefresh.lastActivity = new Date().toISOString();
      
      // Store refreshed session
      this.storeSession(sessionToRefresh);
      this.currentSession = sessionToRefresh;
      
      console.log('SessionService: Session refreshed successfully');
      this.notifyListeners('session_refreshed', { session: sessionToRefresh });
      
      return sessionToRefresh;

    } catch (error) {
      console.error('SessionService: Error refreshing session:', error);
      throw error;
    }
  }

  /**
   * Clear current session and storage
   */
  clearSession() {
    try {
      console.log('SessionService: Clearing session');
      
      const oldSession = this.currentSession;
      this.currentSession = null;
      this.clearStoredSession();
      
      this.notifyListeners('session_cleared', { 
        previousSession: oldSession 
      });
      
    } catch (error) {
      console.error('SessionService: Error clearing session:', error);
    }
  }

  /**
   * Store session data to localStorage
   * @param {Object} session - Session to store
   */
  storeSession(session) {
    try {
      if (!session || typeof session !== 'object') {
        console.warn('SessionService: Invalid session provided for storage');
        return;
      }
      
      const sessionData = JSON.stringify(session);
      localStorage.setItem(this.storageKeys.session, sessionData);
      
      // Store user and token separately for easy access
      if (session.user) {
        localStorage.setItem(this.storageKeys.user, JSON.stringify(session.user));
      }
      if (session.token) {
        localStorage.setItem(this.storageKeys.token, session.token);
      }
      
      console.log('SessionService: Session stored successfully');
      
    } catch (error) {
      console.error('SessionService: Error storing session:', error);
      // Don't throw - storage failure shouldn't break the app
    }
  }

  /**
   * Generate unique session ID
   * @returns {string} Unique session ID
   */
  generateSessionId() {
    try {
      const timestamp = Date.now().toString();
      const random = Math.random().toString(36).substring(2, 15);
      const additional = Math.random().toString(36).substring(2, 15);
      return `${timestamp}_${random}_${additional}`;
    } catch (error) {
      console.error('SessionService: Error generating session ID:', error);
      // Fallback to simple timestamp
      return `session_${Date.now()}`;
    }
  }

  /**
   * Add session event listener
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  addListener(callback) {
    try {
      if (typeof callback !== 'function') {
        throw new Error('Callback must be a function');
      }
      
      this.listeners.push(callback);
      console.log('SessionService: Listener added');
      
      // Return unsubscribe function
      return () => this.removeListener(callback);
      
    } catch (error) {
      console.error('SessionService: Error adding listener:', error);
      return () => {}; // Return no-op function
    }
  }

  /**
   * Remove session event listener
   * @param {Function} callback - Callback to remove
   */
  removeListener(callback) {
    try {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
        console.log('SessionService: Listener removed');
      }
    } catch (error) {
      console.error('SessionService: Error removing listener:', error);
    }
  }

  /**
   * Notify all listeners of session events
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  notifyListeners(event, data) {
    try {
      this.listeners.forEach(callback => {
        try {
          callback(event, data);
        } catch (error) {
          console.error('SessionService: Error in listener callback:', error);
        }
      });
    } catch (error) {
      console.error('SessionService: Error notifying listeners:', error);
    }
  }

  /**
   * Get comprehensive session information
   * @returns {Promise<Object>} Session information
   */
  async getSessionInfo() {
    try {
      const current = this.currentSession;
      const stored = this.getStoredSession();
      
      const session = await this.getCurrentSession();
      if (!session) {
        return { 
          status: 'No active session',
          error: 'Failed to retrieve or create session',
          hasCurrentSession: !!current,
          hasStoredSession: !!stored,
          isInitializing: this.isInitializing,
          listenerCount: this.listeners.length
        };
      }

      return {
        status: 'Active',
        user: session.user?.username || 'Unknown',
        role: session.user?.role || 'Unknown',
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        expiresAt: session.expiresAt,
        isExpired: this.isSessionExpired(session),
        isEmergencySession: session.isEmergencySession || false,
        hasCurrentSession: !!current,
        hasStoredSession: !!stored,
        currentSessionValid: current ? this.validateSessionData(current) : false,
        currentSessionExpired: current ? this.isSessionExpired(current) : null,
        storedSessionValid: stored ? this.validateSessionData(stored) : false,
        storedSessionExpired: stored ? this.isSessionExpired(stored) : null,
        isInitializing: this.isInitializing,
        listenerCount: this.listeners.length
      };
    } catch (error) {
      console.error('SessionService: Error getting session info:', error);
      return { status: 'Error', error: error.message };
    }
  }

  /**
   * Get default permissions based on user role
   * @param {string} role - User role
   * @returns {Array} Default permissions
   */
  getDefaultPermissions(role) {
    const permissionSets = {
      admin: [
        'read', 'write', 'delete', 'manage_users', 'manage_products',
        'manage_orders', 'view_analytics', 'manage_payments', 'system_config'
      ],
      manager: [
        'read', 'write', 'manage_products', 'manage_orders', 
        'view_analytics', 'manage_payments'
      ],
      employee: [
        'read', 'write', 'manage_orders', 'process_payments'
      ],
      vendor: [
        'read', 'write', 'manage_own_products', 'view_own_orders'
      ],
      customer: [
        'read', 'place_orders', 'view_own_orders', 'manage_profile'
      ],
      guest: [
        'read', 'browse_products'
      ]
    };
    
    return permissionSets[role] || permissionSets.guest;
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>} True if authenticated
   */
  async isAuthenticated() {
    try {
      const session = await this.getCurrentSession();
      return !!(session && session.user && !session.user.isGuest);
    } catch (error) {
      console.error('SessionService: Error checking authentication:', error);
      return false;
    }
  }

  /**
   * Get current user
   * @returns {Promise<Object|null>} Current user or null
   */
  async getCurrentUser() {
    try {
      const session = await this.getCurrentSession();
      return session?.user || null;
    } catch (error) {
      console.error('SessionService: Error getting current user:', error);
      return null;
    }
  }

  /**
   * Get authentication token
   * @returns {Promise<string|null>} Auth token or null
   */
  async getToken() {
    try {
      const session = await this.getCurrentSession();
      return session?.token || null;
    } catch (error) {
      console.error('SessionService: Error getting token:', error);
      return null;
    }
  }

  /**
   * Create authenticated user session
   * @param {Object} userData - User data
   * @param {string} token - Authentication token
   * @returns {Promise<Object>} Created session
   */
  async createSession(userData, token = null) {
    try {
      console.log('SessionService: Creating authenticated session');
      
      const session = this.createMinimalSession();
      session.user = {
        ...userData,
        permissions: this.getDefaultPermissions(userData.role)
      };
      session.token = token;
      session.isEmergencySession = false;
      
      this.currentSession = session;
      this.storeSession(session);
      
      this.notifyListeners('session_created', { 
        session: session,
        type: 'authenticated'
      });
      
      console.log('SessionService: Authenticated session created successfully');
      return session;
      
    } catch (error) {
      console.error('SessionService: Error creating session:', error);
      throw error;
    }
  }

  /**
   * Validate existing session
   * @param {Object} session - Session to validate
   * @returns {Promise<boolean>} True if valid
*/
  async validateSession(session = null) {
    try {
      const sessionToValidate = session || this.currentSession;
      if (!sessionToValidate) {
        return false;
      }
      
      return this.validateSessionData(sessionToValidate) && !this.isSessionExpired(sessionToValidate);
    } catch (error) {
      console.error('SessionService: Error validating session:', error);
      return false;
    }
  }
}
// SessionService Class Definition
class SessionService {
  constructor() {
    this.currentSession = null;
    this.listeners = [];
    this.initialized = false;
    this.sessionKey = 'freshmart_session';
    this.tokenKey = 'freshmart_token';
    this.init();
  }

  async init() {
    try {
      await this._ensureInitialized();
      this.initialized = true;
    } catch (error) {
      console.error('SessionService initialization failed:', error);
      this.initialized = false;
    }
  }

  async _ensureInitialized() {
    if (this.initialized) return;
    
    try {
      // Initialize session from storage
      const storedSession = this.getStoredSession();
      if (storedSession && this.validateSessionData(storedSession)) {
        if (!this.isSessionExpired(storedSession)) {
          this.currentSession = storedSession;
        } else {
          this.clearStoredSession();
        }
      }
    } catch (error) {
      console.warn('Error during session initialization:', error);
    }
  }

  // Session Management Methods
  async getCurrentSession() {
    await this._ensureInitialized();
    
    if (!this.currentSession) {
      // Try to restore from storage
      const storedSession = this.getStoredSession();
      if (storedSession && this.validateSessionData(storedSession)) {
        if (!this.isSessionExpired(storedSession)) {
          this.currentSession = storedSession;
        } else {
          this.clearStoredSession();
          return null;
        }
      } else {
        // Create guest session as fallback
        return await this.createGuestSession();
      }
    }
    
    return this.currentSession;
  }

  async createSession(userData, token = null) {
    try {
      const sessionId = this.generateSessionId();
      const now = new Date().toISOString();
      
      const session = {
        sessionId,
        user: {
          ...userData,
          id: userData.id || sessionId,
          role: userData.role || 'user'
        },
        token,
        createdAt: now,
        lastActivity: now,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        isGuest: false,
        permissions: this.getDefaultPermissions(userData.role || 'user')
      };

      this.currentSession = session;
      this.storeSession(session);
      this.notifyListeners('session_created', session);
      
      return session;
    } catch (error) {
      console.error('Failed to create session:', error);
      return null;
    }
  }

  async createGuestSession() {
    try {
      const sessionId = 'guest_' + this.generateSessionId();
      const now = new Date().toISOString();
      
      const guestSession = {
        sessionId,
        user: {
          id: sessionId,
          name: 'Guest User',
          email: null,
          role: 'guest',
          isGuest: true
        },
        token: null,
        createdAt: now,
        lastActivity: now,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours for guest
        isGuest: true,
        isMinimalSession: true,
        permissions: this.getDefaultPermissions('guest')
      };

      this.currentSession = guestSession;
      // Don't store guest sessions permanently
      this.notifyListeners('guest_session_created', guestSession);
      
      return guestSession;
    } catch (error) {
      console.error('Failed to create guest session:', error);
      return null;
    }
  }

  async validateSession(session = null) {
    const sessionToValidate = session || this.currentSession;
    
    if (!sessionToValidate) {
      return false;
    }

    // Basic validation
    if (!this.validateSessionData(sessionToValidate)) {
      return false;
    }

    // Check expiration
    if (this.isSessionExpired(sessionToValidate)) {
      if (sessionToValidate === this.currentSession) {
        await this.clearSession();
      }
      return false;
    }

    // Update last activity if it's current session
    if (sessionToValidate === this.currentSession) {
      sessionToValidate.lastActivity = new Date().toISOString();
      this.storeSession(sessionToValidate);
    }

    return true;
  }

  validateSessionData(session) {
    return !!(
      session &&
      typeof session === 'object' &&
      session.sessionId &&
      session.user &&
      session.user.id &&
      session.createdAt &&
      this.isValidDate(session.createdAt)
    );
  }

  isSessionExpired(session) {
    if (!session || !session.expiresAt) return true;
    return new Date() > new Date(session.expiresAt);
  }

  async isAuthenticated() {
    const session = await this.getCurrentSession();
    return session && !session.isGuest && await this.validateSession(session);
  }

  async getCurrentUser() {
    const session = await this.getCurrentSession();
    return session ? session.user : null;
  }

  async getToken() {
    const session = await this.getCurrentSession();
    return session ? session.token : null;
  }

  clearSession() {
    const oldSession = this.currentSession;
    this.currentSession = null;
    this.clearStoredSession();
    
    if (oldSession) {
      this.notifyListeners('session_cleared', oldSession);
    }
  }

  async refreshSession(session = null) {
    const sessionToRefresh = session || this.currentSession;
    
    if (!sessionToRefresh || sessionToRefresh.isGuest) {
      return null;
    }

    try {
      // Extend expiration
      const refreshedSession = {
        ...sessionToRefresh,
        lastActivity: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      this.currentSession = refreshedSession;
      this.storeSession(refreshedSession);
      this.notifyListeners('session_refreshed', refreshedSession);
      
      return refreshedSession;
    } catch (error) {
      console.error('Failed to refresh session:', error);
      return null;
    }
  }

  async updateUser(userData) {
    const session = await this.getCurrentSession();
    
    if (!session || session.isGuest) {
      return null;
    }

    try {
      const updatedSession = {
        ...session,
        user: { ...session.user, ...userData },
        lastActivity: new Date().toISOString()
      };

      this.currentSession = updatedSession;
      this.storeSession(updatedSession);
      this.notifyListeners('user_updated', updatedSession);
      
      return updatedSession;
    } catch (error) {
      console.error('Failed to update user:', error);
      return null;
    }
  }

  async getSessionInfo() {
    const session = await this.getCurrentSession();
    
    if (!session) return null;

    return {
      sessionId: session.sessionId,
      userId: session.user.id,
      userRole: session.user.role,
      isGuest: session.isGuest,
      isAuthenticated: !session.isGuest,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      expiresAt: session.expiresAt,
      permissions: session.permissions || []
    };
  }

  // Storage Methods
  getStoredSession() {
    try {
      const stored = localStorage.getItem(this.sessionKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn('Failed to get stored session:', error);
      return null;
    }
  }

  storeSession(session) {
    try {
      localStorage.setItem(this.sessionKey, JSON.stringify(session));
      if (session.token) {
        localStorage.setItem(this.tokenKey, session.token);
      }
    } catch (error) {
      console.warn('Failed to store session:', error);
    }
  }

  clearStoredSession() {
    try {
      localStorage.removeItem(this.sessionKey);
      localStorage.removeItem(this.tokenKey);
    } catch (error) {
      console.warn('Failed to clear stored session:', error);
    }
  }

  // Utility Methods
  generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  getDefaultPermissions(role) {
    const permissions = {
      guest: ['view_products', 'view_categories'],
      user: ['view_products', 'view_categories', 'place_orders', 'view_orders'],
      admin: ['all'],
      vendor: ['manage_products', 'view_orders', 'update_inventory']
    };

    return permissions[role] || permissions.guest;
  }

  // Event System
  addListener(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.warn('Session listener error:', error);
      }
    });
  }
}

// Create and export singleton instance
let sessionService;
try {
  // Ensure SessionService class is available before instantiation
  if (typeof SessionService === 'function') {
    sessionService = new SessionService();
  } else {
    throw new Error('SessionService class not properly defined');
  }
} catch (error) {
  console.error('Failed to initialize SessionService:', error);
  
  // Create a comprehensive fallback service to prevent app crashes
  sessionService = {
    async getCurrentSession() { 
      console.warn('SessionService fallback: getCurrentSession called');
      return {
        sessionId: 'fallback-' + Date.now(),
        user: { isGuest: true, role: 'guest', id: 'fallback-user' },
        isGuest: true,
        isMinimalSession: true
      };
    },
    async createSession(userData, token = null) { 
      console.warn('SessionService fallback: createSession called');
      return null; 
    },
    async createGuestSession() {
      console.warn('SessionService fallback: createGuestSession called');
      return {
        sessionId: 'fallback-guest-' + Date.now(),
        user: { isGuest: true, role: 'guest', id: 'fallback-guest' },
        isGuest: true,
        isMinimalSession: true
      };
    },
    async validateSession(session = null) { 
      console.warn('SessionService fallback: validateSession called');
      return false; 
    },
    validateSessionData(session) {
      console.warn('SessionService fallback: validateSessionData called');
      return !!(session && session.user);
    },
    async isAuthenticated() { 
      console.warn('SessionService fallback: isAuthenticated called');
      return false; 
    },
    async getCurrentUser() { 
      console.warn('SessionService fallback: getCurrentUser called');
      return { isGuest: true, role: 'guest', id: 'fallback-user' }; 
    },
    async getToken() { 
      console.warn('SessionService fallback: getToken called');
      return null; 
    },
    clearSession() {
      console.warn('SessionService fallback: clearSession called');
    },
    async refreshSession(session = null) { 
      console.warn('SessionService fallback: refreshSession called');
      return null; 
    },
    async updateUser(userData) { 
      console.warn('SessionService fallback: updateUser called');
      return null; 
    },
    async getSessionInfo() { 
      console.warn('SessionService fallback: getSessionInfo called');
      return null; 
    },
    addListener(callback) {
      console.warn('SessionService fallback: addListener called');
    },
    removeListener(callback) {
      console.warn('SessionService fallback: removeListener called');
    },
    notifyListeners(event, data) {
      console.warn('SessionService fallback: notifyListeners called');
    }
  };
}

// Export both the class and instance
export { SessionService };
export default sessionService;