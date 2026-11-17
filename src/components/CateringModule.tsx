import React, { useState } from 'react';
import {
  CheckCircle2,
  ChefHat,
  Download,
  Edit3,
  FileText,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Trash2,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import {
  CateringCategory,
  CateringOrder,
  CustomerRecord,
  MenuItem,
  OrderStatus,
  OrderStatusHistoryItem,
  PaymentMethodType,
  ProductionBatch,
  SiteContentSettings,
} from '../types/erp';
import {
  calculateMenuProfit,
  calculateOrderFinancials,
  calculateRawMaterialRequirement,
  formatRupiah,
  formatTanggalIndonesia,
  generateOrderNumber,
  getJakartaTodayIso,
} from '../utils/calculations';
import { DEFAULT_SITE_SETTINGS, GENERATED_IMAGES } from '../data/seedData';
import { downloadOrderInvoicePdf } from '../utils/invoicePdfExport';

const CATERING_CATEGORIES: CateringCategory[] = [
  'Catering harian',
  'Catering prasmanan',
  'Nasi kotak',
  'Snack box',
  'Catering pernikahan',
  'Catering rapat',
  'Catering perusahaan',
  'Catering acara khusus',
];

const ORDER_STATUSES: OrderStatus[] = [
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

interface CateringModuleProps {
  ownerId: string;
  menuItems: MenuItem[];
  orders: CateringOrder[];
  customers: CustomerRecord[];
  productionBatches: ProductionBatch[];
  siteSettings?: SiteContentSettings;
  hasMoreCloudData?: boolean;
  onLoadMore?: () => void;
  onSaveMenu: (item: MenuItem) => Promise<void>;
  onDeleteMenu: (id: string) => Promise<void>;
  onSaveOrder: (order: CateringOrder) => Promise<void>;
  onCancelOrder?: (order: CateringOrder) => Promise<void>;
  onDeleteOrder: (id: string) => Promise<void>;
  onSaveCustomer: (customer: CustomerRecord) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  onSaveProduction: (batch: ProductionBatch) => Promise<void>;
  onDeleteProduction: (id: string) => Promise<void>;
  onConfirmOrderPaid?: (order: CateringOrder) => Promise<void>;
}

export const CateringModule: React.FC<CateringModuleProps> = ({
  ownerId,
  menuItems,
  orders,
  customers,
  productionBatches,
  siteSettings = DEFAULT_SITE_SETTINGS,
  hasMoreCloudData = false,
  onLoadMore,
  onSaveMenu,
  onDeleteMenu,
  onSaveOrder,
  onCancelOrder,
  onDeleteOrder,
  onSaveCustomer,
  onDeleteCustomer,
  onSaveProduction,
  onDeleteProduction,
  onConfirmOrderPaid,
}) => {
  const [activeTab, setActiveTab] = useState<'menu' | 'orders' | 'customers' | 'production'>('orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Semua');
  const [statusFilter, setStatusFilter] = useState<string>('Semua');

  // Menu Form State
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [menuName, setMenuName] = useState('');
  const [menuCategory, setMenuCategory] = useState<CateringCategory>('Nasi kotak');
  const [menuPackage, setMenuPackage] = useState('Paket Reguler A');
  const [menuDesc, setMenuDesc] = useState('');
  const [menuImage, setMenuImage] = useState(GENERATED_IMAGES.nasiKotak);
  const [menuSellingPrice, setMenuSellingPrice] = useState(38000);
  const [menuCostPrice, setMenuCostPrice] = useState(23000);
  const [menuAvailable, setMenuAvailable] = useState(true);
  const [formFeedback, setFormFeedback] = useState('');

  // Order Form State
  const todayIso = getJakartaTodayIso();
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [orderCustomerName, setOrderCustomerName] = useState('');
  const [orderWhatsapp, setOrderWhatsapp] = useState('');
  const [orderDate, setOrderDate] = useState(todayIso);
  const [deliveryDate, setDeliveryDate] = useState(todayIso);
  const [orderDeliveryTime, setOrderDeliveryTime] = useState('09:00 WIB');
  const [orderDeliveryAddress, setOrderDeliveryAddress] = useState('');
  const [orderEventType, setOrderEventType] = useState<CateringCategory>('Catering rapat');
  const [orderPackageName, setOrderPackageName] = useState(
    menuItems[0]?.name || 'Nasi Kotak Ayam Bakar Madu Nusantara'
  );
  const [orderPortions, setOrderPortions] = useState(150);
  const [orderUnitPrice, setOrderUnitPrice] = useState(38000);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [orderShippingCost, setOrderShippingCost] = useState(0);
  const [orderDp, setOrderDp] = useState(0);
  const [orderPaymentMethod, setOrderPaymentMethod] = useState<PaymentMethodType>('Transfer Bank');
  const [orderPaymentProofUrl, setOrderPaymentProofUrl] = useState('');
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('Pesanan baru');
  const [orderNotes, setOrderNotes] = useState('');
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<CateringOrder | null>(null);
  const [editingPaymentOrderId, setEditingPaymentOrderId] = useState<string | null>(null);
  const [editingPaymentAmount, setEditingPaymentAmount] = useState<number>(0);

  // Customer Form State
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [custName, setCustName] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custLat, setCustLat] = useState(-6.2146);
  const [custLng, setCustLng] = useState(106.8451);
  const [custTotalPurchases, setCustTotalPurchases] = useState(15000000);
  const [custTxCount, setCustTxCount] = useState(1);
  const [custActive, setCustActive] = useState(true);
  const [custPriority, setCustPriority] = useState(false);

  // Production Form State
  const [showProdForm, setShowProdForm] = useState(false);
  const [prodDate, setProdDate] = useState('2026-11-16');
  const [prodMenuName, setProdMenuName] = useState(
    menuItems[0]?.name || 'Nasi Kotak Ayam Bakar Madu Nusantara'
  );
  const [prodChannel, setProdChannel] = useState<'Catering Komersial' | 'Sekolah Rakyat'>('Catering Komersial');
  const [prodPortions, setProdPortions] = useState(300);
  const [prodOfficer, setProdOfficer] = useState('Chef Hendra Wijaya & Tim Dapur A');
  const [prodStatus, setProdStatus] = useState<ProductionBatch['status']>('Terjadwal');
  const [prodDocNote, setProdDocNote] = useState('Bahan baku segar siap diolah sesuai standar SOP Higiene.');

  const notify = (msg: string) => {
    setFormFeedback(msg);
    setTimeout(() => setFormFeedback(''), 3500);
  };

  // Menu Submit
  const handleMenuSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuName.trim() || !menuDesc.trim()) {
      notify('Mohon lengkapi nama menu dan deskripsi makanan.');
      return;
    }
    const profit = calculateMenuProfit(menuSellingPrice, menuCostPrice);
    const id = editingMenuId || `menu-${Date.now()}`;
    try {
      await onSaveMenu({
        id,
        ownerId,
        name: menuName.trim(),
        category: menuCategory,
        packageName: menuPackage.trim() || 'Paket Standar',
        description: menuDesc.trim(),
        imageUrl: menuImage || GENERATED_IMAGES.nasiKotak,
        sellingPrice: Number(menuSellingPrice),
        costPrice: Number(menuCostPrice),
        estimatedProfit: profit,
        available: menuAvailable,
      });
      setShowMenuForm(false);
      setEditingMenuId(null);
      setMenuName('');
      setMenuDesc('');
      notify('Data produk & menu catering berhasil disimpan ke database.');
    } catch {
      notify('Gagal menyimpan menu ke server. Perubahan dibatalkan.');
    }
  };

  // Order Submit (selecting paymentMethod never auto-marks Lunas!)
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderCustomerName.trim() || !orderWhatsapp.trim()) {
      notify('Nama pelanggan dan nomor WhatsApp wajib diisi.');
      return;
    }
    const existingOrder = orders.find((o) => o.id === editingOrderId);
    if (orderStatus === 'Dibatalkan' && existingOrder && onCancelOrder) {
      setShowOrderForm(false);
      await onCancelOrder(existingOrder);
      return;
    }

    const financials = calculateOrderFinancials({
      portions: orderPortions,
      unitPrice: orderUnitPrice,
      discount: orderDiscount,
      shippingCost: orderShippingCost,
      downPayment: orderDp,
    });
    const id = editingOrderId || `ord-${Date.now()}`;
    const orderNumber =
      existingOrder?.orderNumber || generateOrderNumber(orderDate, orders.length + 1);

    const prevHistory: OrderStatusHistoryItem[] = existingOrder?.statusHistory || [];
    const statusChanged = !existingOrder || existingOrder.status !== orderStatus;
    const nextHistory: OrderStatusHistoryItem[] = statusChanged
      ? [
          ...prevHistory,
          {
            status: orderStatus,
            timestamp: new Date().toISOString(),
            actor: 'Admin Operasional',
            note: existingOrder
              ? `Status diubah dari ${existingOrder.status} ke ${orderStatus}`
              : 'Pesanan dibuat oleh Admin',
          },
        ]
      : prevHistory;

    try {
      await onSaveOrder({
        ...(existingOrder || {}),
        id,
        ownerId,
        orderNumber,
        customerName: orderCustomerName.trim(),
        whatsapp: orderWhatsapp.trim(),
        orderDate,
        deliveryDate,
        deliveryTime: orderDeliveryTime.trim() || '09:00 WIB',
        deliveryAddress: orderDeliveryAddress.trim() || '-',
        shippingCost: Number(orderShippingCost) || 0,
        paymentMethod: orderPaymentMethod,
        paymentProofUrl: orderPaymentProofUrl.trim().slice(0, 500),
        eventType: orderEventType,
        packageName: orderPackageName,
        portions: Number(orderPortions),
        unitPrice: Number(orderUnitPrice),
        discount: Number(orderDiscount),
        totalPayment: financials.totalPayment,
        downPayment: Number(orderDp),
        remainingBalance: financials.remainingBalance,
        paymentStatus: financials.paymentStatus,
        status: orderStatus,
        statusHistory: nextHistory,
        statusHistoryJson: JSON.stringify(nextHistory).slice(0, 2000),
        notes: orderNotes.trim() || 'Sesuai standar pesanan catering.',
      });
      setShowOrderForm(false);
      setEditingOrderId(null);
      setOrderCustomerName('');
      setOrderWhatsapp('');
      setOrderDeliveryAddress('');
      setOrderPaymentProofUrl('');
      notify(`Pesanan ${orderNumber} berhasil disimpan ke server.`);
    } catch {
      notify('Gagal menyimpan pesanan ke server. Perubahan dibatalkan.');
    }
  };

  // Customer Submit
  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custAddress.trim() || !custPhone.trim()) {
      notify('Mohon lengkapi nama pelanggan, alamat, dan nomor telepon.');
      return;
    }
    const id = editingCustomerId || `cust-${Date.now()}`;
    try {
      await onSaveCustomer({
        id,
        ownerId,
        name: custName.trim(),
        address: custAddress.trim(),
        phone: custPhone.trim(),
        locationLat: Number(custLat),
        locationLng: Number(custLng),
        totalPurchases: Number(custTotalPurchases),
        transactionCount: Number(custTxCount),
        isActive: custActive,
        isPriority: custPriority,
      });
      setShowCustomerForm(false);
      setEditingCustomerId(null);
      setCustName('');
      setCustAddress('');
      setCustPhone('');
      notify('Data pelanggan berhasil diperbarui.');
    } catch {
      notify('Gagal menyimpan data pelanggan ke server.');
    }
  };

  // Production Submit
  const handleProdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodMenuName.trim() || !prodOfficer.trim()) {
      notify('Pilih menu produksi dan petugas penanggung jawab dapur.');
      return;
    }
    const calc = calculateRawMaterialRequirement(prodPortions, prodChannel);
    const id = `prod-${Date.now()}`;
    try {
      await onSaveProduction({
        id,
        ownerId,
        productionDate: prodDate,
        menuName: prodMenuName.trim(),
        targetChannel: prodChannel,
        portions: Number(prodPortions),
        recipeSummary: calc.recipeSummary,
        rawMaterialNeed: calc.rawMaterialNeed,
        productionCost: calc.estimatedProductionCost,
        officerName: prodOfficer.trim(),
        status: prodStatus,
        documentationNote: prodDocNote.trim() || 'Sesuai prosedur QC dapur.',
      });
      setShowProdForm(false);
      notify('Jadwal produksi makanan & kalkulasi bahan baku berhasil disimpan.');
    } catch {
      notify('Gagal menyimpan jadwal produksi ke server.');
    }
  };

  const filteredMenus = menuItems.filter((m) => {
    const matchCat = categoryFilter === 'Semua' || m.category === categoryFilter;
    const matchSearch =
      !searchQuery ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.packageName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const filteredOrders = orders.filter((o) => {
    const matchStatus = statusFilter === 'Semua' || o.status === statusFilter;
    const matchSearch =
      !searchQuery ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const filteredCustomers = customers.filter(
    (c) =>
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const previewFinancials = calculateOrderFinancials({
    portions: orderPortions,
    unitPrice: orderUnitPrice,
    discount: orderDiscount,
    shippingCost: orderShippingCost,
    downPayment: orderDp,
  });

  const previewProdCalc = calculateRawMaterialRequirement(prodPortions, prodChannel);

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation Tabs */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Kelola Pesanan, Menu Makanan & Dapur
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Konfirmasi pesanan yang sudah dibayar, atur daftar menu makanan, data pelanggan, dan jadwal masak harian.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-100 p-1 w-fit" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'orders'}
            onClick={() => setActiveTab('orders')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'orders'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5 text-emerald-700" />
            <span>Daftar Pesanan ({orders.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'menu'}
            onClick={() => setActiveTab('menu')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'menu'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UtensilsCrossed className="h-3.5 w-3.5 text-emerald-700" />
            <span>Menu Makanan ({menuItems.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'customers'}
            onClick={() => setActiveTab('customers')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'customers'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="h-3.5 w-3.5 text-emerald-700" />
            <span>Data Pelanggan ({customers.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'production'}
            onClick={() => setActiveTab('production')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'production'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ChefHat className="h-3.5 w-3.5 text-emerald-700" />
            <span>Jadwal Masak Dapur ({productionBatches.length})</span>
          </button>
        </div>
      </div>

      {formFeedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900">
          {formFeedback}
        </div>
      )}

      {/* Search & Primary Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              aria-label="Cari data modul catering"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari menu, nomor pesanan, atau nama pelanggan..."
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          {activeTab === 'menu' && (
            <select
              aria-label="Filter Kategori Makanan"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              <option value="Semua">Semua Kategori (8 Kategori)</option>
              {CATERING_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          {activeTab === 'orders' && (
            <select
              aria-label="Filter Status Pesanan"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              <option value="Semua">Semua Status Pesanan</option>
              {ORDER_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          {activeTab === 'menu' && (
            <button
              type="button"
              onClick={() => {
                setEditingMenuId(null);
                setMenuName('');
                setMenuDesc('');
                setShowMenuForm((prev) => !prev);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Produk Menu</span>
            </button>
          )}
          {activeTab === 'orders' && (
            <button
              type="button"
              onClick={() => {
                setEditingOrderId(null);
                setOrderCustomerName('');
                setOrderWhatsapp('');
                setShowOrderForm((prev) => !prev);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Buat Pesanan Baru</span>
            </button>
          )}
          {activeTab === 'customers' && (
            <button
              type="button"
              onClick={() => {
                setEditingCustomerId(null);
                setCustName('');
                setCustAddress('');
                setCustPhone('');
                setShowCustomerForm((prev) => !prev);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Pelanggan</span>
            </button>
          )}
          {activeTab === 'production' && (
            <button
              type="button"
              onClick={() => setShowProdForm((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Jadwalkan Produksi Dapur</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: DATA PRODUK & MENU */}
      {activeTab === 'menu' && (
        <div className="space-y-5">
          {showMenuForm && (
            <form
              onSubmit={handleMenuSubmit}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <h2 className="text-sm font-bold text-slate-900">
                {editingMenuId ? 'Edit Produk Makanan & Paket Catering' : 'Tambah Produk Makanan & Paket Catering Baru'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="menu-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Menu Makanan
                  </label>
                  <input
                    id="menu-name"
                    type="text"
                    value={menuName}
                    onChange={(e) => setMenuName(e.target.value)}
                    placeholder="Contoh: Nasi Kotak Empal Gepuk"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="menu-cat" className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori Makanan
                  </label>
                  <select
                    id="menu-cat"
                    value={menuCategory}
                    onChange={(e) => setMenuCategory(e.target.value as CateringCategory)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    {CATERING_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="menu-pkg" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Paket Catering
                  </label>
                  <input
                    id="menu-pkg"
                    type="text"
                    value={menuPackage}
                    onChange={(e) => setMenuPackage(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="menu-sell" className="block text-xs font-semibold text-slate-700 mb-1">
                    Harga Jual per Porsi (IDR)
                  </label>
                  <input
                    id="menu-sell"
                    type="number"
                    min={1000}
                    value={menuSellingPrice}
                    onChange={(e) => setMenuSellingPrice(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="menu-cost" className="block text-xs font-semibold text-slate-700 mb-1">
                    Harga Modal (HPP) per Porsi (IDR)
                  </label>
                  <input
                    id="menu-cost"
                    type="number"
                    min={500}
                    value={menuCostPrice}
                    onChange={(e) => setMenuCostPrice(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="menu-img" className="block text-xs font-semibold text-slate-700 mb-1">
                    Foto Makanan
                  </label>
                  <select
                    id="menu-img"
                    value={menuImage}
                    onChange={(e) => setMenuImage(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value={GENERATED_IMAGES.nasiKotak}>Foto Studio Nasi Kotak Kraft</option>
                    <option value={GENERATED_IMAGES.prasmanan}>Foto Studio Buffet Prasmanan VIP</option>
                    <option value={GENERATED_IMAGES.sekolahMeal}>Foto Studio Paket Gizi Terpadu</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div className="sm:col-span-2">
                  <label htmlFor="menu-desc" className="block text-xs font-semibold text-slate-700 mb-1">
                    Deskripsi Komposisi Menu
                  </label>
                  <input
                    id="menu-desc"
                    type="text"
                    value={menuDesc}
                    onChange={(e) => setMenuDesc(e.target.value)}
                    placeholder="Komposisi lauk utama, pendamping, sayur, buah, dan kemasan..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs flex items-center justify-between">
                  <span className="text-slate-600">Estimasi Untung/Porsi:</span>
                  <span className="font-mono tabular-nums font-bold text-emerald-700">
                    {formatRupiah(calculateMenuProfit(menuSellingPrice, menuCostPrice))}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={menuAvailable}
                    onChange={(e) => setMenuAvailable(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-700"
                  />
                  <span>Status Menu Tersedia untuk Dipesan</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMenuForm(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    Simpan Menu Makanan
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredMenus.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-44 w-full bg-slate-900 overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/75 to-transparent pt-8 pb-3 px-3.5 text-white">
                      <p className="text-xs text-amber-300 font-semibold">
                        {item.category} · {item.packageName}
                      </p>
                      <h3 className="text-sm font-bold leading-snug text-white">{item.name}</h3>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                    <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-xs">
                      <div>
                        <span className="text-slate-400 block">Harga Jual</span>
                        <span className="font-mono tabular-nums font-bold text-slate-900">
                          {formatRupiah(item.sellingPrice)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Harga Modal</span>
                        <span className="font-mono tabular-nums font-medium text-slate-700">
                          {formatRupiah(item.costPrice)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Est. Untung</span>
                        <span className="font-mono tabular-nums font-bold text-emerald-700">
                          +{formatRupiah(item.estimatedProfit)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">
                    Status: {item.available ? 'Tersedia' : 'Tidak Tersedia'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMenuId(item.id);
                        setMenuName(item.name);
                        setMenuCategory(item.category);
                        setMenuPackage(item.packageName);
                        setMenuDesc(item.description);
                        setMenuImage(item.imageUrl);
                        setMenuSellingPrice(item.sellingPrice);
                        setMenuCostPrice(item.costPrice);
                        setMenuAvailable(item.available);
                        setShowMenuForm(true);
                      }}
                      aria-label={`Edit ${item.name}`}
                      className="inline-flex items-center gap-1 text-slate-700 hover:text-emerald-700 font-semibold"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteMenu(item.id)}
                      aria-label={`Hapus ${item.name}`}
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Hapus
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: MANAJEMEN PESANAN */}
      {activeTab === 'orders' && (
        <div className="space-y-5">
          {showOrderForm && (
            <form
              onSubmit={handleOrderSubmit}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  {editingOrderId ? 'Perbarui Data Pesanan Catering' : 'Formulir Pesanan Catering Baru (Nomor Otomatis)'}
                </h2>
                <span className="text-xs font-mono tabular-nums text-emerald-800 font-semibold">
                  No. Otomatis: {generateOrderNumber(orderDate, orders.length + 1)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="ord-cust" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Pelanggan / Instansi
                  </label>
                  <input
                    id="ord-cust"
                    type="text"
                    value={orderCustomerName}
                    onChange={(e) => setOrderCustomerName(e.target.value)}
                    placeholder="Contoh: PT Pertamina Patra Niaga"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="ord-wa" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor WhatsApp Aktif
                  </label>
                  <input
                    id="ord-wa"
                    type="text"
                    value={orderWhatsapp}
                    onChange={(e) => setOrderWhatsapp(e.target.value)}
                    placeholder="0812xxxxxxxx"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="ord-event" className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Acara / Kategori
                  </label>
                  <select
                    id="ord-event"
                    value={orderEventType}
                    onChange={(e) => setOrderEventType(e.target.value as CateringCategory)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    {CATERING_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ord-pkg" className="block text-xs font-semibold text-slate-700 mb-1">
                    Pilih Menu / Paket Catering
                  </label>
                  <select
                    id="ord-pkg"
                    value={orderPackageName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOrderPackageName(val);
                      const found = menuItems.find((m) => m.name === val);
                      if (found) setOrderUnitPrice(found.sellingPrice);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    {menuItems.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name} ({formatRupiah(m.sellingPrice)}/pax)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="ord-date" className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Pemesanan
                  </label>
                  <input
                    id="ord-date"
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="ord-deliv" className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Pengiriman Acara
                  </label>
                  <input
                    id="ord-deliv"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="ord-deliv-time" className="block text-xs font-semibold text-slate-700 mb-1">
                    Jam Pengiriman Acara
                  </label>
                  <input
                    id="ord-deliv-time"
                    type="text"
                    value={orderDeliveryTime}
                    onChange={(e) => setOrderDeliveryTime(e.target.value)}
                    placeholder="09:00 WIB"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="ord-deliv-addr" className="block text-xs font-semibold text-slate-700 mb-1">
                    Alamat Pengiriman Lengkap
                  </label>
                  <input
                    id="ord-deliv-addr"
                    type="text"
                    value={orderDeliveryAddress}
                    onChange={(e) => setOrderDeliveryAddress(e.target.value)}
                    placeholder="Gedung, Jalan, Kelurahan, Kecamatan, Kota..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="ord-portions" className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah Porsi
                  </label>
                  <input
                    id="ord-portions"
                    type="number"
                    min={1}
                    value={orderPortions}
                    onChange={(e) => setOrderPortions(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="ord-price" className="block text-xs font-semibold text-slate-700 mb-1">
                    Harga Satuan (IDR)
                  </label>
                  <input
                    id="ord-price"
                    type="number"
                    min={0}
                    value={orderUnitPrice}
                    onChange={(e) => setOrderUnitPrice(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="ord-disc" className="block text-xs font-semibold text-slate-700 mb-1">
                    Potongan Diskon (IDR)
                  </label>
                  <input
                    id="ord-disc"
                    type="number"
                    min={0}
                    value={orderDiscount}
                    onChange={(e) => setOrderDiscount(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="ord-ship" className="block text-xs font-semibold text-slate-700 mb-1">
                    Biaya Pengiriman (IDR)
                  </label>
                  <input
                    id="ord-ship"
                    type="number"
                    min={0}
                    value={orderShippingCost}
                    onChange={(e) => setOrderShippingCost(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="ord-dp" className="block text-xs font-semibold text-slate-700 mb-1">
                    Uang Muka / DP Terverifikasi (IDR)
                  </label>
                  <input
                    id="ord-dp"
                    type="number"
                    min={0}
                    value={orderDp}
                    onChange={(e) => setOrderDp(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="ord-paymethod" className="block text-xs font-semibold text-slate-700 mb-1">
                    Metode Pembayaran (Tidak Auto-Lunas)
                  </label>
                  <select
                    id="ord-paymethod"
                    value={orderPaymentMethod}
                    onChange={(e) => setOrderPaymentMethod(e.target.value as PaymentMethodType)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="Transfer Bank">Transfer Bank</option>
                    <option value="QRIS">QRIS</option>
                    <option value="Pembayaran Tunai">Pembayaran Tunai</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="ord-proof" className="block text-xs font-semibold text-slate-700 mb-1">
                    Referensi / URL Bukti Pembayaran
                  </label>
                  <input
                    id="ord-proof"
                    type="text"
                    value={orderPaymentProofUrl}
                    onChange={(e) => setOrderPaymentProofUrl(e.target.value)}
                    placeholder="https://... atau No. Referensi Mutasi"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="ord-status" className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Pesanan Operasional
                  </label>
                  <select
                    id="ord-status"
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value as OrderStatus)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    {ORDER_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="ord-notes" className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan Khusus Pengiriman
                  </label>
                  <input
                    id="ord-notes"
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Lokasi gedung, jam setup, request sambal..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              {/* Automatic Financial Calculation Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Total Pembayaran (+ Ongkir)</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 text-sm">
                    {formatRupiah(previewFinancials.totalPayment)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Uang Muka / Terbayar</span>
                  <span className="font-mono tabular-nums font-semibold text-emerald-700 text-sm">
                    {formatRupiah(orderDp)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Sisa Pembayaran (Piutang)</span>
                  <span className="font-mono tabular-nums font-bold text-amber-700 text-sm">
                    {formatRupiah(previewFinancials.remainingBalance)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status Pembayaran Terverifikasi</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {previewFinancials.paymentStatus}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowOrderForm(false);
                    setEditingOrderId(null);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  Simpan Pesanan Catering
                </button>
              </div>
            </form>
          )}

          {/* Detail Pesanan & Pratinjau Invoice */}
          {selectedInvoiceOrder && (
            <div className="rounded-xl border border-slate-300 bg-white p-6 space-y-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Detail Pesanan &amp; Invoice — {selectedInvoiceOrder.orderNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {siteSettings.brandName} · Status Pesanan: {selectedInvoiceOrder.status} · Pembayaran:{' '}
                    <span className="font-semibold text-slate-800">
                      {selectedInvoiceOrder.paymentStatus}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      downloadOrderInvoicePdf(selectedInvoiceOrder, siteSettings);
                      notify(
                        `Invoice PDF ${selectedInvoiceOrder.orderNumber} berhasil diunduh.`
                      );
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white transition-colors whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Unduh Invoice</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 px-3 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Cetak</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedInvoiceOrder(null)}
                    className="rounded-lg border border-slate-300 hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap"
                  >
                    Tutup
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-500 block">Ditagihkan Kepada:</span>
                  <span className="font-bold text-slate-900 block">
                    {selectedInvoiceOrder.customerName}
                  </span>
                  <span className="block font-mono text-slate-600">
                    WA: {selectedInvoiceOrder.whatsapp}
                  </span>
                  {selectedInvoiceOrder.deliveryAddress && (
                    <span className="block text-slate-600">
                      Alamat: {selectedInvoiceOrder.deliveryAddress}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 block">Jadwal Acara &amp; Pengiriman:</span>
                  <span className="font-semibold text-slate-900 block">
                    {selectedInvoiceOrder.eventType} ·{' '}
                    {selectedInvoiceOrder.portions.toLocaleString('id-ID')} porsi
                  </span>
                  <span className="block text-slate-600">
                    Kirim: {formatTanggalIndonesia(selectedInvoiceOrder.deliveryDate)}
                    {selectedInvoiceOrder.deliveryTime
                      ? ` · ${selectedInvoiceOrder.deliveryTime}`
                      : ''}
                  </span>
                  <span className="block text-slate-600">
                    Metode Bayar: {selectedInvoiceOrder.paymentMethod || 'Transfer Bank'}
                  </span>
                  {selectedInvoiceOrder.paymentProofUrl && (
                    <span className="block text-emerald-700 font-medium break-all">
                      Bukti Bayar: {selectedInvoiceOrder.paymentProofUrl}
                    </span>
                  )}
                  {selectedInvoiceOrder.paymentVerifiedBy && (
                    <span className="block text-emerald-800 font-semibold">
                      Verifikasi: {selectedInvoiceOrder.paymentVerifiedBy}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 block">Ringkasan Tagihan:</span>
                  {(selectedInvoiceOrder.shippingCost || 0) > 0 && (
                    <span className="block font-mono tabular-nums text-slate-600">
                      Ongkir: {formatRupiah(selectedInvoiceOrder.shippingCost || 0)}
                    </span>
                  )}
                  <span className="font-mono tabular-nums font-bold text-slate-900 block">
                    Total: {formatRupiah(selectedInvoiceOrder.totalPayment)}
                  </span>
                  <span className="block font-mono tabular-nums text-emerald-700 font-semibold">
                    Dibayar/DP:{' '}
                    {formatRupiah(
                      selectedInvoiceOrder.paymentStatus === 'Lunas'
                        ? selectedInvoiceOrder.totalPayment
                        : Math.max(0, selectedInvoiceOrder.downPayment || 0)
                    )}
                  </span>
                  <span
                    className={`block font-mono tabular-nums font-bold ${
                      selectedInvoiceOrder.paymentStatus === 'Lunas'
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    Sisa Utang:{' '}
                    {selectedInvoiceOrder.paymentStatus === 'Lunas'
                      ? 'Rp 0 (Lunas)'
                      : formatRupiah(
                          Math.max(
                            0,
                            selectedInvoiceOrder.totalPayment -
                              Math.max(0, selectedInvoiceOrder.downPayment || 0)
                          )
                        )}
                  </span>
                </div>
              </div>

              {selectedInvoiceOrder.status === 'Dibatalkan' &&
                selectedInvoiceOrder.cancellationReason && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900">
                    <strong>Alasan Pembatalan:</strong> {selectedInvoiceOrder.cancellationReason}
                  </div>
                )}

              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-xs space-y-2">
                <div className="font-bold text-slate-800">Rincian Item Pesanan:</div>
                {selectedInvoiceOrder.items && selectedInvoiceOrder.items.length > 0 ? (
                  <div className="divide-y divide-slate-200">
                    {selectedInvoiceOrder.items.map((item) => (
                      <div
                        key={item.menuId}
                        className="py-1.5 flex items-center justify-between gap-3"
                      >
                        <span className="text-slate-800 font-medium">
                          {item.name} ({item.quantity.toLocaleString('id-ID')} porsi ×{' '}
                          {formatRupiah(item.unitPrice)})
                        </span>
                        <span className="font-mono tabular-nums font-bold text-slate-900 shrink-0">
                          {formatRupiah(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-800 font-medium">
                      {selectedInvoiceOrder.packageName} (
                      {selectedInvoiceOrder.portions.toLocaleString('id-ID')} porsi ×{' '}
                      {formatRupiah(selectedInvoiceOrder.unitPrice)})
                    </span>
                    <span className="font-mono tabular-nums font-bold text-slate-900 shrink-0">
                      {formatRupiah(
                        selectedInvoiceOrder.portions * selectedInvoiceOrder.unitPrice
                      )}
                    </span>
                  </div>
                )}
                {selectedInvoiceOrder.notes && (
                  <div className="pt-1.5 border-t border-slate-200 text-slate-600">
                    Catatan: {selectedInvoiceOrder.notes}
                  </div>
                )}
              </div>

              {/* Riwayat Perubahan Status */}
              <div className="rounded-lg border border-slate-200 bg-white p-3.5 text-xs space-y-2">
                <div className="font-bold text-slate-800">Riwayat Perubahan Status Pesanan</div>
                {selectedInvoiceOrder.statusHistory &&
                selectedInvoiceOrder.statusHistory.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedInvoiceOrder.statusHistory.map((h, idx) => (
                      <div
                        key={`${h.timestamp}-${idx}`}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1.5 last:border-b-0 last:pb-0"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{h.status}</span>
                          {h.note && <span className="text-slate-600"> — {h.note}</span>}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {h.actor} ·{' '}
                          {new Date(h.timestamp).toLocaleString('id-ID', {
                            timeZone: 'Asia/Jakarta',
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">
                    Status saat ini: <strong>{selectedInvoiceOrder.status}</strong> (dibuat{' '}
                    {formatTanggalIndonesia(selectedInvoiceOrder.orderDate)}).
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Ringkasan Pembayaran: Sudah Dibayar, DP, Sisa Utang & Sudah Lunas */}
          {(() => {
            const activeOrders = orders.filter((o) => o.status !== 'Dibatalkan');
            const paidVal = activeOrders.reduce(
              (acc, o) =>
                acc + (o.paymentStatus === 'Lunas' ? o.totalPayment : Math.max(0, o.downPayment || 0)),
              0
            );
            const dpList = activeOrders.filter(
              (o) =>
                o.paymentStatus !== 'Lunas' &&
                (o.paymentStatus === 'DP Masuk' || (o.downPayment || 0) > 0)
            );
            const dpVal = dpList.reduce((acc, o) => acc + Math.max(0, o.downPayment || 0), 0);
            const debtList = activeOrders.filter((o) => o.paymentStatus !== 'Lunas');
            const debtVal = debtList.reduce(
              (acc, o) =>
                acc + Math.max(0, o.totalPayment - Math.max(0, o.downPayment || 0)),
              0
            );
            const lunasList = activeOrders.filter((o) => o.paymentStatus === 'Lunas');
            const lunasVal = lunasList.reduce((acc, o) => acc + o.totalPayment, 0);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs">
                  <span className="font-semibold text-emerald-900 block">Total Sudah Dibayar</span>
                  <span className="mt-1 block text-base font-extrabold text-emerald-800 font-mono tabular-nums">
                    {formatRupiah(paidVal)}
                  </span>
                  <span className="text-[11px] text-emerald-700 block mt-0.5">
                    Dari {activeOrders.length} pesanan aktif
                  </span>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 text-xs">
                  <span className="font-semibold text-sky-900 block">Total Uang Muka (DP)</span>
                  <span className="mt-1 block text-base font-extrabold text-sky-900 font-mono tabular-nums">
                    {formatRupiah(dpVal)}
                  </span>
                  <span className="text-[11px] text-sky-800 block mt-0.5">
                    {dpList.length} pesanan berstatus DP Masuk
                  </span>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs">
                  <span className="font-semibold text-amber-900 block">Total Sisa Utang</span>
                  <span className="mt-1 block text-base font-extrabold text-amber-800 font-mono tabular-nums">
                    {formatRupiah(debtVal)}
                  </span>
                  <span className="text-[11px] text-amber-800 block mt-0.5">
                    {debtList.length} pesanan belum lunas
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs">
                  <span className="font-semibold text-slate-700 block">Sudah Lunas (100%)</span>
                  <span className="mt-1 block text-base font-extrabold text-slate-900 font-mono tabular-nums">
                    {lunasList.length} Pesanan
                  </span>
                  <span className="text-[11px] text-emerald-700 font-mono tabular-nums font-semibold block mt-0.5">
                    Senilai {formatRupiah(lunasVal)}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Orders Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-3 px-4 font-semibold">No. Pesanan & Tanggal</th>
                    <th className="py-3 px-4 font-semibold">Pelanggan & WhatsApp</th>
                    <th className="py-3 px-4 font-semibold">Acara & Paket</th>
                    <th className="py-3 px-4 font-semibold text-right">Porsi</th>
                    <th className="py-3 px-4 font-semibold text-right">
                      Pembayaran (Dibayar / DP / Sisa Utang)
                    </th>
                    <th className="py-3 px-4 font-semibold">Status Pesanan</th>
                    <th className="py-3 px-4 font-semibold text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((ord) => {
                    const paidAmount =
                      ord.paymentStatus === 'Lunas'
                        ? ord.totalPayment
                        : Math.max(0, ord.downPayment || 0);
                    const remainingDebt =
                      ord.paymentStatus === 'Lunas'
                        ? 0
                        : Math.max(0, ord.totalPayment - paidAmount);
                    const isEditingPayment = editingPaymentOrderId === ord.id;

                    return (
                      <tr key={ord.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4">
                          <div className="font-mono tabular-nums font-bold text-slate-900">
                            {ord.orderNumber}
                          </div>
                          <div className="text-slate-500">
                            Kirim: {formatTanggalIndonesia(ord.deliveryDate)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{ord.customerName}</div>
                          <div className="font-mono tabular-nums text-slate-500">{ord.whatsapp}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{ord.packageName}</div>
                          <div className="text-slate-500">{ord.eventType}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {ord.portions.toLocaleString('id-ID')} pax
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums space-y-0.5">
                          <div className="font-bold text-slate-900">
                            Total: {formatRupiah(ord.totalPayment)}
                          </div>
                          <div className="text-emerald-700 font-semibold">
                            Dibayar/DP: {formatRupiah(paidAmount)}
                          </div>
                          {ord.paymentStatus === 'Lunas' ? (
                            <div className="text-emerald-700 font-bold inline-flex items-center gap-1 justify-end">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Sudah Lunas (Utang Rp 0)</span>
                            </div>
                          ) : (
                            <div className="text-amber-700 font-bold">
                              Sisa Utang: {formatRupiah(remainingDebt)} ({ord.paymentStatus})
                            </div>
                          )}

                          {isEditingPayment && (
                            <div className="mt-2 flex items-center justify-end gap-1.5 font-sans">
                              <input
                                type="number"
                                min={0}
                                max={ord.totalPayment}
                                value={editingPaymentAmount}
                                onChange={(e) => setEditingPaymentAmount(Number(e.target.value))}
                                aria-label={`Nominal dibayar atau DP untuk ${ord.orderNumber}`}
                                className="w-28 rounded border border-slate-300 px-2 py-1 text-xs font-mono tabular-nums text-slate-900"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  const clamped = Math.max(
                                    0,
                                    Math.min(ord.totalPayment, Number(editingPaymentAmount) || 0)
                                  );
                                  try {
                                    if (clamped >= ord.totalPayment && onConfirmOrderPaid) {
                                      await onConfirmOrderPaid(ord);
                                    } else {
                                      const rem = Math.max(0, ord.totalPayment - clamped);
                                      const nextPayStatus =
                                        rem === 0
                                          ? 'Lunas'
                                          : clamped > 0
                                          ? 'DP Masuk'
                                          : 'Belum Bayar';
                                      const nextOrderStatus: OrderStatus =
                                        clamped > 0 &&
                                        rem > 0 &&
                                        (ord.status === 'Pesanan baru' ||
                                          ord.status === 'Menunggu pembayaran')
                                          ? 'DP masuk'
                                          : ord.status;
                                      const nextHist: OrderStatusHistoryItem[] = [
                                        ...(ord.statusHistory || []),
                                        {
                                          status: nextOrderStatus,
                                          timestamp: new Date().toISOString(),
                                          actor: 'Admin Operasional',
                                          note: `Pembayaran DP dicatat: ${formatRupiah(clamped)}`,
                                        },
                                      ];
                                      await onSaveOrder({
                                        ...ord,
                                        downPayment: clamped,
                                        remainingBalance: rem,
                                        paymentStatus: nextPayStatus,
                                        status: nextOrderStatus,
                                        statusHistory: nextHist,
                                        statusHistoryJson: JSON.stringify(nextHist).slice(0, 2000),
                                      });
                                    }
                                    setEditingPaymentOrderId(null);
                                    notify(
                                      `Pembayaran/DP pesanan ${ord.orderNumber} diperbarui: Dibayar ${formatRupiah(
                                        clamped
                                      )}.`
                                    );
                                  } catch {
                                    notify(`Gagal memperbarui pembayaran pesanan ${ord.orderNumber}.`);
                                  }
                                }}
                                className="rounded bg-emerald-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800"
                              >
                                Simpan
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPaymentOrderId(null)}
                                className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-600"
                              >
                                Batal
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            aria-label={`Ubah status pesanan ${ord.orderNumber}`}
                            value={ord.status}
                            onChange={async (e) => {
                              const nextSt = e.target.value as OrderStatus;
                              if (nextSt === 'Dibatalkan' && onCancelOrder) {
                                await onCancelOrder(ord);
                                return;
                              }
                              const nextHist: OrderStatusHistoryItem[] = [
                                ...(ord.statusHistory || []),
                                {
                                  status: nextSt,
                                  timestamp: new Date().toISOString(),
                                  actor: 'Admin Operasional',
                                  note: `Status diubah ke ${nextSt}`,
                                },
                              ];
                              try {
                                await onSaveOrder({
                                  ...ord,
                                  status: nextSt,
                                  statusHistory: nextHist,
                                  statusHistoryJson: JSON.stringify(nextHist).slice(0, 2000),
                                });
                                notify(`Status pesanan ${ord.orderNumber} diperbarui ke "${nextSt}".`);
                              } catch {
                                notify(`Gagal memperbarui status pesanan ${ord.orderNumber}.`);
                              }
                            }}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800"
                          >
                            {ORDER_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-2">
                            {ord.paymentStatus !== 'Lunas' && ord.status !== 'Dibatalkan' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPaymentOrderId(ord.id);
                                    setEditingPaymentAmount(paidAmount);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md border border-sky-300 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900 transition-colors whitespace-nowrap"
                                >
                                  <Edit3 className="h-3 w-3" />
                                  <span>Catat DP / Bayar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      if (onConfirmOrderPaid) {
                                        await onConfirmOrderPaid(ord);
                                      } else {
                                        await onSaveOrder({
                                          ...ord,
                                          paymentStatus: 'Lunas',
                                          downPayment: ord.totalPayment,
                                          remainingBalance: 0,
                                          status:
                                            ord.status === 'Pesanan baru' ||
                                            ord.status === 'Menunggu pembayaran' ||
                                            ord.status === 'DP masuk'
                                              ? 'Diproses'
                                              : ord.status,
                                        });
                                      }
                                      notify(
                                        `Pesanan ${ord.orderNumber} (${ord.customerName}) terverifikasi SUDAH DIBAYAR (Lunas).`
                                      );
                                    } catch {
                                      notify(`Gagal memverifikasi pembayaran ${ord.orderNumber}.`);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md bg-emerald-700 hover:bg-emerald-800 px-2.5 py-1 text-xs font-semibold text-white transition-colors whitespace-nowrap"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>Verifikasi Lunas</span>
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingOrderId(ord.id);
                                setOrderCustomerName(ord.customerName);
                                setOrderWhatsapp(ord.whatsapp);
                                setOrderDate(ord.orderDate);
                                setDeliveryDate(ord.deliveryDate);
                                setOrderDeliveryTime(ord.deliveryTime || '09:00 WIB');
                                setOrderDeliveryAddress(ord.deliveryAddress || '');
                                setOrderEventType(ord.eventType);
                                setOrderPackageName(ord.packageName);
                                setOrderPortions(ord.portions);
                                setOrderUnitPrice(ord.unitPrice);
                                setOrderDiscount(ord.discount || 0);
                                setOrderShippingCost(ord.shippingCost || 0);
                                setOrderDp(ord.downPayment || 0);
                                setOrderPaymentMethod(ord.paymentMethod || 'Transfer Bank');
                                setOrderPaymentProofUrl(ord.paymentProofUrl || '');
                                setOrderStatus(ord.status);
                                setOrderNotes(ord.notes || '');
                                setShowOrderForm(true);
                              }}
                              aria-label={`Edit pesanan ${ord.orderNumber}`}
                              className="inline-flex items-center gap-1 text-slate-700 hover:text-emerald-700 font-semibold whitespace-nowrap"
                            >
                              <Edit3 className="h-3.5 w-3.5" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedInvoiceOrder(ord)}
                              aria-label={`Detail & Invoice ${ord.orderNumber}`}
                              className="text-emerald-700 hover:underline font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <FileText className="h-3.5 w-3.5" /> Detail &amp; Invoice
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteOrder(ord.id)}
                              aria-label={`Hapus pesanan ${ord.orderNumber}`}
                              className="text-red-600 hover:text-red-800 font-semibold"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 px-4 text-center text-xs text-slate-500">
                        Belum ada data pesanan catering di koleksi ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {hasMoreCloudData && onLoadMore && (
              <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-center">
                <button
                  type="button"
                  onClick={onLoadMore}
                  className="rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-4 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Muat Lebih Banyak Data Pesanan dari Cloud
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MANAJEMEN PELANGGAN */}
      {activeTab === 'customers' && (
        <div className="space-y-5">
          {showCustomerForm && (
            <form
              onSubmit={handleCustomerSubmit}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <h2 className="text-sm font-bold text-slate-900">
                {editingCustomerId ? 'Edit Profil Pelanggan' : 'Tambah Database Pelanggan Baru'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="cust-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Pelanggan / Perusahaan
                  </label>
                  <input
                    id="cust-name"
                    type="text"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="cust-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor Telepon / WhatsApp
                  </label>
                  <input
                    id="cust-phone"
                    type="text"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="cust-addr" className="block text-xs font-semibold text-slate-700 mb-1">
                    Alamat Lengkap Pengiriman
                  </label>
                  <input
                    id="cust-addr"
                    type="text"
                    value={custAddress}
                    onChange={(e) => setCustAddress(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="cust-lat" className="block text-xs font-semibold text-slate-700 mb-1">
                    Titik Koordinat Latitude
                  </label>
                  <input
                    id="cust-lat"
                    type="number"
                    step="0.0001"
                    value={custLat}
                    onChange={(e) => setCustLat(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="cust-lng" className="block text-xs font-semibold text-slate-700 mb-1">
                    Titik Koordinat Longitude
                  </label>
                  <input
                    id="cust-lng"
                    type="number"
                    step="0.0001"
                    value={custLng}
                    onChange={(e) => setCustLng(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div className="flex items-center gap-4 pt-5">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={custActive}
                      onChange={(e) => setCustActive(e.target.checked)}
                    />
                    <span>Pelanggan Aktif</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={custPriority}
                      onChange={(e) => setCustPriority(e.target.checked)}
                    />
                    <span>Pelanggan Prioritas VIP</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomerForm(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white"
                >
                  Simpan Pelanggan
                </button>
              </div>
            </form>
          )}

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-3 px-4 font-semibold">Nama Pelanggan</th>
                    <th className="py-3 px-4 font-semibold">Alamat & Koordinat Lokasi</th>
                    <th className="py-3 px-4 font-semibold">Telepon</th>
                    <th className="py-3 px-4 font-semibold text-right">Riwayat Transaksi</th>
                    <th className="py-3 px-4 font-semibold text-right">Total Pembelian</th>
                    <th className="py-3 px-4 font-semibold">Segmen</th>
                    <th className="py-3 px-4 font-semibold text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-900">{c.name}</td>
                      <td className="py-3 px-4">
                        <div className="text-slate-700">{c.address}</div>
                        <div className="font-mono tabular-nums text-slate-400">
                          GPS: {c.locationLat}, {c.locationLng}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-700">{c.phone}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {c.transactionCount} pesanan
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatRupiah(c.totalPurchases)}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {c.isActive ? 'Aktif' : 'Nonaktif'}
                        {c.isPriority ? ' · Prioritas VIP' : ''}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteCustomer(c.id)}
                          aria-label={`Hapus pelanggan ${c.name}`}
                          className="text-red-600 hover:text-red-800 font-semibold"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PRODUKSI MAKANAN & RESEP */}
      {activeTab === 'production' && (
        <div className="space-y-5">
          {showProdForm && (
            <form
              onSubmit={handleProdSubmit}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <h2 className="text-sm font-bold text-slate-900">
                Jadwal Produksi Dapur & Kalkulator Kebutuhan Bahan Baku Otomatis
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="prod-date" className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Produksi
                  </label>
                  <input
                    id="prod-date"
                    type="date"
                    value={prodDate}
                    onChange={(e) => setProdDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="prod-channel" className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit Produksi
                  </label>
                  <select
                    id="prod-channel"
                    value={prodChannel}
                    onChange={(e) =>
                      setProdChannel(e.target.value as 'Catering Komersial' | 'Sekolah Rakyat')
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="Catering Komersial">Catering Komersial</option>
                    <option value="Sekolah Rakyat">Sekolah Rakyat</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="prod-portions" className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah Porsi Masak
                  </label>
                  <input
                    id="prod-portions"
                    type="number"
                    min={10}
                    value={prodPortions}
                    onChange={(e) => setProdPortions(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="prod-menu" className="block text-xs font-semibold text-slate-700 mb-1">
                    Daftar Menu Produksi
                  </label>
                  <input
                    id="prod-menu"
                    type="text"
                    value={prodMenuName}
                    onChange={(e) => setProdMenuName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="prod-officer" className="block text-xs font-semibold text-slate-700 mb-1">
                    Petugas Produksi & Chef
                  </label>
                  <input
                    id="prod-officer"
                    type="text"
                    value={prodOfficer}
                    onChange={(e) => setProdOfficer(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="prod-status" className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Produksi
                  </label>
                  <select
                    id="prod-status"
                    value={prodStatus}
                    onChange={(e) => setProdStatus(e.target.value as ProductionBatch['status'])}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="Terjadwal">Terjadwal</option>
                    <option value="Persiapan Bahan">Persiapan Bahan</option>
                    <option value="Sedang Dimasak">Sedang Dimasak</option>
                    <option value="Quality Control">Quality Control</option>
                    <option value="Selesai">Selesai</option>
                  </select>
                </div>
              </div>

              {/* Automatic Recipe & Ingredient Calculator Output */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1.5 text-xs">
                <div className="font-bold text-slate-900">
                  Kalkulasi Kebutuhan Bahan Baku Otomatis ({prodPortions.toLocaleString('id-ID')} Porsi):
                </div>
                <div className="text-slate-700">{previewProdCalc.recipeSummary}</div>
                <div className="font-mono tabular-nums text-emerald-800 font-semibold">
                  {previewProdCalc.rawMaterialNeed}
                </div>
                <div className="font-mono tabular-nums text-slate-900">
                  Estimasi Biaya Produksi Batch: <span className="font-bold">{formatRupiah(previewProdCalc.estimatedProductionCost)}</span>
                </div>
              </div>

              <div>
                <label htmlFor="prod-doc" className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Dokumentasi Hasil Produksi & Uji Organoleptik
                </label>
                <input
                  id="prod-doc"
                  type="text"
                  value={prodDocNote}
                  onChange={(e) => setProdDocNote(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowProdForm(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white"
                >
                  Simpan Jadwal Produksi
                </button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {productionBatches.map((batch) => (
              <div
                key={batch.id}
                className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono tabular-nums font-semibold text-slate-800">
                      {formatTanggalIndonesia(batch.productionDate)}
                    </span>
                    <span>·</span>
                    <span className="font-semibold text-emerald-700">{batch.targetChannel}</span>
                    <span>·</span>
                    <span>Petugas: {batch.officerName}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{batch.menuName}</h3>
                  <p className="text-xs text-slate-600">{batch.recipeSummary}</p>
                  <p className="text-xs font-mono tabular-nums text-emerald-800 font-medium">
                    Kebutuhan Bahan Baku: {batch.rawMaterialNeed}
                  </p>
                  <p className="text-xs text-slate-500">
                    Dokumentasi QC: {batch.documentationNote}
                  </p>
                </div>

                <div className="flex flex-row lg:flex-col items-end justify-between gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-sm font-bold text-slate-900">
                      {batch.portions.toLocaleString('id-ID')} Porsi
                    </div>
                    <div className="text-xs text-slate-600">
                      Biaya: {formatRupiah(batch.productionCost)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`Ubah status produksi ${batch.menuName}`}
                      value={batch.status}
                      onChange={(e) =>
                        onSaveProduction({
                          ...batch,
                          status: e.target.value as ProductionBatch['status'],
                        })
                      }
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800"
                    >
                      <option value="Terjadwal">Terjadwal</option>
                      <option value="Persiapan Bahan">Persiapan Bahan</option>
                      <option value="Sedang Dimasak">Sedang Dimasak</option>
                      <option value="Quality Control">Quality Control</option>
                      <option value="Selesai">Selesai</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => onDeleteProduction(batch.id)}
                      aria-label={`Hapus produksi ${batch.menuName}`}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
