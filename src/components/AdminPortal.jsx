import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import Header from "./Header";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function AdminPortal() {
  const [salesByMonth, setSalesByMonth] = useState([]);
  const [productSales, setProductSales] = useState([]);
  const [totalSales, setTotalSales] = useState({ day: 0, month: 0, year: 0 });

const [formData, setFormData] = useState({
  title: "",
  price: "",
  category: "",
  description: "",
  coverImage: "",
  image1: "",
  image2: "",
  isTopProduct: false,
  available: true,
  variationInput: "",      // for temporary input field
  variations: [],          // array to hold variations with stock status
});

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [contacts, setContacts] = useState([]); // New state for contacts
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [showContacts, setShowContacts] = useState(false); // New state for contacts visibility
  const [expandedOrders, setExpandedOrders] = useState({});
  const [expandedContacts, setExpandedContacts] = useState({}); // New state for expanded contacts
  const [viewingImage, setViewingImage] = useState(null); // State for image viewer

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "products"), (snapshot) => {
      setProducts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // New useEffect for contacts
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "contacts"), (snapshot) => {
      const contactsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      // Sort by timestamp (newest first)
      contactsData.sort((a, b) => {
        const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(0);
        const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(0);
        return bTime - aTime;
      });
      setContacts(contactsData);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "orders"), (snapshot) => {
      const ordersData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);

      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      let dayTotal = 0;
      let monthTotal = 0;
      let yearTotal = 0;
      const monthMap = {};
      const productMap = {};

      ordersData.forEach(order => {
        const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : (order.createdAt instanceof Date ? order.createdAt : new Date());
        const total = order.total || 0;

        if (orderDate >= startOfDay) dayTotal += total;
        if (orderDate >= startOfMonth) monthTotal += total;
        if (orderDate >= startOfYear) yearTotal += total;

        const month = orderDate.toLocaleString('default', { month: 'short' });
        monthMap[month] = (monthMap[month] || 0) + total;

        (order.items || []).forEach(item => {
          const itemId = item.productId || `${item.title}-${item.type}-${item.size}`;
          if (!productMap[itemId]) {
            productMap[itemId] = {
              title: item.title,
              totalQty: 0,
              totalSales: 0
            };
          }
          productMap[itemId].totalQty += item.quantity;
          productMap[itemId].totalSales += item.price * item.quantity;
        });
      });

      setTotalSales({
        day: dayTotal,
        month: monthTotal,
        year: yearTotal
      });

      setSalesByMonth(
        Object.keys(monthMap).map(month => ({
          month,
          total: monthMap[month]
        }))
      );

      const sortedProductSales = Object.values(productMap).sort((a, b) => b.totalSales - a.totalSales);
      setProductSales(sortedProductSales);
    });

    return () => unsubscribe();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const markAsDelivered = async (orderId) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: "delivered",
        bankTransferProofBase64: null,
      });
      console.log(`Order ${orderId} marked as delivered and bank transfer proof removed.`);
    } catch (err) {
      console.error("Failed to mark as delivered:", err);
    }
  };

  const deleteOrder = async (orderId) => {
    if (confirm("Are you sure you want to delete this order? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, "orders", orderId));
        console.log(`Order ${orderId} deleted successfully.`);
      } catch (err) {
        console.error("Failed to delete order:", err);
      }
    }
  };

  // New function to delete contact
  const deleteContact = async (contactId) => {
    if (confirm("Are you sure you want to delete this contact message? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, "contacts", contactId));
        console.log(`Contact ${contactId} deleted successfully.`);
      } catch (err) {
        console.error("Failed to delete contact:", err);
      }
    }
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setSuccessMsg("");

  try {
    if (editId) {
      await updateDoc(doc(db, "products", editId), {
        title: formData.title,
        price: parseFloat(formData.price),
        category: formData.category,
        description: formData.description,
        coverImage: formData.coverImage,
        images: [formData.image1, formData.image2],
        isTopProduct: formData.isTopProduct,
        available: formData.available,
        variations: formData.variations, // Now includes stock status for each variation
      });
      setSuccessMsg("✅ Product updated successfully!");
      setEditId(null);
    } else {
      await addDoc(collection(db, "products"), {
        title: formData.title,
        price: parseFloat(formData.price),
        category: formData.category,
        description: formData.description,
        coverImage: formData.coverImage,
        images: [formData.image1, formData.image2],
        isTopProduct: formData.isTopProduct,
        available: formData.available,
        variations: formData.variations, // Include variations with stock status
        createdAt: serverTimestamp(),
      });
      setSuccessMsg("✅ Product added successfully!");
    }

    setFormData({
      title: "",
      price: "",
      category: "",
      description: "",
      coverImage: "",
      image1: "",
      image2: "",
      isTopProduct: false,
      available: true,
      variations: [], // Reset variations
      variationInput: "" // Reset input field
    });
  } catch (err) {
    console.error("Error:", err);
    setSuccessMsg("❌ Failed to submit.");
  }

  setLoading(false);
};

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this product?")) {
      try {
        await deleteDoc(doc(db, "products", id));
      } catch (err) {
        console.error("Delete error:", err);
      }
    }
  };

