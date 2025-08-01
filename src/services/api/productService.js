import productsData from "@/services/mockData/products.json";
class ProductService {
  constructor() {
    this.products = [...productsData];
  }

async getAll(userRole = 'customer') {
    try {
      await this.delay();
      const products = [...this.products];
      
      if (!Array.isArray(products)) {
        throw new Error('Product data is corrupted');
      }
      
      // Filter financial data for non-admin users
      if (userRole !== 'admin') {
        return products.map(product => {
          if (!product || typeof product !== 'object') {
            console.warn('Invalid product data found, skipping');
            return null;
          }
          const { purchasePrice, minSellingPrice, profitMargin, ...filteredProduct } = product;
          return filteredProduct;
        }).filter(Boolean);
      }
      
      return products;
    } catch (error) {
      console.error('Error fetching products:', error);
      
      if (error.message.includes('corrupted')) {
        throw error;
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        throw new Error('Network error loading products. Please check your connection and try again.');
      } else {
        throw new Error('Failed to load products. Please try again later.');
      }
    }
  }

async getById(id, userRole = 'customer') {
    try {
      await this.delay();
      
      if (!id || (typeof id !== 'number' && typeof id !== 'string')) {
        throw new Error('Invalid product ID provided');
      }
      
      const numericId = parseInt(id);
      if (isNaN(numericId) || numericId <= 0) {
        throw new Error('Product ID must be a positive number');
      }
      
      const product = this.products.find(p => p.id === numericId);
      if (!product) {
        throw new Error('Product not found');
      }
      
      if (!product || typeof product !== 'object') {
        throw new Error('Product data is corrupted');
      }
      
      // Filter financial data for non-admin users
      if (userRole !== 'admin') {
        const { purchasePrice, minSellingPrice, profitMargin, ...filteredProduct } = product;
        return filteredProduct;
      }
      
      return { ...product };
    } catch (error) {
      console.error('Error fetching product by ID:', error);
      
      if (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('corrupted')) {
        throw error;
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        throw new Error('Network error loading product. Please check your connection and try again.');
      } else {
        throw new Error('Failed to load product details. Please try again later.');
      }
    }
  }

  async create(productData) {
    await this.delay();
    // Validate required fields
    if (!productData.name || !productData.price || productData.stock === undefined) {
      throw new Error('Name, price, and stock are required fields');
    }
    // Validate data types and constraints
    if (productData.price <= 0) {
      throw new Error('Price must be greater than 0');
    }

    if (productData.stock < 0) {
      throw new Error('Stock cannot be negative');
    }

    const newProduct = {
      id: this.getNextId(),
      ...productData,
      price: parseFloat(productData.price),
      purchasePrice: parseFloat(productData.purchasePrice) || 0,
      discountValue: parseFloat(productData.discountValue) || 0,
      minSellingPrice: parseFloat(productData.minSellingPrice) || 0,
      profitMargin: parseFloat(productData.profitMargin) || 0,
      stock: parseInt(productData.stock),
      minStock: productData.minStock ? parseInt(productData.minStock) : 10,
      isActive: productData.isActive !== undefined ? productData.isActive : true
    };
    
    this.products.push(newProduct);
    return { ...newProduct };
  }

  async update(id, productData) {
    await this.delay();
    
    const index = this.products.findIndex(p => p.id === parseInt(id));
    if (index === -1) {
      throw new Error('Product not found');
    }

    // Validate if provided
    if (productData.price !== undefined && productData.price <= 0) {
      throw new Error('Price must be greater than 0');
    }

    if (productData.stock !== undefined && productData.stock < 0) {
      throw new Error('Stock cannot be negative');
    }

    // Preserve existing ID
    const updatedProduct = { 
      ...this.products[index], 
      ...productData, 
      id: this.products[index].id 
    };
    
    this.products[index] = updatedProduct;
    return { ...updatedProduct };
  }

  async delete(id) {
    await this.delay();
    
    const index = this.products.findIndex(p => p.id === parseInt(id));
    if (index === -1) {
      throw new Error('Product not found');
    }
    
    this.products.splice(index, 1);
    return true;
  }

  async getByBarcode(barcode) {
    await this.delay();
    const product = this.products.find(p => p.barcode === barcode && p.isActive);
    if (!product) {
      throw new Error('Product not found');
    }
    return { ...product };
  }

  getNextId() {
    const maxId = this.products.reduce((max, product) => 
      product.id > max ? product.id : max, 0);
    return maxId + 1;
  }
async bulkUpdatePrices(updateData) {
    await this.delay(500); // Longer delay for bulk operations
    const validation = this.validateBulkPriceUpdate(updateData);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
    let filteredProducts = [...this.products];
    
    // Filter by category
    if (updateData.category !== 'all') {
      filteredProducts = filteredProducts.filter(p => p.category === updateData.category);
    }
    
    // Filter by stock if enabled
    if (updateData.applyToLowStock) {
      filteredProducts = filteredProducts.filter(p => p.stock <= updateData.stockThreshold);
    }

    let updatedCount = 0;
    
    // Apply price updates
    filteredProducts.forEach(product => {
      const originalPrice = product.price;
      let newPrice = originalPrice;
      
      switch (updateData.strategy) {
        case 'percentage':
          const percentage = parseFloat(updateData.value) || 0;
          newPrice = originalPrice * (1 + percentage / 100);
          break;
        case 'fixed':
          const fixedAmount = parseFloat(updateData.value) || 0;
          newPrice = originalPrice + fixedAmount;
          break;
        case 'range':
          const minPrice = parseFloat(updateData.minPrice) || 0;
          const maxPrice = parseFloat(updateData.maxPrice) || originalPrice;
          newPrice = Math.min(Math.max(originalPrice, minPrice), maxPrice);
          break;
      }

      // Apply min/max constraints if specified
      if (updateData.minPrice && newPrice < parseFloat(updateData.minPrice)) {
        newPrice = parseFloat(updateData.minPrice);
      }
      if (updateData.maxPrice && newPrice > parseFloat(updateData.maxPrice)) {
        newPrice = parseFloat(updateData.maxPrice);
      }

      // Round to 2 decimal places
      newPrice = Math.round(newPrice * 100) / 100;
      
      // Only update if price actually changed
      if (Math.abs(newPrice - originalPrice) > 0.01) {
        const productIndex = this.products.findIndex(p => p.id === product.id);
        if (productIndex !== -1) {
          this.products[productIndex] = {
            ...this.products[productIndex],
            previousPrice: originalPrice,
            price: newPrice
          };
          updatedCount++;
        }
      }
    });

    return {
      updatedCount,
      totalFiltered: filteredProducts.length,
      strategy: updateData.strategy
    };
  }

