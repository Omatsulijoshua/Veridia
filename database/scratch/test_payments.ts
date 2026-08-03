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
  console.log('Starting Payment Gateway & Wallet Ledger integration tests...');

  // Setup separate admin in DB for permissions
  console.log('Seeding temporary Admin user in database...');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL environment variable is missing!');
  
  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const adminEmail = `admin_pay_${Date.now()}@veridia.com`;
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

  const customerEmail = `cust_pay_${Date.now()}@test.com`;
  const sellerEmail = `sell_pay_${Date.now()}@test.com`;
  const businessName = `Apex Pay Emporium ${Date.now()}`;
  const password = 'testpassword123';

  try {
    // 1. Sign up Customer and Seller
    console.log('\n--- 1. Registering Test Accounts ---');
    await fetch(`${baseUrl}/auth/signup/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: customerEmail,
        password,
        firstName: 'Paul',
        lastName: 'Purple',
        phoneNumber: '+1112223333',
      }),
    });
    console.log('✓ Registered Customer');

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
    const custLogin = await (await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customerEmail, password }),
    })).json();
    const customerToken = custLogin.accessToken;

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
        name: `Pay Category Parent ${Date.now()}`,
        description: 'Test parent category for payments',
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

    // Create Prod-Y (stock=5, price=150)
    const prodYRes = await (await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sellerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categoryId: parentCatRes.id,
        name: 'Product Y Widget',
        description: 'Standard product for payments check',
        price: 150.00,
        stock: 5,
      }),
    })).json();
    const prodYId = prodYRes.id;

    // Approve product
    await fetch(`${baseUrl}/products/${prodYId}/approve`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isApproved: true }),
    });
    console.log('✓ Product seeded, stock level: ProdY=5');

    // 4. Checkout Order
    console.log('\n--- 4. Checkout Cart Order ---');
    await fetch(`${baseUrl}/cart`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId: prodYId, quantity: 2 }),
    });
    
    const checkoutRes = await fetch(`${baseUrl}/orders/checkout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
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
    const orderId = orderData.id;
    console.log('✓ Order created successfully! ID:', orderId, 'Total:', orderData.totalAmount);

    // 5. Test Failed Payment charge
    console.log('\n--- 5. Testing Failed Payment Charges ---');
    const chargeFailRes = await fetch(`${baseUrl}/payments/charge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
        paymentMethodId: 'pm_card_fail',
      }),
    });
    const chargeFailData = await chargeFailRes.json();
    console.log('Failed payment charge status returned:', chargeFailData.payment?.status);
    console.log('Order status after failed charge:', chargeFailData.orderStatus);
    
    if (chargeFailData.payment?.status !== 'FAILED' || chargeFailData.orderStatus !== 'PENDING') {
      throw new Error('✗ Failed payment charges handling logic failed');
    }
    console.log('✓ Failed charge handled correctly!');

    // 6. Test Successful Payment charge
    console.log('\n--- 6. Testing Successful Payment Charges ---');
    const chargeSuccessRes = await fetch(`${baseUrl}/payments/charge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
        paymentMethodId: 'pm_card_success',
      }),
    });
    const chargeSuccessData = await chargeSuccessRes.json();
    console.log('Success payment charge status returned:', chargeSuccessData.payment?.status);
    console.log('Order status after success charge:', chargeSuccessData.orderStatus);

    if (chargeSuccessData.payment?.status !== 'SUCCESSFUL' || chargeSuccessData.orderStatus !== 'PAID') {
      throw new Error('✗ Success payment charges handling logic failed');
    }
    console.log('✓ Success charge processed successfully!');

    // A. Verify Seller Wallet is credited 300
    console.log('Verifying Seller Wallet balance...');
    const walletRes = await fetch(`${baseUrl}/wallets/ledger`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` },
    });
    const walletData = await walletRes.json();
    console.log('Seller Wallet balance returned:', walletData.balance);
    console.log('Seller Wallet transactions count:', walletData.transactions?.length);
    console.log('Seller Wallet first transaction type:', walletData.transactions?.[0]?.type);
    
    if (walletData.balance !== 300 || walletData.transactions?.length !== 1 || walletData.transactions[0].type !== 'CREDIT') {
      throw new Error('✗ Wallet crediting or ledger logs failed');
    }
    console.log('✓ Seller wallet correctly credited with CREDIT ledger entry!');

    // 7. Test Admin Order Refund
    console.log('\n--- 7. Testing Admin Refund Operations ---');
    const refundRes = await fetch(`${baseUrl}/payments/order/${orderId}/refund`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const refundData = await refundRes.json();
    console.log('Refund order status returned:', refundData.order?.status);
    
    if (refundRes.status !== 201 || refundData.order?.status !== 'CANCELLED') {
      throw new Error('✗ Admin refund operation failed');
    }

    // A. Verify stock is restored to 5
    const dbStockPostRefund = (await prisma.product.findUnique({ where: { id: prodYId }, select: { stock: true } }))?.stock;
    console.log('Product Y stock in DB post-refund:', dbStockPostRefund);
    if (dbStockPostRefund !== 5) throw new Error('Stock restoration failed');

    // B. Verify Seller Wallet balance is debited back to 0
    console.log('Verifying Seller Wallet balance post-refund...');
    const walletPostRefund = await (await fetch(`${baseUrl}/wallets/ledger`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` },
    })).json();
    console.log('Seller Wallet balance after refund:', walletPostRefund.balance);
    console.log('Seller Wallet transactions count after refund:', walletPostRefund.transactions?.length);
    console.log('Seller Wallet latest transaction type:', walletPostRefund.transactions?.[0]?.type);

    if (walletPostRefund.balance !== 0 || walletPostRefund.transactions?.length !== 2 || walletPostRefund.transactions[0].type !== 'DEBIT') {
      throw new Error('✗ Wallet debiting or ledger refund logs failed');
    }
    console.log('✓ Seller wallet correctly debited with DEBIT ledger entry!');

    console.log('\n========================================================================');
    console.log('✓ ALL PAYMENT GATEWAY & WALLET LEDGER INTEGRATION TESTS PASSED!');
    console.log('========================================================================');

    // Cleanup
    console.log('\nCleaning up database seeded test data...');
    // Delete orders first
    const cust = await prisma.customer.findFirst({ where: { user: { email: customerEmail } } });
    if (cust) {
      await prisma.order.deleteMany({ where: { customerId: cust.id } });
      // Delete wallet transactions and wallets
      const sell = await prisma.seller.findFirst({ where: { user: { email: sellerEmail } } });
      if (sell) {
        const wallet = await prisma.wallet.findUnique({ where: { sellerId: sell.id } });
        if (wallet) {
          await prisma.transaction.deleteMany({ where: { walletId: wallet.id } });
          await prisma.wallet.delete({ where: { id: wallet.id } });
        }
      }
    }

    await prisma.user.delete({ where: { email: adminEmail } });
    await prisma.user.delete({ where: { email: customerEmail } });
    await prisma.user.delete({ where: { email: sellerEmail } });
    await prisma.category.delete({ where: { id: parentCatRes.id } }); // cascades to products
    console.log('Cleanup complete!');

  } catch (error) {
    console.error('\nPayment tests failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runTests();
