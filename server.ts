import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  DEFAULT_RECOVERY_EMAIL,
  RESET_CODE_TTL_MS,
  buildPasswordResetEmailContent,
  resolveRecoveryEmail,
  validateAdminCredentialsMatch,
  validateNewPasswordInput,
  verifyResetTokenRecord,
} from './src/utils/adminAuth.ts';

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
      fs.writeFileSync(ORDERS_DB_PATH, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(ORDERS_DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.error('Failed to read orders-store.json:', err);
  }
  return [];
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
  app.use(express.json({ limit: '30mb' }));

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
        downPayment: matched.downPayment || 0,
        remainingBalance: matched.remainingBalance ?? Math.max(0, matched.totalPayment - (matched.downPayment || 0)),
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

  app.delete('/api/public/orders/:id', (req, res) => {
    const targetId = String(req.params.id || '').trim();
    const existing = loadOrdersStore();
    const next = existing.filter((o) => o.id !== targetId);
    saveOrdersStore(next);
    res.json({ ok: true, deletedId: targetId, count: next.length });
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
    email: DEFAULT_RECOVERY_EMAIL,
    displayName: 'Administrator Utama',
    password: 'Zkldwi123',
    role: 'Super Admin',
    department: 'Direksi & Manajemen Utama',
    updatedAt: '2026-11-16T22:00:00.000Z',
  };

  const PASSWORD_RESETS_PATH = path.resolve(DATA_DIR, 'password-resets.json');

  interface StoredPasswordResetRecord {
    id: string;
    targetEmail: string;
    code: string;
    createdAt: string;
    expiresAtMs: number;
    used: boolean;
    attempts: number;
    deliveryChannel: 'smtp' | 'resend' | 'sandbox-outbox';
  }

  function loadPasswordResets(): StoredPasswordResetRecord[] {
    try {
      if (!fs.existsSync(PASSWORD_RESETS_PATH)) return [];
      const raw = fs.readFileSync(PASSWORD_RESETS_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as StoredPasswordResetRecord[]) : [];
    } catch {
      return [];
    }
  }

  function savePasswordResets(records: StoredPasswordResetRecord[]): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(PASSWORD_RESETS_PATH, JSON.stringify(records.slice(0, 20), null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write password-resets.json:', err);
    }
  }

  async function dispatchResetEmail(mail: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<{ delivered: boolean; channel: 'smtp' | 'resend' | 'sandbox-outbox'; detail?: string }> {
    const smtpUser = (process.env.SMTP_USER || process.env.GMAIL_USER || '').trim();
    const smtpPass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '').trim();
    const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    const smtpPort = Number(process.env.SMTP_PORT || 465);

    if (smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });
        await transporter.sendMail({
          from: `"Smart Catering Admin" <${smtpUser}>`,
          to: mail.to,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        });
        return { delivered: true, channel: 'smtp' };
      } catch (err) {
        console.error('SMTP email dispatch failed:', err);
        return {
          delivered: false,
          channel: 'sandbox-outbox',
          detail: err instanceof Error ? err.message : 'SMTP dispatch error',
        };
      }
    }

    const resendKey = (process.env.RESEND_API_KEY || '').trim();
    if (resendKey) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || 'Smart Catering <onboarding@resend.dev>',
            to: [mail.to],
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
          }),
        });
        if (res.ok) {
          return { delivered: true, channel: 'resend' };
        }
        const errBody = await res.text();
        console.error('Resend API dispatch failed:', errBody);
      } catch (err) {
        console.error('Resend API request failed:', err);
      }
    }

    return {
      delivered: false,
      channel: 'sandbox-outbox',
      detail: 'SMTP_USER/SMTP_PASS atau RESEND_API_KEY belum dikonfigurasi pada server.',
    };
  }

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
    const cleanId = String(identifier || '').trim();
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

    const authenticated = validateAdminCredentialsMatch(
      { identifier: cleanId, password: rawPass },
      account
    );

    if (!authenticated) {
      res.status(200).json({
        ok: false,
        authenticated: false,
        error: 'Username atau kata sandi tidak sesuai. Silakan periksa kembali.',
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

  app.post('/api/admin/forgot-password', async (_req, res) => {
    const account = loadAdminAccount();
    const targetEmail = resolveRecoveryEmail(account.email || DEFAULT_RECOVERY_EMAIL);
    const code = String(crypto.randomInt(100000, 1000000));
    const nowMs = Date.now();
    const sentAt = new Date(nowMs).toISOString();

    const mailContent = buildPasswordResetEmailContent({
      toEmail: targetEmail,
      code,
      appTitle: 'Smart Catering & Sekolah Rakyat ERP',
      expiresMinutes: 15,
    });

    const delivery = await dispatchResetEmail(mailContent);

    const existing = loadPasswordResets().map((item) => ({ ...item, used: true }));
    const newRecord: StoredPasswordResetRecord = {
      id: `rst-${crypto.randomUUID()}`,
      targetEmail,
      code,
      createdAt: sentAt,
      expiresAtMs: nowMs + RESET_CODE_TTL_MS,
      used: false,
      attempts: 0,
      deliveryChannel: delivery.channel,
    };
    savePasswordResets([newRecord, ...existing]);

    res.json({
      ok: true,
      targetEmail,
      emailDelivered: delivery.delivered,
      deliveryChannel: delivery.channel,
      deliveryDetail: delivery.detail,
      expiresInMinutes: 15,
      sentAt,
      mailtoUrl: mailContent.mailtoUrl,
      ...(delivery.delivered ? {} : { sandboxCode: code }),
    });
  });

  app.post('/api/admin/reset-password', (req, res) => {
    const { code, newPassword, confirmPassword } = req.body || {};
    const passwordCheck = validateNewPasswordInput(
      String(newPassword || ''),
      String(confirmPassword || '')
    );
    if (!passwordCheck.valid || !passwordCheck.cleanedPassword) {
      res.status(200).json({
        ok: false,
        reset: false,
        error: passwordCheck.error,
      });
      return;
    }

    const records = loadPasswordResets();
    const latest = records.find((r) => !r.used) || records[0] || null;
    const verification = verifyResetTokenRecord(latest, String(code || ''), Date.now());

    if (!verification.valid || !latest) {
      if (latest && !latest.used) {
        const updatedRecords = records.map((r) =>
          r.id === latest.id ? { ...r, attempts: r.attempts + 1 } : r
        );
        savePasswordResets(updatedRecords);
      }
      res.status(200).json({
        ok: false,
        reset: false,
        error: verification.error,
      });
      return;
    }

    const account = loadAdminAccount();
    const updatedAccount: StoredAdminAccount = {
      ...account,
      password: passwordCheck.cleanedPassword,
      updatedAt: new Date().toISOString(),
    };
    saveAdminAccount(updatedAccount);

    savePasswordResets(
      records.map((r) => (r.id === latest.id ? { ...r, used: true } : r))
    );

    res.json({
      ok: true,
      reset: true,
      username: updatedAccount.username,
      email: updatedAccount.email,
      message: 'Kata sandi admin berhasil direset. Silakan masuk dengan kata sandi baru.',
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

    if (!cleanCurrentPass || cleanCurrentPass !== account.password) {
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
    accentTheme: 'flora-elegan',
    themeOrnamentEnabled: true,
    themeOrnamentUrl: '/assets/aistudio/image_aa6f6a24.png',
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
    bank2Name: 'Bank BCA Corporate',
    bank2AccountNumber: '542-099-8812',
    bank2AccountHolder: 'PT Smart Catering Nusantara',
    qrisMerchantName: 'SMART CATERING NUSANTARA',
    qrisNmid: 'ID1026098827163',
    qrisImageUrl: '',
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

  // 7. Persistent Paid Notifications ("Sudah Dibayar") & Order Payment Confirmation
  const PAID_NOTIFS_PATH = path.resolve(DATA_DIR, 'paid-notifications.json');

  interface StoredPaidNotif {
    id: string;
    orderId: string;
    orderNumber: string;
    customerName: string;
    whatsapp: string;
    amount: number;
    paymentMethod: 'Transfer Bank' | 'QRIS' | 'Pembayaran Tunai';
    paidAt: string;
    verifiedBy: string;
    note: string;
    isRead: boolean;
  }

  const DEFAULT_PAID_NOTIFS: StoredPaidNotif[] = [
    {
      id: 'notif-paid-1',
      orderId: 'ord-20261116-001',
      orderNumber: 'ORD-20261116-001',
      customerName: 'PT Bank Mandiri (Persero) Tbk - Kanwil Jakarta',
      whatsapp: '08119823401',
      amount: 14850000,
      paymentMethod: 'Transfer Bank',
      paidAt: '16 Nov 2026 · 09:40 WIB',
      verifiedBy: 'Verifikasi Bank Mandiri ERP',
      note: 'Pembayaran lunas (Sudah Dibayar) untuk 350 porsi Paket Rapat VIP Sekat 5.',
      isRead: false,
    },
    {
      id: 'notif-paid-2',
      orderId: 'ord-20261116-003',
      orderNumber: 'ORD-20261116-003',
      customerName: 'Kementerian Pendidikan Dasar & Menengah RI',
      whatsapp: '081287341900',
      amount: 16200000,
      paymentMethod: 'Transfer Bank',
      paidAt: '16 Nov 2026 · 08:15 WIB',
      verifiedBy: 'Konfirmasi Bendahara Instansi',
      note: 'Pembayaran lunas (Sudah Dibayar) untuk 450 porsi Nasi Kotak Ayam Bakar Madu + Snack Box.',
      isRead: false,
    },
  ];

  function loadPaidNotifs(): StoredPaidNotif[] {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(PAID_NOTIFS_PATH)) {
        fs.writeFileSync(PAID_NOTIFS_PATH, JSON.stringify([], null, 2), 'utf-8');
        return [];
      }
      const raw = fs.readFileSync(PAID_NOTIFS_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (err) {
      console.error('Failed to read paid-notifications.json:', err);
    }
    return [];
  }

  function savePaidNotifs(items: StoredPaidNotif[]): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(PAID_NOTIFS_PATH, JSON.stringify(items, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write paid-notifications.json:', err);
    }
  }

  app.get('/api/notifications/paid', (_req, res) => {
    res.json({ notifications: loadPaidNotifs() });
  });

  app.post('/api/orders/confirm-payment', (req, res) => {
    const {
      orderId,
      orderNumber,
      customerName,
      whatsapp,
      amount,
      paymentMethod,
      verifiedBy,
      note,
    } = req.body || {};

    const orders = loadOrdersStore();
    const updatedOrders = orders.map((o) => {
      if (o.id === orderId || o.orderNumber === orderNumber) {
        return {
          ...o,
          paymentStatus: 'Lunas' as const,
          downPayment: o.totalPayment,
          remainingBalance: 0,
          status:
            o.status === 'Pesanan baru' || o.status === 'Menunggu pembayaran'
              ? 'Diproses'
              : o.status,
        };
      }
      return o;
    });
    saveOrdersStore(updatedOrders);

    const matchedOrder = updatedOrders.find(
      (o) => o.id === orderId || o.orderNumber === orderNumber
    );

    const nowTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    });

    const newNotif: StoredPaidNotif = {
      id: `notif-paid-${Date.now()}`,
      orderId: String(orderId || matchedOrder?.id || `ord-${Date.now()}`),
      orderNumber: String(orderNumber || matchedOrder?.orderNumber || 'ORD-BARU'),
      customerName: String(customerName || matchedOrder?.customerName || 'Pelanggan Catering'),
      whatsapp: String(whatsapp || matchedOrder?.whatsapp || '08119823401'),
      amount: Number(amount ?? matchedOrder?.totalPayment ?? 0),
      paymentMethod:
        paymentMethod === 'QRIS' || paymentMethod === 'Pembayaran Tunai'
          ? paymentMethod
          : 'Transfer Bank',
      paidAt: `16 Nov 2026 · ${nowTime} WIB`,
      verifiedBy: String(verifiedBy || 'Admin Keuangan / Sistem Pembayaran'),
      note: String(
        note ||
          `Pembayaran sebesar Rp ${Number(
            amount ?? matchedOrder?.totalPayment ?? 0
          ).toLocaleString('id-ID')} telah diverifikasi SUDAH DIBAYAR (Lunas).`
      ),
      isRead: false,
    };

    const existingNotifs = loadPaidNotifs();
    const nextNotifs = [
      newNotif,
      ...existingNotifs.filter((n) => n.orderNumber !== newNotif.orderNumber),
    ];
    savePaidNotifs(nextNotifs);

    res.json({
      ok: true,
      notification: newNotif,
      notifications: nextNotifs,
      order: matchedOrder || null,
    });
  });

  app.post('/api/notifications/paid/mark-read', (_req, res) => {
    const next = loadPaidNotifs().map((n) => ({ ...n, isRead: true }));
    savePaidNotifs(next);
    res.json({ ok: true, notifications: next });
  });

  // 8. Persistent User Accounts Store (Super Admin Account Deletion & Management)
  const USERS_STORE_PATH = path.resolve(DATA_DIR, 'users-store.json');

  interface StoredUserRecord {
    id: string;
    ownerId: string;
    displayName: string;
    email: string;
    role: string;
    department: string;
    status: 'Aktif' | 'Nonaktif';
  }

  const DEFAULT_STORED_USERS: StoredUserRecord[] = [
    {
      id: 'usr-1',
      ownerId: 'admin-workspace-uid',
      displayName: 'Administrator Utama',
      email: DEFAULT_RECOVERY_EMAIL,
      role: 'Super Admin',
      department: 'Direksi & Manajemen Pusat',
      status: 'Aktif',
    },
    {
      id: 'usr-2',
      ownerId: 'admin-workspace-uid',
      displayName: 'Chef Hendra Wijaya',
      email: 'hendra.dapur@smartcatering.id',
      role: 'Kepala Dapur & Produksi',
      department: 'Dapur Sentral & Quality Control Gizi',
      status: 'Aktif',
    },
    {
      id: 'usr-3',
      ownerId: 'admin-workspace-uid',
      displayName: 'Nadia Putri, SE., Ak.',
      email: 'nadia.finance@smartcatering.id',
      role: 'Akuntan Keuangan',
      department: 'Keuangan, Kas & Pajak',
      status: 'Aktif',
    },
    {
      id: 'usr-4',
      ownerId: 'admin-workspace-uid',
      displayName: 'Budi Santoso, S.Sos.',
      email: 'budi.sekolah@smartcatering.id',
      role: 'Koordinator Sekolah Rakyat',
      department: 'Distribusi Gizi Sekolah Rakyat',
      status: 'Aktif',
    },
    {
      id: 'usr-5',
      ownerId: 'admin-workspace-uid',
      displayName: 'Rizky Ramadhan',
      email: 'rizky.kurir@smartcatering.id',
      role: 'Kurir Distribusi',
      department: 'Armada Pengiriman & Logistik',
      status: 'Aktif',
    },
  ];

  function loadUsersStore(): StoredUserRecord[] {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(USERS_STORE_PATH)) {
        fs.writeFileSync(
          USERS_STORE_PATH,
          JSON.stringify(DEFAULT_STORED_USERS, null, 2),
          'utf-8'
        );
        return [...DEFAULT_STORED_USERS];
      }
      const raw = fs.readFileSync(USERS_STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (err) {
      console.error('Failed to read users-store.json:', err);
    }
    return [...DEFAULT_STORED_USERS];
  }

  function saveUsersStore(users: StoredUserRecord[]): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(USERS_STORE_PATH, JSON.stringify(users, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write users-store.json:', err);
    }
  }

  app.get('/api/admin/users', (_req, res) => {
    res.json({ users: loadUsersStore() });
  });

  app.post('/api/admin/users', (req, res) => {
    const user = req.body?.user || req.body || {};
    if (!user.displayName || !user.email) {
      res.status(400).json({ ok: false, error: 'Nama dan email wajib diisi.' });
      return;
    }
    const existing = loadUsersStore();
    const newUser: StoredUserRecord = {
      id: String(user.id || `usr-${Date.now()}`),
      ownerId: String(user.ownerId || 'admin-workspace-uid'),
      displayName: String(user.displayName).trim().slice(0, 100),
      email: String(user.email).trim().slice(0, 150),
      role: String(user.role || 'Staf Operasional'),
      department: String(user.department || 'Operasional').trim().slice(0, 80),
      status: user.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
    };
    const next = [newUser, ...existing.filter((u) => u.id !== newUser.id)];
    saveUsersStore(next);
    res.json({ ok: true, user: newUser, users: next });
  });

  app.delete('/api/admin/users/:id', (req, res) => {
    const targetId = String(req.params.id || '').trim();
    const existing = loadUsersStore();
    const targetUser = existing.find((u) => u.id === targetId);
    const next = existing.filter((u) => u.id !== targetId);
    saveUsersStore(next);
    res.json({
      ok: true,
      deletedId: targetId,
      deletedUser: targetUser || null,
      users: next,
      message: `Akun ${targetUser?.displayName || targetId} berhasil dihapus oleh Super Admin.`,
    });
  });

  // 9. Persistent Website Background Music Store & Audio Upload Handler
  const MUSIC_STORE_PATH = path.resolve(DATA_DIR, 'music-tracks.json');
  const MUSIC_UPLOADS_DIR = path.resolve(DATA_DIR, 'music-uploads');

  interface StoredMusicTrack {
    id: string;
    title: string;
    audioUrl: string;
    sourceType: 'builtin' | 'upload' | 'url';
    fileName?: string;
    isActive: boolean;
    createdAt: string;
  }

  interface StoredMusicState {
    tracks: StoredMusicTrack[];
    activeTrackId: string | null;
  }

  const DEFAULT_MUSIC_STATE: StoredMusicState = {
    tracks: [
      {
        id: 'track-kenny-g-forever-in-love',
        title: 'Kenny G - Forever In Love',
        audioUrl:
          '/assets/aistudio/Kenny_G_-_Forever_In_Love_-_krasivyj_saksofon_krasivaya_melodiya_-_legkoe_nenavyazchivoe_slushanie_Easy__mp3.pm__44ef1749.mp3',
        sourceType: 'builtin',
        fileName: 'Kenny G - Forever In Love.mp3',
        isActive: true,
        createdAt: '2026-11-16T00:00:00.000Z',
      },
    ],
    activeTrackId: 'track-kenny-g-forever-in-love',
  };

  function ensureMusicDirs() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(MUSIC_UPLOADS_DIR)) fs.mkdirSync(MUSIC_UPLOADS_DIR, { recursive: true });
  }

  function loadMusicState(): StoredMusicState {
    try {
      ensureMusicDirs();
      if (!fs.existsSync(MUSIC_STORE_PATH)) {
        fs.writeFileSync(MUSIC_STORE_PATH, JSON.stringify(DEFAULT_MUSIC_STATE, null, 2), 'utf-8');
        return {
          tracks: [...DEFAULT_MUSIC_STATE.tracks],
          activeTrackId: DEFAULT_MUSIC_STATE.activeTrackId,
        };
      }
      const raw = fs.readFileSync(MUSIC_STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.tracks)) {
        return {
          tracks: parsed.tracks,
          activeTrackId:
            typeof parsed.activeTrackId === 'string' ? parsed.activeTrackId : null,
        };
      }
    } catch (err) {
      console.error('Failed to read music-tracks.json:', err);
    }
    return {
      tracks: [...DEFAULT_MUSIC_STATE.tracks],
      activeTrackId: DEFAULT_MUSIC_STATE.activeTrackId,
    };
  }

  function saveMusicState(state: StoredMusicState): void {
    try {
      ensureMusicDirs();
      fs.writeFileSync(MUSIC_STORE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write music-tracks.json:', err);
    }
  }

  function sanitizeUploadFileName(rawName: string): string {
    const base = String(rawName || 'track.mp3').split(/[\\/]/).pop() || 'track.mp3';
    const extMatch = base.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'mp3';
    const allowed = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'webm']);
    const safeExt = allowed.has(ext) ? ext : 'mp3';
    const stem = base
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
    return `${stem || 'track'}.${safeExt}`;
  }

  app.get('/api/music', (_req, res) => {
    const state = loadMusicState();
    res.json(state);
  });

  app.get('/api/music/files/:filename', (req, res) => {
    const safeName = path.basename(String(req.params.filename || ''));
    const fullPath = path.resolve(MUSIC_UPLOADS_DIR, safeName);
    if (!fullPath.startsWith(MUSIC_UPLOADS_DIR) || !fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'File musik tidak ditemukan.' });
      return;
    }
    const ext = path.extname(safeName).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.webm': 'audio/webm',
    };
    res.setHeader('Content-Type', mimeMap[ext] || 'audio/mpeg');
    res.sendFile(fullPath);
  });

  app.post('/api/admin/music/upload', (req, res) => {
    const { title, fileName, dataBase64, setAsActive } = req.body || {};
    const rawB64 = String(dataBase64 || '').trim();
    if (!rawB64) {
      res.status(400).json({ ok: false, error: 'File audio kosong atau tidak valid.' });
      return;
    }

    const strippedB64 = rawB64.includes(',') ? rawB64.split(',').pop() || '' : rawB64;
    const buffer = Buffer.from(strippedB64, 'base64');
    if (buffer.length === 0 || buffer.length > 22 * 1024 * 1024) {
      res.status(400).json({
        ok: false,
        error: 'Ukuran file audio harus di bawah 20 MB.',
      });
      return;
    }

    ensureMusicDirs();
    const safeOrigName = sanitizeUploadFileName(String(fileName || 'musik.mp3'));
    const storedFileName = `${Date.now()}-${safeOrigName}`;
    const targetPath = path.resolve(MUSIC_UPLOADS_DIR, storedFileName);
    fs.writeFileSync(targetPath, buffer);

    const cleanTitle =
      String(title || '').trim().slice(0, 120) ||
      safeOrigName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();

    const state = loadMusicState();
    const newTrack: StoredMusicTrack = {
      id: `track-${Date.now()}`,
      title: cleanTitle || 'Musik Latar Baru',
      audioUrl: `/api/music/files/${encodeURIComponent(storedFileName)}`,
      sourceType: 'upload',
      fileName: safeOrigName,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const nextTracks = [newTrack, ...state.tracks];
    const nextActiveId =
      setAsActive !== false || !state.activeTrackId ? newTrack.id : state.activeTrackId;

    const nextState: StoredMusicState = {
      tracks: nextTracks,
      activeTrackId: nextActiveId,
    };
    saveMusicState(nextState);
    res.status(201).json({ ok: true, track: newTrack, ...nextState });
  });

  app.post('/api/admin/music', (req, res) => {
    const { title, audioUrl, setAsActive } = req.body || {};
    const cleanUrl = String(audioUrl || '').trim();
    const isSafeUrl =
      cleanUrl.startsWith('/assets/') ||
      cleanUrl.startsWith('/api/music/files/') ||
      /^https?:\/\//i.test(cleanUrl);

    if (!isSafeUrl) {
      res.status(400).json({
        ok: false,
        error: 'URL audio harus menggunakan http://, https://, atau path lokal yang valid.',
      });
      return;
    }

    const cleanTitle = String(title || '').trim().slice(0, 120) || 'Musik Latar Baru';
    const state = loadMusicState();
    const newTrack: StoredMusicTrack = {
      id: `track-${Date.now()}`,
      title: cleanTitle,
      audioUrl: cleanUrl.slice(0, 600),
      sourceType: 'url',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const nextTracks = [newTrack, ...state.tracks];
    const nextActiveId =
      setAsActive !== false || !state.activeTrackId ? newTrack.id : state.activeTrackId;

    const nextState: StoredMusicState = {
      tracks: nextTracks,
      activeTrackId: nextActiveId,
    };
    saveMusicState(nextState);
    res.status(201).json({ ok: true, track: newTrack, ...nextState });
  });

  app.patch('/api/admin/music/:id', (req, res) => {
    const targetId = String(req.params.id || '').trim();
    const { title, isActive, setAsActive } = req.body || {};
    const state = loadMusicState();
    const exists = state.tracks.some((t) => t.id === targetId);
    if (!exists) {
      res.status(404).json({ ok: false, error: 'Lagu tidak ditemukan.' });
      return;
    }

    const nextTracks = state.tracks.map((t) => {
      if (t.id !== targetId) return t;
      return {
        ...t,
        title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 120) : t.title,
        isActive:
          setAsActive === true
            ? true
            : typeof isActive === 'boolean'
            ? isActive
            : t.isActive,
      };
    });

    let nextActiveId = state.activeTrackId;
    if (setAsActive === true) {
      nextActiveId = targetId;
    } else {
      const currentActive = nextTracks.find((t) => t.id === nextActiveId && t.isActive);
      if (!currentActive) {
        nextActiveId = nextTracks.find((t) => t.isActive)?.id || null;
      }
    }

    const nextState: StoredMusicState = {
      tracks: nextTracks,
      activeTrackId: nextActiveId,
    };
    saveMusicState(nextState);
    res.json({ ok: true, ...nextState });
  });

  app.delete('/api/admin/music/:id', (req, res) => {
    const targetId = String(req.params.id || '').trim();
    const state = loadMusicState();
    const target = state.tracks.find((t) => t.id === targetId);
    if (!target) {
      res.status(404).json({ ok: false, error: 'Lagu tidak ditemukan.' });
      return;
    }

    if (target.sourceType === 'upload' && target.audioUrl.startsWith('/api/music/files/')) {
      const encodedName = target.audioUrl.replace('/api/music/files/', '');
      const safeName = path.basename(decodeURIComponent(encodedName));
      const fullPath = path.resolve(MUSIC_UPLOADS_DIR, safeName);
      if (fullPath.startsWith(MUSIC_UPLOADS_DIR) && fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch {
          // Ignore file unlink errors
        }
      }
    }

    const nextTracks = state.tracks.filter((t) => t.id !== targetId);
    const nextActiveId =
      state.activeTrackId === targetId
        ? nextTracks.find((t) => t.isActive)?.id || null
        : state.activeTrackId;

    const nextState: StoredMusicState = {
      tracks: nextTracks,
      activeTrackId: nextActiveId,
    };
    saveMusicState(nextState);
    res.json({ ok: true, deletedId: targetId, ...nextState });
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
