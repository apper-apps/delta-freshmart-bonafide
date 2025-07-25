import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { formatCurrency } from '@/utils/currency'
import ApperIcon from '@/components/ApperIcon'
import Button from '@/components/atoms/Button'
import Input from '@/components/atoms/Input'
import Error from '@/components/ui/Error'
import Loading from '@/components/ui/Loading'
import { orderService } from '@/services/api/orderService'
import { vendorService } from '@/services/api/vendorService'
import { productService } from '@/services/api/productService'

// Error boundary for lazy-loaded components
class LazyComponentErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Lazy component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <Error message="Component failed to load. Please refresh the page." />;
    }
    return this.props.children;
  }
}

const VendorPortal = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check authentication on component mount
  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const validation = await vendorService.validateSession();
      if (validation.valid) {
        setIsAuthenticated(true);
        const profile = await vendorService.getVendorProfile(validation.session.vendorId);
        setVendor(profile);
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (credentials) => {
    try {
      const result = await vendorService.login(credentials);
      setIsAuthenticated(true);
      setVendor(result.vendor);
      toast.success(`Welcome back, ${result.vendor.name}!`);
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await vendorService.logout();
      setIsAuthenticated(false);
      setVendor(null);
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Error logging out');
    }
  };

  if (loading) {
    return <Loading type="page" />;
  }

  if (error) {
    return <Error message={error} />;
  }

  if (!isAuthenticated) {
    return <VendorLogin onLogin={handleLogin} />;
  }

  return (
    <VendorDashboard 
      vendor={vendor} 
      onLogout={handleLogout}
      onProfileUpdate={setVendor}
    />
  );
};

// Vendor Login Component
const VendorLogin = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await onLogin(formData);
    } catch (error) {
      // Error handled in onLogin
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary rounded-full flex items-center justify-center">
            <ApperIcon name="Store" size={32} className="text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Vendor Portal
          </h2>
          <p className="mt-2 text-gray-600">
            Sign in to manage your products and pricing
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              type="email"
              name="email"
              label="Email Address"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
            <Input
              type="password"
              name="password"
              label="Password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleInputChange}
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <ApperIcon name="Loader2" size={16} className="animate-spin mr-2" />
                Signing in...
              </>
            ) : (
              <>
                <ApperIcon name="LogIn" size={16} className="mr-2" />
                Sign In
              </>
            )}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Demo Credentials: ahmed.khan@vendor.com / vendor123
          </p>
        </div>
      </div>
    </div>
  );
};

