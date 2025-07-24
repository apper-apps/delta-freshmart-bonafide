import 'react-toastify/dist/ReactToastify.css'
import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { Provider, useDispatch } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { persistor, store } from "@/store/index";
import { addRealTimeNotification, setConnectionStatus, updateApprovalStatus } from "@/store/approvalWorkflowSlice";
import Layout from "@/components/organisms/Layout";
import Loading from "@/components/ui/Loading";
import Cart from "@/components/pages/Cart";
import Checkout from "@/components/pages/Checkout";
import Home from "@/components/pages/Home";
import ProductDetail from "@/components/pages/ProductDetail";
import webSocketService from "@/services/api/websocketService";
// Error boundary for lazy-loaded components
class LazyErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      retryCount: 0,
      isRecovering: false
    };
    this.maxRetries = 2;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Lazy component failed to load:', error, errorInfo);
    
    // Track error for monitoring
    if (typeof window !== 'undefined' && window.performanceMonitor) {
      window.performanceMonitor.trackError(error, 'lazy-component-load');
    }
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState({ isRecovering: true });
      
      setTimeout(() => {
        this.setState({
          hasError: false,
          error: null,
          retryCount: this.state.retryCount + 1,
          isRecovering: false
        });
      }, 1000);
    }
  };

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center p-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Failed to load component</h2>
            <p className="text-gray-600 mb-4">
              {this.state.error?.message?.includes('Loading chunk') 
                ? 'Network issue loading page component. Please check your connection.'
                : 'There was an error loading this page.'
              }
            </p>
            
            {this.state.retryCount < this.maxRetries ? (
              <button
                onClick={this.handleRetry}
                disabled={this.state.isRecovering}
                className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 mr-2"
              >
                {this.state.isRecovering ? 'Retrying...' : `Retry (${this.state.retryCount}/${this.maxRetries})`}
              </button>
            ) : (
              <button
                onClick={this.handleRefresh}
                className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 mr-2"
              >
                Refresh Page
              </button>
            )}
            
            <button
              onClick={() => window.history.back()}
              className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Safe lazy loading with error handling
