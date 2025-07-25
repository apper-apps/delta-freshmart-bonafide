class SessionService {
constructor() {
    this.currentSession = null;
    this.listeners = new Set();
    this.isInitializing = false;
    this.initializationPromise = null;
    this.storageKey = 'freshmart_session';
    this.userKey = 'freshmart_user';
    this.tokenKey = 'freshmart_token';
    this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
    
    // Initialize session on service creation
    if (typeof window !== 'undefined') {
      this.initializationPromise = this.initializeSession();
    }
  }

  // Enhanced session initialization with automatic fallback
  async initializeSession() {
    if (this.isInitializing) {
      return this.initializationPromise || Promise.resolve(this.currentSession);
    }

    try {
      this.isInitializing = true;
      
      // Try to restore from storage first
      const stored = this.getStoredSession();
      if (stored && this.validateSessionData(stored) && !this.isSessionExpired(stored)) {
        this.currentSession = stored;
        console.log('SessionService: Restored session from storage');
        this.notifyListeners('session_restored', this.currentSession);
        return this.currentSession;
      }

      // If no valid stored session, create guest session automatically
      console.log('SessionService: No valid stored session found, creating guest session');
      const guestSession = await this.createGuestSession();
      this.currentSession = guestSession;
      this.notifyListeners('session_created', this.currentSession);
      return this.currentSession;

    } catch (error) {
      console.error('SessionService: Failed to initialize session:', error);
      
      // Emergency fallback - create minimal guest session
      try {
        const emergencySession = {
          id: `emergency_${Date.now()}`,
          sessionId: `emergency_${Math.random().toString(36).substr(2, 9)}`,
          user: {
            id: 'guest',
            username: 'guest',
            role: 'guest',
            name: 'Guest User',
            isGuest: true
          },
          token: null,
          isAuthenticated: false,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          isGuest: true
        };
        
        this.currentSession = emergencySession;
        console.log('SessionService: Created emergency guest session');
        return this.currentSession;
      } catch (emergencyError) {
        console.error('SessionService: Failed to create emergency session:', emergencyError);
        throw new Error('Failed to initialize any session');
      }
    } finally {
      this.isInitializing = false;
    }
  }

  // Enhanced session validation with automatic recovery
  async validateSession(session = null) {
    try {
      // Ensure we have a session to validate
      const sessionToValidate = session || this.currentSession || await this.getCurrentSession();
      
      if (!sessionToValidate) {
        console.log('SessionService: No session to validate, creating guest session');
        const guestSession = await this.createGuestSession();
        this.currentSession = guestSession;
        return {
          isValid: true,
          session: this.currentSession,
          reason: 'guest_session_created'
        };
      }

      // Validate session structure
      if (!this.validateSessionData(sessionToValidate)) {
        console.warn('SessionService: Invalid session structure, recovering...');
        return await this.recoverFromInvalidSession('invalid_structure');
      }

      // Check if session is expired
      if (this.isSessionExpired(sessionToValidate)) {
        console.warn('SessionService: Session expired, recovering...');
        return await this.recoverFromInvalidSession('expired');
      }

      // Session is valid
      this.currentSession = sessionToValidate;
      return {
        isValid: true,
        session: sessionToValidate,
        reason: 'valid'
      };

    } catch (error) {
      console.error('SessionService: Session validation error:', error);
      
      // Attempt recovery
      try {
        const recoveredSession = await this.recoverFromInvalidSession('validation_error');
        return recoveredSession;
      } catch (recoveryError) {
        console.error('SessionService: Session recovery failed:', recoveryError);
        throw new Error(`Session validation failed: ${error.message}`);
      }
    }
  }

  // Session recovery helper
  async recoverFromInvalidSession(reason) {
    try {
      console.log(`SessionService: Recovering from invalid session (${reason})`);
      
      // Clear invalid session
      this.clearSession();
      
      // Create new guest session
      const guestSession = await this.createGuestSession();
      this.currentSession = guestSession;
      
      this.notifyListeners('session_recovered', {
        reason,
        newSession: this.currentSession
      });

      return {
        isValid: true,
        session: this.currentSession,
        reason: `recovered_${reason}`,
        recovered: true
      };
    } catch (error) {
      console.error('SessionService: Session recovery failed:', error);
      throw error;
    }
  }

/**
   * Get current session with comprehensive error handling and automatic recovery
   * @returns {Object} Current session object
   */
  async getCurrentSession() {
    try {
      console.log('SessionService: Getting current session...');
      
      // Enhanced current session validation
      if (this.currentSession && typeof this.currentSession === 'object' && this.currentSession !== null) {
        console.log('SessionService: Found current session in memory');
        
        // Validate current session before returning
        if (this.validateSessionData(this.currentSession) && !this.isSessionExpired(this.currentSession)) {
          console.log('SessionService: Current session is valid');
          return this.currentSession;
        } else {
          console.log('SessionService: Current session in memory is invalid or expired, clearing...');
          this.currentSession = null;
        }
      }

      // Wait for initialization if in progress
      if (this.isInitializing && this.initializationPromise) {
        console.log('SessionService: Waiting for initialization to complete');
        return await this.initializationPromise;
      }

      // Try to load from storage with enhanced validation
      console.log('SessionService: Attempting to load session from storage...');
      const storedSession = this.getStoredSession();
      
      if (storedSession && typeof storedSession === 'object' && storedSession !== null) {
        console.log('SessionService: Found stored session, validating...');
        
        if (this.validateSessionData(storedSession) && !this.isSessionExpired(storedSession)) {
          console.log('SessionService: Stored session is valid, restoring to memory');
          this.currentSession = storedSession;
          return storedSession;
        } else {
          console.log('SessionService: Stored session is invalid or expired, clearing storage...');
          this.clearStoredSession();
        }
      } else {
        console.log('SessionService: No stored session found or session is invalid');
      }

      // Create guest session as fallback if no valid session exists
      console.log('SessionService: No valid session found, attempting to create guest session...');
      try {
        const guestSession = await this.createGuestSession();
        if (guestSession && typeof guestSession === 'object') {
          console.log('SessionService: Guest session created successfully');
          this.currentSession = guestSession;
          this.storeSession(guestSession);
          this.notifyListeners('session_created', { session: guestSession });
          return guestSession;
        } else {
          console.error('SessionService: Guest session creation returned invalid result');
          throw new Error('Guest session creation failed');
        }
      } catch (guestError) {
        console.error('SessionService: Failed to create guest session:', guestError);
        // Try minimal session as last resort
        const minimalSession = this.createMinimalSession();
        this.currentSession = minimalSession;
        this.storeSession(minimalSession);
        return minimalSession;
      }
    } catch (error) {
      console.error('SessionService: Critical error in getCurrentSession:', error);
      
      // Clear potentially corrupted session data
      try {
        this.currentSession = null;
        this.clearStoredSession();
        console.log('SessionService: Cleared corrupted session data');
      } catch (clearError) {
        console.error('SessionService: Failed to clear corrupted session:', clearError);
      }
      
      // Create emergency session to prevent application crashes
      const emergencySession = this.createMinimalSession();
      this.currentSession = emergencySession;
      console.warn('SessionService: Created emergency session to prevent app crash');
      return emergencySession;
    }
  }

  /**
   * Update the current user's information
   * @param {Object} userData - User data to update
   * @returns {Object} Updated session
   */
  async updateUser(userData) {
    try {
      if (!this.currentSession) {
        throw new Error('No active session to update');
      }

      // Update user data
      this.currentSession.user = {
        ...this.currentSession.user,
        ...userData
      };
      this.currentSession.updatedAt = new Date().toISOString();
      
      // Store updated session
      this.storeSession(this.currentSession);
      
      // Notify listeners
      this.notifyListeners('user_updated', { 
        session: this.currentSession,
        userData 
      });
      
      console.log('SessionService: User updated successfully');
      return this.currentSession;

    } catch (error) {
      console.error('SessionService: Error updating user:', error);
      throw error;
    }
  }

  /**
   * Refresh session and extend expiry
   * @param {Object} session - Session to refresh (optional)
   * @returns {Object} Refreshed session
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
   * Store session in localStorage with error handling
   * @param {Object} session - Session to store
   */
  storeSession(session) {
    try {
      if (!session || typeof session !== 'object') {
        console.warn('SessionService: Invalid session provided for storage');
        return;
      }
      
      const sessionData = JSON.stringify(session);
      localStorage.setItem('user_session', sessionData);
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
   * Add event listener for session events
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
   * Remove event listener
   * @param {Function} callback - Callback function to remove
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
   * @param {string} event - Event name
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
   * Get session information for debugging
   * @returns {Object} Session info
   */
  async getSessionInfo() {
    try {
      const current = this.currentSession;
      const stored = this.getStoredSession();
      
      return {
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
      return { error: error.message };
    }
  }
/**
   * Update session user data
   * @param {Object} userData - Updated user data
   */
  async updateUser(userData) {
    try {
      const session = await this.getCurrentSession();
      if (!session) {
        throw new Error('No active session to update');
      }

      session.user = { ...session.user, ...userData };
      session.lastActivity = new Date().toISOString();
      
      this.currentSession = session;
      this.storeSession(session);
      this.notifyListeners('user_updated', session);
    } catch (error) {
      console.error('SessionService: Failed to update user:', error);
      throw error;
    }
  }

  /**
   * Refresh session activity timestamp
   * @param {Object} session - Session to refresh
   */
  async refreshSession(session = null) {
    try {
      const currentSession = session || await this.getCurrentSession();
      if (!currentSession) return;

      currentSession.lastActivity = new Date().toISOString();
      this.currentSession = currentSession;
      this.storeSession(currentSession);
    } catch (error) {
      console.error('SessionService: Failed to refresh session:', error);
    }
  }

  /**
   * Clear current session
   */
  clearSession() {
    try {
      const wasLoggedIn = !!this.currentSession;
      
      this.currentSession = null;
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.userKey);
      localStorage.removeItem(this.tokenKey);
      
      if (wasLoggedIn) {
        this.notifyListeners('session_cleared', null);
      }
    } catch (error) {
      console.error('SessionService: Failed to clear session:', error);
    }
  }

  /**
   * Store session in localStorage
   * @param {Object} session - Session to store
   */
  storeSession(session) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(session));
      localStorage.setItem(this.userKey, JSON.stringify(session.user));
      if (session.token) {
        localStorage.setItem(this.tokenKey, session.token);
      }
    } catch (error) {
      console.error('SessionService: Failed to store session:', error);
    }
  }

  /**
   * Generate unique session ID
   * @returns {string} Generated session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add session state change listener
   * @param {Function} callback - Callback function
   */
  addListener(callback) {
    if (typeof callback === 'function') {
      this.listeners.add(callback);
    }
  }

  /**
   * Remove session state change listener
   * @param {Function} callback - Callback function to remove
   */
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of session state changes
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  notifyListeners(event, data) {
    try {
      this.listeners.forEach(callback => {
        try {
          callback(event, data);
        } catch (error) {
          console.error('SessionService: Listener callback failed:', error);
        }
      });
    } catch (error) {
      console.error('SessionService: Failed to notify listeners:', error);
    }
  }

