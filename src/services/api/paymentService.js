// Payment Service - Pure JavaScript implementation
// Handles all payment processing operations
class PaymentService {
constructor() {
    this.transactions = [];
    this.walletBalance = 25000; // Initial wallet balance
    this.walletTransactions = [];
    this.vendors = [];
    this.vendorBills = [];
    this.vendorPayments = [];
    this.paymentProofs = [];
    this.currentUserRole = 'admin';
    this.financeManagerRole = 'finance_manager';
    this.cardBrands = {
      '4': 'visa',
      '5': 'mastercard',
      '3': 'amex',
      '6': 'discover'
    };
    
    // Initialize recurring payment automation storage
    this.recurringPayments = [];
    this.recurringPaymentIdCounter = 1;
    this.scheduledPayments = [];
    this.scheduledPaymentIdCounter = 1;
    this.paymentAutomationRules = [];
    this.automationRuleIdCounter = 1;
    
    // Initialize payment gateways storage
    this.paymentGateways = [
      {
        Id: 1,
        id: 'cash',
        name: 'Cash on Delivery',
        enabled: true,
        fee: 0,
        description: 'Pay when you receive your order',
        accountName: '',
        accountNumber: '',
        instructions: ''
      },
      {
        Id: 2,
        id: 'jazzcash',
        name: 'JazzCash',
        enabled: true,
        fee: 0.01,
        minimumFee: 5,
        description: 'Mobile wallet payment',
        accountName: 'FreshMart Store',
        accountNumber: '03001234567',
        instructions: 'Send money to the above JazzCash number and upload payment screenshot.'
      },
      {
        Id: 3,
        id: 'easypaisa',
        name: 'EasyPaisa',
        enabled: true,
        fee: 0.01,
        minimumFee: 5,
        description: 'Mobile wallet payment',
        accountName: 'FreshMart Store',
        accountNumber: '03009876543',
        instructions: 'Send money to the above EasyPaisa number and upload payment screenshot.'
      }
    ];
  }

  // Card Payment Processing
  async processCardPayment(cardData, amount, orderId) {
    await this.delay(2000); // Simulate processing time

    // Validate card data
    const validation = this.validateCardData(cardData);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Simulate payment gateway response
    const success = Math.random() > 0.1; // 90% success rate
    
    if (!success) {
      throw new Error('Payment declined. Please try again or use a different card.');
    }

    const transaction = {
      Id: this.getNextId(),
      orderId,
      amount,
      paymentMethod: 'card',
      cardLast4: cardData.cardNumber.slice(-4),
      cardBrand: this.getCardBrand(cardData.cardNumber),
      status: 'completed',
      transactionId: this.generateTransactionId(),
      timestamp: new Date().toISOString(),
      processingFee: 0,
      gatewayResponse: {
        authCode: this.generateAuthCode(),
        reference: this.generateReference()
      }
    };

    this.transactions.push(transaction);
    return { ...transaction };
  }

  // Digital Wallet Payment Processing
async processDigitalWalletPayment(walletType, amount, orderId, phone) {
    await this.delay(1500);

    // Validate phone number for Pakistani wallets
    if (!phone || !this.validatePakistaniPhone(phone)) {
      throw new Error('Please provide a valid Pakistani phone number');
    }

    const success = Math.random() > 0.05; // 95% success rate for digital wallets
    
    if (!success) {
      // Generate specific error messages for better user experience
      const walletDisplayNames = {
        'jazzcash': 'JazzCash',
        'easypaisa': 'Easypaisa',
        'sadapay': 'SadaPay',
        'nayapay': 'NayaPay'
      };
      
      const displayName = walletDisplayNames[walletType] || walletType;
      const errorReasons = [
        'Insufficient balance in your wallet',
        'Network connectivity issue',
        'Wallet service temporarily unavailable',
        'Transaction limit exceeded',
        'Authentication failed'
      ];
      
      const randomReason = errorReasons[Math.floor(Math.random() * errorReasons.length)];
      
      const error = new Error(`${displayName} payment failed: ${randomReason}. Please check your wallet balance and try again.`);
      error.code = 'WALLET_PAYMENT_FAILED';
      error.walletType = walletType;
      error.reason = randomReason;
      error.retryable = true;
      error.userGuidance = `Please ensure you have sufficient balance in your ${displayName} wallet and try again. If the problem persists, contact ${displayName} support.`;
      
      throw error;
    }

    const fee = this.calculateDigitalWalletFee(amount);
    
    const transaction = {
      Id: this.getNextId(),
      orderId,
      amount,
      paymentMethod: walletType,
      phone,
      status: 'completed',
      transactionId: this.generateTransactionId(),
      timestamp: new Date().toISOString(),
      processingFee: fee,
      gatewayResponse: {
        walletTransactionId: this.generateWalletTransactionId(walletType),
        reference: this.generateReference()
      }
    };

    this.transactions.push(transaction);
    return { ...transaction };
  }

  // Bank Transfer Processing
  async processBankTransfer(amount, orderId, bankDetails) {
    await this.delay(1000);

    const transaction = {
      Id: this.getNextId(),
      orderId,
      amount,
      paymentMethod: 'bank',
      bankAccount: bankDetails?.accountNumber?.slice(-4) || 'XXXX',
      status: 'pending_verification',
      transactionId: this.generateTransactionId(),
      timestamp: new Date().toISOString(),
      processingFee: 20,
      requiresVerification: true,
      gatewayResponse: {
        reference: this.generateReference(),
        instructions: 'Please transfer the amount to the provided bank account and upload the receipt.'
      }
    };

    this.transactions.push(transaction);
    return { ...transaction };
  }

  // Payment Verification
  async verifyPayment(transactionId, verificationData) {
    await this.delay(500);

    const transaction = this.transactions.find(t => t.transactionId === transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status === 'completed') {
      return { verified: true, transaction };
    }

    // Simulate verification process
    const verified = Math.random() > 0.2; // 80% verification success rate

    if (verified) {
      transaction.status = 'completed';
      transaction.verifiedAt = new Date().toISOString();
transaction.verificationData = verificationData;
    } else {
      transaction.status = 'verification_failed';
    }

    // Return verification result
    return { verified, transaction: { ...transaction } };
  }

