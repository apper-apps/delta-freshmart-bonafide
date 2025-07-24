import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import { addRealTimeNotification, approveRequest, fetchPendingApprovals, rejectRequest, selectApprovalLoading, selectPendingApprovals, selectRealTimeUpdates, setConnectionStatus, updateApprovalStatus } from "@/store/approvalWorkflowSlice";
import { fetchNotificationCounts, resetCount, setError, setLoading, updateCounts } from "@/store/notificationSlice";
import { store } from "@/store/index";
import webSocketService from "@/services/api/websocketService";
import { paymentService } from "@/services/api/paymentService";
import { notificationService } from "@/services/api/notificationService";
import { reportService } from "@/services/api/reportService";
import { orderService } from "@/services/api/orderService";
import { productService } from "@/services/api/productService";
import { vendorService } from "@/services/api/vendorService";
import { approvalWorkflowService } from "@/services/api/approvalWorkflowService";
import ApperIcon from "@/components/ApperIcon";
import Orders from "@/components/pages/Orders";
import Badge from "@/components/atoms/Badge";
import Button from "@/components/atoms/Button";
import Error from "@/components/ui/Error";
import Loading from "@/components/ui/Loading";

const AdminDashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const notificationCounts = useSelector(state => state.notifications.counts);
  const pendingApprovals = useSelector(selectPendingApprovals);
  const approvalLoading = useSelector(selectApprovalLoading);
  const realTimeUpdates = useSelector(selectRealTimeUpdates);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    walletBalance: 0,
    totalTransactions: 0,
    monthlyRevenue: 0,
    pendingVerifications: 0,
    todayRevenue: 0
  });
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [todayOrders, setTodayOrders] = useState([]);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [revenueByMethod, setRevenueByMethod] = useState({});
  const [sortedOrders, setSortedOrders] = useState([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [recentOrders, setRecentOrders] = useState([]);
  const [revenueBreakdown, setRevenueBreakdown] = useState([]);
const [selectedApproval, setSelectedApproval] = useState(null);
  const [approvalComments, setApprovalComments] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedApprovals, setSelectedApprovals] = useState([]);
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false);
  const [bulkActionType, setBulkActionType] = useState('');
  const [showVendorControl, setShowVendorControl] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [wsConnectionStatus, setWsConnectionStatus] = useState({ connected: false });
  const pollingRef = useRef(null);
  const wsUnsubscribeRef = useRef(null);
// Enhanced Payment Verification Report State with Real-time Tracking
  const [paymentVerificationData, setPaymentVerificationData] = useState({
    data: [],
    summary: { 
      totalPending: 0, 
      totalAmount: 0, 
      averageAmount: 0, 
      recentActivity: 0, 
      byPaymentMethod: {},
      // Payment Flow Metrics
      vendorProcessed: 0,
      adminConfirmed: 0,
      proofUploaded: 0,
      autoMatched: 0,
      vendorConfirmed: 0
    },
    metadata: { 
      generatedAt: new Date().toISOString(), 
      lastRefresh: new Date().toISOString(),
      realTimeEnabled: true,
      flowStages: ['vendor_processed', 'admin_paid', 'proof_uploaded', 'amount_matched', 'vendor_confirmed']
    }
  });
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [activeReportTab, setActiveReportTab] = useState('summary');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [reportFilters, setReportFilters] = useState({
    startDate: '',
    endDate: '',
    vendor: '',
    paymentMethod: '',
    flowStage: '',
    verificationStatus: ''
  });
  const [exportLoading, setExportLoading] = useState(false);
  const reportRefreshRef = useRef(null);