  validateBulkPriceUpdate(updateData) {
    if (!updateData.strategy) {
      return { isValid: false, error: 'Update strategy is required' };
    }

    if (updateData.strategy === 'range') {
      if (!updateData.minPrice || !updateData.maxPrice) {
        return { isValid: false, error: 'Both minimum and maximum prices are required for range strategy' };
      }
      if (parseFloat(updateData.minPrice) >= parseFloat(updateData.maxPrice)) {
        return { isValid: false, error: 'Minimum price must be less than maximum price' };
      }
    } else {
      if (!updateData.value) {
        return { isValid: false, error: 'Update value is required' };
      }
      if (isNaN(parseFloat(updateData.value))) {
        return { isValid: false, error: 'Update value must be a valid number' };
      }
    }

    return { isValid: true };
}

  delay(ms = 150) { // Reduced delay for faster perceived performance
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Calculate profit metrics for a product
  calculateProfitMetrics(productData) {
    const price = parseFloat(productData.price) || 0;
    const purchasePrice = parseFloat(productData.purchasePrice) || 0;
    const discountValue = parseFloat(productData.discountValue) || 0;
    
    let finalPrice = price;
    
    // Apply discount based on type
    if (discountValue > 0) {
      if (productData.discountType === 'Percentage') {
        finalPrice = price - (price * discountValue / 100);
      } else {
        finalPrice = price - discountValue;
      }
    }
    
    // Ensure final price is not negative
    finalPrice = Math.max(0, finalPrice);
    
    // Calculate minimum selling price (purchase price + 10% margin)
    const minSellingPrice = purchasePrice > 0 ? purchasePrice * 1.1 : 0;
    
    // Calculate profit margin percentage
let profitMargin = 0;
    if (purchasePrice > 0 && finalPrice > 0) {
      profitMargin = ((finalPrice - purchasePrice) / purchasePrice) * 100;
    }

    return {
      minSellingPrice: Math.round(minSellingPrice * 100) / 100,
      profitMargin: Math.round(profitMargin * 100) / 100,
      finalPrice: Math.round(finalPrice * 100) / 100
    };
  }
  // Enhanced profit metrics calculation with error handling
  getDisplayMetrics(product) {
    try {
      if (!product || typeof product !== 'object') {
        return null;
      }

      const metrics = this.calculateProfitMetrics(product);
      
      return {
        ...metrics,
        hasMetrics: !!(product.profitMargin || product.minSellingPrice || product.purchasePrice),
        isHealthyMargin: parseFloat(product.profitMargin || 0) > 15,
        isProfitable: parseFloat(product.profitMargin || 0) > 0
      };
    } catch (error) {
      console.error('Error calculating display metrics:', error);
      return null;
    }
  }

// Enhanced validation with price guards and business rules
  validateProfitRules(productData) {
    try {
      const purchasePrice = parseFloat(productData.purchasePrice) || 0;
      const price = parseFloat(productData.price) || 0;
      const discountValue = parseFloat(productData.discountValue) || 0;
      const discountType = productData.discountType || 'Fixed Amount';
      
      // Price guard validation
      if (price < 1) {
        return {
          isValid: false,
          error: 'Price cannot be less than Rs. 1'
        };
      }

      if (price > 100000) {
        return {
          isValid: false,
          error: 'Price cannot exceed Rs. 100,000'
        };
      }

      if (purchasePrice > 0 && price <= purchasePrice) {
        return {
          isValid: false,
          error: 'Selling price must be greater than purchase price'
        };
      }

      // Discount validation with guards
      if (discountValue > 0) {
        if (discountType === 'Percentage' && discountValue > 90) {
          return {
            isValid: false,
            error: 'Percentage discount cannot exceed 90%'
          };
        }
        
        if (discountType === 'Fixed Amount' && discountValue >= price) {
          return {
            isValid: false,
            error: 'Fixed discount cannot be equal to or greater than the product price'
          };
        }

        // Calculate final price after discount
        let finalPrice = price;
        if (discountType === 'Percentage') {
          finalPrice = price - (price * discountValue / 100);
        } else {
          finalPrice = price - discountValue;
        }

        // Ensure final price doesn't go below purchase price
        if (purchasePrice > 0 && finalPrice <= purchasePrice) {
          return {
            isValid: false,
            error: 'Discounted price cannot be equal to or less than purchase price'
          };
        }

        // Check for minimum profit margin after discount
        if (purchasePrice > 0) {
          const margin = ((finalPrice - purchasePrice) / purchasePrice) * 100;
          if (margin < 5) {
            return {
              isValid: false,
              error: 'Profit margin after discount should be at least 5% for sustainable business'
            };
          }
        }
      } else {
        // Standard profit margin check without discount
        if (purchasePrice > 0) {
          const margin = ((price - purchasePrice) / purchasePrice) * 100;
          if (margin < 5) {
            return {
              isValid: false,
              error: 'Profit margin should be at least 5% for sustainable business'
            };
          }
        }
      }
      
      return { isValid: true };
    } catch (error) {
      console.error('Error validating profit rules:', error);
      return {
        isValid: false,
        error: 'Unable to validate pricing rules'
      };
    }
  }

  // Get financial health indicator
  getFinancialHealth(product) {
    try {
      if (!product) return 'unknown';
      
      const margin = parseFloat(product.profitMargin || 0);
      
      if (margin >= 25) return 'excellent';
      if (margin >= 15) return 'good';
      if (margin >= 5) return 'fair';
      if (margin > 0) return 'poor';
      return 'loss';
    } catch (error) {
console.error('Error calculating financial health:', error);
      return 'unknown';
    }
  }

  // Image validation and processing methods
  // Enhanced image validation with watermark/text detection and quality assessment
async validateImage(file) {
    let objectUrl = null;
    try {
      // Basic file validation with enhanced error handling
      if (!file) {
        return { isValid: false, error: 'No file provided for validation' };
      }
      
      if (!file.type || !file.type.startsWith('image/')) {
        return { isValid: false, error: 'Please select a valid image file (JPEG, PNG, WebP)' };
      }
      
      // Size validation with specific guidance
      if (file.size > 10 * 1024 * 1024) {
        return { isValid: false, error: 'Image file size must be less than 10MB. Please compress your image and try again.' };
      }
      
      if (file.size < 1024) {
        return { isValid: false, error: 'Image file seems too small. Please ensure it\'s a valid image file.' };
      }
      
      // Create image element for comprehensive quality analysis
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      return new Promise((resolve) => {
        const cleanup = () => {
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = null;
          }
        };

        const timeout = setTimeout(() => {
          cleanup();
          resolve({ isValid: false, error: 'Image processing timeout. Please try with a different image.' });
        }, 10000);

        img.onload = async () => {
          try {
            clearTimeout(timeout);
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            // Resolution validation with specific guidance
            if (img.width < 200 || img.height < 200) {
              cleanup();
              resolve({ 
                isValid: false, 
                error: `Image resolution too low (${img.width}x${img.height}). Minimum 200x200px required for good quality display.` 
              });
              return;
            }
            
            // Get image data for analysis
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Enhanced blur detection using image variance
            const variance = this.calculateImageVariance(imageData.data);
            if (variance < 150) {
              cleanup();
              resolve({ 
                isValid: false, 
                error: 'Image appears to be too blurry or low quality. Please use a sharper, well-lit image.' 
              });
              return;
            }
            
            // Text/watermark detection using edge density analysis
            const textDetection = this.detectTextWatermarks(imageData.data, canvas.width, canvas.height);
            if (textDetection.hasText) {
              cleanup();
              resolve({ 
                isValid: false, 
                error: `Watermarks or text detected in image (Confidence: ${textDetection.confidence}%). Please use a clean product image without text overlays.` 
              });
              return;
            }
            
            // Additional quality checks
            const qualityAssessment = this.assessImageQuality(imageData.data, canvas.width, canvas.height);
            if (qualityAssessment.score < 0.6) {
              cleanup();
              resolve({ 
                isValid: false, 
                error: `Image quality too low (Score: ${Math.round(qualityAssessment.score * 100)}%). Please use a higher quality, well-lit image.` 
              });
              return;
            }
            
            cleanup();
            resolve({ 
              isValid: true, 
              qualityScore: qualityAssessment.score,
              variance: variance,
              textConfidence: textDetection.confidence,
              dimensions: { width: img.width, height: img.height },
              fileSize: file.size
            });
          } catch (processingError) {
            console.error('Image processing error:', processingError);
            cleanup();
            resolve({ isValid: false, error: 'Failed to process image for validation. Please try with a different image.' });
          }
        };
        
        img.onerror = () => {
          clearTimeout(timeout);
          cleanup();
          resolve({ isValid: false, error: 'Invalid or corrupted image file. Please try with a different image.' });
        };

        try {
          objectUrl = URL.createObjectURL(file);
          img.src = objectUrl;
        } catch (urlError) {
          clearTimeout(timeout);
          cleanup();
          console.error('URL creation error:', urlError);
          resolve({ isValid: false, error: 'Failed to process image file. Please try with a different image.' });
        }
      });
      
    } catch (error) {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      console.error('Image validation error:', error);
      return { isValid: false, error: 'Failed to validate image. Please try again with a different image.' };
    }
  }

