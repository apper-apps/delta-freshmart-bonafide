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
   * Validate current session - enhanced with comprehensive error handling
   * @returns {Object} Session validation result - never throws errors
   */
  validateSession() {
    try {
      // Safely get current session with error handling
      let session;
      try {
        session = this.getCurrentSession();
      } catch (sessionError) {
        console.warn('SessionService: Error getting current session:', sessionError);
        return {
          isValid: false,
          error: 'Session retrieval failed',
          requiresAuth: true,
          details: 'Unable to access session data'
        };
      }
      
if (!session || typeof session !== 'object') {
        console.warn('SessionService: No active session found, creating guest session');
        // Automatically create a guest session as fallback
        try {
          const guestSession = this.createGuestSession();
          return {
            isValid: true,
            session: guestSession,
            user: guestSession.user,
            token: guestSession.token,
            details: 'Guest session created as fallback',
            isGuest: true
          };
        } catch (guestError) {
          console.error('SessionService: Failed to create guest session:', guestError);
          return {
            isValid: false,
            error: 'No active session',
            requiresAuth: true,
            details: 'Unable to create fallback session'
          };
        }
      }

      // Check session expiration with error handling
      try {
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
      } catch (expirationError) {
        console.warn('SessionService: Error checking session expiration:', expirationError);
        return {
          isValid: false,
          error: 'Session validation failed',
          requiresAuth: true,
          details: 'Unable to validate session expiration'
        };
      }

      // Validate session data structure with error handling
      try {
        if (!this.validateSessionData(session)) {
          console.warn('SessionService: Session data validation failed');
          this.clearSession();
          return {
            isValid: false,
            error: 'Invalid session data',
            requiresAuth: true,
            details: 'Session data structure is corrupted'
          };
        }
      } catch (validationError) {
        console.warn('SessionService: Error validating session data:', validationError);
        this.clearSession();
        return {
          isValid: false,
          error: 'Session validation error',
          requiresAuth: true,
          details: 'Unable to validate session data structure'
        };
      }

      // Session is valid
      return {
        isValid: true,
        session: session,
        user: session.user || null,
        token: session.token || null,
        details: 'Session is valid and active'
      };

    } catch (error) {
      // Ultimate fallback - ensure no errors escape this method
      console.error('SessionService: Critical error in validateSession:', error);
      
      // Try to clear session safely
      try {
        this.clearSession();
      } catch (clearError) {
        console.error('SessionService: Failed to clear session after error:', clearError);
      }
      
      return {
        isValid: false,
        error: 'Session validation error',
        requiresAuth: true,
        details: `Critical session error: ${error.message || 'Unknown error'}`
      };
    }
  }

  /**
   * Get current session with enhanced error handling
   * @returns {Object|null} Current session or null
   */
getCurrentSession() {
    try {
      // Return current session if available
      if (this.currentSession && typeof this.currentSession === 'object') {
        return this.currentSession;
      }

      // Try to load from storage
      const storedSession = this.getStoredSession();
      if (storedSession && this.validateSessionData(storedSession)) {
        this.currentSession = storedSession;
        return storedSession;
      }

      // Create guest session as fallback if no valid session exists
      console.log('SessionService: No valid session found, creating guest session');
      try {
        return this.createGuestSession();
      } catch (guestError) {
        console.error('SessionService: Failed to create guest session in getCurrentSession:', guestError);
        return null;
      }
    } catch (error) {
      console.error('SessionService: Error in getCurrentSession:', error);
      // Clear potentially corrupted session
      this.currentSession = null;
      
      // Try to create fallback session
      try {
        return this.createGuestSession();
      } catch (fallbackError) {
        console.error('SessionService: All fallback methods failed:', fallbackError);
        return null;
      }
    }
  }

  /**
   * Enhanced session data validation with error handling
   * @param {Object} session - Session to validate
   * @returns {boolean} True if valid
   */
validateSessionData(session) {
    try {
      if (!session || typeof session !== 'object') {
        return false;
      }

      // Check required properties - be flexible with id field
      if ((!session.id && !session.sessionId) || !session.createdAt) {
        return false;
      }

      // Validate timestamps - handle both numeric and string formats for backward compatibility
      let createdAt = session.createdAt;
      if (typeof createdAt === 'string') {
        createdAt = new Date(createdAt).getTime();
      }
      if (typeof createdAt !== 'number' || createdAt <= 0 || isNaN(createdAt)) {
        return false;
      }

      if (session.expiresAt) {
        let expiresAt = session.expiresAt;
        if (typeof expiresAt === 'string') {
          expiresAt = new Date(expiresAt).getTime();
        }
        if (typeof expiresAt !== 'number' || expiresAt <= 0 || isNaN(expiresAt)) {
          return false;
        }
      }

      // Validate user object if present
      if (session.user && typeof session.user !== 'object') {
        return false;
      }

      return true;
    } catch (error) {
      console.error('SessionService: Error validating session data:', error);
      return false;
    }
  }

  /**
   * Enhanced session expiration check with error handling
   * @param {Object} session - Session to check
   * @returns {boolean} True if expired
   */
