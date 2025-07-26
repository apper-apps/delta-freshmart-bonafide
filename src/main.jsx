import '@/index.css'
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import App from "@/App";
import Error from "@/components/ui/Error";
import { store } from "@/store/index";
// Polyfill for structuredClone if not available
if (typeof structuredClone === 'undefined') {
  window.structuredClone = function(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (error) {
      console.warn('structuredClone fallback failed:', error);
      return obj;
    }
  };
}

// Polyfill for CustomEvent if not available
if (typeof CustomEvent === 'undefined') {
  window.CustomEvent = function(event, params) {
    params = params || { bubbles: false, cancelable: false, detail: null };
    const evt = document.createEvent('CustomEvent');
evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
    return evt;
  };
}

// Error handler coordination to prevent conflicts
const errorHandlerState = {
  processing: new Set(),
  lastError: null,
  lastErrorTime: 0,
  debounceMs: 100
};

// Global error handlers for external script errors with coordination
window.addEventListener('error', (event) => {
  const errorKey = `${event.filename}:${event.lineno}:${event.message}`;
  const now = Date.now();
  
  // Debounce identical errors
  if (errorHandlerState.lastError === errorKey && 
      now - errorHandlerState.lastErrorTime < errorHandlerState.debounceMs) {
    return false;
  }
  
  // Prevent concurrent processing of same error
  if (errorHandlerState.processing.has(errorKey)) {
    return false;
  }
  
  // Handle errors from external scripts like Apper CDN
  if (event.filename && event.filename.includes('apper.io')) {
    errorHandlerState.processing.add(errorKey);
    errorHandlerState.lastError = errorKey;
    errorHandlerState.lastErrorTime = now;
    
    console.warn('External Apper script error intercepted:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      timestamp: now
    });
    
    // Clean up processing state after a delay
    setTimeout(() => {
      errorHandlerState.processing.delete(errorKey);
    }, 1000);
    
    // Prevent the error from breaking the application
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    return false;
  }
});

// Handle unhandled promise rejections from external scripts with coordination
window.addEventListener('unhandledrejection', (event) => {
  const errorKey = `rejection:${event.reason?.message || 'unknown'}`;
  const now = Date.now();
  
  // Debounce identical rejections
  if (errorHandlerState.lastError === errorKey && 
      now - errorHandlerState.lastErrorTime < errorHandlerState.debounceMs) {
    event.preventDefault();
    return false;
  }
  
  if (event.reason && event.reason.message && 
      (event.reason.message.includes('DataCloneError') || 
       event.reason.message.includes('postMessage') ||
       event.reason.message.includes('URL object could not be cloned'))) {
    
    errorHandlerState.lastError = errorKey;
    errorHandlerState.lastErrorTime = now;
    
    console.warn('External script postMessage error intercepted:', {
      reason: event.reason.message,
      stack: event.reason.stack,
      timestamp: now
    });
// Prevent the error from breaking the application
    event.preventDefault();
    return false;
  }
});

// Initialize app
function initializeApp() {
  try {
    // Get root element
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error('Root element not found');
    }

    // Create React root
    const root = ReactDOM.createRoot(rootElement);
    
    // Render app
    root.render(
      <Provider store={store}>
        <App />
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </Provider>
    );

    console.log('App initialized successfully');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    
    // Fallback render
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background-color: #f5f5f5;">
          <div style="text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #dc2626; margin-bottom: 1rem;">Application Error</h2>
            <p style="color: #6b7280; margin-bottom: 1rem;">Unable to load the application. Please refresh the page.</p>
            <button onclick="window.location.reload()" style="background: #3b82f6; color: white; padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer;">
              Refresh Page
            </button>
          </div>
        </div>
      `;
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}