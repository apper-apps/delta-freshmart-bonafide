// Comprehensive error handling utilities
export class ErrorHandler {
  static classifyError(error) {
    const message = error.message?.toLowerCase() || '';
    
    // Image loading specific errors
    if (message.includes('error loading image') || message.includes('image') || message.includes('cors')) {
      return 'image-load';
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('timeout') || message.includes('deadline') || message.includes('13109ms')) {
      return 'timeout';
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('parse')) {
      return 'validation';
    }
    if (message.includes('server') || message.includes('500') || message.includes('503')) {
      return 'server';
    }
    if (message.includes('not found') || message.includes('404')) {
      return 'not-found';
    }
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('403')) {
      return 'permission';
    }
    
    return 'general';
  }

static createUserFriendlyMessage(error, context = '') {
    const type = this.classifyError(error);
    const contextPrefix = context ? `${context}: ` : '';
    
    switch (type) {
      case 'image-load':
        return `${contextPrefix}Image failed to load. Using fallback image.`;
      case 'network':
        return `${contextPrefix}Network connection issue. Please check your internet connection and try again.`;
      case 'timeout':
        return `${contextPrefix}Request timed out. The server is taking too long to respond.`;
      case 'server':
        return `${contextPrefix}Server error occurred. Please try again in a few moments.`;
      case 'validation':
        return `${contextPrefix}Invalid data provided. Please check your input and try again.`;
      case 'not-found':
        return `${contextPrefix}Requested item not found.`;
      case 'permission':
        return `${contextPrefix}You don't have permission to perform this action.`;
      default:
        return `${contextPrefix}An unexpected error occurred. Please try again.`;
    }
  }

static shouldRetry(error, attemptCount = 0, maxRetries = 3) {
    if (attemptCount >= maxRetries) return false;
    
    const type = this.classifyError(error);
    // Include image-load errors for retry with different strategy
    return ['network', 'timeout', 'server', 'image-load'].includes(type);
  }

  static getRetryDelay(attemptCount, baseDelay = 1000) {
    return Math.min(baseDelay * Math.pow(2, attemptCount), 30000);
  }
}

// Network status monitoring
export class NetworkMonitor {
  static isOnline() {
    return navigator.onLine;
  }

  static addNetworkListener(callback) {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }
}

// Service layer error wrapper
export const withErrorHandling = (serviceMethod, context) => {
  return async (...args) => {
    let attemptCount = 0;
    
    while (attemptCount < 3) {
      try {
        return await serviceMethod(...args);
      } catch (error) {
        console.error(`${context} error (attempt ${attemptCount + 1}):`, error);
        
        if (ErrorHandler.shouldRetry(error, attemptCount)) {
          attemptCount++;
          const delay = ErrorHandler.getRetryDelay(attemptCount);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw new Error(ErrorHandler.createUserFriendlyMessage(error, context));
      }
}
  };
};

// Image loading utilities with retry and fallback
export class ImageLoader {
  static async loadImageWithFallback(primaryUrl, fallbackUrl = null, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const timeoutId = setTimeout(() => {
        reject(new Error(`Image loading timeout after ${timeout}ms: ${primaryUrl}`));
      }, timeout);

      img.onload = () => {
        clearTimeout(timeoutId);
        resolve(primaryUrl);
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        if (fallbackUrl) {
          // Try fallback image
          const fallbackImg = new Image();
          fallbackImg.onload = () => resolve(fallbackUrl);
          fallbackImg.onerror = () => reject(new Error(`Both primary and fallback images failed to load`));
          fallbackImg.src = fallbackUrl;
        } else {
          reject(new Error(`Image failed to load: ${primaryUrl}`));
        }
      };

      img.src = primaryUrl;
    });
  }

  static createPlaceholderDataUrl(width = 400, height = 300, text = 'Image not available') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, width, height);
    
    // Text
    ctx.fillStyle = '#6b7280';
    ctx.font = '16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);
    
    return canvas.toDataURL();
  }

  static preloadImages(urls, onProgress = null) {
    return Promise.allSettled(
      urls.map((url, index) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            if (onProgress) onProgress(index + 1, urls.length);
            resolve(url);
          };
          img.onerror = () => {
            if (onProgress) onProgress(index + 1, urls.length);
            reject(new Error(`Failed to preload: ${url}`));
          };
          img.src = url;
        });
      })
    );
  }
}