  // Enhanced image variance calculation for blur detection
  calculateImageVariance(imageData) {
    let sum = 0;
    let sumSquared = 0;
    let edgeSum = 0;
    const length = imageData.length;
    const pixelCount = length / 4;
    
    // Convert to grayscale and calculate variance with edge detection
    for (let i = 0; i < length; i += 4) {
      const gray = 0.299 * imageData[i] + 0.587 * imageData[i + 1] + 0.114 * imageData[i + 2];
      sum += gray;
      sumSquared += gray * gray;
      
      // Simple edge detection for sharpness assessment
      if (i >= 4 && i < length - 4) {
        const prevGray = 0.299 * imageData[i - 4] + 0.587 * imageData[i - 3] + 0.114 * imageData[i - 2];
        const nextGray = 0.299 * imageData[i + 4] + 0.587 * imageData[i + 5] + 0.114 * imageData[i + 6];
        edgeSum += Math.abs(gray - prevGray) + Math.abs(gray - nextGray);
      }
    }
    
    const mean = sum / pixelCount;
    const variance = (sumSquared / pixelCount) - (mean * mean);
    const edgeIntensity = edgeSum / pixelCount;
    
// Combine variance and edge intensity for better blur detection
    return variance + (edgeIntensity * 0.5);
  }

  detectTextWatermarks(imageData, width, height) {
    try {
      const pixelCount = width * height;
      let textFeatures = 0;
      let horizontalLines = 0;
      let verticalLines = 0;
      
      // Analyze image for text-like patterns
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = (y * width + x) * 4;
          const gray = 0.299 * imageData[idx] + 0.587 * imageData[idx + 1] + 0.114 * imageData[idx + 2];
          
          // Check for high contrast edges (typical of text)
          const neighbors = [
            0.299 * imageData[idx - 4] + 0.587 * imageData[idx - 3] + 0.114 * imageData[idx - 2], // left
            0.299 * imageData[idx + 4] + 0.587 * imageData[idx + 5] + 0.114 * imageData[idx + 6], // right
            0.299 * imageData[idx - width * 4] + 0.587 * imageData[idx - width * 4 + 1] + 0.114 * imageData[idx - width * 4 + 2], // top
            0.299 * imageData[idx + width * 4] + 0.587 * imageData[idx + width * 4 + 1] + 0.114 * imageData[idx + width * 4 + 2]  // bottom
          ];
          
          const maxDiff = Math.max(...neighbors.map(n => Math.abs(gray - n)));
          
          // High contrast edges suggest text
          if (maxDiff > 80) {
            textFeatures++;
            
            // Check for horizontal/vertical line patterns
            if (Math.abs(neighbors[0] - neighbors[1]) < 20) horizontalLines++;
            if (Math.abs(neighbors[2] - neighbors[3]) < 20) verticalLines++;
          }
        }
      }
      
      const textDensity = textFeatures / pixelCount;
      const lineDensity = (horizontalLines + verticalLines) / pixelCount;
      const confidence = Math.min((textDensity * 1000 + lineDensity * 500), 100);
      
      // Threshold for text detection (adjust based on testing)
      const hasText = confidence > 25 || textDensity > 0.15;
      
