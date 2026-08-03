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
  console.log('Starting Product Catalog & Category Management integration tests...');

  // Setup separate admin in DB for permissions
  console.log('Seeding temporary Admin user in database...');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL environment variable is missing!');
  
  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const adminEmail = `admin_prod_${Date.now()}@veridia.com`;
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

  const customerEmail = `cust_prod_${Date.now()}@test.com`;
  const sellerEmail = `sell_prod_${Date.now()}@test.com`;
  const businessName = `Apex Mobile Emporium ${Date.now()}`;
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
        firstName: 'Bob',
        lastName: 'Blue',
        phoneNumber: '+1112223333',
      }),
    });
    console.log('✓ Registered Customer');

    const sellSignup = await fetch(`${baseUrl}/auth/signup/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: sellerEmail,
        password,
        businessName,
        phoneNumber: '+4445556666',
      }),
    });
    const sellSignupData = await sellSignup.json();
    if (sellSignup.status !== 201) throw new Error(`Seller registration failed: ${JSON.stringify(sellSignupData)}`);
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

    // 3. Category Tree Hierarchy Verification
    console.log('\n--- 3. Testing Category Hierarchy Trees ---');
    
    // A. Create parent category
    const createParentCat = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Electronics Group ${Date.now()}`,
        description: 'Electrical and digital products',
      }),
    });
    const parentCat = await createParentCat.json();
    console.log('✓ Created Parent Category:', parentCat.name, 'ID:', parentCat.id);

    // B. Create sub category
    const createChildCat = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Tablets ${Date.now()}`,
        description: 'Handheld touchscreen computers',
        parentId: parentCat.id,
      }),
    });
    const childCat = await createChildCat.json();
    console.log('✓ Created Child Category:', childCat.name, 'ParentID:', childCat.parentId);

    // C. Retrieve tree
    const getTree = await fetch(`${baseUrl}/categories`);
    const tree = await getTree.json();
    
    const treeParent = tree.find((cat: any) => cat.id === parentCat.id);
    console.log('Category Tree Parent:', treeParent?.name);
    console.log('Category Tree Child of Parent:', treeParent?.children?.[0]?.name);
    if (!treeParent || treeParent.children?.[0]?.id !== childCat.id) {
      throw new Error('✗ Category Tree structure verification failed');
    }
    console.log('✓ Category tree nested parent-child structure verified!');

    // 4. Product Creation Constraints
    console.log('\n--- 4. Testing Product Creation Constraints ---');
    
    // A. Unverified seller tries to create product -> rejected
    console.log('A. Testing product creation from unverified seller...');
    const createProdUnverified = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sellerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categoryId: childCat.id,
        name: 'iPad Pro 11-inch',
        description: 'Apple M4 Chip Tablet',
        price: 999.00,
        stock: 25,
      }),
    });
    console.log(`Status returned for unverified seller: ${createProdUnverified.status}`);
    if (createProdUnverified.status !== 400) {
      throw new Error('✗ Product creation should have been rejected for unverified seller store');
    }
    console.log('✓ Success: Access correctly blocked for unverified seller.');

    // B. Verify seller store (via Admin API)
    console.log('B. Admin verifying seller store...');
    const getProfileRes = await fetch(`${baseUrl}/users/seller/profile`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` },
    });
    const profileData = await getProfileRes.json();
    const sellerId = profileData.id;

    await fetch(`${baseUrl}/users/sellers/${sellerId}/verify`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isVerified: true }),
    });
    console.log('✓ Seller store KYC verified!');

    // C. Create product again -> should succeed
    console.log('C. Creating product with verified seller...');
    const createProdRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sellerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categoryId: childCat.id,
        name: 'iPad Pro 11-inch',
        description: 'Apple M4 Chip Tablet with OLED',
        price: 999.00,
        compareAtPrice: 1099.00,
        stock: 25,
        images: ['https://s3.veridia.com/ipadpro.jpg'],
        attributes: { color: 'Space Black', storage: '256GB' },
      }),
    });
    const productData = await createProdRes.json();
    if (createProdRes.status !== 201) {
      throw new Error(`Product creation failed: ${JSON.stringify(productData)}`);
    }
    console.log('✓ Product created successfully! Name:', productData.name, 'Slug:', productData.slug);
    console.log('Product approved status by default:', productData.isApproved);
    if (productData.isApproved !== false) {
      throw new Error('✗ Product isApproved should default to false');
    }
    const productId = productData.id;

    // 5. Verify Catalog Approvals & Public Visibility
    console.log('\n--- 5. Testing Catalog Approvals & Visibility ---');
    
    // A. Query products publicly -> list should be empty (since product is not approved)
    console.log('A. Querying public list for unapproved product...');
    const listPublicUnapproved = await (await fetch(`${baseUrl}/products`)).json();
    const unapprovedFound = listPublicUnapproved.products.find((p: any) => p.id === productId);
    if (unapprovedFound) {
      throw new Error('✗ Unapproved products must not be publicly visible!');
    }
    console.log('✓ Success: Unapproved product is hidden from public catalog.');

    // B. Approve the product (via Admin API)
    console.log('B. Admin approving the product...');
    const approveRes = await fetch(`${baseUrl}/products/${productId}/approve`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isApproved: true }),
    });
    const approveData = await approveRes.json();
    console.log('Approved status returned:', approveData.isApproved);
    if (!approveData.isApproved) {
      throw new Error('✗ Approve toggle failed');
    }
    console.log('✓ Product successfully approved!');

    // C. Query products publicly -> should find the product
    console.log('C. Querying public list for approved product...');
    const listPublicApproved = await (await fetch(`${baseUrl}/products`)).json();
    const approvedFound = listPublicApproved.products.find((p: any) => p.id === productId);
    if (!approvedFound) {
      throw new Error('✗ Approved product should be publicly visible!');
    }
    console.log('✓ Success: Approved product is visible in public catalog!');

    // 6. Filtering, Searching & Sorting Verification
    console.log('\n--- 6. Testing Searching, Filters & Sorting ---');
    
    // A. Search by text (iPad)
    const searchRes = await (await fetch(`${baseUrl}/products?search=iPad`)).json();
    console.log('Search matches found count:', searchRes.products.length);
    if (searchRes.products.length === 0) throw new Error('Search failed');

    // B. Filter by parent Category ID (recursive children match)
    console.log('Querying products under parent category Electronics Group...');
    const parentCatRes = await (await fetch(`${baseUrl}/products?categoryId=${parentCat.id}`)).json();
    const childProductFound = parentCatRes.products.find((p: any) => p.id === productId);
    if (!childProductFound) {
      throw new Error('✗ Child category items should be recursively returned for parent category searches');
    }
    console.log('✓ Success: Recursive category descendant inheritance works!');

    // C. Price Range Filter (minPrice=800, maxPrice=1200)
    console.log('Querying products in price range 800 - 1200...');
    const priceRes = await (await fetch(`${baseUrl}/products?minPrice=800&maxPrice=1200`)).json();
    if (priceRes.products.length === 0) throw new Error('Price range filter failed');
    
    // Verify that all returned products indeed fall in this range
    for (const p of priceRes.products) {
      const price = parseFloat(p.price);
      if (price < 800 || price > 1200) {
        throw new Error(`Product price ${price} is out of bounds!`);
      }
    }
    console.log('✓ Success: Price range filter works correctly!');

    // D. Sorting by price
    // Create a second product with price 1499.00 to verify sorting
    console.log('Creating second product for sorting checks...');
    const createSecondProduct = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sellerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categoryId: childCat.id,
        name: 'iPad Pro 13-inch',
        description: 'Apple M4 Chip Tablet with OLED large screen',
        price: 1499.00,
        stock: 10,
      }),
    });
    const secondProductData = await createSecondProduct.json();
    const secondProductId = secondProductData.id;

    // Approve the second product
    await fetch(`${baseUrl}/products/${secondProductId}/approve`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isApproved: true }),
    });

    console.log('Querying sorting by price ASC...');
    const sortAsc = await (await fetch(`${baseUrl}/products?sortBy=price&sortOrder=asc`)).json();
    // Verify sorting logic using relative matches in the sorted array
    const firstIdx = sortAsc.products.findIndex((p: any) => p.id === productId);
    const secondIdx = sortAsc.products.findIndex((p: any) => p.id === secondProductId);
    if (firstIdx !== -1 && secondIdx !== -1 && firstIdx > secondIdx) {
      throw new Error('✗ ASC sorting failed');
    }

    console.log('Querying sorting by price DESC...');
    const sortDesc = await (await fetch(`${baseUrl}/products?sortBy=price&sortOrder=desc`)).json();
    const firstIdxDesc = sortDesc.products.findIndex((p: any) => p.id === productId);
    const secondIdxDesc = sortDesc.products.findIndex((p: any) => p.id === secondProductId);
    if (firstIdxDesc !== -1 && secondIdxDesc !== -1 && firstIdxDesc < secondIdxDesc) {
      throw new Error('✗ DESC sorting failed');
    }
    console.log('✓ Success: Catalog filters and sorting order verified!');

    // 7. Inventory Deletion (Cleanup)
    console.log('\n--- 7. Testing Inventory Deletion ---');
    const deleteRes = await fetch(`${baseUrl}/products/${productId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${sellerToken}` },
    });
    console.log(`Product deletion HTTP response: ${deleteRes.status}`);
    if (deleteRes.status !== 200) {
      throw new Error('✗ Product deletion failed');
    }
    console.log('✓ Product successfully deleted by owner!');

    console.log('\n======================================================');
    console.log('✓ ALL PRODUCT CATALOG & CATEGORY TESTS PASSED!');
    console.log('======================================================');

    // Database Cleanup
    console.log('\nCleaning up database seeded test data...');
    await prisma.user.delete({ where: { email: adminEmail } });
    await prisma.user.delete({ where: { email: customerEmail } });
    await prisma.user.delete({ where: { email: sellerEmail } });
    await prisma.category.delete({ where: { id: parentCat.id } }); // will cascade and delete Tablets category
    console.log('Cleanup complete!');

  } catch (error) {
    console.error('\nProduct tests failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runTests();
