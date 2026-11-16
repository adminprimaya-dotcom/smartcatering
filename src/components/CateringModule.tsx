import React, { useState } from 'react';
import {
  ChefHat,
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
  ProductionBatch,
} from '../types/erp';
import {
  calculateMenuProfit,
  calculateOrderFinancials,
  calculateRawMaterialRequirement,
  formatRupiah,
  formatTanggalIndonesia,
  generateOrderNumber,
} from '../utils/calculations';
import { GENERATED_IMAGES } from '../data/seedData';

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
  onSaveMenu: (item: MenuItem) => Promise<void>;
  onDeleteMenu: (id: string) => Promise<void>;
  onSaveOrder: (order: CateringOrder) => Promise<void>;
  onDeleteOrder: (id: string) => Promise<void>;
  onSaveCustomer: (customer: CustomerRecord) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  onSaveProduction: (batch: ProductionBatch) => Promise<void>;
  onDeleteProduction: (id: string) => Promise<void>;
}

export const CateringModule: React.FC<CateringModuleProps> = ({
  ownerId,
  menuItems,
  orders,
  customers,
  productionBatches,
  onSaveMenu,
  onDeleteMenu,
  onSaveOrder,
  onDeleteOrder,
  onSaveCustomer,
  onDeleteCustomer,
  onSaveProduction,
  onDeleteProduction,
}) => {
  const [activeTab, setActiveTab] = useState<'menu' | 'orders' | 'customers' | 'production'>('menu');
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
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [orderCustomerName, setOrderCustomerName] = useState('');
  const [orderWhatsapp, setOrderWhatsapp] = useState('');
  const [orderDate, setOrderDate] = useState('2026-11-16');
  const [deliveryDate, setDeliveryDate] = useState('2026-11-18');
  const [orderEventType, setOrderEventType] = useState<CateringCategory>('Catering rapat');
  const [orderPackageName, setOrderPackageName] = useState(
    menuItems[0]?.name || 'Nasi Kotak Ayam Bakar Madu Nusantara'
  );
  const [orderPortions, setOrderPortions] = useState(150);
  const [orderUnitPrice, setOrderUnitPrice] = useState(38000);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [orderDp, setOrderDp] = useState(2500000);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('Pesanan baru');
  const [orderNotes, setOrderNotes] = useState('');
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<CateringOrder | null>(null);

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
  };

  // Order Submit
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderCustomerName.trim() || !orderWhatsapp.trim()) {
      notify('Nama pelanggan dan nomor WhatsApp wajib diisi.');
      return;
    }
    const financials = calculateOrderFinancials({
      portions: orderPortions,
      unitPrice: orderUnitPrice,
      discount: orderDiscount,
      downPayment: orderDp,
    });
    const id = editingOrderId || `ord-${Date.now()}`;
    const existingOrder = orders.find((o) => o.id === editingOrderId);
    const orderNumber =
      existingOrder?.orderNumber || generateOrderNumber(orderDate, orders.length + 1);

    await onSaveOrder({
      id,
      ownerId,
      orderNumber,
      customerName: orderCustomerName.trim(),
      whatsapp: orderWhatsapp.trim(),
      orderDate,
      deliveryDate,
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
      notes: orderNotes.trim() || 'Sesuai standar pesanan catering.',
    });
    setShowOrderForm(false);
    setEditingOrderId(null);
    setOrderCustomerName('');
    setOrderWhatsapp('');
    notify(`Pesanan ${orderNumber} berhasil disimpan.`);
  };

  // Customer Submit
  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custAddress.trim() || !custPhone.trim()) {
      notify('Mohon lengkapi nama pelanggan, alamat, dan nomor telepon.');
      return;
    }
    const id = editingCustomerId || `cust-${Date.now()}`;
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
    downPayment: orderDp,
  });

  const previewProdCalc = calculateRawMaterialRequirement(prodPortions, prodChannel);

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation Tabs */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Modul 1 — Manajemen Usaha Catering Komersial
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Katalog Menu 8 Kategori, Pesanan Otomatis, Database Pelanggan & Produksi Dapur Sentral
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-100 p-1 w-fit" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'menu'}
            onClick={() => setActiveTab('menu')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'menu'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UtensilsCrossed className="h-3.5 w-3.5" />
            <span>1. Produk & Menu ({menuItems.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'orders'}
            onClick={() => setActiveTab('orders')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'orders'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>2. Pesanan Catering ({orders.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'customers'}
            onClick={() => setActiveTab('customers')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'customers'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>3. Pelanggan ({customers.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'production'}
            onClick={() => setActiveTab('production')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'production'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ChefHat className="h-3.5 w-3.5" />
            <span>4. Produksi & Resep ({productionBatches.length})</span>
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
                  <label htmlFor="ord-dp" className="block text-xs font-semibold text-slate-700 mb-1">
                    Uang Muka / DP Diterima (IDR)
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
                  <span className="text-slate-500 block">Total Pembayaran Bersih</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 text-sm">
                    {formatRupiah(previewFinancials.totalPayment)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Uang Muka (DP)</span>
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
                  <span className="text-slate-500 block">Status Pembayaran Otomatis</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {previewFinancials.paymentStatus}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOrderForm(false)}
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

          {/* Invoice Preview Modal/Card if selected */}
          {selectedInvoiceOrder && (
            <div className="rounded-xl border border-slate-300 bg-white p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    INVOICE RESMI PESANAN CATERING — {selectedInvoiceOrder.orderNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Smart Catering & Sekolah Rakyat Management System · NPWP Korporasi Terdaftar
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <Printer className="h-3.5 w-3.5" /> Cetak Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedInvoiceOrder(null)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Tutup
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Ditagihkan Kepada:</span>
                  <span className="font-bold text-slate-900">{selectedInvoiceOrder.customerName}</span>
                  <span className="block text-slate-600">WA: {selectedInvoiceOrder.whatsapp}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Jadwal Acara & Paket:</span>
                  <span className="font-semibold text-slate-900">{selectedInvoiceOrder.eventType}</span>
                  <span className="block text-slate-600">
                    Kirim: {formatTanggalIndonesia(selectedInvoiceOrder.deliveryDate)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Ringkasan Tagihan:</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900">
                    Total: {formatRupiah(selectedInvoiceOrder.totalPayment)}
                  </span>
                  <span className="block font-mono tabular-nums text-emerald-700">
                    DP: {formatRupiah(selectedInvoiceOrder.downPayment)} · Sisa: {formatRupiah(selectedInvoiceOrder.remainingBalance)}
                  </span>
                </div>
              </div>
            </div>
          )}

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
                    <th className="py-3 px-4 font-semibold text-right">Total & Sisa</th>
                    <th className="py-3 px-4 font-semibold">Status Pesanan</th>
                    <th className="py-3 px-4 font-semibold text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((ord) => (
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
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <div className="font-bold text-slate-900">{formatRupiah(ord.totalPayment)}</div>
                        <div className="text-slate-500">
                          {ord.paymentStatus} · Sisa {formatRupiah(ord.remainingBalance)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          aria-label={`Ubah status pesanan ${ord.orderNumber}`}
                          value={ord.status}
                          onChange={(e) =>
                            onSaveOrder({
                              ...ord,
                              status: e.target.value as OrderStatus,
                            })
                          }
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
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoiceOrder(ord)}
                            aria-label={`Invoice ${ord.orderNumber}`}
                            className="text-emerald-700 hover:underline font-semibold inline-flex items-center gap-1"
                          >
                            <FileText className="h-3.5 w-3.5" /> Invoice
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
                  ))}
                </tbody>
              </table>
            </div>
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