  // Enhanced Payment Retry Logic
  async retryPayment(originalTransactionId, retryData) {
    await this.delay(1000);
    
    const originalTransaction = this.transactions.find(t => t.transactionId === originalTransactionId);
    if (!originalTransaction) {
      throw new Error('Original transaction not found');
    }
    
    // Create retry transaction
    const retryTransaction = {
      Id: this.getNextId(),
      orderId: originalTransaction.orderId,
      amount: originalTransaction.amount,
      paymentMethod: originalTransaction.paymentMethod,
      status: 'processing',
      transactionId: this.generateTransactionId(),
      timestamp: new Date().toISOString(),
      isRetry: true,
      originalTransactionId: originalTransactionId,
      retryAttempt: (originalTransaction.retryAttempt || 0) + 1,
      ...retryData
    };
    
    // Simulate retry processing
    const success = Math.random() > 0.3; // 70% success rate for retries
    
    if (success) {
      retryTransaction.status = 'completed';
      retryTransaction.gatewayResponse = {
        authCode: this.generateAuthCode(),
        reference: this.generateReference()
      };
    } else {
      retryTransaction.status = 'failed';
      retryTransaction.failureReason = 'Retry payment failed';
    }
    
    this.transactions.push(retryTransaction);
    return { ...retryTransaction };
  }

  // Enhanced Error Handling
  async handlePaymentError(transactionId, errorDetails) {
    await this.delay(300);
    
    const transaction = this.transactions.find(t => t.transactionId === transactionId);
    if (transaction) {
      transaction.status = 'failed';
      transaction.errorDetails = errorDetails;
      transaction.failedAt = new Date().toISOString();
    }
    
    return transaction;
  }
async getAvailablePaymentMethods() {
    await this.delay(200);
    return [...this.paymentGateways];
  }

  // Transaction History
  async getTransactionHistory(orderId) {
    await this.delay(300);
    return this.transactions.filter(t => t.orderId === orderId);
  }

  async getAllTransactions() {
    await this.delay(300);
    return [...this.transactions];
  }

  async getTransactionById(id) {
    await this.delay(300);
    const transaction = this.transactions.find(t => t.Id === id);
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    return { ...transaction };
  }

  // Utility Methods
  validateCardData(cardData) {
    const { cardNumber, expiryDate, cvv, cardholderName } = cardData;

    if (!cardNumber || cardNumber.replace(/\s/g, '').length < 13) {
      return { valid: false, error: 'Invalid card number' };
    }

    if (!expiryDate || !expiryDate.match(/^(0[1-9]|1[0-2])\/\d{2}$/)) {
      return { valid: false, error: 'Invalid expiry date' };
    }

    if (!cvv || cvv.length < 3) {
      return { valid: false, error: 'Invalid CVV' };
    }

    if (!cardholderName || cardholderName.trim().length < 2) {
      return { valid: false, error: 'Invalid cardholder name' };
    }

    // Check if card is expired
    const [month, year] = expiryDate.split('/');
    const expiry = new Date(2000 + parseInt(year), parseInt(month) - 1);
    if (expiry < new Date()) {
      return { valid: false, error: 'Card has expired' };
    }

    return { valid: true };
  }

  validatePakistaniPhone(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length === 11 && cleanPhone.startsWith('03');
  }

  getCardBrand(cardNumber) {
    const firstDigit = cardNumber.charAt(0);
    return this.cardBrands[firstDigit] || 'unknown';
  }

  calculateDigitalWalletFee(amount) {
    const feePercent = 0.01; // 1%
    const minimumFee = 5;
    return Math.max(amount * feePercent, minimumFee);
  }

generateTransactionId() {
    const timestamp = Date.now().toString();
    const randomStr = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `TXN${timestamp}${randomStr}`;
  }

  generateAuthCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  }

  generateReference() {
    return 'REF' + Date.now().toString().slice(-8);
  }

  generateWalletTransactionId(walletType) {
    const prefix = walletType.toUpperCase().substr(0, 3);
    return prefix + Date.now().toString().slice(-8);
  }

  getNextId() {
    const maxId = this.transactions.reduce((max, transaction) => 
      transaction.Id > max ? transaction.Id : max, 0);
    return maxId + 1;
  }
// Wallet Management Methods
  async getWalletBalance() {
    await this.delay(200);
    return this.walletBalance;
  }

  async updateWalletBalance(amount) {
    await this.delay(200);
    this.walletBalance += amount;
    return this.walletBalance;
  }

  // Approval Workflow Integration Methods
// Approval Workflow Integration Methods
  async holdWalletBalance(amount, reason, requestId = null) {
    await this.delay(300);
    
    if (amount <= 0) {
      throw new Error('Hold amount must be positive');
    }

    if (amount > this.walletBalance) {
      throw new Error('Insufficient wallet balance for hold');
    }

    // Create hold transaction
    const holdTransaction = {
      Id: this.getWalletTransactionId(),
      type: 'approval_hold',
      amount,
      balance: this.walletBalance, // Balance before hold
      timestamp: new Date().toISOString(),
      description: reason || 'Approval workflow hold',
      reference: this.generateReference(),
      requestId,
      orderId: null,
      transactionId: null,
      status: 'holding',
      metadata: {
        holdReason: reason,
        approvalType: 'pending'
      }
    };

    this.walletTransactions.push(holdTransaction);
    console.log(`Wallet hold created: Rs. ${amount} for ${reason}`);
    
return holdTransaction;
}

  async releaseWalletHold(amount, reason, requestId = null) {
    await this.delay(300);
    
    if (amount <= 0) {
      throw new Error('Release amount must be positive');
    }

    // Create release transaction
    const releaseTransaction = {
      Id: this.getWalletTransactionId(),
      type: 'hold_release',
      amount,
      balance: this.walletBalance,
      timestamp: new Date().toISOString(),
      description: reason || 'Hold released',
      reference: this.generateReference(),
      requestId,
      status: 'completed'
    };

    this.walletTransactions.push(releaseTransaction);
    console.log(`Wallet hold released: Rs. ${amount} for ${reason}`);
    
    return releaseTransaction;
  }
