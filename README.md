# Veridia: Premium Multi-Vendor E-Commerce Monorepo

Veridia is a production-ready, full-stack, multi-vendor e-commerce platform built from scratch with a focus on performance, security, and premium aesthetics. 

The monorepo organizes NestJS API services, three Next.js frontend applications, and a native Flutter mobile application into a unified workspace.

---

## 🏗️ Project Architecture & Workspaces

The codebase is organized as a monorepo using **PNPM Workspaces**:

```
├── apps/
│   ├── backend/          # NestJS API (PostgreSQL + Prisma ORM + Redis)
│   ├── web/              # Next.js 16 Customer Storefront
│   ├── admin/            # Next.js 16 Platform Governance Dashboard
│   ├── seller/           # Next.js 16 Merchant Workspace
│   └── mobile/           # Flutter Mobile Application
├── packages/
│   ├── config/           # Shared TypeScript and compiler configurations
│   ├── types/            # Shared interfaces and TypeScript models
│   └── ui/               # Reusable Tailwind CSS UI components
├── database/
│   ├── prisma/           # Database schema definition (schema.prisma)
│   └── scratch/          # Integration verification suites (CRUD, Auth, Caching, etc.)
└── docker-compose.yml    # Database & caching container orchestrations
```

---

## ⚡ Key Architectural Features

### 1. Robust Core Commerce & Database Design
- **Relational Schema:** Configured via Prisma ORM referencing Profiles (`Customer` and `Seller` profiles referencing a base `User`), Stores, Categories (nested parent-child tree structures), Products, Orders, Carts, and Wallet transactions.
- **Inventory Concurrency Protection:** Employs row-level database locking during checkout transactions to prevent stock overselling.
- **Transactional Consistency:** Integrates Prisma transactional blocks ensuring that order state transitions, stock allocations, and wallet updates succeed atomically or roll back completely.

### 2. Multi-Role Authentication & Security
- **Multi-Role Scope:** Enforces granular access bounds across `Customer`, `Seller`, and `Admin` endpoints.
- **Security Tokens:** Uses hashed password states and rotates HttpOnly JWT access/refresh tokens.
- **Session Revocations:** Employs a Redis-backed token blacklist to immediately invalidate logged-out sessions.

### 3. High Performance Caching & Latency Logging
- **Detail & Search Caching:** Caches product details and search listings in Redis (reducing read query latencies from ~70ms to under 13ms).
- **Automated Invalidation:** Purges cache patterns dynamically during database mutations (create, update, delete, approve).
- **Auditing Interceptors:** Logs REST API latency duration targets to standard output for server health auditing.

### 4. Financial Wallet & Ledger Auditing
- **Ledger Entries:** Implements automated wallet credit entries on purchase confirmations, and debit entries on refunds.
- **Dispute Restoration:** Order cancellations recover product stock levels and record offsetting debits on vendor ledgers automatically.

### 5. Automated Communications & Notifications
- **P2P Customer-Seller Chat:** Manages messaging threads securely scoped to participants.
- **Activity Logs:** Triggers automated notification updates during cart checkout, payment confirmation, order shipment, and cancellation actions.

---

## 🖥️ Port Mapping Matrix

| Workspace/Service | Scheme | Port | Access Target |
| :--- | :--- | :--- | :--- |
| **NestJS API Server** | HTTP REST | `3000` | `http://localhost:3000` |
| **Customer Storefront** | Next.js Web | `3001` | `http://localhost:3001` |
| **Admin Governance** | Next.js Web | `3002` | `http://localhost:3002` |
| **Seller Dashboard** | Next.js Web | `3003` | `http://localhost:3003` |
| **PostgreSQL Database** | DB Engine | `5434` | `localhost:5434` |
| **Redis Cache Server** | Memory Store | `6381` | `localhost:6381` |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [PNPM](https://pnpm.io/) (v8+)
- [Docker & Docker Compose](https://www.docker.com/)
- [Flutter SDK](https://flutter.dev/) (for the mobile application)

### Step 1: Install Workspace Dependencies
Execute the monorepo-wide package installer from the root directory:
```bash
pnpm install
```

### Step 2: Launch Databases & Caching Containers
Spin up the PostgreSQL and Redis containers configured in Docker Compose:
```bash
docker-compose up -d
```

### Step 3: Configure Environment Variables
Copy the template configuration file and declare your local keys:
```bash
cp .env.example .env
```

### Step 4: Run Prisma Database Migrations
Initialize the tables inside your Postgres instance:
```bash
pnpm --filter veridia-backend prisma db push
```

### Step 5: Start Development Workspace
Launch the NestJS API server and the three Next.js storefronts simultaneously:
```bash
pnpm dev
```

---

## 🧪 Integration Verification Suites

The repository contains automated test scripts located inside `database/scratch/` verifying platform subsystems:

| Script Name | Command to Execute | Subsystem Assertions |
| :--- | :--- | :--- |
| [test_crud.ts](file:///database/scratch/test_crud.ts) | `npx ts-node database/scratch/test_crud.ts` | Cascade deletions & relational integrity |
| [test_auth.ts](file:///database/scratch/test_auth.ts) | `npx ts-node database/scratch/test_auth.ts` | Role guards, HttpOnly rotations, and blacklist |
| [test_users.ts](file:///database/scratch/test_users.ts) | `npx ts-node database/scratch/test_users.ts` | Profile updates, address JSON, KYC uploads |
| [test_products.ts](file:///database/scratch/test_products.ts) | `npx ts-node database/scratch/test_products.ts` | Hierarchical categories, approval triggers |
| [test_shopping.ts](file:///database/scratch/test_shopping.ts) | `npx ts-node database/scratch/test_shopping.ts` | Wishlists, reviews conflict filters |
| [test_cart.ts](file:///database/scratch/test_cart.ts) | `npx ts-node database/scratch/test_cart.ts` | Cart merges, stock validations |
| [test_orders.ts](file:///database/scratch/test_orders.ts) | `npx ts-node database/scratch/test_orders.ts` | Concurrency checkouts, inventory restorations |
| [test_payments.ts](file:///database/scratch/test_payments.ts) | `npx ts-node database/scratch/test_payments.ts` | Ledger transaction balances, admin refunds |
| [test_notifications.ts](file:///database/scratch/test_notifications.ts) | `npx ts-node database/scratch/test_notifications.ts` | Messaging threads, activity log warnings |
| [test_analytics.ts](file:///database/scratch/test_analytics.ts) | `npx ts-node database/scratch/test_analytics.ts` | Global analytics summary, average order sizing |
| [test_caching.ts](file:///database/scratch/test_caching.ts) | `npx ts-node database/scratch/test_caching.ts` | Cache hits performance metrics, patterns delete |

To execute all tests, make sure the NestJS backend and Docker containers are running, then call the test binaries:
```bash
pnpm --filter veridia-backend test
```

---

## 📱 Mobile App (Flutter) Development

To run code sanity checks or launch the mobile application in a simulator:

```bash
cd apps/mobile
flutter analyze
flutter run
```

---

## 📄 License
This project is private and proprietary. All rights reserved.
&copy; 2026 Veridia Marketplace Inc.