const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load products and check for low stock
      const products = await productService.getAll();
      const orders = await orderService.getAll();
      
      // Calculate low stock products (stock < 10)
      const lowStock = products.filter(product => (product?.stock || 0) < 10);
      setLowStockProducts(lowStock || []);
      // Get today's orders
      const today = new Date()
      const todayOrdersData = orders.filter(order => {
        const orderDate = new Date(order.createdAt)
        return orderDate.toDateString() === today.toDateString()
      })
      setTodayOrders(todayOrdersData || [])

      // Calculate today's revenue with safe defaults
      const todayRevenueAmount = todayOrdersData.reduce((sum, order) => {
        return sum + (order?.totalAmount || 0)
      }, 0)
      setTodayRevenue(todayRevenueAmount || 0)

      // Get wallet data with safe defaults
      const walletBalance = await paymentService.getWalletBalance()
      const walletTransactionsData = await paymentService.getWalletTransactions()
      setWalletTransactions(walletTransactionsData || [])

      // Get monthly revenue with safe defaults
      const monthlyRevenue = await orderService.getMonthlyRevenue()
      const pendingVerifications = await orderService.getPendingVerifications()
      const revenueByMethodData = await orderService.getRevenueByPaymentMethod()
      setRevenueByMethod(revenueByMethodData || {})

      // Calculate revenue breakdown with safe defaults
      const breakdown = Object.entries(revenueByMethodData || {}).map(([method, amount]) => ({
        method,
        amount: amount || 0
      }))
      setRevenueBreakdown(breakdown || [])

      // Sort orders by date (newest first)
      const sortedOrdersData = [...(orders || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      setSortedOrders(sortedOrdersData || [])
      setRecentOrders(sortedOrdersData.slice(0, 5) || [])

      setStats({
        walletBalance: walletBalance || 0,
        totalTransactions: (walletTransactionsData || []).length,
        monthlyRevenue: monthlyRevenue || 0,
        pendingVerifications: (pendingVerifications || []).length,
        todayRevenue: todayRevenueAmount || 0
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
};

// Enhanced Payment Verification Report Functions with Real-time Tracking
const loadPaymentVerificationReport = async (filters = {}) => {
  setReportLoading(true);
  setReportError(null);
  try {
    const reportData = await reportService.getPaymentVerificationReport(filters);
    
    // Enhanced report data with payment flow metrics
    const enhancedReportData = {
      ...reportData,
      summary: {
        ...reportData.summary,
        // Payment Flow Stage Metrics
        vendorProcessed: reportData.data.filter(item => item.flowStage === 'vendor_processed').length,
        adminConfirmed: reportData.data.filter(item => item.flowStage === 'admin_paid').length,
        proofUploaded: reportData.data.filter(item => item.proofStatus === 'uploaded').length,
        autoMatched: reportData.data.filter(item => item.amountMatched === true).length,
        vendorConfirmed: reportData.data.filter(item => item.vendorConfirmed === true).length,
        // Real-time Flow Indicators
        flowStageDistribution: {
          vendor_processed: reportData.data.filter(item => item.flowStage === 'vendor_processed').length,
          admin_paid: reportData.data.filter(item => item.flowStage === 'admin_paid').length,
          proof_uploaded: reportData.data.filter(item => item.proofStatus === 'uploaded').length,
          amount_matched: reportData.data.filter(item => item.amountMatched === true).length,
          vendor_confirmed: reportData.data.filter(item => item.vendorConfirmed === true).length
        }
      },
      metadata: {
        ...reportData.metadata,
        realTimeEnabled: true,
        lastWebSocketUpdate: new Date().toISOString(),
        flowStageTracking: true
      }
    };
    
    setPaymentVerificationData(enhancedReportData);
    
    // Update notification counts for payment flow
    dispatch(updateCounts({
      paymentVerification: enhancedReportData.summary.totalPending,
      paymentProcessed: enhancedReportData.summary.vendorProcessed,
      adminPaid: enhancedReportData.summary.adminConfirmed,
      paymentProofPending: enhancedReportData.summary.proofUploaded
    }));
    
  } catch (error) {
    console.error('Error loading payment verification report:', error);
    setReportError('Failed to load payment verification report');
    toast.error('Failed to load payment verification report');
  } finally {
    setReportLoading(false);
  }
};

const handleExportReport = async (format = 'pdf') => {
  setExportLoading(true);
  try {
    const exportResult = await reportService.exportReport('payment_verification', format, reportFilters);
    toast.success(`Report exported successfully! ${exportResult.recordCount} records exported.`);
    
    // Simulate file download
    const link = document.createElement('a');
    link.href = exportResult.fileUrl;
    link.download = exportResult.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error exporting report:', error);
    toast.error('Failed to export report');
  } finally {
    setExportLoading(false);
  }
};

const handleFilterChange = (filterName, value) => {
  const newFilters = { ...reportFilters, [filterName]: value };
  setReportFilters(newFilters);
  loadPaymentVerificationReport(newFilters);
};

const startAutoRefresh = () => {
  if (reportRefreshRef.current) {
    clearInterval(reportRefreshRef.current);
  }
  
  reportRefreshRef.current = setInterval(() => {
    loadPaymentVerificationReport(reportFilters);
  }, 15000); // 15 seconds
  
  setAutoRefreshEnabled(true);
};

const stopAutoRefresh = () => {
  if (reportRefreshRef.current) {
    clearInterval(reportRefreshRef.current);
    reportRefreshRef.current = null;
  }
  setAutoRefreshEnabled(false);
};
// Notification polling functionality
  const fetchNotificationCountsData = useCallback(async () => {
    try {
      const result = await dispatch(fetchNotificationCounts());
      if (fetchNotificationCounts.rejected.match(result)) {
        console.error('Failed to fetch notification counts:', result.payload);
      }
    } catch (error) {
      console.error('Failed to fetch notification counts:', error);
      dispatch(setError('Failed to load notification counts'));
    }
  }, [dispatch]);

const handleTabClick = useCallback((path) => {
    const notificationKey = notificationService.getNotificationKey(path);
    if (notificationKey && notificationCounts[notificationKey] > 0) {
      dispatch(resetCount({ key: notificationKey }));
      notificationService.markAsRead(notificationKey);
    }
  }, [dispatch, notificationCounts]);

  const handleOrderSummaryClick = useCallback(() => {
    // Navigate to Order Summary with proper orderId parameter
    if (recentOrders && recentOrders.length > 0) {
      // Navigate to the most recent order's summary
      const mostRecentOrderId = recentOrders[0]?.id;
      if (mostRecentOrderId) {
        console.log('AdminDashboard: Navigating to Order Summary for order ID:', mostRecentOrderId);
        navigate(`/order-summary/${mostRecentOrderId}`);
        
        // Clear notification count
        const notificationKey = notificationService.getNotificationKey('/order-summary');
        if (notificationKey && notificationCounts[notificationKey] > 0) {
          dispatch(resetCount({ key: notificationKey }));
          notificationService.markAsRead(notificationKey);
        }
        
        toast.success(`Opening summary for Order #${mostRecentOrderId}`);
      } else {
        console.warn('AdminDashboard: Recent order found but missing ID');
        toast.error('Unable to open order summary - order ID missing');
      }
    } else if (sortedOrders && sortedOrders.length > 0) {
      // Fallback to any available order
      const fallbackOrderId = sortedOrders[0]?.id;
      if (fallbackOrderId) {
        console.log('AdminDashboard: Using fallback order for summary:', fallbackOrderId);
        navigate(`/order-summary/${fallbackOrderId}`);
        toast.info(`Opening summary for Order #${fallbackOrderId}`);
      } else {
        console.warn('AdminDashboard: Fallback order found but missing ID');
        toast.error('Unable to open order summary - no valid order ID found');
      }
    } else {
      // No orders available - redirect to orders page
      console.log('AdminDashboard: No orders available, redirecting to orders page');
      navigate('/orders');
      toast.info('No orders available. Please create an order first.');
    }
  }, [recentOrders, sortedOrders, navigate, dispatch, notificationCounts]);

  // Setup polling for notification counts
// Setup polling for notification counts
  useEffect(() => {
    // Initial fetch
    fetchNotificationCountsData();

    // Setup 30-second polling
    pollingRef.current = setInterval(fetchNotificationCountsData, 30000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
}, [fetchNotificationCountsData]);

// Load vendor data for vendor control panel
const loadVendorData = async () => {
  setVendorLoading(true);
  try {
    const vendorList = await vendorService.getAllVendors();
    const productList = await productService.getAll('admin');
    setVendors(vendorList);
    setAvailableProducts(productList);
  } catch (error) {
    console.error('Error loading vendor data:', error);
    toast.error('Failed to load vendor data');
  } finally {
    setVendorLoading(false);
  }
};

// Vendor control functions
const toggleVendorStatus = async (vendorId, status) => {
  try {
    await vendorService.toggleVendorStatus(vendorId, status);
    await vendorService.logAdminAction(`Vendor ${vendorId} ${status}`);
    toast.success(`Vendor ${status} successfully`);
    loadVendorData(); // Refresh vendor list
  } catch (error) {
    console.error('Error toggling vendor status:', error);
    toast.error(`Failed to ${status} vendor`);
  }
};

const assignProducts = async (vendorId, productIds) => {
  try {
    await productService.assignProductsToVendor(vendorId, productIds);
    await vendorService.notifyVendor(vendorId, "New products assigned");
    toast.success(`${productIds.length} products assigned successfully`);
    setSelectedProducts([]);
    setSelectedVendor(null);
  } catch (error) {
    console.error('Error assigning products:', error);
    toast.error('Failed to assign products');
  }
};

useEffect(() => {
    loadDashboardData();
    loadPaymentVerificationReport();
    
    // Start auto-refresh for payment verification report
    if (autoRefreshEnabled) {
      startAutoRefresh();
    }
    
    return () => {
      if (reportRefreshRef.current) {
        clearInterval(reportRefreshRef.current);
      }
    };
  }, []);

useEffect(() => {
  if (showVendorControl) {
    loadVendorData();
  }
}, [showVendorControl]);
  // Handle auto-refresh toggle
  useEffect(() => {
    if (autoRefreshEnabled) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
    
    return () => {
      if (reportRefreshRef.current) {
        clearInterval(reportRefreshRef.current);
      }
    };
  }, [autoRefreshEnabled]);
  // Initialize WebSocket connection and approval workflows
useEffect(() => {
    const initializeApprovalWorkflow = async () => {
      try {
        // Initialize WebSocket connection
        await webSocketService.connect();
        
        // Get connection status after connection attempt
        const connectionStatus = webSocketService.getConnectionStatus();
        setWsConnectionStatus(connectionStatus);
        
        // Subscribe to approval workflow updates only if connection is successful
        if (connectionStatus?.connected) {
          wsUnsubscribeRef.current = webSocketService.subscribeToApprovalUpdates((update) => {
            dispatch(addRealTimeNotification({
              id: `notif_${Date.now()}`,
              type: update.type,
              data: update.data,
              timestamp: new Date().toISOString()
            }));
            
            // Handle specific approval events
            if (update.type === 'approval_status_changed') {
              dispatch(updateApprovalStatus(update.data));
              toast.info(`Approval request ${update.data.status}`);
            }
          });
        }
        
        // Set connection status in Redux
        dispatch(setConnectionStatus(connectionStatus?.connected || false));
        
        // Load pending approvals
        dispatch(fetchPendingApprovals());
        
      } catch (error) {
        console.error('Failed to initialize approval workflow:', error);
        toast.warning('Real-time updates may be limited');
        
        // Ensure connection status is set to false on error
        dispatch(setConnectionStatus(false));
      }
    };
    
    initializeApprovalWorkflow();
    
    return () => {
      if (wsUnsubscribeRef.current) {
        wsUnsubscribeRef.current();
      }
    };
  }, [dispatch]);

  // Handle approval actions
// Handle approval actions
  const handleApprovalAction = async (action, requestId, comments = '') => {
    try {
      if (action === 'approve') {
        await dispatch(approveRequest({ requestId, comments })).unwrap();
        toast.success('Approval request approved successfully');
      } else if (action === 'reject') {
        if (!comments.trim()) {
          toast.error('Rejection comments are required');
          return;
        }
        await dispatch(rejectRequest({ requestId, comments })).unwrap();
        toast.success('Approval request rejected');
      }
      
      setSelectedApproval(null);
      setApprovalComments('');
      setShowApprovalModal(false);
      setSelectedApprovals(selectedApprovals.filter(id => id !== requestId));
      
      // Refresh approvals list
      dispatch(fetchPendingApprovals());
      
    } catch (error) {
      toast.error(`Failed to ${action} request: ${error.message}`);
    }
  };

  // Handle bulk approval actions
  const handleBulkApproval = () => {
    if (selectedApprovals.length === 0) {
      toast.warning('Please select approval requests to approve');
      return;
    }
    setBulkActionType('approve');
    setShowBulkConfirmModal(true);
  };

  const handleBulkRejection = () => {
    if (selectedApprovals.length === 0) {
      toast.warning('Please select approval requests to reject');
      return;
    }
    setBulkActionType('reject');
    setShowBulkConfirmModal(true);
  };

  const processBulkAction = async (comments = '') => {
    try {
      if (bulkActionType === 'reject' && !comments.trim()) {
        toast.error('Rejection comments are required for bulk rejection');
        return;
      }

      setLoading(true);
      const promises = selectedApprovals.map(requestId => {
        if (bulkActionType === 'approve') {
          return dispatch(approveRequest({ requestId, comments })).unwrap();
        } else {
          return dispatch(rejectRequest({ requestId, comments })).unwrap();
        }
      });

      await Promise.all(promises);
      
      toast.success(`Successfully ${bulkActionType}d ${selectedApprovals.length} approval requests`);
      setSelectedApprovals([]);
      setShowBulkConfirmModal(false);
      setBulkActionType('');
      setApprovalComments('');
      
      // Refresh approvals list
      dispatch(fetchPendingApprovals());
      
    } catch (error) {
      toast.error(`Failed to process bulk ${bulkActionType}: ${error.message}`);
    } finally {
setLoading(false);
    }
  };

  const openApprovalModal = (approval, action) => {
    setSelectedApproval({ ...approval, action });
    setApprovalComments('');
    setShowApprovalModal(true);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Loading type="dashboard" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Error message={error} onRetry={loadDashboardData} />
      </div>
    );
  }

const handleWalletAction = async (action, amount = 0) => {
    setWalletLoading(true);
    try {
      let result;
      switch (action) {
        case 'deposit':
          result = await paymentService.depositToWallet(amount);
          toast.success(`Deposited Rs. ${amount.toLocaleString()} to wallet`);
          break;
        case 'withdraw':
          result = await paymentService.withdrawFromWallet(amount);
          toast.success(`Withdrew Rs. ${amount.toLocaleString()} from wallet`);
          break;
        case 'transfer':
          result = await paymentService.transferFromWallet(amount);
          toast.success(`Transferred Rs. ${amount.toLocaleString()} from wallet`);
          break;
        default:
          break;
      }
      loadDashboardData();
    } catch (error) {
      toast.error(error.message || 'Wallet operation failed');
    } finally {
      setWalletLoading(false);
    }
  };

const quickActions = [
    // Critical Priority
    { label: 'Payment Verification', path: '/admin/payments?tab=verification', icon: 'Shield', color: 'from-orange-500 to-red-500', notificationKey: 'verification', priority: 'critical' },
    { label: 'Order Summary', path: '/order-summary', icon: 'Clipboard', color: 'from-blue-500 to-indigo-500', notificationKey: 'orderSummary', priority: 'critical', isAction: true },
    { label: 'View Orders', path: '/orders', icon: 'ShoppingCart', color: 'from-purple-500 to-pink-500', notificationKey: 'orders', priority: 'critical' },
    { label: 'POS Terminal', path: '/admin/pos', icon: 'Calculator', color: 'from-green-500 to-emerald-500', notificationKey: 'pos', priority: 'critical' },
    
    // High Priority
    { label: 'Financial Dashboard', path: '/admin/financial-dashboard', icon: 'DollarSign', color: 'from-emerald-500 to-teal-500', notificationKey: 'financial', priority: 'high' },
    { label: 'Payment Management', path: '/admin/payments', icon: 'CreditCard', color: 'from-teal-500 to-cyan-500', notificationKey: 'payments', priority: 'high' },
    { label: 'Delivery Tracking', path: '/admin/delivery-dashboard', icon: 'MapPin', color: 'from-indigo-500 to-purple-500', notificationKey: 'delivery', priority: 'high' },
    { label: 'Manage Products', path: '/admin/products', icon: 'Package', color: 'from-blue-500 to-cyan-500', notificationKey: 'products', priority: 'high' },
    
// Medium Priority
{ label: 'Analytics', path: '/admin/analytics', icon: 'TrendingUp', color: 'from-amber-500 to-orange-500', notificationKey: 'analytics', priority: 'medium' },
    { label: 'Vendor Management', path: '/admin/vendors', icon: 'Users', color: 'from-red-500 to-pink-500', notificationKey: 'vendorControl', priority: 'high' },
    { label: 'Vendor Portal', path: '/vendor-portal', icon: 'Store', color: 'from-purple-500 to-violet-500', notificationKey: 'vendor', role: ['admin', 'moderator'], priority: 'medium' },
    { label: 'AI Generate', path: '/admin/ai-generate', icon: 'Brain', color: 'from-purple-500 to-indigo-500', notificationKey: 'ai', priority: 'medium' },
    { label: 'Role Assignment', path: '/role-management', icon: 'Settings', color: 'from-amber-500 to-yellow-500', notificationKey: 'roles', role: ['admin'], priority: 'medium' }
];

// Priority indicator configuration
const priorityConfig = {
  critical: { color: 'bg-red-500', text: 'Critical', textColor: 'text-red-600' },
  high: { color: 'bg-orange-500', text: 'High', textColor: 'text-orange-600' },
  medium: { color: 'bg-blue-500', text: 'Medium', textColor: 'text-blue-600' }
};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Manage your FreshMart store</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-xl">
<div className="flex items-center justify-between">
<div>
              <p className="text-green-100 text-sm">Wallet Balance</p>
              <p className="text-2xl font-bold">Rs. {(stats?.walletBalance || 0).toLocaleString()}</p>
            </div>
            <ApperIcon name="Wallet" size={32} className="text-green-100" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Transactions</p>
              <p className="text-2xl font-bold">{(stats?.totalTransactions || 0).toLocaleString()}</p>
            </div>
            <ApperIcon name="CreditCard" size={32} className="text-blue-100" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white p-6 rounded-xl">
          <div className="flex items-center justify-between">
<div>
              <p className="text-purple-100 text-sm">Monthly Revenue</p>
              <p className="text-2xl font-bold">Rs. {(stats?.monthlyRevenue || 0).toLocaleString()}</p>
            </div>
            <ApperIcon name="TrendingUp" size={32} className="text-purple-100" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Pending Verifications</p>
              <p className="text-2xl font-bold">{(stats?.pendingVerifications || 0).toLocaleString()}</p>
            </div>
            <ApperIcon name="Clock" size={32} className="text-orange-100" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-6 rounded-xl">
          <div className="flex items-center justify-between">
<div>
              <p className="text-emerald-100 text-sm">Today's Revenue</p>
              <p className="text-2xl font-bold">Rs. {(stats?.todayRevenue || 0).toLocaleString()}</p>
            </div>
            <ApperIcon name="DollarSign" size={32} className="text-emerald-100" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white p-6 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-violet-100 text-sm">Today's Orders</p>
              <p className="text-2xl font-bold">{(todayOrders?.length || 0).toLocaleString()}</p>
            </div>
            <ApperIcon name="ShoppingCart" size={32} className="text-violet-100" />
          </div>
        </div>
      </div>

      {/* Quick Actions and Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
{/* Quick Actions */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
            <div className="flex items-center space-x-2 text-xs">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-gray-600">Critical</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span className="text-gray-600">High</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-600">Medium</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
{quickActions.map((action) => {
              const badgeCount = notificationCounts[action.notificationKey] || 0;
              const priorityInfo = priorityConfig[action.priority];
              
              return (
action.isAction ? (
                  <button
                    key={action.path}
                    onClick={() => {
                      if (action.path === '#vendor-control') {
                        setShowVendorControl(!showVendorControl);
                      } else if (action.path === '/order-summary') {
                        handleOrderSummaryClick();
                      }
                    }}
                    className="group w-full text-left"
                  >
                    <div className="relative p-4 rounded-lg border border-gray-200 hover:border-primary hover:shadow-md transition-all duration-200">
                      {/* Priority indicator */}
                      <div className="absolute top-2 right-2 flex items-center space-x-1">
                        <div className={`w-2 h-2 ${priorityInfo.color} rounded-full`}></div>
                        <span className={`text-xs font-medium ${priorityInfo.textColor}`}>
                          {priorityInfo.text}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-3 mt-2">
                        <div className={`relative bg-gradient-to-r ${action.color} p-2 rounded-lg`}>
                          <ApperIcon name={action.icon} size={20} className="text-white" />
                          {badgeCount > 0 && (
                            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center min-w-[20px] shadow-lg">
                              {badgeCount > 99 ? '99+' : badgeCount}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <span className="font-medium text-gray-900 group-hover:text-primary transition-colors block">
                            {action.label}
                          </span>
                          <span className={`text-xs ${priorityInfo.textColor} opacity-75`}>
                            {priorityInfo.text} Priority
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ) : (
                  <Link
                    key={action.path}
                    to={action.path}
                    className="group"
                    onClick={() => handleTabClick(action.path)}
                  >
                    <div className="relative p-4 rounded-lg border border-gray-200 hover:border-primary hover:shadow-md transition-all duration-200">
                      {/* Priority indicator */}
                      <div className="absolute top-2 right-2 flex items-center space-x-1">
                        <div className={`w-2 h-2 ${priorityInfo.color} rounded-full`}></div>
                        <span className={`text-xs font-medium ${priorityInfo.textColor}`}>
                          {priorityInfo.text}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-3 mt-2">
                        <div className={`relative bg-gradient-to-r ${action.color} p-2 rounded-lg`}>
                          <ApperIcon name={action.icon} size={20} className="text-white" />
                          {badgeCount > 0 && (
                            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center min-w-[20px] shadow-lg">
                              {badgeCount > 99 ? '99+' : badgeCount}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <span className="font-medium text-gray-900 group-hover:text-primary transition-colors block">
                            {action.label}
                          </span>
                          <span className={`text-xs ${priorityInfo.textColor} opacity-75`}>
                            {priorityInfo.text} Priority
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              );
            })}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Recent Orders</h2>
            <Link to="/orders" className="text-primary hover:text-primary-dark transition-colors">
              View All
            </Link>
          </div>
          
          {recentOrders.length === 0 ? (
            <div className="text-center py-8">
              <ApperIcon name="Package" size={48} className="text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No recent orders</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="bg-primary p-2 rounded-lg">
                      <ApperIcon name="Package" size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Order #{order?.id || 'Unknown'}</p>
                      <p className="text-sm text-gray-600">{format(new Date(order?.createdAt || new Date()), 'MMM dd, yyyy')}</p>
                    </div>
</div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">Rs. {(order?.total || 0).toLocaleString()}</p>
                    <p className="text-sm text-gray-600">{order?.status || 'Unknown'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
</div>
      </div>

      {/* Payment Verification Report Section */}
      <div className="card p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-2 rounded-lg">
              <ApperIcon name="Shield" size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Payment Verification Report</h2>
              <div className="flex items-center space-x-4 mt-1">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-sm font-medium text-red-600">Critical Priority</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span>Last updated: {format(new Date(paymentVerificationData.metadata.lastRefresh), 'HH:mm:ss')}</span>
                  <span>|</span>
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${autoRefreshEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                    <span>Auto-refresh: {autoRefreshEnabled ? '15s' : 'Off'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                autoRefreshEnabled 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {autoRefreshEnabled ? 'Auto-refresh On' : 'Auto-refresh Off'}
            </button>
            <button
              onClick={() => loadPaymentVerificationReport(reportFilters)}
              disabled={reportLoading}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors disabled:opacity-50"
            >
              {reportLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Report Tabs */}
        <div className="flex space-x-1 mb-6 border-b border-gray-200">
          {[
            { id: 'summary', label: 'Summary', icon: 'BarChart3' },
            { id: 'detailed', label: 'Detailed', icon: 'FileText' },
            { id: 'export', label: 'Export', icon: 'Download' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveReportTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-t-lg font-medium transition-colors ${
                activeReportTab === tab.id
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <ApperIcon name={tab.icon} size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Report Content */}
        {reportLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loading type="spinner" />
          </div>
        ) : reportError ? (
          <div className="text-center py-12">
            <Error message={reportError} onRetry={() => loadPaymentVerificationReport(reportFilters)} />
          </div>
        ) : (
          <div>
            {/* Summary Tab */}
            {activeReportTab === 'summary' && (
              <div className="space-y-6">
{/* Enhanced Payment Flow Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-orange-100 text-sm">💳 Payment Processed</p>
                        <p className="text-2xl font-bold">{paymentVerificationData.summary.vendorProcessed || 0}</p>
                        <p className="text-xs text-orange-200">Vendor Stage</p>
                      </div>
                      <ApperIcon name="CreditCard" size={24} className="text-orange-100" />
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 text-sm">✔️ Admin Paid</p>
                        <p className="text-2xl font-bold">{paymentVerificationData.summary.adminConfirmed || 0}</p>
                        <p className="text-xs text-blue-200">Admin Stage</p>
                      </div>
                      <ApperIcon name="CheckCircle" size={24} className="text-blue-100" />
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100 text-sm">📄 Proof Uploaded</p>
                        <p className="text-2xl font-bold">{paymentVerificationData.summary.proofUploaded || 0}</p>
                        <p className="text-xs text-green-200">Verification Stage</p>
                      </div>
                      <ApperIcon name="Upload" size={24} className="text-green-100" />
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100 text-sm">🔍 Auto-Matched</p>
                        <p className="text-2xl font-bold">{paymentVerificationData.summary.autoMatched || 0}</p>
                        <p className="text-xs text-purple-200">System Verification</p>
                      </div>
                      <ApperIcon name="Search" size={24} className="text-purple-100" />
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-teal-100 text-sm">✅ Vendor Confirmed</p>
                        <p className="text-2xl font-bold">{paymentVerificationData.summary.vendorConfirmed || 0}</p>
                        <p className="text-xs text-teal-200">Final Stage</p>
                      </div>
                      <ApperIcon name="ShieldCheck" size={24} className="text-teal-100" />
                    </div>
                  </div>
                </div>

                {/* Real-time Payment Flow Progress */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Payment Flow Progress</h3>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-600">Real-time</span>
                    </div>
                  </div>
                  
                  {/* Progress Flow Visualization */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {[
                      { stage: 'vendor_processed', label: 'Vendor Processing', icon: 'User', count: paymentVerificationData.summary.vendorProcessed || 0 },
                      { stage: 'admin_paid', label: 'Admin Confirmation', icon: 'Shield', count: paymentVerificationData.summary.adminConfirmed || 0 },
                      { stage: 'proof_uploaded', label: 'Proof Upload', icon: 'FileText', count: paymentVerificationData.summary.proofUploaded || 0 },
                      { stage: 'amount_matched', label: 'Auto-Match', icon: 'Check', count: paymentVerificationData.summary.autoMatched || 0 },
                      { stage: 'vendor_confirmed', label: 'Final Confirmation', icon: 'CheckCircle', count: paymentVerificationData.summary.vendorConfirmed || 0 }
                    ].map((flow, index) => (
                      <div key={flow.stage} className="relative">
                        <div className="flex flex-col items-center p-4 bg-white rounded-lg border">
                          <div className="bg-blue-100 p-3 rounded-full mb-2">
                            <ApperIcon name={flow.icon} size={20} className="text-blue-600" />
                          </div>
                          <h4 className="font-medium text-gray-900 text-sm text-center mb-1">{flow.label}</h4>
                          <span className="text-2xl font-bold text-blue-600">{flow.count}</span>
                        </div>
                        {index < 4 && (
                          <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-0.5 bg-gray-300 transform -translate-y-1/2">
                            <ApperIcon name="ChevronRight" size={16} className="absolute -top-2 -right-1 text-gray-400" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Methods with Flow Status */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-3">Payment Methods & Flow Distribution</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(paymentVerificationData.summary.byPaymentMethod || {}).map(([method, count]) => (
                      <div key={method} className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="bg-blue-100 p-2 rounded-lg">
                            <ApperIcon name="CreditCard" size={16} className="text-blue-600" />
                          </div>
                          <div>
                            <span className="font-medium text-gray-900 capitalize">{method}</span>
                            <div className="text-xs text-gray-500">Flow Active</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-900 font-semibold">{count}</span>
                          <div className="w-2 h-2 bg-green-500 rounded-full ml-auto"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Tab */}
            {activeReportTab === 'detailed' && (
              <div className="space-y-6">
                {/* Filters */}
<div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-3">Enhanced Filters</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={reportFilters.startDate}
                        onChange={(e) => handleFilterChange('startDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                      <input
                        type="date"
                        value={reportFilters.endDate}
                        onChange={(e) => handleFilterChange('endDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                      <input
                        type="text"
                        value={reportFilters.vendor}
                        onChange={(e) => handleFilterChange('vendor', e.target.value)}
                        placeholder="Search vendor..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                      <select
                        value={reportFilters.paymentMethod}
                        onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">All Methods</option>
                        <option value="jazzcash">JazzCash</option>
                        <option value="easypaisa">EasyPaisa</option>
                        <option value="bank">Bank Transfer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Flow Stage</label>
                      <select
                        value={reportFilters.flowStage}
                        onChange={(e) => handleFilterChange('flowStage', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">All Stages</option>
                        <option value="vendor_processed">💳 Vendor Processed</option>
                        <option value="admin_paid">✔️ Admin Paid</option>
                        <option value="proof_uploaded">📄 Proof Uploaded</option>
                        <option value="amount_matched">🔍 Auto-Matched</option>
                        <option value="vendor_confirmed">✅ Vendor Confirmed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Verification Status</label>
                      <select
                        value={reportFilters.verificationStatus}
                        onChange={(e) => handleFilterChange('verificationStatus', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="verified">Verified</option>
                        <option value="rejected">Rejected</option>
                        <option value="matched">Auto-Matched</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Detailed Data Table */}
                <div className="bg-white rounded-lg overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900">Pending Verifications</h3>
                  </div>
                  <div className="overflow-x-auto">
<table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Flow Stage</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
{paymentVerificationData.data.map((verification) => {
                          const flowStageIcons = {
                            vendor_processed: { icon: 'CreditCard', color: 'text-orange-600' },
                            admin_paid: { icon: 'CheckCircle', color: 'text-blue-600' },
                            proof_uploaded: { icon: 'Upload', color: 'text-green-600' },
                            amount_matched: { icon: 'Search', color: 'text-purple-600' },
                            vendor_confirmed: { icon: 'ShieldCheck', color: 'text-teal-600' }
                          };
                          
                          const currentStage = flowStageIcons[verification.flowStage] || { icon: 'Clock', color: 'text-gray-600' };
                          
                          return (
                            <tr key={verification.Id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                #{verification.orderId}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {verification.customerName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                Rs. {(verification.amount || 0).toLocaleString()}
                                {verification.amountMatched && (
                                  <div className="text-xs text-green-600">✓ Auto-matched</div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                                {verification.paymentMethod || 'Unknown'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                  <ApperIcon name={currentStage.icon} size={16} className={currentStage.color} />
                                  <span className="text-xs text-gray-600 capitalize">
                                    {(verification.flowStage || 'pending').replace('_', ' ')}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {format(new Date(verification.submittedAt), 'MMM dd, HH:mm')}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                  <Badge variant="warning" className="text-xs">
                                    {verification.verificationStatus}
                                  </Badge>
                                  {verification.vendorConfirmed && (
                                    <Badge variant="success" className="text-xs">✓ Confirmed</Badge>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex space-x-2">
                                  <button className="text-blue-600 hover:text-blue-800">
                                    <ApperIcon name="Eye" size={16} />
                                  </button>
                                  <button className="text-green-600 hover:text-green-800">
                                    <ApperIcon name="Check" size={16} />
                                  </button>
                                  <button className="text-red-600 hover:text-red-800">
                                    <ApperIcon name="X" size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
})}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

{/* Export Tab */}
            {activeReportTab === 'export' && (
              <div className="space-y-6">
                {/* Export Options with Price Selection */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">Export Options with Selected Prices</h3>
                  <p className="text-gray-600 mb-6">Generate and download reports with pricing data and margin analysis</p>
                  
                  {/* Price Selection Options */}
                  <div className="bg-white p-4 rounded-lg border mb-6">
                    <h4 className="font-medium text-gray-900 mb-3">📊 Price Data Selection</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary" defaultChecked />
                        <span className="text-sm font-medium">Base Prices</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary" defaultChecked />
                        <span className="text-sm font-medium">Discounted Prices</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary" />
                        <span className="text-sm font-medium">Purchase Costs</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary" defaultChecked />
                        <span className="text-sm font-medium">Profit Margins</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary" />
                        <span className="text-sm font-medium">Revenue Impact</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary" />
                        <span className="text-sm font-medium">Cost Analysis</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Margin Analysis Tools */}
                  <div className="bg-white p-4 rounded-lg border mb-6">
                    <h4 className="font-medium text-gray-900 mb-3">📈 Margin Analysis Tools</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-green-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <ApperIcon name="TrendingUp" size={16} className="text-green-600" />
                          <span className="text-sm font-medium text-green-800">High Margin</span>
                        </div>
                        <p className="text-lg font-bold text-green-600">
                          {paymentVerificationData.data.filter(item => (item.profitMargin || 0) > 25).length}
                        </p>
                        <p className="text-xs text-green-600">Items > 25% margin</p>
                      </div>
                      
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <ApperIcon name="BarChart3" size={16} className="text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">Average Margin</span>
                        </div>
                        <p className="text-lg font-bold text-blue-600">
                          {Math.round(paymentVerificationData.data.reduce((sum, item) => sum + (item.profitMargin || 0), 0) / Math.max(paymentVerificationData.data.length, 1) * 100) / 100}%
                        </p>
                        <p className="text-xs text-blue-600">Across all items</p>
                      </div>
                      
                      <div className="bg-orange-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <ApperIcon name="AlertTriangle" size={16} className="text-orange-600" />
                          <span className="text-sm font-medium text-orange-800">Low Margin</span>
                        </div>
                        <p className="text-lg font-bold text-orange-600">
                          {paymentVerificationData.data.filter(item => (item.profitMargin || 0) < 10).length}
                        </p>
                        <p className="text-xs text-orange-600">Items < 10% margin</p>
                      </div>
                      
                      <div className="bg-red-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <ApperIcon name="TrendingDown" size={16} className="text-red-600" />
                          <span className="text-sm font-medium text-red-800">Loss Items</span>
                        </div>
                        <p className="text-lg font-bold text-red-600">
                          {paymentVerificationData.data.filter(item => (item.profitMargin || 0) < 0).length}
                        </p>
                        <p className="text-xs text-red-600">Negative margin</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Revenue Impact Analysis */}
                  <div className="bg-white p-4 rounded-lg border mb-6">
                    <h4 className="font-medium text-gray-900 mb-3">💰 Revenue Impact Analysis</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">
                          Rs. {paymentVerificationData.data.reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">Total Revenue</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">
                          Rs. {Math.round(paymentVerificationData.data.reduce((sum, item) => sum + ((item.amount || 0) * (item.profitMargin || 0) / 100), 0)).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">Estimated Profit</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-600">
                          Rs. {Math.round(paymentVerificationData.data.reduce((sum, item) => sum + ((item.amount || 0) * (1 - (item.profitMargin || 0) / 100)), 0)).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">Estimated Costs</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Enhanced Export Buttons */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={() => handleExportReport('pdf')}
                      disabled={exportLoading}
                      className="flex items-center justify-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      <ApperIcon name="FileText" size={20} className="text-red-600" />
                      <div className="text-left">
                        <span className="font-medium text-red-600 block">Export PDF</span>
                        <span className="text-xs text-red-500">With margin analysis</span>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => handleExportReport('csv')}
                      disabled={exportLoading}
                      className="flex items-center justify-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                    >
                      <ApperIcon name="Download" size={20} className="text-green-600" />
                      <div className="text-left">
                        <span className="font-medium text-green-600 block">Export CSV</span>
                        <span className="text-xs text-green-500">Raw data with prices</span>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => handleExportReport('xlsx')}
                      disabled={exportLoading}
                      className="flex items-center justify-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                      <ApperIcon name="BarChart3" size={20} className="text-blue-600" />
                      <div className="text-left">
                        <span className="font-medium text-blue-600 block">Export Excel</span>
                        <span className="text-xs text-blue-500">Advanced analysis</span>
                      </div>
                    </button>
                  </div>
                  
                  {/* Price Visibility Controls */}
                  <div className="mt-6 bg-amber-50 border border-amber-200 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <ApperIcon name="Shield" size={16} className="text-amber-600" />
                      <h4 className="font-medium text-amber-800">Price Visibility Controls</h4>
                    </div>
                    <p className="text-sm text-amber-700 mb-3">
                      Exported data includes sensitive pricing information. Ensure secure handling and authorized access only.
                    </p>
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary" />
                        <span className="text-sm font-medium text-amber-800">Include purchase costs</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary" />
                        <span className="text-sm font-medium text-amber-800">Include profit margins</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary" defaultChecked />
                        <span className="text-sm font-medium text-amber-800">Mask sensitive data</span>
                      </label>
                    </div>
                  </div>
                  
                  {exportLoading && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Loading type="spinner" size="sm" />
                        <span className="text-blue-600">Generating export with pricing analysis...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
{/* Wallet Management */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Wallet Actions */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Wallet Management</h2>
          <div className="space-y-3">
            <Button
              onClick={() => handleWalletAction('deposit', 5000)}
              disabled={walletLoading}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
            >
              <ApperIcon name="Plus" size={16} className="mr-2" />
              Deposit Rs. 5,000
            </Button>
            <Button
              onClick={() => handleWalletAction('withdraw', 1000)}
              disabled={walletLoading}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
            >
              <ApperIcon name="Minus" size={16} className="mr-2" />
              Withdraw Rs. 1,000
            </Button>
            <Button
              onClick={() => handleWalletAction('transfer', 2000)}
              disabled={walletLoading}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              <ApperIcon name="Send" size={16} className="mr-2" />
              Transfer Rs. 2,000
            </Button>
          </div>
        </div>

        {/* Revenue Breakdown */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Revenue by Payment Method</h2>
          {revenueBreakdown.length === 0 ? (
            <div className="text-center py-8">
              <ApperIcon name="PieChart" size={48} className="text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No revenue data</p>
            </div>
          ) : (
<div className="space-y-3">
              {revenueBreakdown.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="bg-primary p-2 rounded-lg">
                      <ApperIcon name="CreditCard" size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 capitalize">{item?.method || 'Unknown'}</p>
                      <p className="text-sm text-gray-600">Payment method</p>
                    </div>
                  </div>
                  <p className="font-medium text-gray-900">Rs. {(item?.amount || 0).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Wallet Transactions */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Wallet Transactions</h2>
          {walletTransactions.length === 0 ? (
            <div className="text-center py-8">
              <ApperIcon name="Wallet" size={48} className="text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No wallet transactions</p>
            </div>
          ) : (
            <div className="space-y-3">
{walletTransactions.map((transaction) => (
                <div key={transaction?.id || transaction?.Id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      transaction.type === 'deposit' ? 'bg-green-100' : 
                      transaction.type === 'withdraw' ? 'bg-red-100' : 'bg-blue-100'
                    }`}>
                      <ApperIcon 
                        name={transaction.type === 'deposit' ? 'ArrowDown' : 
                              transaction.type === 'withdraw' ? 'ArrowUp' : 'ArrowRight'} 
                        size={16} 
                        className={
                          transaction.type === 'deposit' ? 'text-green-600' : 
                          transaction.type === 'withdraw' ? 'text-red-600' : 'text-blue-600'
                        } 
                      />
                    </div>
<div>
                      <p className="font-medium text-gray-900 capitalize">{transaction?.type || 'Unknown'}</p>
                      <p className="text-sm text-gray-600">
                        {format(new Date(transaction?.timestamp || new Date()), 'MMM dd, hh:mm a')}
                      </p>
                    </div>
                  </div>
                  <p className={`font-medium ${
                    transaction?.type === 'deposit' ? 'text-green-600' : 
                    transaction?.type === 'withdraw' ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    {transaction?.type === 'deposit' ? '+' : '-'}Rs. {(transaction?.amount || 0).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
</div>
      </div>

{/* Enhanced Approval Workflow Section */}
      <div className="space-y-8 mb-8">
        {/* Approval Management Panel */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 p-2 rounded-lg">
                <ApperIcon name="Shield" size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Admin Approval Panel</h2>
                <div className="flex items-center space-x-4 mt-1">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-sm font-medium text-orange-600">Critical Priority</span>
                  </div>
                  {realTimeUpdates.connected && (
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-600">Live Updates</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="warning" className="text-sm">
                {pendingApprovals.length} pending
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatch(fetchPendingApprovals())}
                disabled={approvalLoading}
                icon="RefreshCw"
              >
                {approvalLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>

          {/* Approval Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Pending Queue</p>
                  <p className="text-2xl font-bold">{pendingApprovals.length}</p>
                </div>
                <ApperIcon name="Clock" size={24} className="text-orange-100" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Urgent Priority</p>
                  <p className="text-2xl font-bold">
                    {pendingApprovals.filter(req => req.priority === 'urgent').length}
                  </p>
                </div>
                <ApperIcon name="AlertTriangle" size={24} className="text-green-100" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Financial Impact</p>
                  <p className="text-2xl font-bold">
                    Rs. {pendingApprovals.reduce((sum, req) => 
                      sum + Math.abs(req.businessImpact?.revenueImpact || 0), 0
                    ).toLocaleString()}
                  </p>
                </div>
                <ApperIcon name="DollarSign" size={24} className="text-blue-100" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Avg. Processing</p>
                  <p className="text-2xl font-bold">2.4h</p>
                </div>
                <ApperIcon name="Timer" size={24} className="text-purple-100" />
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedApprovals.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <ApperIcon name="CheckSquare" size={20} className="text-blue-600" />
                  <span className="font-medium text-blue-900">
                    {selectedApprovals.length} approval{selectedApprovals.length > 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleBulkApproval()}
                    icon="Check"
                  >
                    Bulk Approve
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleBulkRejection()}
                    icon="X"
                  >
                    Bulk Reject
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedApprovals([])}
                    icon="Square"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Pending Approvals Queue */}
          {approvalLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loading type="spinner" />
            </div>
          ) : pendingApprovals.length === 0 ? (
            <div className="text-center py-12">
              <ApperIcon name="CheckCircle" size={48} className="text-green-400 mx-auto mb-4" />
              <p className="text-gray-600">No pending approvals</p>
              <p className="text-sm text-gray-500 mt-2">All approval requests have been processed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingApprovals.map((approval) => (
                <div key={approval.Id} className="bg-gray-50 p-4 rounded-lg border-l-4 border-orange-400 hover:bg-gray-100 transition-colors">
                  <div className="flex items-start space-x-4">
                    {/* Selection Checkbox */}
                    <div className="flex items-center pt-1">
                      <input
                        type="checkbox"
                        checked={selectedApprovals.includes(approval.Id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedApprovals([...selectedApprovals, approval.Id]);
                          } else {
                            setSelectedApprovals(selectedApprovals.filter(id => id !== approval.Id));
                          }
                        }}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </div>
                    
                    {/* Approval Details */}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-medium text-gray-900">{approval.title}</h3>
                        <Badge 
                          variant={approval.priority === 'urgent' ? 'error' : approval.priority === 'high' ? 'warning' : 'info'}
                          className="text-xs"
                        >
                          {approval.priority}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {approval.type.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{approval.description}</p>
                      
                      {/* Business Impact Display */}
                      {approval.businessImpact && (
                        <div className="bg-white p-3 rounded-lg border mb-3">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Revenue Impact:</span>
                              <p className={`font-medium ${approval.businessImpact.revenueImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Rs. {Math.abs(approval.businessImpact.revenueImpact).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-600">Margin Impact:</span>
                              <p className={`font-medium ${approval.businessImpact.marginImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {approval.businessImpact.marginImpact}%
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-600">Customer Impact:</span>
                              <p className="font-medium text-gray-900 capitalize">
                                {approval.businessImpact.customerImpact}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Submitted by: {approval.submittedBy}</span>
                        <span>{format(new Date(approval.submittedAt), 'MMM dd, yyyy HH:mm')}</span>
                        {approval.walletImpact?.requiresHold && (
                          <span className="text-blue-600">
                            Wallet Hold: Rs. {approval.walletImpact.holdAmount.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="Check"
                        onClick={() => openApprovalModal(approval, 'approve')}
                        className="text-green-600 hover:text-green-800 hover:bg-green-50"
                      >
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="X"
                        onClick={() => openApprovalModal(approval, 'reject')}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50"
                      >
                        Reject
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="Eye"
                        onClick={() => openApprovalModal(approval, 'view')}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit Trail */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-2 rounded-lg">
                <ApperIcon name="FileText" size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Approval Audit Trail</h2>
                <p className="text-gray-600">Complete history of approval decisions</p>
              </div>
            </div>
          </div>

          {/* Audit Trail Filters */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">All Statuses</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">All Types</option>
                  <option value="price_change">Price Change</option>
                  <option value="bulk_discount">Bulk Discount</option>
                  <option value="product_removal">Product Removal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="all">All Time</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Approver</label>
                <input
                  type="text"
                  placeholder="Search approver..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Audit Trail Table */}
          <div className="bg-white rounded-lg overflow-hidden border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted By</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Decision</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approved By</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {/* Sample audit trail data - in production, this would come from approval history */}
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Price Update - Organic Tomatoes</div>
                        <div className="text-sm text-gray-500">ID: #1</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="info" className="text-xs">Price Change</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">vendor_1</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="success" className="text-xs">Approved</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">admin_1</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(), 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                      +Rs. 1,500
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

        {/* Real-time System Status */}
        <div className="card p-6">
          <div className="flex items-center space-x-2 mb-4">
            <ApperIcon name="Activity" size={20} className="text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">System Status</h2>
          </div>
          
          <div className="space-y-4">
            {/* WebSocket Connection */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${realTimeUpdates.connected ? 'bg-green-100' : 'bg-red-100'}`}>
                  <ApperIcon 
                    name={realTimeUpdates.connected ? "Wifi" : "WifiOff"} 
                    size={20} 
                    className={realTimeUpdates.connected ? "text-green-600" : "text-red-600"} 
                  />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Real-time Updates</p>
                  <p className={`text-sm ${realTimeUpdates.connected ? 'text-green-600' : 'text-red-600'}`}>
                    {realTimeUpdates.connected ? 'Connected' : 'Disconnected'}
                  </p>
                </div>
              </div>
              <Badge variant={realTimeUpdates.connected ? "success" : "error"} className="text-xs">
                {realTimeUpdates.connected ? 'Live' : 'Offline'}
              </Badge>
            </div>

            {/* Database Status */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <ApperIcon name="Database" size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">MongoDB Database</p>
                  <p className="text-sm text-green-600">Connected</p>
                </div>
              </div>
              <Badge variant="success" className="text-xs">Active</Badge>
            </div>

            {/* Approval Workflow Status */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <ApperIcon name="GitBranch" size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Approval Workflow</p>
                  <p className="text-sm text-blue-600">
                    {pendingApprovals.length} pending, {realTimeUpdates.notifications.length} updates
                  </p>
                </div>
              </div>
              <Badge variant="info" className="text-xs">Active</Badge>
            </div>

            {/* Last Update */}
            {realTimeUpdates.lastUpdate && (
              <div className="text-center text-xs text-gray-500 pt-2 border-t">
                Last update: {format(new Date(realTimeUpdates.lastUpdate), 'HH:mm:ss')}
              </div>
            )}
          </div>
        </div>

        {/* Vendor Fulfillment Monitoring */}
        <div className="card p-6">
          <div className="flex items-center space-x-2 mb-4">
            <ApperIcon name="Users" size={20} className="text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">Vendor Fulfillment Status</h2>
          </div>
          
          <div className="space-y-4">
            {/* Availability Response Tracking */}
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <ApperIcon name="CheckCircle" size={20} className="text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Availability Responses</p>
                  <p className="text-sm text-purple-600">
                    Avg response time: 1.2h
                  </p>
                </div>
              </div>
              <Badge variant="info" className="text-xs">92% on-time</Badge>
            </div>

            {/* Packing Completion Tracking */}
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <ApperIcon name="Package" size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Packing Completion</p>
                  <p className="text-sm text-green-600">
                    24 orders packed today
                  </p>
                </div>
              </div>
              <Badge variant="success" className="text-xs">98% accuracy</Badge>
            </div>

            {/* Real-time Vendor Status */}
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <ApperIcon name="Clock" size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Active Vendors</p>
                  <p className="text-sm text-blue-600">
                    3 vendors processing orders
                  </p>
                </div>
              </div>
              <Badge variant="success" className="text-xs">All Online</Badge>
            </div>

            {/* Fulfillment Pipeline Status */}
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="bg-yellow-100 p-2 rounded-lg">
                  <ApperIcon name="Truck" size={20} className="text-yellow-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Pipeline Status</p>
                  <p className="text-sm text-yellow-600">
                    12 orders in fulfillment
                  </p>
                </div>
              </div>
              <Badge variant="warning" className="text-xs">Processing</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="card p-6 mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Infrastructure Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <ApperIcon name="CheckCircle" size={20} className="text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Payment Gateway</p>
              <p className="text-sm text-green-600">Active</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <ApperIcon name="CheckCircle" size={20} className="text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Inventory Sync</p>
              <p className="text-sm text-green-600">Up to date</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${realTimeUpdates.connected ? 'bg-green-100' : 'bg-yellow-100'}`}>
              <ApperIcon 
                name="Server" 
                size={20} 
                className={realTimeUpdates.connected ? "text-green-600" : "text-yellow-600"} 
              />
            </div>
            <div>
              <p className="font-medium text-gray-900">Node.js Backend</p>
              <p className={`text-sm ${realTimeUpdates.connected ? 'text-green-600' : 'text-yellow-600'}`}>
                {realTimeUpdates.connected ? 'Connected' : 'Connecting...'}
              </p>
            </div>
          </div>
        </div>
</div>

      {/* Vendor Control Panel */}
      {showVendorControl && (
        <div className="card p-6 mt-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-red-500 to-pink-500 p-2 rounded-lg">
                <ApperIcon name="Users" size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Vendor Management Control</h2>
                <p className="text-gray-600">Manage vendor status and product assignments</p>
              </div>
            </div>
            <button
              onClick={() => setShowVendorControl(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ApperIcon name="X" size={24} />
            </button>
          </div>

          {vendorLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loading type="spinner" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Vendor Status Control */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <ApperIcon name="Shield" size={20} className="mr-2 text-red-600" />
                  Vendor Status Control
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {vendors.map((vendor) => (
                    <div key={vendor.Id} className="bg-white p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">{vendor.name}</h4>
                          <p className="text-sm text-gray-600">{vendor.company}</p>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          vendor.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {vendor.isActive ? 'Active' : 'Blocked'}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {vendor.isActive ? (
                          <Button
                            variant="danger"
                            size="small"
                            onClick={() => toggleVendorStatus(vendor.Id, 'blocked')}
                            icon="Ban"
                          >
                            Block
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="small"
                            onClick={() => toggleVendorStatus(vendor.Id, 'active')}
                            icon="CheckCircle"
                          >
                            Activate
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="small"
                          onClick={() => setSelectedVendor(vendor)}
                          icon="Package"
                        >
                          Assign Products
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Product Assignment */}
              {selectedVendor && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <ApperIcon name="Package" size={20} className="mr-2 text-blue-600" />
                    Assign Products to {selectedVendor.name}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4 max-h-64 overflow-y-auto">
                    {availableProducts.map((product) => (
                      <label key={product.id} className="flex items-center space-x-3 p-3 bg-white rounded-lg border cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProducts([...selectedProducts, product.id]);
                            } else {
                              setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                            }
                          }}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{product.name}</p>
                          <p className="text-sm text-gray-600">{product.category}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      {selectedProducts.length} products selected
                    </p>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => {
                          setSelectedVendor(null);
                          setSelectedProducts([]);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="small"
                        onClick={() => assignProducts(selectedVendor.Id, selectedProducts)}
                        disabled={selectedProducts.length === 0}
                        icon="Check"
                      >
                        Assign Selected
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* Approval Action Modal */}
      {showApprovalModal && selectedApproval && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedApproval.action === 'approve' ? 'Approve' : 'Reject'} Request
                </h2>
                <button
                  onClick={() => setShowApprovalModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <ApperIcon name="X" size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Request Details */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2">{selectedApproval.title}</h3>
                <p className="text-gray-600 mb-4">{selectedApproval.description}</p>
                
                {/* Business Impact */}
                {selectedApproval.businessImpact && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Business Impact</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Revenue Impact:</span>
                        <p className={`font-medium ${selectedApproval.businessImpact.revenueImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          Rs. {Math.abs(selectedApproval.businessImpact.revenueImpact).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Margin Impact:</span>
                        <p className={`font-medium ${selectedApproval.businessImpact.marginImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedApproval.businessImpact.marginImpact}%
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Customer Impact:</span>
                        <p className="font-medium text-gray-900 capitalize">
                          {selectedApproval.businessImpact.customerImpact}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Comments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {selectedApproval.action === 'approve' ? 'Approval Comments (Optional)' : 'Rejection Reason (Required)'}
                </label>
                <textarea
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  placeholder={selectedApproval.action === 'approve' 
                    ? 'Add any comments about this approval...' 
                    : 'Please provide a reason for rejection...'}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={4}
                  required={selectedApproval.action === 'reject'}
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
              <Button
                variant="ghost"
                onClick={() => setShowApprovalModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant={selectedApproval.action === 'approve' ? 'primary' : 'secondary'}
                onClick={() => handleApprovalAction(selectedApproval.action, selectedApproval.Id, approvalComments)}
                disabled={selectedApproval.action === 'reject' && !approvalComments.trim()}
                icon={selectedApproval.action === 'approve' ? 'Check' : 'X'}
              >
                {selectedApproval.action === 'approve' ? 'Approve Request' : 'Reject Request'}
              </Button>
            </div>
          </div>
</div>
      )}

      {/* Bulk Action Confirmation Modal */}
      {showBulkConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Bulk {bulkActionType === 'approve' ? 'Approve' : 'Reject'} Requests
                </h2>
                <button
                  onClick={() => setShowBulkConfirmModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <ApperIcon name="X" size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">Selected Requests:</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedApprovals.map(requestId => {
                    const request = pendingApprovals.find(req => req.Id === requestId);
                    return request ? (
                      <div key={requestId} className="flex items-center justify-between p-2 bg-white rounded border">
                        <div>
                          <span className="font-medium text-gray-900">{request.title}</span>
                          <span className="text-sm text-gray-600 ml-2">({request.type})</span>
                        </div>
                        <Badge variant={request.priority === 'urgent' ? 'error' : 'warning'} className="text-xs">
                          {request.priority}
                        </Badge>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {bulkActionType === 'approve' ? 'Approval Comments (Optional)' : 'Rejection Reason (Required)'}
                </label>
                <textarea
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  placeholder={bulkActionType === 'approve' 
                    ? 'Add comments for bulk approval...' 
                    : 'Please provide a reason for bulk rejection...'}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={4}
                  required={bulkActionType === 'reject'}
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
              <Button
                variant="ghost"
                onClick={() => setShowBulkConfirmModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant={bulkActionType === 'approve' ? 'primary' : 'secondary'}
                onClick={() => processBulkAction(approvalComments)}
                disabled={bulkActionType === 'reject' && !approvalComments.trim()}
                icon={bulkActionType === 'approve' ? 'Check' : 'X'}
              >
                {bulkActionType === 'approve' ? 'Approve All' : 'Reject All'} ({selectedApprovals.length})
              </Button>
            </div>
          </div>
        </div>
      )}
</div>
  );
};

export default AdminDashboard;