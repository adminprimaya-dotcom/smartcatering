import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  QrCode,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
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
  SiteContentSettings,
} from '../types/erp';
import { DEFAULT_SITE_SETTINGS } from '../data/seedData';
import {
  calculateGuestCartCheckout,
  formatRupiah,
  formatTanggalIndonesia,
  generateOrderNumber,
  normalizeWhatsappNumber,
} from '../utils/calculations';

function buildQrisMatrix(seedText: string): boolean[][] {
  const size = 25;
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const drawFinder = (startR: number, startC: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[startR + r][startC + c] = isBorder || isCenter;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      const onTiming = r === 6 || c === 6;
      if (inTopLeft || inTopRight || inBottomLeft || onTiming) continue;

      hash ^= (r + 1) * 31 + (c + 1) * 17;
      hash = Math.imul(hash, 16777619);
      grid[r][c] = (hash >>> 0) % 10 < 5;
    }
  }

  return grid;
}

const QrisCodeGraphic: React.FC<{
  imageUrl?: string;
  merchantName: string;
  nmid: string;
  sizeClassName?: string;
}> = ({ imageUrl, merchantName, nmid, sizeClassName = 'w-64 h-64' }) => {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={`QRIS ${merchantName}`}
        referrerPolicy="no-referrer"
        className={`${sizeClassName} object-contain rounded-lg bg-white`}
      />
    );
  }

  const matrix = buildQrisMatrix(`${merchantName}|${nmid}`);
  return (
    <svg
      viewBox="0 0 25 25"
      role="img"
      aria-label={`Kode QRIS ${merchantName}`}
      className={`${sizeClassName} bg-white`}
      shapeRendering="crispEdges"
    >
      <rect width="25" height="25" fill="#ffffff" />
      {matrix.map((row, r) =>
        row.map((dark, c) =>
          dark ? <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#0f172a" /> : null
        )
      )}
    </svg>
  );
};

interface CustomerCheckoutModalProps {
  isOpen: boolean;
  initialStep?: 1 | 2 | 3 | 4 | 5 | 6;
  cart: CartOrderItem[];
  orders?: CateringOrder[];
  availableMenus: MenuItem[];
  promotions: PromotionItem[];
  existingOrdersCount: number;
  initialPromoCode?: string;
  siteSettings?: SiteContentSettings;
  onClose: () => void;
  onUpdateCartQuantity: (menuId: string, quantity: number) => void;
  onRemoveCartItem: (menuId: string) => void;
  onAddMenuToCart: (menu: MenuItem, quantity: number) => void;
  onClearCart: () => void;
  onSubmitCustomerOrder: (order: CateringOrder) => Promise<CateringOrder>;
  onConfirmCustomerPayment?: (order: CateringOrder, verifiedBy?: string) => Promise<void>;
  onTrackOrderNow: (orderNumber: string, whatsapp: string) => void;
}