const createLazyComponent = (importFn, componentName) => {
  let retryCount = 0;
  const maxRetries = 3;
  
  const loadWithRetry = async () => {
    try {
      return await importFn();
    } catch (error) {
      console.error(`Failed to load ${componentName} (attempt ${retryCount + 1}):`, error);
      
      // Enhanced error tracking
      if (typeof window !== 'undefined' && window.performanceMonitor) {
        window.performanceMonitor.trackError(error, `lazy-load-${componentName}`);
      }
      
      // Detailed error logging with recovery suggestions
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        componentName,
        timestamp: new Date().toISOString(),
        retryAttempt: retryCount + 1,
        networkStatus: navigator.onLine ? 'online' : 'offline'
      });
      
      // Provide specific error guidance
      if (error?.message?.includes('Loading chunk')) {
        console.error(`Network issue loading ${componentName}: Check internet connection`);
      } else if (error?.message?.includes('404')) {
        console.error(`File not found: Check if ${componentName} exists in the correct path`);
      } else if (error?.message?.includes('SyntaxError')) {
        console.error(`Syntax error in ${componentName}: Check for JavaScript syntax issues`);
      } else if (error?.message?.includes('import')) {
        console.error(`Import error in ${componentName}: Check import statements and exports`);
      }
      
      // Retry logic for network-related errors
      if (retryCount < maxRetries && 
          (error?.message?.includes('Loading chunk') || 
           error?.message?.includes('fetch') ||
           error?.message?.includes('network'))) {
        retryCount++;
        console.log(`Retrying ${componentName} load (${retryCount}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        return loadWithRetry();
      }
      
      // Return enhanced fallback component with retry capability
      return {
        default: () => (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center p-8 max-w-md mx-auto">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Component Unavailable</h2>
              <p className="text-gray-600 mb-4">
                The {componentName} component could not be loaded.
                {!navigator.onLine && (
                  <span className="block text-orange-600 mt-2">
                    You appear to be offline. Please check your internet connection.
                  </span>
                )}
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-left">
                <p className="text-sm text-red-700 font-medium mb-1">Error Details:</p>
                <p className="text-xs text-red-600 break-all">{error?.message || 'Unknown error'}</p>
                {retryCount > 0 && (
                  <p className="text-xs text-orange-600 mt-1">
                    Failed after {retryCount} retry attempts
                  </p>
                )}
              </div>
              <div className="flex flex-col space-y-2">
                <button
                  onClick={() => window.location.reload()}
                  className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90"
                >
                  Refresh Page
                </button>
                <button
                  onClick={() => window.history.back()}
                  className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600"
                >
                  Go Back
                </button>
                {import.meta.env.DEV && (
                  <button
                    onClick={() => console.log('Full error object:', error)}
                    className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    Log Error to Console
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      };
    }
  };

  return React.lazy(loadWithRetry);
};

// Lazy load heavy components for better performance with error handling
const AdminDashboard = createLazyComponent(() => import('@/components/pages/AdminDashboard'), 'Admin Dashboard');
const ProductManagement = createLazyComponent(() => import('@/components/pages/ProductManagement'), 'Product Management');
const VendorManagement = createLazyComponent(() => import('@/components/pages/VendorManagement'), 'Vendor Management');
const Analytics = createLazyComponent(() => import('@/components/pages/Analytics'), 'Analytics');
const FinancialDashboard = createLazyComponent(() => import('@/components/pages/FinancialDashboard'), 'Financial Dashboard');
const POS = createLazyComponent(() => import('@/components/pages/POS'), 'POS');
const PaymentManagement = createLazyComponent(() => import('@/components/pages/PaymentManagement'), 'Payment Management');
const PayrollManagement = createLazyComponent(() => import('@/components/pages/PayrollManagement'), 'Payroll Management');
const DeliveryTracking = createLazyComponent(() => import('@/components/pages/DeliveryTracking'), 'Delivery Tracking');
const AIGenerate = createLazyComponent(() => import('@/components/pages/AIGenerate'), 'AI Generate');
const Category = createLazyComponent(() => import('@/components/pages/Category'), 'Category');
const Orders = createLazyComponent(() => import('@/components/pages/Orders'), 'Orders');
const OrderSummary = createLazyComponent(() => import('@/components/pages/OrderSummary'), 'Order Summary');
const OrderTracking = createLazyComponent(() => import('@/components/pages/OrderTracking'), 'Order Tracking');
const Account = createLazyComponent(() => import('@/components/pages/Account'), 'Account');
const VendorPortal = createLazyComponent(() => import('@/components/pages/VendorPortal'), 'Vendor Portal');
const RoleAssignment = createLazyComponent(() => import('@/components/pages/RoleAssignment'), 'Role Assignment');
// WebSocket Integration Component
const WebSocketProvider = ({ children }) => {
  const dispatch = useDispatch();

useEffect(() => {
    // Initialize WebSocket connection with comprehensive error handling
    const initializeWebSocket = async () => {
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 5;
      
      const connect = async () => {
        try {
          await webSocketService.connect();
          dispatch(setConnectionStatus(true));
          reconnectAttempts = 0; // Reset on successful connection

          // Subscribe to price approval updates with error handling
          const unsubscribeApprovals = webSocketService.subscribe('price-approvals', (data) => {
            try {
              dispatch(updateApprovalStatus(data));
              dispatch(addRealTimeNotification({
                id: Date.now(),
                type: 'approval_update',
                message: `Price approval ${data.status} for order #${data.orderId}`,
                timestamp: new Date().toISOString()
              }));
            } catch (error) {
              console.error('Error processing approval update:', error);
            }
          });

          // Handle approval update events with error boundaries
          const handleApprovalUpdate = (data) => {
            try {
              dispatch(updateApprovalStatus({
                requestId: data.requestId || data.orderId,
                status: data.status,
                approvedBy: data.approvedBy,
                comments: data.comments
              }));
            } catch (error) {
              console.error('Error handling approval update:', error);
            }
          };

          const unsubscribeStatusChanges = webSocketService.subscribe('approval_status_changed', handleApprovalUpdate);

          return () => {
            try {
              unsubscribeApprovals();
              unsubscribeStatusChanges();
              webSocketService.disconnect();
            } catch (error) {
              console.error('Error cleaning up WebSocket subscriptions:', error);
            }
          };
        } catch (error) {
          console.warn('WebSocket connection failed:', error);
          dispatch(setConnectionStatus(false));
          
          // Track WebSocket errors
          if (typeof window !== 'undefined' && window.performanceMonitor) {
            window.performanceMonitor.trackError(error, 'websocket-connection');
          }
          
          // Implement exponential backoff reconnection
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            console.log(`Attempting WebSocket reconnection in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
            
            setTimeout(() => {
              connect();
            }, delay);
          } else {
            console.error('Max WebSocket reconnection attempts reached');
            // Dispatch error notification
            dispatch(addRealTimeNotification({
              id: Date.now(),
              type: 'connection_error',
              message: 'Real-time updates unavailable. Please refresh the page.',
              timestamp: new Date().toISOString()
            }));
          }
        }
      };
      
      return connect();
    };

    const cleanup = initializeWebSocket();
    
    return () => {
      cleanup.then(cleanupFn => {
        if (cleanupFn && typeof cleanupFn === 'function') {
          cleanupFn();
        }
      }).catch(error => {
        console.error('Error during WebSocket cleanup:', error);
      });
    };
  }, [dispatch]);

  return children;
};

// Import components
function App() {
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState(null);

  // Optimized SDK status checking - memoized for performance
  const checkSDKStatus = useCallback(() => {
    try {
      const status = {
        available: typeof window.Apper !== 'undefined',
        ready: typeof window.apperSDK !== 'undefined',
        initialized: window.apperSDK?.isInitialized === true
      };
      return status;
    } catch (error) {
      console.error('Error checking SDK status:', error);
      return { available: false, ready: false, initialized: false, error: error.message };
    }
  }, []);
// Optimized SDK monitoring - non-blocking and lightweight
  useEffect(() => {
    let mounted = true;
    let checkCount = 0;
    
    const checkStatus = () => {
      if (!mounted || checkCount > 5) return; // Limit checks to prevent performance impact
      
      try {
        const status = checkSDKStatus();
        if (status.ready || status.initialized) {
          setSdkReady(true);
          setSdkError(null);
        } else if (checkCount === 5) {
          // After 5 attempts, just warn but don't block the app
          console.warn('SDK not ready after initial checks - continuing without it');
        }
        checkCount++;
      } catch (error) {
        console.warn('SDK check failed:', error);
        checkCount++;
      }
    };

    // Check immediately and then periodically
    checkStatus();
    const interval = setInterval(checkStatus, 1000);
    
    // Clean timeout - don't wait forever
    const timeout = setTimeout(() => {
      if (mounted) {
        clearInterval(interval);
      }
    }, 6000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [checkSDKStatus]);

// Lightweight error handling - don't block the app for SDK errors
useEffect(() => {
    const handleError = (event) => {
      if (event.reason?.message?.includes('Apper') || event.error?.message?.includes('Apper')) {
        console.warn('SDK error detected but not blocking app:', event);
        // Don't set SDK error state - just log it
      }
      
      // Handle DataCloneError specifically for postMessage operations
      if (event.reason?.name === 'DataCloneError' || event.error?.name === 'DataCloneError') {
        console.warn('DataCloneError detected - likely from postMessage with non-cloneable objects:', event);
        // Log the error but don't crash the app
      }
    };

    const handleMessageError = (event) => {
      console.warn('Message error detected:', event);
      // Handle postMessage errors gracefully
    };
    
    window.addEventListener('unhandledrejection', handleError);
    window.addEventListener('messageerror', handleMessageError);
    return () => {
      window.removeEventListener('unhandledrejection', handleError);
      window.removeEventListener('messageerror', handleMessageError);
    };
  }, []);
// Memoized SDK utilities for performance
  const sdkUtils = useMemo(() => ({
    ready: sdkReady,
    error: sdkError,
    checkStatus: checkSDKStatus
  }), [sdkReady, sdkError, checkSDKStatus]);

  // Component preloader for performance
  useEffect(() => {
    // Preload likely-to-be-visited components after initial render
    const preloadTimer = setTimeout(() => {
      import("@/components/pages/Category").catch(() => {});
      import("@/components/pages/Orders").catch(() => {});
      import("@/components/pages/Account").catch(() => {});
    }, 2000);

    return () => clearTimeout(preloadTimer);
  }, []);
return (
    <Provider store={store}>
      <PersistGate loading={<Loading type="page" />} persistor={persistor}>
        <WebSocketProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-background">
            <Suspense fallback={<Loading type="page" />}>
              <Routes>
                <Route path="/" element={<Layout />}>
                  {/* Core routes - no lazy loading */}
                  <Route index element={<Home />} />
                  <Route path="product/:productId" element={<ProductDetail />} />
                  <Route path="cart" element={<Cart />} />
                  <Route path="checkout" element={<Checkout />} />
                  
{/* Lazy loaded routes with error boundaries */}
                  <Route path="category/:categoryName" element={
                    <LazyErrorBoundary>
                      <Suspense fallback={<Loading type="page" />}>
                        <Category />
                      </Suspense>
                    </LazyErrorBoundary>
                  } />
<Route path="orders" element={
                    <LazyErrorBoundary>
                      <Suspense fallback={<Loading type="page" />}>
                        <Orders />
                      </Suspense>
                    </LazyErrorBoundary>
                  } />
<Route path="order-summary/:orderId" element={
                    <LazyErrorBoundary>
                      <Suspense fallback={<Loading type="page" />}>
                        <OrderSummary />
                      </Suspense>
                    </LazyErrorBoundary>
                  } />
                  <Route path="orders/:orderId" element={
                    <LazyErrorBoundary>
                      <Suspense fallback={<Loading type="page" />}>
                        <OrderTracking />
                      </Suspense>
                    </LazyErrorBoundary>
                  } />
                  <Route path="account" element={
                    <LazyErrorBoundary>
                      <Suspense fallback={<Loading type="page" />}>
                        <Account />
                      </Suspense>
                    </LazyErrorBoundary>
                  } />
                  
                  {/* Heavy admin routes - lazy loaded with error boundaries */}
                  <Route path="admin" element={
                    <LazyErrorBoundary>
                      <Suspense fallback={<Loading type="page" />}>
                        <AdminDashboard />
                      </Suspense>
                    </LazyErrorBoundary>
                  } />
                  <Route path="admin/products" element={
                    <LazyErrorBoundary>
                      <Suspense fallback={<Loading type="page" />}>
                        <ProductManagement />
                      </Suspense>
</LazyErrorBoundary>
                  } />
                  <Route path="admin/vendors" element={
                    <LazyErrorBoundary>
                      <Suspense fallback={<Loading type="page" />}>
                        <VendorManagement />
                      </Suspense>
                    </LazyErrorBoundary>
                  } />
                  <Route path="admin/pos" element={
                    <LazyErrorBoundary>
                      <Suspense fallback={<Loading type="page" />}>
                        <POS />
                      </Suspense>
                    </LazyErrorBoundary>
                  } />
                  <Route path="admin/delivery-dashboard" element={
                    <LazyErrorBoundary>
                      <Suspense fallback={<Loading type="page" />}>
                        <DeliveryTracking />
                      </Suspense>
                    </LazyErrorBoundary>
                  } />
                  <Route path="admin/analytics" element={
                    <LazyErrorBoundary>
                      <Suspense fallback={<Loading type="page" />}>
                        <Analytics />
                      </Suspense>
                    </LazyErrorBoundary>
                  } />
                  <Route path="admin/financial-dashboard" element={
                    <LazyErrorBoundary>
                      <Suspense fallback={<Loading type="page" />}>
                        <FinancialDashboard />
                      </Suspense>
                    </LazyErrorBoundary>
                  } />
                  <Route path="admin/payments" element={
                    <LazyErrorBoundary>
                      <Suspense fallback={<Loading type="page" />}>
                        <PaymentManagement />
                      </Suspense>
                    </LazyErrorBoundary>
                  } />
                  <Route path="admin/ai-generate" element={
                    <LazyErrorBoundary>
                      <Suspense fallback={<Loading type="page" />}>
                        <AIGenerate />
                      </Suspense>
                    </LazyErrorBoundary>
                  } />
                  <Route path="admin/payroll" element={
                    <LazyErrorBoundary>
                      <Suspense fallback={<Loading type="page" />}>
                        <PayrollManagement />
                      </Suspense>
                    </LazyErrorBoundary>
                  } />
                  
                  {/* Role Assignment Route - Admin Only */}
                  <Route path="role-management" element={
                    <LazyErrorBoundary>
                      <Suspense fallback={<Loading type="page" />}>
                        <RoleAssignment />
                      </Suspense>
                    </LazyErrorBoundary>
                  } />
                  
                  {/* Vendor Portal Route */}
                  <Route path="vendor-portal" element={
                    <LazyErrorBoundary>
                      <Suspense fallback={<Loading type="page" />}>
                        <VendorPortal />
                      </Suspense>
                    </LazyErrorBoundary>
                  } />
                </Route>
              </Routes>
            </Suspense>
            <ToastContainer
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick
              rtl={false}
              pauseOnFocusLoss={false}
              draggable
              pauseOnHover={false}
              theme="colored"
              style={{ zIndex: 9999 }}
              limit={3}
            />
</div>
        </BrowserRouter>
        </WebSocketProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;