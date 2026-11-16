import React, { useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
} from '@vis.gl/react-google-maps';
import {
  Building2,
  CheckCircle2,
  CreditCard,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  QrCode,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
  User,
  Wallet,
  X,
} from 'lucide-react';
import {
  CartOrderItem,
  CateringOrder,
  DeliveryMethodType,
  MenuItem,
  PaymentMethodType,
  PromotionItem,
} from '../types/erp';
import {
  calculateGuestCartCheckout,
  formatRupiah,
  formatTanggalIndonesia,
  generateOrderNumber,
  normalizeWhatsappNumber,
} from '../utils/calculations';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const BUSINESS_WHATSAPP_DISPLAY = '0811-9823-401';
const BUSINESS_WHATSAPP_E164 = '628119823401';

const JAKARTA_PRESET_LOCATIONS = [
  {
    label: 'Sudirman - Gatot Subroto (Jakarta Selatan)',
    lat: -6.2246,
    lng: 106.8224,
    distanceKm: 5,
    sampleAddress: 'Jl. Jend. Sudirman Kav. 52-53, Senayan, Jakarta Selatan',
  },
  {
    label: 'Menteng - Thamrin (Jakarta Pusat)',
    lat: -6.1972,
    lng: 106.8356,
    distanceKm: 3,
    sampleAddress: 'Jl. MH Thamrin No. 10, Menteng, Jakarta Pusat',
  },
  {
    label: 'Kuningan - Rasuna Said (Jakarta Selatan)',
    lat: -6.2215,
    lng: 106.8329,
    distanceKm: 4,
    sampleAddress: 'Jl. HR Rasuna Said Kav. C-11, Kuningan, Jakarta Selatan',
  },
  {
    label: 'Kemayoran - Sunter (Jakarta Pusat/Utara)',
    lat: -6.1618,
    lng: 106.8472,
    distanceKm: 7,
    sampleAddress: 'Jl. Benyamin Sueb Kav. A5, Kemayoran, Jakarta Pusat',
  },
  {
    label: 'Jatinegara - Cawang (Jakarta Timur)',
    lat: -6.2145,
    lng: 106.8632,
    distanceKm: 6,
    sampleAddress: 'Jl. MT Haryono Kav. 23, Cawang, Jakarta Timur',
  },
];

interface CustomerCheckoutModalProps {
  isOpen: boolean;
  initialStep?: 1 | 2 | 3 | 4 | 5 | 6;
  cart: CartOrderItem[];
  availableMenus: MenuItem[];
  promotions: PromotionItem[];
  existingOrdersCount: number;
  initialPromoCode?: string;
  onClose: () => void;
  onUpdateCartQuantity: (menuId: string, quantity: number) => void;
  onRemoveCartItem: (menuId: string) => void;
  onAddMenuToCart: (menu: MenuItem, quantity: number) => void;
  onClearCart: () => void;
  onSubmitCustomerOrder: (order: CateringOrder) => Promise<CateringOrder>;
  onTrackOrderNow: (orderNumber: string, whatsapp: string) => void;
}

