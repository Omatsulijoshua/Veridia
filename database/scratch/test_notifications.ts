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
  console.log('Starting Notifications & Real-Time Messaging integration tests...');

  // Setup separate admin in DB for permissions
  console.log('Seeding temporary Admin user in database...');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL environment variable is missing!');
  
  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const adminEmail = `admin_not_${Date.now()}@veridia.com`;
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

  const customerAEmail = `cust_a_not_${Date.now()}@test.com`;
  const customerBEmail = `cust_b_not_${Date.now()}@test.com`;
  const sellerEmail = `sell_not_${Date.now()}@test.com`;
  const businessName = `Apex Notif Emporium ${Date.now()}`;
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
    const customerAUserId = custALogin.user.id;

    const custBLogin = await (await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customerBEmail, password }),
    })).json();
    const customerBToken = custBLogin.accessToken;
    const customerBUserId = custBLogin.user.id;

    const sellLogin = await (await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sellerEmail, password }),
    })).json();
    const sellerToken = sellLogin.accessToken;
    const sellerUserId = sellLogin.user.id;

    const adminLogin = await (await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    })).json();
    const adminToken = adminLogin.accessToken;

    console.log('✓ Tokens loaded successfully!');

    // 3. Setup Test Products and Categories
    console.log('\n--- 3. Setup Test Categories and Products ---');
    const parentCatRes = await (await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Notif Category Parent ${Date.now()}`,
        description: 'Test parent category for notifications',
      }),
    })).json();
    
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

    const prodZRes = await (await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sellerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categoryId: parentCatRes.id,
        name: 'Product Z Widget',
        description: 'Standard product for notifications check',
        price: 100.00,
        stock: 10,
      }),
    })).json();
    const prodZId = prodZRes.id;

    await fetch(`${baseUrl}/products/${prodZId}/approve`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isApproved: true }),
    });
    console.log('✓ Product seeded, stock level: ProdZ=10');

    // 4. Test Chat Messaging & Group Threads
    console.log('\n--- 4. Testing Chat Messaging & Thread Grouping ---');
    
    // A. Customer A sends message to Seller
    const msg1Res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        receiverId: sellerUserId,
        content: 'Hey, is Product Z in stock?',
      }),
    });
    console.log('Customer A to Seller message send status:', msg1Res.status);
    if (msg1Res.status !== 201) throw new Error('Message sending failed');

    // B. Seller replies to Customer A
    const msg2Res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sellerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        receiverId: customerAUserId,
        content: 'Yes Alice, we have 10 units left!',
      }),
    });
    console.log('Seller to Customer A message reply status:', msg2Res.status);
    if (msg2Res.status !== 201) throw new Error('Reply sending failed');

    // C. Get threads list for Customer A
    const threadsRes = await fetch(`${baseUrl}/messages/threads`, {
      headers: { 'Authorization': `Bearer ${customerAToken}` },
    });
    const threadsData = await threadsRes.json();
    console.log('Customer A threads count:', threadsData.length);
    console.log('Customer A latest thread last message:', threadsData[0]?.lastMessage?.content);
    console.log('Customer A latest thread contact email:', threadsData[0]?.contact?.email);
    
    if (threadsData.length !== 1 || threadsData[0]?.lastMessage?.content !== 'Yes Alice, we have 10 units left!') {
      throw new Error('✗ Thread grouping logic failed');
    }

    // D. Fetch thread transcript for Customer A
    const transcriptRes = await fetch(`${baseUrl}/messages/thread/${sellerUserId}`, {
      headers: { 'Authorization': `Bearer ${customerAToken}` },
    });
    const transcriptData = await transcriptRes.json();
    console.log('Alice <-> Seller transcript messages count:', transcriptData.length);
    if (transcriptData.length !== 2) throw new Error('Transcript count mismatch');

    // E. Verify Customer B (unauthorized) cannot read Alice <-> Seller chats
    const unauthorizedTranscriptRes = await fetch(`${baseUrl}/messages/thread/${sellerUserId}`, {
      headers: { 'Authorization': `Bearer ${customerBToken}` },
    });
    const unauthorizedTranscriptData = await unauthorizedTranscriptRes.json();
    console.log('Bob querying Alice <-> Seller transcript returned count:', unauthorizedTranscriptData.length);
    if (unauthorizedTranscriptData.length !== 0) {
      throw new Error('✗ Bob is able to query conversation messages he did not participate in');
    }
    console.log('✓ Success: Message queries securely scoped to participating user.');

    // 5. Test Event-Driven Notifications triggers
    console.log('\n--- 5. Testing Automated Notifications on Checkout, Payment, Shipping, and Cancel ---');
    
    // A. Add to cart & Checkout
    await fetch(`${baseUrl}/cart`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId: prodZId, quantity: 2 }),
    });

    const checkoutRes = await (await fetch(`${baseUrl}/orders/checkout`, {
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
    const orderId = checkoutRes.id;

    // Verify Checkout Notifications
    const custANotifsCheckout = await (await fetch(`${baseUrl}/notifications`, {
      headers: { 'Authorization': `Bearer ${customerAToken}` },
    })).json();
    const sellNotifsCheckout = await (await fetch(`${baseUrl}/notifications`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` },
    })).json();

    console.log('Customer A notifications count after checkout:', custANotifsCheckout.length);
    console.log('Customer A latest notification:', custANotifsCheckout[0]?.title, '-', custANotifsCheckout[0]?.body);
    console.log('Seller notifications count after checkout:', sellNotifsCheckout.length);
    console.log('Seller latest notification:', sellNotifsCheckout[0]?.title, '-', sellNotifsCheckout[0]?.body);

    if (custANotifsCheckout[0]?.title !== 'Order Created' || sellNotifsCheckout[0]?.title !== 'New Order Received') {
      throw new Error('✗ Order checkout notifications failed to trigger');
    }

    // B. Pay for Order successfully
    await fetch(`${baseUrl}/payments/charge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
        paymentMethodId: 'pm_card_success',
      }),
    });

    // Verify Payment Notifications
    const custANotifsPaid = await (await fetch(`${baseUrl}/notifications`, {
      headers: { 'Authorization': `Bearer ${customerAToken}` },
    })).json();
    const sellNotifsPaid = await (await fetch(`${baseUrl}/notifications`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` },
    })).json();

    console.log('Customer A latest notification after payment:', custANotifsPaid[0]?.title);
    console.log('Seller latest notification after payment:', sellNotifsPaid[0]?.title);

    if (custANotifsPaid[0]?.title !== 'Order Payment Successful' || sellNotifsPaid[0]?.title !== 'Order Paid') {
      throw new Error('✗ Payment notifications failed to trigger');
    }

    // C. Admin ships the order
    await fetch(`${baseUrl}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'SHIPPED' }),
    });

    // Verify Shipping Notification
    const custANotifsShipped = await (await fetch(`${baseUrl}/notifications`, {
      headers: { 'Authorization': `Bearer ${customerAToken}` },
    })).json();
    console.log('Customer A latest notification after ship:', custANotifsShipped[0]?.title);
    if (custANotifsShipped[0]?.title !== 'Order Shipped') {
      throw new Error('✗ Shipping notification failed to trigger');
    }

    // D. Admin cancels the order
    await fetch(`${baseUrl}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });

    // Verify Cancel Notifications
    const custANotifsCancel = await (await fetch(`${baseUrl}/notifications`, {
      headers: { 'Authorization': `Bearer ${customerAToken}` },
    })).json();
    const sellNotifsCancel = await (await fetch(`${baseUrl}/notifications`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` },
    })).json();

    console.log('Customer A latest notification after cancel:', custANotifsCancel[0]?.title);
    console.log('Seller latest notification after cancel:', sellNotifsCancel[0]?.title);

    if (custANotifsCancel[0]?.title !== 'Order Cancelled' || sellNotifsCancel[0]?.title !== 'Order Cancelled') {
      throw new Error('✗ Cancellation notifications failed to trigger');
    }

    console.log('✓ Success: Automated alerts trigger successfully on all order lifecycle milestones!');

    // 6. Test Read Status modifications
    console.log('\n--- 6. Testing Notifications Read status triggers ---');
    
    // List A's notifications. Assert they are not read.
    const notifsToRead = await (await fetch(`${baseUrl}/notifications`, {
      headers: { 'Authorization': `Bearer ${customerAToken}` },
    })).json();
    const targetNotifId = notifsToRead[0].id;
    console.log('Notification before read check: id =', targetNotifId, 'isRead =', notifsToRead[0].isRead);

    // Read single notification
    const readSingleRes = await fetch(`${baseUrl}/notifications/${targetNotifId}/read`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${customerAToken}` },
    });
    const readSingleData = await readSingleRes.json();
    console.log('Notification read patch returned isRead:', readSingleData.isRead);
    if (readSingleRes.status !== 200 || readSingleData.isRead !== true) {
      throw new Error('✗ Marking notification as read failed');
    }

    // Read all notifications
    const readAllRes = await fetch(`${baseUrl}/notifications/read-all`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${customerAToken}` },
    });
    const readAllData = await readAllRes.json();
    console.log('Mark all read returned success flag:', readAllData.success);

    const verifiedAllReadList = await (await fetch(`${baseUrl}/notifications`, {
      headers: { 'Authorization': `Bearer ${customerAToken}` },
    })).json();
    const unreadCount = verifiedAllReadList.filter((n: any) => !n.isRead).length;
    console.log('Count of unread notifications remaining:', unreadCount);
    if (unreadCount !== 0) {
      throw new Error('✗ Mark all read failed to read all messages');
    }
    console.log('✓ Success: All notifications correctly set to read status.');

    console.log('\n========================================================================');
    console.log('✓ ALL NOTIFICATIONS & REAL-TIME MESSAGING INTEGRATION TESTS PASSED!');
    console.log('========================================================================');

    // Cleanup
    console.log('\nCleaning up database seeded test data...');
    // Delete messages
    await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: customerAUserId },
          { receiverId: customerAUserId },
          { senderId: customerBUserId },
          { receiverId: customerBUserId },
        ],
      },
    });

    // Delete notifications
    await prisma.notification.deleteMany({
      where: {
        userId: { in: [customerAUserId, customerBUserId, sellerUserId] },
      },
    });

    // Delete orders
    const cust = await prisma.customer.findFirst({ where: { user: { email: customerAEmail } } });
    if (cust) {
      await prisma.order.deleteMany({ where: { customerId: cust.id } });
    }

    // Delete wallets
    const sell = await prisma.seller.findFirst({ where: { user: { email: sellerEmail } } });
    if (sell) {
      const wallet = await prisma.wallet.findUnique({ where: { sellerId: sell.id } });
      if (wallet) {
        await prisma.transaction.deleteMany({ where: { walletId: wallet.id } });
        await prisma.wallet.delete({ where: { id: wallet.id } });
      }
    }

    await prisma.user.delete({ where: { email: adminEmail } });
    await prisma.user.delete({ where: { email: customerAEmail } });
    await prisma.user.delete({ where: { email: customerBEmail } });
    await prisma.user.delete({ where: { email: sellerEmail } });
    await prisma.category.delete({ where: { id: parentCatRes.id } }); // cascades to products
    console.log('Cleanup complete!');

  } catch (error) {
    console.error('\nNotification tests failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runTests();
