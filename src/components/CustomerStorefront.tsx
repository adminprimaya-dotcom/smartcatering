import React, { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  Lock,
  MapPin,
  Menu as MenuIcon,
  MessageCircle,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import {
  CartOrderItem,
  CateringCategory,
  CateringOrder,
  MenuItem,
  PromotionItem,
  SiteContentSettings,
} from '../types/erp';
import {
  deriveOrderTrackingDetails,
  formatRupiah,
  formatTanggalIndonesia,
  validateOrderTrackingMatch,
} from '../utils/calculations';
import { DEFAULT_SITE_SETTINGS, GENERATED_IMAGES } from '../data/seedData';
import { CustomerCheckoutModal } from './CustomerCheckoutModal';

const CATEGORY_DISPLAY_LIST: { value: 'Semua' | CateringCategory; label: string }[] = [
  { value: 'Semua', label: 'Semua Menu' },
  { value: 'Catering harian', label: 'Catering Harian' },
  { value: 'Nasi kotak', label: 'Nasi Kotak' },
  { value: 'Snack box', label: 'Snack Box' },
  { value: 'Catering prasmanan', label: 'Prasmanan' },
  { value: 'Catering pernikahan', label: 'Catering Pernikahan' },
  { value: 'Catering rapat', label: 'Catering Rapat' },
  { value: 'Catering perusahaan', label: 'Catering Perusahaan' },
  { value: 'Catering acara khusus', label: 'Paket Acara Khusus' },
];

interface TrackedOrderResult {
  orderNumber: string;
  customerName: string;
  whatsapp: string;
  orderDate: string;
  deliveryDate: string;
  deliveryTime: string;
  deliveryAddress: string;
  deliveryMethod: string;
  paymentMethod: string;
  items: {
    menuId: string;
    name: string;
    category: string;
    packageName: string;
    unitPrice: number;
    quantity: number;
  }[];
  portions: number;
  discount: number;
  shippingCost: number;
  totalPayment: number;
  paymentStatus: string;
  status: string;
  productionStatus: string;
  deliveryStatus: string;
  estimatedDelivery: string;
  notes: string;
}

interface CustomerStorefrontProps {
  menuItems: MenuItem[];
  orders: CateringOrder[];
  promotions: PromotionItem[];
  siteSettings?: SiteContentSettings;
  onSubmitCustomerOrder: (order: CateringOrder) => Promise<CateringOrder>;
  onOpenAdminPortal: () => void;
}

export const CustomerStorefront: React.FC<CustomerStorefrontProps> = ({
  menuItems = [],
  orders = [],
  promotions = [],
  siteSettings = DEFAULT_SITE_SETTINGS,
  onSubmitCustomerOrder,
  onOpenAdminPortal,
}) => {
  // Cart state
  const [cart, setCart] = useState<CartOrderItem[]>([
    {
      menuId: 'menu-nasi-kotak-ayam-madu',
      name: 'Nasi Kotak Ayam Bakar Madu Nusantara',
      category: 'Nasi kotak',
      packageName: 'Paket Kotak Eksekutif A',
      unitPrice: 38000,
      quantity: 30,
      imageUrl: GENERATED_IMAGES.nasiKotak,
    },
  ]);

  // Catalog Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Semua' | CateringCategory>('Semua');
  const [priceSort, setPriceSort] = useState<'default' | 'asc' | 'desc'>('default');
  const [onlyPromo, setOnlyPromo] = useState(false);

  // Modals & Interactive States
  const [detailMenu, setDetailMenu] = useState<MenuItem | null>(null);
  const [detailQuantity, setDetailQuantity] = useState(25);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutInitialStep, setCheckoutInitialStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(2);
  const [selectedPromoCode, setSelectedPromoCode] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [waModalOpen, setWaModalOpen] = useState(false);

  // Order Tracking Without Account State
  const [trackOrderNumber, setTrackOrderNumber] = useState('');
  const [trackWhatsapp, setTrackWhatsapp] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState('');
  const [trackedResult, setTrackedResult] = useState<TrackedOrderResult | null>(null);

  // Only show products that are available for customers
  const availableMenus = menuItems.filter((m) => m.available);

  const filteredMenus = availableMenus
    .filter((item) => {
      const matchesCat =
        selectedCategory === 'Semua' || item.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.packageName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPromo = !onlyPromo || Boolean(item.promoLabel);
      return matchesCat && matchesSearch && matchesPromo;
    })
    .sort((a, b) => {
      if (priceSort === 'asc') return a.sellingPrice - b.sellingPrice;
      if (priceSort === 'desc') return b.sellingPrice - a.sellingPrice;
      return 0;
    });

  const totalCartPortions = cart.reduce((acc, item) => acc + item.quantity, 0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(''), 3500);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const handleAddToCart = (menu: MenuItem, quantity = 20) => {
    setCart((prev) => {
      const exists = prev.find((c) => c.menuId === menu.id);
      if (exists) {
        return prev.map((c) =>
          c.menuId === menu.id ? { ...c, quantity: c.quantity + quantity } : c
        );
      }
      return [
        ...prev,
        {
          menuId: menu.id,
          name: menu.name,
          category: menu.category,
          packageName: menu.packageName,
          unitPrice: menu.sellingPrice,
          quantity,
          imageUrl: menu.imageUrl,
        },
      ];
    });
    showToast(`${menu.name} (+${quantity} porsi) berhasil ditambahkan ke keranjang.`);
  };

  const handleUpdateCartQuantity = (menuId: string, quantity: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.menuId === menuId ? { ...item, quantity: Math.max(1, quantity) } : item
      )
    );
  };

  const handleRemoveCartItem = (menuId: string) => {
    setCart((prev) => prev.filter((item) => item.menuId !== menuId));
  };

  const scrollToSection = (sectionId: string) => {
    setMobileNavOpen(false);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ block: 'start' });
    }
  };

  // Backend-validated Order Tracking Handler
  const executeTrackOrder = async (orderNumInput: string, waInput: string) => {
    const cleanNum = orderNumInput.trim().toUpperCase();
    const cleanWa = waInput.trim();
    setTrackingError('');
    setTrackedResult(null);

    if (!cleanNum || !cleanWa) {
      setTrackingError('Mohon masukkan Nomor Pesanan dan Nomor WhatsApp yang digunakan saat memesan.');
      return;
    }

    setTrackingLoading(true);
    try {
      const response = await fetch('/api/public/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: cleanNum,
          whatsapp: cleanWa,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.matched === false || data?.error) {
          setTrackingError(
            data.error ||
              'Data pesanan tidak ditemukan atau kombinasi Nomor Pesanan dan Nomor WhatsApp tidak cocok.'
          );
          return;
        }
        if (data?.tracking) {
          setTrackedResult(data.tracking);
          return;
        }
      }

      if (response.status === 403 || response.status === 400 || response.status === 404) {
        const errData = await response.json().catch(() => ({}));
        setTrackingError(
          errData.error ||
            'Akses ditolak: Nomor Pesanan dan Nomor WhatsApp tidak cocok di database sistem.'
        );
        return;
      }

      // Fallback verification against current live orders state if server route is unreachable
      const matched = orders.find((o) => validateOrderTrackingMatch(o, cleanNum, cleanWa));
      if (!matched) {
        setTrackingError(
          'Data pesanan tidak ditemukan atau kombinasi Nomor Pesanan dan Nomor WhatsApp tidak cocok.'
        );
        return;
      }
      const stages = deriveOrderTrackingDetails(matched);
      setTrackedResult({
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
                  menuId: 'main',
                  name: matched.packageName,
                  category: matched.eventType,
                  packageName: matched.packageName,
                  unitPrice: matched.unitPrice,
                  quantity: matched.portions,
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
      });
    } catch {
      const matched = orders.find((o) => validateOrderTrackingMatch(o, cleanNum, cleanWa));
      if (!matched) {
        setTrackingError(
          'Data pesanan tidak ditemukan atau kombinasi Nomor Pesanan dan Nomor WhatsApp tidak cocok.'
        );
      } else {
        const stages = deriveOrderTrackingDetails(matched);
        setTrackedResult({
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
                    menuId: 'main',
                    name: matched.packageName,
                    category: matched.eventType,
                    packageName: matched.packageName,
                    unitPrice: matched.unitPrice,
                    quantity: matched.portions,
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
        });
      }
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleTrackFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeTrackOrder(trackOrderNumber, trackWhatsapp);
  };

  return (
    <div id="beranda" className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: Zone 1 Brand — Zone 2 Concise Nav Links — Zone 3 Primary Cart Action */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-6 border-b border-slate-200 bg-white/95 backdrop-blur-xs px-4 sm:px-8 py-4">
        {/* Zone 1: Brand Title */}
        <a
          href="#beranda"
          onClick={(e) => {
            e.preventDefault();
            scrollToSection('beranda');
          }}
          className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          {siteSettings.brandName}
        </a>

        {/* Zone 2: Navigation Links */}
        <nav
          aria-label="Navigasi Pelanggan"
          className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <a
            href="#beranda"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('beranda');
            }}
            className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0"
          >
            Beranda
          </a>
          <a
            href="#katalog-makanan"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('katalog-makanan');
            }}
            className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0"
          >
            Menu Makanan
          </a>
          <a
            href="#paket-catering"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('paket-catering');
            }}
            className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0"
          >
            Paket Catering
          </a>
          <a
            href="#promo-spesial"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('promo-spesial');
            }}
            className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0"
          >
            Promo
          </a>
          <a
            href="#lacak-pesanan"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('lacak-pesanan');
            }}
            className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0"
          >
            Lacak Pesanan
          </a>
          <a
            href="#tentang-kami"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('tentang-kami');
            }}
            className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0"
          >
            Tentang Kami
          </a>
          <a
            href="#hubungi-kami"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('hubungi-kami');
            }}
            className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0"
          >
            Hubungi Kami
          </a>
        </nav>

        {/* Zone 3: Primary Action (Tombol Keranjang + Mobile Menu Trigger) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setCheckoutInitialStep(2);
              setCheckoutOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="h-4 w-4 text-amber-300" />
            <span>Keranjang ({cart.length} Menu · {totalCartPortions} Porsi)</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            aria-label="Buka menu navigasi pelanggan"
            className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Dropdown Navigation */}
      {mobileNavOpen && (
        <div className="lg:hidden border-b border-slate-200 bg-white px-4 py-3 space-y-2 text-sm font-medium text-slate-700">
          <button
            type="button"
            onClick={() => scrollToSection('beranda')}
            className="block w-full text-left py-1.5 hover:text-emerald-700"
          >
            Beranda
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('katalog-makanan')}
            className="block w-full text-left py-1.5 hover:text-emerald-700"
          >
            Menu Makanan
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('paket-catering')}
            className="block w-full text-left py-1.5 hover:text-emerald-700"
          >
            Paket Catering
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('promo-spesial')}
            className="block w-full text-left py-1.5 hover:text-emerald-700"
          >
            Promo
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('lacak-pesanan')}
            className="block w-full text-left py-1.5 hover:text-emerald-700"
          >
            Lacak Pesanan
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('tentang-kami')}
            className="block w-full text-left py-1.5 hover:text-emerald-700"
          >
            Tentang Kami
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('hubungi-kami')}
            className="block w-full text-left py-1.5 hover:text-emerald-700"
          >
            Hubungi Kami
          </button>
        </div>
      )}

      {/* Toast Feedback Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl border border-emerald-300 bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-lg flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => {
              setCheckoutInitialStep(2);
              setCheckoutOpen(true);
            }}
            className="underline text-amber-300 hover:text-amber-200 ml-2 whitespace-nowrap"
          >
            Lihat Keranjang
          </button>
        </div>
      )}

      {/* 2. BANNER UTAMA (HERO SECTION) */}
      <section className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Headline, Description, and 3 Action Buttons */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <p className="text-xs sm:text-sm font-semibold text-amber-400 tracking-wide">
              {siteSettings.heroBadge}
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight max-w-2xl">
              {siteSettings.heroTitle}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              {siteSettings.heroDescription}
            </p>

            {/* 3 Hero Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => scrollToSection('katalog-makanan')}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-3 text-xs sm:text-sm font-bold text-white transition-colors whitespace-nowrap shrink-0"
              >
                {siteSettings.heroBtnPrimary}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCheckoutInitialStep(1);
                  setCheckoutOpen(true);
                }}
                className="rounded-lg bg-amber-400 hover:bg-amber-300 px-5 py-3 text-xs sm:text-sm font-bold text-slate-950 transition-colors whitespace-nowrap shrink-0"
              >
                {siteSettings.heroBtnSecondary}
              </button>
              <button
                type="button"
                onClick={() => setWaModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/90 hover:bg-slate-800 px-5 py-3 text-xs sm:text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                <MessageCircle className="h-4 w-4 text-emerald-400" />
                <span>{siteSettings.heroBtnWhatsapp}</span>
              </button>
            </div>

            {/* Key Trust Metrics */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-800 text-xs">
              <div>
                <span className="font-mono tabular-nums text-lg sm:text-xl font-bold text-white block">
                  {siteSettings.stat1Title}
                </span>
                <span className="text-slate-400">{siteSettings.stat1Desc}</span>
              </div>
              <div>
                <span className="font-mono tabular-nums text-lg sm:text-xl font-bold text-emerald-400 block">
                  {siteSettings.stat2Title}
                </span>
                <span className="text-slate-400">{siteSettings.stat2Desc}</span>
              </div>
              <div>
                <span className="font-mono tabular-nums text-lg sm:text-xl font-bold text-amber-400 block">
                  {siteSettings.stat3Title}
                </span>
                <span className="text-slate-400">{siteSettings.stat3Desc}</span>
              </div>
            </div>
          </div>

          {/* Right Column: High-Quality Food Imagery */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-800 h-72 sm:h-80 lg:h-full min-h-[320px]">
              <img
                src={siteSettings.heroImageUrl || GENERATED_IMAGES.prasmanan}
                alt="Hidangan Prasmanan dan Nasi Kotak Eksekutif Smart Catering"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent p-5 text-white">
                <p className="text-xs font-semibold text-amber-300">
                  {siteSettings.heroImageCaptionTitle}
                </p>
                <p className="text-sm font-bold text-white mt-0.5">
                  {siteSettings.heroImageCaptionSubtitle}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-8 py-10 space-y-14">
        {/* 3. KATALOG MAKANAN */}
        <section id="katalog-makanan" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-emerald-700">
                {siteSettings.catalogBadge}
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                {siteSettings.catalogTitle}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Menampilkan {filteredMenus.length} menu tersedia. {siteSettings.catalogDescription}
              </p>
            </div>

            {/* Search, Price Sort, and Promo Filter */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[230px] flex-1 sm:flex-initial">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  aria-label="Cari makanan di katalog"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama menu atau paket..."
                  className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <select
                aria-label="Urutkan Harga Makanan"
                value={priceSort}
                onChange={(e) => setPriceSort(e.target.value as 'default' | 'asc' | 'desc')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700"
              >
                <option value="default">Urutkan Harga: Rekomendasi</option>
                <option value="asc">Harga: Terendah ke Tertinggi</option>
                <option value="desc">Harga: Tertinggi ke Terendah</option>
              </select>

              <button
                type="button"
                onClick={() => setOnlyPromo((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  onlyPromo
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Tag className="h-3.5 w-3.5" />
                <span>Filter Promo</span>
              </button>
            </div>
          </div>

          {/* 8 Category Interactive Filter Bar */}
          <div
            id="paket-catering"
            className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200"
            role="tablist"
            aria-label="Kategori Menu Catering"
          >
            {CATEGORY_DISPLAY_LIST.map((cat) => {
              const isSelected = selectedCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Catalog Cards Grid */}
          {filteredMenus.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center space-y-3">
              <p className="text-sm font-bold text-slate-800">
                Tidak ada menu makanan yang sesuai dengan pencarian/filter Anda.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('Semua');
                  setOnlyPromo(false);
                  setPriceSort('default');
                }}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                Tampilkan Semua Menu Tersedia
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMenus.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div>
                    {/* Product Image (65%+ height emphasis) */}
                    <div className="relative h-52 w-full bg-slate-900 overflow-hidden">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/75 to-transparent pt-10 pb-3.5 px-4 text-white">
                        {/* Clean unboxed metadata with typographic separators */}
                        <div className="flex items-center gap-1.5 text-xs text-amber-300 font-medium">
                          <span>{item.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.packageName}</span>
                          {item.promoLabel && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-emerald-300 font-semibold">
                                {item.promoLabel}
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-white leading-snug mt-0.5">
                          {item.name}
                        </h3>
                      </div>
                    </div>

                    {/* Product Body */}
                    <div className="p-4 space-y-3">
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>

                      <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
                        <div>
                          <span className="text-[11px] text-slate-500 block">
                            Harga Paket / Porsi
                          </span>
                          <span className="text-base font-mono tabular-nums font-extrabold text-slate-900">
                            {formatRupiah(item.sellingPrice)}
                          </span>
                        </div>
                        <div className="text-right text-xs text-emerald-700 font-semibold">
                          Status: Tersedia
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Buttons: Lihat Detail & Tambah ke Keranjang */}
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDetailMenu(item);
                        setDetailQuantity(25);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition-colors whitespace-nowrap"
                    >
                      <Eye className="h-3.5 w-3.5 text-slate-600" />
                      <span>Lihat Detail</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddToCart(item, 20)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Tambah ke Keranjang</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* PROMO SECTION */}
        <section
          id="promo-spesial"
          className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-bold text-emerald-700">
                {siteSettings.promoBadge}
              </p>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {siteSettings.promoTitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setCheckoutInitialStep(2);
                setCheckoutOpen(true);
              }}
              className="rounded-lg bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap self-start sm:self-auto"
            >
              Gunakan Voucher di Keranjang
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {promotions
              .filter((p) => p.active)
              .map((promo) => (
                <div
                  key={promo.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="text-xs text-emerald-800 font-semibold">
                      Segmen: {promo.targetSegment} · Berlaku s/d{' '}
                      {formatTanggalIndonesia(promo.validUntil)}
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{promo.title}</h3>
                    <p className="text-xs text-slate-600">
                      Hemat <span className="font-bold text-slate-900">{promo.discountPercent}%</span>{' '}
                      hingga maksimal potongan{' '}
                      <span className="font-mono font-bold text-emerald-700">
                        {formatRupiah(promo.maxDiscountAmount)}
                      </span>
                      .
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <span className="font-mono text-sm font-extrabold text-slate-900 bg-white border border-slate-300 rounded-lg px-3 py-1.5">
                      {promo.promoCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPromoCode(promo.promoCode);
                        setCheckoutInitialStep(2);
                        setCheckoutOpen(true);
                      }}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
                    >
                      Pakai Promo Ini →
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>

        {/* 5. PELACAKAN PESANAN TANPA AKUN ("Lacak Pesanan") */}
        <section
          id="lacak-pesanan"
          className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-bold text-emerald-700">
                {siteSettings.trackingBadge}
              </p>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {siteSettings.trackingTitle}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {siteSettings.trackingDescription}
              </p>
            </div>

            {/* Quick Sample Order Fill for Fast Verification */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">Contoh Pesanan Aktif:</span>
              <button
                type="button"
                onClick={() => {
                  setTrackOrderNumber('ORD-20261116-001');
                  setTrackWhatsapp('08119823401');
                  executeTrackOrder('ORD-20261116-001', '08119823401');
                }}
                className="rounded-lg border border-slate-300 bg-slate-50 hover:bg-emerald-50 px-2.5 py-1.5 font-mono text-xs font-semibold text-slate-800 transition-colors"
              >
                ORD-20261116-001 (WA: 08119823401)
              </button>
            </div>
          </div>

          <form
            onSubmit={handleTrackFormSubmit}
            className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
          >
            <div className="md:col-span-5">
              <label htmlFor="track-order-no" className="block text-xs font-semibold text-slate-700 mb-1">
                Nomor Pesanan *
              </label>
              <input
                id="track-order-no"
                type="text"
                value={trackOrderNumber}
                onChange={(e) => setTrackOrderNumber(e.target.value.toUpperCase())}
                placeholder="Contoh: ORD-20261116-001"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs font-mono uppercase text-slate-900 focus:border-emerald-600 focus:outline-hidden"
              />
            </div>

            <div className="md:col-span-5">
              <label htmlFor="track-wa-no" className="block text-xs font-semibold text-slate-700 mb-1">
                Nomor WhatsApp Saat Memesan *
              </label>
              <input
                id="track-wa-no"
                type="text"
                value={trackWhatsapp}
                onChange={(e) => setTrackWhatsapp(e.target.value)}
                placeholder="Contoh: 08119823401"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs font-mono tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-hidden"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={trackingLoading}
                className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-400 px-4 py-2.5 text-xs font-bold text-white transition-colors whitespace-nowrap"
              >
                {trackingLoading ? 'Memeriksa...' : 'Cek Pesanan'}
              </button>
            </div>
          </form>

          {trackingError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
              {trackingError}
            </div>
          )}

          {trackedResult && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-emerald-200/80 pb-3.5">
                <div>
                  <span className="text-xs font-semibold text-emerald-800">
                    Terverifikasi Backend · Pelanggan: {trackedResult.customerName}
                  </span>
                  <h3 className="text-lg font-mono tabular-nums font-extrabold text-slate-900">
                    Nomor Pesanan: {trackedResult.orderNumber}
                  </h3>
                </div>
                <div className="text-xs text-slate-600">
                  Tanggal Pemesanan:{' '}
                  <span className="font-semibold text-slate-900">
                    {formatTanggalIndonesia(trackedResult.orderDate)}
                  </span>
                </div>
              </div>

              {/* 4 Status Cards: Pembayaran, Produksi, Pengiriman, Estimasi Pengiriman */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1">
                  <span className="text-slate-500 block">Status Pembayaran</span>
                  <span className="text-sm font-bold text-emerald-800 block">
                    {trackedResult.paymentStatus}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Metode: {trackedResult.paymentMethod}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1">
                  <span className="text-slate-500 block">Status Produksi Dapur</span>
                  <span className="text-sm font-bold text-slate-900 block">
                    {trackedResult.productionStatus}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Tahap Operasional: {trackedResult.status}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1">
                  <span className="text-slate-500 block">Status Pengiriman</span>
                  <span className="text-sm font-bold text-slate-900 block">
                    {trackedResult.deliveryStatus}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {trackedResult.deliveryMethod}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1">
                  <span className="text-slate-500 block">Estimasi Pengiriman</span>
                  <span className="text-xs font-bold text-slate-900 block leading-snug">
                    {trackedResult.estimatedDelivery}
                  </span>
                </div>
              </div>

              {/* Ordered Food Items & Total Payment */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 text-xs">
                <div className="font-bold text-slate-900">
                  Daftar Makanan Dipesan ({trackedResult.portions} Porsi):
                </div>
                <div className="divide-y divide-slate-100">
                  {trackedResult.items.map((item, idx) => (
                    <div key={`${item.menuId}-${idx}`} className="py-2 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-900">{item.name}</span>
                        <span className="text-slate-500 ml-2">
                          ({item.quantity} porsi × {formatRupiah(item.unitPrice)})
                        </span>
                      </div>
                      <span className="font-mono tabular-nums font-bold text-slate-900">
                        {formatRupiah(item.quantity * item.unitPrice)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm font-bold text-slate-900">
                  <span>Total Pembayaran</span>
                  <span className="font-mono tabular-nums text-base text-emerald-800">
                    {formatRupiah(trackedResult.totalPayment)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* TENTANG KAMI & HUBUNGI KAMI */}
        <section
          id="tentang-kami"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
        >
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <p className="text-xs font-bold text-emerald-700">
                {siteSettings.aboutBadge}
              </p>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {siteSettings.aboutTitle}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {siteSettings.aboutDescription}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  <span>{siteSettings.feature1Title}</span>
                </div>
                <p className="text-slate-600">{siteSettings.feature1Desc}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <UtensilsCrossed className="h-4 w-4 text-emerald-700" />
                  <span>{siteSettings.feature2Title}</span>
                </div>
                <p className="text-slate-600">{siteSettings.feature2Desc}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-emerald-700" />
                  <span>{siteSettings.feature3Title}</span>
                </div>
                <p className="text-slate-600">{siteSettings.feature3Desc}</p>
              </div>
            </div>
          </div>

          <div
            id="hubungi-kami"
            className="lg:col-span-5 rounded-2xl border border-slate-200 bg-slate-900 text-white p-6 sm:p-8 flex flex-col justify-between space-y-5"
          >
            <div className="space-y-3">
              <p className="text-xs font-semibold text-amber-400">
                {siteSettings.contactBadge}
              </p>
              <h2 className="text-xl font-extrabold tracking-tight">
                {siteSettings.contactTitle}
              </h2>
              <div className="space-y-2.5 text-xs text-slate-300 pt-1">
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{siteSettings.companyAddress}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="font-mono">WhatsApp Resmi: {siteSettings.whatsappDisplay}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Jam Operasional: {siteSettings.operatingHours}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setWaModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Chat WhatsApp Sekarang</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCheckoutInitialStep(1);
                  setCheckoutOpen(true);
                }}
                className="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
              >
                Buat Pesanan Online
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* 6. FOOTER & LOGIN ADMIN DI POJOK BAWAH */}
      <footer className="border-t border-slate-200 bg-white px-4 sm:px-8 py-6 text-xs text-slate-500">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Pojok Kiri Bawah: Discreet Admin Login Trigger + Brand Copyright */}
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onOpenAdminPortal}
              aria-label="Login Admin ERP"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-900 hover:text-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors"
            >
              <Lock className="h-3 w-3" />
              <span>Login Admin</span>
            </button>
            <span>
              {siteSettings.footerCopyright}
            </span>
          </div>

          {/* Pojok Kanan Bawah: Quick Public Links */}
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => scrollToSection('katalog-makanan')}
              className="hover:text-slate-900 transition-colors"
            >
              Katalog Menu
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('lacak-pesanan')}
              className="hover:text-slate-900 transition-colors"
            >
              Lacak Pesanan
            </button>
            <button
              type="button"
              onClick={() => setWaModalOpen(true)}
              className="hover:text-slate-900 transition-colors"
            >
              WhatsApp: 0811-9823-401
            </button>
          </div>
        </div>
      </footer>

      {/* PRODUCT DETAIL MODAL ("Lihat Detail") */}
      {detailMenu && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-menu-title"
        >
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="relative h-60 w-full bg-slate-900">
              <img
                src={detailMenu.imageUrl}
                alt={detailMenu.name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => setDetailMenu(null)}
                aria-label="Tutup detail produk"
                className="absolute right-3 top-3 rounded-lg bg-slate-900/80 p-1.5 text-white hover:bg-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent p-5 text-white">
                <p className="text-xs font-semibold text-amber-300">
                  {detailMenu.category} · {detailMenu.packageName}
                </p>
                <h3 id="detail-menu-title" className="text-lg font-bold text-white">
                  {detailMenu.name}
                </h3>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-700 leading-relaxed text-sm">{detailMenu.description}</p>

              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                <div>
                  <span className="text-slate-500 block">Harga Satuan / Porsi</span>
                  <span className="text-base font-mono tabular-nums font-extrabold text-slate-900">
                    {formatRupiah(detailMenu.sellingPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status & Promo</span>
                  <span className="font-bold text-emerald-700 block">
                    Tersedia {detailMenu.promoLabel ? `· ${detailMenu.promoLabel}` : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 pt-1">
                <div>
                  <label htmlFor="detail-qty" className="block font-semibold text-slate-700 mb-1">
                    Jumlah Porsi Pesanan
                  </label>
                  <input
                    id="detail-qty"
                    type="number"
                    min={1}
                    value={detailQuantity}
                    onChange={(e) => setDetailQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums font-bold text-slate-900"
                  />
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Subtotal Menu Ini</span>
                  <span className="text-base font-mono tabular-nums font-extrabold text-emerald-800">
                    {formatRupiah(detailMenu.sellingPrice * detailQuantity)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setDetailMenu(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleAddToCart(detailMenu, detailQuantity);
                    setDetailMenu(null);
                  }}
                  className="rounded-lg bg-emerald-700 hover:bg-emerald-800 px-5 py-2 text-xs font-semibold text-white transition-colors"
                >
                  + Tambah ke Keranjang ({detailQuantity} Porsi)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP CONTACT MODAL ("Hubungi WhatsApp") */}
      {waModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wa-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
              <div className="flex items-center gap-2.5">
                <Building2 className="h-5 w-5 text-emerald-400" />
                <h3 id="wa-modal-title" className="text-sm font-bold">
                  Layanan WhatsApp Pelanggan Smart Catering
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setWaModalOpen(false)}
                aria-label="Tutup jendela WhatsApp"
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Tim konsultan catering kami siap membantu pemesanan harian, rapat instansi, prasmanan pernikahan, maupun permintaan test food.
              </p>
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 space-y-1">
                <span className="text-slate-500 block">Nomor WhatsApp Resmi Usaha:</span>
                <span className="text-base font-mono font-extrabold text-emerald-900 block">
                  0811-9823-401 (+62 811-9823-401)
                </span>
                <span className="text-[11px] text-slate-600 block">
                  Aktif Setiap Hari · Respon Cepat &lt; 5 Menit
                </span>
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setWaModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                >
                  Tutup
                </button>
                <a
                  href="https://wa.me/628119823401?text=Halo%20Smart%20Catering%2C%20saya%20ingin%20berkonsultasi%20dan%20memesan%20menu%20catering."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 py-2 font-semibold text-white"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Buka Chat WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6-STEP GUEST CHECKOUT MODAL */}
      <CustomerCheckoutModal
        isOpen={checkoutOpen}
        initialStep={checkoutInitialStep}
        cart={cart}
        availableMenus={availableMenus}
        promotions={promotions}
        existingOrdersCount={orders.length}
        initialPromoCode={selectedPromoCode}
        onClose={() => setCheckoutOpen(false)}
        onUpdateCartQuantity={handleUpdateCartQuantity}
        onRemoveCartItem={handleRemoveCartItem}
        onAddMenuToCart={handleAddToCart}
        onClearCart={() => setCart([])}
        onSubmitCustomerOrder={onSubmitCustomerOrder}
        onTrackOrderNow={(orderNum, wa) => {
          setCheckoutOpen(false);
          setTrackOrderNumber(orderNum);
          setTrackWhatsapp(wa);
          scrollToSection('lacak-pesanan');
          executeTrackOrder(orderNum, wa);
        }}
      />
    </div>
  );
};
