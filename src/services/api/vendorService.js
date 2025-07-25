import vendorsData from '@/services/mockData/vendors.json'
import productsData from '@/services/mockData/products.json'

class VendorService {
  constructor() {
    this.vendors = [...vendorsData];
    this.products = [...productsData];
    this.sessionKey = 'vendor_session';
  }

  // Authentication methods
  async login(credentials) {
    try {
      await this.delay();
      
      if (!credentials?.email || !credentials?.password) {
        throw new Error('Email and password are required');
      }

      const vendor = this.vendors.find(v => 
        v.email?.toLowerCase() === credentials.email.toLowerCase() && 
        v.status === 'active'
      );

      if (!vendor) {
        throw new Error('Invalid credentials or vendor not found');
      }

      // In a real app, you'd verify the password hash
      if (credentials.password !== 'vendor123') {
        throw new Error('Invalid credentials');
      }

      const session = {
        vendorId: vendor.id,
        email: vendor.email,
        name: vendor.name,
        loginTime: new Date().toISOString(),
        token: `vendor_token_${vendor.id}_${Date.now()}`
      };

      localStorage.setItem(this.sessionKey, JSON.stringify(session));
      
      await this.logAdminAction(`Vendor ${vendor.name} logged in`);
      
      return {
        success: true,
        vendor: {
          id: vendor.id,
          name: vendor.name,
          email: vendor.email,
          status: vendor.status
        },
        token: session.token
      };
    } catch (error) {
      console.error('Vendor login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  }

  async logout() {
    try {
      const session = this.getCurrentSession();
      if (session) {
        await this.logAdminAction(`Vendor ${session.name} logged out`);
      }
      
      localStorage.removeItem(this.sessionKey);
      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      console.error('Logout error:', error);
      throw new Error('Logout failed');
    }
  }

  getCurrentSession() {
    try {
      const sessionData = localStorage.getItem(this.sessionKey);
      return sessionData ? JSON.parse(sessionData) : null;
    } catch (error) {
      console.error('Session retrieval error:', error);
      return null;
    }
  }

  async validateSession() {
    try {
      const session = this.getCurrentSession();
      if (!session) {
        throw new Error('No active session');
      }

      const vendor = this.vendors.find(v => v.id === session.vendorId);
      if (!vendor || vendor.status !== 'active') {
        throw new Error('Vendor account is inactive');
      }

      return { valid: true, vendor: session };
    } catch (error) {
      console.error('Session validation error:', error);
      localStorage.removeItem(this.sessionKey);
      throw new Error(error.message || 'Session validation failed');
    }
  }

  // Profile management methods
  async getVendorProfile(vendorId) {
    try {
      await this.delay();

      if (!vendorId) {
        throw new Error('Vendor ID is required');
      }

      const vendor = this.vendors.find(v => v.id === vendorId);
      if (!vendor) {
        throw new Error('Vendor not found');
      }

      return {
        success: true,
        vendor: {
          ...vendor,
          // Don't return sensitive information
          password: undefined
        }
      };
    } catch (error) {
      console.error('Get vendor profile error:', error);
      throw new Error(error.message || 'Failed to fetch vendor profile');
    }
  }

  async updateVendorProfile(vendorId, profileData) {
    try {
      await this.delay();

      if (!vendorId || !profileData) {
        throw new Error('Vendor ID and profile data are required');
      }

      const vendorIndex = this.vendors.findIndex(v => v.id === vendorId);
      if (vendorIndex === -1) {
        throw new Error('Vendor not found');
      }

      // Validate email if being updated
      if (profileData.email && !this.isValidEmail(profileData.email)) {
        throw new Error('Invalid email format');
      }

      // Validate phone if being updated
      if (profileData.phone && !this.isValidPhone(profileData.phone)) {
        throw new Error('Invalid phone format');
      }

      // Check for duplicate email
      if (profileData.email) {
        const existingVendor = this.vendors.find(v => 
          v.email?.toLowerCase() === profileData.email.toLowerCase() && 
          v.id !== vendorId
        );
        if (existingVendor) {
          throw new Error('Email already exists');
        }
      }

      this.vendors[vendorIndex] = {
        ...this.vendors[vendorIndex],
        ...profileData,
        id: vendorId, // Ensure ID doesn't change
        updatedAt: new Date().toISOString()
      };

      await this.logAdminAction(`Vendor profile updated: ${this.vendors[vendorIndex].name}`);

      return {
        success: true,
        message: 'Profile updated successfully',
        vendor: this.vendors[vendorIndex]
      };
    } catch (error) {
      console.error('Update vendor profile error:', error);
      throw new Error(error.message || 'Failed to update vendor profile');
    }
  }

  async changePassword(vendorId, passwordData) {
    try {
      await this.delay();

      if (!vendorId || !passwordData?.currentPassword || !passwordData?.newPassword) {
        throw new Error('Current password and new password are required');
      }

      const vendor = this.vendors.find(v => v.id === vendorId);
      if (!vendor) {
        throw new Error('Vendor not found');
      }

      // In a real app, you'd verify the current password hash
      if (passwordData.currentPassword !== 'vendor123') {
        throw new Error('Current password is incorrect');
      }

      if (passwordData.newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters long');
      }

      // In a real app, you'd hash the new password
      await this.logAdminAction(`Password changed for vendor: ${vendor.name}`);

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      console.error('Change password error:', error);
      throw new Error(error.message || 'Failed to change password');
    }
  }

  // Admin vendor management methods
  async getAllVendors() {
    return this.getAll();
  }

  async getAll() {
    try {
      await this.delay();
      return {
        success: true,
        vendors: this.vendors.map(vendor => ({
          ...vendor,
          password: undefined // Don't return passwords
        }))
      };
    } catch (error) {
      console.error('Get all vendors error:', error);
      throw new Error('Failed to fetch vendors');
    }
  }

  async getById(id) {
    try {
      await this.delay();

      if (!id) {
        throw new Error('Vendor ID is required');
      }

      const vendor = this.vendors.find(v => v.id === id);
      if (!vendor) {
        throw new Error('Vendor not found');
      }

      return {
        success: true,
        vendor: {
          ...vendor,
          password: undefined
        }
      };
    } catch (error) {
      console.error('Get vendor by ID error:', error);
      throw new Error(error.message || 'Failed to fetch vendor');
    }
  }

  async create(vendorData) {
    return this.createVendor(vendorData);
  }

  async update(id, vendorData) {
    return this.updateVendor(id, vendorData);
  }

  async delete(id) {
    return this.deleteVendor(id);
  }

  async createVendor(vendorData) {
    try {
      await this.delay();

      if (!vendorData) {
        throw new Error('Vendor data is required');
      }

      const { name, email, phone, businessType, address } = vendorData;

      if (!name || !email || !phone) {
        throw new Error('Name, email, and phone are required');
      }

      if (!this.isValidEmail(email)) {
        throw new Error('Invalid email format');
      }

      if (!this.isValidPhone(phone)) {
        throw new Error('Invalid phone format');
      }

      // Check for duplicate email
      const existingVendor = this.vendors.find(v => 
        v.email?.toLowerCase() === email.toLowerCase()
      );
      if (existingVendor) {
        throw new Error('Email already exists');
      }

      const newVendor = {
        id: this.getNextId(),
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        businessType: businessType || 'General',
        address: address || '',
        status: 'active',
        rating: 0,
        totalOrders: 0,
        joinedDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assignedProducts: []
      };

      this.vendors.push(newVendor);

      await this.logAdminAction(`New vendor created: ${newVendor.name}`);
      await this.notifyVendor(newVendor.id, 'Welcome! Your vendor account has been created.');

      return {
        success: true,
        message: 'Vendor created successfully',
        vendor: newVendor
      };
    } catch (error) {
      console.error('Create vendor error:', error);
      throw new Error(error.message || 'Failed to create vendor');
    }
  }

  async updateVendor(vendorId, vendorData) {
    try {
      await this.delay();

      if (!vendorId || !vendorData) {
        throw new Error('Vendor ID and data are required');
      }

      const vendorIndex = this.vendors.findIndex(v => v.id === vendorId);
      if (vendorIndex === -1) {
        throw new Error('Vendor not found');
      }

      // Validate email if being updated
      if (vendorData.email && !this.isValidEmail(vendorData.email)) {
        throw new Error('Invalid email format');
      }

      // Validate phone if being updated
      if (vendorData.phone && !this.isValidPhone(vendorData.phone)) {
        throw new Error('Invalid phone format');
      }

      // Check for duplicate email
      if (vendorData.email) {
        const existingVendor = this.vendors.find(v => 
          v.email?.toLowerCase() === vendorData.email.toLowerCase() && 
          v.id !== vendorId
        );
        if (existingVendor) {
          throw new Error('Email already exists');
        }
      }

      this.vendors[vendorIndex] = {
        ...this.vendors[vendorIndex],
        ...vendorData,
        id: vendorId, // Ensure ID doesn't change
        updatedAt: new Date().toISOString()
      };

      await this.logAdminAction(`Vendor updated: ${this.vendors[vendorIndex].name}`);

      return {
        success: true,
        message: 'Vendor updated successfully',
        vendor: this.vendors[vendorIndex]
      };
    } catch (error) {
      console.error('Update vendor error:', error);
      throw new Error(error.message || 'Failed to update vendor');
    }
  }

  async deleteVendor(vendorId) {
    try {
      await this.delay();

      if (!vendorId) {
        throw new Error('Vendor ID is required');
      }

      const vendorIndex = this.vendors.findIndex(v => v.id === vendorId);
      if (vendorIndex === -1) {
        throw new Error('Vendor not found');
      }

      const vendor = this.vendors[vendorIndex];
      
      // Check if vendor has active orders (in a real app)
      // For now, we'll just soft delete by setting status to inactive
      this.vendors[vendorIndex] = {
        ...this.vendors[vendorIndex],
        status: 'inactive',
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.logAdminAction(`Vendor deleted: ${vendor.name}`);

      return {
        success: true,
        message: 'Vendor deleted successfully'
      };
    } catch (error) {
      console.error('Delete vendor error:', error);
      throw new Error(error.message || 'Failed to delete vendor');
    }
  }

  // Product management methods
  async getVendorProducts(vendorId) {
    try {
      await this.delay();

      if (!vendorId) {
        throw new Error('Vendor ID is required');
      }

      const vendor = this.vendors.find(v => v.id === vendorId);
      if (!vendor) {
        throw new Error('Vendor not found');
      }

      // Get products assigned to this vendor
      const vendorProducts = this.products.filter(product => 
        vendor.assignedProducts?.includes(product.id) ||
        product.vendorId === vendorId
      );

      return {
        success: true,
        products: vendorProducts,
        totalProducts: vendorProducts.length
      };
    } catch (error) {
      console.error('Get vendor products error:', error);
      throw new Error(error.message || 'Failed to fetch vendor products');
    }
  }

  async assignProductsToVendor(vendorId, productIds) {
    try {
      await this.delay();

      if (!vendorId || !Array.isArray(productIds)) {
        throw new Error('Vendor ID and product IDs array are required');
      }

      const vendorIndex = this.vendors.findIndex(v => v.id === vendorId);
      if (vendorIndex === -1) {
        throw new Error('Vendor not found');
      }

      // Validate that all product IDs exist
      const invalidProducts = productIds.filter(productId => 
        !this.products.some(p => p.id === productId)
      );

      if (invalidProducts.length > 0) {
        throw new Error(`Invalid product IDs: ${invalidProducts.join(', ')}`);
      }

      // Update vendor's assigned products
      const currentProducts = this.vendors[vendorIndex].assignedProducts || [];
      const newAssignedProducts = [...new Set([...currentProducts, ...productIds])];

      this.vendors[vendorIndex] = {
        ...this.vendors[vendorIndex],
        assignedProducts: newAssignedProducts,
        updatedAt: new Date().toISOString()
      };

      await this.logAdminAction(`Products assigned to vendor: ${this.vendors[vendorIndex].name}`);
      await this.notifyVendor(vendorId, `${productIds.length} new product(s) have been assigned to you.`);

      return {
        success: true,
        message: 'Products assigned successfully',
        assignedProducts: newAssignedProducts
      };
    } catch (error) {
      console.error('Assign products error:', error);
      throw new Error(error.message || 'Failed to assign products');
    }
  }

  async toggleVendorStatus(vendorId, status) {
    try {
      await this.delay();

      if (!vendorId || !status) {
        throw new Error('Vendor ID and status are required');
      }

      if (!['active', 'inactive', 'suspended'].includes(status)) {
        throw new Error('Invalid status. Must be active, inactive, or suspended');
      }

      const vendorIndex = this.vendors.findIndex(v => v.id === vendorId);
      if (vendorIndex === -1) {
        throw new Error('Vendor not found');
      }

      const oldStatus = this.vendors[vendorIndex].status;
      this.vendors[vendorIndex] = {
        ...this.vendors[vendorIndex],
        status,
        updatedAt: new Date().toISOString()
      };

      await this.logAdminAction(`Vendor status changed: ${this.vendors[vendorIndex].name} from ${oldStatus} to ${status}`);
      await this.notifyVendor(vendorId, `Your account status has been changed to ${status}.`);

      return {
        success: true,
        message: 'Vendor status updated successfully',
        vendor: this.vendors[vendorIndex]
      };
    } catch (error) {
      console.error('Toggle vendor status error:', error);
      throw new Error(error.message || 'Failed to update vendor status');
    }
  }

  // Utility methods
  getNextId() {
    const maxId = Math.max(...this.vendors.map(v => parseInt(v.id) || 0), 0);
    return (maxId + 1).toString();
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[-\s\(\)]/g, ''));
  }

  async delay(ms = 200) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async logAdminAction(action) {
    try {
      console.log(`[Vendor Service] ${new Date().toISOString()}: ${action}`);
      // In a real app, this would send to a logging service
    } catch (error) {
      console.error('Logging error:', error);
    }
  }

  async notifyVendor(vendorId, message) {
    try {
      console.log(`[Vendor Notification] ${vendorId}: ${message}`);
      // In a real app, this would send a notification to the vendor
    } catch (error) {
      console.error('Notification error:', error);
    }
  }
}

export const vendorService = new VendorService();