const handleEdit = (product) => {
  // Convert old variation format to new format if needed
  const processedVariations = product.variations ? product.variations.map(variation => {
    if (typeof variation === 'string') {
      // Old format - convert to new format
      return { name: variation, inStock: true };
    } else {
      // New format - keep as is
      return variation;
    }
  }) : [];

  setFormData({
    title: product.title,
    price: product.price,
    category: product.category,
    description: product.description,
    coverImage: product.coverImage,
    image1: product.images?.[0] || "",
    image2: product.images?.[1] || "",
    isTopProduct: product.isTopProduct || false,
    available: product.available !== false,
    variations: processedVariations,
    variationInput: ""
  });
  setEditId(product.id);
  setShowForm(true);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

  // Function to toggle stock status for individual variations
  const toggleVariationStock = async (productId, variationIndex) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const updatedVariations = [...(product.variations || [])];
    
    // Handle both old and new format
    if (typeof updatedVariations[variationIndex] === 'string') {
      // Convert old format to new format
      updatedVariations[variationIndex] = {
        name: updatedVariations[variationIndex],
        inStock: false // Toggle to false since we're clicking to change stock
      };
    } else {
      // New format - toggle stock status
      updatedVariations[variationIndex] = {
        ...updatedVariations[variationIndex],
        inStock: !updatedVariations[variationIndex].inStock
      };
    }

    try {
      await updateDoc(doc(db, "products", productId), {
        variations: updatedVariations
      });
    } catch (err) {
      console.error("Failed to update variation stock:", err);
    }
  };

  const toggleExpand = (orderId) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // New function to toggle contact expansion
  const toggleContactExpand = (contactId) => {
    setExpandedContacts((prev) => ({
      ...prev,
      [contactId]: !prev[contactId],
    }));
  };

  // Image Viewer Modal Component
  const ImageViewer = ({ imageUrl, onClose }) => {
    if (!imageUrl) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="relative bg-white rounded-lg p-2 max-w-full max-h-[90vh] overflow-hidden flex flex-col">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-gray-800 hover:text-gray-600 text-3xl font-bold p-1 rounded-full bg-gray-200"
            aria-label="Close"
          >
          &times;
          </button>
          <img
            src={imageUrl}
            alt="Bank Transfer Proof"
            className="max-w-full max-h-[80vh] object-contain rounded-md"
          />
        </div>
      </div>
    );
  };