export const CustomerCheckoutModal: React.FC<CustomerCheckoutModalProps> = ({
  isOpen,
  initialStep = 2,
  cart,
  availableMenus,
  promotions,
  existingOrdersCount,
  initialPromoCode = '',
  onClose,
  onUpdateCartQuantity,
  onRemoveCartItem,
  onAddMenuToCart,
  onClearCart,
  onSubmitCustomerOrder,
  onTrackOrderNow,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(initialStep);

  // Step 2: Promo state
  const [promoInput, setPromoInput] = useState(initialPromoCode);
  const [appliedPromo, setAppliedPromo] = useState<PromotionItem | null>(() => {
    if (!initialPromoCode) return null;
    return (
      promotions.find(
        (p) => p.active && p.promoCode.toUpperCase() === initialPromoCode.toUpperCase()
      ) || null
    );
  });
  const [promoMessage, setPromoMessage] = useState('');

  // Step 3: Customer details (NO username/password)
  const [customerName, setCustomerName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('2026-11-18');
  const [deliveryTime, setDeliveryTime] = useState('10:00 WIB');
  const [notes, setNotes] = useState('');

  // Step 4: Delivery method & interactive map coordinates
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethodType>('Pengiriman ke alamat');
  const [locationLat, setLocationLat] = useState(-6.2088);
  const [locationLng, setLocationLng] = useState(106.8456);
  const [distanceKm, setDistanceKm] = useState(5);

  // Step 5: Payment method (only configured & ready methods)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('Transfer Bank');

  // Step 6: Confirmed order result
  const [confirmedOrder, setConfirmedOrder] = useState<CateringOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [waSentNotice, setWaSentNotice] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setStep(initialStep);
      setConfirmedOrder(null);
      setErrorMessage('');
      if (initialPromoCode) {
        setPromoInput(initialPromoCode);
        const found = promotions.find(
          (p) => p.active && p.promoCode.trim().toUpperCase() === initialPromoCode.trim().toUpperCase()
        );
        if (found) setAppliedPromo(found);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const checkoutTotals = calculateGuestCartCheckout({
    items: cart,
    promo: appliedPromo,
    deliveryMethod,
    distanceKm,
  });

  const handleApplyPromo = (codeToApply?: string) => {
    const code = (codeToApply ?? promoInput).trim().toUpperCase();
    setPromoInput(code);
    if (!code) {
      setAppliedPromo(null);
      setPromoMessage('');
      return;
    }
    const found = promotions.find(
      (p) => p.active && p.promoCode.trim().toUpperCase() === code
    );
    if (found) {
      setAppliedPromo(found);
      setPromoMessage(
        `Kode promo ${found.promoCode} berhasil diterapkan (Diskon ${found.discountPercent}% maks. ${formatRupiah(
          found.maxDiscountAmount
        )}).`
      );
    } else {
      setAppliedPromo(null);
      setPromoMessage('Kode promo tidak ditemukan atau sudah tidak aktif.');
    }
  };

  const handleProceedFromStep3 = () => {
    setErrorMessage('');
    if (!customerName.trim()) {
      setErrorMessage('Mohon isi nama lengkap pemesan.');
      return;
    }
    if (normalizeWhatsappNumber(whatsapp).length < 8) {
      setErrorMessage('Mohon isi nomor WhatsApp aktif yang valid (contoh: 0812xxxxxxxx).');
      return;
    }
    if (!deliveryDate) {
      setErrorMessage('Mohon pilih tanggal pengiriman pesanan.');
      return;
    }
    if (!deliveryAddress.trim()) {
      setErrorMessage('Mohon isi alamat pengiriman atau lokasi acara.');
      return;
    }
    setStep(4);
  };

  const handleFinalSubmitOrder = async () => {
    setErrorMessage('');
    if (cart.length === 0) {
      setErrorMessage('Keranjang pesanan masih kosong. Silakan pilih menu terlebih dahulu.');
      setStep(1);
      return;
    }
    if (!customerName.trim() || normalizeWhatsappNumber(whatsapp).length < 8) {
      setErrorMessage('Data nama pemesan dan nomor WhatsApp wajib diisi.');
      setStep(3);
      return;
    }

    setSubmitting(true);
    try {
      const todayStr = '2026-11-16';
      const orderNumber = generateOrderNumber(todayStr, existingOrdersCount + 1);
      const primaryItem = cart[0];
      const summaryPackageName =
        cart.length === 1
          ? `${primaryItem.name} (${primaryItem.quantity} porsi)`
          : `${primaryItem.name} + ${cart.length - 1} menu lainnya (${checkoutTotals.totalPortions} porsi)`;

      const averageUnitPrice =
        checkoutTotals.totalPortions > 0
          ? Math.round(checkoutTotals.subtotal / checkoutTotals.totalPortions)
          : primaryItem.unitPrice;

      const finalAddress =
        deliveryMethod === 'Ambil sendiri di lokasi dapur'
          ? 'Ambil Sendiri di Dapur Sentral Smart Catering (Jl. Proklamasi No. 42, Menteng)'
          : deliveryAddress.trim();

      const combinedNotes = [
        `Metode: ${deliveryMethod}`,
        `Jam Kirim: ${deliveryTime}`,
        `Alamat: ${finalAddress}`,
        `Pembayaran: ${paymentMethod}`,
        notes.trim() ? `Catatan: ${notes.trim()}` : '',
      ]
        .filter(Boolean)
        .join(' | ')
        .slice(0, 390);

      const newOrderPayload: CateringOrder = {
        id: `ord-${Date.now()}`,
        ownerId: 'admin-workspace-uid',
        orderNumber,
        customerName: customerName.trim(),
        whatsapp: whatsapp.trim(),
        orderDate: todayStr,
        deliveryDate,
        deliveryTime,
        deliveryAddress: finalAddress,
        deliveryMethod,
        shippingCost: checkoutTotals.shippingCost,
        paymentMethod,
        locationLat,
        locationLng,
        items: [...cart],
        eventType: primaryItem.category,
        packageName: summaryPackageName.slice(0, 120),
        portions: checkoutTotals.totalPortions,
        unitPrice: averageUnitPrice,
        discount: checkoutTotals.discountAmount,
        totalPayment: checkoutTotals.grandTotal,
        downPayment: 0,
        remainingBalance: checkoutTotals.grandTotal,
        paymentStatus: 'Belum Bayar',
        status: 'Pesanan baru',
        notes: combinedNotes,
      };

      const savedOrder = await onSubmitCustomerOrder(newOrderPayload);
      setConfirmedOrder(savedOrder || newOrderPayload);
      onClearCart();
      setStep(6);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Terjadi kendala saat menyimpan pesanan.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const STEPS_META: { num: 1 | 2 | 3 | 4 | 5 | 6; label: string }[] = [
    { num: 1, label: '1. Pilih Menu' },
    { num: 2, label: '2. Keranjang' },
    { num: 3, label: '3. Data Pemesan' },
    { num: 4, label: '4. Pengiriman' },
    { num: 5, label: '5. Pembayaran' },
    { num: 6, label: '6. Konfirmasi' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 sm:p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
    >
      <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-4 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 id="checkout-modal-title" className="text-base font-bold tracking-tight">
                Pemesanan Catering Mudah (Tanpa Perlu Login)
              </h2>
              <p className="text-xs text-slate-300">
                Smart Catering Nusantara · Proses Cepat 6 Langkah Langsung Terjadwal di Dapur
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela pemesanan"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 6-Step Progress Bar */}
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1.5 min-w-max">
            {STEPS_META.map((item) => {
              const isCurrent = step === item.num;
              const isCompleted = step > item.num;
              return (
                <button
                  key={item.num}
                  type="button"
                  disabled={item.num === 6 && !confirmedOrder}
                  onClick={() => {
                    if (item.num < 6) setStep(item.num);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    isCurrent
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : isCompleted
                      ? 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
              {errorMessage}
            </div>
          )}

          {/* LANGKAH 1: PILIH MENU */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Langkah 1 — Pilih Menu Makanan Catering
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tambahkan menu yang diinginkan ke keranjang, lalu lanjutkan ke Langkah 2.
                  </p>
                </div>
                <span className="text-xs font-semibold text-emerald-800">
                  {cart.length} jenis menu dipilih ({checkoutTotals.totalPortions} porsi)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {availableMenus.map((menu) => {
                  const inCart = cart.find((c) => c.menuId === menu.id);
                  return (
                    <div
                      key={menu.id}
                      className="rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-3 bg-white"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={menu.imageUrl}
                          alt={menu.name}
                          referrerPolicy="no-referrer"
                          className="h-14 w-16 rounded-lg object-cover bg-slate-100 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-500 truncate">
                            {menu.category} · {menu.packageName}
                          </p>
                          <h4 className="text-xs font-bold text-slate-900 truncate">{menu.name}</h4>
                          <p className="text-xs font-mono tabular-nums font-bold text-emerald-700 mt-0.5">
                            {formatRupiah(menu.sellingPrice)} / porsi
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onAddMenuToCart(menu, 20)}
                        className="rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                      >
                        {inCart ? `+ Tambah (${inCart.quantity})` : '+ Pilih Menu'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={cart.length === 0}
                  className="rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 px-5 py-2.5 text-xs font-semibold text-white transition-colors"
                >
                  Lanjut ke Langkah 2: Keranjang ({checkoutTotals.totalPortions} Porsi)
                </button>
              </div>
            </div>
          )}

          {/* LANGKAH 2: KERANJANG */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Langkah 2 — Keranjang Belanja & Kode Promo
                  </h3>
                  <p className="text-xs text-slate-500">
                    Atur jumlah porsi makanan, masukkan kode promo jika ada, dan periksa subtotal pembayaran.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
                >
                  + Tambah Menu Lainnya
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center space-y-3">
                  <p className="text-sm font-semibold text-slate-800">
                    Keranjang pesanan Anda masih kosong.
                  </p>
                  <p className="text-xs text-slate-500">
                    Silakan pilih hidangan dari katalog menu untuk mulai memesan tanpa login.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    Pilih Menu Makanan
                  </button>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                    {cart.map((item) => (
                      <div
                        key={item.menuId}
                        className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            className="h-14 w-16 rounded-lg object-cover bg-slate-100 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-[11px] text-slate-500">
                              {item.category} · {item.packageName}
                            </p>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                              {item.name}
                            </h4>
                            <p className="text-xs font-mono tabular-nums text-slate-600">
                              Harga satuan: {formatRupiah(item.unitPrice)} / porsi
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4">
                          {/* Quantity controls */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              aria-label={`Kurangi porsi ${item.name}`}
                              onClick={() =>
                                onUpdateCartQuantity(item.menuId, Math.max(1, item.quantity - 10))
                              }
                              className="h-8 w-8 rounded-lg border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              aria-label={`Jumlah porsi ${item.name}`}
                              value={item.quantity}
                              onChange={(e) =>
                                onUpdateCartQuantity(
                                  item.menuId,
                                  Math.max(1, Number(e.target.value) || 1)
                                )
                              }
                              className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-center text-xs font-mono tabular-nums font-bold text-slate-900"
                            />
                            <button
                              type="button"
                              aria-label={`Tambah porsi ${item.name}`}
                              onClick={() => onUpdateCartQuantity(item.menuId, item.quantity + 10)}
                              className="h-8 w-8 rounded-lg border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="text-right min-w-[110px]">
                            <span className="block text-[11px] text-slate-400">Subtotal</span>
                            <span className="text-xs sm:text-sm font-mono tabular-nums font-bold text-slate-900">
                              {formatRupiah(item.unitPrice * item.quantity)}
                            </span>
                          </div>

                          <button
                            type="button"
                            aria-label={`Hapus ${item.name} dari keranjang`}
                            onClick={() => onRemoveCartItem(item.menuId)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Promo Code Section */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                      <div className="relative flex-1">
                        <Tag className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          aria-label="Masukkan Kode Promo"
                          value={promoInput}
                          onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                          placeholder="Masukkan kode promo (contoh: RAPAT2026 atau WEDDINGEMAS)"
                          className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs font-mono uppercase text-slate-900"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApplyPromo()}
                        className="rounded-lg bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                      >
                        Gunakan Kode Promo
                      </button>
                    </div>

                    {/* Active Promo Quick Select */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span>Voucher Tersedia:</span>
                      {promotions
                        .filter((p) => p.active)
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleApplyPromo(p.promoCode)}
                            className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-mono font-semibold text-emerald-900 hover:bg-emerald-100"
                          >
                            {p.promoCode} ({p.discountPercent}% Off)
                          </button>
                        ))}
                    </div>

                    {promoMessage && (
                      <p className="text-xs font-medium text-emerald-800">{promoMessage}</p>
                    )}
                  </div>

                  {/* Cart Summary Box */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">Subtotal Makanan ({checkoutTotals.totalPortions} Porsi)</span>
                      <span className="text-sm font-mono tabular-nums font-bold text-slate-900">
                        {formatRupiah(checkoutTotals.subtotal)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Potongan Diskon Promo</span>
                      <span className="text-sm font-mono tabular-nums font-bold text-emerald-700">
                        - {formatRupiah(checkoutTotals.discountAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Estimasi Total Pembayaran</span>
                      <span className="text-base font-mono tabular-nums font-bold text-slate-900">
                        {formatRupiah(checkoutTotals.subtotal - checkoutTotals.discountAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Kembali Pilih Menu
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="rounded-lg bg-emerald-700 hover:bg-emerald-800 px-5 py-2.5 text-xs font-semibold text-white transition-colors"
                    >
                      Lanjut ke Langkah 3: Data Pemesan
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* LANGKAH 3: DATA PEMESAN (TANPA LOGIN / USERNAME / PASSWORD) */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <User className="h-4 w-4 text-emerald-700" />
                  <span>Langkah 3 — Informasi Data Pemesan (Tanpa Perlu Akun)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cukup lengkapi informasi pengiriman di bawah ini. Nomor WhatsApp akan digunakan untuk konfirmasi dan pelacakan pesanan.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="guest-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Lengkap Pemesan / Instansi *
                  </label>
                  <input
                    id="guest-name"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Contoh: Budi Santoso / PT Nusantara Jaya"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label htmlFor="guest-wa" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor WhatsApp Aktif *
                  </label>
                  <input
                    id="guest-wa"
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="Contoh: 081288990011"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label htmlFor="guest-date" className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Pengiriman / Acara *
                  </label>
                  <input
                    id="guest-date"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label htmlFor="guest-time" className="block text-xs font-semibold text-slate-700 mb-1">
                    Jam Pengiriman Tiba di Lokasi *
                  </label>
                  <select
                    id="guest-time"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                  >
                    <option value="07:30 WIB">07:30 WIB (Pagi / Sarapan)</option>
                    <option value="10:00 WIB">10:00 WIB (Coffee Break / Pra-Makan Siang)</option>
                    <option value="11:30 WIB">11:30 WIB (Makan Siang Tepat Waktu)</option>
                    <option value="15:30 WIB">15:30 WIB (Sore / Acara Sore)</option>
                    <option value="18:30 WIB">18:30 WIB (Makan Malam / Gala Dinner)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="guest-address" className="block text-xs font-semibold text-slate-700 mb-1">
                    Alamat Pengiriman Lengkap *
                  </label>
                  <input
                    id="guest-address"
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Nama jalan, nomor gedung, lantai/ruangan, kecamatan, kota..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="guest-notes" className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan Tambahan (Opsional)
                  </label>
                  <input
                    id="guest-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Sambal dipisah, hubungi PIC Bapak Andi setibanya di lobi..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Kembali ke Keranjang
                </button>
                <button
                  type="button"
                  onClick={handleProceedFromStep3}
                  className="rounded-lg bg-emerald-700 hover:bg-emerald-800 px-5 py-2.5 text-xs font-semibold text-white transition-colors"
                >
                  Lanjut ke Langkah 4: Pilih Pengiriman
                </button>
              </div>
            </div>
          )}

          {/* LANGKAH 4: PILIH PENGIRIMAN & PETA LOKASI */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-emerald-700" />
                  <span>Langkah 4 — Pilih Metode Pengiriman & Titik Lokasi</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pilih pengantaran ke alamat tujuan atau ambil langsung di lokasi Dapur Sentral kami.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('Pengiriman ke alamat')}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    deliveryMethod === 'Pengiriman ke alamat'
                      ? 'border-emerald-600 bg-emerald-50/70'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      1. Pengiriman ke Alamat Tujuan
                    </span>
                    <span className="text-xs font-mono tabular-nums font-bold text-emerald-700">
                      {checkoutTotals.subtotal >= 10000000
                        ? 'GRATIS ONGKIR'
                        : formatRupiah(Math.min(150000, Math.max(25000, distanceKm * 5000)))}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Diantar oleh armada blindvan berpendingin Smart Catering langsung ke lokasi acara/kantor Anda.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryMethod('Ambil sendiri di lokasi dapur')}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    deliveryMethod === 'Ambil sendiri di lokasi dapur'
                      ? 'border-emerald-600 bg-emerald-50/70'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      2. Ambil Sendiri di Lokasi Dapur
                    </span>
                    <span className="text-xs font-mono tabular-nums font-bold text-emerald-700">
                      Rp 0 (Gratis)
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Ambil pesanan di Dapur Sentral Smart Catering: Jl. Proklamasi No. 42, Menteng, Jakarta Pusat.
                  </p>
                </button>
              </div>

              {deliveryMethod === 'Pengiriman ke alamat' ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                        <span>Tentukan Lokasi Pengiriman Melalui Peta atau Area</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Klik area di bawah atau sesuaikan titik koordinat dan alamat manual Anda.
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-600">
                      Koordinat: {locationLat.toFixed(4)}, {locationLng.toFixed(4)}
                    </span>
                  </div>

                  {/* Quick Area Buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {JAKARTA_PRESET_LOCATIONS.map((loc) => (
                      <button
                        key={loc.label}
                        type="button"
                        onClick={() => {
                          setLocationLat(loc.lat);
                          setLocationLng(loc.lng);
                          setDistanceKm(loc.distanceKm);
                          if (!deliveryAddress.trim()) {
                            setDeliveryAddress(loc.sampleAddress);
                          }
                        }}
                        className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors"
                      >
                        {loc.label}
                      </button>
                    ))}
                  </div>

                  {/* Interactive Google Map */}
                  <div className="h-56 w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                    {MAPS_API_KEY ? (
                      <APIProvider apiKey={MAPS_API_KEY} language="id" region="ID">
                        <GoogleMap
                          mapId="DEMO_MAP_ID"
                          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                          defaultCenter={{ lat: locationLat, lng: locationLng }}
                          center={{ lat: locationLat, lng: locationLng }}
                          defaultZoom={13}
                          gestureHandling="greedy"
                          onClick={(ev) => {
                            if (ev.detail?.latLng) {
                              setLocationLat(ev.detail.latLng.lat);
                              setLocationLng(ev.detail.latLng.lng);
                            }
                          }}
                          className="w-full h-full"
                        >
                          <AdvancedMarker position={{ lat: locationLat, lng: locationLng }}>
                            <Pin
                              background="#047857"
                              borderColor="#064e3b"
                              glyphColor="#fbbf24"
                            />
                          </AdvancedMarker>
                        </GoogleMap>
                      </APIProvider>
                    ) : (
                      <div className="h-full w-full flex items-center justify-center p-4 text-xs text-slate-600">
                        Titik Koordinat Pengiriman: {locationLat.toFixed(4)}, {locationLng.toFixed(4)}
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="step4-address" className="block text-xs font-semibold text-slate-700 mb-1">
                      Detail Alamat Pengiriman Manual
                    </label>
                    <input
                      id="step4-address"
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs space-y-1.5">
                  <p className="font-bold text-emerald-950">
                    Lokasi Pengambilan Sendiri (Dapur Sentral Smart Catering)
                  </p>
                  <p className="text-slate-700">
                    Jl. Proklamasi No. 42, Menteng, Jakarta Pusat 10320 · Buka setiap hari pukul 06:00 – 20:00 WIB.
                  </p>
                  <p className="text-slate-600">
                    Tunjukkan Nomor Pesanan Anda kepada petugas logistik dapur saat pengambilan.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Kembali ke Data Pemesan
                </button>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="rounded-lg bg-emerald-700 hover:bg-emerald-800 px-5 py-2.5 text-xs font-semibold text-white transition-colors"
                >
                  Lanjut ke Langkah 5: Pembayaran
                </button>
              </div>
            </div>
          )}

          {/* LANGKAH 5: PEMBAYARAN */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-700" />
                  <span>Langkah 5 — Rincian Biaya & Pilihan Metode Pembayaran</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pilih metode pembayaran resmi yang tersedia di bawah ini.
                </p>
              </div>

              {/* Cost Breakdown */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-slate-700">
                  <span>Total Pesanan Makanan ({checkoutTotals.totalPortions} Porsi)</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {formatRupiah(checkoutTotals.subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>Biaya Pengiriman ({deliveryMethod})</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {checkoutTotals.shippingCost === 0
                      ? 'Rp 0 (Gratis)'
                      : formatRupiah(checkoutTotals.shippingCost)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-emerald-700">
                  <span>
                    Diskon Promo {appliedPromo ? `(${appliedPromo.promoCode})` : ''}
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    - {formatRupiah(checkoutTotals.discountAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 text-sm font-bold text-slate-900">
                  <span>Total Pembayaran Bersih</span>
                  <span className="font-mono tabular-nums text-base text-emerald-800">
                    {formatRupiah(checkoutTotals.grandTotal)}
                  </span>
                </div>
              </div>

              {/* Configured Payment Methods */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Transfer Bank')}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    paymentMethod === 'Transfer Bank'
                      ? 'border-emerald-600 bg-emerald-50/70'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                    <Building2 className="h-4 w-4 text-emerald-700" />
                    <span>Transfer Bank</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1.5">
                    Rekening Korporat Bank Mandiri & BCA a.n. PT Smart Catering Nusantara.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('QRIS')}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    paymentMethod === 'QRIS'
                      ? 'border-emerald-600 bg-emerald-50/70'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                    <QrCode className="h-4 w-4 text-emerald-700" />
                    <span>QRIS Terintegrasi</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1.5">
                    Scan kode QRIS Nasional melalui aplikasi M-Banking atau dompet digital.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('Pembayaran Tunai')}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    paymentMethod === 'Pembayaran Tunai'
                      ? 'border-emerald-600 bg-emerald-50/70'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                    <Wallet className="h-4 w-4 text-emerald-700" />
                    <span>Pembayaran Tunai</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1.5">
                    Bayar tunai di kasir Dapur Sentral atau saat pesanan tiba di lokasi.
                  </p>
                </button>
              </div>

              {/* Payment Instructions Box */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs space-y-2">
                {paymentMethod === 'Transfer Bank' && (
                  <>
                    <p className="font-bold text-slate-900">
                      Informasi Rekening Resmi PT Smart Catering Nusantara:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                        <span className="text-slate-500 block">Bank Mandiri Corporate</span>
                        <span className="font-mono font-bold text-sm text-slate-900">
                          124-00-9882716-3
                        </span>
                        <span className="block text-[11px] text-slate-600">
                          a.n. PT Smart Catering Nusantara
                        </span>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                        <span className="text-slate-500 block">Bank BCA Corporate</span>
                        <span className="font-mono font-bold text-sm text-slate-900">
                          542-099-8812
                        </span>
                        <span className="block text-[11px] text-slate-600">
                          a.n. PT Smart Catering Nusantara
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {paymentMethod === 'QRIS' && (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="h-28 w-28 rounded-lg border-2 border-slate-900 bg-slate-50 flex flex-col items-center justify-center p-2 shrink-0">
                      <QrCode className="h-16 w-16 text-slate-900" />
                      <span className="text-[10px] font-mono font-bold text-slate-700">
                        QRIS GPN
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900">
                        Merchant: SMART CATERING NUSANTARA (NMID: ID1026098827163)
                      </p>
                      <p className="text-slate-600">
                        Nominal otomatis tertera sebesar{' '}
                        <span className="font-mono font-bold text-slate-900">
                          {formatRupiah(checkoutTotals.grandTotal)}
                        </span>
                        . Simpan bukti bayar untuk dikonfirmasi melalui WhatsApp pada langkah berikutnya.
                      </p>
                    </div>
                  </div>
                )}

                {paymentMethod === 'Pembayaran Tunai' && (
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900">
                      Ketentuan Pembayaran Tunai (Diizinkan Admin):
                    </p>
                    <p className="text-slate-600">
                      Tim admin kami akan menghubungi nomor WhatsApp Anda ({whatsapp}) untuk verifikasi jadwal pengantaran dan kuitansi pembayaran tunai resmi.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Kembali ke Pengiriman
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleFinalSubmitOrder}
                  className="rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-400 px-6 py-2.5 text-xs font-semibold text-white transition-colors"
                >
                  {submitting
                    ? 'Menyimpan Pesanan ke Cloud Database...'
                    : 'Kirim & Konfirmasi Pesanan Sekarang'}
                </button>
              </div>
            </div>
          )}

          {/* LANGKAH 6: KONFIRMASI PESANAN BERHASIL */}
          {step === 6 && confirmedOrder && (
            <div className="space-y-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-5 text-center space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Pesanan Anda Berhasil Dibuat & Tersimpan!
                </h3>
                <p className="text-xs text-slate-600 max-w-xl mx-auto">
                  Simpan Nomor Pesanan unik di bawah ini untuk melacak status produksi dapur dan pengiriman tanpa perlu login.
                </p>
                <div className="pt-2">
                  <span className="inline-block rounded-lg border border-emerald-300 bg-white px-4 py-2 font-mono tabular-nums text-base font-bold text-emerald-900">
                    Nomor Pesanan: {confirmedOrder.orderNumber}
                  </span>
                </div>
              </div>

              {/* Order Summary Details */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <span className="font-bold text-slate-900">Rincian Pesanan Anda</span>
                  <span className="text-slate-500">
                    Tanggal Pesan: {formatTanggalIndonesia(confirmedOrder.orderDate)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500 block">Nama Pemesan:</span>
                    <span className="font-bold text-slate-900">{confirmedOrder.customerName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nomor WhatsApp Pelacakan:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {confirmedOrder.whatsapp}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Jadwal & Metode Pengiriman:</span>
                    <span className="font-semibold text-slate-900">
                      {formatTanggalIndonesia(confirmedOrder.deliveryDate)} ·{' '}
                      {confirmedOrder.deliveryTime || '10:00 WIB'} ({confirmedOrder.deliveryMethod})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Metode & Total Pembayaran:</span>
                    <span className="font-mono tabular-nums font-bold text-emerald-700">
                      {confirmedOrder.paymentMethod} — {formatRupiah(confirmedOrder.totalPayment)}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-2.5">
                  <span className="text-slate-500 block mb-1.5">Daftar Hidangan Dipesan:</span>
                  <div className="space-y-1">
                    {(confirmedOrder.items || []).map((it) => (
                      <div key={it.menuId} className="flex items-center justify-between text-slate-700">
                        <span>
                          {it.name} ({it.quantity} porsi)
                        </span>
                        <span className="font-mono tabular-nums font-semibold">
                          {formatRupiah(it.unitPrice * it.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Business WhatsApp & Confirmation Button */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs">
                <div>
                  <p className="font-bold text-slate-900">
                    Layanan Konfirmasi WhatsApp Smart Catering
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    Nomor WhatsApp Usaha Resmi:{' '}
                    <span className="font-mono font-bold text-slate-900">
                      {BUSINESS_WHATSAPP_DISPLAY}
                    </span>
                  </p>
                  {waSentNotice && (
                    <p className="text-emerald-800 font-semibold mt-1">
                      Format pesan konfirmasi WhatsApp untuk pesanan {confirmedOrder.orderNumber} telah disiapkan!
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <a
                    href={`https://wa.me/${BUSINESS_WHATSAPP_E164}?text=${encodeURIComponent(
                      `Halo Admin Smart Catering, saya ingin konfirmasi pesanan *${confirmedOrder.orderNumber}* atas nama *${confirmedOrder.customerName}* (${confirmedOrder.portions} porsi - Total ${formatRupiah(confirmedOrder.totalPayment)}).`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setWaSentNotice(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Konfirmasi melalui WhatsApp</span>
                  </a>

                  <button
                    type="button"
                    onClick={() =>
                      onTrackOrderNow(confirmedOrder.orderNumber, confirmedOrder.whatsapp)
                    }
                    className="rounded-lg bg-slate-900 hover:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
                  >
                    Lacak Status Pesanan Ini
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
