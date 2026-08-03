import { config } from 'dotenv';
import { resolve } from 'path';
// Load environment variables from the workspace root .env
config({ path: resolve(__dirname, '../../.env') });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function main() {
  console.log('Testing CRUD operations against local PostgreSQL db...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Create Category
    const parentCategory = await prisma.category.create({
      data: {
        name: 'Electronics',
        slug: 'electronics',
        description: 'Electronic items and gadgets',
      },
    });
    console.log('Created parent category:', parentCategory.name);

    const childCategory = await prisma.category.create({
      data: {
        name: 'Smartphones',
        slug: 'smartphones',
        description: 'Mobile smart phones',
        parentId: parentCategory.id,
      },
    });
    console.log('Created sub-category:', childCategory.name);

    // 2. Create User, Customer Profile, Seller Profile, Store
    const userAdmin = await prisma.user.create({
      data: {
        email: 'admin@veridia.com',
        passwordHash: 'admin_hash_here',
        role: 'ADMIN',
      },
    });
    console.log('Created ADMIN user:', userAdmin.email);

    const userSeller = await prisma.user.create({
      data: {
        email: 'seller@veridia.com',
        passwordHash: 'seller_hash_here',
        role: 'SELLER',
        sellerProfile: {
          create: {
            businessName: 'Apex Electronics Store',
            store: {
              create: {
                name: 'Apex Tech Store',
                description: 'Best gadgets in town',
              },
            },
            wallet: {
              create: {
                balance: 1500.50,
              },
            },
          },
        },
      },
      include: {
        sellerProfile: {
          include: {
            store: true,
            wallet: true,
          },
        },
      },
    });
    console.log('Created SELLER user and store:', userSeller.sellerProfile?.store?.name);
    console.log('Seller wallet balance:', userSeller.sellerProfile?.wallet?.balance.toString());

    // 3. Create Product in Store
    const product = await prisma.product.create({
      data: {
        storeId: userSeller.sellerProfile!.store!.id,
        categoryId: childCategory.id,
        name: 'iPhone 15 Pro Max',
        slug: 'iphone-15-pro-max',
        description: 'Latest high-end iPhone',
        price: 1199.99,
        stock: 50,
        images: ['https://s3.veridia.com/iphone15.jpg'],
        isApproved: true,
      },
    });
    console.log('Created Product:', product.name, 'Price:', product.price.toString(), 'Stock:', product.stock);

    // 4. Read (Join Query)
    const storeWithProducts = await prisma.store.findUnique({
      where: { id: userSeller.sellerProfile!.store!.id },
      include: {
        products: {
          include: {
            category: true,
          },
        },
      },
    });
    console.log(
      'Fetched store products count:',
      storeWithProducts?.products.length,
      'Product category:',
      storeWithProducts?.products[0]?.category.name
    );

    // 5. Update (Stock & Wallet)
    const updatedProduct = await prisma.product.update({
      where: { id: product.id },
      data: {
        stock: { decrement: 1 },
      },
    });
    console.log('Updated stock count (decremented):', updatedProduct.stock);

    const updatedWallet = await prisma.wallet.update({
      where: { id: userSeller.sellerProfile!.wallet!.id },
      data: {
        balance: { increment: 1199.99 },
      },
    });
    console.log('Updated wallet balance (incremented):', updatedWallet.balance.toString());

    // 6. Delete Cascades
    console.log('Verifying User deletion cascade...');
    await prisma.user.delete({
      where: { id: userSeller.id },
    });
    
    const countStores = await prisma.store.count({
      where: { name: 'Apex Tech Store' },
    });
    const countProducts = await prisma.product.count({
      where: { slug: 'iphone-15-pro-max' },
    });
    const countWallets = await prisma.wallet.count({
      where: { id: userSeller.sellerProfile!.wallet!.id },
    });

    console.log('Stores remaining after seller deleted:', countStores);
    console.log('Products remaining after seller deleted:', countProducts);
    console.log('Wallets remaining after seller deleted:', countWallets);

    if (countStores === 0 && countProducts === 0 && countWallets === 0) {
      console.log('✓ Success: Cascade deletion verification passed!');
    } else {
      console.error('✗ Failure: Cascade deletion verification failed!');
    }

    // Cleanup Category & Admin User
    await prisma.user.delete({ where: { id: userAdmin.id } });
    await prisma.category.delete({ where: { id: parentCategory.id } });
    console.log('Cleanup complete!');

  } catch (error) {
    console.error('CRUD test failed with error:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
