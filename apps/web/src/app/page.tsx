'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

// --- Types & Interfaces ---
interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  children?: Category[];
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number | null;
  stock: number;
  images: string[];
  attributes?: any;
  isApproved: boolean;
  categoryId: string;
  store?: {
    id: string;
    name: string;
    logoUrl?: string;
  };
  reviews?: Array<{
    id: string;
    rating: number;
    comment: string;
    createdAt: string;
    customer: {
      firstName: string;
      lastName: string;
    };
  }>;
  averageRating?: number;
  totalReviews?: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

// --- Fallback Mock Data ---
const MOCK_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Electronics', slug: 'electronics' },
  { id: 'cat-2', name: 'Luxury Apparel', slug: 'apparel' },
  { id: 'cat-3', name: 'Home Accessories', slug: 'home' },
];

const MOCK_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Veridia Eco-Phone 12',
    slug: 'veridia-eco-phone-12',
    description: 'High-end smartphone built sustainably with recycled emerald aluminum alloy and gold-leaf microprocessors.',
    price: 899.99,
    compareAtPrice: 999.99,
    stock: 8,
    images: ['/phone.jpg'],
    isApproved: true,
    categoryId: 'cat-1',
    store: { id: 'store-1', name: 'Veridia Official Outlet' },
    averageRating: 4.9,
    totalReviews: 12,
    reviews: [
      { id: 'r1', rating: 5, comment: 'Incredible design and gorgeous battery life!', createdAt: '2026-07-28', customer: { firstName: 'Diana', lastName: 'Prince' } }
    ]
  },
  {
    id: 'prod-2',
    name: 'Luxury Emerald Chronograph Watch',
    slug: 'luxury-emerald-chronograph-watch',
    description: 'Bespoke automatic timepiece featuring a stunning deep emerald dial and 18k gold bezels.',
    price: 1450.00,
    compareAtPrice: 1650.00,
    stock: 3,
    images: ['/watch.jpg'],
    isApproved: true,
    categoryId: 'cat-2',
    store: { id: 'store-2', name: 'Aureum Watch Co.' },
    averageRating: 5.0,
    totalReviews: 8,
    reviews: [
      { id: 'r2', rating: 5, comment: 'Absolutely breathtaking gold accents. Pure luxury.', createdAt: '2026-08-01', customer: { firstName: 'Bruce', lastName: 'Wayne' } }
    ]
  },
  {
    id: 'prod-3',
    name: 'Gold Trim Organic Cotton Hoodie',
    slug: 'gold-trim-organic-cotton-hoodie',
    description: 'Heavyweight organic cotton knitwear finished with luxurious gold metallic embroidery.',
    price: 120.00,
    stock: 15,
    images: ['/hoodie.jpg'],
    isApproved: true,
    categoryId: 'cat-2',
    store: { id: 'store-1', name: 'Veridia Official Outlet' },
    averageRating: 4.6,
    totalReviews: 24
  },
  {
    id: 'prod-4',
    name: 'Smart Ambient Lighting Beam',
    slug: 'smart-ambient-lighting-beam',
    description: 'Sync your study room with warm gold tones and deep forest green hues.',
    price: 180.00,
    compareAtPrice: 220.00,
    stock: 25,
    images: ['/light.jpg'],
    isApproved: true,
    categoryId: 'cat-3',
    store: { id: 'store-3', name: 'Apex Tech Goods' },
    averageRating: 4.4,
    totalReviews: 19
  }
];

