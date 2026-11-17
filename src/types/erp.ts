export type CateringCategory =
  | 'Catering harian'
  | 'Catering prasmanan'
  | 'Nasi kotak'
  | 'Snack box'
  | 'Catering pernikahan'
  | 'Catering rapat'
  | 'Catering perusahaan'
  | 'Catering acara khusus';

export type OrderStatus =
  | 'Pesanan baru'
  | 'Menunggu pembayaran'
  | 'DP masuk'
  | 'Diproses'
  | 'Sedang diproduksi'
  | 'Siap dikirim'
  | 'Dalam pengiriman'
  | 'Selesai'
  | 'Dibatalkan';

export type PaymentStatus = 'Belum Bayar' | 'DP Masuk' | 'Lunas';

export type DeliveryMethodType = 'Pengiriman ke alamat' | 'Ambil sendiri di lokasi dapur';

export type PaymentMethodType = 'Transfer Bank' | 'QRIS' | 'Pembayaran Tunai';

export type SyncStatus = 'idle' | 'connecting' | 'synced' | 'pending' | 'error' | 'unsaved';

export type AppWorkspaceMode = 'production' | 'demo';

export interface OrderStatusHistoryItem {
  status: OrderStatus;
  timestamp: string;
  actor: string;
  note?: string;
}

export interface CartOrderItem {
  menuId: string;
  name: string;
  category: CateringCategory;
  packageName: string;
  unitPrice: number;
  quantity: number;
  imageUrl: string;
}

export type UserRole =
  | 'Super Admin'
  | 'Manajer Operasional'
  | 'Akuntan Keuangan'
  | 'Kepala Dapur & Produksi'
  | 'Koordinator Sekolah Rakyat'
  | 'Kurir Distribusi'
  | 'Staf Operasional';

export interface MenuItem {
  id: string;
  ownerId: string;
  name: string;
  category: CateringCategory;
  packageName: string;
  description: string;
  imageUrl: string;
  sellingPrice: number;
  costPrice: number;
  estimatedProfit: number;
  available: boolean;
  promoLabel?: string;
}

export interface CateringOrder {
  id: string;
  ownerId: string;
  orderNumber: string;
  customerName: string;
  whatsapp: string;
  orderDate: string;
  deliveryDate: string;
  deliveryTime?: string;
  deliveryAddress?: string;
  deliveryMethod?: DeliveryMethodType;
  shippingCost?: number;
  paymentMethod?: PaymentMethodType;
  paymentProofUrl?: string;
  paymentVerifiedAt?: string;
  paymentVerifiedBy?: string;
  cancellationReason?: string;
  statusHistory?: OrderStatusHistoryItem[];
  statusHistoryJson?: string;
  locationLat?: number;
  locationLng?: number;
  items?: CartOrderItem[];
  eventType: CateringCategory;
  packageName: string;
  portions: number;
  unitPrice: number;
  discount: number;
  totalPayment: number;
  downPayment: number;
  remainingBalance: number;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  notes: string;
}

export interface CustomerRecord {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  phone: string;
  locationLat: number;
  locationLng: number;
  totalPurchases: number;
  transactionCount: number;
  isActive: boolean;
  isPriority: boolean;
}

export interface ProductionBatch {
  id: string;
  ownerId: string;
  productionDate: string;
  menuName: string;
  targetChannel: 'Catering Komersial' | 'Sekolah Rakyat';
  portions: number;
  recipeSummary: string;
  rawMaterialNeed: string;
  productionCost: number;
  officerName: string;
  status: 'Terjadwal' | 'Persiapan Bahan' | 'Sedang Dimasak' | 'Quality Control' | 'Selesai' | 'Dibatalkan';
  documentationNote: string;
}

export interface SchoolRecord {
  id: string;
  ownerId: string;
  schoolName: string;
  npsn: string;
  address: string;
  principalName: string;
  contactPhone: string;
  lat: number;
  lng: number;
  studentCount: number;
  classCount: number;
  deliverySchedule: string;
  partnershipStatus: 'Aktif' | 'Evaluasi' | 'Nonaktif';
}

export interface SchoolDelivery {
  id: string;
  ownerId: string;
  deliveryDate: string;
  schoolId: string;
  schoolName: string;
  menuPackage: string;
  portionsDelivered: number;
  portionsPlanned?: number;
  productionBatchId?: string;
  courierName: string;
  departureTime: string;
  arrivalTime: string;
  recipientName: string;
  handoverProofNote?: string;
  handoverProofUrl?: string;
  status: 'Persiapan' | 'Dalam Pengiriman' | 'Selesai' | 'Dibatalkan';
}

export interface FinanceEntry {
  id: string;
  ownerId: string;
  transactionDate: string;
  referenceCode: string;
  orderRef?: string;
  type:
    | 'Pendapatan Catering'
    | 'Pendapatan Sekolah Rakyat'
    | 'Pengeluaran Operasional'
    | 'Utang Supplier'
    | 'Piutang Pelanggan';
  category: string;
  description: string;
  amount: number;
  accountMethod: 'Kas Tunai' | 'QRIS' | 'Bank Mandiri ERP' | 'Bank BRI Sekolah Rakyat' | 'Bank BCA Corporate';
  settlementStatus: 'Lunas' | 'Belum Lunas';
  reconciled?: boolean;
  reconciledAt?: string;
  reconciledBy?: string;
  correctionNote?: string;
  auditTrailJson?: string;
}

export interface InventoryItem {
  id: string;
  ownerId: string;
  itemCode: string;
  name: string;
  category: string;
  stockQty: number;
  minStock: number;
  unit: string;
  unitCost: number;
  supplierName: string;
  lastRestockDate: string;
}

export interface PromotionItem {
  id: string;
  ownerId: string;
  promoCode: string;
  title: string;
  targetSegment: string;
  discountPercent: number;
  maxDiscountAmount: number;
  validUntil: string;
  active: boolean;
  usageCount: number;
}

export interface UserProfileRecord {
  id: string;
  ownerId: string;
  displayName: string;
  email: string;
  role: UserRole;
  department: string;
  status: 'Aktif' | 'Nonaktif';
}

export interface AuditLogEntry {
  id: string;
  ownerId: string;
  entityType:
    | 'menu_items'
    | 'catering_orders'
    | 'customers'
    | 'production_batches'
    | 'schools'
    | 'school_deliveries'
    | 'finance_entries'
    | 'inventory_items'
    | 'promotions'
    | 'users'
    | 'backup_restore';
  entityId: string;
  entityLabel: string;
  action: 'create' | 'update' | 'delete' | 'restore' | 'reconcile' | 'cancel' | 'verify_payment';
  actorUid: string;
  actorName: string;
  actorRole: string;
  details: string;
  timestampIso: string;
}

export interface SiteContentSettings {
  brandName: string;
  brandTagline: string;
  erpSystemTitle: string;
  erpHeaderSubtitle: string;
  accentTheme: 'flora-elegan' | 'emerald' | 'navy' | 'teal' | 'amber';
  themeOrnamentEnabled?: boolean;
  themeOrnamentUrl?: string;
  heroBadge: string;
  heroTitle: string;
  heroDescription: string;
  heroImageUrl: string;
  heroImageCaptionTitle: string;
  heroImageCaptionSubtitle: string;
  heroBtnPrimary: string;
  heroBtnSecondary: string;
  heroBtnWhatsapp: string;
  stat1Title: string;
  stat1Desc: string;
  stat2Title: string;
  stat2Desc: string;
  stat3Title: string;
  stat3Desc: string;
  catalogBadge: string;
  catalogTitle: string;
  catalogDescription: string;
  promoBadge: string;
  promoTitle: string;
  trackingBadge: string;
  trackingTitle: string;
  trackingDescription: string;
  aboutBadge: string;
  aboutTitle: string;
  aboutDescription: string;
  feature1Title: string;
  feature1Desc: string;
  feature2Title: string;
  feature2Desc: string;
  feature3Title: string;
  feature3Desc: string;
  contactBadge: string;
  contactTitle: string;
  companyAddress: string;
  whatsappNumber: string;
  whatsappDisplay: string;
  operatingHours: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  bank2Name: string;
  bank2AccountNumber: string;
  bank2AccountHolder: string;
  qrisMerchantName: string;
  qrisNmid: string;
  qrisImageUrl: string;
  footerCopyright: string;
  updatedAt?: string;
}

export interface PaidNotificationItem {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  whatsapp: string;
  amount: number;
  paymentMethod: PaymentMethodType;
  paidAt: string;
  verifiedBy: string;
  note: string;
  isRead: boolean;
}

export interface MusicTrack {
  id: string;
  title: string;
  audioUrl: string;
  sourceType: 'builtin' | 'upload' | 'url';
  fileName?: string;
  isActive: boolean;
  createdAt: string;
}

export interface ErpStateSnapshot {
  menuItems: MenuItem[];
  cateringOrders: CateringOrder[];
  customers: CustomerRecord[];
  productionBatches: ProductionBatch[];
  schools: SchoolRecord[];
  schoolDeliveries: SchoolDelivery[];
  financeEntries: FinanceEntry[];
  inventoryItems: InventoryItem[];
  promotions: PromotionItem[];
  users: UserProfileRecord[];
}
