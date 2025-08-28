import React, { useEffect, useState } from 'react';
import Header from './Header';
import SidebarFilters from './SidebarFilters';
import ProductGrid from './ProductGrid';
import Newsletter from './Newsletter';
import Footer from './Footer';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { AiOutlineClose } from 'react-icons/ai';

function Products() {
  const [filters, setFilters] = useState({});
  const [allProducts, setAllProducts] = useState([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'products'));
        const productList = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAllProducts(productList);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };

    fetchProducts();
  }, []);

  return (
    <div
      className="relative flex size-full min-h-screen flex-col bg-[#e0afaf] group/design-root overflow-x-hidden"
      style={{ fontFamily: '"Noto Serif", "Noto Sans", sans-serif' }}
    >
      <div className="layout-container flex h-full grow flex-col">
        <Header />

        <div className="gap-1 px-4 md:px-6 flex flex-1 justify-center py-5">
          {/* Sidebar visible only on desktop */}
          <div className="hidden md:block">
            <SidebarFilters onFilterChange={setFilters} />
          </div>

          <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
            {/* Mobile Categories Header with Filters Button */}
            <div className="flex items-center justify-between md:hidden mb-4">
              <h2 className="text-lg font-semibold">Products</h2>
              <button
                className="bg-black text-white px-3 py-1 rounded-md text-sm"
                onClick={() => setMobileFiltersOpen(true)}
              >
                Filters
              </button>
            </div>

            {/* Mobile Fullscreen Filter Overlay */}
            {mobileFiltersOpen && (
              <div className="fixed inset-0 z-50 bg-white p-4 overflow-y-auto md:hidden">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Filters</h2>
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="text-gray-500"
                  >
                    <AiOutlineClose className="w-6 h-6" />
                  </button>
                </div>
              <SidebarFilters onFilterChange={setFilters} onClose={() => setMobileFiltersOpen(false)} />

              </div>
            )}

            <ProductGrid products={allProducts} filters={filters} />
      
          </div>
        </div>
      </div>
    </div>
  );
}

export default Products;
