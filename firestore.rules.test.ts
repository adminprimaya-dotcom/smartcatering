import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesText = fs.readFileSync('./firestore.rules', 'utf8');

// Helper simulating the rule evaluation logic from firestore.rules for the Dirty Dozen payloads
interface SimContext {
  auth: {
    uid: string;
    email: string;
    email_verified: boolean;
  } | null;
  requestTime: string;
  existingDoc?: Record<string, unknown>;
  schoolExists?: boolean;
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function isValidId(id: unknown): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && VALID_ID_REGEX.test(id);
}

function evaluateDirtyDozenWrite(
  collection: string,
  docId: string,
  operation: 'create' | 'update' | 'get',
  payload: Record<string, unknown>,
  ctx: SimContext
): 'ALLOWED' | 'PERMISSION_DENIED' {
  if (!ctx.auth) return 'PERMISSION_DENIED';
  if (!isValidId(docId)) return 'PERMISSION_DENIED';

  if (operation === 'get') {
    if (collection === 'customers' || collection === 'users') {
      if (!ctx.auth.email_verified) return 'PERMISSION_DENIED';
      const ownerId = ctx.existingDoc?.ownerId;
      if (ownerId !== ctx.auth.uid && ctx.auth.email !== 'primayaadmin@gmail.com') {
        return 'PERMISSION_DENIED';
      }
      return 'ALLOWED';
    }
  }

  if (!ctx.auth.email_verified) return 'PERMISSION_DENIED';

  // Owner identity check
  if (payload.ownerId !== ctx.auth.uid) return 'PERMISSION_DENIED';

  // Temporal integrity check
  if (operation === 'create') {
    if (payload.createdAt !== ctx.requestTime || payload.updatedAt !== ctx.requestTime) {
      return 'PERMISSION_DENIED';
    }
  } else if (operation === 'update') {
    if (
      !ctx.existingDoc ||
      payload.ownerId !== ctx.existingDoc.ownerId ||
      payload.createdAt !== ctx.existingDoc.createdAt ||
      payload.updatedAt !== ctx.requestTime
    ) {
      return 'PERMISSION_DENIED';
    }
  }

  if (collection === 'menu_items') {
    const allowed = [
      'ownerId', 'name', 'category', 'packageName', 'description',
      'imageUrl', 'sellingPrice', 'costPrice', 'estimatedProfit',
      'available', 'createdAt', 'updatedAt'
    ];
    const keys = Object.keys(payload);
    if (keys.length !== allowed.length || !keys.every((k) => allowed.includes(k))) {
      return 'PERMISSION_DENIED';
    }
    if (typeof payload.name !== 'string' || payload.name.length < 1 || payload.name.length > 120) {
      return 'PERMISSION_DENIED';
    }
  }

  if (collection === 'customers') {
    const allowed = [
      'ownerId', 'name', 'address', 'phone', 'locationLat', 'locationLng',
      'totalPurchases', 'transactionCount', 'isActive', 'isPriority',
      'createdAt', 'updatedAt'
    ];
    const keys = Object.keys(payload);
    if (keys.length !== allowed.length || !keys.every((k) => allowed.includes(k))) {
      return 'PERMISSION_DENIED';
    }
  }

  if (collection === 'users' && operation === 'create') {
    const isAdmin = ctx.auth.email === 'primayaadmin@gmail.com';
    if (payload.role !== 'Staf Operasional' && !isAdmin) {
      return 'PERMISSION_DENIED';
    }
  }

  if (collection === 'catering_orders' && operation === 'update') {
    const prevStatus = ctx.existingDoc?.status;
    const isAdmin = ctx.auth.email === 'primayaadmin@gmail.com';
    if ((prevStatus === 'Selesai' || prevStatus === 'Dibatalkan') && !isAdmin) {
      return 'PERMISSION_DENIED';
    }
  }

  if (collection === 'school_deliveries' && operation === 'create') {
    if (!ctx.schoolExists) {
      return 'PERMISSION_DENIED';
    }
  }

  return 'ALLOWED';
}

test('Firestore rules file contains all 11 collection gates and default-deny net', () => {
  assert.ok(rulesText.includes('allow read, write: if false;'));
  assert.ok(rulesText.includes('match /admins/{adminId}'));
  assert.ok(rulesText.includes('match /users/{userId}'));
  assert.ok(rulesText.includes('match /menu_items/{menuId}'));
  assert.ok(rulesText.includes('match /catering_orders/{orderId}'));
  assert.ok(rulesText.includes('match /customers/{customerId}'));
  assert.ok(rulesText.includes('match /production_batches/{batchId}'));
  assert.ok(rulesText.includes('match /schools/{schoolId}'));
  assert.ok(rulesText.includes('match /school_deliveries/{deliveryId}'));
  assert.ok(rulesText.includes('match /finance_entries/{entryId}'));
  assert.ok(rulesText.includes('match /inventory_items/{itemId}'));
  assert.ok(rulesText.includes('match /promotions/{promoId}'));
});

