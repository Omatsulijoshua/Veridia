'use client';

import React, { useState, useEffect } from 'react';

// --- Types & Interfaces ---
interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  categoryId: string;
}

interface Order {
  id: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  customer: {
    user: {
      email: string;
    };
  };
}

interface LedgerTransaction {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  reference: string;
  createdAt: string;
}

interface SellerAnalytics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderSize: number;
  topProducts: Array<{
    id: string;
    name: string;
    price: number;
    quantitySold: number;
  }>;
}

// --- Fallback Mock Data ---
const MOCK_ANALYTICS: SellerAnalytics = {
  totalRevenue: 4500.00,
  totalOrders: 15,
  averageOrderSize: 300.00,
  topProducts: [
    { id: 'prod-1', name: 'Sustainable phone case', price: 95.00, quantitySold: 12 },
    { id: 'prod-2', name: 'Luxury leather watch strap', price: 320.00, quantitySold: 4 }
  ],
};

const MOCK_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Sustainable phone case',
    slug: 'sustainable-phone-case',
    description: 'Eco-friendly phone casing detailed with organic plant fibers and gold leaf lines.',
    price: 95.00,
    stock: 10,
    categoryId: 'cat-1'
  },
  {
    id: 'prod-2',
    name: 'Luxury leather watch strap',
    slug: 'luxury-leather-watch-strap',
    description: 'Handmade calfskin strap with gold bucking pins.',
    price: 320.00,
    stock: 15,
    categoryId: 'cat-1'
  }
];

const MOCK_ORDERS: Order[] = [
  {
    id: 'ord-101',
    totalAmount: 415.00,
    status: 'PAID',
    createdAt: '2026-08-01T21:40:00Z',
    customer: { user: { email: 'buyer.alice@test.com' } }
  },
  {
    id: 'ord-102',
    totalAmount: 95.00,
    status: 'PENDING',
    createdAt: '2026-08-02T01:10:00Z',
    customer: { user: { email: 'buyer.bob@test.com' } }
  }
];

const MOCK_LEDGER: LedgerTransaction[] = [
  {
    id: 'tx-1',
    type: 'CREDIT',
    amount: 415.00,
    reference: 'Sales Payout: Order ord-101',
    createdAt: '2026-08-01T21:45:00Z'
  },
  {
    id: 'tx-2',
    type: 'DEBIT',
    amount: 95.00,
    reference: 'Refund Debit: Ref order ord-99',
    createdAt: '2026-08-02T01:30:00Z'
  }
];

export default function SellerDashboard() {
  // --- States ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'orders' | 'ledger' | 'profile'>('dashboard');
  const [analytics, setAnalytics] = useState<SellerAnalytics>(MOCK_ANALYTICS);
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS);
  const [ledger, setLedger] = useState<LedgerTransaction[]>(MOCK_LEDGER);
  const [walletBalance, setWalletBalance] = useState<number>(320.00);

  // Authentication states
  const [token, setToken] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('seller@test.com');
  const [passwordInput, setPasswordInput] = useState('testpassword123');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  
  // Registration specific fields
  const [businessNameInput, setBusinessNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');

  // Modals & fields
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodCategory, setProdCategory] = useState('cat-1');
  const [prodDesc, setProdDesc] = useState('');

  // Page loadings / Alerts
  const [loading, setLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- Fetch API on Mount / Login ---
  useEffect(() => {
    const savedToken = localStorage.getItem('veridia_seller_token');
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchSellerData();
    }
  }, [token]);

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  const fetchSellerData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Analytics summary
      const summaryRes = await fetch('http://localhost:3000/analytics/seller/summary', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setAnalytics(summaryData);
      }

      // 2. Fetch Wallet ledger
      const ledgerRes = await fetch('http://localhost:3000/wallets/ledger', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (ledgerRes.ok) {
        const ledgerData = await ledgerRes.json();
        setWalletBalance(ledgerData.balance);
        setLedger(ledgerData.transactions && ledgerData.transactions.length > 0 ? ledgerData.transactions : MOCK_LEDGER);
      }

      // 3. Fetch products list
      const productsRes = await fetch('http://localhost:3000/products');
      if (productsRes.ok) {
        const prodData = await productsRes.json();
        setProducts(prodData.products && prodData.products.length > 0 ? prodData.products : MOCK_PRODUCTS);
      }
    } catch (err) {
      console.warn('NestJS server offline. Operating in fallback mock merchant workspace.');
      setAnalytics(MOCK_ANALYTICS);
      setProducts(MOCK_PRODUCTS);
      setOrders(MOCK_ORDERS);
      setLedger(MOCK_LEDGER);
      setWalletBalance(320.00);
    } finally {
      setLoading(false);
    }
  };

  // --- Auth submit ---
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
          localStorage.setItem('veridia_seller_token', data.accessToken);
          triggerToast('Welcome back to the Merchant Workspace!');
        } else {
          triggerToast(data.message || 'Login failed', 'error');
        }
      } else {
        const res = await fetch('http://localhost:3000/auth/signup/seller', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailInput,
            password: passwordInput,
            businessName: businessNameInput,
            phoneNumber: phoneInput,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          triggerToast('Signup complete! Please sign in.');
          setAuthMode('login');
        } else {
          triggerToast(data.message || 'Registration failed', 'error');
        }
      }
    } catch (err) {
      triggerToast('Auth server offline. Simulating Merchant sign-in.', 'success');
      setToken('mock_seller_token');
      localStorage.setItem('veridia_seller_token', 'mock_seller_token');
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('veridia_seller_token');
    triggerToast('Logged out of Merchant Workspace.');
  };

  // --- Inventory Mutations ---
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3000/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: prodName,
          price: parseFloat(prodPrice),
          stock: parseInt(prodStock),
          categoryId: prodCategory,
          description: prodDesc,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setProducts([...products, data]);
        triggerToast(`Product "${prodName}" added successfully. Awaiting Admin approvals.`);
        setIsAddProductOpen(false);
        // Clear fields
        setProdName('');
        setProdPrice('');
        setProdStock('');
        setProdDesc('');
      } else {
        triggerToast(data.message || 'Failed to create product', 'error');
      }
    } catch (err) {
      // Mock insert
      const newProd: Product = {
        id: `mock-prod-${Date.now()}`,
        name: prodName,
        slug: prodName.toLowerCase().replace(/\s+/g, '-'),
        price: parseFloat(prodPrice),
        stock: parseInt(prodStock),
        categoryId: prodCategory,
        description: prodDesc,
      };
      setProducts([...products, newProd]);
      triggerToast(`[Mock Action] Product "${prodName}" added to inventory.`);
      setIsAddProductOpen(false);
      setProdName('');
      setProdPrice('');
      setProdStock('');
      setProdDesc('');
    }
  };

  const deleteProductEntry = async (productId: string) => {
    try {
      const res = await fetch(`http://localhost:3000/products/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        setProducts(products.filter((p) => p.id !== productId));
        triggerToast('Product deleted successfully from catalog.');
      } else {
        const error = await res.json();
        triggerToast(error.message || 'Deletion failed', 'error');
      }
    } catch (err) {
      setProducts(products.filter((p) => p.id !== productId));
      triggerToast('[Mock Action] Product removed from catalog.');
    }
  };

  // --- Orders Fulfillment ---
  const shipOrder = async (orderId: string) => {
    try {
      const res = await fetch(`http://localhost:3000/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'SHIPPED' }),
      });
      if (res.ok) {
        setOrders(
          orders.map((o) => (o.id === orderId ? { ...o, status: 'SHIPPED' } : o))
        );
        triggerToast('Order status updated to SHIPPED. Customer notified.');
      } else {
        const error = await res.json();
        triggerToast(error.message || 'Fulfillment failed', 'error');
      }
    } catch (err) {
      setOrders(
        orders.map((o) => (o.id === orderId ? { ...o, status: 'SHIPPED' } : o))
      );
      triggerToast('[Mock Action] Order fulfilled: status marked as SHIPPED.');
    }
  };

  // --- Login Screen ---
  if (!token) {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] rounded-full bg-emerald-primary/10 blur-[100px] pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-[200px] h-[200px] rounded-full bg-gold-secondary/5 blur-[80px] pointer-events-none" />

        <div className="relative bg-stone-950/80 border border-stone-800 p-8 rounded-3xl max-w-md w-full shadow-2xl backdrop-blur-xl flex flex-col gap-6">
          <div className="text-center flex flex-col items-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-primary to-amber-500 flex items-center justify-center text-white text-3xl font-black shadow-lg">
              V
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mt-2">
              {authMode === 'login' ? 'Merchant Sign In' : 'Register Seller Store'}
            </h1>
            <p className="text-xs text-stone-500 font-semibold uppercase tracking-wider">
              Veridia Vendor Workspace
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-wide">Business Email</label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="h-11 px-4 border border-stone-850 bg-stone-900/50 rounded-xl text-sm text-stone-100 outline-none transition focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-wide">Account Password</label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="h-11 px-4 border border-stone-850 bg-stone-900/50 rounded-xl text-sm text-stone-100 outline-none transition focus:border-emerald-500"
              />
            </div>

            {authMode === 'signup' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-wide">Registered Business Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Veridia Goods Inc"
                    value={businessNameInput}
                    onChange={(e) => setBusinessNameInput(e.target.value)}
                    className="h-11 px-4 border border-stone-850 bg-stone-900/50 rounded-xl text-sm text-stone-100 outline-none transition focus:border-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-wide">Contact Phone Number</label>
                  <input
                    type="text"
                    required
                    placeholder="+23480000000"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="h-11 px-4 border border-stone-850 bg-stone-900/50 rounded-xl text-sm text-stone-100 outline-none transition focus:border-emerald-500"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full h-11 bg-emerald-primary hover:bg-emerald-800 text-stone-50 text-xs font-bold tracking-wide rounded-xl shadow-lg transition mt-4"
            >
              {authMode === 'login' ? 'Access Merchant Workspace' : 'Submit KYC & Store Setup'}
            </button>

            <div className="text-center text-xs text-stone-400 mt-2 font-semibold">
              {authMode === 'login' ? (
                <>
                  New merchant?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthMode('signup')}
                    className="text-emerald-455 hover:underline"
                  >
                    Register your store
                  </button>
                </>
              ) : (
                <>
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className="text-emerald-455 hover:underline"
                  >
                    Sign In
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col md:flex-row dark:bg-stone-950 dark:text-stone-100 transition-colors duration-300">
      
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

      {/* --- Sidebar navigation --- */}
      <aside className="w-full md:w-64 bg-stone-900 flex-shrink-0 flex flex-col justify-between text-stone-400 border-r border-stone-800 dark:bg-stone-950">
        <div className="flex flex-col">
          {/* Header branding */}
          <div className="p-6 border-b border-stone-855 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-primary to-amber-500 flex items-center justify-center text-white font-black text-xl shadow-lg">
              V
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black text-stone-100 tracking-wide">Veridia Vendor</span>
              <span className="text-[9px] font-bold text-stone-600 uppercase tracking-widest">Merchant Center</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 flex flex-col gap-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`h-11 px-4 rounded-xl text-xs font-bold tracking-wide text-left flex items-center gap-3 transition ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-primary text-stone-50'
                  : 'hover:bg-stone-850 text-stone-400 hover:text-stone-100'
              }`}
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Workspace Summary
            </button>

            <button
              onClick={() => setActiveTab('products')}
              className={`h-11 px-4 rounded-xl text-xs font-bold tracking-wide text-left flex items-center gap-3 transition ${
                activeTab === 'products'
                  ? 'bg-emerald-primary text-stone-50'
                  : 'hover:bg-stone-850 text-stone-400 hover:text-stone-100'
              }`}
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Inventory Manager
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`h-11 px-4 rounded-xl text-xs font-bold tracking-wide text-left flex items-center gap-3 transition ${
                activeTab === 'orders'
                  ? 'bg-emerald-primary text-stone-50'
                  : 'hover:bg-stone-850 text-stone-400 hover:text-stone-100'
              }`}
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Fulfillment Orders
            </button>

            <button
              onClick={() => setActiveTab('ledger')}
              className={`h-11 px-4 rounded-xl text-xs font-bold tracking-wide text-left flex items-center gap-3 transition ${
                activeTab === 'ledger'
                  ? 'bg-emerald-primary text-stone-50'
                  : 'hover:bg-stone-850 text-stone-400 hover:text-stone-100'
              }`}
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Wallet & Ledger
            </button>
          </nav>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-stone-855 flex flex-col gap-2">
          <span className="text-[10px] text-stone-600 font-bold px-2 uppercase">Verified merchant</span>
          <button
            onClick={handleLogout}
            className="w-full h-10 px-4 rounded-lg bg-stone-850 hover:bg-stone-800 text-xs font-bold transition text-left flex items-center gap-3"
          >
            Logout Store
          </button>
        </div>
      </aside>

      {/* --- Main Contents Panel --- */}
      <main className="flex-1 bg-stone-50 py-10 px-6 sm:px-8 dark:bg-stone-950 flex flex-col gap-8">
        
        {/* Header Title */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-5 dark:border-stone-850">
          <div>
            <h2 className="text-2xl font-black capitalize tracking-tight text-stone-900 dark:text-stone-50">
              {activeTab === 'dashboard' ? 'Merchant Summary' : `${activeTab} Workspace`}
            </h2>
            <p className="text-xs text-stone-500 font-medium mt-1">
              Storefront performance and catalog distribution
            </p>
          </div>

          <button
            onClick={fetchSellerData}
            className="h-10 px-4 rounded-xl border border-stone-200 hover:bg-stone-100 text-xs font-bold flex items-center gap-2 dark:border-stone-855 dark:hover:bg-stone-900"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
            </svg>
            Sync
          </button>
        </div>

        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-stone-200 border-t-emerald-primary" />
          </div>
        ) : (
          <>
            {/* --- TAB 1: DASHBOARD OVERVIEW SUMMARY --- */}
            {activeTab === 'dashboard' && (
              <div className="flex flex-col gap-8">
                
                {/* Analytics summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  
                  {/* Revenue Card */}
                  <div className="bg-stone-900 border border-stone-855 rounded-3xl p-6 relative overflow-hidden dark:bg-stone-950">
                    <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-br from-emerald-primary/10 to-transparent blur-xl pointer-events-none" />
                    <span className="text-xs font-black uppercase tracking-wider text-stone-500">Store Revenue</span>
                    <h3 className="text-3xl font-black text-stone-50 mt-2 bg-gradient-to-r from-emerald-450 to-amber-300 bg-clip-text text-transparent">
                      ${analytics.totalRevenue.toFixed(2)}
                    </h3>
                    <p className="text-[10px] text-stone-500 mt-2 font-bold uppercase">Net payouts credited</p>
                  </div>

                  {/* Orders Card */}
                  <div className="bg-stone-900 border border-stone-855 rounded-3xl p-6 relative overflow-hidden dark:bg-stone-950">
                    <span className="text-xs font-black uppercase tracking-wider text-stone-500">Volume Orders</span>
                    <h3 className="text-3xl font-black text-stone-50 mt-2">
                      {analytics.totalOrders}
                    </h3>
                    <p className="text-[10px] text-stone-500 mt-2 font-bold uppercase">Placed under your store</p>
                  </div>

                  {/* Average Order size */}
                  <div className="bg-stone-900 border border-stone-855 rounded-3xl p-6 relative overflow-hidden dark:bg-stone-950">
                    <span className="text-xs font-black uppercase tracking-wider text-stone-500">Average Basket size</span>
                    <h3 className="text-3xl font-black text-stone-50 mt-2">
                      ${analytics.averageOrderSize.toFixed(2)}
                    </h3>
                    <p className="text-[10px] text-stone-500 mt-2 font-bold uppercase">Revenue divided by order count</p>
                  </div>
                </div>

                {/* Top Products Volume Sold */}
                <div className="bg-white border border-stone-200 rounded-3xl p-6 dark:bg-stone-900 dark:border-stone-850">
                  <h4 className="text-sm font-black uppercase tracking-wider text-stone-400 mb-4">
                    Top Selling Products
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-stone-100 text-stone-500 uppercase font-black tracking-wider dark:border-stone-850">
                          <th className="pb-3">Product Name</th>
                          <th className="pb-3">Price</th>
                          <th className="pb-3 text-right">Units Sold</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-stone-850">
                        {analytics.topProducts.map((p) => (
                          <tr key={p.id}>
                            <td className="py-3 font-bold text-stone-850 dark:text-stone-200">{p.name}</td>
                            <td className="py-3 font-mono font-bold">${p.price.toFixed(2)}</td>
                            <td className="py-3 text-right font-black text-emerald-600 dark:text-emerald-400">{p.quantitySold}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB 2: INVENTORY PRODUCT MANAGER --- */}
            {activeTab === 'products' && (
              <div className="flex flex-col gap-6">
                
                {/* Catalog header action */}
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-450">Active Catalog Listings</h3>
                  <button
                    onClick={() => setIsAddProductOpen(true)}
                    className="h-10 px-4 bg-emerald-primary hover:bg-emerald-800 text-white rounded-xl text-xs font-bold tracking-wide transition dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  >
                    Add New Product
                  </button>
                </div>

                {/* Products Inventory Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white border border-stone-200 rounded-3xl p-5 flex flex-col justify-between gap-4 dark:bg-stone-900 dark:border-stone-850"
                    >
                      <div className="flex flex-col gap-1.5">
                        <h4 className="font-bold text-stone-850 dark:text-stone-200 line-clamp-1">{p.name}</h4>
                        <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed">{p.description}</p>
                      </div>

                      <div className="flex items-center justify-between border-t border-stone-100 pt-3 dark:border-stone-850">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-stone-400 font-bold uppercase">Price</span>
                          <span className="font-mono font-bold text-sm">${p.price.toFixed(2)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-stone-400 font-bold uppercase">Stock</span>
                          <span className={`text-xs font-black ${p.stock <= 5 ? 'text-rose-500' : 'text-stone-600 dark:text-stone-400'}`}>
                            {p.stock} units
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2 border-t border-stone-100 pt-3 dark:border-stone-850">
                        <button
                          onClick={() => deleteProductEntry(p.id)}
                          className="flex-1 h-9 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-bold transition dark:border-rose-950/40 dark:hover:bg-rose-950/20"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- TAB 3: FULFILLMENT ORDERS --- */}
            {activeTab === 'orders' && (
              <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden dark:bg-stone-900 dark:border-stone-850">
                <div className="p-6 border-b border-stone-100 dark:border-stone-850">
                  <h3 className="font-bold text-stone-800 dark:text-stone-200">Customer Fulfillment</h3>
                  <p className="text-xs text-stone-500 mt-1">Prepare paid checkout bundles. Mark order status as SHIPPED to coordinate courier dispatch.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-100 text-stone-500 uppercase font-black tracking-wider dark:bg-stone-950 dark:border-stone-850">
                        <th className="p-4">Order ID</th>
                        <th className="p-4">Customer Email</th>
                        <th className="p-4">Total Amount</th>
                        <th className="p-4">Order Status</th>
                        <th className="p-4 text-right">Fulfill Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-850">
                      {orders.map((o) => (
                        <tr key={o.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-950/40">
                          <td className="p-4 font-mono font-semibold text-stone-600 dark:text-stone-400">
                            {o.id}
                          </td>
                          <td className="p-4 font-medium text-stone-500">{o.customer.user.email}</td>
                          <td className="p-4 font-mono font-bold text-stone-900 dark:text-stone-50">${o.totalAmount.toFixed(2)}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              o.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : o.status === 'SHIPPED'
                                ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400'
                                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                o.status === 'PAID' ? 'bg-emerald-600' : o.status === 'SHIPPED' ? 'bg-blue-600' : 'bg-amber-600'
                              }`} />
                              {o.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              disabled={o.status !== 'PAID'}
                              onClick={() => shipOrder(o.id)}
                              className="h-9 px-4 rounded-xl text-xs font-bold bg-emerald-primary hover:bg-emerald-800 text-white transition disabled:bg-stone-100 disabled:text-stone-400 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:disabled:bg-stone-850 dark:disabled:text-stone-600"
                            >
                              Dispatch Order
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --- TAB 4: WALLETS LEDGER DETAILS --- */}
            {activeTab === 'ledger' && (
              <div className="flex flex-col gap-8">
                
                {/* Balance display */}
                <div className="bg-stone-900 border border-stone-855 rounded-3xl p-8 relative overflow-hidden dark:bg-stone-950 max-w-sm">
                  <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-br from-amber-550/15 to-transparent blur-xl pointer-events-none" />
                  <span className="text-xs font-black uppercase tracking-wider text-stone-500">Available Wallet Balance</span>
                  <h3 className="text-4xl font-black text-stone-50 mt-2 bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
                    ${walletBalance.toFixed(2)}
                  </h3>
                  <p className="text-[10px] text-stone-500 mt-2 font-bold uppercase">Credited automatically post checkout payment confirmation</p>
                </div>

                {/* Ledger lists */}
                <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden dark:bg-stone-900 dark:border-stone-850">
                  <div className="p-6 border-b border-stone-100 dark:border-stone-850">
                    <h3 className="font-bold text-stone-850 dark:text-stone-200">Ledger Statement</h3>
                    <p className="text-xs text-stone-500 mt-1">Audit credit and debit references. Dispute refunds pull debits directly from your ledger.</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-stone-50 border-b border-stone-100 text-stone-500 uppercase font-black tracking-wider dark:bg-stone-950 dark:border-stone-850">
                          <th className="p-4">Transaction Reference</th>
                          <th className="p-4">Audit Type</th>
                          <th className="p-4">Date</th>
                          <th className="p-4 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-stone-850">
                        {ledger.map((tx) => (
                          <tr key={tx.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-950/40">
                            <td className="p-4 font-bold text-stone-850 dark:text-stone-200">{tx.reference}</td>
                            <td className="p-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
                                tx.type === 'CREDIT' 
                                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' 
                                  : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                              }`}>
                                {tx.type}
                              </span>
                            </td>
                            <td className="p-4 font-mono text-stone-400">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </td>
                            <td className={`p-4 text-right font-mono font-black ${
                              tx.type === 'CREDIT' ? 'text-emerald-650 dark:text-emerald-400' : 'text-rose-650'
                            }`}>
                              {tx.type === 'CREDIT' ? '+' : '-'}${tx.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* --- Add Product Modal Dialog --- */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm" onClick={() => setIsAddProductOpen(false)} />
          
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl flex flex-col gap-6 dark:bg-stone-900">
            <h2 className="text-xl font-black tracking-tight">Add Product to Store</h2>

            <form onSubmit={handleAddProduct} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-stone-400 uppercase">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="Premium Leather strap watch case"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="h-10 px-3 border border-stone-200 rounded-lg text-sm bg-transparent outline-none focus:border-emerald-primary dark:border-stone-850"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-400 uppercase">Unit Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="250.00"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    className="h-10 px-3 border border-stone-200 rounded-lg text-sm bg-transparent outline-none focus:border-emerald-primary dark:border-stone-850"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-400 uppercase">Stock Level</label>
                  <input
                    type="number"
                    required
                    placeholder="10"
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    className="h-10 px-3 border border-stone-200 rounded-lg text-sm bg-transparent outline-none focus:border-emerald-primary dark:border-stone-850"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-stone-400 uppercase">Description</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter high quality product summaries..."
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  className="p-3 border border-stone-200 rounded-lg text-sm bg-transparent outline-none focus:border-emerald-primary dark:border-stone-850"
                />
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="flex-1 h-11 border border-stone-200 rounded-xl hover:bg-stone-50 text-xs font-bold dark:border-stone-800 dark:hover:bg-stone-850"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-11 bg-emerald-primary hover:bg-emerald-800 text-stone-50 text-xs font-bold tracking-wide rounded-xl shadow-lg transition dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  Publish Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
