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
import ErrorComponent from "@/components/ui/Error";

// SessionService class for managing user sessions and authentication
class SessionService {
  constructor() {
    this.sessionKey = 'freshmart_session';
    this.tokenKey = 'freshmart_token';
    this.userKey = 'freshmart_user';
    this.settingsKey = 'freshmart_user_settings';
    this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
    this.sessionChangeCallbacks = new Set();
    
    // Initialize session on startup
    this.initializeSession();
  }

  // Initialize session from storage or create guest session
  initializeSession() {
    try {
      const existingSession = this.getSession();
      if (existingSession && !this.isSessionExpired(existingSession)) {
        return existingSession;
      } else {
        // Clear expired session
        this.clearSession();
        return this.createGuestSession();
      }
    } catch (error) {
      console.error('Session initialization failed:', error);
      toast.error('Session initialization failed');
      return this.createGuestSession();
    }
  }

  // Create a new session
  createSession(userData, token = null) {
    try {
      const session = {
        id: Date.now().toString(),
        user: userData,
        token: token,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.sessionTimeout).toISOString(),
        isAuthenticated: !!token,
        lastActivity: new Date().toISOString()
      };

      // Validate session data
      if (!this.validateSessionData(session)) {
        throw new Error('Invalid session data');
      }

      // Store session
      localStorage.setItem(this.sessionKey, JSON.stringify(session));
      if (token) {
        localStorage.setItem(this.tokenKey, token);
      }
      localStorage.setItem(this.userKey, JSON.stringify(userData));

      // Notify callbacks
      this.notifySessionChange(session);
      
      return session;
    } catch (error) {
      console.error('Failed to create session:', error);
      toast.error('Failed to create session');
      return null;
    }
  }

  // Get current session from storage
  getSession() {
    try {
      const sessionData = localStorage.getItem(this.sessionKey);
      if (!sessionData) return null;
      
      const session = JSON.parse(sessionData);
      return this.validateSessionData(session) ? session : null;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  // Get current session with async compatibility
  async getCurrentSession() {
    return Promise.resolve(this.getSession());
  }

  // Create guest session for unauthenticated users
  async createGuestSession() {
    const guestUser = {
      id: 'guest_' + Date.now(),
      name: 'Guest User',
      email: null,
      role: 'guest',
      permissions: ['view_products', 'add_to_cart'],
      settings: {
        theme: 'light',
        currency: 'USD',
        notifications: false
      }
    };

    return this.createSession(guestUser);
  }

  // Validate session data structure
  validateSessionData(session) {
    if (!session || typeof session !== 'object') return false;
    
    const requiredFields = ['id', 'user', 'createdAt', 'expiresAt'];
    return requiredFields.every(field => session.hasOwnProperty(field));
  }

  // Get current user data
  getCurrentUser() {
    const session = this.getSession();
    return session?.user || null;
  }

  // Get authentication token
  getToken() {
    try {
      return localStorage.getItem(this.tokenKey);
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  }

  // Get user role
  getUserRole() {
    const user = this.getCurrentUser();
    return user?.role || 'guest';
  }

  // Get user permissions
  getUserPermissions() {
    const user = this.getCurrentUser();
    return user?.permissions || [];
  }

  // Get user settings
  getUserSettings() {
    const user = this.getCurrentUser();
    return user?.settings || {};
  }

  // Update user data
  updateUser(userData) {
    try {
      const session = this.getSession();
      if (!session) return false;

      session.user = { ...session.user, ...userData };
      session.lastActivity = new Date().toISOString();

      localStorage.setItem(this.sessionKey, JSON.stringify(session));
      localStorage.setItem(this.userKey, JSON.stringify(session.user));

      this.notifySessionChange(session);
      return true;
    } catch (error) {
      console.error('Failed to update user:', error);
      return false;
    }
  }

  // Check if user is authenticated
  isAuthenticated() {
    const session = this.getSession();
    return session?.isAuthenticated && !this.isSessionExpired(session);
  }

  // Check if session is expired
  isSessionExpired(session = null) {
    const currentSession = session || this.getSession();
    if (!currentSession) return true;

    const expiryTime = new Date(currentSession.expiresAt).getTime();
    return Date.now() > expiryTime;
  }

  // Extend session expiry
  extendSession(additionalTime = null) {
    try {
      const session = this.getSession();
      if (!session) return false;

      const extension = additionalTime || this.sessionTimeout;
      session.expiresAt = new Date(Date.now() + extension).toISOString();
      session.lastActivity = new Date().toISOString();

      localStorage.setItem(this.sessionKey, JSON.stringify(session));
      return true;
    } catch (error) {
      console.error('Failed to extend session:', error);
      return false;
    }
  }

  // Check if user has specific role
  hasRole(role) {
    const userRole = this.getUserRole();
    return userRole === role;
  }

  // Check if user has specific permission
  hasPermission(permission) {
    const permissions = this.getUserPermissions();
    return permissions.includes(permission);
  }

  // Check if user has any of the specified roles
  hasAnyRole(roles) {
    const userRole = this.getUserRole();
    return roles.includes(userRole);
  }

  // Update user settings
  updateUserSettings(settings) {
    try {
      const user = this.getCurrentUser();
      if (!user) return false;

      const updatedUser = {
        ...user,
        settings: { ...user.settings, ...settings }
      };

      return this.updateUser(updatedUser);
    } catch (error) {
      console.error('Failed to update user settings:', error);
      return false;
    }
  }

  // Get remaining session time in milliseconds
  getSessionTimeRemaining() {
    const session = this.getSession();
    if (!session) return 0;

    const expiryTime = new Date(session.expiresAt).getTime();
    const remaining = expiryTime - Date.now();
    return Math.max(0, remaining);
  }

  // Clear session data
  clearSession() {
    try {
      localStorage.removeItem(this.sessionKey);
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.userKey);
      localStorage.removeItem(this.settingsKey);
      
      this.notifySessionChange(null);
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }

  // Logout user
  logout(showMessage = true) {
    try {
      this.clearSession();
      if (showMessage) {
        toast.success('Logged out successfully');
      }
      // Redirect to home or login page
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
      if (showMessage) {
        toast.error('Logout failed');
      }
    }
  }

  // Login user with credentials
  async login(credentials) {
    try {
      // Simulate API call - replace with actual authentication
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock user data - replace with actual API response
      const userData = {
        id: 'user_' + Date.now(),
        name: credentials.name || 'User',
        email: credentials.email,
        role: credentials.role || 'customer',
        permissions: this.getDefaultPermissions(credentials.role || 'customer'),
        settings: {
          theme: 'light',
          currency: 'USD',
          notifications: true
        }
      };

      const token = 'mock_token_' + Date.now();
      const session = this.createSession(userData, token);

      if (session) {
        toast.success('Login successful');
        return { success: true, session, user: userData };
      } else {
        throw new Error('Failed to create session');
      }
    } catch (error) {
      console.error('Login failed:', error);
      toast.error('Login failed: ' + error.message);
      return { success: false, error: error.message };
    }
  }

  // Get session information
  getSessionInfo() {
    const session = this.getSession();
    if (!session) return null;

    return {
      id: session.id,
      userId: session.user?.id,
      userRole: session.user?.role,
      isAuthenticated: session.isAuthenticated,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      timeRemaining: this.getSessionTimeRemaining(),
      isExpired: this.isSessionExpired(session)
    };
  }

  // Register session change callback
  onSessionChange(callback) {
    if (typeof callback === 'function') {
      this.sessionChangeCallbacks.add(callback);
      
      // Return unsubscribe function
      return () => {
        this.sessionChangeCallbacks.delete(callback);
      };
    }
  }

  // Notify all session change callbacks
  notifySessionChange(session) {
    this.sessionChangeCallbacks.forEach(callback => {
      try {
        callback(session);
      } catch (error) {
        console.error('Session change callback error:', error);
      }
    });
  }

  // Get default permissions for role
  getDefaultPermissions(role) {
    const permissionMap = {
      admin: ['*'], // All permissions
      manager: ['view_products', 'manage_products', 'view_orders', 'manage_orders', 'view_reports'],
      employee: ['view_products', 'view_orders', 'process_orders'],
      customer: ['view_products', 'add_to_cart', 'place_orders', 'view_own_orders'],
      guest: ['view_products', 'add_to_cart']
    };

    return permissionMap[role] || permissionMap.guest;
  }
}

// Create and export singleton instance
const sessionService = new SessionService();

export default sessionService;