      return {
        hasText,
        confidence: Math.round(confidence),
        textDensity,
        lineDensity
      };
    } catch (error) {
      console.error('Error in text detection:', error);
      return { hasText: false, confidence: 0 };
    }
  }

  // Comprehensive image quality assessment
  assessImageQuality(imageData, width, height) {
    try {
      const pixelCount = width * height;
      let colorVariety = new Set();
      let contrastSum = 0;
      let brightnessSum = 0;
      
      for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        
        // Color variety assessment
        const colorKey = `${Math.floor(r/32)}-${Math.floor(g/32)}-${Math.floor(b/32)}`;
        colorVariety.add(colorKey);
        
        // Brightness and contrast
        const brightness = (r + g + b) / 3;
        brightnessSum += brightness;
        
        if (i >= 4) {
          const prevBrightness = (imageData[i-4] + imageData[i-3] + imageData[i-2]) / 3;
          contrastSum += Math.abs(brightness - prevBrightness);
        }
      }
      
      const colorScore = Math.min(colorVariety.size / 100, 1); // More colors = better
      const contrastScore = Math.min(contrastSum / pixelCount / 50, 1); // Good contrast
      const brightnessScore = 1 - Math.abs(brightnessSum / pixelCount - 128) / 128; // Not too dark/bright
      
      const overallScore = (colorScore * 0.3 + contrastScore * 0.4 + brightnessScore * 0.3);
      
      return {
        score: overallScore,
        colorVariety: colorVariety.size,
        contrast: contrastSum / pixelCount,
        averageBrightness: brightnessSum / pixelCount
      };
    } catch (error) {
      console.error('Error assessing image quality:', error);
      return { score: 0.5 };
    }
  }

  // Process and optimize image
async processImage(file, options = {}) {
    let inputObjectUrl = null;
    try {
      const {
        targetSize = { width: 600, height: 600 },
        maxFileSize = 100 * 1024, // 100KB
        quality = 0.9
      } = options;
      
      return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const cleanup = () => {
          if (inputObjectUrl) {
            URL.revokeObjectURL(inputObjectUrl);
            inputObjectUrl = null;
          }
        };
        
        img.onload = () => {
          try {
            // Calculate dimensions maintaining aspect ratio
            let { width, height } = this.calculateOptimalDimensions(
              img.width, 
              img.height, 
              targetSize.width, 
              targetSize.height
            );
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw and compress image
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to blob with compression
            canvas.toBlob((blob) => {
              if (!blob) {
                cleanup();
                reject(new Error('Failed to create blob from canvas'));
                return;
              }

              if (blob.size <= maxFileSize) {
                try {
                  const outputUrl = URL.createObjectURL(blob);
                  cleanup();
                  resolve({ url: outputUrl, blob, size: blob.size });
                } catch (error) {
                  cleanup();
                  reject(new Error('Failed to create output URL'));
                }
              } else {
                // Reduce quality if file is too large
                const reducedQuality = Math.max(0.1, quality - 0.2);
                canvas.toBlob((reducedBlob) => {
                  if (!reducedBlob) {
                    cleanup();
                    reject(new Error('Failed to create reduced quality blob'));
                    return;
                  }

                  try {
                    const outputUrl = URL.createObjectURL(reducedBlob);
                    cleanup();
                    resolve({ url: outputUrl, blob: reducedBlob, size: reducedBlob.size });
                  } catch (error) {
                    cleanup();
                    reject(new Error('Failed to create reduced quality URL'));
                  }
                }, 'image/webp', reducedQuality);
              }
            }, 'image/webp', quality);
          } catch (error) {
            cleanup();
            reject(new Error(`Failed to process image: ${error.message}`));
          }
        };
        
        img.onerror = () => {
          cleanup();
          reject(new Error('Failed to load image for processing'));
        };

        try {
          inputObjectUrl = URL.createObjectURL(file);
          img.src = inputObjectUrl;
        } catch (error) {
          cleanup();
          reject(new Error('Failed to create input URL for image processing'));
        }
      });
      
    } catch (error) {
      if (inputObjectUrl) {
        URL.revokeObjectURL(inputObjectUrl);
      }
      console.error('Error processing image:', error);
      throw new Error('Failed to process image');
    }
  }

// Calculate optimal dimensions for image resizing with aspect ratio enforcement
  calculateOptimalDimensions(originalWidth, originalHeight, targetWidth, targetHeight, enforceSquare = false) {
    const aspectRatio = originalWidth / originalHeight;
    const targetAspectRatio = targetWidth / targetHeight;
    
    let width, height;
    
    // Enforce 1:1 aspect ratio if requested
    if (enforceSquare) {
      const size = Math.min(targetWidth, targetHeight);
      // Ensure size is within constraints (400-1200px)
      const constrainedSize = Math.max(400, Math.min(size, 1200));
      return { 
        width: constrainedSize, 
        height: constrainedSize,
        aspectRatio: '1:1'
      };
    }
    
    if (aspectRatio > targetAspectRatio) {
      // Image is wider than target
      width = targetWidth;
      height = targetWidth / aspectRatio;
    } else {
      // Image is taller than target
      height = targetHeight;
width = targetHeight * aspectRatio;
    }
    return { width: Math.round(width), height: Math.round(height) };
  }
  // Get dynamic image dimensions for frame compatibility
  getDynamicImageDimensions(viewportWidth = 1200, enforceSquare = true) {
    try {
      // Base size calculation with responsive scaling
      let baseSize = 600;
      
      // Responsive adjustments for different screen sizes
      if (viewportWidth < 640) {
        baseSize = Math.max(400, Math.min(viewportWidth - 32, 500)); // Mobile: 400-500px
      } else if (viewportWidth < 1024) {
        baseSize = Math.max(500, Math.min(viewportWidth * 0.4, 700)); // Tablet: 500-700px
      } else {
        baseSize = Math.max(600, Math.min(viewportWidth * 0.3, 1200)); // Desktop: 600-1200px
      }
      
      // Enforce size constraints (400x400px to 1200x1200px)
      const constrainedSize = Math.max(400, Math.min(baseSize, 1200));
      
      // Return square dimensions if enforcing 1:1 aspect ratio
      if (enforceSquare) {
        return {
          width: constrainedSize,
          height: constrainedSize,
          aspectRatio: '1:1'
        };
      }
      
      return {
        width: constrainedSize,
        height: constrainedSize
      };
    } catch (error) {
      console.error('Error calculating dynamic image dimensions:', error);
      return {
        width: 600,
        height: 600,
        aspectRatio: '1:1'
      };
}
  }

  // Enhanced image search from multiple sources with category filtering and attribution
  async searchImages(query, options = {}) {
    try {
      const { category = 'all', orientation = 'square', loadMore = false } = options;
      await this.delay(1000); // Simulate API call
      
      const results = [];
      
      // Search internal product database
      const internalResults = this.searchInternalImages(query, { category });
      results.push(...internalResults);
      
      // Search Unsplash API with enhanced filtering
      const unsplashResults = this.searchUnsplashImages(query, { category, orientation, loadMore });
      results.push(...unsplashResults);
      
      // Apply content moderation and copyright compliance
      const moderatedResults = this.moderateImageResults(results);
      
      return moderatedResults.slice(0, loadMore ? 24 : 12);
      
    } catch (error) {
      console.error('Error searching images:', error);
      throw new Error('Failed to search images');
    }
  }

  // Search internal product images with category filtering
  searchInternalImages(query, options = {}) {
    const { category } = options;
    const baseImages = [
{
        url: "https://via.placeholder.com/600x600/4CAF50/ffffff?text=Fresh+Product",
        thumbnail: "https://via.placeholder.com/200x200/4CAF50/ffffff?text=Fresh",
        description: `Fresh ${query}`,
        source: 'internal',
        category: category !== 'all' ? category : 'Fresh Vegetables'
      },
{
        url: "https://via.placeholder.com/600x600/2E7D32/ffffff?text=Organic+Product",
        thumbnail: "https://via.placeholder.com/200x200/2E7D32/ffffff?text=Organic",
        description: `Organic ${query}`,
        source: 'internal',
        category: category !== 'all' ? category : 'Organic Produce'
      }
    ];
    
    // Filter by category if specified
    if (category && category !== 'all') {
      return baseImages.filter(img => img.category === category);
    }
    
    return baseImages;
  }

