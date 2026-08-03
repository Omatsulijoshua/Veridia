async function runTests() {
  const baseUrl = 'http://localhost:3000';
  console.log('Starting Authentication system integration tests against', baseUrl);

  const testEmailCustomer = `customer_${Date.now()}@test.com`;
  const testEmailSeller = `seller_${Date.now()}@test.com`;
  const password = 'testpassword123';

  try {
    // 1. Verify customer signup
    console.log('\n--- 1. Testing Customer Signup ---');
    const signupCustRes = await fetch(`${baseUrl}/auth/signup/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmailCustomer,
        password: password,
        firstName: 'Jane',
        lastName: 'Doe',
        phoneNumber: '+1234567890',
      }),
    });
    const signupCustData = await signupCustRes.json();
    if (signupCustRes.status === 201) {
      console.log('✓ Customer signup success! Created user:', signupCustData.email);
    } else {
      throw new Error(`✗ Customer signup failed: ${JSON.stringify(signupCustData)}`);
    }

    // 2. Verify seller signup
    console.log('\n--- 2. Testing Seller Signup ---');
    const signupSellerRes = await fetch(`${baseUrl}/auth/signup/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmailSeller,
        password: password,
        businessName: 'Apex Electronics',
        phoneNumber: '+1987654321',
      }),
    });
    const signupSellerData = await signupSellerRes.json();
    if (signupSellerRes.status === 201) {
      console.log('✓ Seller signup success! Created seller store:', signupSellerData.storeName);
    } else {
      throw new Error(`✗ Seller signup failed: ${JSON.stringify(signupSellerData)}`);
    }

    // 3. Verify Customer Login & Cookie Capture
    console.log('\n--- 3. Testing Customer Login ---');
    const loginCustRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmailCustomer,
        password: password,
      }),
    });
    const loginCustData = await loginCustRes.json();
    if (loginCustRes.status !== 201) {
      throw new Error(`✗ Customer login failed: ${JSON.stringify(loginCustData)}`);
    }
    const customerToken = loginCustData.accessToken;
    console.log('✓ Customer login success! Captured Access Token:', customerToken.substring(0, 15) + '...');
    
    // Capture refresh token cookie
    const setCookieHeaders = loginCustRes.headers.get('set-cookie');
    let customerCookie = '';
    if (setCookieHeaders) {
      customerCookie = setCookieHeaders.split(';')[0];
      console.log('✓ Captured Refresh Token cookie:', customerCookie.substring(0, 25) + '...');
    } else {
      throw new Error('✗ No set-cookie header returned during login!');
    }

    // 4. Verify Seller Login
    console.log('\n--- 4. Testing Seller Login ---');
    const loginSellerRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmailSeller,
        password: password,
      }),
    });
    const loginSellerData = await loginSellerRes.json();
    if (loginSellerRes.status !== 201) {
      throw new Error(`✗ Seller login failed: ${JSON.stringify(loginSellerData)}`);
    }
    const sellerToken = loginSellerData.accessToken;
    console.log('✓ Seller login success! Captured Access Token:', sellerToken.substring(0, 15) + '...');

    // 5. Verify /auth/me profile route
    console.log('\n--- 5. Testing Profile Query (/auth/me) ---');
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${customerToken}` },
    });
    const meData = await meRes.json();
    if (meRes.status === 200) {
      console.log('✓ Profile retrieved! Name:', meData.customerProfile.firstName, meData.customerProfile.lastName);
    } else {
      throw new Error(`✗ Profile query failed: ${JSON.stringify(meData)}`);
    }

    // 6. Verify Role-Based Access Guards (RBAC)
    console.log('\n--- 6. Testing Role-Based Permission Guards ---');
    // A. Seller requests seller route -> OK
    const sellerRouteOk = await fetch(`${baseUrl}/auth/test-seller`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${sellerToken}` },
    });
    const sellerRouteOkData = await sellerRouteOk.json();
    console.log(`Seller requesting Seller route: Status ${sellerRouteOk.status} - ${JSON.stringify(sellerRouteOkData)}`);
    if (sellerRouteOk.status !== 200) {
      throw new Error('✗ Seller should have been allowed access to the seller route!');
    }

    // B. Customer requests seller route -> Forbidden
    const customerRouteDenied = await fetch(`${baseUrl}/auth/test-seller`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${customerToken}` },
    });
    const customerRouteDeniedData = await customerRouteDenied.json();
    console.log(`Customer requesting Seller route: Status ${customerRouteDenied.status} - ${JSON.stringify(customerRouteDeniedData)}`);
    if (customerRouteDenied.status === 403) {
      console.log('✓ Success: Access correctly denied (403 Forbidden) for invalid role!');
    } else {
      throw new Error('✗ Customer should have been blocked with 403 Forbidden!');
    }

    // 7. Verify token refresh
    console.log('\n--- 7. Testing Access Token Refresh Flow ---');
    const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Cookie': customerCookie },
    });
    const refreshData = await refreshRes.json();
    if (refreshRes.status === 201) {
      console.log('✓ Token refresh success! New Access Token:', refreshData.accessToken.substring(0, 15) + '...');
    } else {
      throw new Error(`✗ Token refresh failed: ${JSON.stringify(refreshData)}`);
    }

    // 8. Verify logout
    console.log('\n--- 8. Testing Logout & Token Revocation ---');
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Cookie': customerCookie },
    });
    const logoutData = await logoutRes.json();
    if (logoutRes.status === 201) {
      console.log('✓ Logout success!');
    } else {
      throw new Error(`✗ Logout failed: ${JSON.stringify(logoutData)}`);
    }

    // Try to refresh again after logout -> should be rejected
    const refreshAfterLogoutRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Cookie': customerCookie },
    });
    const refreshAfterLogoutData = await refreshAfterLogoutRes.json();
    console.log(`Refreshing after logout: Status ${refreshAfterLogoutRes.status} - ${JSON.stringify(refreshAfterLogoutData)}`);
    if (refreshAfterLogoutRes.status === 401) {
      console.log('✓ Success: Refresh token correctly revoked from Redis after logout!');
    } else {
      throw new Error('✗ Revoked token should have returned 401 Unauthorized!');
    }

    console.log('\n==========================================');
    console.log('✓ ALL AUTHENTICATION SYSTEM TESTS PASSED!');
    console.log('==========================================');

  } catch (error) {
    console.error('\nAuth tests failed with error:', error);
    process.exit(1);
  }
}

runTests();
