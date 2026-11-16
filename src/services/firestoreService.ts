import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
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
  UserProfileRecord,
} from '../types/erp';
import { createInitialErpSeed } from '../data/seedData';

function sanitizeId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 120);
  return cleaned || `id-${Date.now()}`;
}

function clampStr(val: string, max: number, min = 1, fallback = '-'): string {
  const trimmed = (val ?? '').trim();
  if (trimmed.length < min) return min === 0 ? '' : fallback;
  return trimmed.slice(0, max);
}

export async function seedCloudFirestoreIfNeeded(uid: string): Promise<void> {
  const path = 'menu_items';
  try {
    const q = query(collection(db, path), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    if (!snap.empty) return;

    const seed = createInitialErpSeed(uid);
    await restoreSnapshotToFirestore(uid, seed);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function restoreSnapshotToFirestore(
  uid: string,
  snapshotData: ErpStateSnapshot
): Promise<void> {
  const batch = writeBatch(db);
  const now = serverTimestamp();

  // 1. Schools first so school_deliveries relational check passes
  for (const s of snapshotData.schools) {
    const id = sanitizeId(s.id);
    batch.set(doc(db, 'schools', id), {
      ownerId: uid,
      schoolName: clampStr(s.schoolName, 150),
      npsn: clampStr(s.npsn, 25, 4, '20100001'),
      address: clampStr(s.address, 300),
      principalName: clampStr(s.principalName, 120),
      contactPhone: clampStr(s.contactPhone, 30, 5, '0812000000'),
      lat: Number(s.lat) || -6.2,
      lng: Number(s.lng) || 106.8,
      studentCount: Math.max(1, Number(s.studentCount) || 100),
      classCount: Math.max(1, Number(s.classCount) || 6),
      deliverySchedule: clampStr(s.deliverySchedule, 120),
      partnershipStatus: s.partnershipStatus || 'Aktif',
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const m of snapshotData.menuItems) {
    const id = sanitizeId(m.id);
    batch.set(doc(db, 'menu_items', id), {
      ownerId: uid,
      name: clampStr(m.name, 120),
      category: clampStr(m.category, 60),
      packageName: clampStr(m.packageName, 100),
      description: clampStr(m.description, 500),
      imageUrl: clampStr(m.imageUrl, 400),
      sellingPrice: Math.max(0, Number(m.sellingPrice) || 0),
      costPrice: Math.max(0, Number(m.costPrice) || 0),
      estimatedProfit: Number(m.estimatedProfit) || 0,
      available: Boolean(m.available),
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const o of snapshotData.cateringOrders) {
    const id = sanitizeId(o.id);
    batch.set(doc(db, 'catering_orders', id), {
      ownerId: uid,
      orderNumber: clampStr(o.orderNumber, 40, 3, 'ORD-001'),
      customerName: clampStr(o.customerName, 120),
      whatsapp: clampStr(o.whatsapp, 30, 5, '0812000000'),
      orderDate: clampStr(o.orderDate, 25, 8, '2026-11-16'),
      deliveryDate: clampStr(o.deliveryDate, 25, 8, '2026-11-16'),
      eventType: clampStr(o.eventType, 60),
      packageName: clampStr(o.packageName, 120),
      portions: Math.max(1, Number(o.portions) || 1),
      unitPrice: Math.max(0, Number(o.unitPrice) || 0),
      discount: Math.max(0, Number(o.discount) || 0),
      totalPayment: Math.max(0, Number(o.totalPayment) || 0),
      downPayment: Math.max(0, Number(o.downPayment) || 0),
      remainingBalance: Math.max(0, Number(o.remainingBalance) || 0),
      paymentStatus: o.paymentStatus || 'Belum Bayar',
      status: o.status || 'Pesanan baru',
      notes: clampStr(o.notes, 400, 0, ''),
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const c of snapshotData.customers) {
    const id = sanitizeId(c.id);
    batch.set(doc(db, 'customers', id), {
      ownerId: uid,
      name: clampStr(c.name, 120),
      address: clampStr(c.address, 300),
      phone: clampStr(c.phone, 30, 5, '0812000000'),
      locationLat: Number(c.locationLat) || -6.2,
      locationLng: Number(c.locationLng) || 106.8,
      totalPurchases: Math.max(0, Number(c.totalPurchases) || 0),
      transactionCount: Math.max(0, Number(c.transactionCount) || 0),
      isActive: Boolean(c.isActive),
      isPriority: Boolean(c.isPriority),
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const p of snapshotData.productionBatches) {
    const id = sanitizeId(p.id);
    batch.set(doc(db, 'production_batches', id), {
      ownerId: uid,
      productionDate: clampStr(p.productionDate, 25, 8, '2026-11-16'),
      menuName: clampStr(p.menuName, 120),
      targetChannel: p.targetChannel || 'Catering Komersial',
      portions: Math.max(1, Number(p.portions) || 1),
      recipeSummary: clampStr(p.recipeSummary, 400),
      rawMaterialNeed: clampStr(p.rawMaterialNeed, 400),
      productionCost: Math.max(0, Number(p.productionCost) || 0),
      officerName: clampStr(p.officerName, 100),
      status: p.status || 'Terjadwal',
      documentationNote: clampStr(p.documentationNote, 300),
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const f of snapshotData.financeEntries) {
    const id = sanitizeId(f.id);
    batch.set(doc(db, 'finance_entries', id), {
      ownerId: uid,
      transactionDate: clampStr(f.transactionDate, 25, 8, '2026-11-16'),
      referenceCode: clampStr(f.referenceCode, 40, 3, 'TRX-001'),
      type: f.type || 'Pendapatan Catering',
      category: clampStr(f.category, 80),
      description: clampStr(f.description, 300),
      amount: Math.max(0, Number(f.amount) || 0),
      accountMethod: f.accountMethod || 'Bank Mandiri ERP',
      settlementStatus: f.settlementStatus || 'Lunas',
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const inv of snapshotData.inventoryItems) {
    const id = sanitizeId(inv.id);
    batch.set(doc(db, 'inventory_items', id), {
      ownerId: uid,
      itemCode: clampStr(inv.itemCode, 30, 2, 'BHN-01'),
      name: clampStr(inv.name, 120),
      category: clampStr(inv.category, 60),
      stockQty: Math.max(0, Number(inv.stockQty) || 0),
      minStock: Math.max(0, Number(inv.minStock) || 0),
      unit: clampStr(inv.unit, 20),
      unitCost: Math.max(0, Number(inv.unitCost) || 0),
      supplierName: clampStr(inv.supplierName, 120),
      lastRestockDate: clampStr(inv.lastRestockDate, 25, 8, '2026-11-16'),
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const pr of snapshotData.promotions) {
    const id = sanitizeId(pr.id);
    batch.set(doc(db, 'promotions', id), {
      ownerId: uid,
      promoCode: clampStr(pr.promoCode, 30, 3, 'PROMO'),
      title: clampStr(pr.title, 120),
      targetSegment: clampStr(pr.targetSegment, 80),
      discountPercent: Math.min(100, Math.max(1, Number(pr.discountPercent) || 5)),
      maxDiscountAmount: Math.max(0, Number(pr.maxDiscountAmount) || 0),
      validUntil: clampStr(pr.validUntil, 25, 8, '2026-12-31'),
      active: Boolean(pr.active),
      usageCount: Math.max(0, Number(pr.usageCount) || 0),
      createdAt: now,
      updatedAt: now,
    });
  }

  try {
    await batch.commit();

    // Commit school_deliveries after schools exist
    const delBatch = writeBatch(db);
    for (const d of snapshotData.schoolDeliveries) {
      const id = sanitizeId(d.id);
      delBatch.set(doc(db, 'school_deliveries', id), {
        ownerId: uid,
        deliveryDate: clampStr(d.deliveryDate, 25, 8, '2026-11-16'),
        schoolId: sanitizeId(d.schoolId),
        schoolName: clampStr(d.schoolName, 150),
        menuPackage: clampStr(d.menuPackage, 150),
        portionsDelivered: Math.max(1, Number(d.portionsDelivered) || 1),
        courierName: clampStr(d.courierName, 100),
        departureTime: clampStr(d.departureTime, 20, 3, '07:00 WIB'),
        arrivalTime: clampStr(d.arrivalTime, 20, 1, '-'),
        recipientName: clampStr(d.recipientName, 120),
        status: d.status || 'Persiapan',
        createdAt: now,
        updatedAt: now,
      });
    }
    await delBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch_restore');
  }
}

export function subscribeErpCollections(
  uid: string,
  callbacks: {
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
  }
): () => void {
  const unsubs: Array<() => void> = [];

  const listen = <T>(colName: string, setter: (items: T[]) => void) => {
    const q = query(collection(db, colName), where('ownerId', '==', uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) return;
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as T));
        setter(rows);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, colName);
      }
    );
    unsubs.push(unsub);
  };

  listen<MenuItem>('menu_items', callbacks.onMenuItems);
  listen<CateringOrder>('catering_orders', callbacks.onCateringOrders);
  listen<CustomerRecord>('customers', callbacks.onCustomers);
  listen<ProductionBatch>('production_batches', callbacks.onProductionBatches);
  listen<SchoolRecord>('schools', callbacks.onSchools);
  listen<SchoolDelivery>('school_deliveries', callbacks.onSchoolDeliveries);
  listen<FinanceEntry>('finance_entries', callbacks.onFinanceEntries);
  listen<InventoryItem>('inventory_items', callbacks.onInventoryItems);
  listen<PromotionItem>('promotions', callbacks.onPromotions);
  listen<UserProfileRecord>('users', callbacks.onUsers);

  return () => {
    unsubs.forEach((u) => u());
  };
}

export async function saveCloudDocument(
  colName: string,
  docId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const cleanId = sanitizeId(docId);
  try {
    const now = serverTimestamp();
    const { id: _ignoreId, ...rest } = payload;

    let sanitizedPayload: Record<string, unknown> = { ...rest };

    if (colName === 'catering_orders') {
      sanitizedPayload = {
        ownerId: String(rest.ownerId || 'admin-workspace-uid'),
        orderNumber: clampStr(String(rest.orderNumber || 'ORD-001'), 40, 3, 'ORD-001'),
        customerName: clampStr(String(rest.customerName || 'Pelanggan'), 120),
        whatsapp: clampStr(String(rest.whatsapp || '0812000000'), 30, 5, '0812000000'),
        orderDate: clampStr(String(rest.orderDate || '2026-11-16'), 25, 8, '2026-11-16'),
        deliveryDate: clampStr(String(rest.deliveryDate || '2026-11-16'), 25, 8, '2026-11-16'),
        eventType: clampStr(String(rest.eventType || 'Nasi kotak'), 60),
        packageName: clampStr(String(rest.packageName || 'Paket Catering'), 120),
        portions: Math.max(1, Number(rest.portions) || 1),
        unitPrice: Math.max(0, Number(rest.unitPrice) || 0),
        discount: Math.max(0, Number(rest.discount) || 0),
        totalPayment: Math.max(0, Number(rest.totalPayment) || 0),
        downPayment: Math.max(0, Number(rest.downPayment) || 0),
        remainingBalance: Math.max(0, Number(rest.remainingBalance) || 0),
        paymentStatus: rest.paymentStatus || 'Belum Bayar',
        status: rest.status || 'Pesanan baru',
        notes: clampStr(String(rest.notes || ''), 400, 0, ''),
      };
    } else if (colName === 'menu_items') {
      sanitizedPayload = {
        ownerId: String(rest.ownerId || 'admin-workspace-uid'),
        name: clampStr(String(rest.name || 'Menu'), 120),
        category: clampStr(String(rest.category || 'Nasi kotak'), 60),
        packageName: clampStr(String(rest.packageName || 'Paket Standar'), 100),
        description: clampStr(String(rest.description || '-'), 500),
        imageUrl: clampStr(String(rest.imageUrl || '/logo.png'), 400),
        sellingPrice: Math.max(0, Number(rest.sellingPrice) || 0),
        costPrice: Math.max(0, Number(rest.costPrice) || 0),
        estimatedProfit: Number(rest.estimatedProfit) || 0,
        available: Boolean(rest.available),
      };
    } else if (colName === 'users') {
      sanitizedPayload = {
        ownerId: String(rest.ownerId || 'admin-workspace-uid'),
        displayName: clampStr(String(rest.displayName || 'Administrator'), 120),
        email: clampStr(String(rest.email || 'primayaadmin@gmail.com'), 150),
        role: clampStr(String(rest.role || 'Super Admin'), 60),
        department: clampStr(String(rest.department || 'Manajemen Pusat & Akuntansi'), 100),
        status: rest.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
      };
    }

    await setDoc(doc(db, colName, cleanId), {
      ...sanitizedPayload,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${colName}/${cleanId}`);
  }
}

export async function deleteCloudDocument(colName: string, docId: string): Promise<void> {
  const cleanId = sanitizeId(docId);
  try {
    await deleteDoc(doc(db, colName, cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${colName}/${cleanId}`);
  }
}
