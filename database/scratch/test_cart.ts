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
  console.log('Starting Shopping Cart System integration tests...');

  // Setup separate admin in DB for permissions
  console.log('Seeding temporary Admin user in database...');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL environment variable is missing!');
  
  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const adminEmail = `admin_cart_${Date.now()}@veridia.com`;
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

  const customerEmail = `cust_cart_${Date.now()}@test.com`;
  const sellerEmail = `sell_cart_${Date.now()}@test.com`;
  const businessName = `Apex Cart Emporium ${Date.now()}`;
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
        firstName: 'Alice',
        lastName: 'White',
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
        name: `Cart Category Parent ${Date.now()}`,
        description: 'Test parent category for cart',
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

    // Create Prod-A (stock=5, price=990, compareAtPrice=1200)
    const prodARes = await (await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sellerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categoryId: parentCatRes.id,
        name: 'Product A Premium',
        description: 'High end product',
        price: 990.00,
        compareAtPrice: 1200.00,
        stock: 5,
      }),
    })).json();
    const prodAId = prodARes.id;

    // Create Prod-B (stock=2, price=500)
    const prodBRes = await (await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sellerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categoryId: parentCatRes.id,
        name: 'Product B Standard',
        description: 'Budget product',
        price: 500.00,
        stock: 2,
      }),
    })).json();
    const prodBId = prodBRes.id;

    // Approve both products
    await fetch(`${baseUrl}/products/${prodAId}/approve`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isApproved: true }),
    });
    await fetch(`${baseUrl}/products/${prodBId}/approve`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isApproved: true }),
    });
    console.log('✓ Products seeded, stock levels: ProdA=5, ProdB=2');

    // 4. Test Add to Cart & Stock Check
    console.log('\n--- 4. Testing Add to Cart & Pricing Totals ---');
    
    // A. Add Prod-A (qty=2)
    const cartRes = await fetch(`${baseUrl}/cart`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId: prodAId, quantity: 2 }),
    });
    const cartData = await cartRes.json();
    console.log('Cart subtotal returned:', cartData.subtotal);
    console.log('Cart discountTotal returned:', cartData.discountTotal);
    
    // Validate pricing calculation (subtotal = 990 * 2 = 1980, discount = (1200 - 990) * 2 = 420)
    if (cartData.subtotal !== 1980 || cartData.discountTotal !== 420) {
      throw new Error('✗ Cart subtotal/discount calculations are incorrect');
    }
    console.log('✓ Pricing totals verified!');

    // B. Add Prod-A (qty=4) -> total qty becomes 6 -> exceeds stock 5 -> should fail
    console.log('Testing stock limit rejection on addition...');
    const cartOverStock = await fetch(`${baseUrl}/cart`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId: prodAId, quantity: 4 }),
    });
    console.log('Rejection HTTP status returned:', cartOverStock.status);
    if (cartOverStock.status !== 400) {
      throw new Error('✗ Product addition exceeding stock should return 400 Bad Request');
    }
    console.log('✓ Success: Access correctly blocked for over-stock addition.');

    // 5. Test Cart Item Updates
    console.log('\n--- 5. Testing Cart Item Quantity Updates ---');
    const itemId = cartData.items[0].id;
    
    // A. Update qty to 5 -> should succeed
    const updateRes = await fetch(`${baseUrl}/cart/items/${itemId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ quantity: 5 }),
    });
    const updateData = await updateRes.json();
    console.log('Updated item qty returned:', updateData.items[0].quantity);
    if (updateData.items[0].quantity !== 5) throw new Error('Qty update failed');

    // B. Update qty to 6 -> exceeds stock 5 -> should fail
    console.log('Testing stock limit rejection on update...');
    const updateOverStock = await fetch(`${baseUrl}/cart/items/${itemId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ quantity: 6 }),
    });
    console.log('Rejection HTTP status returned (update):', updateOverStock.status);
    if (updateOverStock.status !== 400) {
      throw new Error('✗ Product update exceeding stock should return 400 Bad Request');
    }
    console.log('✓ Success: Access correctly blocked for over-stock update.');

    // 6. Test Guest Cart Merge
    console.log('\n--- 6. Testing Guest Cart Merge ---');
    // Guest cart contains Prod-A (qty=2) and Prod-B (qty=5)
    // Customer cart has Prod-A (qty=5). Prod-B is not in customer cart.
    // Merge:
    // - Prod-A: guest 2 + existing 5 = 7. Capped at stock = 5.
    // - Prod-B: guest 5 + existing 0 = 5. Capped at stock = 2.
    const mergeRes = await fetch(`${baseUrl}/cart/merge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          { productId: prodAId, quantity: 2 },
          { productId: prodBId, quantity: 5 },
        ],
      }),
    });
    const mergeData = await mergeRes.json();
    console.log('Merged cart items count:', mergeData.items.length);
    
    const mergedA = mergeData.items.find((item: any) => item.productId === prodAId);
    const mergedB = mergeData.items.find((item: any) => item.productId === prodBId);
    
    console.log('Prod-A merged qty:', mergedA?.quantity);
    console.log('Prod-B merged qty:', mergedB?.quantity);
    
    if (mergedA?.quantity !== 5 || mergedB?.quantity !== 2) {
      throw new Error('✗ Guest cart merge capping logic failed');
    }
    console.log('✓ Success: Guest cart merge capping calculations verified!');

    // 7. Cart Item Deletion
    console.log('\n--- 7. Testing Cart Item Deletion ---');
    const itemAId = mergedA.id;
    const deleteRes = await fetch(`${baseUrl}/cart/items/${itemAId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${customerToken}` },
    });
    const deleteData = await deleteRes.json();
    console.log('Cart items count after deletion:', deleteData.items.length);
    console.log('Cart subtotal after deleting Prod-A (only Prod-B left, 500 * 2 = 1000):', deleteData.subtotal);
    
    if (deleteData.items.length !== 1 || deleteData.items[0].productId !== prodBId || deleteData.subtotal !== 1000) {
      throw new Error('✗ Cart item deletion failed');
    }
    console.log('✓ Success: Cart item deletion and subtotal adjustments verified!');

    console.log('\n========================================================================');
    console.log('✓ ALL SHOPPING CART SYSTEM INTEGRATION TESTS PASSED!');
    console.log('========================================================================');

    // Cleanup
    console.log('\nCleaning up database seeded test data...');
    await prisma.user.delete({ where: { email: adminEmail } });
    await prisma.user.delete({ where: { email: customerEmail } });
    await prisma.user.delete({ where: { email: sellerEmail } });
    await prisma.category.delete({ where: { id: parentCatRes.id } }); // cascades to delete products & carts
    console.log('Cleanup complete!');

  } catch (error) {
    console.error('\nCart tests failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runTests();
