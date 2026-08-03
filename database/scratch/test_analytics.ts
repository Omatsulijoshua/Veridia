import { config } from 'dotenv';
import { resolve } from 'path';
// Load environment variables from the workspace root .env
config({ path: resolve(__dirname, '../../.env') });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

async function runTests() {
  const baseUrl = 'http://localhost:3000';
  console.log('Starting Admin Analytics & Reporting integration tests...');

  // Setup separate admin in DB for permissions
  console.log('Seeding temporary Admin user in database...');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL environment variable is missing!');
  
  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const adminEmail = `admin_an_${Date.now()}@veridia.com`;
  const adminPassword = 'adminpassword123';
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });
  console.log('✓ Admin user seeded:', adminEmail);

  const customerEmail = `cust_an_${Date.now()}@test.com`;
  const sellerAEmail = `sell_a_an_${Date.now()}@test.com`;
  const sellerBEmail = `sell_b_an_${Date.now()}@test.com`;
  const password = 'testpassword123';

  try {
    // 1. Sign up Customers and Sellers
    console.log('\n--- 1. Registering Test Accounts ---');
    await fetch(`${baseUrl}/auth/signup/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: customerEmail,
        password,
        firstName: 'Alice',
        lastName: 'Alpha',
        phoneNumber: '+1112223333',
      }),
    });
    console.log('✓ Registered Customer');

    await fetch(`${baseUrl}/auth/signup/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: sellerAEmail,
        password,
        businessName: `Seller A Store ${Date.now()}`,
        phoneNumber: '+4445556666',
      }),
    });
    console.log('✓ Registered Seller A');

    await fetch(`${baseUrl}/auth/signup/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: sellerBEmail,
        password,
        businessName: `Seller B Store ${Date.now()}`,
        phoneNumber: '+5556667777',
      }),
    });
    console.log('✓ Registered Seller B');

    // 2. Log in all roles to capture tokens
    console.log('\n--- 2. Capturing Authorization Tokens ---');
    const custLogin = await (await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customerEmail, password }),
    })).json();
    const customerToken = custLogin.accessToken;

    const sellALogin = await (await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sellerAEmail, password }),
    })).json();
    const sellerAToken = sellALogin.accessToken;

    const sellBLogin = await (await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sellerBEmail, password }),
    })).json();
    const sellerBToken = sellBLogin.accessToken;

    const adminLogin = await (await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    })).json();
    const adminToken = adminLogin.accessToken;

    console.log('✓ Tokens loaded successfully!');

    // Capture baseline global admin summary metrics *before* seeding
    const baselineSummaryRes = await fetch(`${baseUrl}/analytics/admin/summary`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const baselineSummary = await baselineSummaryRes.json();
    console.log('\n--- Capture Baseline Metrics ---');
    console.log('Baseline GMV:', baselineSummary.totalGmv);
    console.log('Baseline Orders Count:', baselineSummary.totalOrders);
    console.log('Baseline Active Products Count:', baselineSummary.activeProducts);

    // 3. Setup Test Products and Categories
    console.log('\n--- 3. Setup Test Categories and Products ---');
    const parentCatRes = await (await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Analytics Parent Cat ${Date.now()}`,
        description: 'Test category for analytics',
      }),
    })).json();

    const profARes = await (await fetch(`${baseUrl}/users/seller/profile`, {
      headers: { 'Authorization': `Bearer ${sellerAToken}` },
    })).json();
    await fetch(`${baseUrl}/users/sellers/${profARes.id}/verify`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isVerified: true }),
    });

    const profBRes = await (await fetch(`${baseUrl}/users/seller/profile`, {
      headers: { 'Authorization': `Bearer ${sellerBToken}` },
    })).json();
    await fetch(`${baseUrl}/users/sellers/${profBRes.id}/verify`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isVerified: true }),
    });

    // Create Seller A: Prod-A1 (price 200, stock 10) and Prod-A2 (price 50, stock 10)
    const prodA1 = await (await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sellerAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categoryId: parentCatRes.id,
        name: 'Product A1 Widget',
        description: 'High value product from Seller A',
        price: 200.00,
        stock: 10,
      }),
    })).json();

    const prodA2 = await (await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sellerAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categoryId: parentCatRes.id,
        name: 'Product A2 Widget',
        description: 'Low value product from Seller A',
        price: 50.00,
        stock: 10,
      }),
    })).json();

    // Create Seller B: Prod-B1 (price 500, stock 5)
    const prodB1 = await (await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sellerBToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categoryId: parentCatRes.id,
        name: 'Product B1 Gadget',
        description: 'High value product from Seller B',
        price: 500.00,
        stock: 5,
      }),
    })).json();

    // Approve products
    await fetch(`${baseUrl}/products/${prodA1.id}/approve`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isApproved: true }),
    });
    await fetch(`${baseUrl}/products/${prodA2.id}/approve`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isApproved: true }),
    });
    await fetch(`${baseUrl}/products/${prodB1.id}/approve`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isApproved: true }),
    });
    console.log('✓ Products seeded and approved!');

    // 4. Place Orders & Payments to Generate Analytics Data
    console.log('\n--- 4. Placing Orders and Simulating Payments ---');
    
    // Order 1: Customer A buys Prod-A1 (qty 2) -> Total 400
    await fetch(`${baseUrl}/cart`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${customerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: prodA1.id, quantity: 2 }),
    });
    const order1 = await (await fetch(`${baseUrl}/orders/checkout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${customerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shippingAddress: { title: 'Office', street: '456 Sapphire Street', city: 'Lekki', state: 'Lagos', postalCode: '105102', country: 'Nigeria' },
      }),
    })).json();
    await fetch(`${baseUrl}/payments/charge`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${customerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order1.id, paymentMethodId: 'pm_card_success' }),
    });
    console.log('✓ Order 1 placed & paid: total = 400 (Seller A)');

    // Order 2: Customer A buys Prod-A2 (qty 3) -> Total 150
    await fetch(`${baseUrl}/cart`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${customerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: prodA2.id, quantity: 3 }),
    });
    const order2 = await (await fetch(`${baseUrl}/orders/checkout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${customerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shippingAddress: { title: 'Office', street: '456 Sapphire Street', city: 'Lekki', state: 'Lagos', postalCode: '105102', country: 'Nigeria' },
      }),
    })).json();
    await fetch(`${baseUrl}/payments/charge`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${customerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order2.id, paymentMethodId: 'pm_card_success' }),
    });
    console.log('✓ Order 2 placed & paid: total = 150 (Seller A)');

    // Order 3: Customer A buys Prod-B1 (qty 1) -> Total 500
    await fetch(`${baseUrl}/cart`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${customerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: prodB1.id, quantity: 1 }),
    });
    const order3 = await (await fetch(`${baseUrl}/orders/checkout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${customerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shippingAddress: { title: 'Office', street: '456 Sapphire Street', city: 'Lekki', state: 'Lagos', postalCode: '105102', country: 'Nigeria' },
      }),
    })).json();
    await fetch(`${baseUrl}/payments/charge`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${customerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order3.id, paymentMethodId: 'pm_card_success' }),
    });
    console.log('✓ Order 3 placed & paid: total = 500 (Seller B)');

    // 5. Verify Admin Global Analytics Summary (Relative Diff Checks)
    console.log('\n--- 5. Testing Admin Global Analytics Summary ---');
    const adminSummaryRes = await fetch(`${baseUrl}/analytics/admin/summary`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const adminSummary = await adminSummaryRes.json();
    console.log('Admin Summary GMV (expected increase by 1050):', adminSummary.totalGmv);
    console.log('Admin Summary Total Orders (expected increase by 3):', adminSummary.totalOrders);
    console.log('Admin Summary Active Products (expected increase by 3):', adminSummary.activeProducts);

    const gmvIncrease = adminSummary.totalGmv - baselineSummary.totalGmv;
    const ordersIncrease = adminSummary.totalOrders - baselineSummary.totalOrders;
    const activeProductsIncrease = adminSummary.activeProducts - baselineSummary.activeProducts;

    console.log('Actual GMV Increase calculated:', gmvIncrease);
    console.log('Actual Orders Increase calculated:', ordersIncrease);
    console.log('Actual Active Products Increase calculated:', activeProductsIncrease);

    if (gmvIncrease !== 1050 || ordersIncrease !== 3 || activeProductsIncrease !== 3) {
      throw new Error('✗ Admin global summary aggregates calculation failed');
    }
    console.log('✓ Admin global summary relative increment verified!');

    // 6. Verify Seller Storefront Performance Analytics
    console.log('\n--- 6. Testing Seller Storefront Specific Telemetry ---');
    
    // Seller A summary (Seller A is newly created, so absolute checks apply!)
    const sellerASummaryRes = await fetch(`${baseUrl}/analytics/seller/summary`, {
      headers: { 'Authorization': `Bearer ${sellerAToken}` },
    });
    const sellerASummary = await sellerASummaryRes.json();
    console.log('Seller A Total Revenue (expected 550):', sellerASummary.totalRevenue);
    console.log('Seller A Total Orders (expected 2):', sellerASummary.totalOrders);
    console.log('Seller A Average Order Size (expected 275):', sellerASummary.averageOrderSize);
    console.log('Seller A Top Product Sold Widget:', sellerASummary.topProducts[0]?.name, 'sold:', sellerASummary.topProducts[0]?.quantitySold);
    
    if (sellerASummary.totalRevenue !== 550 || sellerASummary.totalOrders !== 2 || sellerASummary.averageOrderSize !== 275) {
      throw new Error('✗ Seller A summary analytics calculation failed');
    }
    if (sellerASummary.topProducts[0]?.name !== 'Product A2 Widget' || sellerASummary.topProducts[0]?.quantitySold !== 3) {
      throw new Error('✗ Seller A top products sorting/volume logic failed');
    }

    // Seller B summary
    const sellerBSummaryRes = await fetch(`${baseUrl}/analytics/seller/summary`, {
      headers: { 'Authorization': `Bearer ${sellerBToken}` },
    });
    const sellerBSummary = await sellerBSummaryRes.json();
    console.log('Seller B Total Revenue (expected 500):', sellerBSummary.totalRevenue);
    console.log('Seller B Total Orders (expected 1):', sellerBSummary.totalOrders);

    if (sellerBSummary.totalRevenue !== 500 || sellerBSummary.totalOrders !== 1) {
      throw new Error('✗ Seller B summary analytics calculation failed');
    }
    console.log('✓ Seller storefront telemetry metrics verified!');

    // 7. Verify Security Guards blocking unauthorized roles
    console.log('\n--- 7. Testing Role-Based Analytics Guards ---');
    
    // Customer attempting to view admin summary
    const custAdminRes = await fetch(`${baseUrl}/analytics/admin/summary`, {
      headers: { 'Authorization': `Bearer ${customerToken}` },
    });
    console.log('Customer fetch admin summary status:', custAdminRes.status);
    
    // Seller A attempting to view admin summary
    const sellAdminRes = await fetch(`${baseUrl}/analytics/admin/summary`, {
      headers: { 'Authorization': `Bearer ${sellerAToken}` },
    });
    console.log('Seller A fetch admin summary status:', sellAdminRes.status);

    if (custAdminRes.status !== 403 || sellAdminRes.status !== 403) {
      throw new Error('✗ Non-admins must be blocked with 403 Forbidden from accessing admin analytics');
    }
    console.log('✓ Success: Analytics endpoints securely guarded.');

    console.log('\n========================================================================');
    console.log('✓ ALL ADMIN ANALYTICS & REPORTING INTEGRATION TESTS PASSED!');
    console.log('========================================================================');

    // Cleanup
    console.log('\nCleaning up database seeded test data...');
    // Delete orders
    const cust = await prisma.customer.findFirst({ where: { user: { email: customerEmail } } });
    if (cust) {
      await prisma.order.deleteMany({ where: { customerId: cust.id } });
    }

    // Delete wallets
    const sellA = await prisma.seller.findFirst({ where: { user: { email: sellerAEmail } } });
    const sellB = await prisma.seller.findFirst({ where: { user: { email: sellerBEmail } } });
    if (sellA) {
      const walletA = await prisma.wallet.findUnique({ where: { sellerId: sellA.id } });
      if (walletA) {
        await prisma.transaction.deleteMany({ where: { walletId: walletA.id } });
        await prisma.wallet.delete({ where: { id: walletA.id } });
      }
    }
    if (sellB) {
      const walletB = await prisma.wallet.findUnique({ where: { sellerId: sellB.id } });
      if (walletB) {
        await prisma.transaction.deleteMany({ where: { walletId: walletB.id } });
        await prisma.wallet.delete({ where: { id: walletB.id } });
      }
    }

    // Delete notifications
    await prisma.notification.deleteMany({
      where: {
        user: { email: { in: [customerEmail, sellerAEmail, sellerBEmail] } },
      },
    });

    await prisma.user.delete({ where: { email: adminEmail } });
    await prisma.user.delete({ where: { email: customerEmail } });
    await prisma.user.delete({ where: { email: sellerAEmail } });
    await prisma.user.delete({ where: { email: sellerBEmail } });
    await prisma.category.delete({ where: { id: parentCatRes.id } }); // cascades to products
    console.log('Cleanup complete!');

  } catch (error) {
    console.error('\nAnalytics tests failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runTests();
