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

  // Enhanced getCurrentSession with automatic creation
async getCurrentSession() {
    try {
      // If we have a current session, validate and return it
      if (this.currentSession) {
        if (this.validateSessionData(this.currentSession) && !this.isSessionExpired(this.currentSession)) {
          return this.currentSession;
        } else {
          console.log('SessionService: Current session invalid, clearing and recreating');
          this.currentSession = null;
          this.clearStoredSession();
        }
      }

      // Wait for initialization if in progress
      if (this.isInitializing && this.initializationPromise) {
        console.log('SessionService: Waiting for initialization to complete');
        return await this.initializationPromise;
      }

      // Try to get from storage
      const stored = this.getStoredSession();
      if (stored && this.validateSessionData(stored) && !this.isSessionExpired(stored)) {
        console.log('SessionService: Valid session found in storage');
        this.currentSession = stored;
        return this.currentSession;
      }

      // No valid session exists, create guest session
      console.log('SessionService: No valid session found, creating guest session');
      const guestSession = await this.createGuestSession();
      
      // Validate the newly created session
      if (!this.validateSessionData(guestSession)) {
        throw new Error('Failed to create valid guest session');
      }
      
      this.currentSession = guestSession;
      this.storeSession(guestSession);
      this.notifyListeners('session_created', { session: guestSession });
      
      return this.currentSession;

    } catch (error) {
      console.error('SessionService: Error getting current session:', error);
      
      // Emergency fallback - create minimal valid session
      if (!this.currentSession) {
        console.log('SessionService: Creating emergency fallback session');
        try {
          const emergencyGuest = await this.createGuestSession();
          if (this.validateSessionData(emergencyGuest)) {
            this.currentSession = emergencyGuest;
            this.storeSession(emergencyGuest);
          } else {
            // Last resort - create absolute minimal session
            this.currentSession = this.createMinimalSession();
          }
        } catch (fallbackError) {
          console.error('SessionService: Emergency session creation failed:', fallbackError);
          this.currentSession = this.createMinimalSession();
        }
      }
      
      return this.currentSession;
    }
  }

validateSessionData(session) {
    try {
      // Enhanced null/undefined checks
      if (!session || typeof session !== 'object' || session === null) {
        console.log('SessionService: Session is null, undefined, or not an object');
        return false;
      }

      const requiredFields = ['id', 'sessionId', 'user', 'createdAt'];
      const hasRequiredFields = requiredFields.every(field => {
        const hasField = session.hasOwnProperty(field) && session[field] !== null && session[field] !== undefined;
        if (!hasField) {
          console.log(`SessionService: Session missing required field: ${field}`);
        }
        return hasField;
      });
      
      if (!hasRequiredFields) {
        console.warn('SessionService: Session missing required fields', { 
          sessionKeys: Object.keys(session || {}),
          requiredFields 
        });
        return false;
      }

      // Enhanced user data validation
      if (!session.user || typeof session.user !== 'object' || session.user === null) {
        console.warn('SessionService: Session user data invalid', { 
          userType: typeof session.user,
          userValue: session.user 
        });
        return false;
      }

      const requiredUserFields = ['id', 'username', 'role'];
      const hasRequiredUserFields = requiredUserFields.every(field => {
        const hasField = session.user.hasOwnProperty(field) && session.user[field] !== null && session.user[field] !== undefined;
        if (!hasField) {
          console.log(`SessionService: Session user missing required field: ${field}`);
        }
        return hasField;
      });
      
      if (!hasRequiredUserFields) {
        console.warn('SessionService: Session user missing required fields', {
          userKeys: Object.keys(session.user || {}),
          requiredUserFields
        });
        return false;
      }

      console.log('SessionService: Session validation successful');
      return true;
    } catch (error) {
      console.error('SessionService: Error validating session data:', error);
      return false;
    }
  }