// Enhanced Unsplash search with comprehensive category mapping and attribution
  searchUnsplashImages(query, options = {}) {
    const { category, orientation, loadMore } = options;
    
    // Comprehensive category-specific search terms for enhanced food discovery
    const categoryMappings = {
      'vegetables': ['fresh vegetables', 'organic vegetables', 'farm vegetables', 'leafy greens', 'root vegetables', 'colorful vegetables'],
      'fruits': ['fresh fruits', 'tropical fruits', 'seasonal fruits', 'organic fruits', 'citrus fruits', 'berry fruits'],
      'meat': ['premium meat', 'fresh meat cuts', 'grass fed beef', 'organic meat', 'butcher quality', 'gourmet meat'],
      'dairy': ['fresh dairy', 'organic dairy', 'farm dairy', 'artisan cheese', 'fresh milk', 'creamy dairy'],
      'bakery': ['artisan bread', 'fresh bakery', 'sourdough bread', 'pastries', 'handmade bread', 'golden bread'],
      'seafood': ['fresh seafood', 'ocean fish', 'sustainable seafood', 'wild caught fish', 'premium seafood', 'market fresh fish'],
      'beverages': ['fresh beverages', 'natural drinks', 'craft beverages', 'healthy drinks', 'artisan coffee', 'fresh juice'],
      'spices': ['aromatic spices', 'fresh herbs', 'organic spices', 'cooking spices', 'herb garden', 'spice collection'],
      'organic': ['organic produce', 'certified organic', 'sustainable farming', 'natural foods', 'eco friendly', 'farm to table'],
      'snacks': ['healthy snacks', 'natural snacks', 'gourmet snacks', 'artisan snacks', 'wholesome treats', 'premium snacks'],
      
      // Legacy support for existing categories
      'Fresh Vegetables': ['vegetables', 'fresh produce', 'organic vegetables', 'farm fresh'],
      'Tropical Fruits': ['tropical fruits', 'exotic fruits', 'fresh fruits', 'colorful fruits'],
      'Dairy Products': ['dairy', 'milk products', 'cheese', 'yogurt'],
      'Premium Meat': ['meat cuts', 'fresh meat', 'butcher shop', 'premium beef'],
      'Artisan Bakery': ['bread', 'bakery items', 'artisan bread', 'fresh baked'],
      'Seafood & Fish': ['fresh fish', 'seafood', 'ocean fish', 'salmon'],
      'Beverages': ['drinks', 'beverages', 'fresh juice', 'coffee'],
      'Spices & Herbs': ['spices', 'herbs', 'seasoning', 'aromatic spices']
    };
    
    const searchTerms = categoryMappings[category] || [query];
    const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
    
    // Enhanced photographer database for more diverse attribution
    const photographers = [
      'Brooke Lark', 'Edgar Castrejon', 'Thought Catalog', 'Nadya Spetnitskaya',
      'Annie Spratt', 'Monika Grabkowska', 'Louis Hansel', 'Jakub Kapusnak',
      'Dan Gold', 'Eiliv-Sonas Aceron', 'Caroline Attwood', 'Farhad Ibrahimzade',
      'Priscilla Du Preez', 'Markus Spiske', 'Freddy G', 'Taylor Kiser'
    ];
    
const mockUnsplashImages = Array.from({ length: loadMore ? 12 : 6 }, (_, index) => ({
      url: `https://via.placeholder.com/600x600/FF6F00/ffffff?text=${encodeURIComponent(randomTerm.substring(0, 15))}`,
      thumbnail: `https://via.placeholder.com/200x200/FF6F00/ffffff?text=${encodeURIComponent(randomTerm.substring(0, 8))}`,
      description: `${category !== 'all' ? category : 'Premium'} ${randomTerm}`,
      source: 'unsplash',
      category: category !== 'all' ? category : 'Food',
      orientation: orientation,
      attribution: {
        photographer: photographers[index % photographers.length],
        profileUrl: `https://unsplash.com/@${photographers[index % photographers.length].toLowerCase().replace(/\s+/g, '')}`,
        downloadUrl: 'https://unsplash.com',
        license: 'Unsplash License'
      },
      tags: this.generateImageTags(randomTerm, category),
      quality: 'high',
      isCommercialUse: true
    }));
    
    return mockUnsplashImages;
  }

  // Generate relevant tags for image categorization
