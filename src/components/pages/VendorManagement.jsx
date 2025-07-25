import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Badge } from '@/components/atoms/Badge';
import Loading from '@/components/ui/Loading';
import Error from '@/components/ui/Error';
import { vendorService } from '@/services/api/vendorService';
import { productService } from '@/services/api/productService';
import { paymentService } from '@/services/api/paymentService';
import ProductAssignment from '@/components/molecules/ProductAssignment';

const VendorManagement = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    company: '',
    phone: '',
    address: '',
    isActive: true
  });
  const [formLoading, setFormLoading] = useState(false);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [productAssignments, setProductAssignments] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);

  // Payment queue states
  const [paymentQueue, setPaymentQueue] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);
useEffect(() => {
    loadVendors();
    loadAvailableProducts();
    loadPaymentQueue();
  }, []);

  const loadAvailableProducts = async () => {
    try {
      const data = await productService.getAll('admin');
      setAvailableProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const loadVendors = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await vendorService.getAll();
      setVendors(data);
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleStatusFilter = (status) => {
    setStatusFilter(status);
  };

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.company.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && vendor.isActive) ||
                         (statusFilter === 'inactive' && !vendor.isActive);
    
    return matchesSearch && matchesStatus;
  });

const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      company: '',
      phone: '',
      address: '',
      isActive: true
    });
    setEditingVendor(null);
    setShowForm(false);
    setProductAssignments([]);
    setSelectedProducts([]);
  };

const handleEdit = async (vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      email: vendor.email,
      password: '', // Don't pre-fill password
      company: vendor.company || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      isActive: vendor.isActive
    });
    
    // Load existing product assignments for this vendor
    try {
const vendorProducts = await vendorService.getVendorProducts(vendor.Id);
      const assignedProductIds = vendorProducts.map(p => p.id);
      setSelectedProducts(assignedProductIds);
    } catch (err) {
      console.error('Failed to load vendor products:', err);
    }
    
    setShowForm(true);
  };

