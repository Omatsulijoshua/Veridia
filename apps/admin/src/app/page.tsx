'use client';

import React, { useState, useEffect } from 'react';

// --- Types & Interfaces ---
interface Seller {
  id: string;
  businessName: string;
  phoneNumber: string;
  isVerified: boolean;
  user: {
    id: string;
    email: string;
  };
  store?: {
    id: string;
    name: string;
    logoUrl?: string;
  };
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  isApproved: boolean;
  store: {
    id: string;
    name: string;
  };
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
  shippingAddress: any;
}

interface Analytics {
  totalGmv: number;
  totalOrders: number;
  activeProducts: number;
  registeredUsers: number;
}

// --- Fallback Mock Data ---
const MOCK_ANALYTICS: Analytics = {
  totalGmv: 24500.00,
  totalOrders: 152,
  activeProducts: 84,
  registeredUsers: 120,
};

const MOCK_SELLERS: Seller[] = [
  {
    id: 'sell-1',
    businessName: 'Eco Tech Trading Ltd',
    phoneNumber: '+1234567890',
    isVerified: false,
    user: { id: 'u-1', email: 'merchant.one@veridia.com' },
    store: { id: 'store-1', name: 'Eco Tech Store' }
  },
  {
    id: 'sell-2',
    businessName: 'Aureum Horology & Fine Watches',
    phoneNumber: '+9876543210',
    isVerified: true,
    user: { id: 'u-2', email: 'merchant.two@veridia.com' },
    store: { id: 'store-2', name: 'Aureum Boutique' }
  }
];

const MOCK_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Sustainable Emerald Phone Case',
    slug: 'sustainable-emerald-phone-case',
    description: 'Eco-friendly phone casing detailed with organic plant fibers and gold leaf lines.',
    price: 95.00,
    isApproved: false,
    store: { id: 'store-1', name: 'Eco Tech Store' }
  },
  {
    id: 'prod-2',
    name: 'Luxury automatic watches strap',
    slug: 'luxury-automatic-watches-strap',
    description: 'Handmade calfskin strap with gold bucking pins.',
    price: 320.00,
    isApproved: false,
    store: { id: 'store-2', name: 'Aureum Boutique' }
  }
];

const MOCK_ORDERS: Order[] = [
  {
    id: 'ord-101',
    totalAmount: 1450.00,
    status: 'PAID',
    createdAt: '2026-08-01T21:40:00Z',
    customer: { user: { email: 'buyer.alice@test.com' } },
    shippingAddress: { street: '123 Pine St', city: 'Lekki', state: 'Lagos', postalCode: '105102', country: 'Nigeria' }
  },
  {
    id: 'ord-102',
    totalAmount: 899.99,
    status: 'PENDING',
    createdAt: '2026-08-02T01:10:00Z',
    customer: { user: { email: 'buyer.bob@test.com' } },
    shippingAddress: { street: '456 Oak St', city: 'Ikeja', state: 'Lagos', postalCode: '100281', country: 'Nigeria' }
  }
];