const OrderDetails = ({ order }) => (
  <div className="mt-4 space-y-3 text-sm text-gray-700 p-2 border-t border-gray-200 pt-3">
    <p><strong>Status:</strong> <span className={`font-semibold ${order.status === 'delivered' ? 'text-green-600' : 'text-orange-600'}`}>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span></p>
    <p><strong>Payment Method:</strong> {order.payment}</p>
{(order.payment === 'EasyPaisa' || order.payment === 'Cash on Delivery') && order.bankTransferProofBase64 && (
      <div className="mt-2">
    <strong>{order.payment === 'EasyPaisa' ? 'EasyPaisa Transaction Proof:' : 'Advance Payment Proof:'}:</strong>
        <div
          className="mt-1 border border-gray-300 p-2 rounded max-w-full sm:max-w-xs overflow-hidden cursor-pointer hover:border-blue-500 transition-colors duration-200"
          onClick={() => setViewingImage(order.bankTransferProofBase64)}
        >
          <img
            src={order.bankTransferProofBase64}
            alt="Bank Transfer Proof"
            className="w-full h-auto object-contain max-h-64 sm:max-h-80"
          />
          <p className="text-center text-xs text-gray-500 mt-1">Click to enlarge</p>
        </div>
      </div>
    )}
    <p><strong>Shipping Method:</strong> {order.shipping}</p>
    <p><strong>Promo Code:</strong> {order.promoCode || "None"}</p>
    <p><strong>Notes:</strong> {order.notes || "None"}</p>
    <p>
      <strong>Order Time:</strong>{" "}
      {order.createdAt?.toDate?.().toLocaleString() || "Unknown"}
    </p>

    <div>
      <strong>Shipping Address:</strong>
      <div className="ml-0 sm:ml-4 text-xs sm:text-sm">
        <p>{order.shippingAddress?.fullName}</p>
        <p>{order.shippingAddress?.address}</p>
        <p>{order.shippingAddress?.city}, {order.shippingAddress?.region}</p>
        <p>{order.shippingAddress?.country}, {order.shippingAddress?.postalCode}</p>
        <p>Phone: {order.shippingAddress?.phone}</p>
      </div>
    </div>

    <div>
      <strong>Items:</strong>
<ul className="list-disc ml-4 sm:ml-5 mt-1 text-xs sm:text-sm">
  {(order.items || []).map((item, i) => (
    <li key={i} className="font-semibold">
      {item.title} – 
      {item.variation && ` Color: ${item.variation} –`}
      {item.type && ` Type: ${item.type} –`}
      {item.size && ` Size: ${item.size} –`}
      Qty: {item.quantity} – 
      Price: PKR {item.price?.toLocaleString()}
    </li>
  ))}
</ul>

    </div>
  </div>
);

  // New ContactDetails component
  const ContactDetails = ({ contact }) => (
    <div className="mt-4 space-y-3 text-sm text-gray-700 p-4 border-t border-gray-200 pt-3 bg-pink-50 rounded-lg">
      <div>
        <strong>📧 Email:</strong>
        <p className="text-blue-600 hover:text-blue-800">
          <a href={`mailto:${contact.email}`}>{contact.email}</a>
        </p>
      </div>
      <div>
        <strong>💌 Message:</strong>
        <p className="mt-1 p-3 bg-white border border-pink-200 rounded-md whitespace-pre-wrap">
          {contact.message}
        </p>
      </div>
      <p>
        <strong>🕒 Received:</strong>{" "}
        {contact.timestamp?.toDate?.().toLocaleString() || "Unknown"}
      </p>
    </div>
  );

  return (
    <>
      <Header />
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 sm:space-y-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full bg-black text-white px-4 py-3 text-left rounded-md hover:bg-gray-800 transition-colors duration-200 flex items-center justify-between text-base sm:text-lg font-medium"
          >
            <span>{showForm ? "➖ Hide Add Product Form" : "➕ Add New Product"}</span>
            <svg className={`w-5 h-5 transition-transform duration-200 ${showForm ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>

          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="bg-gray-50 p-4 sm:p-6 mt-4 rounded-lg shadow-inner space-y-4"
            >
              {successMsg && (
                <p className={`text-center text-sm sm:text-base p-2 rounded ${successMsg.startsWith('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {successMsg}
                </p>
              )}
              <input name="title" placeholder="Product Title" className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base" value={formData.title} onChange={handleChange} required />
              <input name="price" placeholder="Price (PKR)" type="number" step="0.01" className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base" value={formData.price} onChange={handleChange} required />
              <input name="category" placeholder="Category (e.g., 'Formal', 'Casual')" className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base" value={formData.category} onChange={handleChange} required />
              <textarea name="description" placeholder="Product Description" rows="4" className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base" value={formData.description} onChange={handleChange} required />
              <input name="coverImage" placeholder="Cover Image URL (e.g., Firebase Storage URL)" className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base" value={formData.coverImage} onChange={handleChange} required />
              <input name="image1" placeholder="Image 1 URL (Optional)" className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base" value={formData.image1} onChange={handleChange} />
              <input name="image2" placeholder="Image 2 URL (Optional)" className="w-full border border-gray-300 p-2 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base" value={formData.image2} onChange={handleChange} />

{/* Color Variations Input - Updated */}
<div>
  <label className="block text-sm sm:text-base font-medium text-gray-700 mb-1">Product Variations (e.g., Red, Yellow)</label>
  <div className="flex gap-2 mb-2">
    <input
      type="text"
      name="variationInput"
      value={formData.variationInput}
      onChange={handleChange}
      placeholder="Add a color (e.g., Red)"
      className="flex-1 border border-gray-300 p-2 rounded-md text-sm sm:text-base"
    />
    <button
      type="button"
      onClick={() => {
        if (formData.variationInput.trim()) {
          setFormData((prev) => ({
            ...prev,
            variations: [...prev.variations, { name: prev.variationInput.trim(), inStock: true }],
            variationInput: "",
          }));
        }
      }}
      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm sm:text-base"
    >
      Add
    </button>
  </div>

  {/* Show list of variations with stock toggle - Updated */}
  {formData.variations && formData.variations.length > 0 && (
    <div className="flex flex-wrap gap-2">
      {formData.variations.map((variation, i) => {
        const variationName = typeof variation === 'string' ? variation : variation.name;
        const isInStock = typeof variation === 'string' ? true : variation.inStock;
        
        return (
          <div key={i} className={`px-3 py-1 rounded-full text-sm flex items-center gap-2 ${isInStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            <span>{variationName}</span>
            <button
              type="button"
              onClick={() => {
                setFormData((prev) => ({
                  ...prev,
                  variations: prev.variations.map((v, index) => {
                    if (index === i) {
                      return typeof v === 'string' 
                        ? { name: v, inStock: false }
                        : { ...v, inStock: !v.inStock };
                    }
                    return v;
                  })
                }));
              }}
              className={`text-xs px-2 py-1 rounded-full ${isInStock ? 'bg-green-200 hover:bg-green-300 text-green-800' : 'bg-red-200 hover:bg-red-300 text-red-800'}`}
            >
              {isInStock ? '✓ In Stock' : '✗ Out of Stock'}
            </button>
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  variations: prev.variations.filter((_, index) => index !== i),
                }))
              }
              className="text-red-500 hover:text-red-700 font-bold"
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  )}
</div>

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mt-4">
                <label className="flex items-center gap-2 text-sm sm:text-base text-gray-700 cursor-pointer">
                  <input type="checkbox" name="isTopProduct" checked={formData.isTopProduct} onChange={handleChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                  Mark as Top Product
                </label>
                <label className="flex items-center gap-2 text-sm sm:text-base text-gray-700 cursor-pointer">
                  <input type="checkbox" name="available" checked={formData.available} onChange={handleChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                  Product Available
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-md transition-colors duration-200 text-base sm:text-lg font-medium disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {loading ? (editId ? "Updating..." : "Adding...") : (editId ? "Update Product" : "Add Product")}
              </button>
            </form>
          )}
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
          <button
            onClick={() => setShowInventory(!showInventory)}
            className="w-full bg-black text-white px-4 py-3 text-left rounded-md hover:bg-gray-800 transition-colors duration-200 flex items-center justify-between text-base sm:text-lg font-medium"
          >
            <span>{showInventory ? "➖ Hide Inventory" : "📦 View Product Inventory"}</span>
            <svg className={`w-5 h-5 transition-transform duration-200 ${showInventory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>

          {showInventory && (
            <div className="mt-4 bg-gray-50 p-4 sm:p-6 rounded-lg shadow-inner grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {products.length === 0 ? (
                <p className="col-span-full text-center text-gray-500 text-sm sm:text-base py-4">No products found. Add a product to get started!</p>
              ) : (
                products.map((product) => (
                  <div key={product.id} className={`flex flex-col sm:flex-row gap-4 border border-gray-200 p-4 rounded-md shadow-sm ${product.available === false ? 'bg-gray-100 opacity-80' : 'bg-white'}`}>
                    <img src={product.coverImage} className="w-24 h-24 object-contain rounded-md flex-shrink-0 mx-auto sm:mx-0" alt={product.title} />
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="font-semibold text-base sm:text-lg text-gray-900 mb-1">{product.title}</h3>
                      <p className="text-sm text-gray-700">Price: PKR {product.price?.toLocaleString()}</p>
                      <p className="text-sm text-gray-700">Category: {product.category}</p>
                      <p className="text-sm text-gray-700">Top Product: {product.isTopProduct ? "Yes" : "No"}</p>
                      
                      {/* Updated Variations Display with Individual Stock Management */}
                      {product.variations && product.variations.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-700 mb-1">Variations:</p>
                          <div className="flex flex-wrap gap-1">
                            {product.variations.map((variation, index) => {
                              const variationName = typeof variation === 'string' ? variation : variation.name;
                              const isInStock = typeof variation === 'string' ? true : variation.inStock;
                              
                              return (
                                <button
                                  key={index}
                                  onClick={() => toggleVariationStock(product.id, index)}
                                  className={`text-xs px-2 py-1 rounded-full transition-colors duration-200 ${
                                    isInStock 
                                      ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                                      : 'bg-red-100 text-red-800 hover:bg-red-200'
                                  }`}
                                  title={`Click to mark as ${isInStock ? 'out of stock' : 'in stock'}`}
                                >
                                  {variationName} {isInStock ? '✓' : '✗'}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      <p className="text-sm mt-1">Status: <span className={`font-medium ${product.available === false ? 'text-red-600' : 'text-green-600'}`}>
                        {product.available === false ? 'Out of Stock' : 'Available'}
                      </span></p>
                      <div className="mt-3 flex justify-center sm:justify-start gap-2">
                        <button onClick={() => handleEdit(product)} className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 text-xs sm:text-sm rounded-md transition-colors duration-200">Edit</button>
                        <button onClick={() => handleDelete(product.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-xs sm:text-sm rounded-md transition-colors duration-200">Delete</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
          <button
            onClick={() => setShowOrders(!showOrders)}
            className="w-full bg-black text-white px-4 py-3 text-left rounded-md hover:bg-gray-800 transition-colors duration-200 flex items-center justify-between text-base sm:text-lg font-medium"
          >
            <span>{showOrders ? "➖ Hide Orders" : "🧾 View Customer Orders"}</span>
            <svg className={`w-5 h-5 transition-transform duration-200 ${showOrders ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>

          {showOrders && (
            <div className="mt-4 bg-gray-50 p-4 sm:p-6 rounded-lg shadow-inner space-y-6">
              {orders.length === 0 ? (
                <p className="text-center text-gray-500 text-sm sm:text-base py-4">No orders received yet.</p>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold mb-3 text-gray-800 border-b pb-2">🆕 Pending Orders ({orders.filter(o => o.status !== "delivered").length})</h3>
                    {orders.filter(o => o.status !== "delivered").length === 0 ? (
                      <p className="text-gray-500 text-sm sm:text-base">No pending orders at the moment. Great job!</p>
                    ) : (
                      orders
                        .filter((order) => order.status !== "delivered")
                        .map((order) => (
                          <div key={order.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm mb-4 last:mb-0">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                              <div className="mb-2 sm:mb-0">
                        <p className="font-semibold text-base sm:text-lg text-gray-900">
  Order by: {order.shippingAddress?.fullName || order.customerEmail}
</p>
                                <p className="text-sm text-gray-600">Total: PKR {order.total?.toLocaleString()}</p>
                                <p className="text-sm text-gray-600">Payment: {order.payment}</p>
                              </div>
                              <div className="flex items-center gap-3 mt-2 sm:mt-0">
                                <button
                                  className="text-sm text-blue-600 hover:text-blue-800 underline transition-colors duration-200"
                                  onClick={() => toggleExpand(order.id)}
                                >
                                  {expandedOrders[order.id] ? "Hide Details" : "View Details"}
                                </button>
                                <button
                                  onClick={() => markAsDelivered(order.id)}
                                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-sm rounded-md transition-colors duration-200"
                                >
                                  ✅ Mark as Delivered
                                </button>
                                <button
                                  onClick={() => deleteOrder(order.id)}
                                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-sm rounded-md transition-colors duration-200"
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </div>

                            {expandedOrders[order.id] && (
                              <OrderDetails order={order} />
                            )}
                          </div>
                        ))
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg sm:text-xl font-bold mt-6 mb-3 text-gray-800 border-b pb-2">📦 Delivered Orders ({orders.filter(o => o.status === "delivered").length})</h3>
                    {orders.filter(o => o.status === "delivered").length === 0 ? (
                      <p className="text-gray-500 text-sm sm:text-base">No delivered orders yet.</p>
                    ) : (
                      orders
                        .filter((order) => order.status === "delivered")
                        .map((order) => (
                          <div key={order.id} className="border border-green-300 rounded-lg p-4 bg-green-50 shadow-sm mb-4 last:mb-0">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                              <div className="mb-2 sm:mb-0">
                           <p className="font-semibold text-base sm:text-lg text-gray-900">
  Order by: {order.shippingAddress?.fullName || order.user}
</p>

                                <p className="text-sm text-gray-600">Total: PKR {order.total?.toLocaleString()}</p>
                                <p className="text-sm text-gray-600">Payment: {order.payment}</p>
                              </div>
                              <div className="flex items-center gap-3 mt-2 sm:mt-0">
                                <button
                                  className="text-sm text-blue-600 hover:text-blue-800 underline transition-colors duration-200"
                                  onClick={() => toggleExpand(order.id)}
                                >
                                  {expandedOrders[order.id] ? "Hide Details" : "View Details"}
                                </button>
                                <button
                                  onClick={() => deleteOrder(order.id)}
                                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-sm rounded-md transition-colors duration-200"
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </div>

                            {expandedOrders[order.id] && (
                              <OrderDetails order={order} />
                            )}
                          </div>
                        ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* New Contact Messages Section */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
          <button
            onClick={() => setShowContacts(!showContacts)}
            className="w-full bg-black text-white px-4 py-3 text-left rounded-md hover:bg-gray-800 transition-colors duration-200 flex items-center justify-between text-base sm:text-lg font-medium"
          >
            <span>{showContacts ? "➖ Hide Contact Messages" : "💌 View Contact Messages"} ({contacts.length})</span>
            <svg className={`w-5 h-5 transition-transform duration-200 ${showContacts ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>

          {showContacts && (
            <div className="mt-4 bg-gray-50 p-4 sm:p-6 rounded-lg shadow-inner space-y-4">
              {contacts.length === 0 ? (
                <p className="text-center text-gray-500 text-sm sm:text-base py-4">No contact messages received yet.</p>
              ) : (
                contacts.map((contact) => (
                  <div key={contact.id} className="border border-pink-200 rounded-lg p-4 bg-pink-50 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                      <div className="mb-2 sm:mb-0">
                        <p className="font-semibold text-base sm:text-lg text-gray-900 flex items-center gap-2">
                          🌸 {contact.name}
                        </p>
                        <p className="text-sm text-gray-600">📧 {contact.email}</p>
                        <p className="text-sm text-gray-600">
                          🕒 {contact.timestamp?.toDate?.().toLocaleString() || "Unknown"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 mt-2 sm:mt-0">
                        <button
                          className="text-sm text-blue-600 hover:text-blue-800 underline transition-colors duration-200"
                          onClick={() => toggleContactExpand(contact.id)}
                        >
                          {expandedContacts[contact.id] ? "Hide Message" : "View Message"}
                        </button>
                        <a
                          href={`mailto:${contact.email}?subject=Re: Your message&body=Hi ${contact.name},%0D%0A%0D%0AThank you for your message...`}
                          className="bg-pink-500 hover:bg-pink-600 text-white px-3 py-1 text-sm rounded-md transition-colors duration-200"
                        >
                          📧 Reply
                        </a>
                        <button
                          onClick={() => deleteContact(contact.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-sm rounded-md transition-colors duration-200"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>

                    {expandedContacts[contact.id] && (
                      <ContactDetails contact={contact} />
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 text-center bg-white p-4 sm:p-6 rounded-lg shadow-md">
          <div className="p-3 sm:p-4 bg-gray-50 rounded-md">
            <p className="text-base sm:text-lg font-semibold text-gray-700">📅 Daily Sales</p>
            <p className="text-xl sm:text-2xl text-green-600 font-bold mt-1">PKR {totalSales.day.toLocaleString()}</p>
          </div>
          <div className="p-3 sm:p-4 bg-gray-50 rounded-md">
            <p className="text-base sm:text-lg font-semibold text-gray-700">🗓️ Monthly Sales</p>
            <p className="text-xl sm:text-2xl text-blue-600 font-bold mt-1">PKR {totalSales.month.toLocaleString()}</p>
          </div>
          <div className="p-3 sm:p-4 bg-gray-50 rounded-md">
            <p className="text-base sm:text-lg font-semibold text-gray-700">📆 Yearly Sales</p>
            <p className="text-xl sm:text-2xl text-purple-600 font-bold mt-1">PKR {totalSales.year.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 mt-4 sm:mt-6 rounded-lg shadow-md">
          <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-800">📊 Monthly Sales Overview</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesByMonth}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => `PKR ${value.toLocaleString()}`} />
              <Tooltip formatter={(value) => [`PKR ${value.toLocaleString()}`, 'Sales']} />
              <Bar dataKey="total" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-4 sm:p-6 mt-4 sm:mt-6 rounded-lg shadow-md">
          <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-800">📈 Top Selling Products (By Sales)</h2>
          <ResponsiveContainer width="100%" height={300}>
            {productSales.length > 0 ? (
              <BarChart data={productSales.slice(0, 10)}>
                <XAxis dataKey="title" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={60} />
                <YAxis tickFormatter={(value) => `PKR ${value.toLocaleString()}`} />
                <Tooltip formatter={(value) => [`PKR ${value.toLocaleString()}`, 'Sales']} />
                <Bar dataKey="totalSales" fill="#10b981" />
              </BarChart>
            ) : (
              <p className="text-center text-gray-500 py-10">No product sales data available yet.</p>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Image Viewer Modal */}
      <ImageViewer imageUrl={viewingImage} onClose={() => setViewingImage(null)} />
    </>
  );
}

export default AdminPortal;