// Enhanced tag generation for comprehensive image categorization
  generateImageTags(query, category) {
    const baseTags = query.toLowerCase().split(' ');
    
    // Comprehensive category tag mappings for better search accuracy
    const categoryTags = {
      'vegetables': ['organic', 'healthy', 'green', 'fresh', 'natural', 'farm', 'nutritious', 'colorful'],
      'fruits': ['sweet', 'vitamin', 'tropical', 'seasonal', 'juicy', 'colorful', 'antioxidant', 'ripe'],
      'meat': ['protein', 'quality', 'fresh', 'gourmet', 'butcher', 'premium', 'grass-fed', 'tender'],
      'dairy': ['creamy', 'calcium', 'protein', 'fresh', 'natural', 'pasteurized', 'rich', 'smooth'],
      'bakery': ['handmade', 'artisan', 'golden', 'crispy', 'traditional', 'warm', 'freshly-baked', 'crusty'],
      'seafood': ['omega-3', 'wild-caught', 'sustainable', 'marine', 'delicate', 'fresh-caught', 'oceanic'],
      'beverages': ['refreshing', 'cold', 'natural', 'healthy', 'thirst-quenching', 'energizing', 'pure'],
      'spices': ['aromatic', 'flavorful', 'fragrant', 'exotic', 'pungent', 'culinary', 'seasoning'],
      'organic': ['certified', 'sustainable', 'eco-friendly', 'chemical-free', 'natural', 'wholesome'],
      'snacks': ['crunchy', 'satisfying', 'portable', 'tasty', 'convenient', 'wholesome', 'guilt-free'],
      
      // Legacy support
'Fresh Vegetables': ['organic', 'healthy', 'green', 'fresh', 'natural'],
      'Tropical Fruits': ['colorful', 'exotic', 'sweet', 'vitamin', 'tropical'],
      'Dairy Products': ['creamy', 'calcium', 'protein', 'fresh', 'natural'],
      'Premium Meat': ['protein', 'quality', 'fresh', 'gourmet', 'butcher'],
      'Artisan Bakery': ['handmade', 'artisan', 'golden', 'crispy', 'traditional'],
      'Beverages': ['refreshing', 'cold', 'thirst', 'natural', 'healthy']
    };
    
    const tags = [...baseTags, ...(categoryTags[category] || ['food', 'ingredient', 'culinary'])];
    return [...new Set(tags)]; // Remove duplicates
  }

  // Content moderation and copyright compliance
  moderateImageResults(results) {
    return results.map(image => ({
      ...image,
      isModerated: true,
      copyrightCompliant: true,
      contentRating: 'safe',
      commercialUse: image.source === 'unsplash' || image.source === 'internal'
    }));
  }

  // AI Image Generation with Stable Diffusion simulation
// AI Image Generation with Stable Diffusion simulation
  async generateAIImage(prompt, options = {}) {
    try {
      const {
        style = 'realistic',
        category = 'food',
        aspectRatio = '1:1',
        quality = 'high'
      } = options;
      
      await this.delay(2000); // Simulate AI generation time
      
      // Validate and enhance prompt
      const enhancedPrompt = this.enhanceAIPrompt(prompt, style, category);
      
      // Simulate content moderation
      const moderationResult = this.moderateAIPrompt(enhancedPrompt);
      if (!moderationResult.approved) {
        throw new Error(moderationResult.reason);
      }
      
      // Generate style-specific parameters
      const styleParams = this.getStyleParameters(style);
      
      // Simulate AI generation result
const generatedImage = {
        url: `https://via.placeholder.com/600x600/2196F3/ffffff?text=AI+Generated+${encodeURIComponent(prompt.substring(0, 10))}`,
        thumbnail: `https://via.placeholder.com/200x200/2196F3/ffffff?text=AI+Gen`,
        prompt: enhancedPrompt,
        originalPrompt: prompt,
        style: style,
        category: category,
        aspectRatio: aspectRatio,
        quality: quality,
        generatedAt: new Date().toISOString(),
        model: 'Stable Diffusion XL',
        seed: Math.floor(Math.random() * 1000000),
        steps: styleParams.steps,
        cfgScale: styleParams.cfgScale,
        isAIGenerated: true,
        copyrightFree: true,
        commercialUse: true
      };
      
      return generatedImage;
      
    } catch (error) {
      console.error('Error generating AI image:', error);
      throw new Error('Failed to generate AI image: ' + error.message);
    }
  }

  // Enhance AI prompts for better results
  enhanceAIPrompt(prompt, style, category) {
    const styleEnhancements = {
      'realistic': ', photorealistic, high resolution, professional photography, studio lighting',
      'clean': ', clean white background, minimal, product photography, professional',
      'studio': ', studio lighting, professional photography, high quality, commercial',
      'lifestyle': ', natural lighting, lifestyle photography, everyday setting',
      'artistic': ', artistic composition, creative lighting, aesthetic, beautiful',
      'commercial': ', commercial photography, marketing ready, high quality, professional'
    };
    
    const categoryEnhancements = {
      'food': ', food photography, appetizing, fresh, high quality',
      'Groceries': ', grocery store quality, fresh produce, commercial grade',
      'Fruits': ', fresh fruits, vibrant colors, natural lighting',
      'Vegetables': ', fresh vegetables, organic, healthy, natural'
    };
    
    let enhancedPrompt = prompt;
    
    // Add style enhancements
    if (styleEnhancements[style]) {
      enhancedPrompt += styleEnhancements[style];
    }
    
    // Add category enhancements
    if (categoryEnhancements[category]) {
      enhancedPrompt += categoryEnhancements[category];
    }
    
    // Add quality and technical parameters
    enhancedPrompt += ', 4K resolution, sharp details, perfect composition';
    
    return enhancedPrompt;
  }

  // Content moderation for AI prompts
  moderateAIPrompt(prompt) {
    const prohibitedWords = ['inappropriate', 'offensive', 'harmful', 'illegal'];
    const lowerPrompt = prompt.toLowerCase();
    
    for (const word of prohibitedWords) {
      if (lowerPrompt.includes(word)) {
        return {
          approved: false,
          reason: 'Prompt contains inappropriate content'
        };
      }
    }
    
    return { approved: true };
  }

  // Get style-specific generation parameters
  getStyleParameters(style) {
    const styleParams = {
      'realistic': { steps: 50, cfgScale: 7.5, sampler: 'DPM++ 2M Karras' },
      'clean': { steps: 40, cfgScale: 8.0, sampler: 'Euler a' },
      'studio': { steps: 45, cfgScale: 7.0, sampler: 'DPM++ SDE Karras' },
      'lifestyle': { steps: 35, cfgScale: 6.5, sampler: 'Euler' },
      'artistic': { steps: 60, cfgScale: 9.0, sampler: 'DPM++ 2M' },
      'commercial': { steps: 50, cfgScale: 7.5, sampler: 'DPM++ 2M Karras' }
    };
    
    return styleParams[style] || styleParams['realistic'];
  }

