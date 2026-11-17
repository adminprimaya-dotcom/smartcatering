import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AuditLogEntry,
  CateringOrder,
  CustomerRecord,
  ErpStateSnapshot,
  FinanceEntry,
  InventoryItem,
  MenuItem,
  ProductionBatch,
  PromotionItem,
  SchoolDelivery,
  SchoolRecord,
  SyncStatus,
  UserProfileRecord,
} from '../types/erp';

export interface AuditActorContext {
  actorUid: string;
  actorName: string;
  actorRole: string;
  entityLabel?: string;
  action?: AuditLogEntry['action'];
  details?: string;
}

export function sanitizeId(rawId: string): string {
  const cleaned = String(rawId || '')
    .replace(/[^a-zA-Z0-9_\-]/g, '-')
    .slice(0, 120);
  return cleaned || `id-${Date.now()}`;
}

function clampStr(val: unknown, max: number, min = 1, fallback = '-'): string {
  const trimmed = String(val ?? '').trim();
  if (trimmed.length < min) return min === 0 ? '' : fallback;
  return trimmed.slice(0, max);
}

function clampNum(val: unknown, min: number, max: number, fallback = 0): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizePayload(
  colName: string,
  rest: Record<string, unknown>,
  fallbackOwnerId: string
): Record<string, unknown> {
  const ownerId = sanitizeId(String(rest.ownerId || fallbackOwnerId || 'admin-workspace-uid'));

  switch (colName) {
    case 'users':
      return {
        ownerId,
        displayName: clampStr(rest.displayName, 100, 1, 'Administrator'),
        email: clampStr(rest.email, 150, 3, 'primayaadmin@gmail.com'),
        role: clampStr(rest.role, 50, 1, 'Staf Operasional'),
        department: clampStr(rest.department, 80, 1, 'Manajemen Pusat & Akuntansi'),
        status: rest.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
      };

    case 'menu_items':
      return {
        ownerId,
        name: clampStr(rest.name, 120, 1, 'Menu Catering'),
        category: clampStr(rest.category, 60, 1, 'Nasi kotak'),
        packageName: clampStr(rest.packageName, 100, 1, 'Paket Standar'),
        description: clampStr(rest.description, 500, 1, '-'),
        imageUrl: clampStr(rest.imageUrl, 400, 1, '/logo.png'),
        sellingPrice: clampNum(rest.sellingPrice, 0, 1000000000, 0),
        costPrice: clampNum(rest.costPrice, 0, 1000000000, 0),
        estimatedProfit: clampNum(rest.estimatedProfit, -1000000000, 1000000000, 0),
        available: Boolean(rest.available),
      };

    case 'catering_orders': {
      const validPayStatuses = ['Belum Bayar', 'DP Masuk', 'Lunas'];
      const validStatuses = [
        'Pesanan baru',
        'Menunggu pembayaran',
        'DP masuk',
        'Diproses',
        'Sedang diproduksi',
        'Siap dikirim',
        'Dalam pengiriman',
        'Selesai',
        'Dibatalkan',
      ];
      const base: Record<string, unknown> = {
        ownerId,
        orderNumber: clampStr(rest.orderNumber, 40, 3, 'ORD-001'),
        customerName: clampStr(rest.customerName, 120, 1, 'Pelanggan'),
        whatsapp: clampStr(rest.whatsapp, 30, 5, '0812000000'),
        orderDate: clampStr(rest.orderDate, 25, 8, '2026-11-16'),
        deliveryDate: clampStr(rest.deliveryDate, 25, 8, '2026-11-16'),
        eventType: clampStr(rest.eventType, 60, 1, 'Nasi kotak'),
        packageName: clampStr(rest.packageName, 120, 1, 'Paket Catering'),
        portions: clampNum(rest.portions, 1, 100000, 1),
        unitPrice: clampNum(rest.unitPrice, 0, 100000000, 0),
        discount: clampNum(rest.discount, 0, 1000000000, 0),
        totalPayment: clampNum(rest.totalPayment, 0, 10000000000, 0),
        downPayment: clampNum(rest.downPayment, 0, 10000000000, 0),
        remainingBalance: clampNum(rest.remainingBalance, 0, 10000000000, 0),
        paymentStatus: validPayStatuses.includes(String(rest.paymentStatus))
          ? String(rest.paymentStatus)
          : 'Belum Bayar',
        status: validStatuses.includes(String(rest.status))
          ? String(rest.status)
          : 'Pesanan baru',
        notes: clampStr(rest.notes, 400, 0, ''),
      };

      if (rest.deliveryTime) base.deliveryTime = clampStr(rest.deliveryTime, 25, 0, '');
      if (rest.deliveryAddress) base.deliveryAddress = clampStr(rest.deliveryAddress, 300, 0, '');
      if (rest.deliveryMethod) base.deliveryMethod = clampStr(rest.deliveryMethod, 40, 0, '');
      if (typeof rest.shippingCost === 'number') {
        base.shippingCost = clampNum(rest.shippingCost, 0, 100000000, 0);
      }
      if (rest.paymentMethod) base.paymentMethod = clampStr(rest.paymentMethod, 30, 0, '');
      if (rest.paymentProofUrl) base.paymentProofUrl = clampStr(rest.paymentProofUrl, 500, 0, '');
      if (rest.paymentVerifiedAt) {
        base.paymentVerifiedAt = clampStr(rest.paymentVerifiedAt, 40, 0, '');
      }
      if (rest.paymentVerifiedBy) {
        base.paymentVerifiedBy = clampStr(rest.paymentVerifiedBy, 100, 0, '');
      }
      if (rest.cancellationReason) {
        base.cancellationReason = clampStr(rest.cancellationReason, 300, 0, '');
      }
      if (rest.statusHistoryJson) {
        base.statusHistoryJson = clampStr(rest.statusHistoryJson, 2000, 0, '');
      } else if (Array.isArray(rest.statusHistory) && rest.statusHistory.length > 0) {
        base.statusHistoryJson = JSON.stringify(rest.statusHistory).slice(0, 2000);
      }

      return base;
    }

    case 'customers':
      return {
        ownerId,
        name: clampStr(rest.name, 120, 1, 'Pelanggan'),
        address: clampStr(rest.address, 300, 1, '-'),
        phone: clampStr(rest.phone, 30, 5, '0812000000'),
        locationLat: clampNum(rest.locationLat, -90, 90, -6.2),
        locationLng: clampNum(rest.locationLng, -180, 180, 106.8),
        totalPurchases: clampNum(rest.totalPurchases, 0, 100000000000, 0),
        transactionCount: clampNum(rest.transactionCount, 0, 100000, 0),
        isActive: Boolean(rest.isActive),
        isPriority: Boolean(rest.isPriority),
      };

    case 'production_batches': {
      const validProdStatuses = [
        'Terjadwal',
        'Persiapan Bahan',
        'Sedang Dimasak',
        'Quality Control',
        'Selesai',
        'Dibatalkan',
      ];
      return {
        ownerId,
        productionDate: clampStr(rest.productionDate, 25, 8, '2026-11-16'),
        menuName: clampStr(rest.menuName, 120, 1, 'Menu Produksi'),
        targetChannel:
          rest.targetChannel === 'Sekolah Rakyat' ? 'Sekolah Rakyat' : 'Catering Komersial',
        portions: clampNum(rest.portions, 1, 100000, 1),
        recipeSummary: clampStr(rest.recipeSummary, 400, 1, '-'),
        rawMaterialNeed: clampStr(rest.rawMaterialNeed, 400, 1, '-'),
        productionCost: clampNum(rest.productionCost, 0, 10000000000, 0),
        officerName: clampStr(rest.officerName, 100, 1, 'Tim Dapur'),
        status: validProdStatuses.includes(String(rest.status))
          ? String(rest.status)
          : 'Terjadwal',
        documentationNote: clampStr(rest.documentationNote, 300, 1, '-'),
      };
    }

    case 'schools': {
      const validPartnership = ['Aktif', 'Evaluasi', 'Nonaktif'];
      return {
        ownerId,
        schoolName: clampStr(rest.schoolName, 150, 1, 'Sekolah Mitra'),
        npsn: clampStr(rest.npsn, 25, 4, '20100001'),
        address: clampStr(rest.address, 300, 1, '-'),
        principalName: clampStr(rest.principalName, 120, 1, '-'),
        contactPhone: clampStr(rest.contactPhone, 30, 5, '0812000000'),
        lat: clampNum(rest.lat, -90, 90, -6.2),
        lng: clampNum(rest.lng, -180, 180, 106.8),
        studentCount: clampNum(rest.studentCount, 1, 50000, 100),
        classCount: clampNum(rest.classCount, 1, 1000, 6),
        deliverySchedule: clampStr(rest.deliverySchedule, 120, 1, 'Setiap Hari Sekolah'),
        partnershipStatus: validPartnership.includes(String(rest.partnershipStatus))
          ? String(rest.partnershipStatus)
          : 'Aktif',
      };
    }

    case 'school_deliveries': {
      const validDelivStatuses = ['Persiapan', 'Dalam Pengiriman', 'Selesai', 'Dibatalkan'];
      const base: Record<string, unknown> = {
        ownerId,
        deliveryDate: clampStr(rest.deliveryDate, 25, 8, '2026-11-16'),
        schoolId: sanitizeId(String(rest.schoolId || 'sch-1')),
        schoolName: clampStr(rest.schoolName, 150, 1, 'Sekolah Mitra'),
        menuPackage: clampStr(rest.menuPackage, 150, 1, 'Paket Gizi'),
        portionsDelivered: clampNum(rest.portionsDelivered, 1, 50000, 1),
        courierName: clampStr(rest.courierName, 100, 1, 'Kurir'),
        departureTime: clampStr(rest.departureTime, 20, 3, '07:00 WIB'),
        arrivalTime: clampStr(rest.arrivalTime, 20, 1, '-'),
        recipientName: clampStr(rest.recipientName, 120, 1, '-'),
        status: validDelivStatuses.includes(String(rest.status))
          ? String(rest.status)
          : 'Persiapan',
      };
      if (typeof rest.portionsPlanned === 'number') {
        base.portionsPlanned = clampNum(rest.portionsPlanned, 0, 50000, 0);
      }
      if (rest.productionBatchId) {
        base.productionBatchId = clampStr(rest.productionBatchId, 128, 0, '');
      }
      if (rest.handoverProofNote) {
        base.handoverProofNote = clampStr(rest.handoverProofNote, 400, 0, '');
      }
      if (rest.handoverProofUrl) {
        base.handoverProofUrl = clampStr(rest.handoverProofUrl, 500, 0, '');
      }
      return base;
    }

    case 'finance_entries': {
      const validTypes = [
        'Pendapatan Catering',
        'Pendapatan Sekolah Rakyat',
        'Pengeluaran Operasional',
        'Utang Supplier',
        'Piutang Pelanggan',
      ];
      const validAccounts = [
        'Kas Tunai',
        'QRIS',
        'Bank Mandiri ERP',
        'Bank BRI Sekolah Rakyat',
        'Bank BCA Corporate',
      ];
      const base: Record<string, unknown> = {
        ownerId,
        transactionDate: clampStr(rest.transactionDate, 25, 8, '2026-11-16'),
        referenceCode: clampStr(rest.referenceCode, 40, 3, 'TRX-001'),
        type: validTypes.includes(String(rest.type)) ? String(rest.type) : 'Pendapatan Catering',
        category: clampStr(rest.category, 80, 1, 'Operasional'),
        description: clampStr(rest.description, 300, 1, '-'),
        amount: clampNum(rest.amount, 0, 100000000000, 0),
        accountMethod: validAccounts.includes(String(rest.accountMethod))
          ? String(rest.accountMethod)
          : 'Bank Mandiri ERP',
        settlementStatus: rest.settlementStatus === 'Belum Lunas' ? 'Belum Lunas' : 'Lunas',
      };
      if (rest.orderRef) base.orderRef = clampStr(rest.orderRef, 60, 0, '');
      if (typeof rest.reconciled === 'boolean') base.reconciled = rest.reconciled;
      if (rest.reconciledAt) base.reconciledAt = clampStr(rest.reconciledAt, 40, 0, '');
      if (rest.reconciledBy) base.reconciledBy = clampStr(rest.reconciledBy, 100, 0, '');
      if (rest.correctionNote) base.correctionNote = clampStr(rest.correctionNote, 300, 0, '');
      if (rest.auditTrailJson) base.auditTrailJson = clampStr(rest.auditTrailJson, 2000, 0, '');
      return base;
    }

    case 'inventory_items':
      return {
        ownerId,
        itemCode: clampStr(rest.itemCode, 30, 2, 'BHN-01'),
        name: clampStr(rest.name, 120, 1, 'Bahan Dapur'),
        category: clampStr(rest.category, 60, 1, 'Bahan Pokok'),
        stockQty: clampNum(rest.stockQty, 0, 1000000, 0),
        minStock: clampNum(rest.minStock, 0, 1000000, 0),
        unit: clampStr(rest.unit, 20, 1, 'kg'),
        unitCost: clampNum(rest.unitCost, 0, 100000000, 0),
        supplierName: clampStr(rest.supplierName, 120, 1, '-'),
        lastRestockDate: clampStr(rest.lastRestockDate, 25, 8, '2026-11-16'),
      };

    case 'promotions':
      return {
        ownerId,
        promoCode: clampStr(rest.promoCode, 30, 3, 'PROMO'),
        title: clampStr(rest.title, 120, 1, 'Promo'),
        targetSegment: clampStr(rest.targetSegment, 80, 1, 'Semua Pelanggan'),
        discountPercent: clampNum(rest.discountPercent, 1, 100, 5),
        maxDiscountAmount: clampNum(rest.maxDiscountAmount, 0, 100000000, 0),
        validUntil: clampStr(rest.validUntil, 25, 8, '2026-12-31'),
        active: Boolean(rest.active),
        usageCount: clampNum(rest.usageCount, 0, 1000000, 0),
      };

    case 'audit_logs': {
      const validActions = [
        'create',
        'update',
        'delete',
        'restore',
        'reconcile',
        'cancel',
        'verify_payment',
      ];
      return {
        ownerId,
        entityType: clampStr(rest.entityType, 50, 1, 'catering_orders'),
        entityId: clampStr(rest.entityId, 128, 1, 'unknown'),
        entityLabel: clampStr(rest.entityLabel, 200, 1, 'Dokumen'),
        action: validActions.includes(String(rest.action)) ? String(rest.action) : 'update',
        actorUid: clampStr(rest.actorUid, 128, 1, ownerId),
        actorName: clampStr(rest.actorName, 100, 1, 'Administrator'),
        actorRole: clampStr(rest.actorRole, 60, 1, 'Super Admin'),
        details: clampStr(rest.details, 500, 1, 'Perubahan data'),
        timestampIso: clampStr(rest.timestampIso, 40, 8, new Date().toISOString()),
      };
    }

    default:
      return { ...rest, ownerId };
  }
}

export function buildAuditLogPayload(
  ownerId: string,
  entityType: AuditLogEntry['entityType'],
  entityId: string,
  action: AuditLogEntry['action'],
  actor: AuditActorContext
): Omit<AuditLogEntry, 'id'> {
  return {
    ownerId: sanitizeId(ownerId),
    entityType,
    entityId: sanitizeId(entityId),
    entityLabel: clampStr(actor.entityLabel || entityId, 200, 1, entityId),
    action,
    actorUid: clampStr(actor.actorUid || ownerId, 128, 1, ownerId),
    actorName: clampStr(actor.actorName, 100, 1, 'Administrator'),
    actorRole: clampStr(actor.actorRole, 60, 1, 'Super Admin'),
    details: clampStr(actor.details || `${action} on ${entityType}/${entityId}`, 500, 1, '-'),
    timestampIso: new Date().toISOString(),
  };
}

function hydrateOrderRow(id: string, raw: Record<string, unknown>): CateringOrder {
  let statusHistory = Array.isArray(raw.statusHistory) ? raw.statusHistory : undefined;
  if (!statusHistory && typeof raw.statusHistoryJson === 'string' && raw.statusHistoryJson) {
    try {
      const parsed = JSON.parse(raw.statusHistoryJson);
      if (Array.isArray(parsed)) statusHistory = parsed;
    } catch {
      // Ignore malformed JSON
    }
  }
  return {
    id,
    ...(raw as object),
    statusHistory,
  } as CateringOrder;
}

export interface SubscribeErpOptions {
  limitPerCollection?: number;
  onSyncStatusChange?: (status: SyncStatus, errorMessage?: string) => void;
  onHasMoreChange?: (hasMore: boolean) => void;
  onMenuItems: (items: MenuItem[]) => void;
  onCateringOrders: (items: CateringOrder[]) => void;
  onCustomers: (items: CustomerRecord[]) => void;
  onProductionBatches: (items: ProductionBatch[]) => void;
  onSchools: (items: SchoolRecord[]) => void;
  onSchoolDeliveries: (items: SchoolDelivery[]) => void;
  onFinanceEntries: (items: FinanceEntry[]) => void;
  onInventoryItems: (items: InventoryItem[]) => void;
  onPromotions: (items: PromotionItem[]) => void;
  onUsers: (items: UserProfileRecord[]) => void;
  onAuditLogs?: (items: AuditLogEntry[]) => void;
}

export function subscribeErpCollections(uid: string, options: SubscribeErpOptions): () => void {
  const unsubs: Array<() => void> = [];
  const cleanLimit = Math.max(50, Math.min(1000, options.limitPerCollection || 200));

  const pendingState = new Map<string, boolean>();
  const hasMoreState = new Map<string, boolean>();

  options.onSyncStatusChange?.('connecting');

  const evaluateSyncStatus = () => {
    const anyPending = Array.from(pendingState.values()).some(Boolean);
    options.onSyncStatusChange?.(anyPending ? 'pending' : 'synced');
    const anyMore = Array.from(hasMoreState.values()).some(Boolean);
    options.onHasMoreChange?.(anyMore);
  };

  const listen = <T>(
    colName: string,
    setter: (items: T[]) => void,
    mapper?: (id: string, raw: Record<string, unknown>) => T
  ) => {
    const q = query(collection(db, colName), where('ownerId', '==', uid), limit(cleanLimit));
    const unsub = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        // CRITICAL: Always emit exact Firestore snapshot even when snap.empty === true!
        const rows = snap.docs.map((d) =>
          mapper
            ? mapper(d.id, d.data() as Record<string, unknown>)
            : ({ id: d.id, ...(d.data() as object) } as T)
        );
        setter(rows);
        pendingState.set(colName, snap.metadata.hasPendingWrites);
        hasMoreState.set(colName, snap.docs.length >= cleanLimit);
        evaluateSyncStatus();
      },
      (error) => {
        options.onSyncStatusChange?.('error', error.message || `Gagal sinkronisasi ${colName}`);
        console.error(`Snapshot error on ${colName}:`, error);
      }
    );
    unsubs.push(unsub);
  };

  listen<MenuItem>('menu_items', options.onMenuItems);
  listen<CateringOrder>('catering_orders', options.onCateringOrders, hydrateOrderRow);
  listen<CustomerRecord>('customers', options.onCustomers);
  listen<ProductionBatch>('production_batches', options.onProductionBatches);
  listen<SchoolRecord>('schools', options.onSchools);
  listen<SchoolDelivery>('school_deliveries', options.onSchoolDeliveries);
  listen<FinanceEntry>('finance_entries', options.onFinanceEntries);
  listen<InventoryItem>('inventory_items', options.onInventoryItems);
  listen<PromotionItem>('promotions', options.onPromotions);
  listen<UserProfileRecord>('users', options.onUsers);

  if (options.onAuditLogs) {
    listen<AuditLogEntry>('audit_logs', (rows) => {
      const sorted = [...rows].sort((a, b) =>
        String(b.timestampIso || '').localeCompare(String(a.timestampIso || ''))
      );
      options.onAuditLogs?.(sorted);
    });
  }

  return () => {
    unsubs.forEach((u) => u());
  };
}

export async function saveCloudDocument(
  colName: string,
  docId: string,
  payload: Record<string, unknown>,
  auditContext?: AuditActorContext
): Promise<void> {
  const cleanId = sanitizeId(docId);
  const path = `${colName}/${cleanId}`;
  try {
    const now = serverTimestamp();
    const {
      id: _ignoreId,
      createdAt: _ignoreCreatedAt,
      updatedAt: _ignoreUpdatedAt,
      statusHistory: _ignoreHistoryArr,
      ...rest
    } = payload;
    const sanitizedPayload = sanitizePayload(
      colName,
      { ...rest, statusHistory: payload.statusHistory },
      String(rest.ownerId || 'admin-workspace-uid')
    );
    const docRef = doc(db, colName, cleanId);

    let docExists = false;
    let existingOwnerId = String(sanitizedPayload.ownerId);
    try {
      const existingSnap = await getDoc(docRef);
      if (existingSnap.exists()) {
        docExists = true;
        const existingData = existingSnap.data();
        if (existingData?.ownerId) {
          existingOwnerId = String(existingData.ownerId);
        }
      }
    } catch {
      docExists = false;
    }

    const batch = writeBatch(db);
    if (docExists) {
      batch.update(docRef, {
        ...sanitizedPayload,
        ownerId: existingOwnerId,
        updatedAt: now,
      });
    } else {
      batch.set(docRef, {
        ...sanitizedPayload,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (auditContext) {
      const auditId = sanitizeId(`log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
      const auditPayload = sanitizePayload(
        'audit_logs',
        buildAuditLogPayload(
          existingOwnerId,
          colName as AuditLogEntry['entityType'],
          cleanId,
          auditContext.action || (docExists ? 'update' : 'create'),
          auditContext
        ),
        existingOwnerId
      );
      batch.set(doc(db, 'audit_logs', auditId), {
        ...auditPayload,
        createdAt: now,
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCloudDocument(
  colName: string,
  docId: string,
  ownerId: string,
  auditContext?: AuditActorContext
): Promise<void> {
  const cleanId = sanitizeId(docId);
  const path = `${colName}/${cleanId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, colName, cleanId));

    if (auditContext) {
      const auditId = sanitizeId(`log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
      const auditPayload = sanitizePayload(
        'audit_logs',
        buildAuditLogPayload(
          ownerId,
          colName as AuditLogEntry['entityType'],
          cleanId,
          'delete',
          auditContext
        ),
        ownerId
      );
      batch.set(doc(db, 'audit_logs', auditId), {
        ...auditPayload,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function restoreSnapshotToFirestore(
  uid: string,
  snapshotData: ErpStateSnapshot,
  actor?: AuditActorContext
): Promise<void> {
  const now = serverTimestamp();
  const operations: Array<() => void> = [];
  let currentBatch = writeBatch(db);
  let opCount = 0;
  const batches: ReturnType<typeof writeBatch>[] = [currentBatch];

  const queueOp = (fn: (b: ReturnType<typeof writeBatch>) => void) => {
    if (opCount >= 400) {
      currentBatch = writeBatch(db);
      batches.push(currentBatch);
      opCount = 0;
    }
    fn(currentBatch);
    opCount += 1;
  };

  const stageCollection = async (colName: string, items: Array<{ id: string }>) => {
    for (const item of items) {
      const id = sanitizeId(item.id);
      const docRef = doc(db, colName, id);
      const payload = sanitizePayload(colName, item as unknown as Record<string, unknown>, uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const existingData = snap.data();
        queueOp((b) =>
          b.update(docRef, {
            ...payload,
            ownerId: String(existingData?.ownerId || payload.ownerId),
            updatedAt: now,
          })
        );
      } else {
        queueOp((b) =>
          b.set(docRef, {
            ...payload,
            createdAt: now,
            updatedAt: now,
          })
        );
      }
    }
  };

  try {
    await stageCollection('schools', snapshotData.schools);
    await stageCollection('menu_items', snapshotData.menuItems);
    await stageCollection('catering_orders', snapshotData.cateringOrders);
    await stageCollection('customers', snapshotData.customers);
    await stageCollection('production_batches', snapshotData.productionBatches);
    await stageCollection('finance_entries', snapshotData.financeEntries);
    await stageCollection('inventory_items', snapshotData.inventoryItems);
    await stageCollection('promotions', snapshotData.promotions);

    for (const b of batches) {
      await b.commit();
    }

    // Commit school_deliveries after schools exist in Firestore
    const delBatch = writeBatch(db);
    for (const d of snapshotData.schoolDeliveries) {
      const id = sanitizeId(d.id);
      const docRef = doc(db, 'school_deliveries', id);
      const payload = sanitizePayload('school_deliveries', d as unknown as Record<string, unknown>, uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const existingData = snap.data();
        delBatch.update(docRef, {
          ...payload,
          ownerId: String(existingData?.ownerId || payload.ownerId),
          updatedAt: now,
        });
      } else {
        delBatch.set(docRef, {
          ...payload,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    if (actor) {
      const auditId = sanitizeId(`log-restore-${Date.now()}`);
      const auditPayload = sanitizePayload(
        'audit_logs',
        buildAuditLogPayload(uid, 'backup_restore', `restore-${Date.now()}`, 'restore', {
          ...actor,
          entityLabel: 'Pemulihan Backup JSON Super Admin',
          details: `Restore eksplisit: ${snapshotData.cateringOrders.length} pesanan, ${snapshotData.financeEntries.length} jurnal, ${snapshotData.schools.length} sekolah.`,
        }),
        uid
      );
      delBatch.set(doc(db, 'audit_logs', auditId), {
        ...auditPayload,
        createdAt: now,
      });
    }

    await delBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch_restore');
  }
  void operations;
}
