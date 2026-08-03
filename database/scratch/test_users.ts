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
  console.log('Starting User Profile & KYC management integration tests...');

  // Setup separate admin in DB for verification test
  console.log('Seeding temporary Admin user in database...');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL environment variable is missing!');
  
  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const adminEmail = `admin_${Date.now()}@veridia.com`;
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
  await prisma.$disconnect();
  await pool.end();

  const customerEmail = `cust_profile_${Date.now()}@test.com`;
  const sellerEmail = `sell_profile_${Date.now()}@test.com`;
  const password = 'testpassword123';

  try {
    // 1. Sign up Customer and Seller
    console.log('\n--- 1. Registering Test Accounts ---');
    const custSignup = await fetch(`${baseUrl}/auth/signup/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: customerEmail,
        password,
        firstName: 'Alex',
        lastName: 'Green',
        phoneNumber: '+1111111111',
      }),
    });
    if (custSignup.status !== 201) throw new Error(`Customer signup failed: ${custSignup.status}`);
    console.log('✓ Registered Customer');

    const sellSignup = await fetch(`${baseUrl}/auth/signup/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: sellerEmail,
        password,
        businessName: 'Green Tech Trading',
        phoneNumber: '+2222222222',
      }),
    });
    const sellSignupData = await sellSignup.json();
    if (sellSignup.status !== 201) throw new Error(`Seller signup failed: ${sellSignup.status}`);
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

    // 3. Customer Profile Retrieve & Update
    console.log('\n--- 3. Testing Customer Profile ---');
    const getCustProfile = await fetch(`${baseUrl}/users/customer/profile`, {
      headers: { 'Authorization': `Bearer ${customerToken}` },
    });
    const custData = await getCustProfile.json();
    console.log('Retrieved customer firstName:', custData.firstName);

    const updateCustProfile = await fetch(`${baseUrl}/users/customer/profile`, {
      method: 'PATCH',
      headers: { 
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName: 'Alexander',
        lastName: 'Emerald',
      }),
    });
    const updatedCustData = await updateCustProfile.json();
    console.log('Updated customer name to:', updatedCustData.firstName, updatedCustData.lastName);
    if (updatedCustData.firstName !== 'Alexander') {
      throw new Error('✗ Customer profile update failed to reflect in DB');
    }
    console.log('✓ Customer profile update verified!');

    // 4. Customer Address Book (JSON field) operations
    console.log('\n--- 4. Testing Customer Address Book (JSON Array Mutations) ---');
    // A. Add address
    const addAddress = await fetch(`${baseUrl}/users/customer/addresses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'HQ Office',
        street: '456 Sapphire Street',
        city: 'Lekki',
        state: 'Lagos',
        country: 'Nigeria',
        postalCode: '105102',
        isDefault: true,
      }),
    });
    const addAddressData = await addAddress.json();
    console.log('Added address list:', JSON.stringify(addAddressData.addresses));
    if (!addAddressData.addresses || addAddressData.addresses.length !== 1) {
      throw new Error('Address count should be 1');
    }
    const addressId = addAddressData.addresses[0].id;
    console.log('✓ Address added successfully! UUID:', addressId);

    // B. Update address
    const updateAddress = await fetch(`${baseUrl}/users/customer/addresses/${addressId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        street: '456 Sapphire Street (Penthouse Suite)',
      }),
    });
    const updateAddressData = await updateAddress.json();
    console.log('Updated address list:', JSON.stringify(updateAddressData.addresses));
    if (updateAddressData.addresses[0].street !== '456 Sapphire Street (Penthouse Suite)') {
      throw new Error('Address street was not updated');
    }
    console.log('✓ Address field update verified!');

    // C. Delete address
    const deleteAddress = await fetch(`${baseUrl}/users/customer/addresses/${addressId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${customerToken}` },
    });
    const deleteAddressData = await deleteAddress.json();
    console.log('Address list after deletion:', JSON.stringify(deleteAddressData.addresses));
    if (deleteAddressData.addresses.length !== 0) {
      throw new Error('Address was not deleted');
    }
    console.log('✓ Address deletion verified!');

    // 5. Seller Profile Retrieve & Update + KYC Mock Upload
    console.log('\n--- 5. Testing Seller Profile & KYC Image Upload ---');
    const getSellProfile = await fetch(`${baseUrl}/users/seller/profile`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` },
    });
    const sellData = await getSellProfile.json();
    console.log('Retrieved seller store name:', sellData.store?.name);

    // Mock upload file
    console.log('Simulating banner image upload...');
    const uploadRes = await fetch(`${baseUrl}/users/seller/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${sellerToken}` },
    });
    const uploadData = await uploadRes.json();
    console.log('Mocked S3 upload URL returned:', uploadData.url);

    // Update Profile and Store details
    const updateSeller = await fetch(`${baseUrl}/users/seller/profile`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${sellerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessName: 'Green Tech Group Ltd',
        storeName: 'Green Tech Mega Store',
        storeDescription: 'Sellers of high efficiency green devices',
        storeLogoUrl: uploadData.url,
      }),
    });
    const updatedSellerData = await updateSeller.json();
    console.log('Updated seller businessName:', updatedSellerData.businessName);
    console.log('Updated seller store name:', updatedSellerData.store.name);
    console.log('Updated seller store logoUrl:', updatedSellerData.store.logoUrl);
    if (updatedSellerData.store.name !== 'Green Tech Mega Store') {
      throw new Error('Seller profile / store name update failed to reflect in DB');
    }
    console.log('✓ Seller business name and store catalog details verified!');

    // 6. Admin Verification status check
    console.log('\n--- 6. Testing Seller Verification Toggles (KYC Status) ---');
    const sellerId = sellData.id;

    // A. Customer attempts to verify seller -> Forbidden 403
    console.log('Testing unauthorized customer request to verify seller...');
    const customerToggleVerify = await fetch(`${baseUrl}/users/sellers/${sellerId}/verify`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isVerified: true }),
    });
    console.log(`Status returned for unauthorized customer: ${customerToggleVerify.status}`);
    if (customerToggleVerify.status !== 403) {
      throw new Error('✗ Customer should have been blocked from seller verification toggle');
    }
    console.log('✓ Success: Access correctly denied (403 Forbidden) for customer.');

    // B. Admin verifies seller -> OK
    console.log('Testing admin request to verify seller...');
    const adminToggleVerify = await fetch(`${baseUrl}/users/sellers/${sellerId}/verify`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isVerified: true }),
    });
    const adminToggleData = await adminToggleVerify.json();
    console.log(`Status returned for admin: ${adminToggleVerify.status} - isVerified set to ${adminToggleData.isVerified}`);
    if (adminToggleVerify.status !== 200 || !adminToggleData.isVerified) {
      throw new Error('✗ Admin verification toggle failed');
    }
    console.log('✓ Success: Admin verification set to true in DB!');

    console.log('\n======================================================');
    console.log('✓ ALL USER PROFILE & KYC MANAGEMENT TESTS PASSED!');
    console.log('======================================================');

    // Cleanup temporary Admin user in DB
    console.log('\nCleaning up database seeded test data...');
    const cleanupPool = new Pool({ connectionString: dbUrl });
    const cleanupAdapter = new PrismaPg(cleanupPool);
    const cleanupPrisma = new PrismaClient({ adapter: cleanupAdapter });
    await cleanupPrisma.user.delete({ where: { email: adminEmail } });
    await cleanupPrisma.user.delete({ where: { email: customerEmail } });
    await cleanupPrisma.user.delete({ where: { email: sellerEmail } });
    console.log('Cleanup complete!');
    await cleanupPrisma.$disconnect();
    await cleanupPool.end();

  } catch (error) {
    console.error('\nUser Profile tests failed with error:', error);
    process.exit(1);
  }
}

runTests();