// Enhanced pricing hierarchy validation with conflict detection and error recovery
  async validatePricingHierarchy(productData, allProducts = [], excludeId = null) {
    try {
      await this.delay(200);
      
      const conflicts = [];
      const warnings = [];
      
      if (!productData) {
        return { isValid: false, error: 'Invalid product data provided', conflicts, warnings };
      }

      // Validate and sanitize numeric inputs
      let basePrice, variationPrice, seasonalDiscount;
      
      try {
        basePrice = parseFloat(productData.basePrice || productData.price) || 0;
        variationPrice = parseFloat(productData.variationPrice) || 0;
        seasonalDiscount = parseFloat(productData.seasonalDiscount) || 0;
      } catch (parseError) {
        return { 
          isValid: false, 
          error: 'Invalid numeric values in pricing data', 
          conflicts: [{ type: 'parse_error', details: 'Unable to parse price values' }], 
          warnings 
        };
      }
      
      const seasonalDiscountType = productData.seasonalDiscountType || 'Fixed Amount';
      const category = productData.category;

      // Enhanced price validation with specific error messages
if (basePrice <= 0) {
        conflicts.push({
          type: 'invalid_base_price',
          details: 'Base price must be greater than 0',
          field: 'basePrice',
          currentValue: basePrice
        });
      }
      // Validate variation price hierarchy with enhanced checks
      if (variationPrice > 0) {
        if (variationPrice < basePrice * 0.8) {
          warnings.push({
            type: 'low_variation_price',
            message: 'Variation price is significantly lower than base price (less than 80%)',
            suggestion: 'Consider adjusting variation price to maintain profit margins'
          });
        }
        
        if (variationPrice > basePrice * 2) {
          warnings.push({
            type: 'high_variation_price',
            message: 'Variation price is significantly higher than base price (more than 200%)',
            suggestion: 'Verify if this price difference is intentional'
          });
        }
      }

      // Enhanced seasonal discount validation
      if (seasonalDiscount > 0) {
        const applicablePrice = variationPrice > 0 ? variationPrice : basePrice;
        
        // Validate discount type
        if (!['Percentage', 'Fixed Amount'].includes(seasonalDiscountType)) {
          conflicts.push({
            type: 'invalid_discount_type',
            details: 'Seasonal discount type must be either "Percentage" or "Fixed Amount"',
            field: 'seasonalDiscountType',
            currentValue: seasonalDiscountType
          });
        }
        
        if (seasonalDiscountType === 'Percentage') {
          if (seasonalDiscount > 70) {
            conflicts.push({
              type: 'excessive_seasonal_discount',
              details: 'Seasonal discount percentage exceeds maximum allowed (70%)',
              field: 'seasonalDiscount',
              currentValue: seasonalDiscount,
              maxAllowed: 70
            });
          }
          
          if (seasonalDiscount < 0) {
            conflicts.push({
              type: 'negative_discount',
              details: 'Seasonal discount percentage cannot be negative',
              field: 'seasonalDiscount',
              currentValue: seasonalDiscount
            });
          }
        }

        if (seasonalDiscountType === 'Fixed Amount') {
          if (seasonalDiscount >= applicablePrice) {
            conflicts.push({
              type: 'invalid_seasonal_discount',
              details: 'Seasonal discount amount equals or exceeds applicable price',
              field: 'seasonalDiscount',
              currentValue: seasonalDiscount,
              applicablePrice: applicablePrice
            });
          }
          
          if (seasonalDiscount < 0) {
            conflicts.push({
              type: 'negative_discount',
              details: 'Seasonal discount amount cannot be negative',
              field: 'seasonalDiscount',
              currentValue: seasonalDiscount
            });
          }
        }

        // Calculate final price after all hierarchy rules with error handling
        let finalPrice;
        try {
          finalPrice = applicablePrice;
          if (seasonalDiscountType === 'Percentage') {
            finalPrice = applicablePrice * (1 - seasonalDiscount / 100);
          } else {
            finalPrice = Math.max(0, applicablePrice - seasonalDiscount);
          }
        } catch (calculationError) {
          conflicts.push({
            type: 'calculation_error',
            details: 'Error calculating final price with seasonal discount',
            field: 'seasonalDiscount'
          });
          finalPrice = applicablePrice; // Fallback
        }

        // Check minimum viable price (at least 10% of base price)
        if (finalPrice < basePrice * 0.1) {
          conflicts.push({
            type: 'price_too_low',
            details: 'Final price after hierarchy is too low (less than 10% of base price)',
            finalPrice: finalPrice,
            minimumPrice: basePrice * 0.1
          });
        }

        // Enhanced profit margin validation
        const purchasePrice = parseFloat(productData.purchasePrice) || 0;
        if (purchasePrice > 0) {
          try {
            const profitMargin = ((finalPrice - purchasePrice) / purchasePrice) * 100;
            if (profitMargin < 5) {
              conflicts.push({
                type: 'low_profit_margin',
                details: `Final price results in ${profitMargin.toFixed(2)}% profit margin (minimum 5% recommended)`,
                profitMargin: profitMargin,
                minimumMargin: 5,
                purchasePrice: purchasePrice,
                finalPrice: finalPrice
              });
            }
          } catch (marginError) {
            warnings.push({
              type: 'margin_calculation_error',
              message: 'Unable to calculate profit margin',
              suggestion: 'Please verify purchase price value'
            });
          }
        }
      }

      // Enhanced seasonal discount conflict detection
      if (seasonalDiscount > 0 && productData.seasonalDiscountStartDate && productData.seasonalDiscountEndDate) {
        try {
          const conflictingProducts = allProducts.filter(p => 
            p && p.category === category && 
            p.id !== excludeId && 
            p.seasonalDiscount > 0 &&
            p.seasonalDiscountStartDate && p.seasonalDiscountEndDate
          );

          for (const product of conflictingProducts) {
            try {
              const existingStart = new Date(product.seasonalDiscountStartDate);
              const existingEnd = new Date(product.seasonalDiscountEndDate);
              const newStart = new Date(productData.seasonalDiscountStartDate);
              const newEnd = new Date(productData.seasonalDiscountEndDate);

              if (isNaN(existingStart.getTime()) || isNaN(existingEnd.getTime()) || 
                  isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
                warnings.push({
                  type: 'invalid_date_format',
                  message: 'Invalid date format detected in seasonal discount dates',
                  productName: product.name
                });
                continue;
              }

              if (newStart <= existingEnd && newEnd >= existingStart) {
                warnings.push({
                  type: 'overlapping_discount',
                  message: `Overlapping seasonal discount with ${product.name} (${product.seasonalDiscountStartDate} to ${product.seasonalDiscountEndDate})`,
                  conflictingProduct: product.name,
                  conflictingPeriod: `${product.seasonalDiscountStartDate} to ${product.seasonalDiscountEndDate}`
                });
              }
            } catch (dateError) {
              warnings.push({
                type: 'date_comparison_error',
                message: `Error comparing dates with product ${product.name}`,
                suggestion: 'Please verify date formats'
              });
            }
          }
        } catch (conflictCheckError) {
          warnings.push({
            type: 'conflict_check_error',
            message: 'Unable to check for seasonal discount conflicts',
            suggestion: 'Manual verification recommended'
          });
        }
      }

      const isValid = conflicts.length === 0;

      return {
        isValid,
        conflicts,
        warnings,
        error: isValid ? null : 'Pricing hierarchy conflicts detected',
        hierarchyBreakdown: {
          basePrice,
          variationPrice: variationPrice || null,
          seasonalDiscount,
          seasonalDiscountType,
          finalPrice: this.calculateHierarchyPrice(productData)
        },
        validationMetadata: {
          validatedAt: new Date().toISOString(),
          conflictCount: conflicts.length,
          warningCount: warnings.length,
          category: category
        }
      };

    } catch (error) {
      console.error('Error validating pricing hierarchy:', error);
      
      // Enhanced error classification
      let errorType = 'unknown';
      if (error.message.includes('network') || error.message.includes('timeout')) {
        errorType = 'network';
      } else if (error.message.includes('parse') || error.message.includes('invalid')) {
        errorType = 'data';
      } else if (error.message.includes('memory') || error.message.includes('overflow')) {
        errorType = 'resource';
      }
      
      return {
        isValid: false,
        error: 'Failed to validate pricing hierarchy due to system error',
        conflicts: [{
          type: 'validation_system_error',
          details: error.message,
          errorType: errorType
        }],
        warnings: [],
        systemError: true,
        errorMetadata: {
          originalError: error.message,
          errorType: errorType,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // Enhanced offer conflicts validation method - bound to class instance
  async validateOfferConflicts(productData, offerData = null) {
    try {
      await this.delay(150);
      
      const conflicts = [];
      const productId = productData?.id;
      const currentPrice = parseFloat(productData?.price) || 0;
      
      // Validate input parameters
      if (!productData || typeof productData !== 'object') {
        return {
          isValid: false,
          conflicts: [{
            type: 'invalid_input',
            message: 'Invalid product data provided',
            conflictData: null,
            severity: 'critical'
          }],
          summary: { total: 1, critical: 1, high: 0, medium: 0 }
        };
      }
      
      // Get all products to check for conflicts
      const allProducts = this.products || [];
      const currentProduct = allProducts.find(p => p?.id === productId);
      
      // If offer data is provided, validate it
      if (offerData && typeof offerData === 'object') {
        // Check for overlapping seasonal discounts
        if (currentProduct?.seasonalDiscounts?.length > 0) {
          const offerStart = new Date(offerData.startDate);
          const offerEnd = new Date(offerData.endDate);
          
          // Validate dates
          if (isNaN(offerStart.getTime()) || isNaN(offerEnd.getTime())) {
            conflicts.push({
              type: 'invalid_offer_dates',
              message: 'Invalid offer start or end date',
              conflictData: { startDate: offerData.startDate, endDate: offerData.endDate },
              severity: 'high'
            });
          } else {
            for (const discount of currentProduct.seasonalDiscounts) {
              const discountStart = new Date(discount.startDate);
              const discountEnd = new Date(discount.endDate);
              
              // Check for date overlap
              if (offerStart <= discountEnd && offerEnd >= discountStart) {
                conflicts.push({
                  type: 'seasonal_discount_overlap',
                  message: `Offer period overlaps with existing seasonal discount (${discount.name})`,
                  conflictData: discount,
                  severity: 'high'
                });
              }
            }
          }
        }
        
        // Check minimum pricing rules
        const minPrice = currentPrice * 0.3; // 30% minimum
        const discountedPrice = parseFloat(offerData.discountedPrice);
        if (!isNaN(discountedPrice) && discountedPrice < minPrice) {
          conflicts.push({
            type: 'minimum_price_violation',
            message: `Offer price (${discountedPrice.toFixed(2)}) below minimum allowed (${minPrice.toFixed(2)})`,
            conflictData: { minPrice, offerPrice: discountedPrice },
            severity: 'critical'
          });
        }
        
        // Check vendor pricing agreements
        if (currentProduct?.vendorAssignments?.length > 0) {
          for (const assignment of currentProduct.vendorAssignments) {
            if (assignment.minimumPrice && !isNaN(discountedPrice) && discountedPrice < assignment.minimumPrice) {
              conflicts.push({
                type: 'vendor_agreement_violation',
                message: `Offer violates vendor minimum price agreement`,
                conflictData: assignment,
                severity: 'high'
              });
            }
          }
        }
      }
      
      // Check for pricing hierarchy conflicts
      if (productData.category) {
        const categoryProducts = allProducts.filter(p => 
          p?.category === productData.category && p?.id !== productId
        );
        
        for (const product of categoryProducts) {
          if (product?.tier && productData.tier) {
            const tierDiff = parseInt(product.tier) - parseInt(productData.tier);
            const priceDiff = parseFloat(product.price) - currentPrice;
            
            // Check if pricing doesn't match tier hierarchy
            if ((tierDiff > 0 && priceDiff < 0) || (tierDiff < 0 && priceDiff > 0)) {
              conflicts.push({
                type: 'tier_pricing_conflict',
                message: `Price doesn't align with product tier hierarchy`,
                conflictData: { conflictProduct: product, tierDiff, priceDiff },
                severity: 'medium'
              });
            }
          }
        }
      }
      
      return {
        isValid: conflicts.length === 0,
        conflicts,
        summary: {
          total: conflicts.length,
          critical: conflicts.filter(c => c.severity === 'critical').length,
          high: conflicts.filter(c => c.severity === 'high').length,
          medium: conflicts.filter(c => c.severity === 'medium').length
        }
      };
      
    } catch (error) {
      console.error('Error validating offer conflicts:', error);
      return {
        isValid: false,
        conflicts: [{
          type: 'validation_error',
          message: 'Failed to validate offer conflicts',
          conflictData: error,
          severity: 'critical'
        }],
        summary: { total: 1, critical: 1, high: 0, medium: 0 }
      };
    }
  }
}

export const productService = new ProductService();