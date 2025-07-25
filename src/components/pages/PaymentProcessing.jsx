import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { CreditCard, Wallet, Phone, MapPin, AlertCircle, CheckCircle, Clock, RefreshCw, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import Loading from '@/components/ui/Loading';
import Error from '@/components/ui/Error';
import { paymentService } from '@/services/api/paymentService';
import { formatCurrency } from '@/utils/currency';

const PaymentProcessing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract payment data from navigation state
  const {
    amount = 0,
    orderId = null,
    paymentMethod = 'cash',
    orderData = null,
    returnUrl = '/orders'
  } = location.state || {};

  // Component state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('pending'); // pending, processing, success, failed
  const [paymentResult, setPaymentResult] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [validationErrors, setValidationErrors] = useState({});

  // Payment form data
  const [paymentData, setPaymentData] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
    phone: '',
    transactionId: '',
    bankAccount: ''
  });

  const maxRetries = 3;

  // Load wallet balance on component mount
  useEffect(() => {
    if (paymentMethod === 'wallet') {
      loadWalletBalance();
    }
    
    // Validate payment parameters
    validatePaymentParameters();
  }, [paymentMethod]);

  const loadWalletBalance = async () => {
    try {
      const balance = await paymentService.getWalletBalance();
      setWalletBalance(balance);
    } catch (error) {
      console.error('Failed to load wallet balance:', error);
      setError('Failed to load wallet balance. Please try again.');
    }
  };

  const validatePaymentParameters = useCallback(() => {
    const errors = {};

    // Validate amount
    if (!amount || amount <= 0) {
      errors.amount = 'Payment amount must be greater than zero';
      setError('Insufficient payment amount. Amount must be greater than zero.');
      return false;
    }

    // Validate order ID
    if (!orderId) {
      errors.orderId = 'Order ID is required';
      setError('Invalid order information. Please try again.');
      return false;
    }

    // Validate payment method
    const validMethods = ['cash', 'card', 'wallet', 'jazzcash', 'easypaisa', 'bank'];
    if (!validMethods.includes(paymentMethod)) {
      errors.paymentMethod = 'Invalid payment method';
      setError('Invalid payment method selected.');
      return false;
    }

    // Wallet-specific validation
    if (paymentMethod === 'wallet' && walletBalance < amount) {
      errors.walletBalance = 'Insufficient wallet balance';
      setError(`Insufficient wallet balance. Current balance: ${formatCurrency(walletBalance)}, Required: ${formatCurrency(amount)}`);
      return false;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [amount, orderId, paymentMethod, walletBalance]);

  const validatePaymentForm = () => {
    const errors = {};

    switch (paymentMethod) {
      case 'card':
        if (!paymentData.cardNumber || paymentData.cardNumber.replace(/\s/g, '').length < 13) {
          errors.cardNumber = 'Please enter a valid card number';
        }
        if (!paymentData.expiryDate || !paymentData.expiryDate.match(/^(0[1-9]|1[0-2])\/\d{2}$/)) {
          errors.expiryDate = 'Please enter a valid expiry date (MM/YY)';
        }
        if (!paymentData.cvv || paymentData.cvv.length < 3) {
          errors.cvv = 'Please enter a valid CVV';
        }
        if (!paymentData.cardholderName || paymentData.cardholderName.trim().length < 2) {
          errors.cardholderName = 'Please enter the cardholder name';
        }
        break;

      case 'jazzcash':
      case 'easypaisa':
        if (!paymentData.phone || !paymentData.phone.match(/^03[0-9]{9}$/)) {
          errors.phone = 'Please enter a valid Pakistani mobile number (03XXXXXXXXX)';
        }
        break;

      case 'bank':
        if (!paymentData.transactionId || paymentData.transactionId.trim().length < 5) {
          errors.transactionId = 'Please enter a valid transaction ID';
        }
        break;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setPaymentData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear specific field error
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const processPayment = async (isRetry = false) => {
    if (!validatePaymentParameters()) {
      return;
    }

    if (paymentMethod !== 'cash' && !validatePaymentForm()) {
      toast.error('Please check your payment details');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setPaymentStatus('processing');

      let result = null;

      switch (paymentMethod) {
        case 'cash':
          // Cash payments are automatically approved
          result = {
            transactionId: `CASH_${Date.now()}`,
            status: 'pending',
            amount,
            paymentMethod: 'cash',
            timestamp: new Date().toISOString(),
            requiresDeliveryConfirmation: true
          };
          setPaymentStatus('success');
          break;

        case 'card':
          result = await paymentService.processCardPayment({
            cardNumber: paymentData.cardNumber,
            expiryDate: paymentData.expiryDate,
            cvv: paymentData.cvv,
            cardholderName: paymentData.cardholderName
          }, amount, orderId);
          setPaymentStatus('success');
          break;

        case 'wallet':
          // Double-check wallet balance before processing
          const currentBalance = await paymentService.getWalletBalance();
          if (currentBalance < amount) {
            throw new Error(`Insufficient wallet balance. Current balance: ${formatCurrency(currentBalance)}, Required: ${formatCurrency(amount)}`);
          }
          
          result = await paymentService.processWalletPayment(amount, orderId);
          setPaymentStatus('success');
          break;

        case 'jazzcash':
        case 'easypaisa':
          result = await paymentService.processDigitalWalletPayment(
            paymentMethod,
            amount,
            orderId,
            paymentData.phone
          );
          setPaymentStatus('success');
          break;

        case 'bank':
          result = await paymentService.processBankTransfer(
            amount,
            orderId,
            { 
              accountNumber: paymentData.bankAccount || '1234567890',
              transactionId: paymentData.transactionId
            }
          );
          setPaymentStatus('success');
          break;

        default:
          throw new Error(`Unsupported payment method: ${paymentMethod}`);
      }

      setPaymentResult(result);
      toast.success('Payment processed successfully!');

      // Navigate to success page or return URL after a short delay
      setTimeout(() => {
        navigate(returnUrl, {
          state: {
            paymentResult: result,
            orderData,
            paymentStatus: 'completed'
          }
        });
      }, 2000);

    } catch (error) {
      console.error('Payment processing error:', error);
      setPaymentStatus('failed');
      setError(error.message || 'Payment processing failed');
      
      // Handle specific error types
      if (error.message.includes('Insufficient')) {
        toast.error(error.message);
      } else if (error.code === 'WALLET_PAYMENT_FAILED') {
        toast.error(error.userGuidance || error.message);
      } else {
        toast.error('Payment failed. Please try again.');
      }

      // Offer retry if within limits
      if (retryCount < maxRetries && !isRetry) {
        setTimeout(() => {
          if (window.confirm('Payment failed. Would you like to retry?')) {
            handleRetry();
          }
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setError(null);
    setPaymentStatus('pending');
    processPayment(true);
  };

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel this payment?')) {
      navigate(-1);
    }
  };

  // Redirect if no payment data
  if (!amount || !orderId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-error mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Payment Request</h1>
          <p className="text-gray-600 mb-6">Payment information is missing or invalid.</p>
          <Button onclick={() => navigate('/')}>
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            {paymentStatus === 'success' ? (
              <CheckCircle className="h-16 w-16 text-success" />
            ) : paymentStatus === 'failed' ? (
              <AlertCircle className="h-16 w-16 text-error" />
            ) : paymentStatus === 'processing' ? (
              <Clock className="h-16 w-16 text-warning animate-spin" />
            ) : (
              <CreditCard className="h-16 w-16 text-primary" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {paymentStatus === 'success' ? 'Payment Successful' :
             paymentStatus === 'failed' ? 'Payment Failed' :
             paymentStatus === 'processing' ? 'Processing Payment' :
             'Complete Payment'}
          </h1>
          <p className="text-gray-600">
            {paymentStatus === 'success' ? 'Your payment has been processed successfully' :
             paymentStatus === 'failed' ? 'There was an issue processing your payment' :
             paymentStatus === 'processing' ? 'Please wait while we process your payment' :
             'Review your payment details and confirm'}
          </p>
        </div>

        {/* Payment Summary Card */}
        <div className="card p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Payment Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Order ID:</span>
              <span className="font-medium">{orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Method:</span>
              <span className="font-medium capitalize">{paymentMethod}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Amount:</span>
              <span className="font-bold text-lg gradient-text">
                {formatCurrency(amount)}
              </span>
            </div>
            {paymentMethod === 'wallet' && (
              <div className="flex justify-between">
                <span className="text-gray-600">Current Balance:</span>
                <span className={`font-medium ${walletBalance >= amount ? 'text-success' : 'text-error'}`}>
                  {formatCurrency(walletBalance)}
                </span>
              </div>
            )}
            {retryCount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Retry Attempt:</span>
                <span className="font-medium text-warning">
                  {retryCount} of {maxRetries}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6">
            <Error message={error} />
          </div>
        )}

        {/* Payment Form */}
        {paymentStatus === 'pending' && paymentMethod !== 'cash' && (
          <div className="card p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Payment Details</h2>
            
            {paymentMethod === 'card' && (
              <div className="space-y-4">
                <Input
                  label="Card Number"
                  value={paymentData.cardNumber}
                  onChange={(e) => handleInputChange('cardNumber', e.target.value)}
                  placeholder="1234 5678 9012 3456"
                  error={validationErrors.cardNumber}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Expiry Date"
                    value={paymentData.expiryDate}
                    onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                    placeholder="MM/YY"
                    error={validationErrors.expiryDate}
                  />
                  <Input
                    label="CVV"
                    value={paymentData.cvv}
                    onChange={(e) => handleInputChange('cvv', e.target.value)}
                    placeholder="123"
                    error={validationErrors.cvv}
                  />
                </div>
                <Input
                  label="Cardholder Name"
                  value={paymentData.cardholderName}
                  onChange={(e) => handleInputChange('cardholderName', e.target.value)}
                  placeholder="John Doe"
                  error={validationErrors.cardholderName}
                />
              </div>
            )}

            {(paymentMethod === 'jazzcash' || paymentMethod === 'easypaisa') && (
              <div className="space-y-4">
                <Input
                  label="Mobile Number"
                  value={paymentData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="03XXXXXXXXX"
                  error={validationErrors.phone}
                />
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Instructions:</strong> You will receive an SMS with payment instructions 
                    after clicking "Process Payment". Please follow the instructions to complete 
                    your {paymentMethod} payment.
                  </p>
                </div>
              </div>
            )}

            {paymentMethod === 'bank' && (
              <div className="space-y-4">
                <Input
                  label="Transaction ID"
                  value={paymentData.transactionId}
                  onChange={(e) => handleInputChange('transactionId', e.target.value)}
                  placeholder="Enter your bank transaction ID"
                  error={validationErrors.transactionId}
                />
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Instructions:</strong> Please transfer the amount to our bank account 
                    and enter the transaction ID above. Your order will be processed after 
                    payment verification.
                  </p>
                </div>
              </div>
            )}

            {paymentMethod === 'wallet' && walletBalance < amount && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <p className="text-sm text-red-800">
                    Insufficient wallet balance. Please add funds to your wallet or choose 
                    a different payment method.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Success Message */}
        {paymentStatus === 'success' && paymentResult && (
          <div className="card p-6 mb-6 border-2 border-success">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-success mb-2">Payment Completed!</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p><strong>Transaction ID:</strong> {paymentResult.transactionId}</p>
                <p><strong>Amount:</strong> {formatCurrency(paymentResult.amount || amount)}</p>
                <p><strong>Status:</strong> {paymentResult.status}</p>
                {paymentResult.timestamp && (
                  <p><strong>Time:</strong> {new Date(paymentResult.timestamp).toLocaleString()}</p>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Redirecting to your orders...
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          {paymentStatus === 'pending' && (
            <>
              <Button
                onClick={() => processPayment()}
                disabled={loading || (paymentMethod === 'wallet' && walletBalance < amount)}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Process Payment - ${formatCurrency(amount)}`
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
            </>
          )}

          {paymentStatus === 'failed' && retryCount < maxRetries && (
            <>
              <Button
                onClick={handleRetry}
                disabled={loading}
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Payment
              </Button>
              <Button
                variant="secondary"
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
            </>
          )}

          {(paymentStatus === 'failed' && retryCount >= maxRetries) || paymentStatus === 'success' && (
            <Button
              onClick={() => navigate(returnUrl)}
              className="w-full"
            >
              {paymentStatus === 'success' ? 'Continue' : 'Back to Orders'}
            </Button>
          )}
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 text-center">
              <Loading type="spinner" />
              <p className="mt-4 text-gray-600">Processing your payment...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentProcessing;