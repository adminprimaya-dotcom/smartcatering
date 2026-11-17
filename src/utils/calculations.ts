import {
  CartOrderItem,
  CateringOrder,
  CustomerRecord,
  DeliveryMethodType,
  ErpStateSnapshot,
  FinanceEntry,
  InventoryItem,
  MenuItem,
  PaymentStatus,
  ProductionBatch,
  PromotionItem,
  SchoolDelivery,
  SchoolRecord,
} from '../types/erp';

export function formatRupiah(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeAmount);
}

export function formatTanggalIndonesia(dateStr: string): string {
  if (!dateStr) return '-';
  const parsed = new Date(`${dateStr}T00:00:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(parsed);
}

export function calculateMenuProfit(sellingPrice: number, costPrice: number): number {
  return Math.max(-1000000000, Math.round(sellingPrice) - Math.round(costPrice));
}

export function normalizeWhatsappNumber(rawPhone: string): string {
  const digitsOnly = (rawPhone || '').replace(/[^0-9]/g, '');
  if (!digitsOnly) return '';
  if (digitsOnly.startsWith('62')) {
    return `0${digitsOnly.slice(2)}`;
  }
  if (digitsOnly.startsWith('8')) {
    return `0${digitsOnly}`;
  }
  return digitsOnly;
}

export function validateOrderTrackingMatch(
  order: { orderNumber: string; whatsapp: string },
  inputOrderNumber: string,
  inputWhatsapp: string
): boolean {
  const cleanOrderNum = (inputOrderNumber || '').trim().toUpperCase();
  const targetOrderNum = (order.orderNumber || '').trim().toUpperCase();
  if (!cleanOrderNum || !targetOrderNum || cleanOrderNum !== targetOrderNum) {
    return false;
  }

  const normalizedInputPhone = normalizeWhatsappNumber(inputWhatsapp);
  const normalizedTargetPhone = normalizeWhatsappNumber(order.whatsapp);
  if (normalizedInputPhone.length < 7 || normalizedTargetPhone.length < 7) {
    return false;
  }
  return normalizedInputPhone === normalizedTargetPhone;
}

export function calculateGuestCartCheckout(params: {
  items: CartOrderItem[];
  promo?: PromotionItem | null;
  deliveryMethod: DeliveryMethodType;
  distanceKm?: number;
}): {
  totalPortions: number;
  subtotal: number;
  discountAmount: number;
  shippingCost: number;
  grandTotal: number;
} {
  const totalPortions = params.items.reduce(
    (sum, item) => sum + Math.max(0, Math.round(item.quantity)),
    0
  );
  const subtotal = params.items.reduce(
    (sum, item) => sum + Math.max(0, Math.round(item.unitPrice)) * Math.max(0, Math.round(item.quantity)),
    0
  );

  let discountAmount = 0;
  if (params.promo && params.promo.active && subtotal > 0) {
    const rawDiscount = Math.round((subtotal * params.promo.discountPercent) / 100);
    discountAmount =
      params.promo.maxDiscountAmount > 0
        ? Math.min(rawDiscount, params.promo.maxDiscountAmount)
        : rawDiscount;
  }

  let shippingCost = 0;
  if (params.deliveryMethod === 'Pengiriman ke alamat' && subtotal > 0) {
    if (subtotal >= 10000000) {
      shippingCost = 0; // Gratis ongkir untuk pesanan besar >= Rp 10 juta
    } else {
      const dist = Math.max(1, Math.round(params.distanceKm ?? 5));
      shippingCost = Math.min(150000, Math.max(25000, dist * 5000));
    }
  }

  const grandTotal = Math.max(0, subtotal - discountAmount + shippingCost);

  return {
    totalPortions,
    subtotal,
    discountAmount,
    shippingCost,
    grandTotal,
  };
}

export function deriveOrderTrackingDetails(order: CateringOrder): {
  productionStatus: string;
  deliveryStatus: string;
  estimatedDelivery: string;
} {
  let productionStatus = 'Menunggu Antrean Dapur';
  let deliveryStatus = 'Menunggu Jadwal Pengiriman';

  switch (order.status) {
    case 'Pesanan baru':
    case 'Menunggu pembayaran':
      productionStatus = 'Verifikasi Pesanan & Jadwal Dapur';
      deliveryStatus = 'Menunggu Proses Dapur';
      break;
    case 'DP masuk':
      productionStatus = 'DP Terkonfirmasi · Persiapan Bahan';
      deliveryStatus = 'Slot Pengiriman Terjadwal';
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

  const dateFormatted = formatTanggalIndonesia(order.deliveryDate);
  const timePart = order.deliveryTime ? `, Pukul ${order.deliveryTime}` : ', Sesuai Jadwal Acara';
  const methodPart =
    order.deliveryMethod === 'Ambil sendiri di lokasi dapur'
      ? ' (Ambil Sendiri di Dapur Sentral)'
      : ' (Diantar Armada Smart Catering)';

  return {
    productionStatus,
    deliveryStatus,
    estimatedDelivery: `${dateFormatted}${timePart}${methodPart}`,
  };
}

export function calculateOrderFinancials(params: {
  portions: number;
  unitPrice: number;
  discount: number;
  shippingCost?: number;
  downPayment: number;
}): {
  grossTotal: number;
  totalPayment: number;
  remainingBalance: number;
  paymentStatus: PaymentStatus;
} {
  const portions = Math.max(1, Math.round(params.portions));
  const unitPrice = Math.max(0, Math.round(params.unitPrice));
  const discount = Math.max(0, Math.round(params.discount));
  const shippingCost = Math.max(0, Math.round(params.shippingCost || 0));
  const grossTotal = portions * unitPrice;
  const totalPayment = Math.max(0, grossTotal - discount + shippingCost);
  const downPayment = Math.max(0, Math.min(totalPayment, Math.round(params.downPayment)));
  const remainingBalance = Math.max(0, totalPayment - downPayment);

  let paymentStatus: PaymentStatus = 'Belum Bayar';
  if (totalPayment > 0 && remainingBalance === 0) {
    paymentStatus = 'Lunas';
  } else if (downPayment > 0 && remainingBalance > 0) {
    paymentStatus = 'DP Masuk';
  }

  return {
    grossTotal,
    totalPayment,
    remainingBalance,
    paymentStatus,
  };
}

export function generateOrderNumber(dateStr: string, sequenceIndex: number): string {
  const cleanDate = (dateStr || '2026-11-16').replace(/[^0-9]/g, '').slice(0, 8);
  const seq = String(Math.max(1, sequenceIndex)).padStart(3, '0');
  return `ORD-${cleanDate}-${seq}`;
}

export function calculateRawMaterialRequirement(
  portions: number,
  targetChannel: 'Catering Komersial' | 'Sekolah Rakyat'
): {
  recipeSummary: string;
  rawMaterialNeed: string;
  estimatedProductionCost: number;
} {
  const safePortions = Math.max(1, Math.round(portions));
  const berasKg = +(safePortions * 0.12).toFixed(1);
  const proteinKg = +(safePortions * 0.14).toFixed(1);
  const sayurKg = +(safePortions * 0.09).toFixed(1);
  const minyakLiter = +(safePortions * 0.025).toFixed(1);

  if (targetChannel === 'Sekolah Rakyat') {
    const susuBox = safePortions;
    const buahPcs = safePortions;
    return {
      recipeSummary: 'Standar Gizi Sekolah Rakyat (Nasi Putih, Protein Ikan/Ayam, Sayur Sop Segar, Buah & Susu UHT 200ml)',
      rawMaterialNeed: `Beras ${berasKg} kg · Protein ${proteinKg} kg · Sayur ${sayurKg} kg · Buah ${buahPcs} pcs · Susu UHT ${susuBox} kotak`,
      estimatedProductionCost: safePortions * 16500,
    };
  }

  return {
    recipeSummary: 'Standar Dapur Catering Komersial (Nasi Pilihan, Lauk Utama Bumbu Nusantara, Pendamping, Sambal & Lalapan)',
    rawMaterialNeed: `Beras ${berasKg} kg · Lauk Utama ${proteinKg} kg · Sayur ${sayurKg} kg · Minyak & Bumbu ${minyakLiter} L · Kemasan ${safePortions} set`,
    estimatedProductionCost: safePortions * 21000,
  };
}

export type PeriodFilterKey =
  | 'today'
  | '7days'
  | 'this_month'
  | 'prev_month'
  | 'this_year'
  | 'custom'
  | 'all';

export function getJakartaTodayIso(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function isDateInPeriod(
  dateStr: string,
  period: PeriodFilterKey,
  customStart?: string,
  customEnd?: string,
  referenceDateIso?: string
): boolean {
  if (!period || period === 'all') return true;
  if (!dateStr || dateStr.length < 10) return false;
  const targetDay = dateStr.slice(0, 10);
  const todayIso = referenceDateIso || getJakartaTodayIso();
  const todayDate = new Date(`${todayIso}T00:00:00+07:00`);

  if (period === 'today') {
    return targetDay === todayIso;
  }

  if (period === '7days') {
    const past = new Date(todayDate);
    past.setDate(past.getDate() - 6);
    const pastIso = past.toISOString().slice(0, 10);
    return targetDay >= pastIso && targetDay <= todayIso;
  }

  if (period === 'this_month') {
    return targetDay.slice(0, 7) === todayIso.slice(0, 7);
  }

  if (period === 'prev_month') {
    const prev = new Date(todayDate);
    prev.setMonth(prev.getMonth() - 1);
    const prevYm = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    return targetDay.slice(0, 7) === prevYm;
  }

  if (period === 'this_year') {
    return targetDay.slice(0, 4) === todayIso.slice(0, 4);
  }

  if (period === 'custom') {
    if (customStart && targetDay < customStart) return false;
    if (customEnd && targetDay > customEnd) return false;
    return true;
  }

  return true;
}

export interface DashboardMetrics {
  // 12 Core Master Prompt KPIs
  totalPesanan: number;
  pesananBaru: number;
  pesananDiproses: number;
  pesananSelesai: number;
  totalPendapatan: number;
  totalPembayaranDiterima: number;
  totalPiutang: number;
  totalPengeluaran: number;
  keuntunganBersih: number;
  saldoKasDanBank: number;
  totalUtang: number;
  persediaanMenipisCount: number;

  // Granular Separated Balances & Legacy Fields
  totalPendapatanCatering: number;
  totalPendapatanSekolah: number;
  saldoKasTunai: number;
  saldoRekeningBank: number;
  saldoQris: number;
  pesananAktifCount: number;
  produksiHariIniPorsi: number;
  totalPorsiTerdistribusi: number;
  jumlahPelanggan: number;
  jumlahSekolahDilayani: number;
  stokAmanCount: number;
  stokKritisCount: number;
  totalNilaiStok: number;
}

function getOrderLinkedFinanceIds(entries: FinanceEntry[]): Set<string> {
  const linked = new Set<string>();
  for (const e of entries) {
    if (e.orderRef) linked.add(e.orderRef.trim().toUpperCase());
    if (e.referenceCode.startsWith('LUNAS-')) {
      linked.add(e.referenceCode.replace('LUNAS-', '').trim().toUpperCase());
    }
    if (e.referenceCode.startsWith('DP-')) {
      linked.add(e.referenceCode.replace('DP-', '').trim().toUpperCase());
    }
  }
  return linked;
}

export function computeDashboardMetrics(
  snapshot: ErpStateSnapshot,
  filterUnit: 'Semua Unit' | 'Catering Komersial' | 'Sekolah Rakyat' = 'Semua Unit',
  periodOrMonth: string = 'all',
  customStart?: string,
  customEnd?: string
): DashboardMetrics {
  const isPeriodKey = [
    'today',
    '7days',
    'this_month',
    'prev_month',
    'this_year',
    'custom',
    'all',
  ].includes(periodOrMonth);

  const matchesDate = (dateStr: string) => {
    if (!periodOrMonth || periodOrMonth === 'Semua' || periodOrMonth === 'all') return true;
    if (isPeriodKey) {
      return isDateInPeriod(dateStr, periodOrMonth as PeriodFilterKey, customStart, customEnd);
    }
    return dateStr.startsWith(periodOrMonth);
  };

  const filteredFinance = snapshot.financeEntries.filter((f) => matchesDate(f.transactionDate));
  const filteredOrders = snapshot.cateringOrders.filter((o) => matchesDate(o.orderDate));
  const filteredProduction = snapshot.productionBatches.filter((p) =>
    matchesDate(p.productionDate)
  );
  const filteredDeliveries = snapshot.schoolDeliveries.filter((d) => matchesDate(d.deliveryDate));

  const nonCancelledOrders = filteredOrders.filter((o) => o.status !== 'Dibatalkan');

  // 1-4: Order counts
  const totalPesanan = filterUnit === 'Sekolah Rakyat' ? 0 : filteredOrders.length;
  const pesananBaru =
    filterUnit === 'Sekolah Rakyat'
      ? 0
      : filteredOrders.filter(
          (o) => o.status === 'Pesanan baru' || o.status === 'Menunggu pembayaran'
        ).length;
  const pesananDiproses =
    filterUnit === 'Sekolah Rakyat'
      ? 0
      : filteredOrders.filter((o) =>
          ['DP masuk', 'Diproses', 'Sedang diproduksi', 'Siap dikirim', 'Dalam pengiriman'].includes(
            o.status
          )
        ).length;
  const pesananSelesai =
    filterUnit === 'Sekolah Rakyat'
      ? 0
      : filteredOrders.filter((o) => o.status === 'Selesai').length;

  // Deduplicate order-linked finance receipts vs order payment state
  const linkedOrderNums = getOrderLinkedFinanceIds(filteredFinance);

  // Actual verified cash received from Finance Ledger ('Lunas')
  const ledgerCateringCash = filteredFinance
    .filter((f) => f.type === 'Pendapatan Catering' && f.settlementStatus === 'Lunas')
    .reduce((acc, item) => acc + item.amount, 0);

  // Unlinked verified payments directly recorded on CateringOrder (not yet in finance_entries)
  const unlinkedOrderCash = nonCancelledOrders
    .filter((o) => !linkedOrderNums.has(o.orderNumber.trim().toUpperCase()))
    .reduce((acc, o) => {
      if (o.paymentStatus === 'Lunas') return acc + o.totalPayment;
      if (o.paymentStatus === 'DP Masuk') return acc + Math.max(0, o.downPayment || 0);
      return acc;
    }, 0);

  const totalPendapatanCatering =
    filterUnit === 'Sekolah Rakyat' ? 0 : ledgerCateringCash + unlinkedOrderCash;

  const totalPendapatanSekolah =
    filterUnit === 'Catering Komersial'
      ? 0
      : filteredFinance
          .filter((f) => f.type === 'Pendapatan Sekolah Rakyat' && f.settlementStatus === 'Lunas')
          .reduce((acc, item) => acc + item.amount, 0);

  // Total Pendapatan = recognized revenue value (verified receipts + sekolah income)
  const totalPembayaranDiterima = totalPendapatanCatering + totalPendapatanSekolah;

  // Total Nilai Omzet Pesanan + Sekolah (including invoiced contracts not yet paid)
  const cateringContractRevenue =
    filterUnit === 'Sekolah Rakyat'
      ? 0
      : nonCancelledOrders.reduce((acc, o) => acc + o.totalPayment, 0);
  const manualNonOrderCateringLedger =
    filterUnit === 'Sekolah Rakyat'
      ? 0
      : filteredFinance
          .filter((f) => f.type === 'Pendapatan Catering' && !f.orderRef && !f.referenceCode.startsWith('LUNAS-') && !f.referenceCode.startsWith('DP-'))
          .reduce((acc, item) => acc + item.amount, 0);
  const totalPendapatan =
    Math.max(totalPendapatanCatering, cateringContractRevenue + manualNonOrderCateringLedger) +
    totalPendapatanSekolah;

  const rawExpenses = filteredFinance
    .filter((f) => f.type === 'Pengeluaran Operasional')
    .reduce((acc, item) => acc + item.amount, 0);

  const paidExpenses = filteredFinance
    .filter((f) => f.type === 'Pengeluaran Operasional' && f.settlementStatus === 'Lunas')
    .reduce((acc, item) => acc + item.amount, 0);

  const totalPengeluaran = rawExpenses;
  const keuntunganBersih = totalPembayaranDiterima - totalPengeluaran;

  // Separated Cash / Bank / QRIS Balances strictly from actual Firestore data (ZERO hardcoded constants!)
  const calcAccountBalance = (matcher: (acc: FinanceEntry['accountMethod']) => boolean): number => {
    const ledgerIn = filteredFinance
      .filter(
        (f) =>
          (f.type === 'Pendapatan Catering' || f.type === 'Pendapatan Sekolah Rakyat') &&
          f.settlementStatus === 'Lunas' &&
          matcher(f.accountMethod)
      )
      .reduce((sum, f) => sum + f.amount, 0);

    const ledgerOut = filteredFinance
      .filter(
        (f) =>
          f.type === 'Pengeluaran Operasional' &&
          f.settlementStatus === 'Lunas' &&
          matcher(f.accountMethod)
      )
      .reduce((sum, f) => sum + f.amount, 0);

    const unlinkedCashForAccount = nonCancelledOrders
      .filter((o) => !linkedOrderNums.has(o.orderNumber.trim().toUpperCase()))
      .filter((o) => {
        const mapped: FinanceEntry['accountMethod'] =
          o.paymentMethod === 'QRIS'
            ? 'QRIS'
            : o.paymentMethod === 'Pembayaran Tunai'
            ? 'Kas Tunai'
            : 'Bank Mandiri ERP';
        return matcher(mapped);
      })
      .reduce((sum, o) => {
        if (o.paymentStatus === 'Lunas') return sum + o.totalPayment;
        if (o.paymentStatus === 'DP Masuk') return sum + Math.max(0, o.downPayment || 0);
        return sum;
      }, 0);

    return ledgerIn + unlinkedCashForAccount - ledgerOut;
  };

  const saldoKasTunai = calcAccountBalance((a) => a === 'Kas Tunai');
  const saldoQris = calcAccountBalance((a) => a === 'QRIS');
  const saldoRekeningBank = calcAccountBalance(
    (a) =>
      a === 'Bank Mandiri ERP' || a === 'Bank BRI Sekolah Rakyat' || a === 'Bank BCA Corporate'
  );
  const saldoKasDanBank = saldoKasTunai + saldoRekeningBank + saldoQris;

  const totalUtang = filteredFinance
    .filter((f) => f.type === 'Utang Supplier' && f.settlementStatus === 'Belum Lunas')
    .reduce((acc, f) => acc + f.amount, 0);

  const ledgerPiutang = filteredFinance
    .filter((f) => f.type === 'Piutang Pelanggan' && f.settlementStatus === 'Belum Lunas')
    .reduce((acc, f) => acc + f.amount, 0);

  const orderPiutang = nonCancelledOrders.reduce(
    (acc, o) =>
      acc +
      (o.paymentStatus === 'Lunas'
        ? 0
        : Math.max(0, o.totalPayment - Math.max(0, o.downPayment || 0))),
    0
  );

  const totalPiutang = ledgerPiutang + orderPiutang;

  const pesananAktifCount =
    filterUnit === 'Sekolah Rakyat'
      ? 0
      : filteredOrders.filter((o) => !['Selesai', 'Dibatalkan'].includes(o.status)).length;

  const produksiHariIniPorsi = filteredProduction
    .filter((p) => {
      if (filterUnit === 'Catering Komersial' && p.targetChannel !== 'Catering Komersial')
        return false;
      if (filterUnit === 'Sekolah Rakyat' && p.targetChannel !== 'Sekolah Rakyat') return false;
      return p.status !== 'Dibatalkan';
    })
    .reduce((acc, p) => acc + p.portions, 0);

  const schoolDistributed =
    filterUnit === 'Catering Komersial'
      ? 0
      : filteredDeliveries
          .filter((d) => d.status === 'Selesai' || d.status === 'Dalam Pengiriman')
          .reduce((acc, d) => acc + d.portionsDelivered, 0);

  const cateringDistributed =
    filterUnit === 'Sekolah Rakyat'
      ? 0
      : filteredOrders
          .filter((o) => ['Selesai', 'Dalam pengiriman', 'Siap dikirim'].includes(o.status))
          .reduce((acc, o) => acc + o.portions, 0);

  const totalPorsiTerdistribusi = schoolDistributed + cateringDistributed;

  const jumlahPelanggan = snapshot.customers.filter((c) => c.isActive).length;
  const jumlahSekolahDilayani = snapshot.schools.filter(
    (s) => s.partnershipStatus === 'Aktif'
  ).length;

  const stokKritisCount = snapshot.inventoryItems.filter((i) => i.stockQty <= i.minStock).length;
  const stokAmanCount = snapshot.inventoryItems.length - stokKritisCount;
  const totalNilaiStok = snapshot.inventoryItems.reduce(
    (acc, i) => acc + i.stockQty * i.unitCost,
    0
  );

  void paidExpenses;

  return {
    totalPesanan,
    pesananBaru,
    pesananDiproses,
    pesananSelesai,
    totalPendapatan,
    totalPembayaranDiterima,
    totalPiutang,
    totalPengeluaran,
    keuntunganBersih,
    saldoKasDanBank,
    totalUtang,
    persediaanMenipisCount: stokKritisCount,
    totalPendapatanCatering,
    totalPendapatanSekolah,
    saldoKasTunai,
    saldoRekeningBank,
    saldoQris,
    pesananAktifCount,
    produksiHariIniPorsi,
    totalPorsiTerdistribusi,
    jumlahPelanggan,
    jumlahSekolahDilayani,
    stokAmanCount,
    stokKritisCount,
    totalNilaiStok,
  };
}