// Vendor Dashboard Component
const VendorDashboard = ({ vendor, onLogout, onProfileUpdate }) => {
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadVendorData();
  }, [vendor]);

  const loadVendorData = async () => {
    if (!vendor) return;
    
    setLoading(true);
    setError(null);
try {
      const [vendorProducts, vendorStats] = await Promise.all([
        productService.getVendorProducts(vendor.id),
        productService.getVendorStats(vendor.id)
      ]);
      
      setProducts(vendorProducts);
      
      // Calculate enhanced stats with cost/selling/margin totals
      const enhancedStats = {
        ...vendorStats,
        ...calculateTotals(vendorProducts, {
          costField: 'purchasePrice',
          sellingField: 'price',
          quantityField: 'stock'
        })
      };
      
      setStats(enhancedStats);
    } catch (error) {
      console.error('Error loading vendor data:', error);
      setError(error.message);
      toast.error('Failed to load vendor data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals for vendor products
  const calculateTotals = (products, fields) => {
    if (!products || products.length === 0) {
      return {
        totalCost: 0,
        totalSellingValue: 0,
        totalMargin: 0,
        averageMargin: 0
      };
    }

    const totals = products.reduce((acc, product) => {
      const cost = product[fields.costField] || 0;
      const selling = product[fields.sellingField] || 0;
      const quantity = product[fields.quantityField] || 0;
      
      acc.totalCost += cost * quantity;
      acc.totalSellingValue += selling * quantity;
      acc.totalMargin += (selling - cost) * quantity;
      
      return acc;
    }, {
      totalCost: 0,
      totalSellingValue: 0,
      totalMargin: 0
    });

    const averageMargin = totals.totalCost > 0 
      ? ((totals.totalSellingValue - totals.totalCost) / totals.totalCost) * 100 
      : 0;

    return {
      ...totals,
      averageMargin: Math.round(averageMargin * 100) / 100
    };
  };

  const handleProductUpdate = async (productId, priceData) => {
    try {
const updatedProduct = await productService.updateVendorPrice(vendor.id, productId, priceData);
      
      setProducts(prev => 
        prev.map(product => 
          product.id === productId ? updatedProduct : product
        )
      );
      
      toast.success('Product price updated successfully');
      
      // Reload stats
const newStats = await productService.getVendorStats(vendor.id);
      setStats(newStats);
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  };

const tabs = [
    { id: 'products', label: 'My Products', icon: 'Package' },
    { id: 'availability', label: 'Availability Confirmation', icon: 'CheckCircle', priority: 'critical' },
    { id: 'packing', label: 'Packing Station', icon: 'Package2', priority: 'critical' },
    { id: 'fulfillment', label: 'Payment Flow', icon: 'CreditCard', priority: 'critical' },
    { id: 'orders', label: 'Order History', icon: 'ClipboardList' },
    { id: 'profile', label: 'Profile', icon: 'User' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center">
                <ApperIcon name="Store" size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Vendor Portal
                </h1>
                <p className="text-sm text-gray-600">
                  Welcome, {vendor.name}
                </p>
              </div>
            </div>
            
            <Button
              onClick={onLogout}
              variant="outline"
              size="sm"
            >
              <ApperIcon name="LogOut" size={16} className="mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ApperIcon name="Package" size={24} className="text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Products</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totalProducts}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <ApperIcon name="TrendingUp" size={24} className="text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg. Margin</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.averageMargin}%</p>
                </div>
              </div>
            </div>
            
<div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <ApperIcon name="DollarSign" size={24} className="text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Value</p>
                  <p className="text-2xl font-semibold text-gray-900">{formatCurrency(stats.totalValue)}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <ApperIcon name="AlertTriangle" size={24} className="text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Low Stock</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.lowStockCount}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
<nav className="flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 relative ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <ApperIcon name={tab.icon} size={16} />
                  <span>{tab.label}</span>
                  {tab.priority === 'critical' && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {loading ? (
              <Loading type="component" />
            ) : error ? (
              <Error message={error} />
            ) : (
<>
                {activeTab === 'products' && (
                  <VendorProductsTab 
                    products={products}
                    vendor={vendor}
                    onProductUpdate={handleProductUpdate}
                  />
                )}
                {activeTab === 'availability' && (
                  <VendorAvailabilityTab 
                    vendor={vendor}
                  />
                )}
{activeTab === 'packing' && (
                  <VendorPackingTab 
                    vendor={vendor}
                  />
                )}
                {activeTab === 'fulfillment' && (
                  <VendorFulfillmentTab 
                    vendor={vendor}
                  />
                )}
                {activeTab === 'orders' && (
                  <VendorOrdersTab 
                    vendor={vendor}
                  />
                )}
                {activeTab === 'profile' && (
                  <VendorProfileTab 
                    vendor={vendor}
                    onProfileUpdate={onProfileUpdate}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Vendor Products Tab Component
const VendorProductsTab = ({ products, vendor, onProductUpdate }) => {
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = [...new Set(products.map(p => p.category))];
  
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleEditPrice = (product) => {
    setEditingProduct(product);
  };

  const handleSavePrice = async (productId, priceData) => {
    try {
      await onProductUpdate(productId, priceData);
      setEditingProduct(null);
    } catch (error) {
      // Error handled in onProductUpdate
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon="Search"
          />
        </div>
        <div className="sm:w-48">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Current Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cost Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Margin
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stock
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProducts.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <img
                      className="h-10 w-10 rounded-lg object-cover"
                      src={product.imageUrl}
                      alt={product.name}
                    />
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {product.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {product.unit}
                      </div>
                    </div>
                  </div>
</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {product.category}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatCurrency(product.price)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {product.purchasePrice ? formatCurrency(product.purchasePrice) : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    product.profitMargin >= 20 
                      ? 'bg-green-100 text-green-800'
                      : product.profitMargin >= 10
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {product.profitMargin?.toFixed(1) || '0'}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`text-sm ${
                    product.stock <= (product.minStock || 10)
                      ? 'text-red-600 font-medium'
                      : 'text-gray-900'
                  }`}>
                    {product.stock}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <Button
                    onClick={() => handleEditPrice(product)}
                    variant="outline"
                    size="sm"
                    disabled={!product.vendorInfo?.canEditPrice}
                  >
                    <ApperIcon name="Edit" size={14} className="mr-1" />
                    Edit Price
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <ApperIcon name="Package" size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
          <p className="text-gray-500">
            {searchTerm || categoryFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'You have no assigned products yet.'
            }
          </p>
        </div>
      )}

      {/* Edit Price Modal */}
      {editingProduct && (
        <EditPriceModal
          product={editingProduct}
          vendor={vendor}
          onSave={handleSavePrice}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </div>
  );
};

// Edit Price and Stock Modal Component
const EditPriceModal = ({ product, vendor, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    price: product.price,
    purchasePrice: product.purchasePrice || 0,
    stock: product.stock || 0
  });
  const [loading, setLoading] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [errors, setErrors] = useState({});
  const [approvalStatus, setApprovalStatus] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const numericValue = name === 'stock' ? parseInt(value) || 0 : parseFloat(value) || 0;
    
    setFormData(prev => ({
      ...prev,
      [name]: numericValue
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Price validation
    if (formData.price <= 0) {
      newErrors.price = 'Price must be greater than 0';
    }
    
    // Purchase price validation
    if (formData.purchasePrice < 0) {
      newErrors.purchasePrice = 'Purchase price cannot be negative';
    }
    
    // Stock validation
    if (formData.stock < 0) {
      newErrors.stock = 'Stock cannot be negative';
    }
    
    // Selling price > buying price validation
    if (formData.purchasePrice > 0 && formData.price <= formData.purchasePrice) {
      newErrors.price = 'Selling price must be greater than purchase price';
    }
    
    // Margin validation
    const margin = formData.purchasePrice > 0 
      ? ((formData.price - formData.purchasePrice) / formData.purchasePrice) * 100 
      : 0;
    
    if (margin < (product.vendorInfo?.minMargin || 5)) {
      newErrors.price = `Minimum margin required: ${product.vendorInfo?.minMargin || 5}%`;
    }
    
    // Max 20% price change validation
    const priceChangePercent = Math.abs(((formData.price - product.price) / product.price) * 100);
    if (priceChangePercent > 20) {
      newErrors.price = 'Maximum 20% price change allowed per update';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDirectSave = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    try {
      await onSave(product.id, formData);
    } catch (error) {
      // Error handled in onSave
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!validateForm()) {
      return;
    }
    
    setSubmittingApproval(true);
    try {
      // Simulate submission for approval
      const approvalData = {
        type: 'price_stock_change',
        title: `Price/Stock Update - ${product.name}`,
        description: `Update price from Rs. ${product.price} to Rs. ${formData.price} and stock from ${product.stock} to ${formData.stock}`,
submittedBy: `vendor_${vendor.id}`,
        affectedEntity: {
          entityType: 'product',
          entityId: product.id,
          entityName: product.name,
          currentValues: { 
            price: product.price, 
            stock: product.stock,
            purchasePrice: product.purchasePrice || 0
          },
          proposedValues: { 
            price: formData.price, 
            stock: formData.stock,
            purchasePrice: formData.purchasePrice
          }
        },
vendorId: vendor.id,
        productId: product.id
      };
      
      // Simulate API call to submit for approval
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setApprovalStatus({
        status: 'submitted',
        requestId: `REQ_${Date.now()}`,
        submittedAt: new Date().toISOString()
      });
      
      toast.success('Changes submitted for approval successfully');
      
      // Close modal after brief delay
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (error) {
      toast.error('Failed to submit for approval');
    } finally {
      setSubmittingApproval(false);
    }
  };

  const calculateMargin = () => {
    if (formData.purchasePrice > 0 && formData.price > 0) {
      return ((formData.price - formData.purchasePrice) / formData.purchasePrice) * 100;
    }
    return 0;
  };

  const calculatePriceChange = () => {
    if (product.price > 0) {
      return ((formData.price - product.price) / product.price) * 100;
    }
    return 0;
  };

  const hasChanges = formData.price !== product.price || 
                    formData.stock !== product.stock || 
                    formData.purchasePrice !== (product.purchasePrice || 0);

  if (approvalStatus?.status === 'submitted') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-md w-full p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ApperIcon name="CheckCircle" size={32} className="text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Submitted for Approval
          </h3>
          <p className="text-gray-600 mb-4">
            Your changes have been submitted and are pending approval.
          </p>
          <div className="bg-gray-50 p-3 rounded-lg text-sm">
            <p><strong>Request ID:</strong> {approvalStatus.requestId}</p>
            <p><strong>Status:</strong> <span className="text-yellow-600 font-medium">Pending Review</span></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Edit Price & Stock - {product.name}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <ApperIcon name="X" size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Price Input */}
          <div>
            <Input
              type="number"
              name="price"
              label="Selling Price (Rs.)"
              value={formData.price}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              required
              error={errors.price}
              disabled={!product.vendorInfo?.canEditPrice}
            />
            {!product.vendorInfo?.canEditPrice && (
              <p className="text-xs text-amber-600 mt-1">
                <ApperIcon name="Lock" size={12} className="inline mr-1" />
                Selling price editing restricted for this product
              </p>
            )}
          </div>

          {/* Purchase Price Input */}
          <div>
            <Input
              type="number"
              name="purchasePrice"
              label="Cost Price (Rs.)"
              value={formData.purchasePrice}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              error={errors.purchasePrice}
              disabled={!product.vendorInfo?.canEditCost}
            />
            {!product.vendorInfo?.canEditCost && (
              <p className="text-xs text-amber-600 mt-1">
                <ApperIcon name="Lock" size={12} className="inline mr-1" />
                Cost price editing restricted - contact admin for changes
              </p>
            )}
          </div>

          {/* Stock Input */}
          <div>
            <Input
              type="number"
              name="stock"
              label="Stock Quantity"
              value={formData.stock}
              onChange={handleInputChange}
              min="0"
              required
              error={errors.stock}
            />
            <p className="text-xs text-gray-500 mt-1">
              Current stock: {product.stock} units
            </p>
          </div>

          {/* Calculated Metrics */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            {/* Profit Margin */}
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                Profit Margin:
              </span>
              <span className={`text-sm font-semibold ${
                calculateMargin() >= (product.vendorInfo?.minMargin || 5)
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}>
                {calculateMargin().toFixed(2)}%
              </span>
            </div>

            {/* Price Change */}
            {formData.price !== product.price && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">
                  Price Change:
                </span>
                <span className={`text-sm font-semibold ${
                  Math.abs(calculatePriceChange()) <= 20
                    ? 'text-blue-600'
                    : 'text-red-600'
                }`}>
                  {calculatePriceChange() > 0 ? '+' : ''}{calculatePriceChange().toFixed(1)}%
                </span>
              </div>
            )}

            {/* Stock Change */}
            {formData.stock !== product.stock && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">
                  Stock Change:
                </span>
                <span className="text-sm font-semibold text-blue-600">
                  {formData.stock - product.stock > 0 ? '+' : ''}{formData.stock - product.stock} units
                </span>
              </div>
            )}

            <div className="text-xs text-gray-500 pt-2 border-t">
              Min margin: {product.vendorInfo?.minMargin || 5}% • 
              Max price change: 20% • 
              Profit: {formData.purchasePrice > 0 && formData.price > formData.purchasePrice ? 
                formatCurrency(formData.price - formData.purchasePrice) : 'Rs. 0'}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col space-y-3 pt-4">
            {/* Submit for Approval Button */}
            <Button
              type="button"
              onClick={handleSubmitForApproval}
              variant="primary"
              className="w-full"
              disabled={!hasChanges || submittingApproval || Object.keys(errors).length > 0}
            >
              {submittingApproval ? (
                <>
                  <ApperIcon name="Loader2" size={16} className="animate-spin mr-2" />
                  Submitting for Approval...
                </>
              ) : (
                <>
                  <ApperIcon name="Send" size={16} className="mr-2" />
                  Submit for Approval
                </>
              )}
            </Button>

            {/* Direct Save and Cancel buttons */}
            <div className="flex space-x-3">
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDirectSave}
                variant="ghost"
                className="flex-1"
                disabled={!hasChanges || loading || Object.keys(errors).length > 0}
              >
                {loading ? (
                  <>
                    <ApperIcon name="Loader2" size={16} className="animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Direct'
                )}
              </Button>
            </div>
          </div>

          {/* Validation Summary */}
          {Object.keys(errors).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center mb-2">
                <ApperIcon name="AlertCircle" size={16} className="text-red-600 mr-2" />
                <span className="text-sm font-medium text-red-800">Please fix the following issues:</span>
              </div>
              <ul className="text-sm text-red-700 space-y-1">
                {Object.values(errors).map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Vendor Profile Tab Component
const VendorProfileTab = ({ vendor, onProfileUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: vendor.name,
    email: vendor.email,
    company: vendor.company || '',
    phone: vendor.phone || '',
    address: vendor.address || ''
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
const updatedProfile = await vendorService.updateVendorProfile(vendor.id, formData);
      onProfileUpdate(updatedProfile);
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: vendor.name,
      email: vendor.email,
      company: vendor.company || '',
      phone: vendor.phone || '',
      address: vendor.address || ''
    });
    setIsEditing(false);
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-white">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Profile Information</h3>
          {!isEditing && (
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              size="sm"
            >
              <ApperIcon name="Edit" size={16} className="mr-2" />
              Edit Profile
            </Button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                name="name"
                label="Full Name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
              <Input
                type="email"
                name="email"
                label="Email Address"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                name="company"
                label="Company Name"
                value={formData.company}
                onChange={handleInputChange}
              />
              <Input
                type="tel"
                name="phone"
                label="Phone Number"
                value={formData.phone}
                onChange={handleInputChange}
              />
            </div>
            
            <Input
              type="text"
              name="address"
              label="Address"
              value={formData.address}
              onChange={handleInputChange}
            />

            <div className="flex space-x-3 pt-4">
              <Button
                type="button"
                onClick={handleCancel}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <ApperIcon name="Loader2" size={16} className="animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <p className="text-sm text-gray-900">{vendor.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <p className="text-sm text-gray-900">{vendor.email}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name
                </label>
                <p className="text-sm text-gray-900">{vendor.company || 'Not specified'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <p className="text-sm text-gray-900">{vendor.phone || 'Not specified'}</p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <p className="text-sm text-gray-900">{vendor.address || 'Not specified'}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Permissions
              </label>
              <div className="flex flex-wrap gap-2">
                {vendor.permissions?.map((permission) => (
                  <span
                    key={permission}
                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
                  >
                    {permission.replace('_', ' ')}
                  </span>
                ))}
</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Enhanced Vendor Availability Tab Component
const VendorAvailabilityTab = ({ vendor }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [bulkAvailability, setBulkAvailability] = useState(null);
  const [showBulkModal, setShowBulkModal] = useState(false);

  useEffect(() => {
    loadPendingAvailabilityOrders();
  }, [vendor]);

  const loadPendingAvailabilityOrders = async () => {
    if (!vendor) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const pendingOrders = await orderService.getPendingAvailabilityRequests();
const vendorOrders = pendingOrders.filter(order => {
        return order.items?.some(item => (item.productId % 3 + 1) === vendor.id);
      });
      setOrders(vendorOrders);
    } catch (error) {
      console.error('Error loading availability orders:', error);
      setError(error.message);
      toast.error('Failed to load pending orders');
    } finally {
      setLoading(false);
    }
  };

  const handleAvailabilityUpdate = async (orderId, productId, available, notes = '') => {
    try {
await orderService.updateVendorAvailability(orderId, vendor.id, productId, {
        available,
        notes,
        timestamp: new Date().toISOString(),
        responseDeadline: getResponseDeadline()
      });
      
      await loadPendingAvailabilityOrders();
      toast.success(`Product availability updated successfully`);
    } catch (error) {
      toast.error('Failed to update availability: ' + error.message);
    }
  };

  const handleBulkAvailabilityUpdate = async () => {
    if (selectedOrders.length === 0 || bulkAvailability === null) {
      toast.error('Please select orders and availability status');
      return;
    }

    try {
      setLoading(true);
      const updatePromises = selectedOrders.map(orderId => {
        const order = orders.find(o => o.id === orderId);
const vendorProducts = order.items.filter(item => (item.productId % 3 + 1) === vendor.id);
        
        return Promise.all(vendorProducts.map(item => 
orderService.updateVendorAvailability(orderId, vendor.id, item.productId, {
            available: bulkAvailability,
            notes: `Bulk ${bulkAvailability ? 'confirmed' : 'declined'} availability`,
            timestamp: new Date().toISOString()
          })
        ));
      });

      await Promise.all(updatePromises);
      await loadPendingAvailabilityOrders();
      
      setSelectedOrders([]);
      setBulkAvailability(null);
      setShowBulkModal(false);
      toast.success(`Bulk availability ${bulkAvailability ? 'confirmed' : 'declined'} for ${selectedOrders.length} orders`);
    } catch (error) {
      toast.error('Bulk update failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getResponseDeadline = () => {
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 2); // 2 hour response time
    return deadline.toISOString();
  };

  const getDeadlineStatus = (createdAt) => {
    const created = new Date(createdAt);
    const deadline = new Date(created.getTime() + 2 * 60 * 60 * 1000); // 2 hours
    const now = new Date();
    const timeLeft = deadline - now;
    
    if (timeLeft <= 0) return { status: 'overdue', color: 'bg-red-100 text-red-800', timeLeft: 'Overdue' };
    if (timeLeft <= 30 * 60 * 1000) return { status: 'urgent', color: 'bg-orange-100 text-orange-800', timeLeft: `${Math.ceil(timeLeft / (60 * 1000))}m left` };
    return { status: 'normal', color: 'bg-green-100 text-green-800', timeLeft: `${Math.ceil(timeLeft / (60 * 1000))}m left` };
  };

  const getAvailabilityStatus = (order, productId) => {
    if (!order.vendor_availability) return 'pending';
const key = `${productId}_${vendor.id}`;
    const availability = order.vendor_availability[key];
    
    if (!availability) return 'pending';
    return availability.available ? 'available' : 'unavailable';
  };

  const getProductCardColor = (order, productId) => {
    const status = getAvailabilityStatus(order, productId);
    switch (status) {
      case 'available': return 'border-l-4 border-l-green-500 bg-green-50';
      case 'unavailable': return 'border-l-4 border-l-red-500 bg-red-50';
      default: return 'border-l-4 border-l-yellow-500 bg-yellow-50';
    }
  };

  const filteredOrders = orders.filter(order => 
    order.id.toString().includes(searchTerm) ||
    order.deliveryAddress?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <Loading type="component" />;
  if (error) return <Error message={error} />;

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Availability Confirmation</h2>
            <p className="text-blue-100">Respond to availability requests within 2 hours</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{filteredOrders.length}</div>
            <div className="text-blue-100">Pending Responses</div>
          </div>
        </div>
      </div>

      {/* Search and Bulk Actions */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon="Search"
          />
        </div>
        {selectedOrders.length > 0 && (
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setBulkAvailability(true);
                setShowBulkModal(true);
              }}
              variant="primary"
              size="sm"
            >
              <ApperIcon name="CheckCircle" size={16} className="mr-2" />
              Bulk Confirm ({selectedOrders.length})
            </Button>
            <Button
              onClick={() => {
                setBulkAvailability(false);
                setShowBulkModal(true);
              }}
              variant="outline"
              size="sm"
            >
              <ApperIcon name="XCircle" size={16} className="mr-2" />
              Bulk Decline ({selectedOrders.length})
            </Button>
          </div>
        )}
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.map((order) => {
          const deadline = getDeadlineStatus(order.createdAt);
const vendorProducts = order.items?.filter(item => (item.productId % 3 + 1) === vendor.id) || [];
          
          return (
            <div key={order.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(order.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOrders([...selectedOrders, order.id]);
                        } else {
                          setSelectedOrders(selectedOrders.filter(id => id !== order.id));
                        }
                      }}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <h3 className="font-semibold text-gray-900">Order #{order.id}</h3>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                      {order.deliveryAddress?.name || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${deadline.color}`}>
                      <ApperIcon name="Clock" size={12} className="mr-1 inline" />
                      {deadline.timeLeft}
                    </span>
                    <span className="text-sm text-gray-600">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                {/* Product Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {vendorProducts.map((item) => (
                    <div key={item.productId} className={`p-3 rounded-lg border ${getProductCardColor(order, item.productId)}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900 text-sm">{item.name}</h4>
                        <span className="text-xs text-gray-600">{item.quantity} {item.unit}</span>
                      </div>
                      
                      {getAvailabilityStatus(order, item.productId) === 'pending' ? (
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleAvailabilityUpdate(order.id, item.productId, true)}
                            className="flex-1"
                          >
                            <ApperIcon name="CheckCircle" size={12} className="mr-1" />
                            Available
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAvailabilityUpdate(order.id, item.productId, false)}
                            className="flex-1"
                          >
                            <ApperIcon name="XCircle" size={12} className="mr-1" />
                            Out of Stock
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-medium ${
                            getAvailabilityStatus(order, item.productId) === 'available' 
                              ? 'text-green-700' 
                              : 'text-red-700'
                          }`}>
                            {getAvailabilityStatus(order, item.productId) === 'available' ? '✓ Confirmed' : '✗ Unavailable'}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const currentStatus = getAvailabilityStatus(order, item.productId);
                              handleAvailabilityUpdate(order.id, item.productId, currentStatus !== 'available');
                            }}
                          >
                            <ApperIcon name="RefreshCw" size={12} />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <ApperIcon name="CheckCircle" size={48} className="mx-auto text-green-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
          <p className="text-gray-500">No pending availability requests at the moment.</p>
        </div>
      )}

      {/* Bulk Action Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Bulk {bulkAvailability ? 'Confirm' : 'Decline'} Availability
            </h3>
            <p className="text-gray-600 mb-6">
              This will {bulkAvailability ? 'confirm' : 'decline'} availability for all products in {selectedOrders.length} selected orders.
            </p>
            <div className="flex space-x-3">
              <Button
                onClick={() => setShowBulkModal(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkAvailabilityUpdate}
                variant={bulkAvailability ? "primary" : "secondary"}
                className="flex-1"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <ApperIcon name="Loader2" size={16} className="animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  `${bulkAvailability ? 'Confirm' : 'Decline'} All`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Enhanced Vendor Packing Tab Component
const VendorPackingTab = ({ vendor }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [packingData, setPackingData] = useState({});
  const [photoCapture, setPhotoCapture] = useState(null);

  useEffect(() => {
    loadPackingOrders();
  }, [vendor]);

  const loadPackingOrders = async () => {
    if (!vendor) return;
    
    setLoading(true);
    setError(null);
    
    try {
const fulfillmentOrders = await orderService.getFulfillmentOrders(vendor.id);
      // Filter orders ready for packing (availability confirmed)
      const packingOrders = fulfillmentOrders.filter(order => 
        order.fulfillment_stage === 'availability_confirmed' || order.fulfillment_stage === 'packed'
      );
      setOrders(packingOrders);
    } catch (error) {
      console.error('Error loading packing orders:', error);
      setError(error.message);
      toast.error('Failed to load packing orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStartPacking = (order) => {
    setSelectedOrder(order);
    setPackingData({
      orderId: order.id,
items: order.items?.filter(item => (item.productId % 3 + 1) === vendor.id).map(item => ({
        ...item,
        packedQuantity: item.quantity,
        actualWeight: '',
        verified: false
      })) || []
    });
  };

  const handleItemVerification = (itemIndex, field, value) => {
    setPackingData(prev => ({
      ...prev,
      items: prev.items.map((item, index) => 
        index === itemIndex 
          ? { ...item, [field]: value, verified: field === 'verified' ? value : item.verified }
          : item
      )
    }));
  };

  const handlePhotoCapture = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoCapture({
          file: file,
          dataUrl: e.target.result,
          timestamp: new Date().toISOString()
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePackingComplete = async () => {
    if (!selectedOrder || !packingData.items.every(item => item.verified)) {
      toast.error('Please verify all items before completing packing');
      return;
    }

    try {
      const packingInfo = {
        packingTimestamp: new Date().toISOString(),
packingTimestamp: new Date().toISOString(),
        vendorId: vendor.id,
        totalWeight: packingData.items.reduce((sum, item) => sum + (parseFloat(item.actualWeight) || 0), 0),
        photo: photoCapture,
        qualityChecked: true
      };

      await orderService.updateFulfillmentStage(selectedOrder.id, 'packed', packingInfo);
      await loadPackingOrders();
      
      setSelectedOrder(null);
      setPackingData({});
      setPhotoCapture(null);
      toast.success('Order packed successfully!');
    } catch (error) {
      toast.error('Failed to complete packing: ' + error.message);
    }
  };

  const filteredOrders = orders.filter(order => 
    order.id.toString().includes(searchTerm) ||
    order.deliveryAddress?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <Loading type="component" />;
  if (error) return <Error message={error} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Digital Packing Station</h2>
            <p className="text-green-100">Pack confirmed orders with quality verification</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{filteredOrders.length}</div>
            <div className="text-green-100">Orders Ready</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon="Search"
          />
        </div>
      </div>

      {/* Orders List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredOrders.map((order) => {
const vendorItems = order.items?.filter(item => (item.productId % 3 + 1) === vendor.id) || [];
          const isPacked = order.fulfillment_stage === 'packed';
          
          return (
            <div key={order.id} className={`p-6 rounded-lg border-l-4 ${
              isPacked ? 'border-l-green-500 bg-green-50' : 'border-l-yellow-500 bg-yellow-50'
            } shadow-sm`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">Order #{order.id}</h3>
                  <p className="text-sm text-gray-600">{order.deliveryAddress?.name}</p>
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  isPacked ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {isPacked ? '✓ Packed' : 'Ready for Packing'}
                </span>
              </div>
              
              <div className="space-y-2 mb-4">
                {vendorItems.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div>
                      <span className="font-medium text-gray-900">{item.name}</span>
                      <span className="text-sm text-gray-600 ml-2">{item.quantity} {item.unit}</span>
                    </div>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              
              {!isPacked && (
                <Button
                  onClick={() => handleStartPacking(order)}
                  variant="primary"
                  className="w-full"
                >
                  <ApperIcon name="Package" size={16} className="mr-2" />
                  Start Packing
                </Button>
              )}
              
              {isPacked && (
                <div className="flex items-center text-green-700">
                  <ApperIcon name="CheckCircle" size={16} className="mr-2" />
                  <span className="text-sm font-medium">Packed and verified</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <ApperIcon name="Package" size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders ready for packing</h3>
          <p className="text-gray-500">Orders will appear here once availability is confirmed.</p>
        </div>
      )}

      {/* Packing Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Packing Order #{selectedOrder.id}
              </h3>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Items Checklist */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Items Verification</h4>
                <div className="space-y-3">
                  {packingData.items?.map((item, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{item.name}</span>
                        <input
                          type="checkbox"
                          checked={item.verified}
                          onChange={(e) => handleItemVerification(index, 'verified', e.target.checked)}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Quantity</label>
                          <input
                            type="number"
                            value={item.packedQuantity}
                            onChange={(e) => handleItemVerification(index, 'packedQuantity', parseInt(e.target.value))}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Weight (kg)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={item.actualWeight}
                            onChange={(e) => handleItemVerification(index, 'actualWeight', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                            placeholder="Actual weight"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Photo Capture */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Package Photo</h4>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {photoCapture ? (
                    <div>
                      <img 
                        src={photoCapture.dataUrl} 
                        alt="Package" 
                        className="mx-auto max-h-32 rounded mb-2"
                      />
                      <p className="text-sm text-gray-600">Photo captured</p>
                      <button
                        onClick={() => setPhotoCapture(null)}
                        className="text-red-600 text-xs hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <ApperIcon name="Camera" size={32} className="mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600 mb-3">Capture package photo</p>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoCapture}
                        className="hidden"
                        id="photo-capture"
                      />
                      <label
                        htmlFor="photo-capture"
                        className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg cursor-pointer hover:bg-primary-dark"
                      >
                        <ApperIcon name="Camera" size={16} className="mr-2" />
                        Take Photo
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <Button
                onClick={() => {
                  setSelectedOrder(null);
                  setPackingData({});
                  setPhotoCapture(null);
                }}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePackingComplete}
                variant="primary"
                disabled={!packingData.items?.every(item => item.verified) || !photoCapture}
              >
                <ApperIcon name="CheckCircle" size={16} className="mr-2" />
                Complete Packing
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Vendor Orders Tab Component
const VendorOrdersTab = ({ vendor }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');

  useEffect(() => {
    loadVendorOrders();
  }, [vendor]);

  const loadVendorOrders = async () => {
    if (!vendor) return;
    
    setLoading(true);
    setError(null);
    
    try {
const vendorOrders = await orderService.getVendorOrders(vendor.id);
      setOrders(vendorOrders);
    } catch (error) {
      console.error('Error loading vendor orders:', error);
      setError(error.message);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleAvailabilityUpdate = async (orderId, productId, available, notes = '') => {
    try {
await orderService.updateVendorAvailability(orderId, vendor.id, productId, {
        available,
        notes,
        timestamp: new Date().toISOString()
      });
      
      // Reload orders to reflect changes
      await loadVendorOrders();
      
      toast.success(`Product availability updated successfully`);
    } catch (error) {
      toast.error('Failed to update availability: ' + error.message);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toString().includes(searchTerm) ||
                         order.deliveryAddress?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'pending' && order.status === 'pending') ||
                         (statusFilter === 'responded' && order.vendor_availability);
    
    return matchesSearch && matchesStatus;
  });

  const getAvailabilityStatus = (order, productId) => {
    if (!order.vendor_availability) return 'pending';
const key = `${productId}_${vendor.id}`;
    const availability = order.vendor_availability[key];
    
    if (!availability) return 'pending';
    return availability.available ? 'available' : 'unavailable';
  };

  if (loading) {
    return <Loading type="component" />;
  }

  if (error) {
    return <Error message={error} />;
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon="Search"
          />
        </div>
        <div className="sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="all">All Orders</option>
            <option value="pending">Pending Response</option>
            <option value="responded">Responded</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <div key={order.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h3 className="font-semibold text-gray-900">Order #{order.id}</h3>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                  {order.deliveryAddress?.name || 'N/A'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {new Date(order.createdAt).toLocaleDateString()}
              </div>
            </div>
            
            <div className="p-4">
              <div className="space-y-3">
                {order.items?.filter(item => 
                  // Filter items assigned to this vendor (simplified logic)
item.productId % 3 + 1 === vendor.id
                ).map((item) => (
                  <div key={item.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.name}</h4>
                      <p className="text-sm text-gray-600">
                        Qty: {item.quantity} {item.unit} × {formatCurrency(item.price)}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <span className="font-medium text-gray-900">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                      
                      {/* Availability Status & Actions */}
                      <div className="flex items-center space-x-2">
                        {getAvailabilityStatus(order, item.productId) === 'pending' ? (
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleAvailabilityUpdate(order.id, item.productId, true)}
                            >
                              <ApperIcon name="CheckCircle" size={14} className="mr-1" />
                              Available
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAvailabilityUpdate(order.id, item.productId, false)}
                            >
                              <ApperIcon name="XCircle" size={14} className="mr-1" />
                              Unavailable
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              getAvailabilityStatus(order, item.productId) === 'available' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              <ApperIcon 
                                name={getAvailabilityStatus(order, item.productId) === 'available' ? 'CheckCircle' : 'XCircle'} 
                                size={12} 
                                className="mr-1" 
                              />
                              {getAvailabilityStatus(order, item.productId) === 'available' ? 'Available' : 'Unavailable'}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const currentStatus = getAvailabilityStatus(order, item.productId);
                                handleAvailabilityUpdate(order.id, item.productId, currentStatus !== 'available');
                              }}
                            >
                              <ApperIcon name="RefreshCw" size={14} />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <ApperIcon name="ClipboardList" size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-500">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'No orders requiring availability response yet.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

// Legacy Vendor Fulfillment Tab Component (kept for compatibility)
const VendorFulfillmentTab = ({ vendor }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  useEffect(() => {
    loadFulfillmentOrders();
  }, [vendor]);

  const loadFulfillmentOrders = async () => {
    if (!vendor) return;
    
    setLoading(true);
    setError(null);
    
    try {
const fulfillmentOrders = await orderService.getFulfillmentOrders(vendor.id);
      setOrders(fulfillmentOrders);
    } catch (error) {
      console.error('Error loading fulfillment orders:', error);
      setError(error.message);
      toast.error('Failed to load fulfillment orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStageUpdate = async (orderId, newStage) => {
    try {
      await orderService.updateFulfillmentStage(orderId, newStage);
      await loadFulfillmentOrders();
      toast.success(`Order updated to ${newStage.replace('_', ' ')}`);
    } catch (error) {
      toast.error('Failed to update fulfillment stage: ' + error.message);
    }
  };

  const handlePackProducts = async (orderId) => {
    try {
      const updatedOrder = await orderService.updateFulfillmentStage(orderId, 'packed');
      await loadFulfillmentOrders();
      toast.success('Products packed successfully');
    } catch (error) {
      toast.error('Failed to pack products: ' + error.message);
    }
  };

  const handleProcessPayment = async (orderId) => {
    try {
      await orderService.updateFulfillmentStage(orderId, 'payment_processed');
      await loadFulfillmentOrders();
      toast.success('Payment processed');
    } catch (error) {
      toast.error('Failed to process payment: ' + error.message);
    }
  };

  const handleHandover = (order) => {
    setSelectedOrder(order);
    setShowSignatureModal(true);
  };

  const handleSignatureComplete = async (signatureData) => {
    try {
      await orderService.confirmHandover(selectedOrder.id, {
        signature: signatureData,
signature: signatureData,
        vendorId: vendor.id,
      });
      
      setShowSignatureModal(false);
      setSelectedOrder(null);
      await loadFulfillmentOrders();
      toast.success('Order handed over to delivery successfully');
    } catch (error) {
      toast.error('Failed to complete handover: ' + error.message);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toString().includes(searchTerm) ||
                         order.deliveryAddress?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStage = stageFilter === 'all' || order.fulfillment_stage === stageFilter;
    
    return matchesSearch && matchesStage;
  });

  const getStageColor = (stage) => {
    switch (stage) {
      case 'availability_confirmed': return 'bg-blue-100 text-blue-800';
      case 'packed': return 'bg-green-100 text-green-800';
      case 'payment_processed': return 'bg-yellow-100 text-yellow-800';
      case 'admin_paid': return 'bg-purple-100 text-purple-800';
      case 'handed_over': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCardColor = (stage) => {
    switch (stage) {
      case 'packed':
      case 'payment_processed':
      case 'admin_paid':
        return 'border-l-4 border-l-green-500 bg-green-50';
      case 'availability_confirmed':
        return 'border-l-4 border-l-yellow-500 bg-yellow-50';
      default:
        return 'border-l-4 border-l-gray-300 bg-white';
    }
  };

  const getNextAction = (stage) => {
    switch (stage) {
      case 'availability_confirmed':
        return { action: 'pack', label: 'Pack Products', icon: 'Package' };
      case 'packed':
        return { action: 'process_payment', label: 'Process Payment', icon: 'CreditCard' };
      case 'payment_processed':
        return { action: 'await_admin', label: 'Awaiting Admin Payment', icon: 'Clock', disabled: true };
      case 'admin_paid':
        return { action: 'handover', label: 'Handover to Delivery', icon: 'Truck' };
      case 'handed_over':
        return { action: 'completed', label: 'Completed', icon: 'CheckCircle', disabled: true };
      default:
        return null;
    }
  };

  if (loading) {
    return <Loading type="component" />;
  }

  if (error) {
    return <Error message={error} />;
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon="Search"
          />
        </div>
        <div className="sm:w-64">
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="all">All Stages</option>
            <option value="availability_confirmed">Availability Confirmed</option>
            <option value="packed">Packed</option>
            <option value="payment_processed">Payment Processed</option>
            <option value="admin_paid">Admin Paid</option>
            <option value="handed_over">Handed Over</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.map((order) => {
          const nextAction = getNextAction(order.fulfillment_stage);
          
          return (
            <div key={order.id} className={`rounded-lg overflow-hidden shadow-sm ${getCardColor(order.fulfillment_stage)}`}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <h3 className="font-semibold text-gray-900">Order #{order.id}</h3>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStageColor(order.fulfillment_stage)}`}>
                      {order.fulfillment_stage?.replace('_', ' ').toUpperCase() || 'PENDING'}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                      {order.deliveryAddress?.name || 'N/A'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatCurrency(order.total)}
                  </div>
                </div>

                {/* Order Items */}
                <div className="mb-4">
                  <div className="space-y-2">
                    {order.items?.filter(item => 
(item.productId % 3 + 1) === vendor.id
                    ).map((item) => (
                      <div key={item.productId} className="flex items-center justify-between p-2 bg-white rounded border">
                        <div>
                          <span className="font-medium text-gray-900">{item.name}</span>
                          <span className="text-sm text-gray-600 ml-2">
                            {item.quantity} {item.unit} × {formatCurrency(item.price)}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery Assignment Info */}
                {order.assignedDelivery && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center mb-2">
                      <ApperIcon name="Truck" size={16} className="text-blue-600 mr-2" />
                      <span className="font-medium text-blue-900">Delivery Assignment</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Personnel:</span>
                        <span className="ml-2 font-medium">{order.assignedDelivery.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Phone:</span>
                        <span className="ml-2 font-medium">{order.assignedDelivery.phone}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">ETA:</span>
                        <span className="ml-2 font-medium">{order.assignedDelivery.eta}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Vehicle:</span>
                        <span className="ml-2 font-medium">{order.assignedDelivery.vehicle}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Button */}
                {nextAction && (
                  <div className="flex justify-end">
                    <Button
                      onClick={() => {
                        if (nextAction.action === 'pack') {
                          handlePackProducts(order.id);
                        } else if (nextAction.action === 'process_payment') {
                          handleProcessPayment(order.id);
                        } else if (nextAction.action === 'handover') {
                          handleHandover(order);
                        }
                      }}
                      variant={nextAction.disabled ? "outline" : "primary"}
                      size="sm"
                      disabled={nextAction.disabled}
                    >
                      <ApperIcon name={nextAction.icon} size={16} className="mr-2" />
                      {nextAction.label}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <ApperIcon name="Truck" size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No fulfillment orders found</h3>
          <p className="text-gray-500">
            {searchTerm || stageFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'No orders require fulfillment processing yet.'
            }
          </p>
        </div>
      )}

      {/* Signature Modal */}
      {showSignatureModal && selectedOrder && (
        <SignatureModal
          order={selectedOrder}
          onSignatureComplete={handleSignatureComplete}
          onClose={() => {
            setShowSignatureModal(false);
            setSelectedOrder(null);
          }}
        />
      )}
    </div>
  );
};

// Signature Capture Modal Component
const SignatureModal = ({ order, onSignatureComplete, onClose }) => {
  const canvasRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [signature, setSignature] = React.useState(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
    }
  }, []);

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const signatureData = canvas.toDataURL();
    setSignature(signatureData);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature(null);
  };

  const handleSubmit = () => {
    if (!signature) {
      toast.error('Please provide your signature');
      return;
    }
    onSignatureComplete(signature);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Handover Signature
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <ApperIcon name="X" size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-700 mb-2">
              <strong>Order:</strong> #{order.id}
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Customer:</strong> {order.deliveryAddress?.name}
            </p>
            <p className="text-sm text-gray-700">
              <strong>Total:</strong> {formatCurrency(order.total)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vendor Signature
            </label>
            <div className="border-2 border-gray-300 rounded-lg">
              <canvas
                ref={canvasRef}
                width={350}
                height={150}
                className="w-full cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Sign above to confirm handover to delivery personnel
            </p>
          </div>

          <div className="flex space-x-3">
            <Button
              onClick={clearSignature}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <ApperIcon name="RotateCcw" size={16} className="mr-2" />
              Clear
            </Button>
            <Button
              onClick={handleSubmit}
              variant="primary"
              size="sm"
              className="flex-1"
              disabled={!signature}
            >
              <ApperIcon name="Check" size={16} className="mr-2" />
              Confirm Handover
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorPortal;