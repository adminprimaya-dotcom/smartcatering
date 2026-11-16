import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  Bell,
  Building2,
  ChefHat,
  DatabaseBackup,
  FileSpreadsheet,
  Globe,
  KeyRound,
  LayoutDashboard,
  LayoutTemplate,
  Menu,
  Package,
  School,
  ShieldCheck,
  Tag,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import { auth, googleProvider } from './firebase';
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
  SiteContentSettings,
  UserProfileRecord,
  UserRole,
} from './types/erp';
import { createInitialErpSeed, DEFAULT_SITE_SETTINGS } from './data/seedData';
import {
  deleteCloudDocument,
  restoreSnapshotToFirestore,
  saveCloudDocument,
  seedCloudFirestoreIfNeeded,
  subscribeErpCollections,
} from './services/firestoreService';
import { DashboardView } from './components/DashboardView';
import { CateringModule } from './components/CateringModule';
import { SekolahRakyatModule } from './components/SekolahRakyatModule';
import { FinanceInventoryModule } from './components/FinanceInventoryModule';
import { LoginModal } from './components/LoginModal';
import { CustomerStorefront } from './components/CustomerStorefront';
import { SiteDisplayCustomizer } from './components/SiteDisplayCustomizer';
import { formatRupiah } from './utils/calculations';
import { downloadProfessionalFinancialExcel } from './utils/financialReportExport';

type NavModuleKey =
  | 'dashboard'
  | 'catering'
  | 'sekolah'
  | 'keuangan'
  | 'stok'
  | 'pemasaran'
  | 'tampilan'
  | 'backup';

const NAV_ITEMS: {
  key: NavModuleKey;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    key: 'dashboard',
    label: 'Dashboard Utama',
    sublabel: '12 KPI & 6 Grafik ERP',
    icon: LayoutDashboard,
  },
  {
    key: 'catering',
    label: 'Modul 1 · Catering',
    sublabel: 'Menu, Pesanan, Pelanggan & Dapur',
    icon: ChefHat,
  },
  {
    key: 'sekolah',
    label: 'Modul 2 · Sekolah Rakyat',
    sublabel: 'Data Sekolah, Peta GPS & Distribusi',
    icon: School,
  },
  {
    key: 'keuangan',
    label: 'Akuntansi & Keuangan',
    sublabel: 'Kas/Bank, Laba Rugi & Utang-Piutang',
    icon: Wallet,
  },
  {
    key: 'stok',
    label: 'Stok & Pengadaan',
    sublabel: 'Gudang Bahan Baku & Supplier',
    icon: Package,
  },
  {
    key: 'pemasaran',
    label: 'Pemasaran & Promosi',
    sublabel: 'Voucher Diskon & Kontrak B2B',
    icon: Tag,
  },
  {
    key: 'tampilan',
    label: 'Edit Tampilan & Konten',
    sublabel: 'Ubah Isi Web, Banner & Kontak',
    icon: LayoutTemplate,
  },
  {
    key: 'backup',
    label: 'Backup & Hak Akses',
    sublabel: 'Akun Admin, Restore & RBAC',
    icon: DatabaseBackup,
  },
];

export default function App() {
  // Default entry view is Public Customer Homepage ('customer') without login wall
  const [viewMode, setViewMode] = useState<'customer' | 'admin'>('customer');
  const [activeModule, setActiveModule] = useState<NavModuleKey>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginModalTab, setLoginModalTab] = useState<'login' | 'credentials'>('login');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  // Auth & RBAC State
  const [currentUid, setCurrentUid] = useState<string>('admin-workspace-uid');
  const [isCloudAuthenticated, setIsCloudAuthenticated] = useState(false);
  const [adminUsername, setAdminUsername] = useState('admin');
  const [userEmail, setUserEmail] = useState('primayaadmin@gmail.com');
  const [userDisplayName, setUserDisplayName] = useState('Ir. Pratama Wijaya, MBA');
  const [currentRole, setCurrentRole] = useState<UserRole>('Super Admin');

  // Unified ERP Data State
  const initialSeed = createInitialErpSeed('admin-workspace-uid');
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialSeed.menuItems);
  const [cateringOrders, setCateringOrders] = useState<CateringOrder[]>(initialSeed.cateringOrders);
  const [customers, setCustomers] = useState<CustomerRecord[]>(initialSeed.customers);
  const [productionBatches, setProductionBatches] = useState<ProductionBatch[]>(
    initialSeed.productionBatches
  );
  const [schools, setSchools] = useState<SchoolRecord[]>(initialSeed.schools);
  const [schoolDeliveries, setSchoolDeliveries] = useState<SchoolDelivery[]>(
    initialSeed.schoolDeliveries
  );
  const [financeEntries, setFinanceEntries] = useState<FinanceEntry[]>(initialSeed.financeEntries);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(initialSeed.inventoryItems);
  const [promotions, setPromotions] = useState<PromotionItem[]>(initialSeed.promotions);
  const [users, setUsers] = useState<UserProfileRecord[]>(initialSeed.users);
  const [siteSettings, setSiteSettings] = useState<SiteContentSettings>(DEFAULT_SITE_SETTINGS);

  // Listen to Google Maps Quota Exceeded Event
  useEffect(() => {
    const handleQuota = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Load persisted public & admin orders and admin account profile from backend API on startup
  useEffect(() => {
    let active = true;
    fetch('/api/public/orders')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data || !Array.isArray(data.orders)) return;
        setCateringOrders((prev) => {
          const byId = new Map<string, CateringOrder>();
          for (const item of data.orders as CateringOrder[]) {
            byId.set(item.id, item);
          }
          for (const existing of prev) {
            if (!byId.has(existing.id)) {
              byId.set(existing.id, existing);
            }
          }
          return Array.from(byId.values());
        });
      })
      .catch(() => {
        // Ignore transient offline error
      });

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
      .catch(() => {
        // Ignore transient offline error
      });

    fetch('/api/site-settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.settings) return;
        setSiteSettings((prev) => ({
          ...prev,
          ...(data.settings as Partial<SiteContentSettings>),
        }));
      })
      .catch(() => {
        // Ignore transient offline error
      });

    return () => {
      active = false;
    };
  }, []);

  // Listen to Firebase Auth & Attach Real-Time Cloud Firestore Listeners
  useEffect(() => {
    let unsubscribeCollections: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeCollections) {
        unsubscribeCollections();
        unsubscribeCollections = null;
      }

      if (firebaseUser) {
        setCurrentUid(firebaseUser.uid);
        setIsCloudAuthenticated(true);
        if (firebaseUser.email) setUserEmail(firebaseUser.email);
        if (firebaseUser.displayName) setUserDisplayName(firebaseUser.displayName);

        try {
          await seedCloudFirestoreIfNeeded(firebaseUser.uid);
          unsubscribeCollections = subscribeErpCollections(firebaseUser.uid, {
            onMenuItems: setMenuItems,
            onCateringOrders: (cloudOrders) => {
              setCateringOrders((prev) => {
                const byId = new Map<string, CateringOrder>();
                for (const o of cloudOrders) byId.set(o.id, o);
                for (const p of prev) {
                  if (!byId.has(p.id)) byId.set(p.id, p);
                }
                return Array.from(byId.values());
              });
            },
            onCustomers: setCustomers,
            onProductionBatches: setProductionBatches,
            onSchools: setSchools,
            onSchoolDeliveries: setSchoolDeliveries,
            onFinanceEntries: setFinanceEntries,
            onInventoryItems: setInventoryItems,
            onPromotions: setPromotions,
            onUsers: setUsers,
          });
        } catch (err) {
          console.error('Sinkronisasi awal Firestore tertunda:', err);
        }
      } else {
        setIsCloudAuthenticated(false);
        setCurrentUid('admin-workspace-uid');
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeCollections) unsubscribeCollections();
    };
  }, []);

  const erpSnapshot: ErpStateSnapshot = {
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

  const syncOrdersToBackend = async (nextOrders: CateringOrder[]) => {
    try {
      await fetch('/api/admin/orders/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: nextOrders }),
      });
    } catch {
      // Non-blocking sync
    }
  };

  // Public Guest Order submission (no login required)
  const handlePublicCustomerOrderSubmit = async (
    order: CateringOrder
  ): Promise<CateringOrder> => {
    let savedOrder = order;
    try {
      const response = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
      if (response.ok) {
        const payload = await response.json();
        if (payload?.order) {
          savedOrder = payload.order;
        }
      }
    } catch {
      // Fallback to local state if network hiccup
    }

    setCateringOrders((prev) => [savedOrder, ...prev.filter((o) => o.id !== savedOrder.id)]);

    // Also register/update customer record for Admin CRM
    const newCustomerRecord: CustomerRecord = {
      id: `cust-pub-${Date.now()}`,
      ownerId: currentUid,
      name: savedOrder.customerName,
      address: savedOrder.deliveryAddress || 'Sesuai Pesanan Publik',
      phone: savedOrder.whatsapp,
      locationLat: savedOrder.locationLat || -6.2088,
      locationLng: savedOrder.locationLng || 106.8456,
      totalPurchases: savedOrder.totalPayment,
      transactionCount: 1,
      isActive: true,
      isPriority: savedOrder.totalPayment >= 10000000,
    };

    setCustomers((prev) => {
      const existing = prev.find(
        (c) =>
          (c.phone || '').replace(/\D/g, '') === (savedOrder.whatsapp || '').replace(/\D/g, '') ||
          c.name.toLowerCase() === savedOrder.customerName.toLowerCase()
      );
      if (existing) {
        return prev.map((c) =>
          c.id === existing.id
            ? {
                ...c,
                totalPurchases: c.totalPurchases + savedOrder.totalPayment,
                transactionCount: c.transactionCount + 1,
              }
            : c
        );
      }
      return [newCustomerRecord, ...prev];
    });

    if (isCloudAuthenticated) {
      await saveCloudDocument('catering_orders', savedOrder.id, {
        ...savedOrder,
        ownerId: currentUid,
      });
    }

    return savedOrder;
  };

  // Handlers that update immediate state AND Cloud Firestore when authenticated
  const handleSaveMenu = async (item: MenuItem) => {
    setMenuItems((prev) => {
      const exists = prev.some((m) => m.id === item.id);
      return exists ? prev.map((m) => (m.id === item.id ? item : m)) : [item, ...prev];
    });
    if (isCloudAuthenticated) {
      await saveCloudDocument('menu_items', item.id, { ...item, ownerId: currentUid });
    }
  };

  const handleDeleteMenu = async (id: string) => {
    setMenuItems((prev) => prev.filter((m) => m.id !== id));
    if (isCloudAuthenticated) {
      await deleteCloudDocument('menu_items', id);
    }
  };

  const handleSaveOrder = async (order: CateringOrder) => {
    setCateringOrders((prev) => {
      const exists = prev.some((o) => o.id === order.id);
      const next = exists ? prev.map((o) => (o.id === order.id ? order : o)) : [order, ...prev];
      void syncOrdersToBackend(next);
      return next;
    });
    if (isCloudAuthenticated) {
      await saveCloudDocument('catering_orders', order.id, { ...order, ownerId: currentUid });
    }
  };

  const handleDeleteOrder = async (id: string) => {
    setCateringOrders((prev) => {
      const next = prev.filter((o) => o.id !== id);
      void syncOrdersToBackend(next);
      return next;
    });
    if (isCloudAuthenticated) {
      await deleteCloudDocument('catering_orders', id);
    }
  };

  const handleSaveCustomer = async (customer: CustomerRecord) => {
    setCustomers((prev) => {
      const exists = prev.some((c) => c.id === customer.id);
      return exists ? prev.map((c) => (c.id === customer.id ? customer : c)) : [customer, ...prev];
    });
    if (isCloudAuthenticated) {
      await saveCloudDocument('customers', customer.id, { ...customer, ownerId: currentUid });
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    if (isCloudAuthenticated) {
      await deleteCloudDocument('customers', id);
    }
  };

  const handleSaveProduction = async (batch: ProductionBatch) => {
    setProductionBatches((prev) => {
      const exists = prev.some((b) => b.id === batch.id);
      return exists ? prev.map((b) => (b.id === batch.id ? batch : b)) : [batch, ...prev];
    });
    if (isCloudAuthenticated) {
      await saveCloudDocument('production_batches', batch.id, { ...batch, ownerId: currentUid });
    }
  };

  const handleDeleteProduction = async (id: string) => {
    setProductionBatches((prev) => prev.filter((b) => b.id !== id));
    if (isCloudAuthenticated) {
      await deleteCloudDocument('production_batches', id);
    }
  };

  const handleSaveSchool = async (school: SchoolRecord) => {
    setSchools((prev) => {
      const exists = prev.some((s) => s.id === school.id);
      return exists ? prev.map((s) => (s.id === school.id ? school : s)) : [school, ...prev];
    });
    if (isCloudAuthenticated) {
      await saveCloudDocument('schools', school.id, { ...school, ownerId: currentUid });
    }
  };

  const handleDeleteSchool = async (id: string) => {
    setSchools((prev) => prev.filter((s) => s.id !== id));
    if (isCloudAuthenticated) {
      await deleteCloudDocument('schools', id);
    }
  };

  const handleSaveDelivery = async (delivery: SchoolDelivery) => {
    setSchoolDeliveries((prev) => {
      const exists = prev.some((d) => d.id === delivery.id);
      return exists ? prev.map((d) => (d.id === delivery.id ? delivery : d)) : [delivery, ...prev];
    });
    if (isCloudAuthenticated) {
      await saveCloudDocument('school_deliveries', delivery.id, {
        ...delivery,
        ownerId: currentUid,
      });
    }
  };

  const handleDeleteDelivery = async (id: string) => {
    setSchoolDeliveries((prev) => prev.filter((d) => d.id !== id));
    if (isCloudAuthenticated) {
      await deleteCloudDocument('school_deliveries', id);
    }
  };

  const handleSaveFinance = async (entry: FinanceEntry) => {
    setFinanceEntries((prev) => {
      const exists = prev.some((f) => f.id === entry.id);
      return exists ? prev.map((f) => (f.id === entry.id ? entry : f)) : [entry, ...prev];
    });
    if (isCloudAuthenticated) {
      await saveCloudDocument('finance_entries', entry.id, { ...entry, ownerId: currentUid });
    }
  };

  const handleDeleteFinance = async (id: string) => {
    setFinanceEntries((prev) => prev.filter((f) => f.id !== id));
    if (isCloudAuthenticated) {
      await deleteCloudDocument('finance_entries', id);
    }
  };

  const handleSaveInventory = async (item: InventoryItem) => {
    setInventoryItems((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      return exists ? prev.map((i) => (i.id === item.id ? item : i)) : [item, ...prev];
    });
    if (isCloudAuthenticated) {
      await saveCloudDocument('inventory_items', item.id, { ...item, ownerId: currentUid });
    }
  };

  const handleDeleteInventory = async (id: string) => {
    setInventoryItems((prev) => prev.filter((i) => i.id !== id));
    if (isCloudAuthenticated) {
      await deleteCloudDocument('inventory_items', id);
    }
  };

  const handleSavePromotion = async (promo: PromotionItem) => {
    setPromotions((prev) => {
      const exists = prev.some((p) => p.id === promo.id);
      return exists ? prev.map((p) => (p.id === promo.id ? promo : p)) : [promo, ...prev];
    });
    if (isCloudAuthenticated) {
      await saveCloudDocument('promotions', promo.id, { ...promo, ownerId: currentUid });
    }
  };

  const handleDeletePromotion = async (id: string) => {
    setPromotions((prev) => prev.filter((p) => p.id !== id));
    if (isCloudAuthenticated) {
      await deleteCloudDocument('promotions', id);
    }
  };

  const handleSaveUser = async (user: UserProfileRecord) => {
    setUsers((prev) => [user, ...prev]);
    if (isCloudAuthenticated) {
      await saveCloudDocument('users', user.id, { ...user, ownerId: currentUid });
    }
  };

  const handleRestoreBackup = async (snapshot: ErpStateSnapshot) => {
    setMenuItems(snapshot.menuItems);
    setCateringOrders(snapshot.cateringOrders);
    setCustomers(snapshot.customers);
    setProductionBatches(snapshot.productionBatches);
    setSchools(snapshot.schools);
    setSchoolDeliveries(snapshot.schoolDeliveries);
    setFinanceEntries(snapshot.financeEntries);
    setInventoryItems(snapshot.inventoryItems);
    setPromotions(snapshot.promotions);
    if (snapshot.users) setUsers(snapshot.users);

    void syncOrdersToBackend(snapshot.cateringOrders);

    if (isCloudAuthenticated) {
      await restoreSnapshotToFirestore(currentUid, snapshot);
    }
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
      // Fallback keeps in-memory settings
    }
  };

  const handleExportReportCsv = () => {
    downloadProfessionalFinancialExcel({
      entries: financeEntries,
      snapshot: erpSnapshot,
      siteSettings,
      adminName: userDisplayName,
      adminRole: currentRole,
      filterLabel: 'Laporan Eksekutif Terpadu (Catering Komersial & Sekolah Rakyat)',
    });
  };

  const handleGoogleLogin = async () => {
    await signInWithPopup(auth, googleProvider);
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
      ownerId: currentUid,
      displayName: `${updated.displayName} (@${updated.username})`,
      email: updated.email,
      role: updated.role,
      department: 'Manajemen Pusat & Akuntansi',
      status: 'Aktif',
    };

    setUsers((prev) => {
      const exists = prev.some((u) => u.id === 'usr-1');
      return exists
        ? prev.map((u) => (u.id === 'usr-1' ? updatedProfile : u))
        : [updatedProfile, ...prev];
    });

    if (isCloudAuthenticated) {
      await saveCloudDocument('users', updatedProfile.id, {
        ...updatedProfile,
        ownerId: currentUid,
      });
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const activeNavMeta = NAV_ITEMS.find((n) => n.key === activeModule) || NAV_ITEMS[0];
  const lowStockAlerts = inventoryItems.filter((i) => i.stockQty <= i.minStock);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Required Google Maps Platform Demo Quota Banner */}
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {viewMode === 'customer' ? (
        <CustomerStorefront
          menuItems={menuItems}
          orders={cateringOrders}
          promotions={promotions}
          siteSettings={siteSettings}
          onSubmitCustomerOrder={handlePublicCustomerOrderSubmit}
          onOpenAdminPortal={() => {
            setLoginModalTab('login');
            setLoginModalOpen(true);
          }}
        />
      ) : (
        <div className="flex flex-1">
          {/* Desktop & Mobile Sidebar Navigation */}
          <aside
            aria-label="Navigasi Utama ERP"
            className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 no-print ${
              mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div>
              {/* Brand Identity */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold shrink-0">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold tracking-tight text-white block leading-tight truncate">
                      {siteSettings.brandName}
                    </span>
                    <span className="text-[11px] text-amber-400 font-medium block truncate">
                      {siteSettings.brandTagline}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  aria-label="Tutup menu navigasi"
                  className="lg:hidden text-slate-400 hover:text-white p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Navigation Items */}
              <nav className="p-3 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setActiveModule(item.key);
                        setMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-left transition-colors ${
                        isActive
                          ? 'bg-emerald-700 text-white font-semibold'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          isActive ? 'text-amber-300' : 'text-slate-400'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{item.label}</div>
                        <div
                          className={`text-[11px] truncate ${
                            isActive ? 'text-emerald-100' : 'text-slate-400'
                          }`}
                        >
                          {item.sublabel}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Footer: RBAC & Cloud Status */}
            <div className="p-4 border-t border-slate-800 space-y-2 text-xs">
              <div className="rounded-lg bg-slate-800/90 p-3 space-y-1">
                <div className="flex items-center justify-between gap-1.5 text-amber-400 font-semibold">
                  <span className="flex items-center gap-1.5 truncate">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{currentRole}</span>
                  </span>
                  <span className="font-mono text-[11px] text-emerald-300 shrink-0">
                    @{adminUsername}
                  </span>
                </div>
                <div className="text-slate-200 truncate font-medium">{userDisplayName}</div>
                <div className="text-slate-400 text-[11px] truncate">
                  {isCloudAuthenticated ? 'Cloud Firestore Terhubung' : 'Cloud Firestore Siap'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLoginModalTab('credentials');
                  setLoginModalOpen(true);
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors"
              >
                <KeyRound className="h-3.5 w-3.5 text-amber-300" />
                <span>Ganti Username & Sandi</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('customer')}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
              >
                <Globe className="h-3.5 w-3.5 text-emerald-400" />
                <span>Halaman Depan Pelanggan</span>
              </button>
            </div>
          </aside>

          {/* Main Workspace Canvas */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Refined & Tidied Executive Admin Header Bar (Focused Element) */}
            <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs px-4 sm:px-6 py-3 shadow-2xs no-print">
              <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3">
                {/* Zone 1: Mobile Menu Trigger + Structured Module Title & Subtitle */}
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(true)}
                    aria-label="Buka menu navigasi"
                    className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-emerald-800 truncate">
                        {siteSettings.brandName}
                      </span>
                      <span className="text-slate-300" aria-hidden="true">
                        /
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm whitespace-nowrap">
                        {activeNavMeta.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate hidden sm:block">
                      {activeNavMeta.sublabel} · {siteSettings.erpHeaderSubtitle}
                    </p>
                  </div>
                </div>

                {/* Zone 2: Clean Segmented Module Switcher Pills */}
                <nav
                  aria-label="Pintasan Modul Utama"
                  className="hidden xl:flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs font-semibold"
                >
                  {[
                    { key: 'dashboard', label: 'Dashboard' },
                    { key: 'catering', label: 'Catering' },
                    { key: 'sekolah', label: 'Sekolah Rakyat' },
                    { key: 'keuangan', label: 'Keuangan & Laporan' },
                    { key: 'tampilan', label: 'Edit Tampilan Web' },
                  ].map((tab) => {
                    const isCurrent = activeModule === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveModule(tab.key as NavModuleKey)}
                        className={`rounded-lg px-3 py-1.5 transition-all whitespace-nowrap shrink-0 ${
                          isCurrent
                            ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>

                {/* Zone 3: Tidy Uniform Action Buttons (Edit Tampilan, Unduh Laporan, Web Pelanggan, Notifikasi, Akun) */}
                <div className="flex items-center gap-2 shrink-0 relative">
                  <button
                    type="button"
                    onClick={() => setActiveModule('tampilan')}
                    className={`hidden md:inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      activeModule === 'tampilan'
                        ? 'border-emerald-700 bg-emerald-700 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <LayoutTemplate className="h-3.5 w-3.5 text-emerald-700" />
                    <span>Ubah Isi Tampilan</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportReportCsv}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-950 hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-amber-700" />
                    <span className="hidden sm:inline">Unduh Laporan Keuangan</span>
                    <span className="sm:hidden">Laporan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode('customer')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Globe className="h-3.5 w-3.5 text-emerald-700" />
                    <span>Web Pelanggan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNotificationsOpen((prev) => !prev)}
                    aria-label="Notifikasi Operasional"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Bell className="h-3.5 w-3.5 text-emerald-700" />
                    <span className="font-mono">{lowStockAlerts.length + 2}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLoginModalTab('credentials');
                      setLoginModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    <UserCheck className="h-3.5 w-3.5 text-amber-400" />
                    <span>@{adminUsername}</span>
                  </button>

                  {/* Notification Popover */}
                  {notificationsOpen && (
                    <div className="absolute right-0 top-11 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-lg z-50 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-bold text-slate-900">Notifikasi Sistem Operasional</span>
                        <button
                          type="button"
                          onClick={() => setNotificationsOpen(false)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          Tutup
                        </button>
                      </div>
                      <div className="space-y-2">
                        <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-950">
                          <p className="font-semibold">Distribusi Sekolah Rakyat Aktif</p>
                          <p className="text-slate-600">
                            1.420 porsi makanan bergizi hari ini sedang didistribusikan ke 4 sekolah mitra.
                          </p>
                        </div>
                        {lowStockAlerts.map((item) => (
                          <div key={item.id} className="rounded-lg bg-amber-50 p-2.5 text-amber-950">
                            <p className="font-semibold">Peringatan Stok Minimum: {item.name}</p>
                            <p className="text-slate-600">
                              Sisa {item.stockQty} {item.unit} (Batas min: {item.minStock} {item.unit}).
                            </p>
                          </div>
                        ))}
                        <div className="rounded-lg bg-slate-50 p-2.5 text-slate-800">
                          <p className="font-semibold">Piutang Catering Jatuh Tempo</p>
                          <p className="text-slate-600">
                            Sisa pembayaran DP {formatRupiah(30000000)} untuk acara Gala Pernikahan.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Main Content Viewport */}
            <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
              {activeModule === 'dashboard' && (
                <DashboardView
                  state={erpSnapshot}
                  onNavigateModule={(modKey) => setActiveModule(modKey as NavModuleKey)}
                  onExportReportCsv={handleExportReportCsv}
                />
              )}

              {activeModule === 'catering' && (
                <CateringModule
                  ownerId={currentUid}
                  menuItems={menuItems}
                  orders={cateringOrders}
                  customers={customers}
                  productionBatches={productionBatches}
                  onSaveMenu={handleSaveMenu}
                  onDeleteMenu={handleDeleteMenu}
                  onSaveOrder={handleSaveOrder}
                  onDeleteOrder={handleDeleteOrder}
                  onSaveCustomer={handleSaveCustomer}
                  onDeleteCustomer={handleDeleteCustomer}
                  onSaveProduction={handleSaveProduction}
                  onDeleteProduction={handleDeleteProduction}
                />
              )}

              {activeModule === 'sekolah' && (
                <SekolahRakyatModule
                  ownerId={currentUid}
                  schools={schools}
                  deliveries={schoolDeliveries}
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

              {(activeModule === 'keuangan' ||
                activeModule === 'stok' ||
                activeModule === 'pemasaran' ||
                activeModule === 'backup') && (
                <FinanceInventoryModule
                  activeSection={activeModule}
                  ownerId={currentUid}
                  state={erpSnapshot}
                  currentRole={currentRole}
                  siteSettings={siteSettings}
                  adminUsername={adminUsername}
                  adminEmail={userEmail}
                  adminDisplayName={userDisplayName}
                  onUpdateAdminCredentials={handleUpdateAdminCredentials}
                  onSaveFinance={handleSaveFinance}
                  onDeleteFinance={handleDeleteFinance}
                  onSaveInventory={handleSaveInventory}
                  onDeleteInventory={handleDeleteInventory}
                  onSavePromotion={handleSavePromotion}
                  onDeletePromotion={handleDeletePromotion}
                  onSaveUser={handleSaveUser}
                  onRestoreBackup={handleRestoreBackup}
                />
              )}
            </main>

            {/* Quiet Enterprise Footer */}
            <footer className="border-t border-slate-200 bg-white px-6 py-3.5 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 no-print">
              <div>{siteSettings.footerCopyright}</div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setViewMode('customer')}
                  className="hover:text-slate-900 transition-colors"
                >
                  Halaman Depan Pelanggan
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModule('backup')}
                  className="hover:text-slate-900 transition-colors"
                >
                  Pengaturan Akun & Backup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginModalTab('credentials');
                    setLoginModalOpen(true);
                  }}
                  className="hover:text-slate-900 transition-colors"
                >
                  Ganti Username & Sandi Admin
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Login & RBAC Configuration Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        currentRole={currentRole}
        adminUsername={adminUsername}
        userEmail={userEmail}
        userDisplayName={userDisplayName}
        isCloudAuthenticated={isCloudAuthenticated}
        initialTab={loginModalTab}
        onGoogleLogin={handleGoogleLogin}
        onCredentialLogin={handleCredentialLogin}
        onUpdateCredentials={handleUpdateAdminCredentials}
        onLogout={handleLogout}
        onEnterAdminDashboard={() => setViewMode('admin')}
      />
    </div>
  );
}

