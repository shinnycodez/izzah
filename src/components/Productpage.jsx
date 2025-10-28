import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';

import Header from './Header';
import ProductImageGrid from './ProductImageGrid';
import ProductInfo from './ProductInfo';
import QuantitySelector from './QuantitySelector';

const ProductPage = ({ onOpenCart }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const productData = { id: docSnap.id, ...docSnap.data() };
          setProduct(productData);
          
          // Set the first available color variation as selected by default
          if (productData.colorVariations && productData.colorVariations.length > 0) {
            const firstAvailableColor = productData.colorVariations.find(variation => {
              if (typeof variation === 'string') return true;
              return variation.inStock;
            });
            if (firstAvailableColor) {
              const colorName = typeof firstAvailableColor === 'string' 
                ? firstAvailableColor 
                : firstAvailableColor.name;
              setSelectedColor(colorName);
            }
          }
          
          // Set the first available size variation as selected by default
          if (productData.sizeVariations && productData.sizeVariations.length > 0) {
            const firstAvailableSize = productData.sizeVariations.find(variation => {
              if (typeof variation === 'string') return true;
              return variation.inStock;
            });
            if (firstAvailableSize) {
              const sizeName = typeof firstAvailableSize === 'string' 
                ? firstAvailableSize 
                : firstAvailableSize.name;
              setSelectedSize(sizeName);
            }
          }
        } else {
          console.error('No such product!');
          navigate('/');
        }
      } catch (err) {
        console.error('Error fetching product: ', err);
      }
    };

    fetchProduct();
  }, [id, navigate]);

  // Save cart to storage (consistent with cart component and checkout)
  const saveCartToStorage = (cartData) => {
    try {
      const cartJson = JSON.stringify(cartData);
      localStorage.setItem('cartItems', cartJson);
      sessionStorage.setItem('cartItems', cartJson);
    } catch (error) {
      console.error('Error saving cart to storage:', error);
    }
  };

  // Load cart from storage
  const loadCartFromStorage = () => {
    try {
      const storedCart = localStorage.getItem('cartItems') || sessionStorage.getItem('cartItems');
      return storedCart ? JSON.parse(storedCart) : [];
    } catch (error) {
      console.error('Error loading cart from storage:', error);
      return [];
    }
  };

  // Check if selected color is in stock
  const isSelectedColorInStock = () => {
    if (!selectedColor || !product.colorVariations) return true;
    
    const color = product.colorVariations.find(v => {
      const colorName = typeof v === 'string' ? v : v.name;
      return colorName === selectedColor;
    });
    
    if (!color) return false;
    return typeof color === 'string' ? true : color.inStock;
  };

  // Check if selected size is in stock
  const isSelectedSizeInStock = () => {
    if (!selectedSize || !product.sizeVariations) return true;
    
    const size = product.sizeVariations.find(v => {
      const sizeName = typeof v === 'string' ? v : v.name;
      return sizeName === selectedSize;
    });
    
    if (!size) return false;
    return typeof size === 'string' ? true : size.inStock;
  };

  // Check if product or selected variations are available
  const isAvailableForPurchase = () => {
    if (!product.available) return false;
    
    const colorAvailable = !product.colorVariations || product.colorVariations.length === 0 || isSelectedColorInStock();
    const sizeAvailable = !product.sizeVariations || product.sizeVariations.length === 0 || isSelectedSizeInStock();
    
    return colorAvailable && sizeAvailable;
  };

  const handleAddToCart = async () => {
    if (loading || !isAvailableForPurchase()) return;
    setLoading(true);

    // Create a unique identifier that includes both color and size variations
    const variationString = `${selectedColor || 'no-color'}_${selectedSize || 'no-size'}`;
    const itemId = `${product.id}_${variationString}_${Date.now()}`;

    const cartItem = {
      id: itemId,
      productId: product.id,
      title: product.title,
      price: product.price,
      image: product.coverImage,
      quantity,
      color: selectedColor, // Include selected color
      size: selectedSize,   // Include selected size
      createdAt: new Date().toISOString(),
    };

    try {
      // Load current cart
      let currentCart = loadCartFromStorage();

      // Check if item with same configuration already exists
      const existingIndex = currentCart.findIndex(item =>
        item.productId === cartItem.productId && 
        item.color === cartItem.color &&
        item.size === cartItem.size
      );

      if (existingIndex !== -1) {
        currentCart[existingIndex].quantity += quantity;
      } else {
        currentCart.push(cartItem);
      }

      saveCartToStorage(currentCart);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2500);
      if (onOpenCart) onOpenCart();

    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Error adding item to cart. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyNow = () => {
    if (loading || !isAvailableForPurchase()) return;

    const buyNowItem = {
      id: product.id,
      productId: product.id,
      title: product.title,
      price: product.price,
      image: product.coverImage,
      quantity,
      color: selectedColor, // Include selected color
      size: selectedSize,   // Include selected size
      createdAt: new Date().toISOString(),
    };

    try {
      sessionStorage.setItem('buyNowItem', JSON.stringify(buyNowItem));
      navigate('/buynowcheckout');
    } catch (error) {
      console.error('Error storing buy now item:', error);
      alert('Error processing buy now. Please try again.');
    }
  };

  if (!product) return (
    <div className="min-h-screen bg-[#e0afaf] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
        <p className="text-gray-600">Loading product...</p>
      </div>
    </div>
  );

  const allImages = product.images
    ? [product.coverImage, ...product.images]
    : [product.coverImage];

  const availableForPurchase = isAvailableForPurchase();

  return (
    <div className="relative flex min-h-screen flex-col bg-[#e0afaf] overflow-x-hidden">
      {showSuccess && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-[100]">
          <div className="flex items-center gap-3 bg-green-100 border border-green-300 text-green-800 px-5 py-2 rounded-xl shadow-lg animate-fade-in-out transition-all">
            <svg
              className="w-5 h-5 text-green-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>Added to cart successfully!</span>
          </div>
        </div>
      )}

      <Header />
      <div className="layout-container flex h-full grow flex-col bg-[#e0afaf]">
        <div className="gap-1 px-6 flex flex-1 justify-center py-5 flex-col md:flex-row">
          <div className="flex flex-col max-w-[920px] flex-1">
            <div className="flex w-full grow p-4">
              <ProductImageGrid images={allImages} />
            </div>
          </div>

          <div className="flex flex-col w-full md:w-[360px]">
            <ProductInfo
              title={product.title}
              price={`PKR ${product.price}`}
              description={product.description}
              packageInfo={product.packageInfo || '3 PIECE'}
            />
            
            {/* Stock Status Display */}
            {product.available ? (
              (product.colorVariations && product.colorVariations.length > 0) || 
              (product.sizeVariations && product.sizeVariations.length > 0) ? (
                <div className="px-4">
                  {!isAvailableForPurchase() ? (
                    <p className="text-red-600 font-medium">
                      {!isSelectedColorInStock() && !isSelectedSizeInStock() 
                        ? 'Selected color and size are out of stock'
                        : !isSelectedColorInStock() 
                        ? 'Selected color is out of stock'
                        : 'Selected size is out of stock'
                      }
                    </p>
                  ) : (
                    <p className="text-green-600 font-medium">In Stock</p>
                  )}
                </div>
              ) : (
                <p className="text-green-600 font-medium px-4">In Stock</p>
              )
            ) : (
              <p className="text-red-600 font-medium px-4">Will be available soon</p>
            )}

            {/* Color Variations Selector */}
            {product.colorVariations && product.colorVariations.length > 0 && (
              <div className="px-4 py-3">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Color:</h3>
                <div className="flex flex-wrap gap-2">
                  {product.colorVariations.map((variation, index) => {
                    const variationName = typeof variation === 'string' ? variation : variation.name;
                    const isInStock = typeof variation === 'string' ? true : variation.inStock;
                    
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => isInStock && setSelectedColor(variationName)}
                        disabled={!isInStock}
                        className={`px-3 py-1 rounded-full text-sm border transition-all duration-200 ${
                          selectedColor === variationName
                            ? isInStock 
                              ? 'bg-black text-white border-black'
                              : 'bg-gray-300 text-gray-500 border-gray-300'
                            : isInStock
                              ? 'bg-white text-gray-800 border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                              : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'
                        }`}
                      >
                        {variationName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Variations Selector */}
            {product.sizeVariations && product.sizeVariations.length > 0 && (
              <div className="px-4 py-3">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Size:</h3>
                <div className="flex flex-wrap gap-2">
                  {product.sizeVariations.map((variation, index) => {
                    const variationName = typeof variation === 'string' ? variation : variation.name;
                    const isInStock = typeof variation === 'string' ? true : variation.inStock;
                    
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => isInStock && setSelectedSize(variationName)}
                        disabled={!isInStock}
                        className={`px-3 py-1 rounded-full text-sm border transition-all duration-200 ${
                          selectedSize === variationName
                            ? isInStock 
                              ? 'bg-black text-white border-black'
                              : 'bg-gray-300 text-gray-500 border-gray-300'
                            : isInStock
                              ? 'bg-white text-gray-800 border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                              : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'
                        }`}
                      >
                        {variationName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <QuantitySelector quantity={quantity} setQuantity={setQuantity} />

            <div className="flex flex-col gap-3 p-4">
              <button
                onClick={handleAddToCart}
                disabled={!availableForPurchase || loading}
                className={`w-full border-2 py-3 px-4 rounded-xl font-medium text-base transition-colors ${
                  availableForPurchase && !loading
                    ? 'border-black text-black hover:bg-gray-100'
                    : 'border-gray-400 text-gray-400 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Adding...
                  </span>
                ) : !availableForPurchase ? (
                  'Selected Option Out of Stock'
                ) : (
                  'Add to Cart'
                )}
              </button>

              <button
                onClick={handleBuyNow}
                disabled={!availableForPurchase || loading}
                className={`w-full py-3 px-4 rounded-xl font-medium text-base transition-colors ${
                  availableForPurchase && !loading
                    ? 'bg-[#FCBACB] text-white hover:bg-[#FCBACB]'
                    : 'bg-gray-400 text-white cursor-not-allowed'
                }`}
              >
                {!availableForPurchase ? (
                  'Selected Option Out of Stock'
                ) : (
                  'Buy Now'
                )}
              </button>
            </div>

            {/* Additional Product Details */}
            {product.details && (
              <div className="px-4 py-2 border-t mt-4">
                <h3 className="font-medium text-gray-900 mb-2">Product Details</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  {Object.entries(product.details).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="capitalize">{key}:</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;