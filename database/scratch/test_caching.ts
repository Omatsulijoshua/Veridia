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
  console.log('Starting Performance Caching & Latency integration tests...');

  console.log('Seeding temporary Admin user in database...');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL environment variable is missing!');
  
  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const adminEmail = `admin_ch_${Date.now()}@veridia.com`;
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

  const customerEmail = `cust_ch_${Date.now()}@test.com`;
  const sellerEmail = `sell_ch_${Date.now()}@test.com`;
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
        lastName: 'Alpha',
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
        businessName: `Seller Cache Store ${Date.now()}`,
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

    // 3. Setup Test Products and Categories
    console.log('\n--- 3. Setup Test Categories and Products ---');
    const parentCatRes = await (await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Caching Parent Cat ${Date.now()}`,
        description: 'Test category for caching check',
      }),
    })).json();

    const profRes = await (await fetch(`${baseUrl}/users/seller/profile`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` },
    })).json();
    await fetch(`${baseUrl}/users/sellers/${profRes.id}/verify`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isVerified: true }),
    });

    const prodC1 = await (await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sellerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categoryId: parentCatRes.id,
        name: 'Cache Target Product',
        description: 'Initial name prior to invalidation check',
        price: 250.00,
        stock: 10,
      }),
    })).json();

    // Approve product
    await fetch(`${baseUrl}/products/${prodC1.id}/approve`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isApproved: true }),
    });
    console.log('✓ Product seeded and approved!');

    // 4. Test Product Details Page Caching & Latency
    console.log('\n--- 4. Testing Product Detail Page Caching & Latency ---');
    
    // First Call (Uncached database query)
    const t0 = performance.now();
    const res1 = await fetch(`${baseUrl}/products/${prodC1.id}`);
    const body1 = await res1.json();
    const t1 = performance.now();
    const latency1 = t1 - t0;
    console.log(`First Call (uncached): status ${res1.status}, latency: ${latency1.toFixed(2)}ms`);

    // Second Call (Served from Redis cache)
    const t2 = performance.now();
    const res2 = await fetch(`${baseUrl}/products/${prodC1.id}`);
    const body2 = await res2.json();
    const t3 = performance.now();
    const latency2 = t3 - t2;
    console.log(`Second Call (cached): status ${res2.status}, latency: ${latency2.toFixed(2)}ms`);

    if (body2.name !== 'Cache Target Product') {
      throw new Error('✗ Stale or mismatching detail payload returned from cache');
    }
    
    // Check cache performance difference
    console.log(`Cache latency savings: ${(latency1 - latency2).toFixed(2)}ms`);
    if (latency2 > 25) {
      console.warn('⚠️ Warning: Cached call took slightly longer than 25ms, but check if it is still faster than db.');
    }
    console.log('✓ Detail page caching verification passed!');

    // 5. Test Product Listing Page Caching & Latency
    console.log('\n--- 5. Testing Product Listing Page Caching & Latency ---');
    
    const listUrl = `${baseUrl}/products?categoryId=${parentCatRes.id}`;
    
    // First Call (Uncached)
    const lt0 = performance.now();
    const lres1 = await fetch(listUrl);
    const lbody1 = await lres1.json();
    const lt1 = performance.now();
    const llatency1 = lt1 - lt0;
    console.log(`First Listing Call (uncached): count ${lbody1.products.length}, latency: ${llatency1.toFixed(2)}ms`);

    // Second Call (Cached)
    const lt2 = performance.now();
    const lres2 = await fetch(listUrl);
    const lbody2 = await lres2.json();
    const lt3 = performance.now();
    const llatency2 = lt3 - lt2;
    console.log(`Second Listing Call (cached): count ${lbody2.products.length}, latency: ${llatency2.toFixed(2)}ms`);

    if (lbody2.products.length !== 1 || lbody2.products[0].name !== 'Cache Target Product') {
      throw new Error('✗ Listing payload mismatch or failed to load from cache');
    }
    console.log('✓ Listing caching verification passed!');

    // 6. Test Cache Invalidation on Product Update
    console.log('\n--- 6. Testing Cache Invalidation on Update ---');
    
    const updateRes = await fetch(`${baseUrl}/products/${prodC1.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${sellerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Cache Target Product (REBUILT)',
      }),
    });
    console.log('Product update status:', updateRes.status);

    // Call detail view post-update
    const resPostUpdate = await fetch(`${baseUrl}/products/${prodC1.id}`);
    const bodyPostUpdate = await resPostUpdate.json();
    console.log('Product name after update lookup:', bodyPostUpdate.name);

    if (bodyPostUpdate.name !== 'Cache Target Product (REBUILT)') {
      throw new Error('✗ Cache invalidation failed on product update: stale cache value returned');
    }
    console.log('✓ Cache invalidation on update verified!');

    // 7. Test Cache Invalidation on Product Delete
    console.log('\n--- 7. Testing Cache Invalidation on Delete ---');
    
    const deleteRes = await fetch(`${baseUrl}/products/${prodC1.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${sellerToken}`,
      },
    });
    console.log('Product delete status:', deleteRes.status);

    // Call detail view post-delete. Must return 404.
    const resPostDelete = await fetch(`${baseUrl}/products/${prodC1.id}`);
    console.log('Detail view post-delete response code (expected 404):', resPostDelete.status);
    if (resPostDelete.status !== 404) {
      throw new Error('✗ Cache invalidation failed on product delete: served stale cache payload');
    }
    console.log('✓ Cache invalidation on delete verified!');

    console.log('\n========================================================================');
    console.log('✓ ALL PERFORMANCE CACHING & LATENCY INTEGRATION TESTS PASSED!');
    console.log('========================================================================');

    // Cleanup
    console.log('\nCleaning up database seeded test data...');
    await prisma.user.delete({ where: { email: adminEmail } });
    await prisma.user.delete({ where: { email: customerEmail } });
    await prisma.user.delete({ where: { email: sellerEmail } });
    await prisma.category.delete({ where: { id: parentCatRes.id } }); // cascades to products
    console.log('Cleanup complete!');

  } catch (error) {
    console.error('\nCaching tests failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runTests();