isSessionExpired(session) {
    try {
      if (!session || typeof session !== 'object') {
        return true;
      }

      // If no expiration time set, consider it non-expiring
      if (!session.expiresAt) {
        return false;
      }

      // Handle both string and numeric timestamp formats
      let expiresAt = session.expiresAt;
      if (typeof expiresAt === 'string') {
        expiresAt = new Date(expiresAt).getTime();
      }

      if (typeof expiresAt !== 'number' || isNaN(expiresAt)) {
        console.warn('SessionService: Invalid expiration timestamp format');
        return true;
      }

      return Date.now() > expiresAt;
    } catch (error) {
      console.error('SessionService: Error checking session expiration:', error);
      // On error, consider session expired for security
      return true;
    }
  }

  /**
   * Enhanced stored session retrieval with error handling
   * @returns {Object|null} Stored session or null
   */
  getStoredSession() {
    try {
      if (typeof localStorage === 'undefined') {
        console.warn('SessionService: localStorage not available');
        return null;
      }

      const stored = localStorage.getItem('freshmart_session');
      if (!stored) {
        return null;
      }

      return JSON.parse(stored);
    } catch (error) {
      console.error('SessionService: Error retrieving stored session:', error);
      // Clear potentially corrupted data
      try {
        localStorage.removeItem('freshmart_session');
      } catch (clearError) {
        console.error('SessionService: Failed to clear corrupted session:', clearError);
      }
      return null;
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

      const now = Date.now();
      const session = {
        id: this.generateSessionId(),
        user: {
          id: userData.id || null,
          username: userData.username || userData.email || 'user',
          email: userData.email || null,
          role: userData.role || 'customer',
          name: userData.name || userData.username || 'User',
          ...userData
        },
        token: token,
        createdAt: now,
        lastActivity: now,
        expiresAt: now + this.sessionTimeout,
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
   * Create a guest session as fallback
   * @returns {Object} Guest session object
   */
  createGuestSession() {
    try {
      const now = Date.now();
      const guestSession = {
        id: this.generateSessionId(),
        user: {
          id: 'guest_' + now,
          username: 'guest',
          email: null,
          role: 'guest',
          name: 'Guest User'
        },
        token: null,
        createdAt: now,
        lastActivity: now,
        expiresAt: now + this.sessionTimeout,
        sessionId: this.generateSessionId(),
        isGuest: true
      };

      this.currentSession = guestSession;
      this.storeSession(guestSession);
      this.notifyListeners('session_created', guestSession);

      return guestSession;
    } catch (error) {
      console.error('SessionService: Failed to create guest session:', error);
      // Return minimal session object as ultimate fallback
      const fallbackSession = {
        id: 'fallback_' + Date.now(),
        user: { role: 'guest', name: 'Guest' },
        token: null,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        expiresAt: Date.now() + this.sessionTimeout,
        sessionId: 'fallback_session',
        isGuest: true,
        isFallback: true
      };
      this.currentSession = fallbackSession;
      return fallbackSession;
    }
  }

  /**
   * Get stored session from localStorage with error handling
   * @returns {Object|null} Stored session or null
   */
  getStoredSession() {
    try {
      const sessionData = localStorage.getItem(this.storageKey);
      if (!sessionData) {
        return null;
      }

      const session = JSON.parse(sessionData);
      
      // Convert legacy string timestamps to numbers for consistency
      if (session.createdAt && typeof session.createdAt === 'string') {
        session.createdAt = new Date(session.createdAt).getTime();
      }
      if (session.expiresAt && typeof session.expiresAt === 'string') {
        session.expiresAt = new Date(session.expiresAt).getTime();
      }
      if (session.lastActivity && typeof session.lastActivity === 'string') {
        session.lastActivity = new Date(session.lastActivity).getTime();
      }

      return session;
    } catch (error) {
      console.error('SessionService: Error reading stored session:', error);
      // Clear corrupted storage
      try {
        localStorage.removeItem(this.storageKey);
      } catch (clearError) {
        console.error('SessionService: Failed to clear corrupted session:', clearError);
      }
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