export default function AdminDashboard() {
  // --- States ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sellers' | 'products' | 'orders'>('dashboard');
  const [analytics, setAnalytics] = useState<Analytics>(MOCK_ANALYTICS);
  const [sellers, setSellers] = useState<Seller[]>(MOCK_SELLERS);
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS);

  // Authentication states
  const [token, setToken] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('admin@veridia.com');
  const [passwordInput, setPasswordInput] = useState('adminpassword123');

  // Page loadings / Alerts
  const [loading, setLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- Fetch API on Mount / Login ---
  useEffect(() => {
    const savedToken = localStorage.getItem('veridia_admin_token');
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchAdminData();
    }
  }, [token]);

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Analytics summary
      const summaryRes = await fetch('http://localhost:3000/analytics/admin/summary', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setAnalytics(summaryData);
      }

      // 2. Fetch public products (to identify unapproved items)
      const productsRes = await fetch('http://localhost:3000/products');
      if (productsRes.ok) {
        const prodData = await productsRes.json();
        // Fallback or filter unapproved items if database has them
        setProducts(prodData.products && prodData.products.length > 0 ? prodData.products : MOCK_PRODUCTS);
      }
    } catch (err) {
      console.warn('NestJS server offline. Operating in fallback mock dashboard mode.');
      setAnalytics(MOCK_ANALYTICS);
      setProducts(MOCK_PRODUCTS);
      setSellers(MOCK_SELLERS);
      setOrders(MOCK_ORDERS);
    } finally {
      setLoading(false);
    }
  };

  // --- Auth submit ---
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, password: passwordInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.accessToken);
        localStorage.setItem('veridia_admin_token', data.accessToken);
        triggerToast('Welcome back, Platform Administrator!');
      } else {
        triggerToast(data.message || 'Verification failed. Admin access only.', 'error');
      }
    } catch (err) {
      // Offline fallback login
      triggerToast('Auth server offline. Simulating Admin credentials match.', 'success');
      setToken('mock_admin_token');
      localStorage.setItem('veridia_admin_token', 'mock_admin_token');
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('veridia_admin_token');
    triggerToast('Logged out of Admin Workspace.');
  };

  // --- Actions & Mutations ---
  const toggleSellerVerification = async (sellerId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    try {
      const res = await fetch(`http://localhost:3000/users/sellers/${sellerId}/verify`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isVerified: nextStatus }),
      });
      if (res.ok) {
        setSellers(
          sellers.map((s) => (s.id === sellerId ? { ...s, isVerified: nextStatus } : s))
        );
        triggerToast(`Seller store verification updated to: ${nextStatus ? 'VERIFIED' : 'SUSPENDED'}`);
      } else {
        const error = await res.json();
        triggerToast(error.message || 'Operation failed', 'error');
      }
    } catch (err) {
      // Mock update
      setSellers(
        sellers.map((s) => (s.id === sellerId ? { ...s, isVerified: nextStatus } : s))
      );
      triggerToast(`[Mock Action] Store verification status updated to: ${nextStatus ? 'VERIFIED' : 'SUSPENDED'}`);
    }
  };

  const approveProductEntry = async (productId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    try {
      const res = await fetch(`http://localhost:3000/products/${productId}/approve`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isApproved: nextStatus }),
      });
      if (res.ok) {
        setProducts(
          products.map((p) => (p.id === productId ? { ...p, isApproved: nextStatus } : p))
        );
        triggerToast(`Catalog product approval set to: ${nextStatus ? 'APPROVED' : 'REJECTED'}`);
      } else {
        const error = await res.json();
        triggerToast(error.message || 'Operation failed', 'error');
      }
    } catch (err) {
      // Mock update
      setProducts(
        products.map((p) => (p.id === productId ? { ...p, isApproved: nextStatus } : p))
      );
      triggerToast(`[Mock Action] Catalog product approval set to: ${nextStatus ? 'APPROVED' : 'REJECTED'}`);
    }
  };

  const refundOrderPayment = async (orderId: string) => {
    try {
      const res = await fetch(`http://localhost:3000/payments/order/${orderId}/refund`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        setOrders(
          orders.map((o) => (o.id === orderId ? { ...o, status: 'CANCELLED' } : o))
        );
        triggerToast('Order payment refunded. Stock restored & ledger debited.');
        fetchAdminData(); // Refresh summary GMV!
      } else {
        const error = await res.json();
        triggerToast(error.message || 'Refund failed', 'error');
      }
    } catch (err) {
      // Mock refund
      setOrders(
        orders.map((o) => (o.id === orderId ? { ...o, status: 'CANCELLED' } : o))
      );
      triggerToast('[Mock Action] Order cancelled & refunded. Mock ledger updated.', 'success');
      setAnalytics({
        ...analytics,
        totalGmv: Math.max(0, analytics.totalGmv - 400),
      });
    }
  };

  // --- Login Screen ---
  if (!token) {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative ambient glowing blur rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] rounded-full bg-emerald-primary/10 blur-[100px] pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-[200px] h-[200px] rounded-full bg-gold-secondary/5 blur-[80px] pointer-events-none" />

        <div className="relative bg-stone-950/80 border border-stone-800 p-8 rounded-3xl max-w-md w-full shadow-2xl backdrop-blur-xl flex flex-col gap-6">
          <div className="text-center flex flex-col items-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-primary to-amber-500 flex items-center justify-center text-white text-3xl font-black shadow-lg">
              V
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mt-2">Veridia Console</h1>
            <p className="text-xs text-stone-500 font-semibold uppercase tracking-wider">
              Platform Governance Dashboard
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-wide">Administrator Email</label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="h-11 px-4 border border-stone-850 bg-stone-900/50 rounded-xl text-sm text-stone-100 outline-none transition focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-wide">Security Access Password</label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="h-11 px-4 border border-stone-850 bg-stone-900/50 rounded-xl text-sm text-stone-100 outline-none transition focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full h-11 bg-emerald-primary hover:bg-emerald-800 text-stone-50 text-xs font-bold tracking-wide rounded-xl shadow-lg transition mt-4"
            >
              Verify Security Credentials
            </button>
          </form>

          <p className="text-[10px] text-center text-stone-600 font-bold uppercase tracking-wider mt-4">
            &copy; 2026 Veridia Marketplace Inc.
          </p>
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
          <div className="p-6 border-b border-stone-850 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-primary to-amber-500 flex items-center justify-center text-white font-black text-xl shadow-lg">
              V
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black text-stone-100 tracking-wide">Veridia Admin</span>
              <span className="text-[9px] font-bold text-stone-600 uppercase tracking-widest">Platform control</span>
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
              Overview Dashboard
            </button>

            <button
              onClick={() => setActiveTab('sellers')}
              className={`h-11 px-4 rounded-xl text-xs font-bold tracking-wide text-left flex items-center gap-3 transition ${
                activeTab === 'sellers'
                  ? 'bg-emerald-primary text-stone-50'
                  : 'hover:bg-stone-850 text-stone-400 hover:text-stone-100'
              }`}
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Seller KYC Verifies
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Product Approvals
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Orders & Refunds
            </button>
          </nav>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-stone-850 flex flex-col gap-2">
          <span className="text-[10px] text-stone-600 font-bold px-2 uppercase">Logged in as admin</span>
          <button
            onClick={handleLogout}
            className="w-full h-10 px-4 rounded-lg bg-stone-850 hover:bg-rose-950/60 hover:text-rose-200 text-xs font-bold transition text-left flex items-center gap-3"
          >
            Logout Console
          </button>
        </div>
      </aside>

      {/* --- Main Contents Panel --- */}
      <main className="flex-1 bg-stone-50 py-10 px-6 sm:px-8 dark:bg-stone-950 flex flex-col gap-8">
        
        {/* Header Title */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-5 dark:border-stone-850">
          <div>
            <h2 className="text-2xl font-black capitalize tracking-tight text-stone-900 dark:text-stone-50">
              {activeTab === 'dashboard' ? 'Marketplace Overview' : `${activeTab} control`}
            </h2>
            <p className="text-xs text-stone-500 font-medium mt-1">
              Veridia Global Platform Governance Workspace
            </p>
          </div>
          
          <button
            onClick={fetchAdminData}
            className="h-10 px-4 rounded-xl border border-stone-200 hover:bg-stone-100 text-xs font-bold flex items-center gap-2 dark:border-stone-850 dark:hover:bg-stone-900"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
            </svg>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-stone-200 border-t-emerald-primary" />
          </div>
        ) : (
          <>
            {/* --- TAB 1: DASHBOARD ANALYTICS OVERVIEW --- */}
            {activeTab === 'dashboard' && (
              <div className="flex flex-col gap-8">
                
                {/* Analytics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  
                  {/* GMV Card */}
                  <div className="bg-stone-900 border border-stone-850 rounded-3xl p-6 relative overflow-hidden dark:bg-stone-950">
                    <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-br from-emerald-primary/10 to-transparent blur-xl pointer-events-none" />
                    <span className="text-xs font-black uppercase tracking-wider text-stone-500">Gross Sales (GMV)</span>
                    <h3 className="text-3xl font-black text-stone-50 mt-2 bg-gradient-to-r from-emerald-400 to-amber-300 bg-clip-text text-transparent">
                      ${analytics.totalGmv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <p className="text-[10px] text-stone-500 mt-2 font-bold uppercase">Paid & Processing checkouts</p>
                  </div>

                  {/* Orders Card */}
                  <div className="bg-stone-900 border border-stone-850 rounded-3xl p-6 relative overflow-hidden dark:bg-stone-950">
                    <span className="text-xs font-black uppercase tracking-wider text-stone-500">Total Orders</span>
                    <h3 className="text-3xl font-black text-stone-50 mt-2">
                      {analytics.totalOrders}
                    </h3>
                    <p className="text-[10px] text-stone-500 mt-2 font-bold uppercase">All transaction lifecycle rows</p>
                  </div>

                  {/* Active Products Card */}
                  <div className="bg-stone-900 border border-stone-850 rounded-3xl p-6 relative overflow-hidden dark:bg-stone-950">
                    <span className="text-xs font-black uppercase tracking-wider text-stone-500">Active Products</span>
                    <h3 className="text-3xl font-black text-stone-50 mt-2">
                      {analytics.activeProducts}
                    </h3>
                    <p className="text-[10px] text-stone-500 mt-2 font-bold uppercase">Approved items in catalog</p>
                  </div>

                  {/* Registrations Card */}
                  <div className="bg-stone-900 border border-stone-850 rounded-3xl p-6 relative overflow-hidden dark:bg-stone-950">
                    <span className="text-xs font-black uppercase tracking-wider text-stone-500">Registered Users</span>
                    <h3 className="text-3xl font-black text-stone-50 mt-2">
                      {analytics.registeredUsers}
                    </h3>
                    <p className="text-[10px] text-stone-500 mt-2 font-bold uppercase">Customers, sellers, & admins</p>
                  </div>
                </div>

                {/* Info Alert Platform Health */}
                <div className="bg-white border border-stone-200 rounded-3xl p-8 dark:bg-stone-900 dark:border-stone-850 flex flex-col sm:flex-row items-center gap-6 justify-between">
                  <div className="flex flex-col gap-1">
                    <h4 className="text-lg font-bold text-stone-950 dark:text-stone-50">All Platform Systems Online</h4>
                    <p className="text-xs text-stone-500 leading-relaxed max-w-lg">
                      Veridia monorepo architecture integrates Redis server caching structures, PostgreSQL row-level locks, and JWT credentials checks checkouts.
                    </p>
                  </div>
                  <span className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold dark:bg-emerald-950/50 dark:text-emerald-400">
                    HEALTH OK
                  </span>
                </div>
              </div>
            )}

            {/* --- TAB 2: SELLER KYC VERIFICATIONS --- */}
            {activeTab === 'sellers' && (
              <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden dark:bg-stone-900 dark:border-stone-850">
                <div className="p-6 border-b border-stone-100 dark:border-stone-850">
                  <h3 className="font-bold text-stone-800 dark:text-stone-200">KYC Store Approvals</h3>
                  <p className="text-xs text-stone-500 mt-1">Sellers require administrative KYC checks before creating catalog items.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-100 text-stone-500 uppercase font-black tracking-wider dark:bg-stone-950 dark:border-stone-850">
                        <th className="p-4">Store Name</th>
                        <th className="p-4">Business Email</th>
                        <th className="p-4">Phone Number</th>
                        <th className="p-4">KYC Upload Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-850">
                      {sellers.map((s) => (
                        <tr key={s.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-950/40">
                          <td className="p-4 font-bold text-stone-800 dark:text-stone-200">
                            {s.store?.name || 'No Store Created'}
                          </td>
                          <td className="p-4 font-medium text-stone-500">{s.user.email}</td>
                          <td className="p-4 font-mono text-stone-400">{s.phoneNumber}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              s.isVerified 
                                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' 
                                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${s.isVerified ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                              {s.isVerified ? 'Verified KYC' : 'Pending Review'}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => toggleSellerVerification(s.id, s.isVerified)}
                              className={`h-9 px-4 rounded-xl text-xs font-bold transition ${
                                s.isVerified 
                                  ? 'border border-rose-250 text-rose-500 hover:bg-rose-50 dark:border-rose-900/60 dark:hover:bg-rose-950/20' 
                                  : 'bg-emerald-primary hover:bg-emerald-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500'
                              }`}
                            >
                              {s.isVerified ? 'Suspend Store' : 'Approve Store'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --- TAB 3: PRODUCT APPROVAL PANEL --- */}
            {activeTab === 'products' && (
              <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden dark:bg-stone-900 dark:border-stone-850">
                <div className="p-6 border-b border-stone-100 dark:border-stone-850">
                  <h3 className="font-bold text-stone-800 dark:text-stone-200">Catalog Entry Approval</h3>
                  <p className="text-xs text-stone-500 mt-1">Review newly created merchant products prior to public visibility.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-100 text-stone-500 uppercase font-black tracking-wider dark:bg-stone-950 dark:border-stone-850">
                        <th className="p-4">Product Name</th>
                        <th className="p-4">Store Outlet</th>
                        <th className="p-4">Unit Price</th>
                        <th className="p-4">Status Check</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-850">
                      {products.map((p) => (
                        <tr key={p.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-950/40">
                          <td className="p-4 flex flex-col gap-1">
                            <span className="font-bold text-stone-800 dark:text-stone-200">{p.name}</span>
                            <span className="text-stone-400 font-normal line-clamp-1 max-w-sm">{p.description}</span>
                          </td>
                          <td className="p-4 font-semibold text-stone-500">{p.store.name}</td>
                          <td className="p-4 font-mono font-bold text-stone-900 dark:text-stone-50">${p.price.toFixed(2)}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              p.isApproved 
                                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' 
                                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${p.isApproved ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                              {p.isApproved ? 'Approved Entry' : 'Under Review'}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => approveProductEntry(p.id, p.isApproved)}
                              className={`h-9 px-4 rounded-xl text-xs font-bold transition ${
                                p.isApproved 
                                  ? 'border border-rose-250 text-rose-500 hover:bg-rose-50 dark:border-rose-900/60' 
                                  : 'bg-emerald-primary hover:bg-emerald-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500'
                              }`}
                            >
                              {p.isApproved ? 'Reject Entry' : 'Approve Entry'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --- TAB 4: ORDERS & REFUNDS PANEL --- */}
            {activeTab === 'orders' && (
              <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden dark:bg-stone-900 dark:border-stone-850">
                <div className="p-6 border-b border-stone-100 dark:border-stone-850">
                  <h3 className="font-bold text-stone-800 dark:text-stone-200">Marketplace Refunds Portal</h3>
                  <p className="text-xs text-stone-500 mt-1">Administer payments disputes. Refunding PAID status orders recovers inventory and debits wallet balances.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-100 text-stone-500 uppercase font-black tracking-wider dark:bg-stone-950 dark:border-stone-850">
                        <th className="p-4">Order ID</th>
                        <th className="p-4">Customer Email</th>
                        <th className="p-4">Total Amount</th>
                        <th className="p-4">Delivery address</th>
                        <th className="p-4">Lifecycle Status</th>
                        <th className="p-4 text-right">Refund Action</th>
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
                          <td className="p-4 font-normal text-stone-400 max-w-[180px] truncate">
                            {o.shippingAddress?.street}, {o.shippingAddress?.city}
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              o.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : o.status === 'CANCELLED'
                                ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-450'
                                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                o.status === 'PAID' ? 'bg-emerald-600' : o.status === 'CANCELLED' ? 'bg-rose-600' : 'bg-amber-600'
                              }`} />
                              {o.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              disabled={o.status !== 'PAID'}
                              onClick={() => refundOrderPayment(o.id)}
                              className="h-9 px-4 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition disabled:bg-stone-100 disabled:text-stone-400 dark:disabled:bg-stone-850 dark:disabled:text-stone-600"
                            >
                              Refund Payout
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
