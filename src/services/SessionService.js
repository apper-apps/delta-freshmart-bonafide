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
    
    // Auto-initialize
    this.initializeSession();
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
      // Fallback to guest session
      await this.createGuestSession();
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

// Create service instance
const sessionService = new SessionService();
// SessionService class definition
class SessionService {
  constructor() {
    this.listeners = [];
    this.currentSession = null;
    this.isInitialized = false;
    this.initializeSession();
  }

  async initializeSession() {
    try {
      const storedSession = this.getStoredSession();
      if (storedSession && !this.isSessionExpired(storedSession)) {
        this.currentSession = storedSession;
        this.notifyListeners('sessionRestored', storedSession);
      }
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize session:', error);
      this.isInitialized = true;
    }
  }

  validateSessionData(session) {
    return session && 
           typeof session === 'object' && 
           session.id && 
           session.user && 
           session.createdAt && 
           session.expiresAt;
  }

  isSessionExpired(session) {
    if (!session || !session.expiresAt) return true;
    return new Date() > new Date(session.expiresAt);
  }

  getStoredSession() {
    try {
      const sessionData = localStorage.getItem('session');
      return sessionData ? JSON.parse(sessionData) : null;
    } catch (error) {
      console.error('Error parsing stored session:', error);
      return null;
    }
  }

  clearStoredSession() {
    try {
      localStorage.removeItem('session');
    } catch (error) {
      console.error('Error clearing stored session:', error);
    }
  }

  isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  async createGuestSession() {
    const guestSession = {
      id: this.generateSessionId(),
      user: {
        id: 'guest',
        name: 'Guest User',
        email: null,
        role: 'guest',
        permissions: this.getDefaultPermissions('guest')
      },
      isGuest: true,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };

    this.currentSession = guestSession;
    this.storeSession(guestSession);
    this.notifyListeners('sessionCreated', guestSession);
    return guestSession;
  }

  createMinimalSession() {
    return {
      id: this.generateSessionId(),
      user: null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      isGuest: true
    };
  }

  async getCurrentSession() {
    if (this.currentSession && !this.isSessionExpired(this.currentSession)) {
      return this.currentSession;
    }

    const storedSession = this.getStoredSession();
    if (storedSession && !this.isSessionExpired(storedSession)) {
      this.currentSession = storedSession;
      return storedSession;
    }

    return null;
  }

  async updateUser(userData) {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    this.currentSession.user = { ...this.currentSession.user, ...userData };
    this.storeSession(this.currentSession);
    this.notifyListeners('userUpdated', this.currentSession.user);
    return this.currentSession.user;
  }

  async refreshSession(session = null) {
    const targetSession = session || this.currentSession;
    if (!targetSession) return null;

    const refreshedSession = {
      ...targetSession,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    this.currentSession = refreshedSession;
    this.storeSession(refreshedSession);
    this.notifyListeners('sessionRefreshed', refreshedSession);
    return refreshedSession;
  }

  clearSession() {
    this.currentSession = null;
    this.clearStoredSession();
    this.notifyListeners('sessionCleared', null);
  }

  storeSession(session) {
    try {
      localStorage.setItem('session', JSON.stringify(session));
    } catch (error) {
      console.error('Error storing session:', error);
    }
  }

  generateSessionId() {
    return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

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
        console.error('Error in session listener:', error);
      }
    });
  }

  async getSessionInfo() {
    const session = await this.getCurrentSession();
    if (!session) return null;

    return {
      id: session.id,
      userId: session.user?.id,
      userName: session.user?.name,
      userRole: session.user?.role,
      isGuest: session.isGuest || false,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isExpired: this.isSessionExpired(session)
    };
  }

  getDefaultPermissions(role) {
    const permissions = {
      guest: ['view_products', 'add_to_cart'],
      user: ['view_products', 'add_to_cart', 'place_orders', 'view_orders'],
      admin: ['*']
    };
    return permissions[role] || permissions.guest;
  }

  async isAuthenticated() {
    const session = await this.getCurrentSession();
    return session && !this.isSessionExpired(session);
  }

  async getCurrentUser() {
    const session = await this.getCurrentSession();
    return session?.user || null;
  }

  async getToken() {
    const session = await this.getCurrentSession();
    return session?.token || null;
  }

  async createSession(userData, token = null) {
    const session = {
      id: this.generateSessionId(),
      user: userData,
      token,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      isGuest: false
    };

    this.currentSession = session;
    this.storeSession(session);
    this.notifyListeners('sessionCreated', session);
    return session;
  }

  async validateSession(session = null) {
    const targetSession = session || this.currentSession;
    if (!targetSession) return false;

    if (!this.validateSessionData(targetSession)) return false;
    if (this.isSessionExpired(targetSession)) return false;

    return true;
  }
}

// Create a singleton instance of SessionService
const sessionService = new SessionService();

// Export individual methods for backward compatibility
export const {
  validateSession,
  createSession,
  getCurrentSession,
  getCurrentUser,
  getToken,
  updateUser,
  clearSession,
  isAuthenticated,
  addListener,
  removeListener,
  getSessionInfo,
  createGuestSession
} = sessionService;

// Export service instance as default
export default sessionService;