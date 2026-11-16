# Security Specification — Smart Catering & Sekolah Rakyat Management System

## 1. Data Invariants

1. **Default-Deny Catch-All**: Every path not explicitly matched is denied (`allow read, write: if false;`).
2. **Verified Identity**: All mutations require `request.auth != null && request.auth.token.email_verified == true`.
3. **Owner Binding & Immutability**: Every entity document requires `ownerId == request.auth.uid` on `create`, and `incoming().ownerId == existing().ownerId` on `update`.
4. **Strict Key & Schema Blueprint**: Every `create` and `update` must pass `isValid[Entity](incoming())`, enforcing `data.keys().hasAll(...)` and `data.keys().hasOnly(...)` along with strict `.size()` bounds on every string.
5. **Path Variable Hardening**: Every single-document target operation (`get`, `create`, `update`, `delete`) validates `isValidId(docId)` (`id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
6. **Temporal Integrity**: `createdAt == request.time` and `updatedAt == request.time` on `create`; `createdAt == existing().createdAt` and `updatedAt == request.time` on `update`.
7. **Terminal State Locking**: Orders (`catering_orders`), production batches (`production_batches`), and school deliveries (`school_deliveries`) with `existing().status in ['Selesai', 'Dibatalkan']` cannot be modified by non-admin users.
8. **PII & Query Isolation**: `allow list` on all collections enforces `resource.data.ownerId == request.auth.uid` with zero `get()`/`exists()` calls. `users/{userId}` restricts `get` and `list` strictly to the owner (`userId == request.auth.uid`).
9. **Relational Integrity**: Creating a `school_deliveries` document requires `exists(/databases/$(database)/documents/schools/$(incoming().schoolId))`.

## 2. The "Dirty Dozen" Payloads

1. **Unauthenticated Write**: Creating `/menu_items/menu-1` with `auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: Creating `/menu_items/menu-1` as `primayaadmin@gmail.com` with `email_verified: false` -> `PERMISSION_DENIED`.
3. **Identity Spoofing (`ownerId` Mismatch)**: User `user-a` creates `/catering_orders/ord-1` with `ownerId: "user-b"` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection**: Creating `/customers/cust-1` with an undeclared field `"isAdmin": true` -> `PERMISSION_DENIED`.
5. **String Boundary Overflow (Denial of Wallet)**: Creating `/menu_items/menu-1` with `name` length 500 (> 120 max) -> `PERMISSION_DENIED`.
6. **ID Poisoning Attack**: Creating a document with an invalid ID containing spaces or special characters -> `PERMISSION_DENIED`.
7. **Self-Assigned Privilege Escalation**: User creates `/users/user-a` with `role: "Super Admin"` (only `"Staf Operasional"` allowed for non-admin self-registration) -> `PERMISSION_DENIED`.
8. **Immutable Field Tampering**: Updating `createdAt` or `ownerId` on an existing `/finance_entries/fin-1` document -> `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: Creating `/inventory_items/inv-1` with a past/future `createdAt` timestamp != `request.time` -> `PERMISSION_DENIED`.
10. **Terminal State Re-opening**: Non-admin user updates `/catering_orders/ord-1` after its `status` is already `'Selesai'` -> `PERMISSION_DENIED`.
11. **Orphaned Relational Write**: Creating `/school_deliveries/del-1` referencing a non-existent `schoolId` -> `PERMISSION_DENIED`.
12. **Cross-Tenant PII Read / Blanket List**: User `user-b` attempts `get` on `/customers/cust-owned-by-a` or unindexed `list` without matching `ownerId` -> `PERMISSION_DENIED`.
