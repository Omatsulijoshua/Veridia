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
  console.log('Starting Shopping Experience, Reviews & Wishlist integration tests...');

  // Setup separate admin in DB for permissions
  console.log('Seeding temporary Admin user in database...');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL environment variable is missing!');
  
  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const adminEmail = `admin_shop_${Date.now()}@veridia.com`;
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

  const customerEmail = `cust_shop_${Date.now()}@test.com`;
  const sellerEmail = `sell_shop_${Date.now()}@test.com`;
  const businessName = `Apex Shop Emporium ${Date.now()}`;
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
        firstName: 'John',
        lastName: 'Doe',
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

    // 3. Create and verify a product
    console.log('\n--- 3. Setup Test Categories and Approved Product ---');
    
    // Create parent category
    const parentCatRes = await (await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Shop Category Parent ${Date.now()}`,
        description: 'Test parent category',
      }),
    })).json();
    
    // Verify seller store (via Admin API)
    const profileRes = await (await fetch(`${baseUrl}/users/seller/profile`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` },
    })).json();
    const sellerId = profileRes.id;
    const storeId = profileRes.store.id;

    await fetch(`${baseUrl}/users/sellers/${sellerId}/verify`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isVerified: true }),
    });

    // Create product
    const productRes = await (await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sellerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categoryId: parentCatRes.id,
        name: 'Super High Tech Laptop',
        description: 'Next Gen Processing Core Laptop',
        price: 1999.00,
        stock: 15,
      }),
    })).json();
    const productId = productRes.id;
    const productSlug = productRes.slug;

    // Approve product
    await fetch(`${baseUrl}/products/${productId}/approve`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isApproved: true }),
    });
    console.log('✓ Product created and approved successfully! ID:', productId);

    // 4. Test Customer Wishlist Endpoints
    console.log('\n--- 4. Testing Wishlist Operations ---');
    
    // A. Add product to wishlist
    const addWishRes = await fetch(`${baseUrl}/wishlist`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId }),
    });
    const addWishData = await addWishRes.json();
    console.log('✓ Added item to Wishlist! Product Name:', addWishData.product?.name);
    if (addWishData.productId !== productId) throw new Error('Wishlist product id mismatch');

    // B. Add duplicate product -> should be suppressed gracefully (returns 200 or 201)
    const addWishDupRes = await fetch(`${baseUrl}/wishlist`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId }),
    });
    console.log('Duplicate wishlist addition status:', addWishDupRes.status);
    if (addWishDupRes.status !== 201 && addWishDupRes.status !== 200) {
      throw new Error('✗ Duplicate wishlist additions should be gracefully handled');
    }
    console.log('✓ Success: Duplicate wishlist items handled gracefully!');

    // C. Retrieve Wishlist
    const getWishlistRes = await fetch(`${baseUrl}/wishlist`, {
      headers: { 'Authorization': `Bearer ${customerToken}` },
    });
    const wishlistItems = await getWishlistRes.json();
    console.log('Wishlist items count:', wishlistItems.length);
    if (wishlistItems.length !== 1) throw new Error('Wishlist count should be 1');
    console.log('✓ Wishlist retrieval verified!');

    // D. Delete from Wishlist
    const delWishRes = await fetch(`${baseUrl}/wishlist/${productId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${customerToken}` },
    });
    console.log('Wishlist item deletion status:', delWishRes.status);
    if (delWishRes.status !== 200) throw new Error('Deletion failed');
    
    const getWishlistAfterRes = await fetch(`${baseUrl}/wishlist`, {
      headers: { 'Authorization': `Bearer ${customerToken}` },
    });
    const wishlistAfter = await getWishlistAfterRes.json();
    console.log('Wishlist items after deletion:', wishlistAfter.length);
    if (wishlistAfter.length !== 0) throw new Error('Wishlist should be empty after deletion');
    console.log('✓ Wishlist item deletion verified!');

    // 5. Test Customer Reviews Endpoints
    console.log('\n--- 5. Testing Product Reviews ---');
    
    // A. Add Review
    const addReviewRes = await fetch(`${baseUrl}/reviews`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        rating: 5,
        comment: 'Absolutely spectacular hardware!',
      }),
    });
    const reviewData = await addReviewRes.json();
    console.log('✓ Submitted Review! Rating:', reviewData.rating, 'Comment:', reviewData.comment);
    if (reviewData.rating !== 5 || reviewData.comment !== 'Absolutely spectacular hardware!') {
      throw new Error('Review data mismatch');
    }

    // B. Add Duplicate Review -> should return 409 Conflict
    console.log('Testing duplicate review restriction...');
    const addReviewDupRes = await fetch(`${baseUrl}/reviews`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        rating: 4,
        comment: 'Nice laptop, second review',
      }),
    });
    console.log('Duplicate review submission HTTP status:', addReviewDupRes.status);
    if (addReviewDupRes.status !== 409) {
      throw new Error('✗ Duplicate product reviews from same customer must return 409 Conflict');
    }
    console.log('✓ Success: Duplicate reviews are correctly blocked (409 Conflict)!');

    // C. Get reviews list for product
    const getReviewsList = await (await fetch(`${baseUrl}/reviews/product/${productId}`)).json();
    console.log('Product reviews loaded publicly count:', getReviewsList.length);
    if (getReviewsList.length !== 1) throw new Error('Reviews count mismatch');
    console.log('✓ Public product reviews list verified!');

    // 6. Test Enhanced Product Detail Page
    console.log('\n--- 6. Testing Product Details Page aggregates ---');
    const detailsRes = await fetch(`${baseUrl}/products/${productSlug}`);
    const details = await detailsRes.json();
    
    console.log('Product slug queried:', details.slug);
    console.log('Product category:', details.category?.name);
    console.log('Product store:', details.store?.name);
    console.log('Product reviews count:', details.reviews?.length);
    console.log('Product average rating calculated:', details.averageRating);
    console.log('Product total reviews count calculated:', details.totalReviews);

    if (details.reviews?.length !== 1 || details.averageRating !== 5.0 || details.totalReviews !== 1) {
      throw new Error('✗ Product details reviews aggregate verification failed');
    }
    console.log('✓ Success: Product details aggregates load successfully!');

    console.log('\n========================================================================');
    console.log('✓ ALL SHOPPING EXPERIENCE, REVIEWS & WISHLIST TESTS PASSED!');
    console.log('========================================================================');

    // Cleanup
    console.log('\nCleaning up database seeded test data...');
    await prisma.user.delete({ where: { email: adminEmail } });
    await prisma.user.delete({ where: { email: customerEmail } });
    await prisma.user.delete({ where: { email: sellerEmail } });
    await prisma.category.delete({ where: { id: parentCatRes.id } }); // cascades to delete product
    console.log('Cleanup complete!');

  } catch (error) {
    console.error('\nShopping tests failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runTests();