async processApprovalAdjustment(adjustmentData) {
    await this.delay(500);
    
    const { requestId, adjustmentAmount, adjustmentType, transactionId } = adjustmentData;
    
    if (!requestId || adjustmentAmount === undefined) {
      throw new Error('Request ID and adjustment amount are required');
    }

    // Apply the adjustment to wallet balance
    this.walletBalance += adjustmentAmount;
    
    // Create adjustment transaction
    const adjustmentTransaction = {
      Id: this.getWalletTransactionId(),
      type: 'price_adjustment',
      amount: adjustmentAmount,
      balance: this.walletBalance,
      timestamp: new Date().toISOString(),
      description: `Price adjustment (${adjustmentType}): Request #${requestId}`,
      reference: transactionId || this.generateReference(),
      requestId,
      orderId: null,
      transactionId: transactionId || null,
      adjustmentType,
      status: 'completed',
      metadata: {
        adjustmentReason: adjustmentType,
        approvalType: 'approved'
      }
    };

    this.walletTransactions.push(adjustmentTransaction);
    
    console.log(`Processed approval adjustment: Rs. ${adjustmentAmount} for request ${requestId}`);
    
    return adjustmentTransaction;
  }

  async recordWalletTransaction(transactionData) {
    await this.delay(200);
    
    const { 
      type, 
      amount, 
      description, 
      reference, 
      requestId = null, 
      orderId = null, 
      transactionId = null,
      status = 'completed',
      metadata = {}
    } = transactionData;
    
    if (!type || amount === undefined) {
      throw new Error('Transaction type and amount are required');
    }

    const transaction = {
      Id: this.getWalletTransactionId(),
      type, // 'approval_hold', 'price_adjustment', 'order_payment', 'deposit', 'withdraw', 'transfer', 'hold_release', 'rejection_release'
      amount,
      balance: this.walletBalance,
      timestamp: new Date().toISOString(),
      description: description || `${type.replace('_', ' ')} transaction`,
      reference: reference || this.generateReference(),
      requestId,
      orderId,
      transactionId,
      status,
      metadata
    };

    this.walletTransactions.push(transaction);
    console.log(`Recorded wallet transaction: ${type} - Rs. ${amount}`);
    
    return transaction;
  }

  async depositToWallet(amount) {
    await this.delay(500);
    
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }

    this.walletBalance += amount;
    
    const transaction = {
      Id: this.getWalletTransactionId(),
      type: 'deposit',
      amount,
      balance: this.walletBalance,
      timestamp: new Date().toISOString(),
      description: 'Wallet deposit',
      reference: this.generateReference()
    };

    this.walletTransactions.push(transaction);
    return { ...transaction };
  }

  async withdrawFromWallet(amount) {
    await this.delay(500);
    
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }

    if (amount > this.walletBalance) {
      throw new Error('Insufficient wallet balance');
    }

    this.walletBalance -= amount;
    
    const transaction = {
      Id: this.getWalletTransactionId(),
      type: 'withdraw',
      amount,
      balance: this.walletBalance,
      timestamp: new Date().toISOString(),
      description: 'Wallet withdrawal',
      reference: this.generateReference()
    };

    this.walletTransactions.push(transaction);
    return { ...transaction };
  }

  async transferFromWallet(amount, recipientId = null) {
    await this.delay(500);
    
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    if (amount > this.walletBalance) {
      throw new Error('Insufficient wallet balance');
    }

    this.walletBalance -= amount;
    
    const transaction = {
      Id: this.getWalletTransactionId(),
      type: 'transfer',
      amount,
      balance: this.walletBalance,
      timestamp: new Date().toISOString(),
      description: `Wallet transfer${recipientId ? ` to ${recipientId}` : ''}`,
      reference: this.generateReference(),
      recipientId
    };
this.walletTransactions.push(transaction);
    return { ...transaction };
  }

  async getApprovalRelatedTransactions(requestId = null, limit = 50) {
    await this.delay(200);
    
    let transactions = this.walletTransactions.filter(t => 
      ['hold', 'hold_release', 'approval_adjustment'].includes(t.type)
    );
    
    if (requestId) {
      transactions = transactions.filter(t => t.requestId === requestId);
    }
    
    return transactions
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  async getWalletHoldSummary() {
    await this.delay(200);
    
    const holdTransactions = this.walletTransactions.filter(t => 
      t.type === 'hold' && t.status === 'holding'
    );
    
    const totalHolding = holdTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    return {
      totalHolding,
      activeHolds: holdTransactions.length,
      availableBalance: this.walletBalance - totalHolding,
      holdTransactions: holdTransactions.slice(-10)
    };
  }

async processWalletPayment(amount, orderId) {
    await this.delay(500);
    
    if (amount <= 0) {
      throw new Error('Payment amount must be positive');
    }

    if (amount > this.walletBalance) {
      throw new Error('Insufficient wallet balance');
    }

    this.walletBalance -= amount;
    
    const transaction = {
      Id: this.getWalletTransactionId(),
      type: 'order_payment',
      amount,
      balance: this.walletBalance,
      timestamp: new Date().toISOString(),
      description: `Wallet payment for order ${orderId}`,
      reference: this.generateReference(),
      requestId: null,
      orderId,
      transactionId: this.generateTransactionId(),
      status: 'completed',
      metadata: {
        paymentMethod: 'wallet',
        orderType: 'purchase'
      }
    };

    this.walletTransactions.push(transaction);
    return { 
      ...transaction,
      transactionId: transaction.transactionId
    };
  }
  async getWalletTransactions(limit = 50) {
    await this.delay(300);
    return [...this.walletTransactions]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  async getWalletTransactionById(id) {
    await this.delay(300);
    const transaction = this.walletTransactions.find(t => t.Id === id);
    if (!transaction) {
      throw new Error('Wallet transaction not found');
    }
    return { ...transaction };
  }

  getWalletTransactionId() {
    const maxId = this.walletTransactions.reduce((max, transaction) => 
      transaction.Id > max ? transaction.Id : max, 0);
    return maxId + 1;
  }

// Gateway Configuration Management
  async getGatewayConfig() {
    await this.delay(200);
    return {
      cardGateway: {
        provider: 'stripe',
        enabled: true,
        apiKey: 'pk_test_xxxxx'
      },
      walletGateways: {
        jazzcash: { enabled: true, merchantId: 'JC123' },
        easypaisa: { enabled: true, merchantId: 'EP456' },
        sadapay: { enabled: true, merchantId: 'SP789' }
      },
      bankGateway: {
        enabled: true,
        accounts: [
          { bank: 'HBL', account: '1234567890' },
          { bank: 'UBL', account: '0987654321' }
        ]
      }
    };
  }

  async updateGatewayConfig(gatewayId, config) {
    await this.delay(300);
    // In a real implementation, this would update the gateway configuration
    return { success: true, gatewayId, config };
  }

async getGatewayStatus(gatewayId) {
    await this.delay(200);
    const gateway = this.paymentGateways.find(g => g.Id === gatewayId);
    return gateway ? { enabled: gateway.enabled, status: 'active' } : { enabled: false, status: 'inactive' };
  }

  async enableGateway(gatewayId) {
    await this.delay(300);
    const gateway = this.paymentGateways.find(g => g.Id === gatewayId);
    if (!gateway) {
      throw new Error('Payment gateway not found');
    }
    gateway.enabled = true;
    return { success: true, gatewayId, enabled: true };
  }

  async disableGateway(gatewayId) {
    await this.delay(300);
    const gateway = this.paymentGateways.find(g => g.Id === gatewayId);
    if (!gateway) {
      throw new Error('Payment gateway not found');
    }
    gateway.enabled = false;
    return { success: true, gatewayId, enabled: false };
  }

  // Gateway CRUD Operations
  async createGateway(gatewayData) {
    await this.delay(500);
    
    if (!gatewayData.name || !gatewayData.accountName || !gatewayData.accountNumber) {
      throw new Error('Name, account name, and account number are required');
    }

    const gateway = {
      Id: this.getNextGatewayId(),
      id: gatewayData.name.toLowerCase().replace(/\s+/g, '_'),
      name: gatewayData.name,
      accountName: gatewayData.accountName,
      accountNumber: gatewayData.accountNumber,
      instructions: gatewayData.instructions || '',
      fee: parseFloat(gatewayData.fee) / 100 || 0, // Convert percentage to decimal
      enabled: gatewayData.enabled !== false,
      description: `${gatewayData.name} payment gateway`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.paymentGateways.push(gateway);
    return { ...gateway };
  }

  async updateGateway(gatewayId, gatewayData) {
    await this.delay(400);
    
    const gateway = this.paymentGateways.find(g => g.Id === gatewayId);
    if (!gateway) {
      throw new Error('Payment gateway not found');
    }

    Object.assign(gateway, {
      name: gatewayData.name || gateway.name,
      accountName: gatewayData.accountName || gateway.accountName,
      accountNumber: gatewayData.accountNumber || gateway.accountNumber,
      instructions: gatewayData.instructions || gateway.instructions,
      fee: gatewayData.fee !== undefined ? parseFloat(gatewayData.fee) / 100 : gateway.fee,
      enabled: gatewayData.enabled !== undefined ? gatewayData.enabled : gateway.enabled,
      updatedAt: new Date().toISOString()
    });

    return { ...gateway };
  }

  async deleteGateway(gatewayId) {
    await this.delay(300);
    
    const index = this.paymentGateways.findIndex(g => g.Id === gatewayId);
    if (index === -1) {
      throw new Error('Payment gateway not found');
    }

    // Prevent deletion of cash on delivery
    if (this.paymentGateways[index].id === 'cash') {
      throw new Error('Cannot delete cash on delivery gateway');
    }

    this.paymentGateways.splice(index, 1);
    return { success: true };
  }

  getNextGatewayId() {
    const maxId = this.paymentGateways.reduce((max, gateway) => 
      gateway.Id > max ? gateway.Id : max, 0);
    return maxId + 1;
  }

delay(ms = 300) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Vendor CRUD Operations
  async createVendor(vendorData) {
    await this.delay(500);
    
    if (!vendorData.name || !vendorData.email || !vendorData.phone) {
      throw new Error('Vendor name, email, and phone are required');
    }

    const vendor = {
      Id: this.getNextVendorId(),
      name: vendorData.name,
      email: vendorData.email,
      phone: vendorData.phone,
      address: vendorData.address || '',
      taxId: vendorData.taxId || '',
      bankAccount: vendorData.bankAccount || '',
      paymentTerms: vendorData.paymentTerms || 'Net 30',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalPaid: 0,
      totalOwed: 0,
      lastPaymentDate: null
    };

    this.vendors.push(vendor);
    return { ...vendor };
  }

  async updateVendor(vendorId, vendorData) {
    await this.delay(400);
    
    const vendor = this.vendors.find(v => v.Id === vendorId);
    if (!vendor) {
      throw new Error('Vendor not found');
    }

    Object.assign(vendor, {
      ...vendorData,
      updatedAt: new Date().toISOString()
    });

    return { ...vendor };
  }

  async deleteVendor(vendorId) {
    await this.delay(300);
    
    const index = this.vendors.findIndex(v => v.Id === vendorId);
    if (index === -1) {
      throw new Error('Vendor not found');
    }

    // Check for pending payments
    const pendingPayments = this.vendorPayments.filter(p => 
      p.vendorId === vendorId && p.status === 'pending'
    );
    
    if (pendingPayments.length > 0) {
      throw new Error('Cannot delete vendor with pending payments');
    }

    this.vendors.splice(index, 1);
    return { success: true };
  }

  async getAllVendors() {
    await this.delay(300);
    return [...this.vendors];
  }

  async getVendorById(vendorId) {
    await this.delay(200);
    const vendor = this.vendors.find(v => v.Id === vendorId);
    if (!vendor) {
      throw new Error('Vendor not found');
    }
    return { ...vendor };
  }

  // Vendor Bill Management
  async createVendorBill(billData) {
    await this.delay(500);
    
    if (!this.validateFinanceManagerRole()) {
      throw new Error('Insufficient permissions. Finance manager role required.');
    }

    if (!billData.vendorId || !billData.amount || !billData.description) {
      throw new Error('Vendor ID, amount, and description are required');
    }

    const vendor = this.vendors.find(v => v.Id === billData.vendorId);
    if (!vendor) {
      throw new Error('Vendor not found');
    }

    const bill = {
      Id: this.getNextBillId(),
      vendorId: billData.vendorId,
      vendorName: vendor.name,
      amount: billData.amount,
      description: billData.description,
      billNumber: billData.billNumber || this.generateBillNumber(),
      dueDate: billData.dueDate || this.calculateDueDate(vendor.paymentTerms),
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: this.currentUserRole,
      category: billData.category || 'general',
      taxAmount: billData.taxAmount || 0,
      totalAmount: billData.amount + (billData.taxAmount || 0)
    };

    this.vendorBills.push(bill);
    
    // Update vendor total owed
    vendor.totalOwed += bill.totalAmount;
    vendor.updatedAt = new Date().toISOString();

    return { ...bill };
  }

  async processVendorBillPayment(billId, paymentData) {
    await this.delay(800);
    
    if (!this.validateFinanceManagerRole()) {
      throw new Error('Insufficient permissions. Finance manager role required.');
    }

    const bill = this.vendorBills.find(b => b.Id === billId);
    if (!bill) {
      throw new Error('Bill not found');
    }

    if (bill.status === 'paid') {
      throw new Error('Bill is already paid');
    }

    const vendor = this.vendors.find(v => v.Id === bill.vendorId);
    if (!vendor) {
      throw new Error('Vendor not found');
    }

    // Validate payment amount
    if (paymentData.amount > bill.totalAmount) {
      throw new Error('Payment amount cannot exceed bill amount');
    }

    const payment = {
      Id: this.getNextPaymentId(),
      billId: billId,
      vendorId: bill.vendorId,
      vendorName: vendor.name,
      amount: paymentData.amount,
      paymentMethod: paymentData.paymentMethod || 'bank_transfer',
      status: 'pending_proof',
      transactionId: this.generateTransactionId(),
      timestamp: new Date().toISOString(),
      paidBy: this.currentUserRole,
      reference: paymentData.reference || '',
      notes: paymentData.notes || '',
      requiresProof: true,
      proofStatus: 'pending'
    };

    this.vendorPayments.push(payment);

    // Update bill status
    if (paymentData.amount >= bill.totalAmount) {
      bill.status = 'paid';
      bill.paidAt = new Date().toISOString();
      bill.paymentId = payment.Id;
    } else {
      bill.status = 'partially_paid';
      bill.partialPayments = (bill.partialPayments || []).concat(payment.Id);
    }

    bill.updatedAt = new Date().toISOString();

    return { ...payment };
  }

  // Payment Proof Management
  async uploadPaymentProof(paymentId, proofData) {
    await this.delay(600);
    
    if (!this.validateFinanceManagerRole()) {
      throw new Error('Insufficient permissions. Finance manager role required.');
    }

    const payment = this.vendorPayments.find(p => p.Id === paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    // Simulate file upload validation
    if (!proofData.fileName || !proofData.fileType || !proofData.fileSize) {
      throw new Error('Invalid proof file data');
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(proofData.fileType)) {
      throw new Error('Only JPEG, PNG, and PDF files are allowed');
    }

    if (proofData.fileSize > 5 * 1024 * 1024) { // 5MB limit
      throw new Error('File size must be less than 5MB');
    }

    const proof = {
      Id: this.getNextProofId(),
      paymentId: paymentId,
      fileName: proofData.fileName,
      fileType: proofData.fileType,
      fileSize: proofData.fileSize,
      fileUrl: this.generateFileUrl(proofData.fileName), // Simulated URL
      uploadedAt: new Date().toISOString(),
      uploadedBy: this.currentUserRole,
      status: 'pending_verification',
      verificationNotes: ''
    };

    this.paymentProofs.push(proof);

    // Update payment status
    payment.proofStatus = 'uploaded';
    payment.proofId = proof.Id;
    payment.updatedAt = new Date().toISOString();

    return { ...proof };
  }

  async verifyPaymentProof(proofId, verificationData) {
    await this.delay(400);
    
    if (!this.validateFinanceManagerRole()) {
      throw new Error('Insufficient permissions. Finance manager role required.');
    }

    const proof = this.paymentProofs.find(p => p.Id === proofId);
    if (!proof) {
      throw new Error('Payment proof not found');
    }

    const payment = this.vendorPayments.find(p => p.Id === proof.paymentId);
    if (!payment) {
      throw new Error('Associated payment not found');
    }

    // Simulate verification process
    const verified = verificationData.approved !== false; // Default to approved unless explicitly false

    proof.status = verified ? 'verified' : 'rejected';
    proof.verifiedAt = new Date().toISOString();
    proof.verifiedBy = this.currentUserRole;
    proof.verificationNotes = verificationData.notes || '';

    if (verified) {
      payment.status = 'completed';
      payment.proofStatus = 'verified';
      payment.completedAt = new Date().toISOString();

      // Update vendor totals
      const vendor = this.vendors.find(v => v.Id === payment.vendorId);
      if (vendor) {
        vendor.totalPaid += payment.amount;
        vendor.totalOwed -= payment.amount;
        vendor.lastPaymentDate = new Date().toISOString();
        vendor.updatedAt = new Date().toISOString();
      }
    } else {
      payment.status = 'proof_rejected';
      payment.proofStatus = 'rejected';
      payment.rejectedAt = new Date().toISOString();
    }

    payment.updatedAt = new Date().toISOString();

    return { 
      verified, 
      proof: { ...proof }, 
      payment: { ...payment } 
    };
  }

  // Finance Manager Role Validation
  validateFinanceManagerRole() {
    return this.currentUserRole === 'admin' || this.currentUserRole === this.financeManagerRole;
  }

  async setUserRole(role) {
    await this.delay(100);
    this.currentUserRole = role;
    return { role };
  }

  async getCurrentUserRole() {
    await this.delay(100);
    return { role: this.currentUserRole };
  }

  // Reporting and Analytics
  async getVendorPaymentSummary(vendorId) {
    await this.delay(400);
    
    const vendor = this.vendors.find(v => v.Id === vendorId);
    if (!vendor) {
      throw new Error('Vendor not found');
    }

    const bills = this.vendorBills.filter(b => b.vendorId === vendorId);
    const payments = this.vendorPayments.filter(p => p.vendorId === vendorId);

    const summary = {
      vendor: { ...vendor },
      totalBills: bills.length,
      totalBillAmount: bills.reduce((sum, bill) => sum + bill.totalAmount, 0),
      paidBills: bills.filter(b => b.status === 'paid').length,
      pendingBills: bills.filter(b => b.status === 'pending').length,
      overdueBills: bills.filter(b => 
        b.status === 'pending' && new Date(b.dueDate) < new Date()
      ).length,
      totalPayments: payments.length,
      completedPayments: payments.filter(p => p.status === 'completed').length,
      pendingPayments: payments.filter(p => p.status === 'pending_proof').length,
      rejectedPayments: payments.filter(p => p.status === 'proof_rejected').length
    };

    return summary;
  }

  async getVendorPaymentHistory(vendorId, limit = 50) {
    await this.delay(300);
    
    const payments = this.vendorPayments
      .filter(p => p.vendorId === vendorId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);

    return payments.map(payment => ({ ...payment }));
  }

  async getPendingVendorBills() {
    await this.delay(300);
    
    const pendingBills = this.vendorBills
      .filter(bill => bill.status === 'pending')
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    return pendingBills.map(bill => ({ ...bill }));
  }

  async getOverdueBills() {
    await this.delay(300);
    
    const today = new Date();
    const overdueBills = this.vendorBills
      .filter(bill => bill.status === 'pending' && new Date(bill.dueDate) < today)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    return overdueBills.map(bill => ({ ...bill }));
  }

  async getPaymentProofQueue() {
    await this.delay(300);
    
    const pendingProofs = this.paymentProofs
      .filter(proof => proof.status === 'pending_verification')
      .sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));

    return pendingProofs.map(proof => ({ ...proof }));
  }

  // Utility Methods for Vendor System
  getNextVendorId() {
    const maxId = this.vendors.reduce((max, vendor) => 
      vendor.Id > max ? vendor.Id : max, 0);
    return maxId + 1;
  }

  getNextBillId() {
    const maxId = this.vendorBills.reduce((max, bill) => 
      bill.Id > max ? bill.Id : max, 0);
    return maxId + 1;
  }

  getNextPaymentId() {
    const maxId = this.vendorPayments.reduce((max, payment) => 
      payment.Id > max ? payment.Id : max, 0);
    return maxId + 1;
  }

  getNextProofId() {
    const maxId = this.paymentProofs.reduce((max, proof) => 
      proof.Id > max ? proof.Id : max, 0);
    return maxId + 1;
  }

  generateBillNumber() {
    return 'BILL-' + Date.now().toString().slice(-8);
  }

  calculateDueDate(paymentTerms) {
    const days = parseInt(paymentTerms.replace(/\D/g, '')) || 30;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate.toISOString();
  }

generateFileUrl(fileName) {
    // Simulate file URL generation
    return `https://storage.example.com/proofs/${Date.now()}-${fileName}`;
  }

  // Recurring Payment Automation Methods
  async createRecurringPayment(recurringData) {
    await this.delay(500);
    
    if (!this.validateFinanceManagerRole()) {
      throw new Error('Insufficient permissions. Finance manager role required.');
    }

    // Validate required fields
    if (!recurringData.name || !recurringData.vendorId || !recurringData.amount || !recurringData.frequency) {
      throw new Error('Name, vendor ID, amount, and frequency are required');
    }

    // Validate vendor exists
    const vendor = this.vendors.find(v => v.Id === recurringData.vendorId);
    if (!vendor) {
      throw new Error('Vendor not found');
    }

    // Validate frequency
    const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
    if (!validFrequencies.includes(recurringData.frequency)) {
      throw new Error('Invalid frequency. Must be daily, weekly, monthly, quarterly, or yearly');
    }

    const recurringPayment = {
      Id: this.recurringPaymentIdCounter++,
      name: recurringData.name,
      vendorId: recurringData.vendorId,
      vendorName: vendor.name,
      amount: parseFloat(recurringData.amount),
      frequency: recurringData.frequency,
      startDate: recurringData.startDate || new Date().toISOString(),
      endDate: recurringData.endDate || null,
      nextPaymentDate: this.calculateNextPaymentDate(recurringData.startDate || new Date().toISOString(), recurringData.frequency),
      status: 'active',
      description: recurringData.description || `Recurring payment to ${vendor.name}`,
      paymentMethod: recurringData.paymentMethod || 'bank_transfer',
      autoRetry: recurringData.autoRetry !== false,
      maxRetries: recurringData.maxRetries || 3,
      retryInterval: recurringData.retryInterval || 24, // hours
      emailNotifications: recurringData.emailNotifications !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: this.currentUserRole,
      totalPayments: 0,
      successfulPayments: 0,
      failedPayments: 0,
      lastPaymentDate: null,
      lastPaymentStatus: null,
      lastPaymentAmount: null,
      metadata: recurringData.metadata || {}
    };

    // Validate the recurring payment data
    const validation = this.validateRecurringPayment(recurringPayment);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    this.recurringPayments.push(recurringPayment);

    // Schedule the first payment
    await this.scheduleNextPayment(recurringPayment);

    return { ...recurringPayment };
  }

  async updateRecurringPayment(recurringId, updateData) {
    await this.delay(400);
    
    if (!this.validateFinanceManagerRole()) {
      throw new Error('Insufficient permissions. Finance manager role required.');
    }

    const recurring = this.recurringPayments.find(r => r.Id === recurringId);
    if (!recurring) {
      throw new Error('Recurring payment not found');
    }

    // If changing vendor, validate new vendor exists
    if (updateData.vendorId && updateData.vendorId !== recurring.vendorId) {
      const vendor = this.vendors.find(v => v.Id === updateData.vendorId);
      if (!vendor) {
        throw new Error('New vendor not found');
      }
      updateData.vendorName = vendor.name;
    }

    // If changing frequency or start date, recalculate next payment date
    if (updateData.frequency && updateData.frequency !== recurring.frequency) {
      const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
      if (!validFrequencies.includes(updateData.frequency)) {
        throw new Error('Invalid frequency');
      }
      updateData.nextPaymentDate = this.calculateNextPaymentDate(
        recurring.nextPaymentDate, 
        updateData.frequency
      );
    }

    // Update the recurring payment
    Object.assign(recurring, {
      ...updateData,
      updatedAt: new Date().toISOString()
    });

    // If status changed to active, ensure next payment is scheduled
    if (updateData.status === 'active' && recurring.status === 'active') {
      await this.scheduleNextPayment(recurring);
    }

    // If status changed to paused or cancelled, remove scheduled payments
    if (updateData.status && ['paused', 'cancelled'].includes(updateData.status)) {
      this.scheduledPayments = this.scheduledPayments.filter(
        sp => sp.recurringPaymentId !== recurringId
      );
    }

    return { ...recurring };
  }

  async pauseRecurringPayment(recurringId) {
    await this.delay(300);
    
    return await this.updateRecurringPayment(recurringId, { 
      status: 'paused',
      pausedAt: new Date().toISOString(),
      pausedBy: this.currentUserRole
    });
  }

  async resumeRecurringPayment(recurringId) {
    await this.delay(300);
    
    const recurring = this.recurringPayments.find(r => r.Id === recurringId);
    if (!recurring) {
      throw new Error('Recurring payment not found');
    }

    // Recalculate next payment date from now
    const nextPaymentDate = this.calculateNextPaymentDate(new Date().toISOString(), recurring.frequency);
    
    return await this.updateRecurringPayment(recurringId, { 
      status: 'active',
      nextPaymentDate,
      resumedAt: new Date().toISOString(),
      resumedBy: this.currentUserRole
    });
  }

  async deleteRecurringPayment(recurringId) {
    await this.delay(300);
    
    if (!this.validateFinanceManagerRole()) {
      throw new Error('Insufficient permissions. Finance manager role required.');
    }

    const index = this.recurringPayments.findIndex(r => r.Id === recurringId);
    if (index === -1) {
      throw new Error('Recurring payment not found');
    }

    // Remove all scheduled payments for this recurring payment
    this.scheduledPayments = this.scheduledPayments.filter(
      sp => sp.recurringPaymentId !== recurringId
    );

    // Mark as cancelled instead of deleting (for audit trail)
    this.recurringPayments[index].status = 'cancelled';
    this.recurringPayments[index].cancelledAt = new Date().toISOString();
    this.recurringPayments[index].cancelledBy = this.currentUserRole;

    return { success: true };
  }

  async getRecurringPayments(status = 'all') {
    await this.delay(300);
    
    let payments = [...this.recurringPayments];
    
    if (status !== 'all') {
      payments = payments.filter(r => r.status === status);
    }
    
    return payments.sort((a, b) => new Date(a.nextPaymentDate) - new Date(b.nextPaymentDate));
  }

  async getRecurringPaymentById(recurringId) {
    await this.delay(200);
    
    const recurring = this.recurringPayments.find(r => r.Id === recurringId);
    if (!recurring) {
      throw new Error('Recurring payment not found');
    }
    
    return { ...recurring };
  }

  async getScheduledPayments(days = 30) {
    await this.delay(300);
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    
    return this.scheduledPayments
      .filter(sp => new Date(sp.scheduledDate) <= endDate)
      .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
      .map(sp => ({
        ...sp,
        recurringPayment: this.recurringPayments.find(r => r.Id === sp.recurringPaymentId)
      }));
  }

  async processRecurringPayments() {
    await this.delay(1000);
    
    const now = new Date();
    const duePayments = this.scheduledPayments.filter(sp => 
      new Date(sp.scheduledDate) <= now && sp.status === 'pending'
    );

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const scheduledPayment of duePayments) {
      try {
        const result = await this.processScheduledPayment(scheduledPayment);
        results.processed++;
        
        if (result.success) {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push({
            recurringPaymentId: scheduledPayment.recurringPaymentId,
            error: result.error
          });
        }
      } catch (error) {
        results.processed++;
        results.failed++;
        results.errors.push({
          recurringPaymentId: scheduledPayment.recurringPaymentId,
          error: error.message
        });
      }
    }
return results;
  }

  // Enhanced Recurring Payment Processing with Detailed Error Handling
  async processScheduledPayment(scheduledPayment) {
    try {
      const recurring = this.recurringPayments.find(r => r.Id === scheduledPayment.recurringPaymentId);
      if (!recurring || recurring.status !== 'active') {
        throw new Error('Recurring payment is not active');
      }

      // Check end date
      if (recurring.endDate && new Date() > new Date(recurring.endDate)) {
        recurring.status = 'completed';
        recurring.completedAt = new Date().toISOString();
        throw new Error('Recurring payment has reached end date');
      }

      // Attempt to process the payment
      const payment = {
        Id: this.getNextPaymentId(),
        recurringPaymentId: recurring.Id,
        vendorId: recurring.vendorId,
        vendorName: recurring.vendorName,
        amount: recurring.amount,
        paymentMethod: recurring.paymentMethod,
        status: 'processing',
        transactionId: this.generateTransactionId(),
        timestamp: new Date().toISOString(),
        paidBy: 'automated_system',
        reference: `Recurring payment: ${recurring.name}`,
        notes: `Automated payment - ${recurring.description}`,
        isRecurring: true,
        scheduledPaymentId: scheduledPayment.Id
      };

      // Simulate payment processing (in real implementation, this would call actual payment gateway)
      const success = Math.random() > 0.1; // 90% success rate for automated payments
      
      if (success) {
        payment.status = 'completed';
        payment.completedAt = new Date().toISOString();
        
        // Update recurring payment stats
        recurring.totalPayments++;
        recurring.successfulPayments++;
        recurring.lastPaymentDate = new Date().toISOString();
        recurring.lastPaymentStatus = 'success';
        recurring.lastPaymentAmount = recurring.amount;
        
        // Update vendor totals
        const vendor = this.vendors.find(v => v.Id === recurring.vendorId);
        if (vendor) {
          vendor.totalPaid += recurring.amount;
          vendor.lastPaymentDate = new Date().toISOString();
          vendor.updatedAt = new Date().toISOString();
        }
        
        // Schedule next payment
        await this.scheduleNextPayment(recurring);
        
      } else {
        throw new Error('Payment processing failed');
      }

      this.vendorPayments.push(payment);
      
      // Mark scheduled payment as completed
      scheduledPayment.status = 'completed';
      scheduledPayment.processedAt = new Date().toISOString();
scheduledPayment.paymentId = payment.Id;

      return { success: true, payment };

    } catch (error) {
      // Handle payment failure - get recurring payment reference
      const recurring = this.recurringPayments.find(r => r.Id === scheduledPayment.recurringPaymentId);
      if (recurring) {
        recurring.totalPayments++;
        recurring.failedPayments++;
        recurring.lastPaymentDate = new Date().toISOString();
        recurring.lastPaymentStatus = 'failed';
      }
      
      // Mark scheduled payment as failed
      scheduledPayment.status = 'failed';
scheduledPayment.failedAt = new Date().toISOString();
      scheduledPayment.failureReason = error.message;
      scheduledPayment.retryCount = (scheduledPayment.retryCount || 0) + 1;

      // Handle retry logic
      if (recurring && recurring.autoRetry && scheduledPayment.retryCount < recurring.maxRetries) {
        // Schedule retry
        const retryDate = new Date();
        retryDate.setHours(retryDate.getHours() + recurring.retryInterval);
        
const retryPayment = {
          Id: this.scheduledPaymentIdCounter++,
          recurringPaymentId: recurring.Id,
          scheduledDate: retryDate.toISOString(),
          amount: recurring.amount,
          status: 'pending',
          isRetry: true,
          originalScheduledPaymentId: scheduledPayment.Id,
          retryCount: scheduledPayment.retryCount,
          createdAt: new Date().toISOString()
        };
        
        this.scheduledPayments.push(retryPayment);
      } else {
        // Max retries reached or auto-retry disabled
        if (recurring && scheduledPayment.retryCount >= recurring.maxRetries) {
          recurring.status = 'failed';
          recurring.failedAt = new Date().toISOString();
          recurring.failureReason = `Max retries (${recurring.maxRetries}) exceeded`;
        }
      }

      return { success: false, error: error.message };
    }
  }

  async scheduleNextPayment(recurringPayment) {
    if (recurringPayment.status !== 'active') {
      return;
    }

    // Calculate next payment date
    const nextDate = this.calculateNextPaymentDate(recurringPayment.nextPaymentDate, recurringPayment.frequency);
    
    // Check if we've reached the end date
    if (recurringPayment.endDate && new Date(nextDate) > new Date(recurringPayment.endDate)) {
      recurringPayment.status = 'completed';
      recurringPayment.completedAt = new Date().toISOString();
      return;
    }

    // Update next payment date
    recurringPayment.nextPaymentDate = nextDate;
    recurringPayment.updatedAt = new Date().toISOString();

    // Create scheduled payment
    const scheduledPayment = {
      Id: this.scheduledPaymentIdCounter++,
      recurringPaymentId: recurringPayment.Id,
      scheduledDate: nextDate,
      amount: recurringPayment.amount,
      status: 'pending',
      createdAt: new Date().toISOString(),
      isRetry: false,
      retryCount: 0
    };

    this.scheduledPayments.push(scheduledPayment);
    return scheduledPayment;
  }

  calculateNextPaymentDate(currentDate, frequency) {
    const date = new Date(currentDate);
    
    switch (frequency) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        throw new Error('Invalid frequency');
    }
    
    return date.toISOString();
  }

  validateRecurringPayment(recurringPayment) {
    // Validate amount
    if (!recurringPayment.amount || recurringPayment.amount <= 0) {
      return { valid: false, error: 'Amount must be greater than 0' };
    }

    // Validate dates
    if (recurringPayment.endDate && new Date(recurringPayment.endDate) <= new Date(recurringPayment.startDate)) {
      return { valid: false, error: 'End date must be after start date' };
    }

    // Validate retry settings
    if (recurringPayment.maxRetries < 0 || recurringPayment.maxRetries > 10) {
      return { valid: false, error: 'Max retries must be between 0 and 10' };
    }

    if (recurringPayment.retryInterval < 1 || recurringPayment.retryInterval > 168) {
      return { valid: false, error: 'Retry interval must be between 1 and 168 hours' };
    }

    return { valid: true };
  }

  // Payment Automation Rules
  async createAutomationRule(ruleData) {
    await this.delay(400);
    
    if (!this.validateFinanceManagerRole()) {
      throw new Error('Insufficient permissions. Finance manager role required.');
    }

    const rule = {
      Id: this.automationRuleIdCounter++,
      name: ruleData.name,
      description: ruleData.description || '',
      enabled: ruleData.enabled !== false,
      conditions: ruleData.conditions || {},
      actions: ruleData.actions || {},
      priority: ruleData.priority || 1,
      createdAt: new Date().toISOString(),
      createdBy: this.currentUserRole,
      lastTriggered: null,
      triggerCount: 0
    };

    this.paymentAutomationRules.push(rule);
    return { ...rule };
  }

  async getAutomationRules() {
    await this.delay(200);
    return [...this.paymentAutomationRules].sort((a, b) => b.priority - a.priority);
  }

  async updateAutomationRule(ruleId, updateData) {
    await this.delay(300);
    
    const rule = this.paymentAutomationRules.find(r => r.Id === ruleId);
    if (!rule) {
      throw new Error('Automation rule not found');
    }

    Object.assign(rule, {
      ...updateData,
      updatedAt: new Date().toISOString()
    });

    return { ...rule };
  }

  async deleteAutomationRule(ruleId) {
    await this.delay(200);
    
    const index = this.paymentAutomationRules.findIndex(r => r.Id === ruleId);
    if (index === -1) {
      throw new Error('Automation rule not found');
    }

    this.paymentAutomationRules.splice(index, 1);
    return { success: true };
  }

  // Recurring Payment Analytics
  async getRecurringPaymentAnalytics(days = 30) {
    await this.delay(400);
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const activeRecurring = this.recurringPayments.filter(r => r.status === 'active');
    const completedPayments = this.vendorPayments.filter(p => 
      p.isRecurring && 
      p.status === 'completed' &&
      new Date(p.timestamp) >= startDate
    );

    const totalAutomatedAmount = completedPayments.reduce((sum, p) => sum + p.amount, 0);
    const avgPaymentAmount = completedPayments.length > 0 ? totalAutomatedAmount / completedPayments.length : 0;

    // Success rate calculation
    const attemptedPayments = this.scheduledPayments.filter(sp => 
      sp.status !== 'pending' && 
      new Date(sp.createdAt) >= startDate
    );
    const successfulAttempts = attemptedPayments.filter(sp => sp.status === 'completed');
    const successRate = attemptedPayments.length > 0 ? (successfulAttempts.length / attemptedPayments.length) * 100 : 0;

    // Upcoming payments
    const upcomingPayments = this.scheduledPayments.filter(sp => 
      sp.status === 'pending' && 
      new Date(sp.scheduledDate) <= new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    );

    return {
      activeRecurringPayments: activeRecurring.length,
      totalAutomatedAmount,
      avgPaymentAmount,
      successRate,
      completedPayments: completedPayments.length,
      upcomingPayments: upcomingPayments.length,
      failedPayments: attemptedPayments.filter(sp => sp.status === 'failed').length,
      totalSavingsInTime: completedPayments.length * 15, // Estimated 15 minutes saved per automated payment
      recurringByFrequency: this.getRecurringByFrequency(),
      monthlyProjection: this.calculateMonthlyProjection()
    };
  }

  getRecurringByFrequency() {
    const frequencies = {};
    this.recurringPayments
      .filter(r => r.status === 'active')
      .forEach(r => {
        frequencies[r.frequency] = (frequencies[r.frequency] || 0) + 1;
      });
    return frequencies;
  }

  calculateMonthlyProjection() {
    const activeRecurring = this.recurringPayments.filter(r => r.status === 'active');
    let monthlyTotal = 0;

    activeRecurring.forEach(r => {
      const multiplier = {
        'daily': 30,
        'weekly': 4.33,
        'monthly': 1,
        'quarterly': 0.33,
        'yearly': 0.083
      }[r.frequency] || 1;

      monthlyTotal += r.amount * multiplier;
    });

    return monthlyTotal;
  }

  // Utility methods for recurring payments
  getNextRecurringId() {
    return this.recurringPaymentIdCounter++;
  }

  getNextScheduledId() {
    return this.scheduledPaymentIdCounter++;
  }

  getNextAutomationRuleId() {
    return this.automationRuleIdCounter++;
  }
}

export const paymentService = new PaymentService();