test('Dirty Dozen #1-12 payloads all return PERMISSION_DENIED', () => {
  const now = '2026-11-16T08:00:00Z';
  const baseMenu = {
    ownerId: 'user-a',
    name: 'Nasi Kotak Ayam Bakar',
    category: 'Nasi kotak',
    packageName: 'Paket Reguler',
    description: 'Nasi kotak lengkap',
    imageUrl: '/src/assets/images/menu.jpg',
    sellingPrice: 35000,
    costPrice: 22000,
    estimatedProfit: 13000,
    available: true,
    createdAt: now,
    updatedAt: now
  };

  // 1. Unauthenticated Write
  assert.equal(
    evaluateDirtyDozenWrite('menu_items', 'menu-1', 'create', baseMenu, { auth: null, requestTime: now }),
    'PERMISSION_DENIED'
  );

  // 2. Unverified Email Spoof
  assert.equal(
    evaluateDirtyDozenWrite('menu_items', 'menu-1', 'create', baseMenu, {
      auth: { uid: 'user-a', email: 'primayaadmin@gmail.com', email_verified: false },
      requestTime: now
    }),
    'PERMISSION_DENIED'
  );

  // 3. Identity Spoofing (ownerId mismatch)
  assert.equal(
    evaluateDirtyDozenWrite(
      'catering_orders',
      'ord-1',
      'create',
      { ...baseMenu, ownerId: 'user-b' },
      { auth: { uid: 'user-a', email: 'usera@example.com', email_verified: true }, requestTime: now }
    ),
    'PERMISSION_DENIED'
  );

  // 4. Shadow Field Injection
  assert.equal(
    evaluateDirtyDozenWrite(
      'customers',
      'cust-1',
      'create',
      {
        ownerId: 'user-a',
        name: 'PT Maju Bersama',
        address: 'Jl. Sudirman No. 10',
        phone: '08123456789',
        locationLat: -6.2,
        locationLng: 106.8,
        totalPurchases: 5000000,
        transactionCount: 2,
        isActive: true,
        isPriority: true,
        isAdmin: true, // shadow field
        createdAt: now,
        updatedAt: now
      },
      { auth: { uid: 'user-a', email: 'usera@example.com', email_verified: true }, requestTime: now }
    ),
    'PERMISSION_DENIED'
  );

  // 5. String Boundary Overflow
  assert.equal(
    evaluateDirtyDozenWrite(
      'menu_items',
      'menu-1',
      'create',
      { ...baseMenu, name: 'X'.repeat(500) },
      { auth: { uid: 'user-a', email: 'usera@example.com', email_verified: true }, requestTime: now }
    ),
    'PERMISSION_DENIED'
  );

  // 6. ID Poisoning Attack
  assert.equal(
    evaluateDirtyDozenWrite(
      'menu_items',
      'invalid id with spaces & $pecial!',
      'create',
      baseMenu,
      { auth: { uid: 'user-a', email: 'usera@example.com', email_verified: true }, requestTime: now }
    ),
    'PERMISSION_DENIED'
  );

  // 7. Self-Assigned Privilege Escalation
  assert.equal(
    evaluateDirtyDozenWrite(
      'users',
      'user-a',
      'create',
      {
        ownerId: 'user-a',
        displayName: 'Staf Biasa',
        email: 'usera@example.com',
        role: 'Super Admin',
        department: 'Operasional',
        status: 'Aktif',
        createdAt: now,
        updatedAt: now
      },
      { auth: { uid: 'user-a', email: 'usera@example.com', email_verified: true }, requestTime: now }
    ),
    'PERMISSION_DENIED'
  );

  // 8. Immutable Field Tampering
  assert.equal(
    evaluateDirtyDozenWrite(
      'finance_entries',
      'fin-1',
      'update',
      { ownerId: 'user-a', createdAt: '2025-01-01T00:00:00Z', updatedAt: now },
      {
        auth: { uid: 'user-a', email: 'usera@example.com', email_verified: true },
        requestTime: now,
        existingDoc: { ownerId: 'user-a', createdAt: '2026-11-15T00:00:00Z' }
      }
    ),
    'PERMISSION_DENIED'
  );

  // 9. Client Timestamp Forgery
  assert.equal(
    evaluateDirtyDozenWrite(
      'inventory_items',
      'inv-1',
      'create',
      { ...baseMenu, createdAt: '2099-01-01T00:00:00Z' },
      { auth: { uid: 'user-a', email: 'usera@example.com', email_verified: true }, requestTime: now }
    ),
    'PERMISSION_DENIED'
  );

  // 10. Terminal State Re-opening
  assert.equal(
    evaluateDirtyDozenWrite(
      'catering_orders',
      'ord-1',
      'update',
      { ownerId: 'user-a', status: 'Diproses', createdAt: now, updatedAt: now },
      {
        auth: { uid: 'user-a', email: 'usera@example.com', email_verified: true },
        requestTime: now,
        existingDoc: { ownerId: 'user-a', status: 'Selesai', createdAt: now }
      }
    ),
    'PERMISSION_DENIED'
  );

  // 11. Orphaned Relational Write
  assert.equal(
    evaluateDirtyDozenWrite(
      'school_deliveries',
      'del-1',
      'create',
      { ownerId: 'user-a', schoolId: 'non-existent-school', createdAt: now, updatedAt: now },
      {
        auth: { uid: 'user-a', email: 'usera@example.com', email_verified: true },
        requestTime: now,
        schoolExists: false
      }
    ),
    'PERMISSION_DENIED'
  );

  // 12. Cross-Tenant PII Read
  assert.equal(
    evaluateDirtyDozenWrite(
      'customers',
      'cust-owned-by-a',
      'get',
      {},
      {
        auth: { uid: 'user-b', email: 'userb@example.com', email_verified: true },
        requestTime: now,
        existingDoc: { ownerId: 'user-a' }
      }
    ),
    'PERMISSION_DENIED'
  );
});
