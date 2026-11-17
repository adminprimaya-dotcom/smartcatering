import React, { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock,
  Lock,
  MapPin,
  Menu as MenuIcon,
  MessageCircle,
  Minus,
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
import {
  getThemeCssVariables,
  resolveOrnamentConfig,
  resolveThemePreset,
} from '../utils/themePresets';
import { CustomerCheckoutModal } from './CustomerCheckoutModal';

const CATEGORY_DISPLAY_LIST: { value: 'Semua' | CateringCategory; label: string }[] = [
  { value: 'Semua', label: 'Semua Menu' },
  { value: 'Nasi kotak', label: 'Nasi Kotak' },
  { value: 'Catering harian', label: 'Catering Harian' },
  { value: 'Snack box', label: 'Snack Box' },
  { value: 'Catering prasmanan', label: 'Prasmanan' },
  { value: 'Catering rapat', label: 'Catering Rapat' },
  { value: 'Catering perusahaan', label: 'Perusahaan' },
  { value: 'Catering pernikahan', label: 'Pernikahan' },
  { value: 'Catering acara khusus', label: 'Acara Khusus' },
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
  downPayment?: number;
  remainingBalance?: number;
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
  onConfirmCustomerPayment?: (order: CateringOrder, verifiedBy?: string) => Promise<void>;
  onOpenAdminPortal: () => void;
}

export const CustomerStorefront: React.FC<CustomerStorefrontProps> = ({
  menuItems = [],
  orders = [],
  promotions = [],
  siteSettings = DEFAULT_SITE_SETTINGS,
  onSubmitCustomerOrder,
  onConfirmCustomerPayment,
  onOpenAdminPortal,
}) => {
  // Start with empty cart so customers only see what they intentionally select
  const [cart, setCart] = useState<CartOrderItem[]>([]);

  // Catalog Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Semua' | CateringCategory>('Semua');
  const [priceSort, setPriceSort] = useState<'default' | 'asc' | 'desc'>('default');

  // Modals & UI Feedback
  const [detailMenu, setDetailMenu] = useState<MenuItem | null>(null);
  const [detailQuantity, setDetailQuantity] = useState(20);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
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
      return matchesCat && matchesSearch;
    })
    .sort((a, b) => {
      if (priceSort === 'asc') return a.sellingPrice - b.sellingPrice;
      if (priceSort === 'desc') return b.sellingPrice - a.sellingPrice;
      return 0;
    });

  const totalCartPortions = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartSubtotal = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);

  const businessWaE164 =
    (siteSettings.whatsappNumber || '628119823401').replace(/\D/g, '') || '628119823401';
  const businessWaDisplay = siteSettings.whatsappDisplay || '0811-9823-401';
  const theme = resolveThemePreset(siteSettings.accentTheme);
  const ornament = resolveOrnamentConfig(siteSettings);
  const themeCssVars = getThemeCssVariables(siteSettings.accentTheme);
  const displayHeadingClass = theme.useSerifDisplay ? 'font-display-serif' : '';

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(''), 3000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Automatically reflect Lunas / PEMBAYARAN BERHASIL on tracked order without manual refresh
  useEffect(() => {
    if (!trackedResult || trackedResult.paymentStatus === 'Lunas') return;

    const liveOrder = orders.find((o) => o.orderNumber === trackedResult.orderNumber);
    if (liveOrder && liveOrder.paymentStatus === 'Lunas') {
      setTrackedResult(buildLocalTrackingResult(liveOrder));
      return;
    }

    if (trackedResult.paymentMethod !== 'QRIS') return;

    let active = true;
    const pollTrackedStatus = async () => {
      try {
        const res = await fetch('/api/public/orders/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber: trackedResult.orderNumber,
            whatsapp: trackedResult.whatsapp,
          }),
        });
        if (!active || !res.ok) return;
        const data = await res.json();
        if (data?.tracking?.paymentStatus === 'Lunas') {
          setTrackedResult(data.tracking);
        }
      } catch {
        // Ignore transient network poll errors
      }
    };

    const intervalId = setInterval(pollTrackedStatus, 4000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [trackedResult, orders]);

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
    showToast(`${menu.name} (${quantity} porsi) masuk ke keranjang.`);
  };

  const handleOrderDirect = (menu: MenuItem, quantity = 20, replaceQty = false) => {
    setCart((prev) => {
      const exists = prev.find((c) => c.menuId === menu.id);
      if (exists) {
        return replaceQty
          ? prev.map((c) => (c.menuId === menu.id ? { ...c, quantity } : c))
          : prev;
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
    setCheckoutOpen(true);
  };

  const handleUpdateCartQuantity = (menuId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveCartItem(menuId);
      return;
    }
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
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };

  const buildLocalTrackingResult = (matched: CateringOrder): TrackedOrderResult => {
    const stages = deriveOrderTrackingDetails(matched);
    return {
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
      downPayment: matched.downPayment,
      remainingBalance: matched.remainingBalance,
      paymentStatus: matched.paymentStatus,
      status: matched.status,
      productionStatus: stages.productionStatus,
      deliveryStatus: stages.deliveryStatus,
      estimatedDelivery: stages.estimatedDelivery,
      notes: matched.notes,
    };
  };

  const executeTrackOrder = async (orderNumInput: string, waInput: string) => {
    const cleanNum = orderNumInput.trim().toUpperCase();
    const cleanWa = waInput.trim();
    setTrackingError('');
    setTrackedResult(null);

    if (!cleanNum || !cleanWa) {
      setTrackingError('Masukkan Nomor Pesanan dan Nomor WhatsApp saat memesan.');
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
              'Pesanan tidak ditemukan atau Nomor WhatsApp tidak cocok.'
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
          errData.error || 'Nomor Pesanan dan Nomor WhatsApp tidak cocok.'
        );
        return;
      }

      const matched = orders.find((o) => validateOrderTrackingMatch(o, cleanNum, cleanWa));
      if (!matched) {
        setTrackingError('Pesanan tidak ditemukan atau Nomor WhatsApp tidak cocok.');
        return;
      }
      setTrackedResult(buildLocalTrackingResult(matched));
    } catch {
      const matched = orders.find((o) => validateOrderTrackingMatch(o, cleanNum, cleanWa));
      if (!matched) {
        setTrackingError('Pesanan tidak ditemukan atau Nomor WhatsApp tidak cocok.');
      } else {
        setTrackedResult(buildLocalTrackingResult(matched));
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
    <div
      id="beranda"
      data-theme={theme.key}
      style={themeCssVars as React.CSSProperties}
      className={`min-h-screen flex flex-col overflow-x-hidden ${theme.pageBgClass}`}
    >
      {/* Top Bar Contract: Zone 1 Brand — Zone 2 Concise Nav Links (4) — Zone 3 Primary Cart Action */}
      <header className={`sticky top-0 z-40 border-b ${theme.headerClass}`}>
        <div
          className="h-1 w-full"
          style={{ backgroundImage: theme.headerTopStripStyle }}
          aria-hidden="true"
        />
        <div className="flex items-center justify-between gap-3 sm:gap-6 px-3.5 sm:px-8 py-3">
          <a
            href="#beranda"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('beranda');
            }}
            title={siteSettings.brandName}
            className={`${
              theme.useSerifDisplay ? 'font-display-serif text-base sm:text-xl lg:text-2xl' : 'text-sm sm:text-lg'
            } font-extrabold tracking-tight text-slate-900 min-w-0 flex-1 md:flex-initial truncate`}
          >
            {siteSettings.brandName}
          </a>

          <nav
            aria-label="Navigasi Pelanggan"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-700"
          >
            <a
              href="#katalog-makanan"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('katalog-makanan');
              }}
              className={`${theme.navHoverClass} hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0`}
            >
              Menu
            </a>
            <a
              href="#promo-spesial"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('promo-spesial');
              }}
              className={`${theme.navHoverClass} hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0`}
            >
              Promo
            </a>
            <a
              href="#lacak-pesanan"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('lacak-pesanan');
              }}
              className={`${theme.navHoverClass} hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0`}
            >
              Cek Pesanan
            </a>
            <a
              href="#hubungi-kami"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('hubungi-kami');
              }}
              className={`${theme.navHoverClass} hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0`}
            >
              Kontak
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${theme.primaryBtnClass}`}
            >
              <ShoppingBag className="h-4 w-4 text-amber-200 shrink-0" />
              <span>
                {cart.length > 0 ? `Keranjang (${totalCartPortions})` : 'Pesan Sekarang'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label="Buka menu navigasi"
              className="md:hidden rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav Dropdown */}
      {mobileNavOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 py-3 space-y-1.5 text-sm font-medium text-slate-700">
          <button
            type="button"
            onClick={() => scrollToSection('katalog-makanan')}
            className="block w-full text-left py-1.5 hover:text-emerald-700"
          >
            Menu Makanan
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('promo-spesial')}
            className="block w-full text-left py-1.5 hover:text-emerald-700"
          >
            Promo Aktif
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('lacak-pesanan')}
            className="block w-full text-left py-1.5 hover:text-emerald-700"
          >
            Cek Status Pesanan
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('hubungi-kami')}
            className="block w-full text-left py-1.5 hover:text-emerald-700"
          >
            Kontak WhatsApp
          </button>
        </div>
      )}

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-20 right-5 z-50 rounded-xl border border-emerald-300 bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-lg flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setCheckoutOpen(true)}
            className="underline text-amber-300 hover:text-amber-200 ml-1 whitespace-nowrap"
          >
            Checkout
          </button>
        </div>
      )}

      {/* HERO SECTION: Simpel, Fokus ke Pesan Cepat */}
      <section className={theme.heroSectionClass}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-10 lg:py-14 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
              <p className={`text-xs sm:text-sm font-semibold ${theme.accentTextDarkClass}`}>
                {siteSettings.heroBadge}
              </p>
              <h1
                className={`${displayHeadingClass} ${
                  theme.useSerifDisplay
                    ? 'text-4xl sm:text-5xl lg:text-[3.35rem] leading-[1.08]'
                    : 'text-3xl sm:text-4xl lg:text-5xl leading-tight'
                } font-bold tracking-tight text-white max-w-2xl text-balance`}
              >
                {siteSettings.heroTitle}
              </h1>
              <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed max-w-xl">
                {siteSettings.heroDescription}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => scrollToSection('katalog-makanan')}
                  className={`rounded-lg px-6 py-3 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${theme.primaryBtnClass}`}
                >
                  {siteSettings.heroBtnPrimary} &amp; Pesan
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('lacak-pesanan')}
                  className={`rounded-lg px-5 py-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${theme.secondaryHeroBtnClass}`}
                >
                  Cek Status Pesanan
                </button>
                <button
                  type="button"
                  onClick={() => setWaModalOpen(true)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-3 text-xs sm:text-sm font-semibold hover:opacity-85 transition-opacity whitespace-nowrap shrink-0 ${theme.heroStepAccentClasses[0]}`}
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>{siteSettings.heroBtnWhatsapp}</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col">
              <div className={`relative h-64 sm:h-72 lg:h-full min-h-[280px] ${theme.heroImageFrameClass}`}>
                <div className="relative w-full h-full rounded-xl overflow-hidden bg-slate-800">
                  <img
                    src={siteSettings.heroImageUrl || GENERATED_IMAGES.prasmanan}
                    alt="Hidangan Smart Catering"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent p-5 text-white">
                    <p className={`text-xs font-semibold ${theme.accentTextDarkClass}`}>
                      {siteSettings.heroImageCaptionTitle}
                    </p>
                    <p className="text-sm font-bold text-white mt-0.5">
                      {siteSettings.heroImageCaptionSubtitle}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3-Step Cara Pesan Singkat & Jelas */}
          <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t ${theme.heroDividerClass} text-xs`}>
            <div>
              <span className={`font-mono font-bold block ${theme.heroStepAccentClasses[0]}`}>
                01. Pilih Menu &amp; Porsi
              </span>
              <span className="text-slate-200/85 mt-0.5 block">
                Klik Pesan pada menu yang diinginkan tanpa perlu login akun.
              </span>
            </div>
            <div>
              <span className={`font-mono font-bold block ${theme.heroStepAccentClasses[1]}`}>
                02. Isi Data &amp; Alamat
              </span>
              <span className="text-slate-200/85 mt-0.5 block">
                Cukup isi nama, WhatsApp, jadwal acara, dan pilih cara bayar.
              </span>
            </div>
            <div>
              <span className={`font-mono font-bold block ${theme.heroStepAccentClasses[2]}`}>
                03. Dapat Nomor Pesanan
              </span>
              <span className="text-slate-200/85 mt-0.5 block">
                Pesanan langsung masuk antrean dapur dan bisa dicek kapan saja.
              </span>
            </div>
          </div>
        </div>

        {/* Ornamental Botanical Frieze Horizon (shown when ornament is active) */}
        {ornament.enabled && (
          <div
            data-testid="theme-botanical-frieze"
            className="relative w-full bg-[#FAF7F2] border-t border-[#F4A95B]/40 border-b border-[#E4DCD0] h-28 sm:h-36 overflow-hidden select-none pointer-events-none"
          >
            <div className="w-full h-full flex items-end justify-center overflow-hidden">
              {Array.from({ length: 14 }).map((_, idx) => (
                <img
                  key={idx}
                  src={ornament.imageUrl}
                  alt={idx === 0 ? 'Ornamen Flora Tema Nusantara' : ''}
                  aria-hidden={idx !== 0}
                  referrerPolicy="no-referrer"
                  className={`h-28 sm:h-36 w-28 sm:w-36 object-contain object-bottom shrink-0 mix-blend-multiply -mx-2 ${
                    idx % 2 === 1 ? '-scale-x-100' : ''
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* MAIN CONTENT */}
      <main
        className={`flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-8 py-10 space-y-14 ${
          cart.length > 0 ? 'pb-28' : ''
        }`}
      >
        {/* 1. KATALOG MENU CATERING */}
        <section id="katalog-makanan" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h2
                className={`${displayHeadingClass} ${
                  theme.useSerifDisplay ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'
                } font-bold text-slate-900 tracking-tight`}
              >
                {siteSettings.catalogTitle}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Pilih menu lalu tekan tombol Pesan. Langsung selesai dalam 1 halaman.
              </p>
            </div>

            {/* Pencarian & Urutan Harga */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  aria-label="Cari menu makanan"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari menu atau paket..."
                  className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-slate-500 focus:outline-hidden"
                />
              </div>

              <select
                aria-label="Urutkan Harga"
                value={priceSort}
                onChange={(e) => setPriceSort(e.target.value as 'default' | 'asc' | 'desc')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700"
              >
                <option value="default">Urutan Rekomendasi</option>
                <option value="asc">Harga Termurah</option>
                <option value="desc">Harga Tertinggi</option>
              </select>
            </div>
          </div>

          {/* Tab Kategori */}
          <div
            id="paket-catering"
            className={`flex items-center gap-1.5 overflow-x-auto pb-2 border-b ${theme.cardBorderClass}`}
            role="tablist"
            aria-label="Kategori Menu"
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
                      ? theme.activeTabClass
                      : `bg-white border ${theme.cardBorderClass} text-slate-600 hover:text-slate-900 hover:bg-slate-100`
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Grid Menu */}
          {filteredMenus.length === 0 ? (
            <div className={`rounded-xl border ${theme.cardBorderClass} bg-white p-10 text-center space-y-3`}>
              <p className="text-sm font-bold text-slate-800">
                Menu yang Anda cari belum ditemukan.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('Semua');
                  setPriceSort('default');
                }}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${theme.primaryBtnClass}`}
              >
                Tampilkan Semua Menu
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMenus.map((item) => {
                const inCart = cart.find((c) => c.menuId === item.id);
                return (
                  <article
                    key={item.id}
                    className={`rounded-xl border ${theme.cardBorderClass} bg-white overflow-hidden flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md`}
                  >
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setDetailMenu(item);
                          setDetailQuantity(inCart ? inCart.quantity : 20);
                        }}
                        className="relative h-52 w-full bg-slate-900 overflow-hidden block text-left"
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-transparent pt-10 pb-3.5 px-4 text-white">
                          <div className="text-xs text-amber-300 font-medium truncate">
                            {item.category}
                            <span aria-hidden="true"> · </span>
                            {item.packageName}
                          </div>
                          <h3 className="text-base font-bold text-white leading-snug mt-0.5">
                            {item.name}
                          </h3>
                        </div>
                      </button>

                      <div className="p-4 space-y-3">
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                          {item.description}
                        </p>

                        <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
                          <div>
                            <span className="text-[11px] text-slate-500 block">
                              Harga per Porsi
                            </span>
                            <span className="text-base font-mono tabular-nums font-extrabold text-slate-900">
                              {formatRupiah(item.sellingPrice)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setDetailMenu(item);
                              setDetailQuantity(inCart ? inCart.quantity : 20);
                            }}
                            className={`text-xs font-semibold hover:underline ${theme.accentTextLightClass}`}
                          >
                            Detail Menu
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Footer Aksi Jelas: Pilih langsung atau atur porsi */}
                    <div className={`px-4 py-3 border-t ${theme.softPanelClass}`}>
                      {inCart ? (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Kurangi ${item.name}`}
                              onClick={() =>
                                handleUpdateCartQuantity(item.id, inCart.quantity - 5)
                              }
                              className="h-8 w-8 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="px-2 text-xs font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                              {inCart.quantity} porsi
                            </span>
                            <button
                              type="button"
                              aria-label={`Tambah ${item.name}`}
                              onClick={() =>
                                handleUpdateCartQuantity(item.id, inCart.quantity + 5)
                              }
                              className="h-8 w-8 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setCheckoutOpen(true)}
                            className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap ${theme.primaryBtnClass}`}
                          >
                            Pesan Sekarang
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleAddToCart(item, 20)}
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 transition-colors whitespace-nowrap"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Keranjang</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOrderDirect(item, 20)}
                            className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors whitespace-nowrap ${theme.primaryBtnClass}`}
                          >
                            Pesan Langsung
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* 2. PROMO AKTIF (RINGKAS) */}
        {promotions.some((p) => p.active) && (
          <section
            id="promo-spesial"
            className={`relative overflow-hidden rounded-2xl border ${theme.cardBorderClass} bg-white p-6 sm:p-8 space-y-5`}
          >
            {ornament.enabled && (
              <img
                src={ornament.imageUrl}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                className="pointer-events-none select-none absolute -bottom-2 -right-4 w-44 sm:w-56 opacity-15 mix-blend-multiply"
              />
            )}

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2
                  className={`${displayHeadingClass} ${
                    theme.useSerifDisplay ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
                  } font-bold text-slate-900 tracking-tight`}
                >
                  {siteSettings.promoTitle}
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Klik tombol Gunakan Promo agar potongan langsung terpasang saat checkout.
                </p>
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
              {promotions
                .filter((p) => p.active)
                .map((promo) => (
                  <div
                    key={promo.id}
                    className={`rounded-xl border ${theme.softPanelClass} p-4 flex items-center justify-between gap-4`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className={`text-[11px] font-semibold flex items-center gap-1.5 ${theme.accentTextLightClass}`}>
                        <Tag className="h-3.5 w-3.5" />
                        <span>
                          Berlaku s/d {formatTanggalIndonesia(promo.validUntil)}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {promo.title}
                      </h3>
                      <p className="text-xs text-slate-600">
                        Diskon{' '}
                        <span className="font-bold text-slate-900">
                          {promo.discountPercent}%
                        </span>{' '}
                        maks.{' '}
                        <span className={`font-mono font-bold ${theme.accentTextLightClass}`}>
                          {formatRupiah(promo.maxDiscountAmount)}
                        </span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPromoCode(promo.promoCode);
                        setCheckoutOpen(true);
                      }}
                      className={`rounded-lg px-3.5 py-2 text-xs font-mono font-bold transition-colors whitespace-nowrap shrink-0 ${theme.activeTabClass} hover:opacity-90`}
                    >
                      Pakai {promo.promoCode}
                    </button>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* 3. CEK STATUS PESANAN (SIMPEL & JELAS) */}
        <section
          id="lacak-pesanan"
          className={`rounded-2xl border ${theme.cardBorderClass} bg-white p-6 sm:p-8 space-y-5`}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2
                className={`${displayHeadingClass} ${
                  theme.useSerifDisplay ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
                } font-bold text-slate-900 tracking-tight`}
              >
                {siteSettings.trackingTitle}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Masukkan Nomor Pesanan dan Nomor WhatsApp Anda untuk melihat status pembayaran &amp; pengiriman.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setTrackOrderNumber('ORD-20261116-001');
                setTrackWhatsapp('08119823401');
                executeTrackOrder('ORD-20261116-001', '08119823401');
              }}
              className="rounded-lg border border-slate-300 bg-slate-50 hover:bg-emerald-50 px-3 py-1.5 font-mono text-xs font-semibold text-slate-700 transition-colors self-start md:self-auto whitespace-nowrap"
            >
              Contoh Cek: ORD-20261116-001
            </button>
          </div>

          <form
            onSubmit={handleTrackFormSubmit}
            className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end"
          >
            <div className="md:col-span-5">
              <label
                htmlFor="track-order-no"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nomor Pesanan
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
              <label
                htmlFor="track-wa-no"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nomor WhatsApp Saat Memesan
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
                className={`w-full rounded-lg disabled:bg-slate-400 px-4 py-2.5 text-xs font-bold transition-colors whitespace-nowrap ${theme.primaryBtnClass}`}
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
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-4">
              {trackedResult.paymentStatus === 'Lunas' && (
                <div className="rounded-lg border border-emerald-300 bg-emerald-100/90 px-4 py-3 text-xs font-semibold text-emerald-950 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0" />
                    <div>
                      <span className="font-extrabold uppercase tracking-tight text-emerald-900 block">
                        PEMBAYARAN BERHASIL
                      </span>
                      <span className="text-[11px] font-medium text-emerald-900">
                        Pembayaran {trackedResult.paymentMethod} sudah Lunas — pesanan sedang diproses oleh dapur.
                      </span>
                    </div>
                  </div>
                  <span className="font-mono tabular-nums font-bold shrink-0">
                    {formatRupiah(trackedResult.totalPayment)}
                  </span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-emerald-200/80 pb-3">
                <div>
                  <span className="text-xs font-semibold text-emerald-800">
                    Pemesan: {trackedResult.customerName}
                  </span>
                  <h3 className="text-base font-mono tabular-nums font-extrabold text-slate-900">
                    {trackedResult.orderNumber}
                  </h3>
                </div>
                <div className="text-xs text-slate-600">
                  Jadwal Kirim:{' '}
                  <span className="font-bold text-slate-900">
                    {trackedResult.estimatedDelivery}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-1">
                  <span className="text-slate-500 block">Status Pembayaran</span>
                  <span className="text-sm font-bold text-emerald-800 block">
                    {trackedResult.paymentStatus === 'Lunas'
                      ? 'PEMBAYARAN BERHASIL (Lunas)'
                      : trackedResult.paymentStatus}
                  </span>
                  {trackedResult.paymentStatus !== 'Lunas' && (
                    <button
                      type="button"
                      onClick={async () => {
                        const matched = orders.find(
                          (o) => o.orderNumber === trackedResult.orderNumber
                        );
                        if (matched && onConfirmCustomerPayment) {
                          await onConfirmCustomerPayment(
                            matched,
                            trackedResult.paymentMethod === 'QRIS'
                              ? 'Pembayaran QRIS Berhasil'
                              : 'Konfirmasi Pelanggan Online'
                          );
                        } else {
                          try {
                            await fetch('/api/orders/confirm-payment', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                orderNumber: trackedResult.orderNumber,
                                customerName: trackedResult.customerName,
                                whatsapp: trackedResult.whatsapp,
                                amount: trackedResult.totalPayment,
                                paymentMethod: trackedResult.paymentMethod,
                                verifiedBy:
                                  trackedResult.paymentMethod === 'QRIS'
                                    ? 'Pembayaran QRIS Berhasil'
                                    : 'Konfirmasi Pelanggan Online',
                              }),
                            });
                          } catch {
                            // Fallback local update
                          }
                        }
                        setTrackedResult({
                          ...trackedResult,
                          paymentStatus: 'Lunas',
                          downPayment: trackedResult.totalPayment,
                          remainingBalance: 0,
                          status: 'Diproses',
                          productionStatus: 'Sedang diproduksi di dapur sentral',
                        });
                        showToast(
                          `Notifikasi pembayaran dikirim ke Admin: Pesanan ${trackedResult.orderNumber} LUNAS.`
                        );
                      }}
                      className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-700 hover:bg-emerald-800 px-2.5 py-1 text-[11px] font-semibold text-white"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Konfirmasi Sudah Bayar</span>
                    </button>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-1">
                  <span className="text-slate-500 block">Proses Dapur</span>
                  <span className="text-sm font-bold text-slate-900 block">
                    {trackedResult.productionStatus}
                  </span>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-1">
                  <span className="text-slate-500 block">Pengiriman</span>
                  <span className="text-sm font-bold text-slate-900 block">
                    {trackedResult.deliveryStatus}
                  </span>
                </div>
              </div>

              {/* Ringkasan Tagihan */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Sudah Dibayar / DP</span>
                  <span className="font-mono tabular-nums text-sm font-bold text-emerald-700">
                    {formatRupiah(
                      trackedResult.paymentStatus === 'Lunas'
                        ? trackedResult.totalPayment
                        : trackedResult.downPayment || 0
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Sisa Tagihan</span>
                  <span className="font-mono tabular-nums text-sm font-bold text-amber-700">
                    {formatRupiah(
                      trackedResult.paymentStatus === 'Lunas'
                        ? 0
                        : trackedResult.remainingBalance ?? trackedResult.totalPayment
                    )}
                  </span>
                </div>
                <div className="sm:text-right">
                  <span className="text-slate-500 block">
                    Total ({trackedResult.portions} Porsi)
                  </span>
                  <span className="font-mono tabular-nums text-base font-bold text-slate-900">
                    {formatRupiah(trackedResult.totalPayment)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 4. TENTANG & KONTAK */}
        <section
          id="tentang-kami"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
        >
          <div className={`relative overflow-hidden lg:col-span-7 rounded-2xl border ${theme.cardBorderClass} bg-white p-6 sm:p-8 space-y-4 flex flex-col justify-between`}>
            {ornament.enabled && (
              <img
                src={ornament.imageUrl}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                className="pointer-events-none select-none absolute -bottom-3 -left-3 w-40 opacity-15 mix-blend-multiply -scale-x-100"
              />
            )}

            <div className="relative z-10 space-y-2.5">
              <h2
                className={`${displayHeadingClass} ${
                  theme.useSerifDisplay ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
                } font-bold text-slate-900 tracking-tight`}
              >
                {siteSettings.aboutTitle}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {siteSettings.aboutDescription}
              </p>
            </div>

            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 text-xs">
              <div className={`rounded-xl border ${theme.softPanelClass} p-3.5 space-y-1`}>
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className={`h-4 w-4 shrink-0 ${theme.accentTextLightClass}`} />
                  <span>{siteSettings.feature1Title}</span>
                </div>
                <p className="text-slate-600">{siteSettings.feature1Desc}</p>
              </div>
              <div className={`rounded-xl border ${theme.softPanelClass} p-3.5 space-y-1`}>
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <UtensilsCrossed className={`h-4 w-4 shrink-0 ${theme.accentTextLightClass}`} />
                  <span>{siteSettings.feature2Title}</span>
                </div>
                <p className="text-slate-600">{siteSettings.feature2Desc}</p>
              </div>
              <div className={`rounded-xl border ${theme.softPanelClass} p-3.5 space-y-1`}>
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Truck className={`h-4 w-4 shrink-0 ${theme.accentTextLightClass}`} />
                  <span>{siteSettings.feature3Title}</span>
                </div>
                <p className="text-slate-600">{siteSettings.feature3Desc}</p>
              </div>
            </div>
          </div>

          <div
            id="hubungi-kami"
            className={`lg:col-span-5 rounded-2xl border p-6 sm:p-8 flex flex-col justify-between space-y-5 ${theme.contactCardClass}`}
          >
            <div className="space-y-3">
              <h2
                className={`${displayHeadingClass} ${
                  theme.useSerifDisplay ? 'text-2xl sm:text-3xl' : 'text-xl'
                } font-bold tracking-tight`}
              >
                {siteSettings.contactTitle}
              </h2>
              <div className="space-y-2.5 text-xs text-slate-200/90 pt-1">
                <div className="flex items-start gap-2.5">
                  <MapPin className={`h-4 w-4 shrink-0 mt-0.5 ${theme.heroStepAccentClasses[0]}`} />
                  <span>{siteSettings.companyAddress}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className={`h-4 w-4 shrink-0 ${theme.heroStepAccentClasses[0]}`} />
                  <span className="font-mono">WhatsApp: {businessWaDisplay}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock className={`h-4 w-4 shrink-0 ${theme.heroStepAccentClasses[0]}`} />
                  <span>Jam Operasional: {siteSettings.operatingHours}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setWaModalOpen(true)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors ${theme.primaryBtnClass}`}
              >
                <MessageCircle className="h-4 w-4" />
                <span>Chat WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => setCheckoutOpen(true)}
                className={`rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors ${theme.secondaryHeroBtnClass}`}
              >
                Form Pemesanan
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* STICKY BOTTOM CART BAR: Muncul saat ada menu dipilih agar checkout 1 klik */}
      {cart.length > 0 && !checkoutOpen && (
        <div className={`fixed inset-x-0 bottom-0 z-30 border-t ${theme.cardBorderClass} bg-white/95 backdrop-blur-xs shadow-lg`}>
          <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-500">
                {cart.length} Menu Dipilih · {totalCartPortions} Porsi
              </p>
              <p className="text-sm sm:text-base font-mono tabular-nums font-extrabold text-slate-900 truncate">
                {formatRupiah(cartSubtotal)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              className={`rounded-lg px-5 py-2.5 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${theme.primaryBtnClass}`}
            >
              Lanjut Pesan Sekarang →
            </button>
          </div>
        </div>
      )}

      {/* Botanical Horizon Footer Divider */}
      {ornament.enabled && (
        <div
          className="relative w-full bg-[#FAF7F2] h-24 sm:h-32 overflow-hidden select-none pointer-events-none"
          aria-hidden="true"
        >
          <div className="w-full h-full flex items-end justify-center overflow-hidden">
            {Array.from({ length: 14 }).map((_, idx) => (
              <img
                key={idx}
                src={ornament.imageUrl}
                alt=""
                referrerPolicy="no-referrer"
                className={`h-24 sm:h-32 w-24 sm:w-32 object-contain object-bottom shrink-0 mix-blend-multiply -mx-2 opacity-95 ${
                  idx % 2 === 1 ? '-scale-x-100' : ''
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className={`border-t px-4 sm:px-8 py-6 pb-20 sm:pb-6 text-xs ${theme.footerClass}`}>
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:pr-72">
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
            <span>{siteSettings.footerCopyright}</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => scrollToSection('katalog-makanan')}
              className="hover:text-slate-900 transition-colors"
            >
              Menu
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('lacak-pesanan')}
              className="hover:text-slate-900 transition-colors"
            >
              Cek Pesanan
            </button>
            <button
              type="button"
              onClick={() => setWaModalOpen(true)}
              className="hover:text-slate-900 transition-colors"
            >
              WhatsApp: {businessWaDisplay}
            </button>
          </div>
        </div>
      </footer>

      {/* MODAL DETAIL MENU */}
      {detailMenu && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-menu-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="relative h-56 w-full bg-slate-900">
              <img
                src={detailMenu.imageUrl}
                alt={detailMenu.name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => setDetailMenu(null)}
                aria-label="Tutup detail menu"
                className="absolute right-3 top-3 rounded-lg bg-slate-900/80 p-1.5 text-white hover:bg-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent p-5 text-white">
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

              <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                <div>
                  <label htmlFor="detail-qty" className="block font-semibold text-slate-700 mb-1">
                    Jumlah Porsi
                  </label>
                  <input
                    id="detail-qty"
                    type="number"
                    min={1}
                    value={detailQuantity}
                    onChange={(e) => setDetailQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono tabular-nums font-bold text-slate-900"
                  />
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Total Menu Ini</span>
                  <span className="text-base font-mono tabular-nums font-extrabold text-emerald-800">
                    {formatRupiah(detailMenu.sellingPrice * detailQuantity)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    handleAddToCart(detailMenu, detailQuantity);
                    setDetailMenu(null);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  + Keranjang
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleOrderDirect(detailMenu, detailQuantity, true);
                    setDetailMenu(null);
                  }}
                  className="rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white transition-colors"
                >
                  Pesan Langsung
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL WHATSAPP */}
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
                  WhatsApp {siteSettings.brandName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setWaModalOpen(false)}
                aria-label="Tutup WhatsApp"
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Butuh bantuan pilih paket catering atau konsultasi acara? Hubungi tim kami langsung melalui WhatsApp.
              </p>
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 space-y-1">
                <span className="text-slate-500 block">Nomor WhatsApp Resmi:</span>
                <span className="text-base font-mono font-extrabold text-emerald-900 block">
                  {businessWaDisplay}
                </span>
              </div>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setWaModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                >
                  Tutup
                </button>
                <a
                  href={`https://wa.me/${businessWaE164}?text=${encodeURIComponent(
                    `Halo ${siteSettings.brandName}, saya ingin bertanya dan memesan catering.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 py-2 font-semibold text-white"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Buka WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1-PAGE SIMPLE GUEST CHECKOUT MODAL */}
      <CustomerCheckoutModal
        isOpen={checkoutOpen}
        cart={cart}
        orders={orders}
        availableMenus={availableMenus}
        promotions={promotions}
        existingOrdersCount={orders.length}
        initialPromoCode={selectedPromoCode}
        siteSettings={siteSettings}
        onClose={() => setCheckoutOpen(false)}
        onUpdateCartQuantity={handleUpdateCartQuantity}
        onRemoveCartItem={handleRemoveCartItem}
        onAddMenuToCart={handleAddToCart}
        onClearCart={() => setCart([])}
        onSubmitCustomerOrder={onSubmitCustomerOrder}
        onConfirmCustomerPayment={onConfirmCustomerPayment}
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
