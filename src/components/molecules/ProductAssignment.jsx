import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Badge } from '@/components/atoms/Badge';
import Loading from '@/components/ui/Loading';
import Error from '@/components/ui/Error';
import { productService } from '@/services/api/productService';
import { vendorService } from '@/services/api/vendorService';

const ProductAssignment = ({ 
  vendor, 
  availableProducts = [], 
  onAssign, 
  loading = false, 
  error = null 
}) => {
  const [products, setProducts] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (vendor?.Id && products.length > 0) {
      loadExistingAssignments();
    }
  }, [vendor, products]);

  const loadProducts = async () => {
    try {
      setProductsLoading(true);
      setProductsError(null);
      const data = await productService.getAll('admin');
      setProducts(data);
    } catch (err) {
      setProductsError(err.message);
      toast.error('Failed to load products');
    } finally {
      setProductsLoading(false);
    }
  };

  const loadExistingAssignments = async () => {
    try {
      // Get existing assignments for this vendor
const vendorProducts = await vendorService.getVendorProducts(vendor.Id);
      const assignedIds = vendorProducts.map(p => p.id);
      setSelectedProductIds(assignedIds);
    } catch (err) {
      console.error('Failed to load existing assignments:', err);
    }
  };

  const handleProductToggle = (productId) => {
    setSelectedProductIds(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const handleSelectAll = () => {
    const filteredProducts = getFilteredProducts();
    const allSelected = filteredProducts.every(product => selectedProductIds.includes(product.id));
    
    if (allSelected) {
      // Deselect all filtered products
      const filteredIds = filteredProducts.map(p => p.id);
      setSelectedProductIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Select all filtered products
      const filteredIds = filteredProducts.map(p => p.id);
      setSelectedProductIds(prev => {
        const newIds = [...prev];
        filteredIds.forEach(id => {
          if (!newIds.includes(id)) {
            newIds.push(id);
          }
        });
        return newIds;
      });
    }
  };

  const handleAssignProducts = async () => {
    if (selectedProductIds.length === 0) {
      toast.warning('Please select at least one product to assign');
      return;
    }

    setAssignmentLoading(true);
    try {
await vendorService.assignProductsToVendor(vendor.Id, selectedProductIds);
      toast.success(`Successfully assigned ${selectedProductIds.length} products to ${vendor.name}`);
      onAssign?.(selectedProductIds);
    } catch (err) {
      toast.error(err.message || 'Failed to assign products');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const getFilteredProducts = () => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (product.vendor && product.vendor.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  };

  const getCategories = () => {
    const categories = [...new Set(products.map(p => p.category))];
    return categories.sort();
  };

  if (productsLoading) return <Loading type="component" />;
  if (productsError) return <Error message={productsError} onRetry={loadProducts} />;
  if (loading) return <Loading type="component" />;
  if (error) return <Error message={error} />;

  const filteredProducts = getFilteredProducts();
  const categories = getCategories();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900">
          Product Assignment {vendor?.name ? `for ${vendor.name}` : ''}
        </h4>
        <Badge variant="secondary" className="text-xs">
          {selectedProductIds.length} selected
        </Badge>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search products by name, category, or vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="all">All Categories</option>
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>

      {/* Bulk Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSelectAll}
          disabled={filteredProducts.length === 0}
        >
          {filteredProducts.every(product => selectedProductIds.includes(product.id)) ? 'Deselect' : 'Select'} All
        </Button>
        <span className="text-sm text-gray-500">
          {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} available
        </span>
      </div>

      {/* Products Grid */}
      <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
        {filteredProducts.length === 0 ? (
          <div className="p-8 text-center">
            <ApperIcon name="Package" size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No products found matching your criteria</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedProductIds.includes(product.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleProductToggle(product.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedProductIds.includes(product.id)}
                  onChange={() => handleProductToggle(product.id)}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded mr-3"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {product.name}
                    </p>
                    <div className="flex items-center space-x-2 ml-2">
                      <Badge variant="outline" className="text-xs">
                        {product.category}
                      </Badge>
                      <span className="text-sm font-medium text-gray-900">
                        Rs. {product.price}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Stock: {product.stock} {product.unit} • Vendor: {product.vendor}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Products Summary */}
      {selectedProductIds.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {selectedProductIds.length} product{selectedProductIds.length !== 1 ? 's' : ''} selected
              </p>
              <p className="text-xs text-gray-600">
                Ready to assign to {vendor?.name || 'vendor'}
              </p>
            </div>
            <Button
              onClick={handleAssignProducts}
              disabled={assignmentLoading}
              className="bg-primary text-white hover:bg-primary/90"
              size="sm"
            >
              {assignmentLoading ? (
                <ApperIcon name="Loader2" size={14} className="animate-spin mr-2" />
              ) : (
                <ApperIcon name="Check" size={14} className="mr-2" />
              )}
              Assign Products
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductAssignment;