import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  ChefHat,
  Cloud,
  CloudOff,
  Database,
  Globe,
  History,
  LayoutDashboard,
  LayoutTemplate,
  Loader2,
  LogOut,
  Menu,
  Music2,
  Package,
  RefreshCw,
  School,
  ShieldCheck,
  Tag,
  Wallet,
  X,
} from 'lucide-react';
import { auth, googleProvider } from './firebase';
import {
  AppWorkspaceMode,
  AuditLogEntry,
  CateringOrder,
  CustomerRecord,
  ErpStateSnapshot,
  FinanceEntry,
  InventoryItem,
  MenuItem,
  MusicTrack,
  OrderStatusHistoryItem,
  PaidNotificationItem,
  ProductionBatch,
  PromotionItem,
  SchoolDelivery,
  SchoolRecord,
  SiteContentSettings,
  SyncStatus,
  UserProfileRecord,
  UserRole,
} from './types/erp';
import { createInitialErpSeed, DEFAULT_SITE_SETTINGS } from './data/seedData';
import {
  AuditActorContext,
  deleteCloudDocument,
  restoreSnapshotToFirestore,
  saveCloudDocument,
  subscribeErpCollections,
} from './services/firestoreService';
import { DashboardView } from './components/DashboardView';
import { CateringModule } from './components/CateringModule';
import { SekolahRakyatModule } from './components/SekolahRakyatModule';
import { FinanceInventoryModule } from './components/FinanceInventoryModule';
import { LoginModal } from './components/LoginModal';
import { CustomerStorefront } from './components/CustomerStorefront';
import { SiteDisplayCustomizer } from './components/SiteDisplayCustomizer';
import { ConfirmActionModal } from './components/ConfirmActionModal';
import { BackgroundMusicWidget } from './components/BackgroundMusicWidget';
import { MusicManagerModule } from './components/MusicManagerModule';
import { formatRupiah, getJakartaTodayIso } from './utils/calculations';
import { downloadProfessionalFinancialExcel } from './utils/financialReportExport';
import {
  DEFAULT_MUSIC_TRACK,
  resolveActiveTrack,
  resolveNextTrack,
} from './utils/musicPlaylist';
import { resolveThemePreset } from './utils/themePresets';

type NavModuleKey =
  | 'dashboard'
  | 'catering'
  | 'sekolah'
  | 'keuangan'
  | 'stok'
  | 'pemasaran'
  | 'tampilan'
  | 'musik'
  | 'audit'
  | 'backup';

const SIDEBAR_NAV_ITEMS: {
  key: NavModuleKey;
  label: string;
  section: 'Utama' | 'Operasional' | 'Keuangan & Gudang' | 'Sistem';
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'dashboard', label: 'Ringkasan Eksekutif', section: 'Utama', icon: LayoutDashboard },
  { key: 'catering', label: 'Pesanan & Menu Catering', section: 'Operasional', icon: ChefHat },
  { key: 'sekolah', label: 'Program Sekolah Rakyat', section: 'Operasional', icon: School },
  { key: 'keuangan', label: 'Keuangan & Akuntansi', section: 'Keuangan & Gudang', icon: Wallet },
  { key: 'stok', label: 'Inventaris Bahan Baku', section: 'Keuangan & Gudang', icon: Package },
  { key: 'pemasaran', label: 'Promo & Voucher', section: 'Keuangan & Gudang', icon: Tag },
  { key: 'tampilan', label: 'Tampilan Web Pelanggan', section: 'Sistem', icon: LayoutTemplate },
  { key: 'musik', label: 'Musik Latar Aplikasi', section: 'Sistem', icon: Music2 },
  { key: 'audit', label: 'Log Audit Sistem', section: 'Sistem', icon: History },
  { key: 'backup', label: 'Super Admin & Backup', section: 'Sistem', icon: ShieldCheck },
];

const DEMO_PAID_NOTIFICATIONS: PaidNotificationItem[] = [
  {
    id: 'notif-demo-1',
    orderId: 'ord-20261116-001',
    orderNumber: 'ORD-20261116-001',
    customerName: 'PT Bank Mandiri (Persero) Tbk - Kanwil Jakarta',
    whatsapp: '08119823401',
    amount: 14850000,
    paymentMethod: 'Transfer Bank',
    paidAt: '16 Nov 2026 · 09:40 WIB',
    verifiedBy: 'Verifikasi Bank Mandiri ERP (Demo)',
    note: 'Pembayaran lunas untuk 350 porsi Paket Rapat VIP Sekat 5.',
    isRead: false,
  },
];

interface PendingConfirmState {
  title: string;
  description: string;
  confirmLabel: string;
  variant: 'danger' | 'warning' | 'primary';
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => Promise<void>;
}

const SYNC_STATUS_BADGE: Record<
  SyncStatus,
  { label: string; badgeClass: string; dotColor: string }
> = {
  idle: {
    label: 'Menunggu koneksi Cloud',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
    dotColor: 'text-slate-500',
  },
  connecting: {
    label: 'Menghubungkan database',
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-900',
    dotColor: 'text-sky-600',
  },
  synced: {
    label: 'Sinkronisasi berhasil',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    dotColor: 'text-emerald-600',
  },
  pending: {
    label: 'Sinkronisasi tertunda',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-900',
    dotColor: 'text-amber-600',
  },
  error: {
    label: 'Gagal terhubung',
    badgeClass: 'border-red-200 bg-red-50 text-red-900',
    dotColor: 'text-red-600',
  },
  unsaved: {
    label: 'Data belum tersimpan',
    badgeClass: 'border-amber-300 bg-amber-50 text-amber-950',
    dotColor: 'text-amber-700',
  },
};

export default function App() {
  const [viewMode, setViewMode] = useState<'customer' | 'admin'>('customer');
  const [workspaceMode, setWorkspaceMode] = useState<AppWorkspaceMode>('production');
  const [activeModule, setActiveModule] = useState<NavModuleKey>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginModalTab, setLoginModalTab] = useState<'login' | 'credentials'>('login');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  const [adminBannerNotice, setAdminBannerNotice] = useState<string>('');
  const [adminErrorNotice, setAdminErrorNotice] = useState<string>('');

  // Auth & RBAC State
  const [currentUid, setCurrentUid] = useState<string>('');
  const [isCloudAuthenticated, setIsCloudAuthenticated] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminUsername, setAdminUsername] = useState('admin');
  const [userEmail, setUserEmail] = useState('adminzikrul@gmail.com');
  const [userDisplayName, setUserDisplayName] = useState('Administrator Utama');
  const [currentRole, setCurrentRole] = useState<UserRole>('Super Admin');

  // Sync & Pagination State
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncErrorDetail, setSyncErrorDetail] = useState('');
  const [limitPerCollection, setLimitPerCollection] = useState<number>(200);
  const [hasMoreCloudData, setHasMoreCloudData] = useState<boolean>(false);

  // PRODUCTION ERP STATE: Starts completely empty ([]) — Firestore is the SOLE source of truth
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cateringOrders, setCateringOrders] = useState<CateringOrder[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [productionBatches, setProductionBatches] = useState<ProductionBatch[]>([]);
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [schoolDeliveries, setSchoolDeliveries] = useState<SchoolDelivery[]>([]);
  const [financeEntries, setFinanceEntries] = useState<FinanceEntry[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [promotions, setPromotions] = useState<PromotionItem[]>([]);
  const [users, setUsers] = useState<UserProfileRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Isolated DEMO STATE: Never touches Firestore or Production arrays
  const [demoSnapshot, setDemoSnapshot] = useState<ErpStateSnapshot>(() =>
    createInitialErpSeed('demo-workspace-uid')
  );
  const [demoAuditLogs, setDemoAuditLogs] = useState<AuditLogEntry[]>([
    {
      id: 'audit-demo-1',
      ownerId: 'demo-workspace-uid',
      entityType: 'catering_orders',
      entityId: 'ord-20261116-001',
      entityLabel: 'ORD-20261116-001',
      action: 'verify_payment',
      actorUid: 'demo-workspace-uid',
      actorName: 'Admin Demo',
      actorRole: 'Super Admin',
      details: 'Simulasi verifikasi pelunasan transfer Bank Mandiri.',
      timestampIso: '2026-11-16T09:40:00.000Z',
    },
  ]);

  // Customer storefront & public guest feed state (strictly separated from Firestore admin state)
  const publicShowcaseSeed = useMemo(() => createInitialErpSeed('public-showcase'), []);
  const [publicGuestOrders, setPublicGuestOrders] = useState<CateringOrder[]>([]);
  const deletedOrderIdsRef = useRef<Set<string>>(new Set());

  const [siteSettings, setSiteSettings] = useState<SiteContentSettings>(DEFAULT_SITE_SETTINGS);
  const [paidNotifications, setPaidNotifications] = useState<PaidNotificationItem[]>([]);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([DEFAULT_MUSIC_TRACK]);
  const [activeMusicTrackId, setActiveMusicTrackId] = useState<string | null>(
    DEFAULT_MUSIC_TRACK.id
  );

  // Confirmation modal state
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmState | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  // Audit Log search & filter
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('Semua');

  const showAdminNotice = useCallback((msg: string) => {
    setAdminErrorNotice('');
    setAdminBannerNotice(msg);
    setTimeout(() => setAdminBannerNotice(''), 5500);
  }, []);

  const showAdminError = useCallback((msg: string) => {
    setAdminBannerNotice('');
    setAdminErrorNotice(msg);
  }, []);

  const clearAllProductionState = useCallback(() => {
    setMenuItems([]);
    setCateringOrders([]);
    setCustomers([]);
    setProductionBatches([]);
    setSchools([]);
    setSchoolDeliveries([]);
    setFinanceEntries([]);
    setInventoryItems([]);
    setPromotions([]);
    setUsers([]);
    setAuditLogs([]);
    setHasMoreCloudData(false);
    setSyncStatus('idle');
    setSyncErrorDetail('');
  }, []);

  const buildActorContext = useCallback(
    (
      entityLabel: string,
      action: AuditLogEntry['action'],
      details: string
    ): AuditActorContext => ({
      actorUid: currentUid || 'local-admin',
      actorName: userDisplayName || adminUsername || 'Administrator',
      actorRole: currentRole,
      entityLabel,
      action,
      details,
    }),
    [currentUid, userDisplayName, adminUsername, currentRole]
  );

  const appendDemoAuditLog = useCallback(
    (
      entityType: AuditLogEntry['entityType'],
      entityId: string,
      entityLabel: string,
      action: AuditLogEntry['action'],
      details: string
    ) => {
      setDemoAuditLogs((prev) => [
        {
          id: `audit-demo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          ownerId: 'demo-workspace-uid',
          entityType,
          entityId,
          entityLabel,
          action,
          actorUid: 'demo-workspace-uid',
          actorName: userDisplayName || 'Admin Demo',
          actorRole: currentRole,
          details,
          timestampIso: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    [userDisplayName, currentRole]
  );

  // Listen to Google Maps Quota Exceeded Event
  useEffect(() => {
    const handleQuota = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Load persisted site settings, admin profile metadata, paid notifications & guest storefront orders
  useEffect(() => {
    let active = true;

    fetch('/api/site-settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.settings) return;
        setSiteSettings((prev) => ({
          ...prev,
          ...(data.settings as Partial<SiteContentSettings>),
        }));
      })
      .catch(() => {});

    fetch('/api/admin/account')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.account) return;
        const acc = data.account;
        if (acc.username) setAdminUsername(acc.username);
        if (acc.email) setUserEmail(acc.email);
        if (acc.displayName) setUserDisplayName(acc.displayName);
        if (acc.role) setCurrentRole(acc.role as UserRole);
      })
      .catch(() => {});

    fetch('/api/notifications/paid')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !Array.isArray(data?.notifications)) return;
        setPaidNotifications(data.notifications as PaidNotificationItem[]);
      })
      .catch(() => {});

    fetch('/api/public/orders')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !Array.isArray(data?.orders)) return;
        setPublicGuestOrders(data.orders as CateringOrder[]);
      })
      .catch(() => {});

    fetch('/api/music')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !Array.isArray(data?.tracks)) return;
        setMusicTracks(data.tracks as MusicTrack[]);
        setActiveMusicTrackId(
          typeof data.activeTrackId === 'string' ? data.activeTrackId : null
        );
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  // Listen ONLY to Paid Notifications when Admin is active (NEVER auto-merge /api/public/orders over Firestore!)
  useEffect(() => {
    if (viewMode !== 'admin' || !isAdminAuthenticated || workspaceMode === 'demo') return;
    let active = true;

    const refreshNotifications = () => {
      fetch('/api/notifications/paid')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!active || !Array.isArray(data?.notifications)) return;
          setPaidNotifications(data.notifications as PaidNotificationItem[]);
        })
        .catch(() => {});
    };

    refreshNotifications();
    const timer = setInterval(refreshNotifications, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [viewMode, isAdminAuthenticated, workspaceMode]);

  // Listen to Firebase Auth & Attach Real-Time Cloud Firestore Listeners (SOLE SOURCE OF TRUTH)
  useEffect(() => {
    let unsubscribeCollections: (() => void) | null = null;
    let previousUid = '';

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubscribeCollections) {
        unsubscribeCollections();
        unsubscribeCollections = null;
      }

      if (!firebaseUser) {
        // Account logged out -> strictly wipe previous user's state from memory
        setIsCloudAuthenticated(false);
        setCurrentUid('');
        clearAllProductionState();
        previousUid = '';
        return;
      }

      if (previousUid && previousUid !== firebaseUser.uid) {
        clearAllProductionState();
      }
      previousUid = firebaseUser.uid;

      setCurrentUid(firebaseUser.uid);
      setIsCloudAuthenticated(true);
      if (firebaseUser.email) setUserEmail(firebaseUser.email);
      if (firebaseUser.displayName) setUserDisplayName(firebaseUser.displayName);

      unsubscribeCollections = subscribeErpCollections(firebaseUser.uid, {
        limitPerCollection,
        onSyncStatusChange: (status, errMsg) => {
          setSyncStatus(status);
          setSyncErrorDetail(errMsg || '');
        },
        onHasMoreChange: setHasMoreCloudData,
        onMenuItems: setMenuItems,
        // CRITICAL: Direct replacement, NEVER merge with prev array!
        onCateringOrders: setCateringOrders,
        onCustomers: setCustomers,
        onProductionBatches: setProductionBatches,
        onSchools: setSchools,
        onSchoolDeliveries: setSchoolDeliveries,
        onFinanceEntries: setFinanceEntries,
        onInventoryItems: setInventoryItems,
        onPromotions: setPromotions,
        onUsers: setUsers,
        onAuditLogs: setAuditLogs,
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeCollections) unsubscribeCollections();
    };
  }, [clearAllProductionState, limitPerCollection]);

  // Active workspace snapshot depending on Production vs Demo Mode
  const activeSnapshot: ErpStateSnapshot = useMemo(() => {
    if (workspaceMode === 'demo') return demoSnapshot;
    return {
      menuItems,
      cateringOrders,
      customers,
      productionBatches,
      schools,
      schoolDeliveries,
      financeEntries,
      inventoryItems,
      promotions,
      users,
    };
  }, [
    workspaceMode,
    demoSnapshot,
    menuItems,
    cateringOrders,
    customers,
    productionBatches,
    schools,
    schoolDeliveries,
    financeEntries,
    inventoryItems,
    promotions,
    users,
  ]);

  const activeAuditLogs = workspaceMode === 'demo' ? demoAuditLogs : auditLogs;
  const activePaidNotifications =
    workspaceMode === 'demo' ? DEMO_PAID_NOTIFICATIONS : paidNotifications;
  const activeOwnerId = workspaceMode === 'demo' ? 'demo-workspace-uid' : currentUid || 'local-session';

  // Detect guest storefront orders created offline not yet imported into Firestore
  const unimportedPublicOrders = useMemo(() => {
    if (workspaceMode !== 'production' || !isCloudAuthenticated) return [];
    const cloudIds = new Set(cateringOrders.map((o) => o.id));
    return publicGuestOrders.filter(
      (g) => !cloudIds.has(g.id) && !deletedOrderIdsRef.current.has(g.id)
    );
  }, [workspaceMode, isCloudAuthenticated, cateringOrders, publicGuestOrders]);

  const handleImportPublicOrdersToFirestore = async () => {
    if (!isCloudAuthenticated || unimportedPublicOrders.length === 0) return;
    setSyncStatus('pending');
    try {
      for (const ord of unimportedPublicOrders) {
        await saveCloudDocument(
          'catering_orders',
          ord.id,
          { ...ord, ownerId: currentUid },
          buildActorContext(
            ord.orderNumber,
            'create',
            `Impor pesanan Web Pelanggan ${ord.orderNumber} (${ord.customerName}) ke Firestore.`
          )
        );
      }
      setSyncStatus('synced');
      showAdminNotice(
        `${unimportedPublicOrders.length} pesanan dari Web Pelanggan berhasil disinkronkan ke Cloud Firestore.`
      );
    } catch (err) {
      setSyncStatus('error');
      showAdminError(
        `Gagal mengimpor pesanan Web Pelanggan ke Firestore: ${
          err instanceof Error ? err.message : 'Kesalahan server'
        }`
      );
    }
  };

  // Generic Save Helper with Rollback & Server Confirmation
  const saveEntityToCloud = async <T extends { id: string }>(
    colName: AuditLogEntry['entityType'],
    item: T,
    stateList: T[],
    setStateList: React.Dispatch<React.SetStateAction<T[]>>,
    actorContext: AuditActorContext
  ): Promise<void> => {
    const prevSnapshot = stateList;
    const exists = stateList.some((x) => x.id === item.id);
    setStateList(exists ? stateList.map((x) => (x.id === item.id ? item : x)) : [item, ...stateList]);

    if (!isCloudAuthenticated) {
      setSyncStatus('unsaved');
      return;
    }

    setSyncStatus('pending');
    try {
      await saveCloudDocument(
        colName,
        item.id,
        { ...(item as Record<string, unknown>), ownerId: currentUid },
        actorContext
      );
      setSyncStatus('synced');
    } catch (err) {
      // Rollback local UI immediately so state always reflects Firestore truth!
      setStateList(prevSnapshot);
      setSyncStatus('error');
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan ke Cloud Firestore.';
      showAdminError(`Gagal menyimpan ke server (${colName}): ${msg}`);
      throw err;
    }
  };

  // Generic Confirmed Delete Helper with Rollback & Server Confirmation
  const executeConfirmedDelete = async <T extends { id: string }>(
    colName: AuditLogEntry['entityType'],
    id: string,
    stateList: T[],
    setStateList: React.Dispatch<React.SetStateAction<T[]>>,
    actorContext: AuditActorContext,
    onAfterDelete?: () => Promise<void> | void
  ): Promise<void> => {
    const prevSnapshot = stateList;
    setStateList(stateList.filter((x) => x.id !== id));

    if (isCloudAuthenticated) {
      setSyncStatus('pending');
      try {
        await deleteCloudDocument(colName, id, currentUid, actorContext);
        if (onAfterDelete) await onAfterDelete();
        setSyncStatus('synced');
      } catch (err) {
        // Rollback local state on failure
        setStateList(prevSnapshot);
        setSyncStatus('error');
        const msg = err instanceof Error ? err.message : 'Gagal menghapus dokumen di Firestore.';
        showAdminError(`Penghapusan dibatalkan karena gagal di server: ${msg}`);
        throw err;
      }
    } else if (onAfterDelete) {
      await onAfterDelete();
    }
  };

  // Confirm an order is Paid ("Sudah Dibayar / Lunas") and emit Paid Notification + Finance Ledger
  const handleConfirmOrderPaid = async (order: CateringOrder, customVerifiedBy?: string) => {
    const nowTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    });
    const todayIso = getJakartaTodayIso();
    const verifier =
      customVerifiedBy ||
      (order.paymentMethod === 'QRIS'
        ? 'Pembayaran QRIS Berhasil'
        : `${userDisplayName} (@${adminUsername})`);
    const verifiedAt = new Date().toISOString();

    const nextStatus: CateringOrder['status'] =
      order.status === 'Pesanan baru' ||
      order.status === 'Menunggu pembayaran' ||
      order.status === 'DP masuk'
        ? 'Diproses'
        : order.status;

    const nextHistory: OrderStatusHistoryItem[] = [
      ...(order.statusHistory || []),
      {
        status: nextStatus,
        timestamp: verifiedAt,
        actor: verifier,
        note: `Verifikasi pembayaran lunas (${order.paymentMethod || 'Transfer Bank'})`,
      },
    ];

    const updatedOrder: CateringOrder = {
      ...order,
      paymentStatus: 'Lunas',
      downPayment: order.totalPayment,
      remainingBalance: 0,
      paymentVerifiedAt: verifiedAt,
      paymentVerifiedBy: verifier,
      status: nextStatus,
      statusHistory: nextHistory,
      statusHistoryJson: JSON.stringify(nextHistory).slice(0, 2000),
    };

    if (workspaceMode === 'demo') {
      setDemoSnapshot((prev) => ({
        ...prev,
        cateringOrders: prev.cateringOrders.some((o) => o.id === order.id)
          ? prev.cateringOrders.map((o) => (o.id === order.id ? updatedOrder : o))
          : [updatedOrder, ...prev.cateringOrders],
      }));
      appendDemoAuditLog(
        'catering_orders',
        updatedOrder.id,
        updatedOrder.orderNumber,
        'verify_payment',
        `Simulasi konfirmasi lunas ${formatRupiah(updatedOrder.totalPayment)}.`
      );
      showAdminNotice(
        `[MODE DEMO] Pembayaran ${updatedOrder.orderNumber} berhasil diverifikasi Lunas.`
      );
      return;
    }

    await saveEntityToCloud(
      'catering_orders',
      updatedOrder,
      cateringOrders,
      setCateringOrders,
      buildActorContext(
        updatedOrder.orderNumber,
        'verify_payment',
        `Verifikasi pelunasan ${updatedOrder.orderNumber} (${updatedOrder.customerName}) senilai ${formatRupiah(
          updatedOrder.totalPayment
        )} via ${updatedOrder.paymentMethod || 'Transfer Bank'}.`
      )
    );

    // Sync public order tracking store if present
    fetch('/api/orders/confirm-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        customerName: updatedOrder.customerName,
        whatsapp: updatedOrder.whatsapp,
        amount: updatedOrder.totalPayment,
        paymentMethod: updatedOrder.paymentMethod || 'Transfer Bank',
        verifiedBy: verifier,
        note: `Pembayaran ${updatedOrder.paymentMethod || 'Transfer Bank'} pesanan ${updatedOrder.orderNumber} terverifikasi Lunas.`,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.notifications)) {
          setPaidNotifications(data.notifications as PaidNotificationItem[]);
        }
      })
      .catch(() => {});

    // Prevent duplicate FinanceEntry for same orderRef / LUNAS-ref
    const finRefCode = `LUNAS-${updatedOrder.orderNumber}`;
    const alreadyInFinance = financeEntries.some(
      (f) =>
        f.referenceCode === finRefCode ||
        (f.orderRef === updatedOrder.orderNumber &&
          f.category === 'Pelunasan Pesanan Catering' &&
          f.settlementStatus === 'Lunas')
    );
    if (!alreadyInFinance) {
      const mappedAccountMethod: FinanceEntry['accountMethod'] =
        updatedOrder.paymentMethod === 'QRIS'
          ? 'QRIS'
          : updatedOrder.paymentMethod === 'Pembayaran Tunai'
          ? 'Kas Tunai'
          : 'Bank Mandiri ERP';

      const newFin: FinanceEntry = {
        id: `fin-paid-${Date.now()}`,
        ownerId: activeOwnerId,
        transactionDate: todayIso,
        referenceCode: finRefCode,
        orderRef: updatedOrder.orderNumber,
        type: 'Pendapatan Catering',
        category: 'Pelunasan Pesanan Catering',
        description: `Pembayaran Lunas (${updatedOrder.paymentMethod || 'Transfer Bank'}) Pesanan ${updatedOrder.orderNumber} — ${updatedOrder.customerName}`,
        amount: updatedOrder.totalPayment,
        accountMethod: mappedAccountMethod,
        settlementStatus: 'Lunas',
      };
      await handleSaveFinance(newFin);
    }

    showAdminNotice(
      updatedOrder.paymentMethod === 'QRIS'
        ? `PEMBAYARAN BERHASIL (QRIS · ${nowTime} WIB): Pesanan ${updatedOrder.orderNumber} (${updatedOrder.customerName}) senilai ${formatRupiah(
            updatedOrder.totalPayment
          )} terverifikasi Lunas.`
        : `Pembayaran Pesanan ${updatedOrder.orderNumber} (${updatedOrder.customerName}) senilai ${formatRupiah(
            updatedOrder.totalPayment
          )} berhasil diverifikasi Lunas.`
    );
  };

  // Public Guest Order submission (no login required on storefront)
  const handlePublicCustomerOrderSubmit = async (
    order: CateringOrder
  ): Promise<CateringOrder> => {
    const initialHistory: OrderStatusHistoryItem[] = order.statusHistory || [
      {
        status: order.status,
        timestamp: new Date().toISOString(),
        actor: 'Web Pelanggan',
        note: 'Pesanan dikirim melalui halaman depan pelanggan.',
      },
    ];
    const preparedOrder: CateringOrder = {
      ...order,
      statusHistory: initialHistory,
      statusHistoryJson: JSON.stringify(initialHistory).slice(0, 2000),
    };

    let savedOrder = preparedOrder;
    try {
      const response = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preparedOrder),
      });
      if (response.ok) {
        const payload = await response.json();
        if (payload?.order) {
          savedOrder = { ...preparedOrder, ...payload.order };
        }
      }
    } catch {
      // Fallback
    }

    setPublicGuestOrders((prev) => [savedOrder, ...prev.filter((o) => o.id !== savedOrder.id)]);

    if (workspaceMode === 'production' && isCloudAuthenticated) {
      await saveEntityToCloud(
        'catering_orders',
        savedOrder,
        cateringOrders,
        setCateringOrders,
        buildActorContext(
          savedOrder.orderNumber,
          'create',
          `Pesanan pelanggan online ${savedOrder.orderNumber} (${savedOrder.customerName}).`
        )
      );
    } else if (workspaceMode === 'demo') {
      setDemoSnapshot((prev) => ({
        ...prev,
        cateringOrders: [savedOrder, ...prev.cateringOrders.filter((o) => o.id !== savedOrder.id)],
      }));
    }

    return savedOrder;
  };

  // CRUD Handlers — Production routes strictly through Firestore + Audit Log; Demo routes to isolated demoSnapshot
  const handleSaveMenu = async (item: MenuItem) => {
    if (workspaceMode === 'demo') {
      setDemoSnapshot((prev) => ({
        ...prev,
        menuItems: prev.menuItems.some((m) => m.id === item.id)
          ? prev.menuItems.map((m) => (m.id === item.id ? item : m))
          : [item, ...prev.menuItems],
      }));
      appendDemoAuditLog('menu_items', item.id, item.name, 'update', `Simulasi simpan menu ${item.name}`);
      return;
    }
    const isEdit = menuItems.some((m) => m.id === item.id);
    await saveEntityToCloud(
      'menu_items',
      item,
      menuItems,
      setMenuItems,
      buildActorContext(item.name, isEdit ? 'update' : 'create', `${isEdit ? 'Ubah' : 'Tambah'} menu ${item.name}`)
    );
  };

  const handleDeleteMenu = async (id: string) => {
    const target = activeSnapshot.menuItems.find((m) => m.id === id);
    setPendingConfirm({
      title: 'Hapus Menu Makanan?',
      description: `Menu "${target?.name || id}" akan dihapus secara permanen dari katalog aktif dan dicatat dalam Log Audit.`,
      confirmLabel: 'Hapus Menu Permanen',
      variant: 'danger',
      onConfirm: async () => {
        if (workspaceMode === 'demo') {
          setDemoSnapshot((prev) => ({
            ...prev,
            menuItems: prev.menuItems.filter((m) => m.id !== id),
          }));
          appendDemoAuditLog('menu_items', id, target?.name || id, 'delete', 'Hapus menu (Demo)');
          return;
        }
        await executeConfirmedDelete(
          'menu_items',
          id,
          menuItems,
          setMenuItems,
          buildActorContext(target?.name || id, 'delete', `Menghapus menu "${target?.name || id}"`)
        );
        showAdminNotice(`Menu "${target?.name || id}" berhasil dihapus.`);
      },
    });
  };

  const handleSaveOrder = async (order: CateringOrder) => {
    const enrichedOrder: CateringOrder = {
      ...order,
      statusHistoryJson: order.statusHistory
        ? JSON.stringify(order.statusHistory).slice(0, 2000)
        : order.statusHistoryJson,
    };

    if (workspaceMode === 'demo') {
      setDemoSnapshot((prev) => ({
        ...prev,
        cateringOrders: prev.cateringOrders.some((o) => o.id === order.id)
          ? prev.cateringOrders.map((o) => (o.id === order.id ? enrichedOrder : o))
          : [enrichedOrder, ...prev.cateringOrders],
      }));
      appendDemoAuditLog(
        'catering_orders',
        order.id,
        order.orderNumber,
        'update',
        `Simulasi simpan pesanan ${order.orderNumber} (${order.status})`
      );
      return;
    }

    const isEdit = cateringOrders.some((o) => o.id === order.id);
    await saveEntityToCloud(
      'catering_orders',
      enrichedOrder,
      cateringOrders,
      setCateringOrders,
      buildActorContext(
        order.orderNumber,
        isEdit ? 'update' : 'create',
        `${isEdit ? 'Perbarui' : 'Buat'} pesanan ${order.orderNumber} · Status: ${order.status} · Bayar: ${order.paymentStatus}`
      )
    );
  };

  const handleCancelOrder = async (order: CateringOrder) => {
    setPendingConfirm({
      title: `Batalkan Pesanan ${order.orderNumber}?`,
      description: `Pesanan atas nama "${order.customerName}" akan diubah menjadi Dibatalkan. Alasan pembatalan wajib dicatat untuk jejak audit.`,
      confirmLabel: 'Batalkan Pesanan',
      variant: 'warning',
      requireReason: true,
      reasonLabel: 'Alasan Pembatalan Pesanan',
      reasonPlaceholder: 'Contoh: Pelanggan menunda jadwal acara atau pembatalan sebelum produksi...',
      onConfirm: async (reason) => {
        const cleanReason = reason || 'Dibatalkan oleh admin';
        const nextHistory: OrderStatusHistoryItem[] = [
          ...(order.statusHistory || []),
          {
            status: 'Dibatalkan',
            timestamp: new Date().toISOString(),
            actor: `${userDisplayName} (${currentRole})`,
            note: `Dibatalkan: ${cleanReason}`,
          },
        ];
        const cancelledOrder: CateringOrder = {
          ...order,
          status: 'Dibatalkan',
          cancellationReason: cleanReason,
          statusHistory: nextHistory,
          statusHistoryJson: JSON.stringify(nextHistory).slice(0, 2000),
        };
        if (workspaceMode === 'demo') {
          setDemoSnapshot((prev) => ({
            ...prev,
            cateringOrders: prev.cateringOrders.map((o) =>
              o.id === order.id ? cancelledOrder : o
            ),
          }));
          appendDemoAuditLog(
            'catering_orders',
            order.id,
            order.orderNumber,
            'cancel',
            `Dibatalkan (Demo): ${cleanReason}`
          );
          return;
        }
        await saveEntityToCloud(
          'catering_orders',
          cancelledOrder,
          cateringOrders,
          setCateringOrders,
          buildActorContext(
            order.orderNumber,
            'cancel',
            `Membatalkan pesanan ${order.orderNumber}: ${cleanReason}`
          )
        );
        showAdminNotice(`Pesanan ${order.orderNumber} dibatalkan dengan alasan tercatat di audit log.`);
      },
    });
  };

  const handleDeleteOrder = async (id: string) => {
    const target = activeSnapshot.cateringOrders.find((o) => o.id === id);
    setPendingConfirm({
      title: `Hapus Pesanan ${target?.orderNumber || id}?`,
      description: `Pesanan "${target?.customerName || id}" akan dihapus secara permanen dari Firestore dan tidak akan muncul kembali saat reload.`,
      confirmLabel: 'Hapus Pesanan Permanen',
      variant: 'danger',
      onConfirm: async () => {
        deletedOrderIdsRef.current.add(id);
        setPublicGuestOrders((prev) => prev.filter((o) => o.id !== id));

        if (workspaceMode === 'demo') {
          setDemoSnapshot((prev) => ({
            ...prev,
            cateringOrders: prev.cateringOrders.filter((o) => o.id !== id),
          }));
          appendDemoAuditLog('catering_orders', id, target?.orderNumber || id, 'delete', 'Hapus pesanan (Demo)');
          return;
        }

        await executeConfirmedDelete(
          'catering_orders',
          id,
          cateringOrders,
          setCateringOrders,
          buildActorContext(
            target?.orderNumber || id,
            'delete',
            `Menghapus permanen pesanan ${target?.orderNumber || id} (${target?.customerName || '-'})`
          ),
          async () => {
            await fetch(`/api/public/orders/${encodeURIComponent(id)}`, {
              method: 'DELETE',
            }).catch(() => {});
          }
        );
        showAdminNotice(`Pesanan ${target?.orderNumber || id} berhasil dihapus permanen dari database.`);
      },
    });
  };

  const handleSaveCustomer = async (customer: CustomerRecord) => {
    if (workspaceMode === 'demo') {
      setDemoSnapshot((prev) => ({
        ...prev,
        customers: prev.customers.some((c) => c.id === customer.id)
          ? prev.customers.map((c) => (c.id === customer.id ? customer : c))
          : [customer, ...prev.customers],
      }));
      return;
    }
    const isEdit = customers.some((c) => c.id === customer.id);
    await saveEntityToCloud(
      'customers',
      customer,
      customers,
      setCustomers,
      buildActorContext(customer.name, isEdit ? 'update' : 'create', `${isEdit ? 'Edit' : 'Tambah'} pelanggan ${customer.name}`)
    );
  };

  const handleDeleteCustomer = async (id: string) => {
    const target = activeSnapshot.customers.find((c) => c.id === id);
    setPendingConfirm({
      title: 'Hapus Data Pelanggan?',
      description: `Data pelanggan "${target?.name || id}" akan dihapus permanen dari database.`,
      confirmLabel: 'Hapus Pelanggan',
      variant: 'danger',
      onConfirm: async () => {
        if (workspaceMode === 'demo') {
          setDemoSnapshot((prev) => ({
            ...prev,
            customers: prev.customers.filter((c) => c.id !== id),
          }));
          return;
        }
        await executeConfirmedDelete(
          'customers',
          id,
          customers,
          setCustomers,
          buildActorContext(target?.name || id, 'delete', `Menghapus pelanggan ${target?.name || id}`)
        );
        showAdminNotice(`Pelanggan "${target?.name || id}" berhasil dihapus.`);
      },
    });
  };

  const handleSaveProduction = async (batch: ProductionBatch) => {
    if (workspaceMode === 'demo') {
      setDemoSnapshot((prev) => ({
        ...prev,
        productionBatches: prev.productionBatches.some((b) => b.id === batch.id)
          ? prev.productionBatches.map((b) => (b.id === batch.id ? batch : b))
          : [batch, ...prev.productionBatches],
      }));
      return;
    }
    const isEdit = productionBatches.some((b) => b.id === batch.id);
    await saveEntityToCloud(
      'production_batches',
      batch,
      productionBatches,
      setProductionBatches,
      buildActorContext(batch.menuName, isEdit ? 'update' : 'create', `Batch produksi ${batch.menuName} (${batch.portions} porsi)`)
    );
  };

  const handleDeleteProduction = async (id: string) => {
    const target = activeSnapshot.productionBatches.find((b) => b.id === id);
    setPendingConfirm({
      title: 'Hapus Jadwal Produksi?',
      description: `Jadwal produksi "${target?.menuName || id}" akan dihapus permanen.`,
      confirmLabel: 'Hapus Produksi',
      variant: 'danger',
      onConfirm: async () => {
        if (workspaceMode === 'demo') {
          setDemoSnapshot((prev) => ({
            ...prev,
            productionBatches: prev.productionBatches.filter((b) => b.id !== id),
          }));
          return;
        }
        await executeConfirmedDelete(
          'production_batches',
          id,
          productionBatches,
          setProductionBatches,
          buildActorContext(target?.menuName || id, 'delete', `Menghapus batch produksi ${target?.menuName || id}`)
        );
        showAdminNotice(`Batch produksi "${target?.menuName || id}" berhasil dihapus.`);
      },
    });
  };

  const handleSaveSchool = async (school: SchoolRecord) => {
    if (workspaceMode === 'demo') {
      setDemoSnapshot((prev) => ({
        ...prev,
        schools: prev.schools.some((s) => s.id === school.id)
          ? prev.schools.map((s) => (s.id === school.id ? school : s))
          : [school, ...prev.schools],
      }));
      return;
    }
    const isEdit = schools.some((s) => s.id === school.id);
    await saveEntityToCloud(
      'schools',
      school,
      schools,
      setSchools,
      buildActorContext(school.schoolName, isEdit ? 'update' : 'create', `${isEdit ? 'Perbarui' : 'Tambah'} sekolah ${school.schoolName} (NPSN ${school.npsn})`)
    );
  };

  const handleDeleteSchool = async (id: string) => {
    const target = activeSnapshot.schools.find((s) => s.id === id);
    setPendingConfirm({
      title: 'Hapus Data Sekolah Mitra?',
      description: `Sekolah "${target?.schoolName || id}" akan dihapus permanen dari daftar Sekolah Rakyat.`,
      confirmLabel: 'Hapus Sekolah',
      variant: 'danger',
      onConfirm: async () => {
        if (workspaceMode === 'demo') {
          setDemoSnapshot((prev) => ({
            ...prev,
            schools: prev.schools.filter((s) => s.id !== id),
          }));
          return;
        }
        await executeConfirmedDelete(
          'schools',
          id,
          schools,
          setSchools,
          buildActorContext(target?.schoolName || id, 'delete', `Menghapus sekolah mitra ${target?.schoolName || id}`)
        );
        showAdminNotice(`Sekolah "${target?.schoolName || id}" berhasil dihapus.`);
      },
    });
  };

  const handleSaveDelivery = async (delivery: SchoolDelivery) => {
    if (workspaceMode === 'demo') {
      setDemoSnapshot((prev) => ({
        ...prev,
        schoolDeliveries: prev.schoolDeliveries.some((d) => d.id === delivery.id)
          ? prev.schoolDeliveries.map((d) => (d.id === delivery.id ? delivery : d))
          : [delivery, ...prev.schoolDeliveries],
      }));
      return;
    }
    const isEdit = schoolDeliveries.some((d) => d.id === delivery.id);
    await saveEntityToCloud(
      'school_deliveries',
      delivery,
      schoolDeliveries,
      setSchoolDeliveries,
      buildActorContext(
        delivery.schoolName,
        isEdit ? 'update' : 'create',
        `Distribusi Sekolah Rakyat ${delivery.schoolName} (${delivery.portionsDelivered} porsi · ${delivery.status})`
      )
    );
  };

  const handleDeleteDelivery = async (id: string) => {
    const target = activeSnapshot.schoolDeliveries.find((d) => d.id === id);
    setPendingConfirm({
      title: 'Hapus Catatan Distribusi?',
      description: `Pengiriman ke "${target?.schoolName || id}" tanggal ${target?.deliveryDate || '-'} akan dihapus permanen.`,
      confirmLabel: 'Hapus Pengiriman',
      variant: 'danger',
      onConfirm: async () => {
        if (workspaceMode === 'demo') {
          setDemoSnapshot((prev) => ({
            ...prev,
            schoolDeliveries: prev.schoolDeliveries.filter((d) => d.id !== id),
          }));
          return;
        }
        await executeConfirmedDelete(
          'school_deliveries',
          id,
          schoolDeliveries,
          setSchoolDeliveries,
          buildActorContext(
            target?.schoolName || id,
            'delete',
            `Menghapus catatan distribusi ${target?.schoolName || id}`
          )
        );
        showAdminNotice(`Catatan pengiriman ke ${target?.schoolName || id} berhasil dihapus.`);
      },
    });
  };

  const handleSaveFinance = async (entry: FinanceEntry) => {
    if (workspaceMode === 'demo') {
      setDemoSnapshot((prev) => ({
        ...prev,
        financeEntries: prev.financeEntries.some((f) => f.id === entry.id)
          ? prev.financeEntries.map((f) => (f.id === entry.id ? entry : f))
          : [entry, ...prev.financeEntries],
      }));
      appendDemoAuditLog(
        'finance_entries',
        entry.id,
        entry.referenceCode,
        entry.reconciled ? 'reconcile' : 'update',
        `${entry.type} ${formatRupiah(entry.amount)} (${entry.accountMethod})`
      );
      return;
    }
    const existing = financeEntries.find((f) => f.id === entry.id);
    const actionType: AuditLogEntry['action'] =
      !existing
        ? 'create'
        : entry.reconciled && !existing.reconciled
        ? 'reconcile'
        : 'update';
    const detailMsg = entry.correctionNote
      ? `Koreksi jurnal ${entry.referenceCode}: ${entry.correctionNote} (${formatRupiah(entry.amount)})`
      : `${actionType === 'reconcile' ? 'Rekonsiliasi terkunci' : actionType === 'create' ? 'Catat jurnal' : 'Ubah jurnal'} ${entry.referenceCode} · ${entry.type} · ${formatRupiah(entry.amount)}`;

    await saveEntityToCloud(
      'finance_entries',
      entry,
      financeEntries,
      setFinanceEntries,
      buildActorContext(entry.referenceCode, actionType, detailMsg)
    );
  };

  const handleDeleteFinance = async (id: string) => {
    const target = activeSnapshot.financeEntries.find((f) => f.id === id);
    if (target?.reconciled) {
      showAdminError(
        `Jurnal ${target.referenceCode} telah direkonsiliasi dan terkunci. Tidak dapat dihapus.`
      );
      return;
    }
    setPendingConfirm({
      title: `Hapus Jurnal ${target?.referenceCode || id}?`,
      description: `Transaksi "${target?.description || id}" senilai ${formatRupiah(
        target?.amount || 0
      )} akan dihapus permanen dan tercatat di Log Audit.`,
      confirmLabel: 'Hapus Jurnal Permanen',
      variant: 'danger',
      onConfirm: async () => {
        if (workspaceMode === 'demo') {
          setDemoSnapshot((prev) => ({
            ...prev,
            financeEntries: prev.financeEntries.filter((f) => f.id !== id),
          }));
          appendDemoAuditLog('finance_entries', id, target?.referenceCode || id, 'delete', 'Hapus jurnal (Demo)');
          return;
        }
        await executeConfirmedDelete(
          'finance_entries',
          id,
          financeEntries,
          setFinanceEntries,
          buildActorContext(
            target?.referenceCode || id,
            'delete',
            `Menghapus jurnal ${target?.referenceCode || id} senilai ${formatRupiah(target?.amount || 0)}`
          )
        );
        showAdminNotice(`Jurnal ${target?.referenceCode || id} berhasil dihapus permanen.`);
      },
    });
  };

  const handleSaveInventory = async (item: InventoryItem) => {
    if (workspaceMode === 'demo') {
      setDemoSnapshot((prev) => ({
        ...prev,
        inventoryItems: prev.inventoryItems.some((i) => i.id === item.id)
          ? prev.inventoryItems.map((i) => (i.id === item.id ? item : i))
          : [item, ...prev.inventoryItems],
      }));
      return;
    }
    const isEdit = inventoryItems.some((i) => i.id === item.id);
    await saveEntityToCloud(
      'inventory_items',
      item,
      inventoryItems,
      setInventoryItems,
      buildActorContext(item.name, isEdit ? 'update' : 'create', `${item.itemCode} ${item.name} (${item.stockQty} ${item.unit})`)
    );
  };

  const handleDeleteInventory = async (id: string) => {
    const target = activeSnapshot.inventoryItems.find((i) => i.id === id);
    setPendingConfirm({
      title: 'Hapus Item Persediaan?',
      description: `Bahan baku "${target?.name || id}" akan dihapus permanen dari inventaris gudang.`,
      confirmLabel: 'Hapus Item Stok',
      variant: 'danger',
      onConfirm: async () => {
        if (workspaceMode === 'demo') {
          setDemoSnapshot((prev) => ({
            ...prev,
            inventoryItems: prev.inventoryItems.filter((i) => i.id !== id),
          }));
          return;
        }
        await executeConfirmedDelete(
          'inventory_items',
          id,
          inventoryItems,
          setInventoryItems,
          buildActorContext(target?.name || id, 'delete', `Menghapus stok ${target?.itemCode || ''} ${target?.name || id}`)
        );
        showAdminNotice(`Item stok "${target?.name || id}" berhasil dihapus.`);
      },
    });
  };

  const handleSavePromotion = async (promo: PromotionItem) => {
    if (workspaceMode === 'demo') {
      setDemoSnapshot((prev) => ({
        ...prev,
        promotions: prev.promotions.some((p) => p.id === promo.id)
          ? prev.promotions.map((p) => (p.id === promo.id ? promo : p))
          : [promo, ...prev.promotions],
      }));
      return;
    }
    const isEdit = promotions.some((p) => p.id === promo.id);
    await saveEntityToCloud(
      'promotions',
      promo,
      promotions,
      setPromotions,
      buildActorContext(promo.promoCode, isEdit ? 'update' : 'create', `Promo ${promo.promoCode} (${promo.discountPercent}%)`)
    );
  };

  const handleDeletePromotion = async (id: string) => {
    const target = activeSnapshot.promotions.find((p) => p.id === id);
    setPendingConfirm({
      title: 'Hapus Voucher Promo?',
      description: `Kode promo "${target?.promoCode || id}" akan dihapus permanen.`,
      confirmLabel: 'Hapus Promo',
      variant: 'danger',
      onConfirm: async () => {
        if (workspaceMode === 'demo') {
          setDemoSnapshot((prev) => ({
            ...prev,
            promotions: prev.promotions.filter((p) => p.id !== id),
          }));
          return;
        }
        await executeConfirmedDelete(
          'promotions',
          id,
          promotions,
          setPromotions,
          buildActorContext(target?.promoCode || id, 'delete', `Menghapus promo ${target?.promoCode || id}`)
        );
        showAdminNotice(`Promo "${target?.promoCode || id}" berhasil dihapus.`);
      },
    });
  };

  const handleSaveUser = async (user: UserProfileRecord) => {
    if (workspaceMode === 'demo') {
      setDemoSnapshot((prev) => ({
        ...prev,
        users: [user, ...prev.users.filter((u) => u.id !== user.id)],
      }));
      return;
    }
    await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user }),
    }).catch(() => {});

    const isEdit = users.some((u) => u.id === user.id);
    await saveEntityToCloud(
      'users',
      user,
      users,
      setUsers,
      buildActorContext(user.displayName, isEdit ? 'update' : 'create', `Akun ${user.displayName} (${user.role})`)
    );
  };

  const handleDeleteUser = async (id: string) => {
    if (currentRole !== 'Super Admin') {
      showAdminError('Akses ditolak: Hanya Super Admin yang dapat menghapus akun pengguna.');
      return;
    }
    const target = activeSnapshot.users.find((u) => u.id === id);
    setPendingConfirm({
      title: 'Hapus Akun Pengguna?',
      description: `Akun "${target?.displayName || id}" (${target?.email || '-'}) akan dihapus permanen oleh Super Admin.`,
      confirmLabel: 'Hapus Akun',
      variant: 'danger',
      onConfirm: async () => {
        if (workspaceMode === 'demo') {
          setDemoSnapshot((prev) => ({
            ...prev,
            users: prev.users.filter((u) => u.id !== id),
          }));
          return;
        }
        await executeConfirmedDelete(
          'users',
          id,
          users,
          setUsers,
          buildActorContext(target?.displayName || id, 'delete', `Super Admin menghapus akun ${target?.email || id}`),
          async () => {
            await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
              method: 'DELETE',
            }).catch(() => {});
          }
        );
        showAdminNotice(`Akun "${target?.displayName || id}" berhasil dihapus oleh Super Admin.`);
      },
    });
  };

  // Explicit Super Admin Restore ONLY via Confirmation Modal
  const handleRestoreBackup = async (snapshot: ErpStateSnapshot) => {
    if (currentRole !== 'Super Admin') {
      showAdminError('Hanya Super Admin yang berwenang melakukan pemulihan (Restore) database.');
      return;
    }
    setPendingConfirm({
      title: 'Konfirmasi Pemulihan Database (Restore Backup)?',
      description: `Anda akan menimpa/menambahkan ${snapshot.cateringOrders.length} pesanan, ${snapshot.financeEntries.length} jurnal keuangan, dan ${snapshot.schools.length} sekolah ke ${
        workspaceMode === 'demo' ? 'Workspace Demo' : 'Cloud Firestore Produksi'
      }. Pastikan ini tindakan yang disengaja.`,
      confirmLabel: 'Ya, Jalankan Restore',
      variant: 'warning',
      onConfirm: async () => {
        if (workspaceMode === 'demo') {
          setDemoSnapshot(snapshot);
          appendDemoAuditLog(
            'backup_restore',
            `restore-${Date.now()}`,
            'Restore JSON Demo',
            'restore',
            `Restore manual pada Mode Demo`
          );
          showAdminNotice('Data Mode Demo berhasil dipulihkan dari file backup.');
          return;
        }
        if (!isCloudAuthenticated) {
          showAdminError('Hubungkan akun Google (Cloud Firestore) terlebih dahulu untuk restore produksi.');
          return;
        }
        setSyncStatus('pending');
        try {
          await restoreSnapshotToFirestore(
            currentUid,
            snapshot,
            buildActorContext(
              'Restore Backup JSON',
              'restore',
              `Super Admin memulihkan ${snapshot.cateringOrders.length} pesanan & ${snapshot.financeEntries.length} jurnal ke Firestore.`
            )
          );
          setSyncStatus('synced');
          showAdminNotice('Pemulihan backup berhasil disinkronkan ke Cloud Firestore.');
        } catch (err) {
          setSyncStatus('error');
          showAdminError(
            `Restore gagal di server: ${err instanceof Error ? err.message : 'Kesalahan Firestore'}`
          );
          throw err;
        }
      },
    });
  };

  const handleSaveSiteSettings = async (nextSettings: SiteContentSettings) => {
    setSiteSettings(nextSettings);
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: nextSettings }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.settings) {
          setSiteSettings((prev) => ({
            ...prev,
            ...(data.settings as Partial<SiteContentSettings>),
          }));
        }
      }
    } catch {
      // Non-blocking fallback
    }
  };

  // Background Music Management Handlers
  const handleAddUploadedMusicTrack = async (payload: {
    title: string;
    fileName: string;
    dataBase64: string;
    setAsActive: boolean;
  }) => {
    const res = await fetch('/api/admin/music/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Gagal mengunggah musik ke server.');
    }
    if (Array.isArray(data.tracks)) setMusicTracks(data.tracks as MusicTrack[]);
    setActiveMusicTrackId(typeof data.activeTrackId === 'string' ? data.activeTrackId : null);
    showAdminNotice(`Musik "${data.track?.title || payload.title}" berhasil ditambahkan.`);
  };

  const handleAddUrlMusicTrack = async (payload: {
    title: string;
    audioUrl: string;
    setAsActive: boolean;
  }) => {
    const res = await fetch('/api/admin/music', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Gagal menambahkan URL musik.');
    }
    if (Array.isArray(data.tracks)) setMusicTracks(data.tracks as MusicTrack[]);
    setActiveMusicTrackId(typeof data.activeTrackId === 'string' ? data.activeTrackId : null);
    showAdminNotice(`Musik "${data.track?.title || payload.title}" berhasil ditambahkan.`);
  };

  const handleSelectActiveMusicTrack = async (trackId: string) => {
    const res = await fetch(`/api/admin/music/${encodeURIComponent(trackId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setAsActive: true }),
    });
    const data = await res.json();
    if (res.ok && data?.ok) {
      if (Array.isArray(data.tracks)) setMusicTracks(data.tracks as MusicTrack[]);
      setActiveMusicTrackId(typeof data.activeTrackId === 'string' ? data.activeTrackId : null);
      showAdminNotice('Musik utama aplikasi diperbarui dan langsung diputar otomatis.');
    }
  };

  const handleToggleMusicTrackActive = async (trackId: string, isActive: boolean) => {
    const res = await fetch(`/api/admin/music/${encodeURIComponent(trackId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    const data = await res.json();
    if (res.ok && data?.ok) {
      if (Array.isArray(data.tracks)) setMusicTracks(data.tracks as MusicTrack[]);
      setActiveMusicTrackId(typeof data.activeTrackId === 'string' ? data.activeTrackId : null);
    }
  };

  const handleDeleteMusicTrack = async (track: MusicTrack) => {
    setPendingConfirm({
      title: 'Hapus Musik Latar?',
      description: `Lagu "${track.title}" akan dihapus permanen dari daftar musik aplikasi.`,
      confirmLabel: 'Hapus Musik',
      variant: 'danger',
      onConfirm: async () => {
        const res = await fetch(`/api/admin/music/${encodeURIComponent(track.id)}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || 'Gagal menghapus musik dari server.');
        }
        if (Array.isArray(data.tracks)) setMusicTracks(data.tracks as MusicTrack[]);
        setActiveMusicTrackId(
          typeof data.activeTrackId === 'string' ? data.activeTrackId : null
        );
        showAdminNotice(`Musik "${track.title}" berhasil dihapus.`);
      },
    });
  };

  const handleExportReportCsv = () => {
    downloadProfessionalFinancialExcel({
      entries: activeSnapshot.financeEntries,
      snapshot: activeSnapshot,
      siteSettings,
      adminName: userDisplayName,
      adminRole: currentRole,
      filterLabel: `Laporan Eksekutif Terpadu (${workspaceMode === 'demo' ? 'Mode Demo' : 'Data Produksi'})`,
    });
  };

  const handleGoogleLogin = async () => {
    await signInWithPopup(auth, googleProvider);
    setIsAdminAuthenticated(true);
    setWorkspaceMode('production');
  };

  const handleCredentialLogin = (
    username: string,
    role: UserRole,
    displayName: string,
    email: string
  ) => {
    setAdminUsername(username);
    setCurrentRole(role);
    setUserDisplayName(displayName);
    setUserEmail(email);
    setIsAdminAuthenticated(true);
  };

  const handleUpdateAdminCredentials = async (updated: {
    username: string;
    email: string;
    displayName: string;
    role: UserRole;
  }) => {
    setAdminUsername(updated.username);
    setUserEmail(updated.email);
    setUserDisplayName(updated.displayName);
    setCurrentRole(updated.role);

    const updatedProfile: UserProfileRecord = {
      id: 'usr-1',
      ownerId: activeOwnerId,
      displayName: `${updated.displayName} (@${updated.username})`,
      email: updated.email,
      role: updated.role,
      department: 'Direksi & Manajemen Pusat',
      status: 'Aktif',
    };

    if (workspaceMode === 'production' && isCloudAuthenticated) {
      await handleSaveUser(updatedProfile);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      // Ignore if local credential session only
    }
    clearAllProductionState();
    setIsAdminAuthenticated(false);
    setIsCloudAuthenticated(false);
    setCurrentUid('');
    setViewMode('customer');
  };

  // Storefront read-only display feeds (so public visitors still see showcase menus when admin isn't logged in)
  const storefrontMenus =
    menuItems.length > 0 ? menuItems : publicShowcaseSeed.menuItems;
  const storefrontPromos =
    promotions.length > 0 ? promotions : publicShowcaseSeed.promotions;
  const storefrontOrders = useMemo(() => {
    const byId = new Map<string, CateringOrder>();
    for (const o of cateringOrders) byId.set(o.id, o);
    for (const g of publicGuestOrders) {
      if (!byId.has(g.id) && !deletedOrderIdsRef.current.has(g.id)) {
        byId.set(g.id, g);
      }
    }
    return Array.from(byId.values());
  }, [cateringOrders, publicGuestOrders]);

  const unpaidOrders = activeSnapshot.cateringOrders.filter(
    (o) => o.paymentStatus !== 'Lunas' && o.status !== 'Dibatalkan'
  );

  const activeSyncMeta =
    workspaceMode === 'demo'
      ? {
          label: 'Mode Demo (Lokal Terisolasi)',
          badgeClass: 'border-amber-300 bg-amber-50 text-amber-950',
          dotColor: 'text-amber-700',
        }
      : SYNC_STATUS_BADGE[syncStatus];

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return activeAuditLogs.filter((log) => {
      const matchAction = auditActionFilter === 'Semua' || log.action === auditActionFilter;
      const matchQ =
        !q ||
        log.entityLabel.toLowerCase().includes(q) ||
        log.actorName.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.entityType.toLowerCase().includes(q);
      return matchAction && matchQ;
    });
  }, [activeAuditLogs, auditSearch, auditActionFilter]);

  const activeThemePreset = resolveThemePreset(siteSettings.accentTheme);

  return (
    <div className={`min-h-screen flex flex-col ${activeThemePreset.pageBgClass}`}>
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs text-center sticky top-0 z-50">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {viewMode === 'customer' || !isAdminAuthenticated ? (
        <CustomerStorefront
          menuItems={storefrontMenus}
          orders={storefrontOrders}
          promotions={storefrontPromos}
          siteSettings={siteSettings}
          onSubmitCustomerOrder={handlePublicCustomerOrderSubmit}
          onConfirmCustomerPayment={handleConfirmOrderPaid}
          onOpenAdminPortal={() => {
            if (isAdminAuthenticated) {
              setViewMode('admin');
            } else {
              setLoginModalTab('login');
              setLoginModalOpen(true);
            }
          }}
        />
      ) : (
        <div className="flex-1 flex min-w-0">
          {/* Mobile Sidebar Backdrop */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Enterprise Left Sidebar (Themed) */}
          <aside
            className={`fixed inset-y-0 left-0 z-50 w-64 text-slate-100 flex flex-col border-r transition-transform duration-200 lg:static lg:translate-x-0 no-print shrink-0 ${activeThemePreset.sidebarBgClass} ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${activeThemePreset.primaryBtnClass}`}>
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold tracking-wide text-white truncate">
                    {siteSettings.brandName}
                  </div>
                  <div className={`text-[11px] font-medium truncate ${activeThemePreset.sidebarIconClass}`}>
                    Enterprise ERP · {currentRole}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Tutup menu samping"
                className="lg:hidden rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav aria-label="Navigasi Enterprise ERP" className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
              {(['Utama', 'Operasional', 'Keuangan & Gudang', 'Sistem'] as const).map((sec) => (
                <div key={sec} className="space-y-1">
                  <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {sec}
                  </div>
                  {SIDEBAR_NAV_ITEMS.filter((i) => i.section === sec).map((item) => {
                    const Icon = item.icon;
                    const active = activeModule === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setActiveModule(item.key);
                          setSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors text-left ${
                          active
                            ? activeThemePreset.sidebarActiveClass
                            : 'text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            active ? 'text-white' : activeThemePreset.sidebarIconClass
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="p-4 border-t border-white/10 space-y-2.5 text-xs">
              <div className="rounded-lg bg-white/10 p-3 space-y-1">
                <div className="font-semibold text-white truncate">{userDisplayName}</div>
                <div className="text-[11px] text-slate-300 truncate">{userEmail}</div>
                <div className={`text-[11px] font-semibold ${activeThemePreset.sidebarIconClass}`}>
                  {isCloudAuthenticated ? 'Cloud Auth Terhubung' : 'Sesi Lokal (Non-Cloud)'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-900/60 bg-red-950/50 hover:bg-red-900/70 px-3 py-2 text-xs font-semibold text-red-200 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout & Bersihkan Sesi</span>
              </button>
            </div>
          </aside>

          {/* Main Workspace Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top Bar */}
            <header className="sticky top-0 z-30 border-b border-slate-200 bg-white no-print">
              <div
                className="h-1 w-full"
                style={{ backgroundImage: activeThemePreset.headerTopStripStyle }}
                aria-hidden="true"
              />
              <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    aria-label="Buka navigasi samping"
                    className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-900 truncate">
                      {SIDEBAR_NAV_ITEMS.find((i) => i.key === activeModule)?.label ||
                        'Enterprise ERP'}
                    </h2>
                    <p className="text-[11px] text-slate-500 hidden sm:block">
                      {workspaceMode === 'demo'
                        ? 'Lingkungan Simulasi Terisolasi (Mode DEMO)'
                        : isCloudAuthenticated
                        ? 'Sumber Kebenaran Tunggal: Cloud Firestore (Realtime)'
                        : 'Belum terhubung Cloud Auth — Hubungkan Google untuk sinkronisasi Firestore'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 relative">
                  {/* Sync Status Badge */}
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${activeSyncMeta.badgeClass}`}
                    title={syncErrorDetail || activeSyncMeta.label}
                  >
                    {syncStatus === 'connecting' || syncStatus === 'pending' ? (
                      <Loader2 className={`h-3.5 w-3.5 animate-spin ${activeSyncMeta.dotColor}`} />
                    ) : syncStatus === 'error' ? (
                      <CloudOff className={`h-3.5 w-3.5 ${activeSyncMeta.dotColor}`} />
                    ) : (
                      <Cloud className={`h-3.5 w-3.5 ${activeSyncMeta.dotColor}`} />
                    )}
                    <span>{activeSyncMeta.label}</span>
                  </div>

                  {workspaceMode === 'production' && hasMoreCloudData && (
                    <button
                      type="button"
                      onClick={() => setLimitPerCollection((prev) => prev + 200)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700"
                    >
                      <RefreshCw className="h-3 w-3 text-emerald-700" />
                      <span>Muat Lebih Banyak</span>
                    </button>
                  )}

                  {/* Production vs Demo Mode Toggle */}
                  <button
                    type="button"
                    onClick={() =>
                      setWorkspaceMode((prev) => (prev === 'production' ? 'demo' : 'production'))
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      workspaceMode === 'demo'
                        ? 'border-amber-400 bg-amber-100 text-amber-950 hover:bg-amber-200'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Database className="h-3.5 w-3.5" />
                    <span>{workspaceMode === 'demo' ? 'Keluar Mode DEMO' : 'Mode DEMO'}</span>
                  </button>

                  {!isCloudAuthenticated && workspaceMode === 'production' && (
                    <button
                      type="button"
                      onClick={() => {
                        setLoginModalTab('login');
                        setLoginModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Hubungkan Firestore</span>
                    </button>
                  )}

                  {/* Paid Notification Popover */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextOpen = !notificationsOpen;
                      setNotificationsOpen(nextOpen);
                      if (nextOpen && paidNotifications.some((n) => !n.isRead)) {
                        setPaidNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                        fetch('/api/notifications/paid/mark-read', { method: 'POST' }).catch(() => {});
                      }
                    }}
                    aria-label="Notifikasi Sudah Dibayar"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-900 transition-colors"
                  >
                    <Bell className="h-3.5 w-3.5 text-emerald-700" />
                    <span>
                      Notif ({activePaidNotifications.length})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode('customer')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    <Globe className="h-3.5 w-3.5 text-emerald-700" />
                    <span className="hidden sm:inline">Web Pelanggan</span>
                  </button>

                  {notificationsOpen && (
                    <div className="absolute right-0 top-11 w-96 max-w-[92vw] rounded-xl border border-slate-200 bg-white p-4 shadow-xl z-50 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div>
                          <span className="font-bold text-slate-900 block">
                            Notifikasi Pembayaran Lunas
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {activePaidNotifications.length} pembayaran terverifikasi
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNotificationsOpen(false)}
                          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="max-h-72 overflow-y-auto space-y-2">
                        {activePaidNotifications.length === 0 ? (
                          <p className="text-slate-500 py-3 text-center">
                            Belum ada notifikasi pembayaran baru.
                          </p>
                        ) : (
                          activePaidNotifications.map((notif) => (
                            <div
                              key={notif.id}
                              className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 space-y-1"
                            >
                              <div className="flex items-center justify-between font-bold text-emerald-900">
                                <span className="inline-flex items-center gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                                  <span>{notif.orderNumber}</span>
                                </span>
                                <span className="font-mono tabular-nums">
                                  {formatRupiah(notif.amount)}
                                </span>
                              </div>
                              <div className="font-semibold text-slate-900">{notif.customerName}</div>
                              <div className="text-[11px] text-slate-600">
                                {notif.paymentMethod} · {notif.paidAt}
                              </div>
                            </div>
                          ))
                        )}

                        {unpaidOrders.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 space-y-2">
                            <span className="font-bold text-slate-700 block">
                              Menunggu Verifikasi ({unpaidOrders.length}):
                            </span>
                            {unpaidOrders.slice(0, 5).map((ord) => (
                              <div
                                key={ord.id}
                                className="rounded-lg border border-slate-200 bg-slate-50 p-2 flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 truncate">
                                    {ord.customerName}
                                  </div>
                                  <div className="font-mono tabular-nums text-[11px] text-slate-500">
                                    {ord.orderNumber} · {formatRupiah(ord.totalPayment)}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleConfirmOrderPaid(ord)}
                                  className="rounded bg-emerald-700 hover:bg-emerald-800 px-2 py-1 text-[11px] font-semibold text-white shrink-0"
                                >
                                  Verifikasi Lunas
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Demo Mode Explicit Isolation Banner */}
            {workspaceMode === 'demo' && (
              <div className="bg-amber-100 border-b border-amber-300 px-4 sm:px-6 py-2.5 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2 no-print">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4 text-amber-800 shrink-0" />
                  <span>
                    MODE DEMO AKTIF — Menampilkan data simulasi. Seluruh perubahan di mode ini terisolasi dan TIDAK disimpan ke Cloud Firestore produksi.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setWorkspaceMode('production')}
                  className="rounded-md bg-slate-900 text-white px-3 py-1 font-semibold hover:bg-slate-800"
                >
                  Kembali ke Data Produksi
                </button>
              </div>
            )}

            {/* Unimported Public Web Orders Prompt (Explicit, NEVER auto-resurrects deleted orders) */}
            {unimportedPublicOrders.length > 0 && (
              <div className="bg-sky-50 border-b border-sky-200 px-4 sm:px-6 py-2.5 text-xs text-sky-950 flex flex-wrap items-center justify-between gap-2 no-print">
                <div className="font-semibold">
                  Ditemukan {unimportedPublicOrders.length} pesanan baru dari Web Pelanggan yang belum disinkronkan ke koleksi Cloud Firestore Anda.
                </div>
                <button
                  type="button"
                  onClick={handleImportPublicOrdersToFirestore}
                  className="rounded-md bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1 font-semibold"
                >
                  Sinkronkan ke Firestore
                </button>
              </div>
            )}

            {/* Success & Error Feedback Banners */}
            {adminErrorNotice && (
              <div className="px-4 sm:px-6 pt-4 no-print">
                <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-xs sm:text-sm font-semibold text-red-900 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-700 shrink-0" />
                    <span>{adminErrorNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdminErrorNotice('')}
                    className="text-xs font-medium text-red-800 hover:underline shrink-0"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}

            {adminBannerNotice && (
              <div className="px-4 sm:px-6 pt-4 no-print">
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-950 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                    <span>{adminBannerNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdminBannerNotice('')}
                    className="text-xs font-medium text-emerald-800 hover:underline shrink-0"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}

            {/* Main Viewport */}
            <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
              {activeModule === 'dashboard' && (
                <DashboardView
                  state={activeSnapshot}
                  paidNotifications={activePaidNotifications}
                  onNavigateModule={(modKey) => setActiveModule(modKey as NavModuleKey)}
                  onExportReportCsv={handleExportReportCsv}
                  onConfirmOrderPaid={handleConfirmOrderPaid}
                />
              )}

              {activeModule === 'catering' && (
                <CateringModule
                  ownerId={activeOwnerId}
                  menuItems={activeSnapshot.menuItems}
                  orders={activeSnapshot.cateringOrders}
                  customers={activeSnapshot.customers}
                  productionBatches={activeSnapshot.productionBatches}
                  siteSettings={siteSettings}
                  hasMoreCloudData={workspaceMode === 'production' && hasMoreCloudData}
                  onLoadMore={() => setLimitPerCollection((prev) => prev + 200)}
                  onSaveMenu={handleSaveMenu}
                  onDeleteMenu={handleDeleteMenu}
                  onSaveOrder={handleSaveOrder}
                  onCancelOrder={handleCancelOrder}
                  onDeleteOrder={handleDeleteOrder}
                  onSaveCustomer={handleSaveCustomer}
                  onDeleteCustomer={handleDeleteCustomer}
                  onSaveProduction={handleSaveProduction}
                  onDeleteProduction={handleDeleteProduction}
                  onConfirmOrderPaid={handleConfirmOrderPaid}
                />
              )}

              {activeModule === 'sekolah' && (
                <SekolahRakyatModule
                  ownerId={activeOwnerId}
                  schools={activeSnapshot.schools}
                  deliveries={activeSnapshot.schoolDeliveries}
                  productionBatches={activeSnapshot.productionBatches}
                  onSaveSchool={handleSaveSchool}
                  onDeleteSchool={handleDeleteSchool}
                  onSaveDelivery={handleSaveDelivery}
                  onDeleteDelivery={handleDeleteDelivery}
                />
              )}

              {activeModule === 'tampilan' && (
                <SiteDisplayCustomizer
                  settings={siteSettings}
                  onSaveSettings={handleSaveSiteSettings}
                  onPreviewCustomerStorefront={() => setViewMode('customer')}
                />
              )}

              {activeModule === 'musik' && (
                <MusicManagerModule
                  tracks={musicTracks}
                  activeTrackId={activeMusicTrackId}
                  onAddUploadedTrack={handleAddUploadedMusicTrack}
                  onAddUrlTrack={handleAddUrlMusicTrack}
                  onSelectActiveTrack={handleSelectActiveMusicTrack}
                  onToggleTrackActive={handleToggleMusicTrackActive}
                  onDeleteTrack={handleDeleteMusicTrack}
                />
              )}

              {activeModule === 'audit' && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <History className="h-5 w-5 text-emerald-700" />
                        <span>Log Audit Sistem &amp; Riwayat Perubahan Permanen</span>
                      </h1>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Seluruh tindakan pembuatan, pembaruan, verifikasi pembayaran, rekonsiliasi, penghapusan, dan pemulihan dicatat otomatis secara immutable di Cloud Firestore.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={auditSearch}
                        onChange={(e) => setAuditSearch(e.target.value)}
                        placeholder="Cari aktor, dokumen, detail..."
                        aria-label="Cari log audit"
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
                      />
                      <select
                        value={auditActionFilter}
                        onChange={(e) => setAuditActionFilter(e.target.value)}
                        aria-label="Filter aksi audit"
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
                      >
                        <option value="Semua">Semua Aksi</option>
                        <option value="create">Create</option>
                        <option value="update">Update</option>
                        <option value="delete">Delete</option>
                        <option value="cancel">Cancel</option>
                        <option value="verify_payment">Verifikasi Pembayaran</option>
                        <option value="reconcile">Rekonsiliasi</option>
                        <option value="restore">Restore Backup</option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                            <th className="py-3 px-4 font-semibold">Waktu (WIB)</th>
                            <th className="py-3 px-4 font-semibold">Pelaku &amp; Peran</th>
                            <th className="py-3 px-4 font-semibold">Aksi</th>
                            <th className="py-3 px-4 font-semibold">Modul / Dokumen</th>
                            <th className="py-3 px-4 font-semibold">Rincian Audit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredAuditLogs.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 px-4 text-center text-slate-500">
                                Belum ada catatan log audit yang sesuai filter.
                              </td>
                            </tr>
                          ) : (
                            filteredAuditLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-slate-50">
                                <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                                  {new Date(log.timestampIso).toLocaleString('id-ID', {
                                    timeZone: 'Asia/Jakarta',
                                  })}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-slate-900">{log.actorName}</div>
                                  <div className="text-[11px] text-slate-500">{log.actorRole}</div>
                                </td>
                                <td className="py-3 px-4 font-mono font-bold uppercase text-slate-800 whitespace-nowrap">
                                  {log.action}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-slate-900">
                                    {log.entityLabel}
                                  </div>
                                  <div className="text-[11px] text-slate-500">{log.entityType}</div>
                                </td>
                                <td className="py-3 px-4 text-slate-700">{log.details}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {(activeModule === 'keuangan' ||
                activeModule === 'stok' ||
                activeModule === 'pemasaran' ||
                activeModule === 'backup') && (
                <FinanceInventoryModule
                  activeSection={activeModule}
                  ownerId={activeOwnerId}
                  state={activeSnapshot}
                  paidNotifications={activePaidNotifications}
                  currentRole={currentRole}
                  siteSettings={siteSettings}
                  adminUsername={adminUsername}
                  adminEmail={userEmail}
                  adminDisplayName={userDisplayName}
                  onUpdateAdminCredentials={handleUpdateAdminCredentials}
                  onSaveSiteSettings={handleSaveSiteSettings}
                  onSaveFinance={handleSaveFinance}
                  onDeleteFinance={handleDeleteFinance}
                  onSaveInventory={handleSaveInventory}
                  onDeleteInventory={handleDeleteInventory}
                  onSavePromotion={handleSavePromotion}
                  onDeletePromotion={handleDeletePromotion}
                  onSaveUser={handleSaveUser}
                  onDeleteUser={handleDeleteUser}
                  onRestoreBackup={handleRestoreBackup}
                />
              )}
            </main>

            <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500 no-print">
              <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>{siteSettings.footerCopyright}</div>
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setViewMode('customer')}
                    className="hover:text-slate-900 transition-colors"
                  >
                    Halaman Depan Pelanggan
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModule('audit')}
                    className="hover:text-slate-900 transition-colors"
                  >
                    Log Audit Sistem
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginModalTab('credentials');
                      setLoginModalOpen(true);
                    }}
                    className="hover:text-slate-900 transition-colors"
                  >
                    Pengaturan Akun
                  </button>
                </div>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Global In-App Confirmation & Audit Reason Modal */}
      <ConfirmActionModal
        isOpen={Boolean(pendingConfirm)}
        title={pendingConfirm?.title || ''}
        description={pendingConfirm?.description || ''}
        confirmLabel={pendingConfirm?.confirmLabel || 'Konfirmasi'}
        variant={pendingConfirm?.variant || 'danger'}
        requireReason={pendingConfirm?.requireReason}
        reasonLabel={pendingConfirm?.reasonLabel}
        reasonPlaceholder={pendingConfirm?.reasonPlaceholder}
        isSubmitting={confirmSubmitting}
        errorMessage={confirmError}
        onCancel={() => {
          if (!confirmSubmitting) {
            setPendingConfirm(null);
            setConfirmError('');
          }
        }}
        onConfirm={async (reason) => {
          if (!pendingConfirm) return;
          setConfirmSubmitting(true);
          setConfirmError('');
          try {
            await pendingConfirm.onConfirm(reason);
            setPendingConfirm(null);
          } catch (err) {
            setConfirmError(
              err instanceof Error ? err.message : 'Operasi server gagal diproses.'
            );
          } finally {
            setConfirmSubmitting(false);
          }
        }}
      />

      {/* Login & Account Security Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        currentRole={currentRole}
        adminUsername={adminUsername}
        userEmail={userEmail}
        userDisplayName={userDisplayName}
        isCloudAuthenticated={isCloudAuthenticated}
        initialTab={loginModalTab}
        onCredentialLogin={handleCredentialLogin}
        onUpdateCredentials={handleUpdateAdminCredentials}
        onLogout={handleLogout}
        onEnterAdminDashboard={() => setViewMode('admin')}
      />

      {/* Auto-Play Minimalist Background Music (Logo & Title Only) */}
      <BackgroundMusicWidget
        track={resolveActiveTrack(musicTracks, activeMusicTrackId)}
        shouldLoopSingle={musicTracks.filter((t) => t.isActive && Boolean(t.audioUrl)).length <= 1}
        accentTheme={siteSettings.accentTheme}
        onTrackEnded={() => {
          const nextTrack = resolveNextTrack(musicTracks, activeMusicTrackId);
          if (nextTrack) {
            setActiveMusicTrackId(nextTrack.id);
          }
        }}
      />
    </div>
  );
}