/**
   * Get session info for debugging
   * @returns {Object} Session debug info
   */
  async getSessionInfo() {
    try {
const session = await this.getCurrentSession();
      if (!session) {
        return { 
          status: 'No active session',
          error: 'Failed to retrieve or create session'
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
        isEmergencySession: session.isEmergencySession || false
      };
    } catch (error) {
      console.error('SessionService: Failed to get session info:', error);
      return { status: 'Error', error: error.message };
    }
  }

  /**
/**
   * Create guest session for non-authenticated users with comprehensive error handling
   * @returns {Object} Guest session
   */
  async createGuestSession() {
    try {
      console.log('SessionService: Creating new guest session');
      
      const sessionId = this.generateSessionId();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours
      
      const guestSession = {
        id: `guest_${sessionId}`,
        sessionId: sessionId,
        user: {
          id: `guest_${Date.now()}`,
          username: 'guest',
          role: 'guest',
          name: 'Guest User',
          email: null,
          isAuthenticated: false,
          isGuest: true,
          permissions: ['view_products', 'add_to_cart', 'checkout_guest']
        },
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        lastActivity: now.toISOString(),
        isAuthenticated: false,
        isGuest: true,
        token: null,
        refreshToken: null,
        metadata: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          createdBy: 'guest-session-service',
          sessionType: 'guest'
        }
      };
      
      // Validate the session before returning
      if (!this.validateSessionData(guestSession)) {
        console.error('SessionService: Created guest session failed validation');
        throw new Error('Guest session validation failed');
      }
      
      console.log('SessionService: Guest session created successfully', {
        sessionId: guestSession.sessionId,
        userId: guestSession.user.id,
        expiresAt: guestSession.expiresAt
      });
      
      return guestSession;
      
    } catch (error) {
      console.error('SessionService: Error creating guest session:', error);
      
      // Return minimal fallback session instead of throwing
      console.log('SessionService: Creating fallback minimal session due to guest session error');
      return this.createMinimalSession();
    }
  }
  
  /**
   * Creates minimal session for emergency fallback scenarios
   * @returns {Object} Minimal session object
   */
  createMinimalSession() {
    console.log('SessionService: Creating minimal fallback session');
    
    const timestamp = Date.now();
    return {
      id: `minimal_${timestamp}`,
      sessionId: `minimal_session_${timestamp}`,
      user: {
        id: 'guest_minimal',
        username: 'guest',
        role: 'guest',
        name: 'Guest User',
        email: null,
        isAuthenticated: false,
        isGuest: true,
        permissions: ['view_products', 'add_to_cart']
      },
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isGuest: true,
      isMinimalSession: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      lastActivity: new Date().toISOString(),
      metadata: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        createdBy: 'minimal-session-fallback',
        sessionType: 'minimal'
      }
    };
  }

  /**
   * Get default permissions based on user role
   * @param {string} role - User role
   * @returns {Array} Default permissions
   */
  getDefaultPermissions(role) {
    const permissionMap = {
      admin: ['full_access'],
      manager: ['view_all', 'edit_products', 'manage_orders'],
      employee: ['view_products', 'process_orders'],
      user: ['view_products', 'add_to_cart', 'checkout'],
      guest: ['view_products', 'add_to_cart', 'checkout_guest']
    };
    
    return permissionMap[role] || permissionMap.guest;
  }

  // Enhanced isAuthenticated with session validation
  async isAuthenticated() {
    try {
      const session = await this.getCurrentSession();
      
      if (!session) {
        return false;
      }

      // Check if session is valid and not expired
      if (!this.validateSessionData(session) || this.isSessionExpired(session)) {
        console.log('SessionService: Session invalid or expired');
        return false;
      }

      // Check if user has authentication token
      const isAuth = session.isAuthenticated && !!session.token && !session.isGuest;
      
      console.log('SessionService: Authentication status:', {
        isAuthenticated: isAuth,
        hasToken: !!session.token,
        isGuest: session.isGuest,
        userId: session.user?.id
      });

      return isAuth;
    } catch (error) {
      console.error('SessionService: Error checking authentication status:', error);
      return false;
    }
  }

  // Enhanced getCurrentUser with session validation  
  async getCurrentUser() {
    try {
      const session = await this.getCurrentSession();
      
      if (!session || !session.user) {
        console.warn('SessionService: No user in current session');
        return null;
      }

      return session.user;
    } catch (error) {
      console.error('SessionService: Error getting current user:', error);
      return null;
    }
  }

  // Enhanced getToken with session validation
  async getToken() {
    try {
      const session = await this.getCurrentSession();
      
      if (!session) {
        return null;
      }

      return session.token;
    } catch (error) {
      console.error('SessionService: Error getting token:', error);
      return null;
    }
  }
}

// Create and export singleton instance
const sessionService = new SessionService();

export default sessionService;

// Export additional utilities
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