export default function Storefront() {
  // --- States ---
  const [categories, setCategories] = useState<Category[]>(MOCK_CATEGORIES);
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000]);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Detail Modal & Sidebar views
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Cart & Auth states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  
  // Auth Form Fields
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [firstNameInput, setFirstNameInput] = useState('');
  const [lastNameInput, setLastNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');

  // Checkout Form Fields
  const [streetInput, setStreetInput] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [stateInput, setStateInput] = useState('');
  const [postalInput, setPostalInput] = useState('');
  const [countryInput, setCountryInput] = useState('Nigeria');
  const [cardMethodInput, setCardMethodInput] = useState('pm_card_success'); // mock stripe success

  // Status Alerts
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- Fetch API on Mount ---
  useEffect(() => {
    fetchCatalog();
    // Load auth from localStorage if present
    const savedToken = localStorage.getItem('veridia_token');
    const savedEmail = localStorage.getItem('veridia_email');
    if (savedToken && savedEmail) {
      setToken(savedToken);
      setUserEmail(savedEmail);
    }
  }, []);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      // Try fetching from the NestJS backend
      const catRes = await fetch('http://localhost:3000/categories');
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.length > 0 ? catData : MOCK_CATEGORIES);
      }

      const prodRes = await fetch('http://localhost:3000/products');
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData.products && prodData.products.length > 0 ? prodData.products : MOCK_PRODUCTS);
      }
    } catch (err) {
      console.warn('NestJS server offline. Serving premium mock catalog fallbacks.');
      setCategories(MOCK_CATEGORIES);
      setProducts(MOCK_PRODUCTS);
    } finally {
      setLoading(false);
    }
  };

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  // --- Cart Actions ---
  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        triggerToast(`Unable to add: only ${product.stock} units available in stock.`, 'error');
        return;
      }
      setCart(
        cart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
    triggerToast(`Added "${product.name}" to cart!`);
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            if (nextQty > item.product.stock) {
              triggerToast(`Limit reached: only ${item.product.stock} units in stock.`, 'error');
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
    triggerToast('Removed item from cart.');
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartSavings = cart.reduce((sum, item) => {
    if (item.product.compareAtPrice) {
      return sum + (item.product.compareAtPrice - item.product.price) * item.quantity;
    }
    return sum;
  }, 0);

  // --- Auth Flow ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (authMode === 'login') {
        const res = await fetch('http://localhost:3000/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailInput, password: passwordInput }),
        });
        const data = await res.json();
        if (res.ok) {
          setToken(data.accessToken);
          setUserEmail(data.user.email);
          localStorage.setItem('veridia_token', data.accessToken);
          localStorage.setItem('veridia_email', data.user.email);
          triggerToast('Welcome back to Veridia!');
          setIsAuthOpen(false);
        } else {
          triggerToast(data.message || 'Login failed', 'error');
        }
      } else {
        const res = await fetch('http://localhost:3000/auth/signup/customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailInput,
            password: passwordInput,
            firstName: firstNameInput,
            lastName: lastNameInput,
            phoneNumber: phoneInput,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          triggerToast('Registration successful! Please log in.');
          setAuthMode('login');
        } else {
          triggerToast(data.message || 'Registration failed', 'error');
        }
      }
    } catch (err) {
      triggerToast('Auth endpoint offline. Mocking successful customer sign-in.', 'success');
      setToken('mock_jwt_token');
      setUserEmail(emailInput || 'guest@veridia.com');
      setIsAuthOpen(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUserEmail(null);
    localStorage.removeItem('veridia_token');
    localStorage.removeItem('veridia_email');
    triggerToast('Logged out successfully.');
  };

  // --- Checkout Flow ---
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (!token) {
      setIsCheckoutOpen(false);
      setIsAuthOpen(true);
      triggerToast('Please sign in or register to place your checkout order.', 'error');
      return;
    }

    try {
      // 1. Prepare Cart Items in Database format
      // Note: Typically cart items are populated in the DB cart already. Let's send checkout address
      const checkoutRes = await fetch('http://localhost:3000/orders/checkout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shippingAddress: {
            title: 'Storefront Delivery',
            street: streetInput,
            city: cityInput,
            state: stateInput,
            postalCode: postalInput,
            country: countryInput,
          },
        }),
      });

      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) {
        triggerToast(checkoutData.message || 'Checkout failed', 'error');
        return;
      }

      // 2. Process card payment
      const paymentRes = await fetch('http://localhost:3000/payments/charge', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: checkoutData.id,
          paymentMethodId: cardMethodInput,
        }),
      });

      const paymentData = await paymentRes.json();
      if (paymentRes.ok && paymentData.status === 'SUCCESSFUL') {
        triggerToast('Order placed & paid successfully! Checkout complete.');
        setCart([]);
        setIsCheckoutOpen(false);
      } else {
        triggerToast(`Payment declined: ${paymentData.status || 'Declined'}`, 'error');
      }
    } catch (err) {
      triggerToast('Mocking successful checkout transaction!', 'success');
      setCart([]);
      setIsCheckoutOpen(false);
    }
  };

  // --- Filtering & Sorting Logic ---
  const filteredProducts = products.filter((prod) => {
    const matchesCategory = !activeCategory || prod.categoryId === activeCategory;
    const matchesSearch =
      !searchQuery ||
      prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prod.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPrice = prod.price >= priceRange[0] && prod.price <= priceRange[1];
    return matchesCategory && matchesSearch && matchesPrice;
  }).sort((a, b) => {
    if (sortBy === 'price') {
      return sortOrder === 'asc' ? a.price - b.price : b.price - a.price;
    }
    // Default createdAt sort (newest mock first)
    return sortOrder === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
  });

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 transition-colors duration-300 dark:bg-stone-950 dark:text-stone-100">
      
      {/* Toast Alert */}
      {alertMsg && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-4 shadow-2xl transition-all duration-500 border ${
          alertMsg.type === 'error' 
            ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/90 dark:border-rose-900 dark:text-rose-100' 
            : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/90 dark:border-emerald-900 dark:text-emerald-100'
        }`}>
          <div className={`h-2.5 w-2.5 rounded-full ${alertMsg.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`} />
          <span className="text-sm font-semibold">{alertMsg.text}</span>
        </div>
      )}

      {/* --- Sticky Header Navigation --- */}
      <header className="sticky top-0 z-40 bg-stone-50/80 backdrop-blur-md border-b border-stone-200/80 dark:bg-stone-950/80 dark:border-stone-900/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setActiveCategory(null); setSearchQuery(''); }}>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-primary to-stone-900 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-900/10">
              V
            </div>
            <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-primary to-stone-800 bg-clip-text text-transparent dark:from-emerald-400 dark:to-stone-200">
              Veridia
            </span>
          </div>

          {/* Search bar */}
          <div className="hidden sm:flex flex-1 max-w-md relative">
            <input
              type="text"
              placeholder="Search premium products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 px-4 pl-10 rounded-xl border border-stone-200 bg-white text-sm outline-none transition focus:border-emerald-primary focus:ring-1 focus:ring-emerald-primary dark:border-stone-800 dark:bg-stone-900/50 dark:focus:border-emerald-500"
            />
            <svg className="absolute left-3 top-3.5 h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Action Links */}
          <div className="flex items-center gap-4">
            
            {/* Account auth indicator */}
            {token ? (
              <div className="flex items-center gap-3">
                <span className="hidden md:inline text-xs font-semibold text-stone-500 dark:text-stone-400">
                  {userEmail}
                </span>
                <button 
                  onClick={handleLogout}
                  className="h-10 px-4 rounded-xl border border-stone-200 hover:bg-stone-100 text-xs font-bold tracking-wide dark:border-stone-850 dark:hover:bg-stone-900"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setAuthMode('login'); setIsAuthOpen(true); }}
                className="h-10 px-4 rounded-xl bg-emerald-primary hover:bg-emerald-800 text-stone-50 text-xs font-bold tracking-wide shadow-md transition dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                Sign In
              </button>
            )}

            {/* Cart Trigger Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative h-11 w-11 rounded-xl bg-white border border-stone-200 flex items-center justify-center hover:bg-stone-50 dark:bg-stone-900/30 dark:border-stone-800 dark:hover:bg-stone-900"
            >
              <svg className="h-5 w-5 text-stone-600 dark:text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-emerald-primary text-white text-[10px] font-black flex items-center justify-center border-2 border-stone-50 dark:bg-emerald-600 dark:border-stone-950 animate-pulse">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile search bar */}
      <div className="sm:hidden px-4 py-3 bg-stone-100 border-b border-stone-200 dark:bg-stone-900 dark:border-stone-850">
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-white text-xs outline-none focus:border-emerald-primary dark:border-stone-800 dark:bg-stone-950"
        />
      </div>

      {/* --- Premium Hero Banner Section --- */}
      {!activeCategory && !searchQuery && (
        <section className="relative overflow-hidden bg-zinc-950 py-24 sm:py-32">
          {/* Artistic background blur elements */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-emerald-primary/10 blur-[120px] pointer-events-none" />
          <div className="absolute top-1/4 right-1/4 w-[250px] h-[250px] rounded-full bg-gold-secondary/5 blur-[90px] pointer-events-none" />

          <div className="mx-auto max-w-7xl px-6 lg:px-8 relative text-center sm:text-left flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="max-w-2xl flex flex-col gap-6">
              <div className="inline-flex self-center sm:self-start items-center gap-2 rounded-full bg-emerald-950 border border-emerald-800/80 px-4 py-1.5 text-xs font-semibold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                Phase 13 Active Catalog Live
              </div>
              <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.1]">
                Refined Goods, <br />
                <span className="bg-gradient-to-r from-emerald-400 to-amber-300 bg-clip-text text-transparent">
                  Rooted in Trust.
                </span>
              </h1>
              <p className="text-lg text-stone-400 leading-8">
                Welcome to Veridia. Discover organic accents, custom luxury chronographs, and smart eco-devices crafted by certified ethical merchants.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center sm:justify-start mt-4">
                <a
                  href="#catalog"
                  className="h-12 px-8 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-stone-50 font-bold tracking-wide shadow-xl shadow-emerald-950/20 transition flex items-center justify-center"
                >
                  Browse Catalog
                </a>
                <a
                  href="#about"
                  className="h-12 px-6 rounded-xl border border-stone-850 hover:bg-stone-900 text-stone-300 font-semibold tracking-wide flex items-center justify-center transition"
                >
                  Learn Values
                </a>
              </div>
            </div>

            {/* Brand Logo Display */}
            <div className="relative h-64 w-64 md:h-80 md:w-80 rounded-3xl bg-gradient-to-br from-emerald-primary/30 to-stone-950 border border-stone-850 p-6 flex flex-col items-center justify-center shadow-2xl">
              <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-emerald-primary to-amber-500 flex items-center justify-center text-white text-5xl font-black shadow-lg">
                V
              </div>
              <h3 className="text-xl font-bold text-white mt-6">Veridia Storefront</h3>
              <p className="text-xs text-stone-500 text-center mt-2 max-w-[180px]">
                Secured KYC verified business ecosystem
              </p>
            </div>
          </div>
        </section>
      )}

      {/* --- Catalog Core Main Section --- */}
      <main id="catalog" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Left Column Sidebar Filters */}
          <aside className="w-full md:w-64 flex-shrink-0 flex flex-col gap-8">
            
            {/* Categories list */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 dark:bg-stone-900 dark:border-stone-850">
              <h4 className="text-sm font-black uppercase tracking-wider text-stone-400 mb-4">
                Categories
              </h4>
              <ul className="flex flex-col gap-2">
                <li>
                  <button
                    onClick={() => setActiveCategory(null)}
                    className={`w-full text-left h-10 px-3 rounded-lg text-sm font-semibold transition ${
                      !activeCategory 
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' 
                        : 'hover:bg-stone-100 dark:hover:bg-stone-850 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    All Products
                  </button>
                </li>
                {categories.map((cat) => (
                  <li key={cat.id}>
                    <button
                      onClick={() => setActiveCategory(cat.id)}
                      className={`w-full text-left h-10 px-3 rounded-lg text-sm font-semibold transition ${
                        activeCategory === cat.id 
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' 
                          : 'hover:bg-stone-100 dark:hover:bg-stone-850 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      {cat.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Price Filter range */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 dark:bg-stone-900 dark:border-stone-850">
              <h4 className="text-sm font-black uppercase tracking-wider text-stone-400 mb-4">
                Price Cap
              </h4>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
                  <span>$0</span>
                  <span>${priceRange[1]}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2000"
                  step="50"
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                  className="w-full accent-emerald-primary"
                />
                <button
                  onClick={() => setPriceRange([0, 2000])}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-bold text-left mt-2 hover:underline"
                >
                  Reset Price Cap
                </button>
              </div>
            </div>
          </aside>

          {/* Right Column Product Grid */}
          <section className="flex-1 flex flex-col gap-6">
            
            {/* Sort & Info header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-sm text-stone-500 font-semibold">
                Showing {filteredProducts.length} premium products
              </p>
              
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <span className="text-xs text-stone-400 font-bold uppercase tracking-wider">Sort by</span>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field);
                    setSortOrder(order as 'asc' | 'desc');
                  }}
                  className="h-10 px-3 border border-stone-200 rounded-xl bg-white text-xs font-semibold dark:border-stone-800 dark:bg-stone-900"
                >
                  <option value="createdAt-desc">Newest First</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                </select>
              </div>
            </div>

            {/* Products grid */}
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-stone-200 border-t-emerald-primary" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-stone-400">
                <svg className="h-12 w-12 text-stone-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold">No products match your filter search query.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((prod) => {
                  const hasMarkdown = prod.compareAtPrice && prod.compareAtPrice > prod.price;
                  const discountPct = hasMarkdown 
                    ? Math.round(((prod.compareAtPrice! - prod.price) / prod.compareAtPrice!) * 100)
                    : 0;

                  return (
                    <div
                      key={prod.id}
                      className="group bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-2xl transition duration-300 dark:bg-stone-900 dark:border-stone-850"
                    >
                      {/* Product Image placeholder */}
                      <div className="h-48 bg-stone-100 relative dark:bg-stone-950 flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-primary/5 to-amber-500/5 group-hover:scale-105 transition-all duration-500" />
                        <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-black text-lg">
                          {prod.name.slice(0, 2).toUpperCase()}
                        </div>

                        {/* Discount Badge */}
                        {hasMarkdown && (
                          <span className="absolute top-3 left-3 bg-amber-500 text-white text-[10px] font-black px-2 py-1 rounded-md tracking-wider uppercase">
                            -{discountPct}% Save
                          </span>
                        )}

                        {/* Inventory stock warning */}
                        {prod.stock <= 5 && prod.stock > 0 && (
                          <span className="absolute bottom-3 right-3 bg-rose-600 text-white text-[9px] font-black px-2 py-1 rounded tracking-wide uppercase">
                            Low Stock: {prod.stock} left
                          </span>
                        )}
                        {prod.stock === 0 && (
                          <span className="absolute inset-0 bg-stone-900/60 flex items-center justify-center text-white text-xs font-bold tracking-wide uppercase">
                            Out of Stock
                          </span>
                        )}
                      </div>

                      {/* Content details */}
                      <div className="p-5 flex flex-col gap-3">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                          {prod.store?.name || 'Veridia Vendor'}
                        </span>
                        
                        <h3 className="font-bold text-stone-800 group-hover:text-emerald-primary transition dark:text-stone-200 line-clamp-1">
                          {prod.name}
                        </h3>

                        {/* Ratings */}
                        <div className="flex items-center gap-1.5 text-amber-500">
                          <span className="text-xs font-black">★</span>
                          <span className="text-xs font-bold text-stone-600 dark:text-stone-400">
                            {prod.averageRating || '5.0'}
                          </span>
                          <span className="text-xs text-stone-400">
                            ({prod.totalReviews || 0})
                          </span>
                        </div>

                        {/* Pricing row */}
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-lg font-black text-stone-900 dark:text-stone-50">
                            ${prod.price.toFixed(2)}
                          </span>
                          {hasMarkdown && (
                            <span className="text-xs text-stone-400 line-through">
                              ${prod.compareAtPrice?.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => setSelectedProduct(prod)}
                            className="flex-1 h-10 rounded-lg border border-stone-200 hover:bg-stone-100 text-xs font-bold transition dark:border-stone-800 dark:hover:bg-stone-850"
                          >
                            Details
                          </button>
                          <button
                            disabled={prod.stock === 0}
                            onClick={() => addToCart(prod)}
                            className="h-10 w-10 rounded-lg bg-emerald-primary hover:bg-emerald-800 text-white flex items-center justify-center transition disabled:bg-stone-200 disabled:text-stone-400 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                          >
                            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* --- Shopping Cart Sidebar Drawer --- */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop Click Close */}
          <div className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm transition-opacity" onClick={() => setIsCartOpen(false)} />
          
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col dark:bg-stone-900">
              
              {/* Header */}
              <div className="p-6 border-b border-stone-200 flex items-center justify-between dark:border-stone-850">
                <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                  Shopping Cart
                  <span className="text-xs font-semibold px-2 py-0.5 bg-stone-100 rounded-full dark:bg-stone-800">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)} items
                  </span>
                </h2>
                <button onClick={() => setIsCartOpen(false)} className="text-stone-400 hover:text-stone-600">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                {cart.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-stone-400">
                    <svg className="h-16 w-16 mb-4 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    <p className="text-sm font-semibold">Your cart is currently empty.</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.product.id} className="flex gap-4 border-b border-stone-100 pb-6 dark:border-stone-850">
                      
                      {/* Small image badge */}
                      <div className="h-16 w-16 bg-stone-100 rounded-xl flex items-center justify-center text-stone-700 dark:bg-stone-950 dark:text-stone-300 font-bold text-sm">
                        {item.product.name.slice(0, 2).toUpperCase()}
                      </div>

                      {/* Details */}
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="flex justify-between font-bold text-sm">
                          <h4 className="line-clamp-1">{item.product.name}</h4>
                          <span>${(item.product.price * item.quantity).toFixed(2)}</span>
                        </div>
                        <span className="text-[10px] text-stone-400 font-semibold">{item.product.store?.name}</span>

                        {/* Quantity management */}
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden dark:border-stone-800">
                            <button
                              onClick={() => updateCartQty(item.product.id, -1)}
                              className="h-8 w-8 hover:bg-stone-100 flex items-center justify-center text-sm font-bold dark:hover:bg-stone-850"
                            >
                              -
                            </button>
                            <span className="px-3 text-xs font-black">{item.quantity}</span>
                            <button
                              onClick={() => updateCartQty(item.product.id, 1)}
                              className="h-8 w-8 hover:bg-stone-100 flex items-center justify-center text-sm font-bold dark:hover:bg-stone-850"
                            >
                              +
                            </button>
                          </div>
                          
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-xs text-rose-500 hover:underline font-bold"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer Summary & Action */}
              {cart.length > 0 && (
                <div className="p-6 border-t border-stone-200 bg-stone-50 dark:bg-stone-900/60 dark:border-stone-850 flex flex-col gap-4">
                  {cartSavings > 0 && (
                    <div className="flex justify-between text-xs font-bold text-amber-600">
                      <span>Total Savings</span>
                      <span>-${cartSavings.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black">
                    <span>Subtotal</span>
                    <span>${cartSubtotal.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
                    className="w-full h-12 rounded-xl bg-emerald-primary hover:bg-emerald-800 text-stone-50 font-bold tracking-wide shadow-lg transition flex items-center justify-center dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  >
                    Proceed to Checkout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Product Details View Modal --- */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Click Close */}
          <div className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm" onClick={() => setSelectedProduct(null)} />
          
          <div className="relative bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl flex flex-col gap-6 dark:bg-stone-900">
            {/* Close trigger */}
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Layout Split */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Product Visual */}
              <div className="h-64 bg-stone-100 rounded-2xl flex items-center justify-center font-black text-2xl text-emerald-800 dark:bg-stone-950 dark:text-emerald-300">
                {selectedProduct.name.slice(0, 2).toUpperCase()}
              </div>

              {/* Information Details */}
              <div className="flex flex-col gap-4">
                <span className="text-xs text-stone-400 font-bold uppercase tracking-widest">
                  {selectedProduct.store?.name}
                </span>
                <h2 className="text-2xl font-black text-stone-900 dark:text-stone-50 leading-tight">
                  {selectedProduct.name}
                </h2>
                <div className="flex items-center gap-1 text-amber-500 text-sm">
                  <span>★</span>
                  <span className="font-bold text-stone-600 dark:text-stone-400">
                    {selectedProduct.averageRating || '5.0'}
                  </span>
                  <span className="text-stone-400">({selectedProduct.totalReviews || 0} customer reviews)</span>
                </div>
                <p className="text-sm text-stone-500 leading-relaxed">
                  {selectedProduct.description}
                </p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-black text-stone-900 dark:text-stone-50">
                    ${selectedProduct.price.toFixed(2)}
                  </span>
                  {selectedProduct.compareAtPrice && (
                    <span className="text-sm text-stone-400 line-through">
                      ${selectedProduct.compareAtPrice.toFixed(2)}
                    </span>
                  )}
                </div>

                <button
                  disabled={selectedProduct.stock === 0}
                  onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
                  className="w-full h-11 bg-emerald-primary hover:bg-emerald-800 text-stone-50 text-xs font-bold tracking-wide rounded-xl shadow-lg transition mt-4 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  Add to Shopping Cart
                </button>
              </div>
            </div>

            {/* Product Reviews section */}
            <div className="border-t border-stone-100 pt-6 mt-4 dark:border-stone-850">
              <h4 className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-4">
                Recent Customer Reviews
              </h4>
              {selectedProduct.reviews && selectedProduct.reviews.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {selectedProduct.reviews.map((r) => (
                    <div key={r.id} className="bg-stone-50 rounded-xl p-4 dark:bg-stone-950/40">
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span>{r.customer.firstName} {r.customer.lastName}</span>
                        <span className="text-amber-500">{'★'.repeat(r.rating)}</span>
                      </div>
                      <p className="text-xs text-stone-500 leading-relaxed">{r.comment}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-400">No reviews yet for this product. Be the first to purchase and review!</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Checkout Overlay Form Modal --- */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm" onClick={() => setIsCheckoutOpen(false)} />
          
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl flex flex-col gap-6 dark:bg-stone-900">
            <h2 className="text-xl font-black tracking-tight">Checkout Order Details</h2>
            
            <form onSubmit={handleCheckoutSubmit} className="flex flex-col gap-4">
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-stone-400 uppercase">Street Address</label>
                <input
                  type="text"
                  required
                  placeholder="123 Sapphire Street"
                  value={streetInput}
                  onChange={(e) => setStreetInput(e.target.value)}
                  className="h-10 px-3 border border-stone-200 rounded-lg text-sm bg-transparent outline-none focus:border-emerald-primary dark:border-stone-850"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-400 uppercase">City</label>
                  <input
                    type="text"
                    required
                    placeholder="Lekki"
                    value={cityInput}
                    onChange={(e) => setCityInput(e.target.value)}
                    className="h-10 px-3 border border-stone-200 rounded-lg text-sm bg-transparent outline-none focus:border-emerald-primary dark:border-stone-850"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-400 uppercase">State</label>
                  <input
                    type="text"
                    required
                    placeholder="Lagos"
                    value={stateInput}
                    onChange={(e) => setStateInput(e.target.value)}
                    className="h-10 px-3 border border-stone-200 rounded-lg text-sm bg-transparent outline-none focus:border-emerald-primary dark:border-stone-850"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-400 uppercase">Postal Code</label>
                  <input
                    type="text"
                    required
                    placeholder="105102"
                    value={postalInput}
                    onChange={(e) => setPostalInput(e.target.value)}
                    className="h-10 px-3 border border-stone-200 rounded-lg text-sm bg-transparent outline-none focus:border-emerald-primary dark:border-stone-850"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-400 uppercase">Country</label>
                  <input
                    type="text"
                    required
                    placeholder="Nigeria"
                    value={countryInput}
                    onChange={(e) => setCountryInput(e.target.value)}
                    className="h-10 px-3 border border-stone-200 rounded-lg text-sm bg-transparent outline-none focus:border-emerald-primary dark:border-stone-850"
                  />
                </div>
              </div>

              {/* Stripe mock card selectors */}
              <div className="flex flex-col gap-1.5 border-t border-stone-100 pt-4 mt-2 dark:border-stone-850">
                <label className="text-xs font-bold text-stone-400 uppercase">Mock Payment Method</label>
                <select
                  value={cardMethodInput}
                  onChange={(e) => setCardMethodInput(e.target.value)}
                  className="h-10 px-3 border border-stone-200 rounded-lg text-xs bg-transparent dark:border-stone-850"
                >
                  <option value="pm_card_success">Mock Success Card (Approve Payout)</option>
                  <option value="pm_card_chargeDeclinedInsufficientFunds">Mock Card Decline (Insufficient Funds)</option>
                </select>
              </div>

              <div className="flex justify-between border-t border-stone-100 pt-4 mt-2 dark:border-stone-850 font-bold">
                <span>Subtotal amount</span>
                <span>${cartSubtotal.toFixed(2)}</span>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="flex-1 h-11 border border-stone-200 rounded-xl hover:bg-stone-50 text-xs font-bold dark:border-stone-800 dark:hover:bg-stone-850"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-11 bg-emerald-primary hover:bg-emerald-800 text-stone-50 text-xs font-bold tracking-wide rounded-xl shadow-lg transition dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  Submit Order Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- User Auth Modal Dialog --- */}
      {isAuthOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm" onClick={() => setIsAuthOpen(false)} />
          
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl flex flex-col gap-6 dark:bg-stone-900">
            <h2 className="text-xl font-black tracking-tight">
              {authMode === 'login' ? 'Welcome Back' : 'Join Veridia Storefront'}
            </h2>

            <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-stone-400 uppercase">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="h-10 px-3 border border-stone-200 rounded-lg text-sm bg-transparent outline-none focus:border-emerald-primary dark:border-stone-850"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-stone-400 uppercase">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="h-10 px-3 border border-stone-200 rounded-lg text-sm bg-transparent outline-none focus:border-emerald-primary dark:border-stone-850"
                />
              </div>

              {authMode === 'signup' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-stone-400 uppercase">First Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Alice"
                        value={firstNameInput}
                        onChange={(e) => setFirstNameInput(e.target.value)}
                        className="h-10 px-3 border border-stone-200 rounded-lg text-sm bg-transparent outline-none focus:border-emerald-primary dark:border-stone-850"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-stone-400 uppercase">Last Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Alpha"
                        value={lastNameInput}
                        onChange={(e) => setLastNameInput(e.target.value)}
                        className="h-10 px-3 border border-stone-200 rounded-lg text-sm bg-transparent outline-none focus:border-emerald-primary dark:border-stone-850"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-stone-400 uppercase">Phone Number</label>
                    <input
                      type="text"
                      required
                      placeholder="+1112223333"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="h-10 px-3 border border-stone-200 rounded-lg text-sm bg-transparent outline-none focus:border-emerald-primary dark:border-stone-850"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                className="w-full h-11 bg-emerald-primary hover:bg-emerald-800 text-stone-50 text-xs font-bold tracking-wide rounded-xl shadow-lg transition mt-2 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {authMode === 'login' ? 'Sign In to Account' : 'Register Account'}
              </button>

              <div className="text-center text-xs text-stone-400 mt-2 font-semibold">
                {authMode === 'login' ? (
                  <>
                    New to Veridia?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('signup')}
                      className="text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className="text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Sign In
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Footer branding info --- */}
      <footer className="bg-stone-900 text-stone-400 py-12 mt-20 border-t border-stone-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center flex flex-col gap-6 items-center">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-650 flex items-center justify-center text-white font-bold shadow-lg">
              V
            </div>
            <span className="text-lg font-bold text-white tracking-wide">
              Veridia Marketplace
            </span>
          </div>
          <p className="text-xs max-w-md leading-relaxed text-stone-500">
            A state-of-the-art multi-vendor e-commerce platform built for growth, trust, and complete visual elegance. Powered by next-gen technologies.
          </p>
          <p className="text-[10px] text-stone-600 font-bold uppercase tracking-wider">
            &copy; 2026 Veridia Inc. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
