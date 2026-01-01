import React, { useEffect, useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import Header from './Header';
import { useNavigate } from 'react-router-dom';

const BuyNowCheckout = () => {
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    region: '',
    country: '',
    shippingMethod: 'Standard Delivery',
    paymentMethod: 'EasyPaisa', // Default to EasyPaisa, will add COD option
    promoCode: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [bankTransferProofBase64, setBankTransferProofBase64] = useState(null);
  const [convertingImage, setConvertingImage] = useState(false);
  
  // Promo code states
  const [promoApplied, setPromoApplied] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');

  // Load buy now product from session storage
  useEffect(() => {
    try {
      const buyNowItem = sessionStorage.getItem('buyNowItem');
      if (buyNowItem) {
        const parsedProduct = JSON.parse(buyNowItem);
        setProduct(parsedProduct);
        setCartItems([{
          id: parsedProduct.id || `temp_${Date.now()}`,
          ...parsedProduct,
          quantity: parsedProduct.quantity || 1,
          createdAt: new Date()
        }]);
      }
    } catch (error) {
      console.error('Error loading buy now product:', error);
    }
  }, []);

  // Calculate shipping cost based on payment method and city
  const calculateShippingCost = () => {
    if (form.paymentMethod === 'EasyPaisa') {
      return 150; // Online payment - flat rate for all Pakistan
    } else if (form.paymentMethod === 'Cash on Delivery') {
      const city = form.city.toLowerCase().trim();
      if (city === 'lahore' || city === 'sialkot') {
        return 300; // Updated to 300
      } else if (city === 'karachi') {
        return 390; // Updated to 390
      } else {
        return 360; // Updated to 360 for other cities
      }
    }
    return 150; // Default fallback
  };

  // Calculate sales tax (4% for COD only)
  const calculateSalesTax = () => {
    if (form.paymentMethod === 'Cash on Delivery') {
      return subtotal * 0.04; // 4% sales tax
    }
    return 0; // No sales tax for EasyPaisa
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
  const shippingCost = calculateShippingCost();
  const salesTax = calculateSalesTax();
  
  // Calculate total with discount
  const discountedSubtotal = subtotal - discount;
  const total = Math.max(0, discountedSubtotal + shippingCost + salesTax);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error for the field being changed
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    // Clear the Base64 string if payment method changes and no upload needed
    if (name === 'paymentMethod' && value !== 'EasyPaisa' && value !== 'Cash on Delivery') {
      setBankTransferProofBase64(null);
      setErrors(prev => ({ ...prev, bankTransferProof: '' }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Basic file size validation (5MB limit)
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        setErrors(prev => ({ ...prev, bankTransferProof: 'File size exceeds 5MB limit.' }));
        setBankTransferProofBase64(null);
        return;
      }

      setConvertingImage(true);
      setErrors(prev => ({ ...prev, bankTransferProof: '' }));

      const reader = new FileReader();
      reader.onloadend = () => {
        setBankTransferProofBase64(reader.result);
        setConvertingImage(false);
      };
      reader.onerror = (error) => {
        console.error("Error converting file to Base64:", error);
        setBankTransferProofBase64(null);
        setConvertingImage(false);
        setErrors(prev => ({ ...prev, bankTransferProof: 'Failed to read image file.' }));
      };
      reader.readAsDataURL(file);
    } else {
      setBankTransferProofBase64(null);
      setErrors(prev => ({ ...prev, bankTransferProof: '' }));
    }
  };

  // Validate promo code
  const validatePromoCode = (code) => {
    const validCodes = [
      {
        code: 'IJS12',
        discountPercent: 12,
        validFrom: new Date('2026-01-01'), // Set your start date
        validTo: new Date(new Date().getTime() + (5 * 24 * 60 * 60 * 1000)) // 5 days from now
      }
      // Add more promo codes here as needed
    ];

    const promo = validCodes.find(p => p.code.toUpperCase() === code.toUpperCase());
    
    if (!promo) {
      return { valid: false, message: 'Invalid promo code' };
    }

    const now = new Date();
    if (now < promo.validFrom) {
      return { valid: false, message: 'Promo code not yet active' };
    }

    if (now > promo.validTo) {
      return { valid: false, message: 'Promo code has expired' };
    }

    return {
      valid: true,
      discountPercent: promo.discountPercent,
      message: `Promo code applied! You get ${promo.discountPercent}% off`
    };
  };

  // Apply promo code
  const applyPromoCode = () => {
    if (!form.promoCode.trim()) {
      setPromoError('Please enter a promo code');
      setPromoSuccess('');
      return;
    }

    const validation = validatePromoCode(form.promoCode);
    
    if (!validation.valid) {
      setPromoError(validation.message);
      setPromoSuccess('');
      setPromoApplied(false);
      setDiscount(0);
      return;
    }

    // Calculate discount amount
    const discountAmount = (subtotal * validation.discountPercent) / 100;
    setDiscount(discountAmount);
    setPromoApplied(true);
    setPromoSuccess(validation.message);
    setPromoError('');
  };

  // Remove promo code
  const removePromoCode = () => {
    setPromoApplied(false);
    setDiscount(0);
    setForm(prev => ({ ...prev, promoCode: '' }));
    setPromoSuccess('');
    setPromoError('');
  };

  const validateForm = () => {
    const newErrors = {};
    const requiredFields = [ 'fullName', 'phone', 'address', 'city', 'region', 'country'];
    
    requiredFields.forEach(field => {
      if (!form[field]) {
        newErrors[field] = 'This field is required';
      }
    });

    // Email validation
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Basic phone number validation
    if (form.phone && !/^\d{7,}$/.test(form.phone.replace(/[\s\-\(\)]/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number (at least 7 digits)';
    }

    // Image upload validation for both payment methods
    if ((form.paymentMethod === 'EasyPaisa' || form.paymentMethod === 'Cash on Delivery') && !bankTransferProofBase64) {
      if (form.paymentMethod === 'EasyPaisa') {
        newErrors.bankTransferProof = 'Please upload a screenshot of your EasyPaisa transaction.';
      } else {
        newErrors.bankTransferProof = 'Please upload proof of advance delivery charges payment.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const placeOrder = async () => {
    if (!validateForm()) {
      // Scroll to the first error field
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        const element = document.getElementsByName(firstErrorField)[0] || 
                      document.getElementById(firstErrorField);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    setLoading(true);

    // Generate unique order ID
    const orderId = 'BUYNOW_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const order = {
      orderId,
      customerType: 'guest',
      customerEmail: form.email,
      items: cartItems.map(item => ({
        productId: item.productId || item.id.replace('temp_', ''),
        title: item.title,
        quantity: item.quantity || 1,
        price: item.price,
        image: item.image || item.coverImage,
        // Store variation details
        variation: item.variation || null,
        type: item.type || null,
        size: item.size || null,
        color: item.color || null,
        lining: item.lining || false,
      })),
      shipping: form.shippingMethod,
      payment: form.paymentMethod,
      shippingAddress: {
        fullName: form.fullName,
        phone: form.phone,
        address: form.address,
        city: form.city,
        postalCode: form.postalCode,
        region: form.region,
        country: form.country,
      },
      promoCode: form.promoCode,
      discountApplied: discount,
      discountPercent: promoApplied ? 12 : 0,
      notes: form.notes,
      subtotal,
      discount,
      shippingCost,
      salesTax,
      total,
      createdAt: new Date(),
      status: 'processing',
      buyNow: true,
      bankTransferProofBase64: (form.paymentMethod === 'EasyPaisa' || form.paymentMethod === 'Cash on Delivery') ? bankTransferProofBase64 : null,
    };

    try {
      await addDoc(collection(db, 'orders'), order);
      
      // Clear the buy now item from storage
      sessionStorage.removeItem('buyNowItem');
      
      // Store order details for confirmation page
      sessionStorage.setItem('lastOrderId', orderId);
      sessionStorage.setItem('lastOrderEmail', form.email);
      sessionStorage.setItem('lastOrderType', 'buyNow');
      
      navigate('/thanks');
    } catch (err) {
      console.error("Error placing order:", err);
      if (err.code === 'resource-exhausted' || (err.message && err.message.includes('too large'))) {
        alert('Error: The uploaded image is too large. Please try a smaller image or contact support.');
      } else {
        alert('Error placing order. Please try again. If the issue persists, contact support.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Get shipping cost text for display
  const getShippingText = () => {
    if (form.paymentMethod === 'EasyPaisa') {
      return 'PKR 150 - All over Pakistan';
    } else if (form.paymentMethod === 'Cash on Delivery') {
      const city = form.city.toLowerCase().trim();
      if (city === 'lahore' || city === 'sialkot') {
        return 'PKR 300 - Lahore & Sialkot';
      } else if (city === 'karachi') {
        return 'PKR 390 - Karachi';
      } else if (form.city) {
        return 'PKR 360 - Other Cities';
      } else {
        return 'PKR 300-390 - Varies by city';
      }
    }
    return 'PKR 150-390 - Based on payment method and city';
  };

  // Show loading if product is not loaded yet
  if (!product && cartItems.length === 0) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-[#fceadc] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <h2 className="text-xl font-bold mb-4">Loading Product...</h2>
            <p className="text-gray-600 mb-6">Please wait while we load your product details.</p>
            <button 
              onClick={() => navigate('/')}
              className="w-full bg-black text-white py-3 rounded-md font-medium hover:bg-gray-800 transition"
            >
              Go to Home
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-[#e0afaf] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumbs */}
          <nav className="flex mb-8" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2 text-sm sm:text-base">
              <li>
                <a href="/" className="text-gray-500 hover:text-gray-700">Home</a>
              </li>
              <li>
                <span className="text-gray-400">/</span>
              </li>
              <li>
                <span className="text-black font-medium">Buy Now Checkout</span>
              </li>
            </ol>
          </nav>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">Buy Now Checkout</h1>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left: Form */}
            <div className="bg-[#fefaf9] p-6 rounded-lg shadow-sm">
              <h2 className="text-lg sm:text-xl font-semibold mb-6 pb-2 border-b">Contact Information</h2>
              
              <div className="mb-6">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input 
                  id="email"
                  name="email" 
                  type="email"
                  value={form.email} 
                  onChange={handleChange} 
                  placeholder="Enter your email address"
                  className={`w-full px-4 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black text-sm sm:text-base`}
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              <h2 className="text-lg sm:text-xl font-semibold mb-6 pb-2 border-b">Shipping Address</h2>
              
              <div className="grid gap-6">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">Full Name*</label>
                  <input 
                    id="fullName"
                    name="fullName" 
                    value={form.fullName}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border ${errors.fullName ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black text-sm sm:text-base`}
                  />
                  {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>}
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number*</label>
                  <input 
                    id="phone"
                    name="phone" 
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="e.g., 03001234567"
                    className={`w-full px-4 py-2 border ${errors.phone ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black text-sm sm:text-base`}
                  />
                  {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
                </div>

                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">Street Address*</label>
                  <input 
                    id="address"
                    name="address" 
                    value={form.address}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border ${errors.address ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black text-sm sm:text-base`}
                  />
                  {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">City*</label>
                    <input 
                      id="city"
                      name="city" 
                      value={form.city}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 border ${errors.city ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black text-sm sm:text-base`}
                    />
                    {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city}</p>}
                  </div>

                  <div>
                    <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                    <input 
                      id="postalCode"
                      name="postalCode" 
                      value={form.postalCode}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 border ${errors.postalCode ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black text-sm sm:text-base`}
                    />
                    {errors.postalCode && <p className="mt-1 text-sm text-red-600">{errors.postalCode}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">Province/Region*</label>
                    <input 
                      id="region"
                      name="region" 
                      value={form.region}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 border ${errors.region ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black text-sm sm:text-base`}
                    />
                    {errors.region && <p className="mt-1 text-sm text-red-600">{errors.region}</p>}
                  </div>

                  <div>
                    <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">Country*</label>
                    <select 
                      id="country"
                      name="country" 
                      value={form.country}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 border ${errors.country ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black text-sm sm:text-base`}
                    >
                      <option value="">Select Country</option>
                      <option value="PK">Pakistan</option>
                    </select>
                    {errors.country && <p className="mt-1 text-sm text-red-600">{errors.country}</p>}
                  </div>
                </div>
              </div>

              <h2 className="text-lg sm:text-xl font-semibold mt-8 mb-6 pb-2 border-b">Shipping Method</h2>
              
              <div className="space-y-4">
                <label className="flex items-center p-4 border rounded-md hover:border-black cursor-pointer">
                  <input
                    type="radio"
                    name="shippingMethod"
                    value="Standard Delivery"
                    checked={form.shippingMethod === 'Standard Delivery'}
                    onChange={handleChange}
                    className="h-4 w-4 text-black focus:ring-black border-gray-300"
                  />
                  <div className="ml-3">
                    <p className="font-medium text-gray-900 text-sm sm:text-base">Standard Delivery</p>
                    <p className="text-xs sm:text-sm text-gray-500">
                      {getShippingText()} - Delivery in 4-5 business days
                    </p>
                  </div>
                </label>
              </div>

              <h2 className="text-lg sm:text-xl font-semibold mt-8 mb-6 pb-2 border-b">Payment Method</h2>
              
              <div className="space-y-4">
                {/* EasyPaisa Option */}
                <label className="flex items-center p-4 border rounded-md hover:border-black cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="EasyPaisa"
                    checked={form.paymentMethod === 'EasyPaisa'}
                    onChange={handleChange}
                    className="h-4 w-4 text-black focus:ring-black border-gray-300"
                  />
                  <div className="ml-3">
                    <span className="font-medium text-gray-900 text-sm sm:text-base">EasyPaisa</span>
                    <p className="text-xs text-gray-500">Pay online - Lower delivery charges (PKR 150)</p>
                    <p className="text-xs text-green-600">No sales tax applied</p>
                  </div>
                </label>

                {/* Cash on Delivery (COD) Option */}
                <label className="flex items-center p-4 border rounded-md hover:border-black cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="Cash on Delivery"
                    checked={form.paymentMethod === 'Cash on Delivery'}
                    onChange={handleChange}
                    className="h-4 w-4 text-black focus:ring-black border-gray-300"
                  />
                  <div className="ml-3">
                    <span className="font-medium text-gray-900 text-sm sm:text-base">Cash on Delivery</span>
                    <p className="text-xs text-gray-500">Pay advance delivery charges - Higher delivery charges</p>
                    <p className="text-xs text-orange-600">+4% sales tax applies</p>
                  </div>
                </label>
              </div>

              {form.paymentMethod === 'EasyPaisa' && (
                <div className="mt-6 p-4 border border-blue-300 bg-blue-50 rounded-md">
                  <h3 className="text-base sm:text-lg font-semibold mb-3">EasyPaisa/Sadapay Payment Details</h3>
                  <p className="text-gray-700 mb-4 text-sm sm:text-base">
                    Please send the total amount of PKR {total.toLocaleString()} to our EasyPaisa/Sadapay account:
                  </p>
                  <ul className="list-disc list-inside text-gray-800 mb-4 text-sm sm:text-base">
                    <li><strong>Account Name:</strong> Shaista </li>
                    <li><strong>EasyPaisa Number:</strong> 03303189634</li>
                  </ul>
                  <p className="text-gray-700 mb-4 text-sm sm:text-base">
                    After making the payment, please upload a screenshot of the transaction as proof of payment.
                  </p>
                  <div>
                    <label htmlFor="bankTransferProof" className="block text-sm font-medium text-gray-700 mb-1">
                      Upload EasyPaisa Transaction Screenshot*
                    </label>
                    <input
                      id="bankTransferProof"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className={`w-full px-4 py-2 border ${errors.bankTransferProof ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black text-sm sm:text-base`}
                    />
                    {errors.bankTransferProof && <p className="mt-1 text-sm text-red-600">{errors.bankTransferProof}</p>}
                    {bankTransferProofBase64 && (
                      <p className="mt-2 text-sm text-gray-600">Image selected and converted.</p>
                    )}
                    {convertingImage && (
                      <p className="mt-2 text-sm text-gray-600 flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Converting image...
                      </p>
                    )}
                  </div>
                </div>
              )}

              {form.paymentMethod === 'Cash on Delivery' && (
                <div className="mt-6 p-4 border border-orange-300 bg-orange-50 rounded-md">
                  <h3 className="text-base sm:text-lg font-semibold mb-3">Cash on Delivery - Advance Payment Required</h3>
                  <p className="text-gray-700 mb-4 text-sm sm:text-base">
                    For Cash on Delivery orders, you need to pay advance delivery charges of PKR {shippingCost.toLocaleString()} to our EasyPaisa account:
                  </p>
                  <ul className="list-disc list-inside text-gray-800 mb-4 text-sm sm:text-base">
                    <li><strong>Account Name:</strong> Shaista </li>
                    <li><strong>EasyPaisa Number:</strong> 03303189634</li>
                    <li><strong>Amount to Send:</strong> PKR {shippingCost.toLocaleString()} (Delivery Charges)</li>
                  </ul>
                  <p className="text-gray-700 mb-4 text-sm sm:text-base">
                    After paying the advance delivery charges, upload a screenshot of the transaction. You'll pay the remaining product amount plus 4% sales tax (PKR {(discountedSubtotal + salesTax).toLocaleString()}) when the order is delivered.
                  </p>
                  <div>
                    <label htmlFor="bankTransferProof" className="block text-sm font-medium text-gray-700 mb-1">
                      Upload Advance Payment Screenshot*
                    </label>
                    <input
                      id="bankTransferProof"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className={`w-full px-4 py-2 border ${errors.bankTransferProof ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-black focus:border-black text-sm sm:text-base`}
                    />
                    {errors.bankTransferProof && <p className="mt-1 text-sm text-red-600">{errors.bankTransferProof}</p>}
                    {bankTransferProofBase64 && (
                      <p className="mt-2 text-sm text-gray-600">Image selected and converted.</p>
                    )}
                    {convertingImage && (
                      <p className="mt-2 text-sm text-gray-600 flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Converting image...
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6">
                <label htmlFor="promoCode" className="block text-sm font-medium text-gray-700 mb-1">Promo Code</label>
                <div className="flex mb-2">
                  <input 
                    id="promoCode"
                    name="promoCode" 
                    value={form.promoCode}
                    onChange={handleChange}
                    disabled={promoApplied}
                    className={`flex-1 px-4 py-2 border border-gray-300 rounded-l-md focus:ring-black focus:border-black text-sm sm:text-base ${promoApplied ? 'bg-gray-100' : ''}`}
                    placeholder={promoApplied ? "IJS12 applied" : "Enter promo code"}
                  />
                  {promoApplied ? (
                    <button 
                      type="button"
                      onClick={removePromoCode}
                      className="px-4 py-2 bg-red-600 text-white rounded-r-md hover:bg-red-700 transition text-sm sm:text-base"
                    >
                      Remove
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={applyPromoCode}
                      className="px-4 py-2 bg-gray-800 text-white rounded-r-md hover:bg-black transition text-sm sm:text-base"
                    >
                      Apply
                    </button>
                  )}
                </div>
                
                {/* Promo code messages */}
                {promoSuccess && (
                  <div className="p-3 mb-4 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <p className="text-sm text-green-700 font-medium">{promoSuccess}</p>
                    </div>
                    <p className="text-xs text-green-600 mt-1">Valid for 5 days from activation</p>
                  </div>
                )}
                
                {promoError && (
                  <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                      <p className="text-sm text-red-700 font-medium">{promoError}</p>
                    </div>
                  </div>
                )}
                
                {/* Current promo info */}
                {!promoApplied && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-700 font-medium">Available Promo Code:</p>
                    <p className="text-sm text-blue-600">Use <span className="font-bold">IJS12</span> for 12% off</p>
                    <p className="text-xs text-blue-500 mt-1">Valid for 5 days</p>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Order Notes (Optional)</label>
                <textarea 
                  id="notes"
                  name="notes" 
                  value={form.notes}
                  onChange={handleChange}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-black focus:border-black text-sm sm:text-base"
                  placeholder="Special instructions, delivery notes, etc."
                />
              </div>
            </div>

            {/* Right: Order Summary */}
            <div className="bg-[#fefaf9] p-6 rounded-lg shadow-sm h-fit lg:sticky lg:top-8">
              <h2 className="text-lg sm:text-xl font-semibold mb-6 pb-2 border-b">Order Summary</h2>
              
              <div className="space-y-4 mb-6">
                {cartItems.map(item => (
                  <div key={item.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div className="flex gap-4 mb-2 sm:mb-0">
                      <img
                        src={item.image || item.coverImage}
                        alt={item.title}
                        className="w-16 h-20 sm:w-20 sm:h-25 object-cover object-top rounded"
                      />
                      <div>
                        <p className="font-medium text-gray-900 text-sm sm:text-base">{item.title}</p>
                        
                        {/* Display variation (color) if it exists */}
                        {item.variation && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs text-gray-500">Color:</span>
                            <span className="text-xs font-medium text-gray-700">{item.variation}</span>
                            {/* Optional: Show a small color swatch */}
                            <div 
                              className="w-3 h-3 rounded-full border border-gray-200"
                              style={{ 
                                backgroundColor: item.variation.toLowerCase(),
                                display: /^#[0-9A-F]{6}$/i.test(item.variation) ? 'block' : 'none'
                              }}
                              title={item.variation}
                            />
                          </div>
                        )}
                        
                        <p className="text-xs sm:text-sm text-gray-500">
                          {item.type && `${item.type} |`} {item.size} {item.lining ? '| Lining' : ''}
                        </p>
                          <p className="text-xs sm:text-sm text-gray-500">
                          {item.type && `${item.type} |`} {item.color} {item.lining ? '| Lining' : ''}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500">Qty: {item.quantity || 1}</p>
                      </div>
                    </div>
                    <p className="font-medium text-sm sm:text-base">
                      PKR {(item.price * (item.quantity || 1)).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-3 border-t border-gray-200 pt-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Subtotal</span>
                  <span className="text-sm">PKR {subtotal.toLocaleString()}</span>
                </div>
                
                {/* Show discount if applied */}
                {promoApplied && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Discount (12%)</span>
                    <span className="text-sm text-green-600">-PKR {discount.toLocaleString()}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Shipping</span>
                  <span className="text-sm">PKR {shippingCost.toLocaleString()}</span>
                </div>

                {/* Show sales tax only for COD */}
                {form.paymentMethod === 'Cash on Delivery' && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Sales Tax (4%)</span>
                    <span className="text-sm">PKR {salesTax.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Show COD payment breakdown */}
              {form.paymentMethod === 'Cash on Delivery' && (
                <div className="mt-4 p-3 bg-gray-50 rounded-md border">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Payment Breakdown:</h4>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>Advance (Delivery Charges):</span>
                      <span>PKR {shippingCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cash on Delivery:</span>
                      <span>PKR {(discountedSubtotal + salesTax).toLocaleString()}</span>
                      <span className="text-xs text-gray-500">(Products + 4% tax)</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between mt-4 pt-4 border-t border-gray-200">
                <span className="font-medium text-base sm:text-lg">Total</span>
                <span className="font-bold text-base sm:text-lg">PKR {total.toLocaleString()}</span>
              </div>

              <button
                onClick={placeOrder}
                disabled={loading || cartItems.length === 0 || convertingImage}
                className={`mt-6 w-full py-3 px-4 rounded-md font-medium text-white ${loading || cartItems.length === 0 || convertingImage ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'} transition text-base`}
              >
                {loading || convertingImage ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {convertingImage ? 'Converting Image...' : 'Processing Order...'}
                  </span>
                ) : cartItems.length === 0 ? (
                  'No Items to Order'
                ) : (
                  'Place Order Now'
                )}
              </button>

              <div className="mt-6 text-center text-xs sm:text-sm text-gray-500">
                <p>100% secure checkout</p>
                {form.paymentMethod === 'Cash on Delivery' && (
                  <p className="mt-1">Pay advance delivery charges now, product amount + 4% tax on delivery</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BuyNowCheckout;
