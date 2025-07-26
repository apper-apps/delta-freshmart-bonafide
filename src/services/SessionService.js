import { toast } from "react-hot-toast";
import React from "react";
import chatConversations from "@/services/mockData/chatConversations.json";
import employees from "@/services/mockData/employees.json";
import products from "@/services/mockData/products.json";
import payroll from "@/services/mockData/payroll.json";
import attendance from "@/services/mockData/attendance.json";
import vendors from "@/services/mockData/vendors.json";
import posTransactions from "@/services/mockData/posTransactions.json";
import deliveryPersonnel from "@/services/mockData/deliveryPersonnel.json";
import Error from "@/components/ui/Error";

/**
 * SessionService - Comprehensive session management service
 * Handles user authentication, session persistence, and role-based access
 */
class SessionService {
  constructor() {
    this.SESSION_KEY = 'freshmart_session';
    this.USER_KEY = 'freshmart_user';
    this.TOKEN_KEY = 'freshmart_token';
    this.ROLE_KEY = 'freshmart_user_role';
    this.PERMISSIONS_KEY = 'freshmart_permissions';
    this.SETTINGS_KEY = 'freshmart_user_settings';
    
    // Session expiration (24 hours default)
    this.SESSION_DURATION = 24 * 60 * 60 * 1000;
    
    // Initialize session check
    this.initializeSession();
  }

  /**
   * Initialize session on service creation
   */
  initializeSession() {
    try {
      const session = this.getSession();
      if (session && this.isSessionExpired(session)) {
        this.clearSession();
        toast.error('Session expired. Please log in again.');
      }
    } catch (error) {
      console.error('Session initialization error:', error);
      this.clearSession();
    }
  }

  /**
   * Create and store user session
   */
  createSession(userData, token = null) {
    try {
      if (!userData || !userData.id) {
        throw new Error('Invalid user data provided');
      }

      const sessionData = {
        user: userData,
        token: token,
        loginTime: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.SESSION_DURATION).toISOString(),
        isActive: true
      };

      // Store session data
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
      localStorage.setItem(this.USER_KEY, JSON.stringify(userData));
      
      if (token) {
        localStorage.setItem(this.TOKEN_KEY, token);
      }
      
      if (userData.role) {
        localStorage.setItem(this.ROLE_KEY, userData.role);
      }

      if (userData.permissions) {
        localStorage.setItem(this.PERMISSIONS_KEY, JSON.stringify(userData.permissions));
      }

      // Store user preferences
      if (userData.settings) {
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(userData.settings));
      }

      return sessionData;
    } catch (error) {
      console.error('Session creation error:', error);
      toast.error('Failed to create session');
      return null;
    }
}

  /**
   * Get current session data (legacy method)
   */
  getSession() {
    try {
      const sessionData = localStorage.getItem(this.SESSION_KEY);
      if (!sessionData) return null;
      
      const session = JSON.parse(sessionData);
      return this.isSessionExpired(session) ? null : session;
    } catch (error) {
      console.error('Session retrieval error:', error);
      return null;
    }
  }

  /**
   * Get current session with comprehensive data structure
   * This is the method expected by App.jsx
   */
  async getCurrentSession() {
    try {
      const session = this.getSession();
      const user = this.getCurrentUser();
      
      if (!session && !user) {
        return null;
      }

      // If we have session data, return it in the expected format
      if (session && session.user) {
        return {
          ...session,
          sessionId: session.sessionId || `session_${Date.now()}`,
          user: session.user,
          isGuest: session.isGuest || session.user?.isGuest || false,
          isMinimalSession: session.isMinimalSession || false,
          isActive: session.isActive !== false
        };
      }

      // If we only have user data, construct a session object
      if (user) {
        const sessionData = {
          sessionId: `session_${Date.now()}`,
          user: user,
          token: this.getToken(),
          loginTime: new Date().toISOString(),
          expiresAt: new Date(Date.now() + this.SESSION_DURATION).toISOString(),
          isActive: true,
          isGuest: user.isGuest || false,
          isMinimalSession: false
        };

        // Store the constructed session
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
        return sessionData;
      }

      return null;
    } catch (error) {
      console.error('getCurrentSession error:', error);
      return null;
    }
  }

  /**
   * Create a guest session for fallback authentication
   */
  async createGuestSession() {
    try {
      const guestUser = {
        id: `guest_${Date.now()}`,
        name: 'Guest User',
        email: null,
        role: 'guest',
        isGuest: true,
        permissions: ['view_products', 'add_to_cart'],
        settings: {
          theme: 'light',
          notifications: false,
          language: 'en'
        }
      };

      const sessionData = {
        sessionId: `guest_session_${Date.now()}`,
        user: guestUser,
        token: null,
        loginTime: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.SESSION_DURATION).toISOString(),
        isActive: true,
        isGuest: true,
        isMinimalSession: true
      };

      // Store guest session
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
      localStorage.setItem(this.USER_KEY, JSON.stringify(guestUser));
      localStorage.setItem(this.ROLE_KEY, 'guest');
      localStorage.setItem(this.PERMISSIONS_KEY, JSON.stringify(guestUser.permissions));
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(guestUser.settings));

      console.log('Guest session created successfully');
      return sessionData;
    } catch (error) {
      console.error('Guest session creation error:', error);
      return null;
    }
  }

  /**
   * Validate session data structure
   */
  validateSessionData(session) {
    try {
      if (!session || typeof session !== 'object') {
        return false;
      }

      // Check required properties
      const hasUser = session.user && typeof session.user === 'object';
      const hasSessionId = session.sessionId && typeof session.sessionId === 'string';
      const hasValidTimestamp = session.loginTime && !isNaN(new Date(session.loginTime).getTime());
      
      // Check user object structure
      const hasUserId = session.user?.id;
      const hasUserRole = session.user?.role;

      // Session is valid if it has core required fields
      const isValid = hasUser && hasSessionId && hasValidTimestamp && hasUserId && hasUserRole;

      // Additional validation for non-guest sessions
      if (!session.isGuest && !session.isMinimalSession) {
        const hasToken = session.token && typeof session.token === 'string';
        const hasExpirationTime = session.expiresAt && !isNaN(new Date(session.expiresAt).getTime());
        const isNotExpired = session.expiresAt ? new Date(session.expiresAt) > new Date() : true;
        
        return isValid && hasToken && hasExpirationTime && isNotExpired;
      }

      return isValid;
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
}
  }

  /**
   * Get current user data
   */
  getCurrentUser() {
    try {
      const userData = localStorage.getItem(this.USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('User data retrieval error:', error);
      return null;
    }
  }

  /**
   * Get authentication token
   */
  getToken() {
    try {
      return localStorage.getItem(this.TOKEN_KEY);
    } catch (error) {
      console.error('Token retrieval error:', error);
      return null;
    }
  }

  /**
   * Get user role
   */
  getUserRole() {
    try {
      return localStorage.getItem(this.ROLE_KEY);
    } catch (error) {
      console.error('Role retrieval error:', error);
      return null;
    }
  }

  /**
   * Get user permissions
   */
  getUserPermissions() {
    try {
      const permissions = localStorage.getItem(this.PERMISSIONS_KEY);
      return permissions ? JSON.parse(permissions) : [];
    } catch (error) {
      console.error('Permissions retrieval error:', error);
      return [];
    }
  }

  /**
   * Get user settings
   */
  getUserSettings() {
    try {
      const settings = localStorage.getItem(this.SETTINGS_KEY);
      return settings ? JSON.parse(settings) : {};
    } catch (error) {
      console.error('Settings retrieval error:', error);
      return {};
    }
  }

  /**
   * Update user data in session
   */
  updateUser(userData) {
    try {
      if (!userData) {
        throw new Error('User data is required');
      }

      const session = this.getSession();
      if (!session) {
        throw new Error('No active session found');
      }

      // Update session with new user data
      session.user = { ...session.user, ...userData };
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      localStorage.setItem(this.USER_KEY, JSON.stringify(session.user));

      // Update role if provided
      if (userData.role) {
        localStorage.setItem(this.ROLE_KEY, userData.role);
      }

      // Update permissions if provided
      if (userData.permissions) {
        localStorage.setItem(this.PERMISSIONS_KEY, JSON.stringify(userData.permissions));
      }

      return session.user;
    } catch (error) {
      console.error('User update error:', error);
      toast.error('Failed to update user data');
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    try {
      const session = this.getSession();
      if (!session || !session.isActive) {
        return false;
      }

      if (this.isSessionExpired(session)) {
        this.clearSession();
        return false;
      }

      return true;
    } catch (error) {
      console.error('Authentication check error:', error);
      return false;
    }
  }

  /**
   * Check if session has expired
   */
  isSessionExpired(session = null) {
    try {
      const sessionData = session || this.getSession();
      if (!sessionData || !sessionData.expiresAt) {
        return true;
      }

      const expirationTime = new Date(sessionData.expiresAt).getTime();
      const currentTime = new Date().getTime();
      
      return currentTime > expirationTime;
    } catch (error) {
      console.error('Session expiration check error:', error);
      return true;
    }
  }

  /**
   * Extend session expiration
   */
  extendSession(additionalTime = null) {
    try {
      const session = this.getSession();
      if (!session) {
        return false;
      }

      const extension = additionalTime || this.SESSION_DURATION;
      session.expiresAt = new Date(Date.now() + extension).toISOString();
      
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      return true;
    } catch (error) {
      console.error('Session extension error:', error);
      return false;
    }
  }

  /**
   * Check if user has specific role
   */
  hasRole(role) {
    try {
      if (!role) return false;
      
      const userRole = this.getUserRole();
      return userRole === role;
    } catch (error) {
      console.error('Role check error:', error);
      return false;
    }
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(permission) {
    try {
      if (!permission) return false;
      
      const permissions = this.getUserPermissions();
      return Array.isArray(permissions) && permissions.includes(permission);
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(roles) {
    try {
      if (!Array.isArray(roles) || roles.length === 0) return false;
      
      const userRole = this.getUserRole();
      return roles.includes(userRole);
    } catch (error) {
      console.error('Multiple role check error:', error);
      return false;
    }
  }

  /**
   * Update user settings
   */
  updateUserSettings(settings) {
    try {
      if (!settings || typeof settings !== 'object') {
        throw new Error('Invalid settings provided');
      }

      const currentSettings = this.getUserSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(updatedSettings));
      
      // Also update in session if exists
      const session = this.getSession();
      if (session && session.user) {
        session.user.settings = updatedSettings;
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        localStorage.setItem(this.USER_KEY, JSON.stringify(session.user));
      }

      return updatedSettings;
    } catch (error) {
      console.error('Settings update error:', error);
      toast.error('Failed to update settings');
      return null;
    }
  }

  /**
   * Get session duration remaining
   */
  getSessionTimeRemaining() {
    try {
      const session = this.getSession();
      if (!session || !session.expiresAt) {
        return 0;
      }

      const expirationTime = new Date(session.expiresAt).getTime();
      const currentTime = new Date().getTime();
      const remaining = expirationTime - currentTime;
      
      return Math.max(0, remaining);
    } catch (error) {
      console.error('Session time check error:', error);
      return 0;
    }
  }

  /**
   * Clear all session data
   */
  clearSession() {
    try {
      localStorage.removeItem(this.SESSION_KEY);
      localStorage.removeItem(this.USER_KEY);
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.ROLE_KEY);
      localStorage.removeItem(this.PERMISSIONS_KEY);
      localStorage.removeItem(this.SETTINGS_KEY);
      
      // Clear any other session-related data
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('freshmart_')) {
          localStorage.removeItem(key);
        }
      });
      
      return true;
    } catch (error) {
      console.error('Session clear error:', error);
      return false;
    }
  }

  /**
   * Logout user and clear session
   */
  logout(showMessage = true) {
    try {
      this.clearSession();
      
if (showMessage) {
        toast.success('Logged out successfully');
      }
      
      // Redirect to login page or trigger app state update
      if (typeof window !== 'undefined' && window.CustomEvent) {
        window.dispatchEvent(new CustomEvent('sessionCleared'));
      }
      
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      if (showMessage) {
        toast.error('Error during logout');
      }
      return false;
    }
  }

  /**
   * Login user with credentials
   */
  async login(credentials) {
    try {
      if (!credentials || !credentials.email) {
        throw new Error('Email is required');
      }

      // This would typically make an API call
      // For now, using mock authentication
      const mockUser = {
        id: 1,
        email: credentials.email,
        name: credentials.name || 'User',
        role: credentials.role || 'customer',
        permissions: credentials.permissions || [],
        settings: {
          theme: 'light',
          notifications: true,
          language: 'en'
        }
      };

      const mockToken = 'mock_jwt_token_' + Date.now();
      
      const session = this.createSession(mockUser, mockToken);
      
if (session) {
        toast.success(`Welcome back, ${mockUser.name}!`);
        
        // Trigger session created event
        if (typeof window !== 'undefined' && window.CustomEvent) {
          window.dispatchEvent(new CustomEvent('sessionCreated', {
            detail: { user: mockUser, session } 
          }));
        }
        
        return { user: mockUser, token: mockToken, session };
      }
      
      throw new Error('Failed to create session');
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.message || 'Login failed');
      return null;
    }
  }

  /**
   * Get session info for debugging
   */
  getSessionInfo() {
    try {
      const session = this.getSession();
      const user = this.getCurrentUser();
      const token = this.getToken();
      const role = this.getUserRole();
      const permissions = this.getUserPermissions();
      const settings = this.getUserSettings();
      
      return {
        hasSession: !!session,
        isAuthenticated: this.isAuthenticated(),
        isExpired: session ? this.isSessionExpired(session) : true,
        timeRemaining: this.getSessionTimeRemaining(),
        user: user,
        role: role,
        permissions: permissions,
        settings: settings,
        hasToken: !!token
      };
    } catch (error) {
      console.error('Session info error:', error);
      return null;
    }
  }

  /**
   * Subscribe to session changes
   */
  onSessionChange(callback) {
    if (typeof callback !== 'function') {
      console.error('Session change callback must be a function');
      return null;
    }

    const handleSessionCreated = (event) => {
      callback('created', event.detail);
    };

    const handleSessionCleared = () => {
      callback('cleared', null);
    };
if (typeof window !== 'undefined') {
      window.addEventListener('sessionCreated', handleSessionCreated);
      window.addEventListener('sessionCleared', handleSessionCleared);
      // Return cleanup function
      return () => {
        window.removeEventListener('sessionCreated', handleSessionCreated);
        window.removeEventListener('sessionCleared', handleSessionCleared);
      };
    }

    // Return no-op cleanup function for non-browser environments
    return () => {};
  }
}

// Create and export singleton instance
const sessionService = new SessionService();

export default sessionService;