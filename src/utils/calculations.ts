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
  const grossTotal = portions * unitPrice;
  const totalPayment = Math.max(0, grossTotal - discount);
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

export interface DashboardMetrics {
  totalPendapatanCatering: number;
  totalPendapatanSekolah: number;
  totalPengeluaran: number;
  keuntunganBersih: number;
  pesananAktifCount: number;
  produksiHariIniPorsi: number;
  totalPorsiTerdistribusi: number;
  jumlahPelanggan: number;
  jumlahSekolahDilayani: number;
  stokAmanCount: number;
  stokKritisCount: number;
  totalNilaiStok: number;
  totalUtang: number;
  totalPiutang: number;
  saldoKasDanBank: number;
}

export function computeDashboardMetrics(
  snapshot: ErpStateSnapshot,
  filterUnit: 'Semua Unit' | 'Catering Komersial' | 'Sekolah Rakyat' = 'Semua Unit',
  filterMonth: string = 'Semua'
): DashboardMetrics {
  const matchesMonth = (dateStr: string) => {
    if (!filterMonth || filterMonth === 'Semua') return true;
    return dateStr.startsWith(filterMonth);
  };

  const filteredFinance = snapshot.financeEntries.filter((f) => matchesMonth(f.transactionDate));
  const filteredOrders = snapshot.cateringOrders.filter((o) => matchesMonth(o.orderDate));
  const filteredProduction = snapshot.productionBatches.filter((p) => matchesMonth(p.productionDate));
  const filteredDeliveries = snapshot.schoolDeliveries.filter((d) => matchesMonth(d.deliveryDate));

  const ledgerCateringIncome = filteredFinance
    .filter((f) => f.type === 'Pendapatan Catering')
    .reduce((acc, item) => acc + item.amount, 0);

  const orderPaidIncome = filteredOrders
    .filter((o) => o.status !== 'Dibatalkan')
    .reduce((acc, o) => acc + (o.paymentStatus === 'Lunas' ? o.totalPayment : o.downPayment), 0);

  const totalPendapatanCatering =
    filterUnit === 'Sekolah Rakyat' ? 0 : Math.max(ledgerCateringIncome, orderPaidIncome);

  const totalPendapatanSekolah =
    filterUnit === 'Catering Komersial'
      ? 0
      : filteredFinance
          .filter((f) => f.type === 'Pendapatan Sekolah Rakyat')
          .reduce((acc, item) => acc + item.amount, 0);

  const rawExpenses = filteredFinance
    .filter((f) => f.type === 'Pengeluaran Operasional')
    .reduce((acc, item) => acc + item.amount, 0);

  const totalPengeluaran =
    filterUnit === 'Catering Komersial'
      ? Math.round(rawExpenses * 0.58)
      : filterUnit === 'Sekolah Rakyat'
      ? Math.round(rawExpenses * 0.42)
      : rawExpenses;

  const keuntunganBersih = totalPendapatanCatering + totalPendapatanSekolah - totalPengeluaran;

  const pesananAktifCount =
    filterUnit === 'Sekolah Rakyat'
      ? 0
      : filteredOrders.filter((o) => !['Selesai', 'Dibatalkan'].includes(o.status)).length;

  const produksiHariIniPorsi = filteredProduction
    .filter((p) => {
      if (filterUnit === 'Catering Komersial' && p.targetChannel !== 'Catering Komersial') return false;
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
  const jumlahSekolahDilayani = snapshot.schools.filter((s) => s.partnershipStatus === 'Aktif').length;

  const stokKritisCount = snapshot.inventoryItems.filter((i) => i.stockQty <= i.minStock).length;
  const stokAmanCount = snapshot.inventoryItems.length - stokKritisCount;
  const totalNilaiStok = snapshot.inventoryItems.reduce((acc, i) => acc + i.stockQty * i.unitCost, 0);

  const totalUtang = filteredFinance
    .filter((f) => f.type === 'Utang Supplier' && f.settlementStatus === 'Belum Lunas')
    .reduce((acc, f) => acc + f.amount, 0);

  const ledgerPiutang = filteredFinance
    .filter((f) => f.type === 'Piutang Pelanggan' && f.settlementStatus === 'Belum Lunas')
    .reduce((acc, f) => acc + f.amount, 0);

  const orderPiutang = filteredOrders
    .filter((o) => o.status !== 'Dibatalkan')
    .reduce((acc, o) => acc + o.remainingBalance, 0);

  const totalPiutang = ledgerPiutang + orderPiutang;

  const initialModalKas = 145000000;
  const saldoKasDanBank = initialModalKas + keuntunganBersih - totalUtang;

  return {
    totalPendapatanCatering,
    totalPendapatanSekolah,
    totalPengeluaran,
    keuntunganBersih,
    pesananAktifCount,
    produksiHariIniPorsi,
    totalPorsiTerdistribusi,
    jumlahPelanggan,
    jumlahSekolahDilayani,
    stokAmanCount,
    stokKritisCount,
    totalNilaiStok,
    totalUtang,
    totalPiutang,
    saldoKasDanBank,
  };
}
