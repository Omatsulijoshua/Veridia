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
  console.log('Starting Checkout & Order Creation integration tests...');

  // Setup separate admin in DB for permissions
  console.log('Seeding temporary Admin user in database...');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL environment variable is missing!');
  
  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const adminEmail = `admin_ord_${Date.now()}@veridia.com`;
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

  const customerAEmail = `cust_a_ord_${Date.now()}@test.com`;
  const customerBEmail = `cust_b_ord_${Date.now()}@test.com`;
  const sellerEmail = `sell_ord_${Date.now()}@test.com`;
  const businessName = `Apex Order Emporium ${Date.now()}`;
  const password = 'testpassword123';

  try {
    // 1. Sign up Customers and Seller
    console.log('\n--- 1. Registering Test Accounts ---');
    await fetch(`${baseUrl}/auth/signup/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: customerAEmail,
        password,
        firstName: 'Alice',
        lastName: 'Alpha',
        phoneNumber: '+1112223333',
      }),
    });
    console.log('✓ Registered Customer A');

    await fetch(`${baseUrl}/auth/signup/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: customerBEmail,
        password,
        firstName: 'Bob',
        lastName: 'Beta',
        phoneNumber: '+2223334444',
      }),
    });
    console.log('✓ Registered Customer B');

    await fetch(`${baseUrl}/auth/signup/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: sellerEmail,
        password,
        businessName,
        phoneNumber: '+4445556666',
      }),
    });
    console.log('✓ Registered Seller');

    // 2. Log in all roles to capture tokens
    console.log('\n--- 2. Capturing Authorization Tokens ---');
    const custALogin = await (await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customerAEmail, password }),
    })).json();
    const customerAToken = custALogin.accessToken;

    const custBLogin = await (await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customerBEmail, password }),
    })).json();
    const customerBToken = custBLogin.accessToken;

    const sellLogin = await (await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sellerEmail, password }),
    })).json();
    const sellerToken = sellLogin.accessToken;

    const adminLogin = await (await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    })).json();
    const adminToken = adminLogin.accessToken;

    console.log('✓ Tokens loaded successfully!');

    // 3. Create products
    console.log('\n--- 3. Setup Test Categories and Products ---');
    
    // Create parent category
    const parentCatRes = await (await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Order Category Parent ${Date.now()}`,
        description: 'Test parent category for orders',
      }),
    })).json();
    
    // Verify seller store (via Admin API)
    const profileRes = await (await fetch(`${baseUrl}/users/seller/profile`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` },
    })).json();
    const sellerId = profileRes.id;

    await fetch(`${baseUrl}/users/sellers/${sellerId}/verify`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isVerified: true }),
    });

    // Create Prod-X (stock=5, price=100)
    const prodXRes = await (await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sellerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categoryId: parentCatRes.id,
        name: 'Product X Gadget',
        description: 'Standard product for orders check',
        price: 100.00,
        compareAtPrice: 150.00,
        stock: 5,
      }),
    })).json();
    const prodXId = prodXRes.id;

    // Approve product
    await fetch(`${baseUrl}/products/${prodXId}/approve`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isApproved: true }),
    });
    console.log('✓ Product seeded, stock level: ProdX=5');

    // 4. Test Checkout and Inventory Deductions
    console.log('\n--- 4. Testing Checkout & Inventory Deductions ---');
    
    // A. Customer A adds Prod-X (qty=3) to cart
    await fetch(`${baseUrl}/cart`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId: prodXId, quantity: 3 }),
    });
    console.log('✓ Added item to Customer A cart');

    // B. Customer A checkout
    const checkoutRes = await fetch(`${baseUrl}/orders/checkout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shippingAddress: {
          title: 'Home Address',
          street: '123 Pine Street',
          city: 'Lagos',
          state: 'Lagos',
          postalCode: '100001',
          country: 'Nigeria',
        },
      }),
    });
    const orderData = await checkoutRes.json();
    console.log('Checkout response status:', checkoutRes.status);
    console.log('Order status returned:', orderData.status);
    console.log('Order totalAmount calculated:', orderData.totalAmount);
    
    if (checkoutRes.status !== 201 || orderData.status !== 'PENDING' || Number(orderData.totalAmount) !== 300) {
      throw new Error('✗ Order checkout creation failed');
    }
    const orderId = orderData.id;
    console.log('✓ Order checkout successful!');

    // C. Verify Customer A cart is empty
    const getCartRes = await (await fetch(`${baseUrl}/cart`, {
      headers: { 'Authorization': `Bearer ${customerAToken}` },
    })).json();
    console.log('Customer A cart items count post-checkout:', getCartRes.items.length);
    if (getCartRes.items.length !== 0) throw new Error('Cart should be cleared after checkout');

    // D. Verify Prod-X stock is reduced to 2
    const checkProductDb = await prisma.product.findUnique({
      where: { id: prodXId },
      select: { stock: true },
    });
    console.log('Product X stock remaining in DB:', checkProductDb?.stock);
    if (checkProductDb?.stock !== 2) throw new Error('Product stock should be reduced to 2');
    console.log('✓ Stock successfully decremented!');

    // 5. Test Order Details Ownership Guard
    console.log('\n--- 5. Testing Order Detail Ownership Security ---');
    
    // Customer B attempts to view Customer A's order details
    const viewOrderBRes = await fetch(`${baseUrl}/orders/${orderId}`, {
      headers: { 'Authorization': `Bearer ${customerBToken}` },
    });
    console.log('Customer B fetch status code:', viewOrderBRes.status);
    if (viewOrderBRes.status !== 403) {
      throw new Error('✗ Non-owners must be blocked with 403 Forbidden');
    }
    console.log('✓ Success: Access correctly denied (403 Forbidden) for non-owner customer.');

    // 6. Test Customer Cancellation & Inventory Restoration
    console.log('\n--- 6. Testing Customer Cancellations & Stock Restoration ---');
    
    // Customer A cancels the order
    const cancelRes = await fetch(`${baseUrl}/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${customerAToken}` },
    });
    const cancelData = await cancelRes.json();
    console.log('Cancelled order status returned:', cancelData.status);
    if (cancelRes.status !== 201 || cancelData.status !== 'CANCELLED') {
      throw new Error('✗ Order cancellation failed');
    }
    
    // Verify stock is restored back to 5
    const checkStockPostCancel = await prisma.product.findUnique({
      where: { id: prodXId },
      select: { stock: true },
    });
    console.log('Product X stock in DB after cancellation:', checkStockPostCancel?.stock);
    if (checkStockPostCancel?.stock !== 5) {
      throw new Error('Product stock should have been restored to 5');
    }
    console.log('✓ Success: Stock successfully restored on cancellation!');

    // 7. Test Admin Status Transitions
    console.log('\n--- 7. Testing Admin Status Updates & Stock Transitions ---');
    
    // Customer A adds item to cart again (qty=4) and checkouts
    await fetch(`${baseUrl}/cart`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId: prodXId, quantity: 4 }),
    });
    const secondCheckout = await (await fetch(`${baseUrl}/orders/checkout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shippingAddress: {
          title: 'Home Address',
          street: '123 Pine Street',
          city: 'Lagos',
          state: 'Lagos',
          postalCode: '100001',
          country: 'Nigeria',
        },
      }),
    })).json();
    const secondOrderId = secondCheckout.id;
    
    const dbStockPostCheckout = (await prisma.product.findUnique({ where: { id: prodXId }, select: { stock: true } }))?.stock;
    console.log('Product X stock after second checkout:', dbStockPostCheckout); // should be 1 (5 - 4 = 1)
    if (dbStockPostCheckout !== 1) throw new Error('Stock decrement failed');

    // A. Admin updates status to SHIPPED -> should succeed
    const shipRes = await fetch(`${baseUrl}/orders/${secondOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'SHIPPED' }),
    });
    const shipData = await shipRes.json();
    console.log('Admin update to SHIPPED status returned:', shipData.status);
    if (shipRes.status !== 200 || shipData.status !== 'SHIPPED') throw new Error('Admin update to SHIPPED failed');

    // B. Admin updates status of SHIPPED order to CANCELLED -> should succeed and restore stock to 5
    const adminCancelRes = await fetch(`${baseUrl}/orders/${secondOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    const adminCancelData = await adminCancelRes.json();
    console.log('Admin update to CANCELLED status returned:', adminCancelData.status);
    if (adminCancelRes.status !== 200 || adminCancelData.status !== 'CANCELLED') {
      throw new Error('Admin cancellation failed');
    }

    // Verify stock is restored to 5
    const dbStockPostAdminCancel = (await prisma.product.findUnique({ where: { id: prodXId }, select: { stock: true } }))?.stock;
    console.log('Product X stock after admin cancellation:', dbStockPostAdminCancel); // should be 5 (1 + 4 = 5)
    if (dbStockPostAdminCancel !== 5) throw new Error('Stock restoration failed');
    console.log('✓ Success: Admin order cancels and stock recoveries work correctly!');

    console.log('\n========================================================================');
    console.log('✓ ALL CHECKOUT & ORDER SYSTEM INTEGRATION TESTS PASSED!');
    console.log('========================================================================');

    // Cleanup
    console.log('\nCleaning up database seeded test data...');
    // Delete orders for Customer A and Customer B first to respect foreign key constraints
    const custA = await prisma.customer.findFirst({ where: { user: { email: customerAEmail } } });
    const custB = await prisma.customer.findFirst({ where: { user: { email: customerBEmail } } });
    if (custA) await prisma.order.deleteMany({ where: { customerId: custA.id } });
    if (custB) await prisma.order.deleteMany({ where: { customerId: custB.id } });

    await prisma.user.delete({ where: { email: adminEmail } });
    await prisma.user.delete({ where: { email: customerAEmail } });
    await prisma.user.delete({ where: { email: customerBEmail } });
    await prisma.user.delete({ where: { email: sellerEmail } });
    await prisma.category.delete({ where: { id: parentCatRes.id } }); // cascades to products
    console.log('Cleanup complete!');

  } catch (error) {
    console.error('\nOrder tests failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runTests();