export const CustomerCheckoutModal: React.FC<CustomerCheckoutModalProps> = ({
  isOpen,
  cart,
  orders = [],
  availableMenus,
  promotions,
  existingOrdersCount,
  initialPromoCode = '',
  siteSettings = DEFAULT_SITE_SETTINGS,
  onClose,
  onUpdateCartQuantity,
  onRemoveCartItem,
  onAddMenuToCart,
  onClearCart,
  onSubmitCustomerOrder,
  onConfirmCustomerPayment,
  onTrackOrderNow,
}) => {
  const [showAddMenuPicker, setShowAddMenuPicker] = useState(false);

  // Promo state
  const [promoInput, setPromoInput] = useState(initialPromoCode);
  const [appliedPromo, setAppliedPromo] = useState<PromotionItem | null>(null);
  const [promoFeedback, setPromoFeedback] = useState('');

  // Simple 1-Page Form State
  const [customerName, setCustomerName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('2026-11-18');
  const [deliveryTime, setDeliveryTime] = useState('10:00 WIB');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethodType>('Pengiriman ke alamat');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('Transfer Bank');

  // Confirmation & Feedback State
  const [confirmedOrder, setConfirmedOrder] = useState<CateringOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingQrisPayment, setConfirmingQrisPayment] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [qrisModalOpen, setQrisModalOpen] = useState(false);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);

  const businessWaE164 = (siteSettings.whatsappNumber || '628119823401').replace(/\D/g, '') || '628119823401';
  const businessWaDisplay = siteSettings.whatsappDisplay || '0811-9823-401';

  useEffect(() => {
    if (isOpen) {
      setConfirmedOrder(null);
      setErrorMessage('');
      setQrisModalOpen(false);
      setConfirmingQrisPayment(false);
      setShowAddMenuPicker(cart.length === 0);
      if (initialPromoCode) {
        const cleanCode = initialPromoCode.trim().toUpperCase();
        setPromoInput(cleanCode);
        const found = promotions.find(
          (p) => p.active && p.promoCode.trim().toUpperCase() === cleanCode
        );
        if (found) {
          setAppliedPromo(found);
          setPromoFeedback(`Promo ${found.promoCode} aktif (-${found.discountPercent}%).`);
        }
      }
    }
    // Only reset when modal opens/closes so clearing cart on submit keeps receipt & QRIS open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Sync live payment status: if Admin/backend marks order as Lunas, close & hide QRIS code immediately
  useEffect(() => {
    if (!isOpen || !confirmedOrder || confirmedOrder.paymentStatus === 'Lunas') return;

    const liveOrder = orders.find(
      (o) => o.id === confirmedOrder.id || o.orderNumber === confirmedOrder.orderNumber
    );
    if (liveOrder && liveOrder.paymentStatus === 'Lunas') {
      setConfirmedOrder(liveOrder);
      setQrisModalOpen(false);
      bodyScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (confirmedOrder.paymentMethod !== 'QRIS') return;

    let active = true;
    const pollOrderPaidStatus = async () => {
      try {
        const res = await fetch('/api/public/orders/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber: confirmedOrder.orderNumber,
            whatsapp: confirmedOrder.whatsapp,
          }),
        });
        if (!active || !res.ok) return;
        const data = await res.json();
        if (data?.tracking?.paymentStatus === 'Lunas') {
          setConfirmedOrder((prev) =>
            prev
              ? {
                  ...prev,
                  paymentStatus: 'Lunas',
                  downPayment: prev.totalPayment,
                  remainingBalance: 0,
                  status: 'Diproses',
                }
              : prev
          );
          setQrisModalOpen(false);
          bodyScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } catch {
        // Ignore transient network poll errors
      }
    };

    const intervalId = setInterval(pollOrderPaidStatus, 4000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [isOpen, confirmedOrder, orders]);

  if (!isOpen) return null;

  const checkoutTotals = calculateGuestCartCheckout({
    items: cart,
    promo: appliedPromo,
    deliveryMethod,
    distanceKm: 5,
  });

  const handleCopy = (key: string, text: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const handleConfirmQrisSuccess = async () => {
    if (!confirmedOrder || confirmingQrisPayment) return;
    setConfirmingQrisPayment(true);
    try {
      if (onConfirmCustomerPayment) {
        await onConfirmCustomerPayment(confirmedOrder, 'Pembayaran QRIS Berhasil');
      } else {
        await fetch('/api/orders/confirm-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: confirmedOrder.id,
            orderNumber: confirmedOrder.orderNumber,
            customerName: confirmedOrder.customerName,
            whatsapp: confirmedOrder.whatsapp,
            amount: confirmedOrder.totalPayment,
            paymentMethod: 'QRIS',
            verifiedBy: 'Pembayaran QRIS Berhasil',
            note: `Pembayaran QRIS pesanan ${confirmedOrder.orderNumber} berhasil dibayar & masuk ke notifikasi Admin.`,
          }),
        });
      }
      setConfirmedOrder((prev) =>
        prev
          ? {
              ...prev,
              paymentStatus: 'Lunas',
              downPayment: prev.totalPayment,
              remainingBalance: 0,
              status:
                prev.status === 'Pesanan baru' || prev.status === 'Menunggu pembayaran'
                  ? 'Diproses'
                  : prev.status,
            }
          : prev
      );
      setQrisModalOpen(false);
      bodyScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setErrorMessage('Gagal mengonfirmasi pembayaran QRIS. Silakan coba lagi.');
    } finally {
      setConfirmingQrisPayment(false);
    }
  };

  const handleApplyPromo = (codeToApply?: string) => {
    const code = (codeToApply ?? promoInput).trim().toUpperCase();
    setPromoInput(code);
    if (!code) {
      setAppliedPromo(null);
      setPromoFeedback('');
      return;
    }
    const found = promotions.find(
      (p) => p.active && p.promoCode.trim().toUpperCase() === code
    );
    if (found) {
      setAppliedPromo(found);
      setPromoFeedback(
        `Promo ${found.promoCode} terpasang (Diskon ${found.discountPercent}%, maks. ${formatRupiah(
          found.maxDiscountAmount
        )}).`
      );
    } else {
      setAppliedPromo(null);
      setPromoFeedback('Kode promo tidak ditemukan atau sudah tidak berlaku.');
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (cart.length === 0) {
      setErrorMessage('Pilih minimal 1 menu makanan terlebih dahulu.');
      setShowAddMenuPicker(true);
      return;
    }
    if (!customerName.trim()) {
      setErrorMessage('Mohon isi nama pemesan atau nama instansi.');
      return;
    }
    if (normalizeWhatsappNumber(whatsapp).length < 8) {
      setErrorMessage('Mohon isi nomor WhatsApp yang aktif (contoh: 0812xxxxxxxx).');
      return;
    }
    if (!deliveryDate) {
      setErrorMessage('Mohon pilih tanggal pengiriman.');
      return;
    }
    if (deliveryMethod === 'Pengiriman ke alamat' && !deliveryAddress.trim()) {
      setErrorMessage('Mohon isi alamat pengiriman lengkap.');
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
          ? `Ambil Sendiri di Dapur (${siteSettings.companyAddress})`
          : deliveryAddress.trim();

      const combinedNotes = [
        `${deliveryMethod} · ${deliveryTime}`,
        `Alamat: ${finalAddress}`,
        `Bayar: ${paymentMethod}`,
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
        locationLat: -6.2088,
        locationLng: 106.8456,
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
      const finalOrder = savedOrder || newOrderPayload;
      setConfirmedOrder(finalOrder);
      onClearCart();
      if (finalOrder.paymentMethod === 'QRIS') {
        setQrisModalOpen(true);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal mengirim pesanan. Silakan coba lagi.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 sm:p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="simple-checkout-title"
    >
      <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Singkat & Jelas */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-white shrink-0">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="simple-checkout-title"
                className="text-base font-bold text-slate-900 truncate"
              >
                {confirmedOrder
                  ? confirmedOrder.paymentStatus === 'Lunas'
                    ? 'Pembayaran Berhasil'
                    : 'Pesanan Berhasil Dikirim'
                  : 'Form Pemesanan Cepat'}
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {confirmedOrder
                  ? confirmedOrder.paymentStatus === 'Lunas'
                    ? `Nomor Pesanan: ${confirmedOrder.orderNumber} · Status: Lunas`
                    : `Nomor Pesanan: ${confirmedOrder.orderNumber}`
                  : 'Tanpa perlu akun atau login · Cukup 1 halaman selesai'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form pemesanan"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div ref={bodyScrollRef} className="p-5 overflow-y-auto flex-1">
          {confirmedOrder ? (
            /* TAMPILAN KONFIRMASI PESANAN BERHASIL (BERSIH & JELAS) */
            <div className="max-w-2xl mx-auto space-y-5 py-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-6 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-700 text-white">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                {confirmedOrder.paymentStatus === 'Lunas' ? (
                  <>
                    <h3 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-emerald-900">
                      PEMBAYARAN BERHASIL
                    </h3>
                    <p className="text-xs sm:text-sm font-medium text-emerald-950 max-w-md mx-auto">
                      Pembayaran {confirmedOrder.paymentMethod} sebesar{' '}
                      <span className="font-mono font-bold">
                        {formatRupiah(confirmedOrder.totalPayment)}
                      </span>{' '}
                      telah dinyatakan berhasil &amp; Lunas. Notifikasi otomatis dikirim ke Admin dan pesanan langsung diproses.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-extrabold text-slate-900">
                      Terima kasih, pesanan Anda sudah tercatat!
                    </h3>
                    <p className="text-xs text-slate-600">
                      Simpan Nomor Pesanan di bawah ini untuk memantau status dapur &amp; pengiriman kapan saja.
                    </p>
                  </>
                )}

                <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2.5">
                  <span className="font-mono tabular-nums text-base font-extrabold text-emerald-900">
                    {confirmedOrder.orderNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('orderNo', confirmedOrder.orderNumber)}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors"
                  >
                    {copiedKey === 'orderNo' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-700" />
                        <span>Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Salin</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Ringkasan Singkat Pesanan */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-slate-500 block">Nama Pemesan</span>
                    <span className="font-bold text-slate-900">{confirmedOrder.customerName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nomor WhatsApp</span>
                    <span className="font-mono font-bold text-slate-900">
                      {confirmedOrder.whatsapp}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Jadwal & Penerimaan</span>
                    <span className="font-semibold text-slate-900">
                      {formatTanggalIndonesia(confirmedOrder.deliveryDate)} ·{' '}
                      {confirmedOrder.deliveryTime || '10:00 WIB'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Total Tagihan ({confirmedOrder.paymentMethod})</span>
                    <span className="font-mono tabular-nums text-sm font-extrabold text-emerald-700">
                      {formatRupiah(confirmedOrder.totalPayment)}
                    </span>
                  </div>
                </div>

                {/* Daftar Menu */}
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-900 block">
                    Menu Dipesan ({confirmedOrder.portions} Porsi)
                  </span>
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

                {/* Info Rekening Singkat jika Transfer Bank atau QRIS */}
                {confirmedOrder.paymentMethod === 'Transfer Bank' && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1.5">
                    <span className="font-bold text-slate-900 block">
                      Rekening Tujuan Pembayaran:
                    </span>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-slate-600">{siteSettings.bankName} — </span>
                        <span className="font-mono font-bold text-slate-900">
                          {siteSettings.bankAccountNumber}
                        </span>
                        <span className="text-slate-600"> a.n. {siteSettings.bankAccountHolder}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy('rekConfirm', siteSettings.bankAccountNumber)}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        {copiedKey === 'rekConfirm' ? 'Tersalin' : 'Salin Rekening'}
                      </button>
                    </div>
                  </div>
                )}

                {confirmedOrder.paymentMethod === 'QRIS' &&
                  (confirmedOrder.paymentStatus === 'Lunas' ? (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 flex items-center gap-3 text-emerald-950">
                      <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0" />
                      <div>
                        <span className="font-extrabold uppercase tracking-tight text-emerald-900 block">
                          PEMBAYARAN BERHASIL (QRIS Lunas)
                        </span>
                        <span className="text-[11px] text-emerald-800 block mt-0.5">
                          Pembayaran QRIS berhasil diterima. Kode QRIS otomatis dihilangkan dan notifikasi telah masuk ke Admin.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col items-center text-center space-y-3">
                      <div>
                        <span className="font-bold text-slate-900 block">
                          Pembayaran QRIS: {siteSettings.qrisMerchantName}
                        </span>
                        <span className="font-mono text-[11px] text-slate-600">
                          NMID: {siteSettings.qrisNmid}
                        </span>
                      </div>
                      <div className="rounded-xl border-2 border-slate-900 bg-white p-3">
                        <QrisCodeGraphic
                          imageUrl={siteSettings.qrisImageUrl}
                          merchantName={siteSettings.qrisMerchantName}
                          nmid={siteSettings.qrisNmid}
                          sizeClassName="w-52 h-52 sm:w-56 sm:h-56"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQrisModalOpen(true)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
                        >
                          <QrCode className="h-4 w-4" />
                          <span>Perbesar Kode QRIS</span>
                        </button>
                        <button
                          type="button"
                          disabled={confirmingQrisPayment}
                          onClick={handleConfirmQrisSuccess}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-400 px-3.5 py-2 text-xs font-bold text-white transition-colors"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>
                            {confirmingQrisPayment
                              ? 'Mengirim Notifikasi...'
                              : 'Pembayaran QRIS Berhasil'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Aksi Selanjutnya */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                <a
                  href={`https://wa.me/${businessWaE164}?text=${encodeURIComponent(
                    `Halo ${siteSettings.brandName}, saya konfirmasi pesanan *${confirmedOrder.orderNumber}* atas nama *${confirmedOrder.customerName}* (${confirmedOrder.portions} porsi, Total ${formatRupiah(confirmedOrder.totalPayment)}).`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-5 py-3 text-xs font-bold text-white transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Konfirmasi ke WhatsApp ({businessWaDisplay})</span>
                </a>
                <button
                  type="button"
                  onClick={() =>
                    onTrackOrderNow(confirmedOrder.orderNumber, confirmedOrder.whatsapp)
                  }
                  className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-5 py-3 text-xs font-bold text-slate-800 transition-colors"
                >
                  Cek Status Pesanan Ini
                </button>
              </div>
            </div>
          ) : (
            /* FORM PEMESANAN 1 HALAMAN (SIMPEL & JELAS) */
            <form onSubmit={handleSubmitOrder} className="space-y-5">
              {errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">
                  {errorMessage}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* KOLOM KIRI: MENU DIPILIH & PROMO */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">
                      1. Menu yang Dipesan
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddMenuPicker((prev) => !prev)}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
                    >
                      {showAddMenuPicker ? 'Tutup Daftar Menu' : '+ Tambah Menu'}
                    </button>
                  </div>

                  {/* Quick Menu Picker saat kosong atau klik + Tambah Menu */}
                  {showAddMenuPicker && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 max-h-56 overflow-y-auto">
                      <p className="text-[11px] font-semibold text-slate-600">
                        Klik untuk menambahkan menu (20 porsi):
                      </p>
                      {availableMenus.map((menu) => (
                        <div
                          key={menu.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{menu.name}</p>
                            <p className="text-[11px] font-mono tabular-nums text-emerald-700 font-semibold">
                              {formatRupiah(menu.sellingPrice)} / porsi
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onAddMenuToCart(menu, 20)}
                            className="rounded-md bg-emerald-700 hover:bg-emerald-800 px-2.5 py-1.5 text-[11px] font-semibold text-white whitespace-nowrap shrink-0"
                          >
                            + Pilih
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Daftar Keranjang */}
                  {cart.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center space-y-2">
                      <p className="text-xs font-semibold text-slate-700">
                        Belum ada menu yang dipilih.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowAddMenuPicker(true)}
                        className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                      >
                        Pilih Menu Sekarang
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                      {cart.map((item) => (
                        <div key={item.menuId} className="p-3.5 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                referrerPolicy="no-referrer"
                                className="h-11 w-12 rounded-lg object-cover bg-slate-100 shrink-0"
                              />
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-slate-900 truncate">
                                  {item.name}
                                </h4>
                                <p className="text-[11px] font-mono tabular-nums text-slate-500">
                                  {formatRupiah(item.unitPrice)} / porsi
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              aria-label={`Hapus ${item.name}`}
                              onClick={() => onRemoveCartItem(item.menuId)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded-md"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                aria-label={`Kurangi porsi ${item.name}`}
                                onClick={() =>
                                  onUpdateCartQuantity(item.menuId, Math.max(1, item.quantity - 5))
                                }
                                className="h-7 w-7 rounded-md border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                aria-label={`Porsi ${item.name}`}
                                value={item.quantity}
                                onChange={(e) =>
                                  onUpdateCartQuantity(
                                    item.menuId,
                                    Math.max(1, Number(e.target.value) || 1)
                                  )
                                }
                                className="w-16 rounded-md border border-slate-300 py-1 text-center text-xs font-mono tabular-nums font-bold text-slate-900"
                              />
                              <button
                                type="button"
                                aria-label={`Tambah porsi ${item.name}`}
                                onClick={() => onUpdateCartQuantity(item.menuId, item.quantity + 5)}
                                className="h-7 w-7 rounded-md border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                              <span className="text-[11px] text-slate-500 ml-1">porsi</span>
                            </div>

                            <span className="text-xs font-mono tabular-nums font-bold text-slate-900">
                              {formatRupiah(item.unitPrice * item.quantity)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Promo Opsional Ringkas */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                    <label
                      htmlFor="simple-promo-code"
                      className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                    >
                      <Tag className="h-3.5 w-3.5 text-emerald-700" />
                      <span>Punya Kode Promo? (Opsional)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="simple-promo-code"
                        type="text"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                        placeholder="Masukkan kode promo"
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono uppercase text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyPromo()}
                        className="rounded-lg bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0"
                      >
                        Pakai
                      </button>
                    </div>
                    {promotions.some((p) => p.active) && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {promotions
                          .filter((p) => p.active)
                          .slice(0, 3)
                          .map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleApplyPromo(p.promoCode)}
                              className={`rounded-md border px-2 py-1 text-[11px] font-mono font-semibold transition-colors ${
                                appliedPromo?.id === p.id
                                  ? 'border-emerald-600 bg-emerald-700 text-white'
                                  : 'border-slate-300 bg-white text-slate-700 hover:bg-emerald-50'
                              }`}
                            >
                              {p.promoCode} (-{p.discountPercent}%)
                            </button>
                          ))}
                      </div>
                    )}
                    {promoFeedback && (
                      <p className="text-[11px] font-medium text-emerald-800">{promoFeedback}</p>
                    )}
                  </div>
                </div>

                {/* KOLOM KANAN: DATA PEMESAN & PEMBAYARAN */}
                <div className="lg:col-span-7 space-y-5">
                  {/* Bagian 2: Data Singkat */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      2. Isi Data Pemesan & Pengiriman
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="simple-name"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Nama Lengkap / Instansi *
                        </label>
                        <input
                          id="simple-name"
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Contoh: Ibu Rina / PT Maju Jaya"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="simple-wa"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Nomor WhatsApp Aktif *
                        </label>
                        <input
                          id="simple-wa"
                          type="tel"
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(e.target.value)}
                          placeholder="Contoh: 081234567890"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="simple-date"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Tanggal Acara / Kirim *
                        </label>
                        <input
                          id="simple-date"
                          type="date"
                          value={deliveryDate}
                          onChange={(e) => setDeliveryDate(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="simple-time"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Jam Tiba *
                        </label>
                        <select
                          id="simple-time"
                          value={deliveryTime}
                          onChange={(e) => setDeliveryTime(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                        >
                          <option value="07:30 WIB">07:30 WIB (Pagi)</option>
                          <option value="10:00 WIB">10:00 WIB (Sebelum Siang)</option>
                          <option value="11:30 WIB">11:30 WIB (Makan Siang)</option>
                          <option value="15:30 WIB">15:30 WIB (Sore)</option>
                          <option value="18:30 WIB">18:30 WIB (Malam)</option>
                        </select>
                      </div>
                    </div>

                    {/* Cara Terima Pesanan */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setDeliveryMethod('Pengiriman ke alamat')}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                          deliveryMethod === 'Pengiriman ke alamat'
                            ? 'border-emerald-700 bg-emerald-50 text-emerald-950'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Truck className="h-4 w-4 text-emerald-700 shrink-0" />
                        <span>Diantar ke Alamat</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryMethod('Ambil sendiri di lokasi dapur')}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                          deliveryMethod === 'Ambil sendiri di lokasi dapur'
                            ? 'border-emerald-700 bg-emerald-50 text-emerald-950'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <MapPin className="h-4 w-4 text-emerald-700 shrink-0" />
                        <span>Ambil di Dapur (Gratis)</span>
                      </button>
                    </div>

                    {deliveryMethod === 'Pengiriman ke alamat' ? (
                      <div>
                        <label
                          htmlFor="simple-address"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Alamat Pengiriman Lengkap *
                        </label>
                        <input
                          id="simple-address"
                          type="text"
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          placeholder="Nama jalan, nomor rumah/gedung, patokan, kecamatan..."
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                        />
                      </div>
                    ) : (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3.5 py-2.5 text-xs text-slate-700">
                        Lokasi ambil: <span className="font-semibold text-slate-900">{siteSettings.companyAddress}</span>
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="simple-notes"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Catatan Tambahan (Opsional)
                      </label>
                      <input
                        id="simple-notes"
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Contoh: Sambal dipisah, hubungi satpam saat tiba..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Bagian 3: Metode Pembayaran */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900">
                      3. Pilih Cara Pembayaran
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Transfer Bank')}
                        className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors ${
                          paymentMethod === 'Transfer Bank'
                            ? 'border-emerald-700 bg-emerald-50 text-emerald-950'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Building2 className="h-4 w-4 text-emerald-700 shrink-0" />
                        <span>Transfer Bank</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('QRIS')}
                        className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors ${
                          paymentMethod === 'QRIS'
                            ? 'border-emerald-700 bg-emerald-50 text-emerald-950'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <QrCode className="h-4 w-4 text-emerald-700 shrink-0" />
                        <span>QRIS</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Pembayaran Tunai')}
                        className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors ${
                          paymentMethod === 'Pembayaran Tunai'
                            ? 'border-emerald-700 bg-emerald-50 text-emerald-950'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Wallet className="h-4 w-4 text-emerald-700 shrink-0" />
                        <span>Tunai / COD</span>
                      </button>
                    </div>
                  </div>

                  {/* Ringkasan Total & Tombol Kirim */}
                  <div className="rounded-xl border border-slate-200 bg-slate-900 text-white p-4 space-y-3">
                    <div className="space-y-1.5 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span>Menu ({checkoutTotals.totalPortions} porsi)</span>
                        <span className="font-mono tabular-nums">
                          {formatRupiah(checkoutTotals.subtotal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Ongkos Kirim</span>
                        <span className="font-mono tabular-nums">
                          {checkoutTotals.shippingCost === 0
                            ? 'Gratis'
                            : formatRupiah(checkoutTotals.shippingCost)}
                        </span>
                      </div>
                      {checkoutTotals.discountAmount > 0 && (
                        <div className="flex items-center justify-between text-emerald-400">
                          <span>Diskon Promo</span>
                          <span className="font-mono tabular-nums">
                            - {formatRupiah(checkoutTotals.discountAmount)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t border-slate-700 pt-2 text-sm font-bold text-white">
                        <span>Total Pembayaran</span>
                        <span className="font-mono tabular-nums text-base text-amber-300">
                          {formatRupiah(checkoutTotals.grandTotal)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || cart.length === 0}
                      className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 px-5 py-3 text-xs sm:text-sm font-bold text-white transition-colors"
                    >
                      {submitting ? 'Mengirim Pesanan...' : 'Kirim Pesanan Sekarang'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* POPUP KODE QRIS UKURAN BESAR (otomatis hilang saat pembayaran berhasil) */}
      {qrisModalOpen && (!confirmedOrder || confirmedOrder.paymentStatus !== 'Lunas') && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="large-qris-title"
          onClick={() => setQrisModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-3.5 text-white">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-emerald-400 shrink-0" />
                <div>
                  <h3 id="large-qris-title" className="text-sm font-bold leading-tight">
                    Scan Kode QRIS
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Pembayaran Nasional (GPN)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQrisModalOpen(false)}
                aria-label="Tutup tampilan QRIS besar"
                className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="space-y-0.5">
                <p className="text-sm font-extrabold text-slate-900 tracking-tight">
                  {siteSettings.qrisMerchantName}
                </p>
                <p className="text-xs font-mono text-slate-500">
                  NMID: {siteSettings.qrisNmid}
                </p>
              </div>

              <div className="rounded-2xl border-2 border-slate-900 bg-white p-4 shadow-xs">
                <QrisCodeGraphic
                  imageUrl={siteSettings.qrisImageUrl}
                  merchantName={siteSettings.qrisMerchantName}
                  nmid={siteSettings.qrisNmid}
                  sizeClassName="w-60 h-60 sm:w-64 sm:h-64"
                />
              </div>

              <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5">
                <span className="text-[11px] font-medium text-emerald-900 block">
                  Total Pembayaran
                </span>
                <span className="text-lg font-mono tabular-nums font-extrabold text-emerald-800">
                  {formatRupiah(
                    confirmedOrder ? confirmedOrder.totalPayment : checkoutTotals.grandTotal
                  )}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Arahkan kamera aplikasi M-Banking atau dompet digital Anda ke kode QRIS di atas. Setelah selesai bayar, tekan tombol konfirmasi di bawah.
              </p>

              <div className="w-full space-y-2">
                {confirmedOrder && (
                  <button
                    type="button"
                    disabled={confirmingQrisPayment}
                    onClick={handleConfirmQrisSuccess}
                    className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-400 px-5 py-3 text-xs sm:text-sm font-bold text-white transition-colors"
                  >
                    {confirmingQrisPayment
                      ? 'Mengirim Notifikasi ke Admin...'
                      : 'Pembayaran QRIS Berhasil'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setQrisModalOpen(false)}
                  className="w-full rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-5 py-2.5 text-xs font-semibold text-slate-700 transition-colors"
                >
                  Lihat Nomor Pesanan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