const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      let vendorResult;
      
      if (editingVendor) {
        // Update existing vendor
        const updateData = { ...formData };
        if (!updateData.password) {
          delete updateData.password; // Don't update password if empty
        }
        vendorResult = await vendorService.update(editingVendor.Id, updateData);
        
        // Update product assignments if changed
if (selectedProducts.length > 0) {
          await vendorService.assignProductsToVendor(editingVendor.Id, selectedProducts);
        }
        
        toast.success('Vendor updated successfully');
      } else {
        // Create new vendor
        vendorResult = await vendorService.create(formData);
        
        // Assign products to new vendor if any selected
if (selectedProducts.length > 0) {
          await vendorService.assignProductsToVendor(vendorResult.Id, selectedProducts);
        }
        
        toast.success('Vendor created successfully');
      }
      
      resetForm();
      loadVendors();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (vendor) => {
    if (!window.confirm(`Are you sure you want to delete ${vendor.name}?`)) {
      return;
    }

    try {
      await vendorService.delete(vendor.Id);
      toast.success('Vendor deleted successfully');
      loadVendors();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleToggleStatus = async (vendor) => {
    try {
      const newStatus = vendor.isActive ? 'inactive' : 'active';
      await vendorService.toggleVendorStatus(vendor.Id, newStatus);
      toast.success(`Vendor ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
      loadVendors();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
};

  // Payment queue functions
  const loadPaymentQueue = async () => {
    try {
      const proofQueue = await paymentService.getPaymentProofQueue();
      setPaymentQueue(proofQueue);
    } catch (err) {
      console.error('Failed to load payment queue:', err);
      toast.error('Failed to load payment queue');
    }
  };

  const handleUploadProof = (payment) => {
    setSelectedPayment(payment);
    setSelectedFile(null);
    setShowUploadModal(true);
  };

  const handleViewProof = (payment) => {
    setSelectedPayment(payment);
    setShowViewModal(true);
  };

  const handleVerifyProof = (payment) => {
    setSelectedPayment(payment);
    setVerificationNotes('');
    setShowVerifyModal(true);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPEG, PNG, and PDF files are allowed');
      return;
    }

    if (file.size > maxSize) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile || !selectedPayment) return;

    setUploadLoading(true);
    try {
      const proofData = {
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSize: selectedFile.size
      };

      await paymentService.uploadPaymentProof(selectedPayment.Id, proofData);
      toast.success('Payment proof uploaded successfully');
      setShowUploadModal(false);
      setSelectedFile(null);
      loadPaymentQueue();
    } catch (err) {
      toast.error(err.message || 'Failed to upload payment proof');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleVerifySubmit = async (approved) => {
    if (!selectedPayment) return;

    setVerifyLoading(true);
    try {
      const verificationData = {
        approved,
        notes: verificationNotes
      };

      await paymentService.verifyPaymentProof(selectedPayment.Id, verificationData);
      toast.success(`Payment proof ${approved ? 'approved' : 'rejected'} successfully`);
      setShowVerifyModal(false);
      setVerificationNotes('');
      loadPaymentQueue();
    } catch (err) {
      toast.error(err.message || 'Failed to verify payment proof');
    } finally {
      setVerifyLoading(false);
    }
  };
  if (loading) return <Loading type="page" />;
  if (error) return <Error message={error} onRetry={loadVendors} />;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Vendor Management</h1>
          <p className="text-gray-600">Manage vendor accounts and permissions</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="mt-4 sm:mt-0 bg-primary text-white hover:bg-primary/90"
        >
          <ApperIcon name="Plus" size={16} className="mr-2" />
          Add Vendor
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search vendors by name, email, or company..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={statusFilter === 'all' ? 'primary' : 'outline'}
              onClick={() => handleStatusFilter('all')}
              size="sm"
            >
              All
            </Button>
            <Button
              variant={statusFilter === 'active' ? 'primary' : 'outline'}
              onClick={() => handleStatusFilter('active')}
              size="sm"
            >
              Active
            </Button>
            <Button
              variant={statusFilter === 'inactive' ? 'primary' : 'outline'}
              onClick={() => handleStatusFilter('inactive')}
              size="sm"
            >
              Inactive
            </Button>
          </div>
        </div>
      </div>

      {/* Vendors Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Join Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredVendors.map((vendor) => (
                <tr key={vendor.Id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{vendor.name}</div>
                      <div className="text-sm text-gray-500">{vendor.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{vendor.phone || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{vendor.company || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge
                      variant={vendor.isActive ? 'success' : 'secondary'}
                      className="text-xs"
                    >
                      {vendor.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(vendor.joinDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(vendor)}
                      >
                        <ApperIcon name="Edit" size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStatus(vendor)}
                        className={vendor.isActive ? 'text-orange-600' : 'text-green-600'}
                      >
                        <ApperIcon name={vendor.isActive ? 'UserX' : 'UserCheck'} size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(vendor)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <ApperIcon name="Trash2" size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredVendors.length === 0 && (
          <div className="text-center py-12">
            <ApperIcon name="Users" size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No vendors found</h3>
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria'
                : 'Get started by adding your first vendor'
              }
            </p>
          </div>
        )}
      </div>

{/* Vendor Payments Section */}
      <div className="bg-white rounded-lg shadow-sm border mt-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Vendor Payment Queue</h2>
              <p className="text-gray-600 text-sm mt-1">Manage payment proof uploads and verifications</p>
            </div>
            <Button
              onClick={loadPaymentQueue}
              variant="outline"
              size="sm"
              className="mt-3 sm:mt-0"
            >
              <ApperIcon name="RefreshCw" size={14} className="mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Submitted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paymentQueue.map((payment) => (
                <tr key={payment.Id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{payment.vendorName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">Rs. {payment.amount?.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {payment.submittedAt ? new Date(payment.submittedAt).toLocaleDateString() : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge
                      variant={payment.status === 'verified' ? 'success' : 
                               payment.status === 'rejected' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {payment.status === 'verified' ? '✓ Verified' : 
                       payment.status === 'rejected' ? '✗ Rejected' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      {payment.paymentProof && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewProof(payment)}
                          className="text-blue-600"
                        >
                          <ApperIcon name="Eye" size={14} className="mr-1" />
                          View
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUploadProof(payment)}
                        className="text-green-600"
                      >
                        <ApperIcon name="Upload" size={14} className="mr-1" />
                        Upload
                      </Button>
                      {payment.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerifyProof(payment)}
                          className="text-purple-600"
                        >
                          <ApperIcon name="CheckCircle" size={14} className="mr-1" />
                          Verify
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paymentQueue.length === 0 && (
          <div className="text-center py-12">
            <ApperIcon name="FileCheck" size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No pending payments</h3>
            <p className="text-gray-500">All vendor payments have been processed</p>
          </div>
        )}
      </div>

      {/* Upload Proof Modal */}
      {showUploadModal && selectedPayment && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowUploadModal(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Upload Payment Proof
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUploadModal(false)}
                  >
                    <ApperIcon name="X" size={16} />
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    <p><strong>Vendor:</strong> {selectedPayment.vendorName}</p>
                    <p><strong>Amount:</strong> Rs. {selectedPayment.amount?.toLocaleString()}</p>
                  </div>
                  
                  {/* File Upload Area */}
                  <div 
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      isDragOver ? 'border-primary bg-primary/5' : 'border-gray-300'
                    }`}
                    onDrop={handleFileDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/jpeg,image/png,application/pdf"
                      className="hidden"
                    />
                    
                    {selectedFile ? (
                      <div className="space-y-2">
                        <ApperIcon name="FileCheck" size={32} className="mx-auto text-green-500" />
                        <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedFile(null)}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <ApperIcon name="Upload" size={32} className="mx-auto text-gray-400" />
                        <p className="text-sm text-gray-600">
                          Drop files here or{' '}
                          <button
                            type="button"
                            className="text-primary font-medium hover:underline"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            browse
                          </button>
                        </p>
                        <p className="text-xs text-gray-500">
                          JPEG, PNG, PDF up to 5MB
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <Button
                  onClick={handleUploadSubmit}
                  disabled={!selectedFile || uploadLoading}
                  className="w-full sm:w-auto sm:ml-3 bg-primary text-white hover:bg-primary/90"
                >
                  {uploadLoading ? (
                    <ApperIcon name="Loader2" size={16} className="animate-spin mr-2" />
                  ) : null}
                  Upload Proof
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowUploadModal(false)}
                  className="mt-3 w-full sm:mt-0 sm:w-auto"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Proof Modal */}
      {showViewModal && selectedPayment && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowViewModal(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Payment Proof - {selectedPayment.vendorName}
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowViewModal(false)}
                  >
                    <ApperIcon name="X" size={16} />
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Amount:</span> Rs. {selectedPayment.amount?.toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Status:</span> {selectedPayment.status}
                    </div>
                    <div>
                      <span className="font-medium">Submitted:</span> {
                        selectedPayment.submittedAt ? new Date(selectedPayment.submittedAt).toLocaleString() : '-'
                      }
                    </div>
                    <div>
                      <span className="font-medium">File:</span> {selectedPayment.paymentProofFileName || 'No file'}
                    </div>
                  </div>
                  
                  {selectedPayment.paymentProof && (
                    <div className="border rounded-lg p-4">
                      <div className="text-center">
                        {selectedPayment.paymentProof.startsWith('data:image/') ? (
                          <img 
                            src={selectedPayment.paymentProof} 
                            alt="Payment Proof" 
                            className="max-w-full max-h-96 mx-auto rounded"
                          />
                        ) : (
                          <div className="py-8">
                            <ApperIcon name="FileText" size={48} className="mx-auto text-gray-400 mb-2" />
                            <p className="text-gray-600">PDF Document</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(selectedPayment.paymentProof, '_blank')}
                              className="mt-2"
                            >
                              <ApperIcon name="ExternalLink" size={14} className="mr-2" />
                              Open PDF
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowViewModal(false)}
                  className="w-full sm:w-auto"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verify Proof Modal */}
      {showVerifyModal && selectedPayment && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowVerifyModal(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Verify Payment Proof
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVerifyModal(false)}
                  >
                    <ApperIcon name="X" size={16} />
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    <p><strong>Vendor:</strong> {selectedPayment.vendorName}</p>
                    <p><strong>Amount:</strong> Rs. {selectedPayment.amount?.toLocaleString()}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Verification Notes
                    </label>
                    <textarea
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      rows={3}
                      placeholder="Add notes about the verification..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse space-x-3 space-x-reverse">
                <Button
                  onClick={() => handleVerifySubmit(true)}
                  disabled={verifyLoading}
                  className="w-full sm:w-auto bg-green-600 text-white hover:bg-green-700"
                >
                  {verifyLoading ? (
                    <ApperIcon name="Loader2" size={16} className="animate-spin mr-2" />
                  ) : (
                    <ApperIcon name="CheckCircle" size={16} className="mr-2" />
                  )}
                  Approve
                </Button>
                <Button
                  onClick={() => handleVerifySubmit(false)}
                  disabled={verifyLoading}
                  className="w-full sm:w-auto mt-3 sm:mt-0 bg-red-600 text-white hover:bg-red-700"
                >
                  {verifyLoading ? (
                    <ApperIcon name="Loader2" size={16} className="animate-spin mr-2" />
                  ) : (
                    <ApperIcon name="XCircle" size={16} className="mr-2" />
                  )}
                  Reject
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowVerifyModal(false)}
                  className="mt-3 w-full sm:mt-0 sm:w-auto"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Vendor Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={resetForm}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetForm}
                    >
                      <ApperIcon name="X" size={16} />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Vendor Information */}
                    <div className="space-y-4">
                      <h4 className="text-md font-medium text-gray-900 border-b pb-2">
                        Vendor Information
                      </h4>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name *
                        </label>
                        <Input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleFormChange}
                          required
                          className="w-full"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email *
                        </label>
                        <Input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleFormChange}
                          required
                          className="w-full"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password {editingVendor ? '(leave empty to keep current)' : '*'}
                        </label>
                        <Input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleFormChange}
                          required={!editingVendor}
                          className="w-full"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Company
                        </label>
                        <Input
                          type="text"
                          name="company"
                          value={formData.company}
                          onChange={handleFormChange}
                          className="w-full"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone
                        </label>
                        <Input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleFormChange}
                          className="w-full"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Address
                        </label>
                        <textarea
                          name="address"
                          value={formData.address}
                          onChange={handleFormChange}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="isActive"
                          name="isActive"
                          checked={formData.isActive}
                          onChange={handleFormChange}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                        <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                          Active vendor
                        </label>
                      </div>
                    </div>

                    {/* Product Assignment */}
                    <div className="space-y-4">
                      <h4 className="text-md font-medium text-gray-900 border-b pb-2">
                        Product Assignment
                      </h4>
                      
                      <ProductAssignment
                        vendor={editingVendor || { name: formData.name, Id: 'new' }}
                        availableProducts={availableProducts}
                        onAssign={(productIds) => {
                          setSelectedProducts(productIds);
                          toast.success(`${productIds.length} products will be assigned`);
                        }}
                        loading={false}
                        error={null}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <Button
                    type="submit"
                    disabled={formLoading}
                    className="w-full sm:w-auto sm:ml-3 bg-primary text-white hover:bg-primary/90"
                  >
                    {formLoading ? (
                      <ApperIcon name="Loader2" size={16} className="animate-spin mr-2" />
                    ) : null}
                    {editingVendor ? 'Update' : 'Create'} Vendor
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                    className="mt-3 w-full sm:mt-0 sm:w-auto"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorManagement;