import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '.data');
const ORDERS_DB_PATH = path.resolve(DATA_DIR, 'orders-store.json');

interface StoredCartItem {
  menuId: string;
  name: string;
  category: string;
  packageName: string;
  unitPrice: number;
  quantity: number;
  imageUrl: string;
}

interface StoredOrder {
  id: string;
  ownerId: string;
  orderNumber: string;
  customerName: string;
  whatsapp: string;
  orderDate: string;
  deliveryDate: string;
  deliveryTime?: string;
  deliveryAddress?: string;
  deliveryMethod?: 'Pengiriman ke alamat' | 'Ambil sendiri di lokasi dapur';
  shippingCost?: number;
  paymentMethod?: 'Transfer Bank' | 'QRIS' | 'Pembayaran Tunai';
  locationLat?: number;
  locationLng?: number;
  items?: StoredCartItem[];
  eventType: string;
  packageName: string;
  portions: number;
  unitPrice: number;
  discount: number;
  totalPayment: number;
  downPayment: number;
  remainingBalance: number;
  paymentStatus: 'Belum Bayar' | 'DP Masuk' | 'Lunas';
  status: string;
  notes: string;
}

const INITIAL_ORDERS: StoredOrder[] = [
  {
    id: 'ord-20261116-001',
    ownerId: 'admin-workspace-uid',
    orderNumber: 'ORD-20261116-001',
    customerName: 'PT Bank Mandiri (Persero) Tbk - Kanwil Jakarta',
    whatsapp: '08119823401',
    orderDate: '2026-11-14',
    deliveryDate: '2026-11-16',
    deliveryTime: '10:00 WIB',
    deliveryAddress: 'Jl. Jend. Gatot Subroto Kav. 36-38, Gedung Plaza Mandiri Lt. 12, Jakarta Selatan',
    deliveryMethod: 'Pengiriman ke alamat',
    shippingCost: 0,
    paymentMethod: 'Transfer Bank',
    locationLat: -6.2246,
    locationLng: 106.8224,
    items: [
      {
        menuId: 'menu-nasi-kotak-ayam-madu',
        name: 'Nasi Kotak Ayam Bakar Madu Nusantara',
        category: 'Nasi kotak',
        packageName: 'Paket Kotak Eksekutif A',
        unitPrice: 38000,
        quantity: 350,
        imageUrl: '/src/assets/images/catering_nasi_kotak_premium_1794817100565.jpg',
      },
    ],
    eventType: 'Catering rapat',
    packageName: 'Nasi Kotak Ayam Bakar Madu Nusantara',
    portions: 350,
    unitPrice: 38000,
    discount: 300000,
    totalPayment: 13000000,
    downPayment: 13000000,
    remainingBalance: 0,
    paymentStatus: 'Lunas',
    status: 'Siap dikirim',
    notes: 'Diantar ke Gedung Plaza Mandiri Lt. 12 sebelum pukul 10:30 WIB.',
  },
  {
    id: 'ord-20261116-002',
    ownerId: 'admin-workspace-uid',
    orderNumber: 'ORD-20261116-002',
    customerName: 'Keluarga Besar H. Bambang Sudibyo',
    whatsapp: '08128776543',
    orderDate: '2026-11-12',
    deliveryDate: '2026-11-20',
    deliveryTime: '08:00 WIB',
    deliveryAddress: 'Balai Kartini Jakarta, Jl. Gatot Subroto Kav. 37, Jakarta Selatan',
    deliveryMethod: 'Pengiriman ke alamat',
    shippingCost: 0,
    paymentMethod: 'Transfer Bank',
    locationLat: -6.2476,
    locationLng: 106.8035,
    items: [
      {
        menuId: 'menu-pernikahan-adat',
        name: 'Gala Buffet Pernikahan Nusantara',
        category: 'Catering pernikahan',
        packageName: 'Paket Royal Wedding 500+ Pax',
        unitPrice: 120000,
        quantity: 600,
        imageUrl: '/src/assets/images/catering_prasmanan_executive_1794817101712.jpg',
      },
    ],
    eventType: 'Catering pernikahan',
    packageName: 'Gala Buffet Pernikahan Nusantara',
    portions: 600,
    unitPrice: 120000,
    discount: 2000000,
    totalPayment: 70000000,
    downPayment: 40000000,
    remainingBalance: 30000000,
    paymentStatus: 'DP Masuk',
    status: 'Diproses',
    notes: 'Balai Kartini Jakarta, setup meja prasmanan mulai pukul 06:00 WIB.',
  },
  {
    id: 'ord-20261116-003',
    ownerId: 'admin-workspace-uid',
    orderNumber: 'ORD-20261116-003',
    customerName: 'Kementerian Sosial RI - Direktorat Pemberdayaan',
    whatsapp: '08131099882',
    orderDate: '2026-11-15',
    deliveryDate: '2026-11-16',
    deliveryTime: '11:30 WIB',
    deliveryAddress: 'Jl. Salemba Raya No. 28, Senen, Jakarta Pusat',
    deliveryMethod: 'Pengiriman ke alamat',
    shippingCost: 0,
    paymentMethod: 'Transfer Bank',
    locationLat: -6.1954,
    locationLng: 106.8516,
    items: [
      {
        menuId: 'menu-prasmanan-vip-rendang',
        name: 'Prasmanan Corporate VIP Rendang & Udang Crispy',
        category: 'Catering prasmanan',
        packageName: 'Paket Buffet Korporat Gold',
        unitPrice: 95000,
        quantity: 220,
        imageUrl: '/src/assets/images/catering_prasmanan_executive_1794817101712.jpg',
      },
    ],
    eventType: 'Catering prasmanan',
    packageName: 'Prasmanan Corporate VIP Rendang & Udang Crispy',
    portions: 220,
    unitPrice: 95000,
    discount: 900000,
    totalPayment: 20000000,
    downPayment: 10000000,
    remainingBalance: 10000000,
    paymentStatus: 'DP Masuk',
    status: 'Sedang diproduksi',
    notes: 'Rapat Koordinasi Nasional Sekolah Rakyat di Salemba Raya No. 28.',
  },
  {
    id: 'ord-20261116-004',
    ownerId: 'admin-workspace-uid',
    orderNumber: 'ORD-20261116-004',
    customerName: 'PT Telkom Indonesia Regional II',
    whatsapp: '08129988771',
    orderDate: '2026-11-10',
    deliveryDate: '2026-11-13',
    deliveryTime: '11:00 WIB',
    deliveryAddress: 'Jl. Gatot Subroto Kav. 52, Jakarta Selatan',
    deliveryMethod: 'Pengiriman ke alamat',
    shippingCost: 0,
    paymentMethod: 'Transfer Bank',
    locationLat: -6.2297,
    locationLng: 106.8195,
    items: [
      {
        menuId: 'menu-perusahaan-shift',
        name: 'Catering Karyawan Shift Pabrik & Kantor',
        category: 'Catering perusahaan',
        packageName: 'Paket Kontrak Bulanan Korporasi',
        unitPrice: 30000,
        quantity: 500,
        imageUrl: '/src/assets/images/sekolah_rakyat_meal_box_1794817105250.jpg',
      },
    ],
    eventType: 'Catering perusahaan',
    packageName: 'Catering Karyawan Shift Pabrik & Kantor',
    portions: 500,
    unitPrice: 30000,
    discount: 0,
    totalPayment: 15000000,
    downPayment: 15000000,
    remainingBalance: 0,
    paymentStatus: 'Lunas',
    status: 'Selesai',
    notes: 'Pengiriman tepat waktu, berita acara serah terima ditandatangani GA.',
  },
];

function normalizePhone(rawPhone: string): string {
  const digits = String(rawPhone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return `0${digits.slice(2)}`;
  if (digits.startsWith('8')) return `0${digits}`;
  return digits;
}

function loadOrdersStore(): StoredOrder[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(ORDERS_DB_PATH)) {
      fs.writeFileSync(ORDERS_DB_PATH, JSON.stringify(INITIAL_ORDERS, null, 2), 'utf-8');
      return [...INITIAL_ORDERS];
    }
    const raw = fs.readFileSync(ORDERS_DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.error('Failed to read orders-store.json, falling back to initial seed:', err);
  }
  return [...INITIAL_ORDERS];
}

function saveOrdersStore(orders: StoredOrder[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(ORDERS_DB_PATH, JSON.stringify(orders, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save orders-store.json:', err);
  }
}

function deriveTrackingStage(order: StoredOrder) {
  let productionStatus = 'Menunggu Antrean Dapur';
  let deliveryStatus = 'Menunggu Jadwal Pengiriman';

  switch (order.status) {
    case 'Pesanan baru':
    case 'Menunggu pembayaran':
      productionStatus = 'Verifikasi Pesanan & Jadwal Dapur';
      deliveryStatus = 'Menunggu Proses Dapur';
      break;
    case 'Diproses':
      productionStatus = 'Persiapan Bahan Baku Segar';
      deliveryStatus = 'Terjadwal di Armada Logistik';
      break;
    case 'Sedang diproduksi':
      productionStatus = 'Sedang Dimasak & Pengemasan Higienis';
      deliveryStatus = 'Persiapan Armada Pengiriman';
      break;
    case 'Siap dikirim':
      productionStatus = 'Selesai Dimasak & Lulus Uji QC Gizi';
      deliveryStatus = 'Siap Dikirim / Menunggu Jam Keberangkatan';
      break;
    case 'Dalam pengiriman':
      productionStatus = 'Selesai Diproduksi (100%)';
      deliveryStatus = 'Dalam Perjalanan Kurir ke Lokasi Tujuan';
      break;
    case 'Selesai':
      productionStatus = 'Selesai Diproduksi (100%)';
      deliveryStatus = 'Pesanan Telah Diterima Pelanggan';
      break;
    case 'Dibatalkan':
      productionStatus = 'Dibatalkan';
      deliveryStatus = 'Pengiriman Dibatalkan';
      break;
  }

  return {
    productionStatus,
    deliveryStatus,
    estimatedDelivery: `${order.deliveryDate}${order.deliveryTime ? ` · Pukul ${order.deliveryTime}` : ''} (${
      order.deliveryMethod || 'Pengiriman ke alamat'
    })`,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // 1. Get all orders (for syncing state with ERP)
  app.get('/api/public/orders', (_req, res) => {
    const orders = loadOrdersStore();
    res.json({ orders });
  });

  // 2. Create a new guest customer order without login
  app.post('/api/public/orders', (req, res) => {
    const body = req.body || {};
    const customerName = String(body.customerName || '').trim();
    const whatsapp = String(body.whatsapp || '').trim();
    const deliveryDate = String(body.deliveryDate || '').trim();

    if (!customerName || normalizePhone(whatsapp).length < 7 || !deliveryDate) {
      res.status(400).json({
        error: 'Mohon lengkapi nama pemesan, nomor WhatsApp aktif, dan tanggal pengiriman.',
      });
      return;
    }

    const orders = loadOrdersStore();
    const todayStr = String(body.orderDate || '2026-11-16');
    const cleanDate = todayStr.replace(/[^0-9]/g, '').slice(0, 8) || '20261116';
    const seq = String(orders.length + 1).padStart(3, '0');
    const orderNumber = String(body.orderNumber || `ORD-${cleanDate}-${seq}`).toUpperCase();

    const newOrder: StoredOrder = {
      id: String(body.id || `ord-${Date.now()}`),
      ownerId: String(body.ownerId || 'admin-workspace-uid'),
      orderNumber,
      customerName: customerName.slice(0, 120),
      whatsapp: whatsapp.slice(0, 30),
      orderDate: todayStr,
      deliveryDate,
      deliveryTime: String(body.deliveryTime || '10:00 WIB'),
      deliveryAddress: String(body.deliveryAddress || 'Ambil di Dapur Sentral Smart Catering'),
      deliveryMethod:
        body.deliveryMethod === 'Ambil sendiri di lokasi dapur'
          ? 'Ambil sendiri di lokasi dapur'
          : 'Pengiriman ke alamat',
      shippingCost: Math.max(0, Number(body.shippingCost) || 0),
      paymentMethod: body.paymentMethod || 'Transfer Bank',
      locationLat: Number(body.locationLat) || -6.2088,
      locationLng: Number(body.locationLng) || 106.8456,
      items: Array.isArray(body.items) ? body.items : [],
      eventType: String(body.eventType || 'Nasi kotak'),
      packageName: String(body.packageName || 'Pesanan Katalog Pelanggan').slice(0, 120),
      portions: Math.max(1, Number(body.portions) || 1),
      unitPrice: Math.max(0, Number(body.unitPrice) || 0),
      discount: Math.max(0, Number(body.discount) || 0),
      totalPayment: Math.max(0, Number(body.totalPayment) || 0),
      downPayment: Math.max(0, Number(body.downPayment) || 0),
      remainingBalance: Math.max(0, Number(body.remainingBalance) || 0),
      paymentStatus: body.paymentStatus || 'Belum Bayar',
      status: body.status || 'Pesanan baru',
      notes: String(body.notes || '').slice(0, 400),
    };

    const existingIdx = orders.findIndex(
      (o) => o.id === newOrder.id || o.orderNumber === newOrder.orderNumber
    );
    if (existingIdx >= 0) {
      orders[existingIdx] = newOrder;
    } else {
      orders.unshift(newOrder);
    }

    saveOrdersStore(orders);
    res.status(201).json({ order: newOrder });
  });

  // 3. Backend-Validated Public Order Tracking (No Customer Login Required)
  // Access is strictly granted ONLY if BOTH orderNumber and normalized WhatsApp match on the server
  app.post('/api/public/orders/track', (req, res) => {
    const { orderNumber, whatsapp } = req.body || {};
    const cleanOrderNum = String(orderNumber || '').trim().toUpperCase();
    const cleanPhone = normalizePhone(String(whatsapp || ''));

    if (!cleanOrderNum || cleanPhone.length < 7) {
      res.status(200).json({
        matched: false,
        error: 'Masukkan Nomor Pesanan dan Nomor WhatsApp yang valid.',
      });
      return;
    }

    const orders = loadOrdersStore();
    const matched = orders.find(
      (o) =>
        o.orderNumber.trim().toUpperCase() === cleanOrderNum &&
        normalizePhone(o.whatsapp) === cleanPhone
    );

    if (!matched) {
      res.status(200).json({
        matched: false,
        error:
          'Data pesanan tidak ditemukan atau kombinasi Nomor Pesanan dan Nomor WhatsApp tidak cocok.',
      });
      return;
    }

    const stages = deriveTrackingStage(matched);
    res.json({
      matched: true,
      tracking: {
        orderNumber: matched.orderNumber,
        customerName: matched.customerName,
        whatsapp: matched.whatsapp,
        orderDate: matched.orderDate,
        deliveryDate: matched.deliveryDate,
        deliveryTime: matched.deliveryTime || '10:00 WIB',
        deliveryAddress: matched.deliveryAddress || matched.notes,
        deliveryMethod: matched.deliveryMethod || 'Pengiriman ke alamat',
        paymentMethod: matched.paymentMethod || 'Transfer Bank',
        items:
          matched.items && matched.items.length > 0
            ? matched.items
            : [
                {
                  menuId: 'item-main',
                  name: matched.packageName,
                  category: matched.eventType,
                  packageName: matched.packageName,
                  unitPrice: matched.unitPrice,
                  quantity: matched.portions,
                  imageUrl: '',
                },
              ],
        portions: matched.portions,
        discount: matched.discount,
        shippingCost: matched.shippingCost || 0,
        totalPayment: matched.totalPayment,
        paymentStatus: matched.paymentStatus,
        status: matched.status,
        productionStatus: stages.productionStatus,
        deliveryStatus: stages.deliveryStatus,
        estimatedDelivery: stages.estimatedDelivery,
        notes: matched.notes,
      },
    });
  });

  // 4. Sync admin order updates/deletions to backend store
  app.post('/api/admin/orders/sync', (req, res) => {
    const { orders } = req.body || {};
    if (Array.isArray(orders)) {
      saveOrdersStore(orders);
      res.json({ ok: true, count: orders.length });
      return;
    }
    res.status(400).json({ error: 'Invalid orders array' });
  });

  // 5. Persistent Admin Account & Credential Management (Username & Password)
  const ADMIN_ACCOUNT_PATH = path.resolve(DATA_DIR, 'admin-account.json');

  interface StoredAdminAccount {
    username: string;
    email: string;
    displayName: string;
    password: string;
    role: string;
    department: string;
    updatedAt: string;
  }

  const DEFAULT_ADMIN_ACCOUNT: StoredAdminAccount = {
    username: 'admin',
    email: 'primayaadmin@gmail.com',
    displayName: 'Ir. Pratama Wijaya, MBA',
    password: 'SmartCatering2026!',
    role: 'Super Admin',
    department: 'Direksi & Manajemen Utama',
    updatedAt: '2026-11-16T07:00:00.000Z',
  };

  function loadAdminAccount(): StoredAdminAccount {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(ADMIN_ACCOUNT_PATH)) {
        fs.writeFileSync(
          ADMIN_ACCOUNT_PATH,
          JSON.stringify(DEFAULT_ADMIN_ACCOUNT, null, 2),
          'utf-8'
        );
        return { ...DEFAULT_ADMIN_ACCOUNT };
      }
      const raw = fs.readFileSync(ADMIN_ACCOUNT_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.username === 'string' && typeof parsed.password === 'string') {
        return { ...DEFAULT_ADMIN_ACCOUNT, ...parsed };
      }
    } catch (err) {
      console.error('Failed to read admin-account.json:', err);
    }
    return { ...DEFAULT_ADMIN_ACCOUNT };
  }

  function saveAdminAccount(account: StoredAdminAccount): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(ADMIN_ACCOUNT_PATH, JSON.stringify(account, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write admin-account.json:', err);
    }
  }

  app.get('/api/admin/account', (_req, res) => {
    const account = loadAdminAccount();
    res.json({
      account: {
        username: account.username,
        email: account.email,
        displayName: account.displayName,
        role: account.role,
        department: account.department,
        updatedAt: account.updatedAt,
      },
    });
  });

  app.post('/api/admin/login', (req, res) => {
    const { identifier, password, role } = req.body || {};
    const cleanId = String(identifier || '').trim().toLowerCase();
    const rawPass = String(password || '');
    const account = loadAdminAccount();

    if (!cleanId || !rawPass) {
      res.status(200).json({
        ok: false,
        authenticated: false,
        error: 'Mohon isi username/email dan kata sandi terlebih dahulu.',
      });
      return;
    }

    const matchesIdentifier =
      cleanId === account.username.trim().toLowerCase() ||
      cleanId === account.email.trim().toLowerCase();

    if (!matchesIdentifier || rawPass !== account.password) {
      res.status(200).json({
        ok: false,
        authenticated: false,
        error: `Username atau kata sandi tidak sesuai. Gunakan username "${account.username}" atau email "${account.email}".`,
      });
      return;
    }

    const updatedRole = String(role || account.role);
    const updatedAccount: StoredAdminAccount = {
      ...account,
      role: updatedRole,
    };
    saveAdminAccount(updatedAccount);

    res.json({
      ok: true,
      authenticated: true,
      account: {
        username: updatedAccount.username,
        email: updatedAccount.email,
        displayName: updatedAccount.displayName,
        role: updatedAccount.role,
        department: updatedAccount.department,
        updatedAt: updatedAccount.updatedAt,
      },
    });
  });

  app.post('/api/admin/credentials', (req, res) => {
    const {
      currentPassword,
      newUsername,
      newDisplayName,
      newEmail,
      newPassword,
      confirmPassword,
      newRole,
    } = req.body || {};

    const account = loadAdminAccount();
    const cleanCurrentPass = String(currentPassword || '');

    if (cleanCurrentPass && cleanCurrentPass !== account.password) {
      res.status(200).json({
        ok: false,
        updated: false,
        error: 'Kata sandi saat ini tidak sesuai. Mohon periksa kembali kata sandi lama Anda.',
      });
      return;
    }

    const trimmedUsername = String(newUsername ?? account.username).trim();
    if (trimmedUsername.length < 3) {
      res.status(200).json({
        ok: false,
        updated: false,
        error: 'Username baru minimal terdiri dari 3 karakter.',
      });
      return;
    }

    let finalPassword = account.password;
    if (String(newPassword || '').trim().length > 0) {
      const candidatePass = String(newPassword).trim();
      if (candidatePass.length < 6) {
        res.status(200).json({
          ok: false,
          updated: false,
          error: 'Kata sandi baru minimal terdiri dari 6 karakter demi keamanan akun.',
        });
        return;
      }
      if (confirmPassword !== undefined && candidatePass !== String(confirmPassword).trim()) {
        res.status(200).json({
          ok: false,
          updated: false,
          error: 'Konfirmasi kata sandi baru tidak cocok.',
        });
        return;
      }
      finalPassword = candidatePass;
    }

    const updatedAccount: StoredAdminAccount = {
      username: trimmedUsername.slice(0, 60),
      email: String(newEmail ?? account.email).trim().slice(0, 120) || account.email,
      displayName:
        String(newDisplayName ?? account.displayName).trim().slice(0, 100) || account.displayName,
      password: finalPassword,
      role: String(newRole ?? account.role).trim() || account.role,
      department: account.department,
      updatedAt: new Date().toISOString(),
    };

    saveAdminAccount(updatedAccount);

    res.json({
      ok: true,
      updated: true,
      message: 'Username dan kata sandi admin berhasil diperbarui.',
      account: {
        username: updatedAccount.username,
        email: updatedAccount.email,
        displayName: updatedAccount.displayName,
        role: updatedAccount.role,
        department: updatedAccount.department,
        updatedAt: updatedAccount.updatedAt,
      },
    });
  });

  // 6. Persistent Website & App Display Content Settings (CMS)
  const SITE_SETTINGS_PATH = path.resolve(DATA_DIR, 'site-settings.json');

  const DEFAULT_SERVER_SITE_SETTINGS: Record<string, unknown> = {
    brandName: 'SMART CATERING',
    brandTagline: '& Sekolah Rakyat ERP',
    erpSystemTitle: 'Smart Catering & Sekolah Rakyat Management System',
    erpHeaderSubtitle: 'Pusat Kendali Operasional, Akuntansi & Distribusi Gizi',
    accentTheme: 'emerald',
    heroBadge: 'Layanan Catering Profesional · Bersertifikat Halal & Laik Higiene Sanitasi',
    heroTitle: 'Solusi Makanan Berkualitas untuk Setiap Kebutuhan Anda',
    heroDescription:
      'Pesan catering dengan mudah, nikmati hidangan berkualitas, dan dapatkan layanan terbaik untuk kebutuhan harian, acara, maupun instansi.',
    heroImageUrl: '/src/assets/images/catering_prasmanan_executive_1794817101712.jpg',
    heroImageCaptionTitle: 'Dapur Sentral Standar Nasional · Higienis & Bergizi',
    heroImageCaptionSubtitle: 'Melayani Instansi, Perusahaan, Pernikahan, Rapat & Keluarga',
    heroBtnPrimary: 'Lihat Menu',
    heroBtnSecondary: 'Pesan Sekarang',
    heroBtnWhatsapp: 'Hubungi WhatsApp',
    stat1Title: '100% Tanpa Login',
    stat1Desc: 'Langsung pilih menu & pesan',
    stat2Title: '8 Kategori Menu',
    stat2Desc: 'Harian, Kotak, Buffet & VIP',
    stat3Title: 'Tepat Waktu',
    stat3Desc: 'Armada berpendingin & higienis',
    catalogBadge: 'Katalog Hidangan Siap Pesan (Tanpa Registrasi Akun)',
    catalogTitle: 'Menu Makanan & Paket Catering Pilihan',
    catalogDescription: 'Klik "Tambah ke Keranjang" untuk langsung memesan tanpa perlu membuat akun.',
    promoBadge: 'Program Promo Resmi Pelanggan & Instansi',
    promoTitle: 'Voucher Diskon & Penawaran Catering Aktif',
    trackingBadge: 'Pelacakan Real-Time Terverifikasi Server (Tanpa Perlu Login)',
    trackingTitle: 'Lacak Status Pesanan Catering Anda',
    trackingDescription:
      'Masukkan Nomor Pesanan dan Nomor WhatsApp yang Anda gunakan saat memesan. Sistem backend kami memverifikasi kecocokan keduanya untuk menjaga privasi pesanan Anda.',
    aboutBadge: 'Tentang Smart Catering Nusantara',
    aboutTitle: 'Standar Kuliner Eksekutif & Mitra Gizi Terpercaya',
    aboutDescription:
      'Smart Catering melayani kebutuhan hidangan berkualitas tinggi untuk perusahaan, instansi pemerintah, pernikahan, rapat eksekutif, katering harian keluarga, serta penyediaan makanan bergizi terpadu untuk program Sekolah Rakyat.',
    feature1Title: '100% Halal & Higienis',
    feature1Desc: 'Tersertifikasi Halal MUI & Laik Higiene Sanitasi Dinas Kesehatan.',
    feature2Title: 'Ahli Gizi & Chef Berpengalaman',
    feature2Desc: 'Takaran kalori terukur dan bahan baku segar pilihan setiap hari.',
    feature3Title: 'Pengiriman Tepat Waktu',
    feature3Desc: 'Armada distribusi berpendingin menjangkau seluruh Jabodetabek.',
    contactBadge: 'Hubungi Kami & Konsultasi Acara',
    contactTitle: 'Dapur Sentral & Layanan Pelanggan',
    companyAddress:
      'Jl. Proklamasi No. 42, Menteng, Jakarta Pusat 10320 (Dapur Sentral & Showroom Test Food)',
    whatsappNumber: '628119823401',
    whatsappDisplay: '0811-9823-401',
    operatingHours: 'Senin – Minggu, 06:00 – 21:00 WIB',
    bankName: 'Bank Mandiri Cabang KCP Menteng Jakarta',
    bankAccountNumber: '122-00-9882736-4',
    bankAccountHolder: 'PT Smart Catering Nusantara',
    footerCopyright:
      '© 2026 Smart Catering & Sekolah Rakyat Management System · Standar Akuntansi & Gizi Nasional',
    updatedAt: '2026-11-16T07:00:00.000Z',
  };

  function loadSiteSettings(): Record<string, unknown> {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(SITE_SETTINGS_PATH)) {
        fs.writeFileSync(
          SITE_SETTINGS_PATH,
          JSON.stringify(DEFAULT_SERVER_SITE_SETTINGS, null, 2),
          'utf-8'
        );
        return { ...DEFAULT_SERVER_SITE_SETTINGS };
      }
      const raw = fs.readFileSync(SITE_SETTINGS_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_SERVER_SITE_SETTINGS, ...parsed };
      }
    } catch (err) {
      console.error('Failed to read site-settings.json:', err);
    }
    return { ...DEFAULT_SERVER_SITE_SETTINGS };
  }

  function saveSiteSettings(settings: Record<string, unknown>): Record<string, unknown> {
    const merged = {
      ...DEFAULT_SERVER_SITE_SETTINGS,
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(SITE_SETTINGS_PATH, JSON.stringify(merged, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write site-settings.json:', err);
    }
    return merged;
  }

  app.get('/api/site-settings', (_req, res) => {
    res.json({ settings: loadSiteSettings() });
  });

  app.post('/api/admin/site-settings', (req, res) => {
    const body = req.body?.settings || req.body || {};
    const saved = saveSiteSettings(body);
    res.json({
      ok: true,
      updated: true,
      message: 'Seluruh perubahan isi tampilan website berhasil disimpan dan diterapkan.',
      settings: saved,
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Smart Catering & Sekolah Rakyat Server running on http://0.0.0.0:${port}`);
  });
}

startServer();
