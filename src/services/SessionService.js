/**
 * SessionService - Comprehensive session management for user authentication
 * Handles session validation, storage, and state management
 */

class SessionService {
  constructor() {
    this.storageKey = 'freshmart_session';
    this.userKey = 'freshmart_user';
    this.tokenKey = 'freshmart_token';
    this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
    this.listeners = new Set();
    
    // Initialize session on service creation
    this.initializeSession();
  }

  /**
   * Initialize session service and validate existing session
   */
  initializeSession() {
    try {
      const existingSession = this.getStoredSession();
      if (existingSession && this.validateSessionData(existingSession)) {
        this.currentSession = existingSession;
        this.notifyListeners('session_restored', existingSession);
      } else {
        this.clearSession();
      }
    } catch (error) {
      console.error('SessionService: Failed to initialize session:', error);
      this.clearSession();
    }
  }

  /**
   * Validate current session - main method that was throwing the error
   * @returns {Object} Session validation result
   */
validateSession() {
    try {
      const session = this.getCurrentSession();
      
      if (!session || typeof session !== 'object') {
        console.warn('SessionService: No active session found');
        return {
          isValid: false,
          error: 'No active session',
          requiresAuth: true,
          details: 'Session object is null or invalid'
        };
      }

      // Check session expiration
      if (this.isSessionExpired(session)) {
        console.warn('SessionService: Session has expired');
        this.clearSession();
        return {
          isValid: false,
          error: 'Session expired',
          requiresAuth: true,
          details: 'Session timestamp indicates expiration'
        };
      }

      // Validate session data integrity
      if (!this.validateSessionData(session)) {
        console.warn('SessionService: Session data validation failed');
        this.clearSession();
        return {
          isValid: false,
          error: 'Invalid session data',
          requiresAuth: true,
          details: 'Session data structure or content is invalid'
        };
      }

      // Refresh session timestamp
      try {
        this.refreshSession(session);
      } catch (refreshError) {
        console.warn('SessionService: Failed to refresh session:', refreshError);
        // Continue with validation even if refresh fails
      }

      return {
        isValid: true,
        session: session,
        user: session.user || null,
        details: 'Session validation successful'
      };
    } catch (error) {
      console.error('SessionService: Session validation failed:', error);
      
      // Ensure error is always a string, never an Error object
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        isValid: false,
        error: errorMessage || 'Session validation error',
        requiresAuth: true,
        details: `Validation exception: ${errorMessage}`,
        stack: error instanceof Error ? error.stack : undefined
      };
    }
  }

  /**
   * Create new session
   * @param {Object} userData - User data
   * @param {string} token - Authentication token
   * @returns {Object} Created session
   */
  createSession(userData, token = null) {
    try {
      if (!userData) {
        throw new Error('User data is required to create session');
      }

      const session = {
        user: {
          id: userData.id || null,
          username: userData.username || userData.email || 'user',
          email: userData.email || null,
          role: userData.role || 'customer',
          name: userData.name || userData.username || 'User',
          ...userData
        },
        token: token,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.sessionTimeout).toISOString(),
        sessionId: this.generateSessionId()
      };

      this.currentSession = session;
      this.storeSession(session);
      this.notifyListeners('session_created', session);

      return session;
    } catch (error) {
      console.error('SessionService: Failed to create session:', error);
      throw new Error(`Session creation failed: ${error.message}`);
    }
  }

  /**
   * Get current active session
   * @returns {Object|null} Current session or null
   */
  getCurrentSession() {
    try {
      if (this.currentSession) {
        return this.currentSession;
      }

      const storedSession = this.getStoredSession();
      if (storedSession && this.validateSessionData(storedSession)) {
        this.currentSession = storedSession;
        return storedSession;
      }

      return null;
    } catch (error) {
      console.error('SessionService: Failed to get current session:', error);
      return null;
    }
  }

  /**
   * Get current user from session
   * @returns {Object|null} Current user or null
   */
  getCurrentUser() {
    try {
      const session = this.getCurrentSession();
      return session?.user || null;
    } catch (error) {
      console.error('SessionService: Failed to get current user:', error);
      return null;
    }
  }

  /**
   * Get session token
   * @returns {string|null} Session token or null
   */
  getToken() {
    try {
      const session = this.getCurrentSession();
      return session?.token || localStorage.getItem(this.tokenKey) || null;
    } catch (error) {
      console.error('SessionService: Failed to get token:', error);
      return null;
    }
  }

  /**
   * Update session user data
   * @param {Object} userData - Updated user data
   */
  updateUser(userData) {
    try {
      const session = this.getCurrentSession();
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
  refreshSession(session = null) {
    try {
      const currentSession = session || this.getCurrentSession();
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
   * Check if user is authenticated
   * @returns {boolean} Authentication status
   */
  isAuthenticated() {
try {
      const validation = this.validateSession();
      
      // Handle validation response properly
      if (!validation || typeof validation !== 'object') {
        console.error('SessionService: Invalid validation response:', validation);
        return false;
      }
      
      // Log validation details for debugging
      if (!validation.isValid) {
        console.debug('SessionService: Authentication failed -', validation.error, validation.details);
      }
      
      return Boolean(validation.isValid);
    } catch (error) {
      console.error('SessionService: Authentication check failed:', error);
      
      // Additional error context for debugging
      console.error('SessionService: Error details:', {
        message: error.message,
        stack: error.stack,
        type: typeof error,
        timestamp: new Date().toISOString()
      });
      
      return false;
    }
  }

  /**
   * Check if session has expired
   * @param {Object} session - Session to check
   * @returns {boolean} Expiration status
   */
  isSessionExpired(session) {
    try {
      if (!session?.expiresAt) return true;
      return new Date() > new Date(session.expiresAt);
    } catch (error) {
      console.error('SessionService: Failed to check session expiration:', error);
      return true;
    }
  }

  /**
   * Validate session data structure
   * @param {Object} session - Session to validate
   * @returns {boolean} Validation result
   */
  validateSessionData(session) {
    try {
      if (!session || typeof session !== 'object') return false;
      if (!session.user || typeof session.user !== 'object') return false;
      if (!session.createdAt || !session.lastActivity) return false;
      if (!session.sessionId) return false;
      
      return true;
    } catch (error) {
      console.error('SessionService: Session data validation failed:', error);
      return false;
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
   * Get stored session from localStorage
   * @returns {Object|null} Stored session or null
   */
  getStoredSession() {
    try {
      const sessionData = localStorage.getItem(this.storageKey);
      if (!sessionData) return null;
      
      const session = JSON.parse(sessionData);
      
      // Ensure token is available
      if (!session.token) {
        session.token = localStorage.getItem(this.tokenKey);
      }
      
      return session;
    } catch (error) {
      console.error('SessionService: Failed to get stored session:', error);
      return null;
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
  getSessionInfo() {
    try {
      const session = this.getCurrentSession();
      if (!session) {
        return { status: 'No active session' };
      }

      return {
        status: 'Active',
        user: session.user?.username || 'Unknown',
        role: session.user?.role || 'Unknown',
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        expiresAt: session.expiresAt,
        isExpired: this.isSessionExpired(session)
      };
    } catch (error) {
      console.error('SessionService: Failed to get session info:', error);
      return { status: 'Error', error: error.message };
    }
  }

  /**
   * Create guest session for non-authenticated users
   * @returns {Object} Guest session
   */
  createGuestSession() {
    try {
      const guestUser = {
        id: 'guest',
        username: 'guest',
        role: 'guest',
        name: 'Guest User',
        isGuest: true
      };

      return this.createSession(guestUser);
    } catch (error) {
      console.error('SessionService: Failed to create guest session:', error);
      throw error;
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