// Enhanced getStoredSession with better error handling
/**
   * Enhanced session data validation with error handling
   * @param {Object} session - Session to validate
   * @returns {boolean} True if valid
   */

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

      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        console.log('SessionService: No stored session found');
        return null;
      }

      const parsedSession = JSON.parse(stored);
      
      // Validate the parsed session before returning
      if (!this.validateSessionData(parsedSession)) {
        console.warn('SessionService: Stored session data is invalid, clearing storage');
        this.clearStoredSession();
        return null;
      }

      console.log('SessionService: Retrieved valid stored session');
      return parsedSession;
      
    } catch (error) {
      console.error('SessionService: Error retrieving stored session:', error);
      
      // Clear potentially corrupted data
      this.clearStoredSession();
      return null;
    }
  }

  // Helper method to safely clear stored session
  clearStoredSession() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.storageKey);
        console.log('SessionService: Cleared stored session data');
      }
    } catch (error) {
      console.error('SessionService: Failed to clear stored session:', error);
    }
  }

  // Enhanced session creation with better validation
  async createSession(userData, token = null) {
    try {
      if (!userData || !userData.id) {
        throw new Error('Invalid user data provided for session creation');
      }

      const sessionId = this.generateSessionId();
      const expirationTime = token 
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days for authenticated
        : new Date(Date.now() + 24 * 60 * 60 * 1000);     // 24 hours for guest

      const session = {
        id: `session_${sessionId}`,
        sessionId,
        user: {
          id: userData.id,
          username: userData.username || userData.id,
          role: userData.role || 'guest',
          name: userData.name || 'User',
          email: userData.email || null,
          isGuest: userData.isGuest || false,
          ...userData
        },
        token,
        isAuthenticated: !!token,
        createdAt: new Date().toISOString(),
        expiresAt: expirationTime.toISOString(),
        lastActivity: new Date().toISOString(),
        isGuest: userData.isGuest || false
      };

      // Validate created session
      if (!this.validateSessionData(session)) {
        throw new Error('Created session failed validation');
      }

      // Store session
      this.currentSession = session;
      this.storeSession(session);
      
      console.log('SessionService: Created new session', {
        sessionId: session.sessionId,
        userId: session.user.id,
        isGuest: session.isGuest,
        expiresAt: session.expiresAt
      });

      this.notifyListeners('session_created', session);
      return session;

    } catch (error) {
      console.error('SessionService: Failed to create session:', error);
      throw error;
    }
  }
/**
   * Get current session with enhanced error handling
   * @returns {Object|null} Current session or null
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
          return guestSession;
        } else {
          console.error('SessionService: Guest session creation returned invalid result');
          throw new Error('Guest session creation failed');
        }
      } catch (guestError) {
        console.error('SessionService: Failed to create guest session in getCurrentSession:', guestError);
        throw new Error('Guest session creation failed: ' + guestError.message);
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
      const emergencySession = {
        id: 'emergency-' + Date.now(),
        sessionId: 'emergency-session',
        user: {
          id: 'guest',
          username: 'Guest User',
          role: 'guest'
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        isAuthenticated: false,
        isEmergencySession: true
      };
      
      console.warn('SessionService: Created emergency session to prevent app crash');
      this.currentSession = emergencySession;
      return emergencySession;
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
  getSessionInfo() {
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
   * Create guest session for non-authenticated users
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
          permissions: ['view_products', 'add_to_cart', 'checkout_guest']
        },
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        isAuthenticated: false,
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
      
      // Store the session immediately after creation
      this.storeSession(guestSession);
      
      return guestSession;
      
    } catch (error) {
      console.error('SessionService: Error creating guest session:', error);
      throw new Error('Failed to create guest session: ' + error.message);
    }
  }
  
  /**
   * Create minimal session as last resort fallback
   * @returns {Object} Minimal valid session
*/
  createMinimalSession() {
    console.warn('SessionService: Creating minimal fallback session');
    
    const sessionId = `minimal_${Date.now()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (60 * 60 * 1000)); // 1 hour
    
    const minimalSession = {
      id: sessionId,
      sessionId: sessionId,
      user: {
        id: `minimal_user_${Date.now()}`,
        username: 'guest',
        role: 'guest',
        name: 'Guest User',
        email: null,
        isAuthenticated: false,
        permissions: ['view_products']
      },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isAuthenticated: false,
      token: null,
      refreshToken: null,
      metadata: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        createdBy: 'minimal-session-service',
        sessionType: 'minimal'
      }
    };
    
    // Validate the minimal session to ensure it meets requirements
    if (!this.validateSessionData(minimalSession)) {
      console.error('SessionService: Created minimal session failed validation, using absolute fallback');
      // Return absolute minimal structure that should always pass validation
      return {
        id: sessionId,
        sessionId: sessionId,
        user: {
          id: `fallback_user_${Date.now()}`,
          username: 'guest',
          role: 'guest'
        },
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      };
    }
    
    return minimalSession;
  }
/**
   * Create guest session for non-authenticated users
   * @returns {Object} Guest session
   */
  async createGuestSession() {
    try {
      const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const guestUser = {
        id: guestId,
        username: 'guest',
        role: 'guest',
        name: 'Guest User',
        email: null,
        isGuest: true
      };

      console.log('SessionService: Creating guest session with ID:', guestId);
      const session = await this.createSession(guestUser);
      
      // Ensure guest session is properly flagged
      session.isGuest = true;
      session.user.isGuest = true;
      
      return session;
    } catch (error) {
      console.error('SessionService: Failed to create guest session:', error);
      
      // Create minimal fallback guest session
      const fallbackSession = {
        id: `fallback_${Date.now()}`,
        sessionId: `fallback_${Math.random().toString(36).substr(2, 9)}`,
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
        lastActivity: new Date().toISOString(),
        isGuest: true
      };
      
      this.currentSession = fallbackSession;
      console.log('SessionService: Created fallback guest session');
      return fallbackSession;
    }
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