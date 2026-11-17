import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileSpreadsheet,
  Landmark,
  Package,
  Search,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { CateringOrder, ErpStateSnapshot, PaidNotificationItem } from '../types/erp';
import {
  computeDashboardMetrics,
  formatRupiah,
  formatTanggalIndonesia,
  isDateInPeriod,
  PeriodFilterKey,
} from '../utils/calculations';

interface DashboardViewProps {
  state: ErpStateSnapshot;
  paidNotifications: PaidNotificationItem[];
  onNavigateModule: (moduleKey: string) => void;
  onExportReportCsv: () => void;
  onConfirmOrderPaid: (order: CateringOrder) => Promise<void>;
}

const PERIOD_OPTIONS: { key: PeriodFilterKey; label: string }[] = [
  { key: 'all', label: 'Semua Periode' },
  { key: 'today', label: 'Hari ini' },
  { key: '7days', label: '7 hari terakhir' },
  { key: 'this_month', label: 'Bulan ini' },
  { key: 'prev_month', label: 'Bulan sebelumnya' },
  { key: 'this_year', label: 'Tahun ini' },
  { key: 'custom', label: 'Rentang tanggal khusus' },
];

const formatCompactRupiah = (val: number): string => {
  const abs = Math.abs(val);
  if (abs >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)} M`;
  if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(1)} Jt`;
  if (abs >= 1_000) return `${(val / 1_000).toFixed(0)} Rb`;
  return String(Math.round(val));
};

const formatMonthLabel = (ym: string): string => {
  const [y, m] = ym.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const idx = Number(m) - 1;
  if (idx >= 0 && idx < 12) return `${names[idx]} ${y?.slice(2) || ''}`;
  return ym;
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  paidNotifications,
  onNavigateModule,
  onExportReportCsv,
  onConfirmOrderPaid,
}) => {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterKey>('all');
  const [customStart, setCustomStart] = useState('2026-11-01');
  const [customEnd, setCustomEnd] = useState('2026-12-31');
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);

  // Interactive hover state for charts
  const [hoveredMonthBar, setHoveredMonthBar] = useState<string | null>(null);
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);

  // Table search, filter & sort
  const [tableSearch, setTableSearch] = useState('');
  const [tablePayFilter, setTablePayFilter] = useState<'Semua' | 'Lunas' | 'DP Masuk' | 'Belum Bayar'>('Semua');
  const [sortBy, setSortBy] = useState<'orderDate' | 'totalPayment' | 'portions'>('orderDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const metrics = useMemo(
    () =>
      computeDashboardMetrics(
        state,
        'Semua Unit',
        periodFilter,
        periodFilter === 'custom' ? customStart : undefined,
        periodFilter === 'custom' ? customEnd : undefined
      ),
    [state, periodFilter, customStart, customEnd]
  );

  const periodOrders = useMemo(
    () =>
      state.cateringOrders.filter((o) =>
        isDateInPeriod(o.orderDate, periodFilter, customStart, customEnd)
      ),
    [state.cateringOrders, periodFilter, customStart, customEnd]
  );

  const periodFinance = useMemo(
    () =>
      state.financeEntries.filter((f) =>
        isDateInPeriod(f.transactionDate, periodFilter, customStart, customEnd)
      ),
    [state.financeEntries, periodFilter, customStart, customEnd]
  );

  const periodDeliveries = useMemo(
    () =>
      state.schoolDeliveries.filter((d) =>
        isDateInPeriod(d.deliveryDate, periodFilter, customStart, customEnd)
      ),
    [state.schoolDeliveries, periodFilter, customStart, customEnd]
  );

  // 1. Monthly Income vs Expense & Order Volume Trend
  const monthlySeries = useMemo(() => {
    const map = new Map<
      string,
      { month: string; income: number; expense: number; ordersCount: number }
    >();

    const ensure = (ym: string) => {
      if (!ym || ym.length < 7) return null;
      const key = ym.slice(0, 7);
      if (!map.has(key)) {
        map.set(key, { month: key, income: 0, expense: 0, ordersCount: 0 });
      }
      return map.get(key)!;
    };

    for (const f of periodFinance) {
      const bucket = ensure(f.transactionDate);
      if (!bucket) continue;
      if (
        (f.type === 'Pendapatan Catering' || f.type === 'Pendapatan Sekolah Rakyat') &&
        f.settlementStatus === 'Lunas'
      ) {
        bucket.income += f.amount;
      } else if (f.type === 'Pengeluaran Operasional') {
        bucket.expense += f.amount;
      }
    }

    const linkedRefs = new Set(
      periodFinance
        .map((f) => (f.orderRef || f.referenceCode.replace(/^(LUNAS-|DP-)/, '')).toUpperCase())
        .filter(Boolean)
    );

    for (const o of periodOrders) {
      const bucket = ensure(o.orderDate);
      if (!bucket) continue;
      bucket.ordersCount += 1;
      if (o.status !== 'Dibatalkan' && !linkedRefs.has(o.orderNumber.toUpperCase())) {
        const cash = o.paymentStatus === 'Lunas' ? o.totalPayment : Math.max(0, o.downPayment || 0);
        bucket.income += cash;
      }
    }

    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [periodFinance, periodOrders]);

  // 3. Catering vs Sekolah Rakyat Comparison
  const unitComparison = useMemo(() => {
    const cateringRev = metrics.totalPendapatanCatering;
    const sekolahRev = metrics.totalPendapatanSekolah;
    const totalRev = Math.max(1, cateringRev + sekolahRev);

    const cateringPortions = periodOrders
      .filter((o) => o.status !== 'Dibatalkan')
      .reduce((s, o) => s + o.portions, 0);
    const sekolahPortions = periodDeliveries
      .filter((d) => d.status !== 'Dibatalkan')
      .reduce((s, d) => s + d.portionsDelivered, 0);

    return {
      cateringRev,
      sekolahRev,
      cateringPct: Math.round((cateringRev / totalRev) * 100),
      sekolahPct: Math.round((sekolahRev / totalRev) * 100),
      cateringPortions,
      sekolahPortions,
    };
  }, [metrics, periodOrders, periodDeliveries]);

  // 4. Payment Status Distribution
  const paymentBreakdown = useMemo(() => {
    const active = periodOrders.filter((o) => o.status !== 'Dibatalkan');
    const lunas = active.filter((o) => o.paymentStatus === 'Lunas');
    const dp = active.filter((o) => o.paymentStatus === 'DP Masuk');
    const belum = active.filter((o) => o.paymentStatus === 'Belum Bayar');
    const total = Math.max(1, active.length);

    return {
      totalCount: active.length,
      items: [
        {
          label: 'Lunas',
          count: lunas.length,
          pct: Math.round((lunas.length / total) * 100),
          amount: lunas.reduce((s, o) => s + o.totalPayment, 0),
          color: '#047857', // emerald-700
        },
        {
          label: 'DP Masuk',
          count: dp.length,
          pct: Math.round((dp.length / total) * 100),
          amount: dp.reduce((s, o) => s + Math.max(0, o.downPayment || 0), 0),
          color: '#0f172a', // navy / slate-900
        },
        {
          label: 'Belum Bayar',
          count: belum.length,
          pct: Math.round((belum.length / total) * 100),
          amount: belum.reduce((s, o) => s + o.totalPayment, 0),
          color: '#d97706', // amber-600
        },
      ],
    };
  }, [periodOrders]);

  // 5. Top Ordered Packages / Products
  const topPackages = useMemo(() => {
    const map = new Map<string, { name: string; portions: number; orders: number; revenue: number }>();
    for (const o of periodOrders) {
      if (o.status === 'Dibatalkan') continue;
      if (o.items && o.items.length > 0) {
        for (const it of o.items) {
          const cur = map.get(it.name) || { name: it.name, portions: 0, orders: 0, revenue: 0 };
          cur.portions += it.quantity;
          cur.orders += 1;
          cur.revenue += it.quantity * it.unitPrice;
          map.set(it.name, cur);
        }
      } else {
        const key = o.packageName || 'Paket Catering';
        const cur = map.get(key) || { name: key, portions: 0, orders: 0, revenue: 0 };
        cur.portions += o.portions;
        cur.orders += 1;
        cur.revenue += o.totalPayment;
        map.set(key, cur);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.portions - a.portions)
      .slice(0, 5);
  }, [periodOrders]);

  // Searchable / Filterable / Sortable Orders Table
  const tableOrders = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    const filtered = periodOrders.filter((o) => {
      const matchPay = tablePayFilter === 'Semua' || o.paymentStatus === tablePayFilter;
      const matchQ =
        !q ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.packageName.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q);
      return matchPay && matchQ;
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'orderDate') cmp = a.orderDate.localeCompare(b.orderDate);
      else if (sortBy === 'totalPayment') cmp = a.totalPayment - b.totalPayment;
      else cmp = a.portions - b.portions;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [periodOrders, tableSearch, tablePayFilter, sortBy, sortDir]);

  const toggleSort = (col: 'orderDate' | 'totalPayment' | 'portions') => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const handleQuickMarkPaid = async (order: CateringOrder) => {
    setConfirmingOrderId(order.id);
    try {
      await onConfirmOrderPaid(order);
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const maxMonthlyMoney = Math.max(
    1,
    ...monthlySeries.flatMap((m) => [m.income, m.expense])
  );
  const maxTrendOrders = Math.max(1, ...monthlySeries.map((m) => m.ordersCount));
  const maxTopPortions = Math.max(1, ...topPackages.map((p) => p.portions));
  const unpaidQueue = periodOrders.filter(
    (o) => o.status !== 'Dibatalkan' && o.paymentStatus !== 'Lunas'
  );

  return (
    <div className="space-y-6">
      {/* 1. Enterprise Header & 6 Period Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Executive Dashboard Super Admin
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Metrik operasional, posisi kas &amp; bank, piutang, utang, dan performa distribusi real-time langsung dari database.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateModule('catering')}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap"
            >
              <ShoppingBag className="h-4 w-4 text-emerald-400" />
              <span>Kelola Pesanan</span>
            </button>
            <button
              type="button"
              onClick={onExportReportCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-800 transition-colors whitespace-nowrap"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
              <span>Ekspor Laporan (.XLS)</span>
            </button>
          </div>
        </div>

        {/* Period Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 mr-1">
            <Calendar className="h-3.5 w-3.5 text-emerald-700" />
            <span>Periode Data:</span>
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {PERIOD_OPTIONS.map((opt) => {
              const active = periodFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPeriodFilter(opt.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {periodFilter === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 ml-auto text-xs">
              <label className="text-slate-600 font-medium" htmlFor="dash-start-date">
                Dari
              </label>
              <input
                id="dash-start-date"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-mono tabular-nums text-slate-900"
              />
              <label className="text-slate-600 font-medium" htmlFor="dash-end-date">
                s/d
              </label>
              <input
                id="dash-end-date"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-mono tabular-nums text-slate-900"
              />
            </div>
          )}
        </div>
      </div>

      {/* 2. All 12 Mandatory Real-Data KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. TOTAL PESANAN */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span>1. Total Pesanan</span>
            <ShoppingBag className="h-4 w-4 text-slate-700" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {metrics.totalPesanan.toLocaleString('id-ID')}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Seluruh pesanan tercatat pada periode
          </div>
        </div>

        {/* 2. PESANAN BARU */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span>2. Pesanan Baru</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {metrics.pesananBaru.toLocaleString('id-ID')}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Pesanan baru &amp; menunggu pembayaran
          </div>
        </div>

        {/* 3. PESANAN DIPROSES */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span>3. Pesanan Diproses</span>
            <TrendingUp className="h-4 w-4 text-slate-900" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {metrics.pesananDiproses.toLocaleString('id-ID')}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            DP masuk, produksi dapur &amp; pengiriman
          </div>
        </div>

        {/* 4. PESANAN SELESAI */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span>4. Pesanan Selesai</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700 font-mono tabular-nums">
            {metrics.pesananSelesai.toLocaleString('id-ID')}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Tuntas dikirim &amp; diterima pelanggan
          </div>
        </div>

        {/* 5. TOTAL PENDAPATAN */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span>5. Total Pendapatan</span>
            <ArrowUpRight className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {formatRupiah(metrics.totalPendapatan)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Nilai kontrak catering &amp; Sekolah Rakyat
          </div>
        </div>

        {/* 6. TOTAL PEMBAYARAN DITERIMA */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-emerald-900">
            <span>6. Total Pembayaran Diterima</span>
            <Banknote className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-800 font-mono tabular-nums">
            {formatRupiah(metrics.totalPembayaranDiterima)}
          </div>
          <div className="mt-1 text-xs text-emerald-800">
            Dana aktual terverifikasi masuk
          </div>
        </div>

        {/* 7. TOTAL PIUTANG PELANGGAN */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span>7. Total Piutang Pelanggan</span>
            <CreditCard className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-amber-700 font-mono tabular-nums">
            {formatRupiah(metrics.totalPiutang)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Sisa tagihan &amp; piutang belum lunas
          </div>
        </div>

        {/* 8. TOTAL PENGELUARAN */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span>8. Total Pengeluaran</span>
            <ArrowDownRight className="h-4 w-4 text-red-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-red-700 font-mono tabular-nums">
            {formatRupiah(metrics.totalPengeluaran)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Belanja bahan baku &amp; beban operasional
          </div>
        </div>

        {/* 9. KEUNTUNGAN BERSIH */}
        <div className="rounded-xl border border-slate-900 bg-slate-900 p-4 text-white">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-300">
            <span>9. Keuntungan Bersih</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div
            className={`mt-2 text-xl font-bold font-mono tabular-nums ${
              metrics.keuntunganBersih >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {formatRupiah(metrics.keuntunganBersih)}
          </div>
          <div className="mt-1 text-xs text-slate-300">
            Kas masuk terverifikasi dikurangi beban
          </div>
        </div>

        {/* 10. SALDO KAS DAN BANK */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span>10. Saldo Kas dan Bank</span>
            <Landmark className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {formatRupiah(metrics.saldoKasDanBank)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
            Kas {formatCompactRupiah(metrics.saldoKasTunai)} · Bank {formatCompactRupiah(metrics.saldoRekeningBank)} · QRIS {formatCompactRupiah(metrics.saldoQris)}
          </div>
        </div>

        {/* 11. UTANG SUPPLIER */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span>11. Utang Supplier</span>
            <Wallet className="h-4 w-4 text-red-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {formatRupiah(metrics.totalUtang)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Kewajiban pengadaan belum lunas
          </div>
        </div>

        {/* 12. PERSEDIAAN MENIPIS */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <span>12. Persediaan Menipis</span>
              <Package
                className={`h-4 w-4 ${
                  metrics.persediaanMenipisCount > 0 ? 'text-red-600' : 'text-emerald-700'
                }`}
              />
            </div>
            <div
              className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
                metrics.persediaanMenipisCount > 0 ? 'text-red-700' : 'text-emerald-700'
              }`}
            >
              {metrics.persediaanMenipisCount} Item
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateModule('stok')}
            className="mt-1 text-left text-xs font-semibold text-emerald-700 hover:underline"
          >
            {metrics.persediaanMenipisCount > 0
              ? 'Cek stok kritis gudang →'
              : 'Seluruh stok bahan aman →'}
          </button>
        </div>
      </div>

      {/* 3. Five Interactive Enterprise Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: Pendapatan dan Pengeluaran Bulanan */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Pendapatan &amp; Pengeluaran Bulanan
              </h2>
              <p className="text-xs text-slate-500">
                Arus kas masuk terverifikasi dibandingkan beban operasional per bulan
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 text-slate-700">
                <span className="h-2.5 w-2.5 rounded-xs bg-emerald-700 inline-block" />
                Pendapatan
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-700">
                <span className="h-2.5 w-2.5 rounded-xs bg-slate-900 inline-block" />
                Pengeluaran
              </span>
            </div>
          </div>

          {monthlySeries.length === 0 ? (
            <div className="h-52 flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-500">
              Belum ada data transaksi pada periode terpilih.
            </div>
          ) : (
            <div className="relative pt-2">
              <div className="flex items-end gap-3 h-52 border-b border-slate-200 pb-2 px-2 overflow-x-auto">
                {monthlySeries.map((m) => {
                  const incPct = Math.round((m.income / maxMonthlyMoney) * 100);
                  const expPct = Math.round((m.expense / maxMonthlyMoney) * 100);
                  const isHover = hoveredMonthBar === m.month;
                  return (
                    <div
                      key={m.month}
                      onMouseEnter={() => setHoveredMonthBar(m.month)}
                      onMouseLeave={() => setHoveredMonthBar(null)}
                      className="flex-1 min-w-[54px] h-full flex flex-col justify-end items-center gap-1.5 relative group cursor-pointer"
                    >
                      {isHover && (
                        <div className="absolute -top-2 z-20 rounded-lg bg-slate-900 text-white px-2.5 py-1.5 text-[11px] shadow-lg whitespace-nowrap pointer-events-none">
                          <div className="font-bold">{formatMonthLabel(m.month)}</div>
                          <div className="font-mono text-emerald-300">
                            Masuk: {formatRupiah(m.income)}
                          </div>
                          <div className="font-mono text-amber-300">
                            Keluar: {formatRupiah(m.expense)}
                          </div>
                        </div>
                      )}
                      <div className="w-full flex items-end justify-center gap-1.5 h-40">
                        <div
                          style={{ height: `${Math.max(4, incPct)}%` }}
                          className="w-4 sm:w-5 rounded-t bg-emerald-700 group-hover:bg-emerald-600 transition-all"
                          title={`Pendapatan: ${formatRupiah(m.income)}`}
                        />
                        <div
                          style={{ height: `${Math.max(4, expPct)}%` }}
                          className="w-4 sm:w-5 rounded-t bg-slate-900 group-hover:bg-slate-700 transition-all"
                          title={`Pengeluaran: ${formatRupiah(m.expense)}`}
                        />
                      </div>
                      <span className="text-[11px] font-mono font-semibold text-slate-600">
                        {formatMonthLabel(m.month)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Chart 2: Tren Jumlah Pesanan */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Tren Jumlah Pesanan</h2>
              <p className="text-xs text-slate-500">
                Volume pesanan catering komersial per periode bulanan
              </p>
            </div>
            <span className="font-mono tabular-nums text-xs font-bold text-slate-900">
              {metrics.totalPesanan} Pesanan
            </span>
          </div>

          {monthlySeries.length === 0 ? (
            <div className="h-52 flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-500">
              Belum ada tren pesanan untuk ditampilkan.
            </div>
          ) : (
            <div className="space-y-2">
              <svg viewBox="0 0 360 150" className="w-full h-44 overflow-visible">
                {[0, 0.5, 1].map((ratio) => {
                  const y = 125 - ratio * 100;
                  return (
                    <line
                      key={ratio}
                      x1="20"
                      y1={y}
                      x2="345"
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray="3 3"
                    />
                  );
                })}
                {(() => {
                  const pts = monthlySeries.map((m, idx) => {
                    const x =
                      monthlySeries.length === 1
                        ? 180
                        : 30 + (idx / (monthlySeries.length - 1)) * 305;
                    const y = 125 - (m.ordersCount / maxTrendOrders) * 95;
                    return { x, y, ...m };
                  });
                  const pathD = pts
                    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                    .join(' ');
                  const areaD = `${pathD} L ${pts[pts.length - 1].x} 125 L ${pts[0].x} 125 Z`;
                  return (
                    <>
                      <path d={areaD} fill="#047857" fillOpacity="0.1" />
                      <path d={pathD} fill="none" stroke="#0f172a" strokeWidth="2.5" />
                      {pts.map((p, idx) => (
                        <g
                          key={p.month}
                          onMouseEnter={() => setHoveredTrendIdx(idx)}
                          onMouseLeave={() => setHoveredTrendIdx(null)}
                          className="cursor-pointer"
                        >
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={hoveredTrendIdx === idx ? 6 : 4}
                            fill="#047857"
                            stroke="#ffffff"
                            strokeWidth="2"
                          />
                          <text
                            x={p.x}
                            y="142"
                            textAnchor="middle"
                            fontSize="10"
                            fill="#64748b"
                          >
                            {formatMonthLabel(p.month)}
                          </text>
                          <text
                            x={p.x}
                            y={p.y - 10}
                            textAnchor="middle"
                            fontSize="10"
                            fontWeight="bold"
                            fill="#0f172a"
                          >
                            {p.ordersCount}
                          </text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>
            </div>
          )}
        </div>

        {/* Chart 3: Perbandingan Catering & Sekolah Rakyat */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Catering vs Sekolah Rakyat
            </h2>
            <p className="text-xs text-slate-500">
              Kontribusi pendapatan &amp; realisasi porsi per unit usaha
            </p>
          </div>

          <div className="space-y-4 pt-1 text-xs">
            <div className="space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-800">
                <span>Catering Komersial ({unitComparison.cateringPct}%)</span>
                <span className="font-mono tabular-nums text-emerald-700">
                  {formatRupiah(unitComparison.cateringRev)}
                </span>
              </div>
              <div className="h-3 w-full rounded bg-slate-100 overflow-hidden">
                <div
                  style={{ width: `${unitComparison.cateringPct}%` }}
                  className="h-full bg-emerald-700 transition-all"
                />
              </div>
              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                Volume: {unitComparison.cateringPortions.toLocaleString('id-ID')} porsi pesanan
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-800">
                <span>Program Sekolah Rakyat ({unitComparison.sekolahPct}%)</span>
                <span className="font-mono tabular-nums text-slate-900">
                  {formatRupiah(unitComparison.sekolahRev)}
                </span>
              </div>
              <div className="h-3 w-full rounded bg-slate-100 overflow-hidden">
                <div
                  style={{ width: `${unitComparison.sekolahPct}%` }}
                  className="h-full bg-slate-900 transition-all"
                />
              </div>
              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                Distribusi: {unitComparison.sekolahPortions.toLocaleString('id-ID')} porsi siswa
              </div>
            </div>
          </div>
        </div>

        {/* Chart 4: Status Pembayaran */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Distribusi Status Pembayaran</h2>
            <p className="text-xs text-slate-500">
              Komposisi pelunasan, DP masuk, dan tagihan menunggu bayar
            </p>
          </div>

          <div className="flex items-center gap-5">
            <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90">
              <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="14" />
              {(() => {
                const circumference = 2 * Math.PI * 38;
                let offset = 0;
                return paymentBreakdown.items.map((item) => {
                  const len = (item.pct / 100) * circumference;
                  const dashArray = `${len} ${circumference - len}`;
                  const el = (
                    <circle
                      key={item.label}
                      cx="50"
                      cy="50"
                      r="38"
                      fill="none"
                      stroke={item.color}
                      strokeWidth="14"
                      strokeDasharray={dashArray}
                      strokeDashoffset={-offset}
                    />
                  );
                  offset += len;
                  return el;
                });
              })()}
            </svg>

            <div className="flex-1 space-y-2 text-xs">
              {paymentBreakdown.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      style={{ backgroundColor: item.color }}
                      className="h-2.5 w-2.5 rounded-xs shrink-0 inline-block"
                    />
                    <span className="font-semibold text-slate-800 truncate">
                      {item.label} ({item.count})
                    </span>
                  </div>
                  <span className="font-mono tabular-nums font-bold text-slate-900 shrink-0">
                    {item.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart 5: Produk atau Paket Paling Banyak Dipesan */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Paket Paling Banyak Dipesan</h2>
            <p className="text-xs text-slate-500">
              Peringkat berdasarkan total porsi terpesan pada periode
            </p>
          </div>

          {topPackages.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Belum ada data paket terpesan.
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              {topPackages.map((pkg, idx) => {
                const widthPct = Math.round((pkg.portions / maxTopPortions) * 100);
                return (
                  <div key={pkg.name} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800 truncate">
                        {idx + 1}. {pkg.name}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-slate-900 shrink-0">
                        {pkg.portions.toLocaleString('id-ID')} pax
                      </span>
                    </div>
                    <div className="h-2 w-full rounded bg-slate-100 overflow-hidden">
                      <div
                        style={{ width: `${widthPct}%` }}
                        className="h-full bg-emerald-700"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Enterprise Searchable, Filterable & Sortable Orders Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Daftar Transaksi Pesanan Operasional ({tableOrders.length})
            </h2>
            <p className="text-xs text-slate-500">
              Pencarian cepat, filter status pembayaran, serta pengurutan nilai &amp; tanggal
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                aria-label="Cari pesanan dashboard"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Cari no. order / pelanggan..."
                className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
              />
            </div>
            <select
              aria-label="Filter status pembayaran tabel dashboard"
              value={tablePayFilter}
              onChange={(e) =>
                setTablePayFilter(
                  e.target.value as 'Semua' | 'Lunas' | 'DP Masuk' | 'Belum Bayar'
                )
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800"
            >
              <option value="Semua">Semua Pembayaran</option>
              <option value="Lunas">Lunas</option>
              <option value="DP Masuk">DP Masuk</option>
              <option value="Belum Bayar">Belum Bayar</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="py-3 px-4 font-semibold">No. Pesanan</th>
                <th className="py-3 px-4 font-semibold">
                  <button
                    type="button"
                    onClick={() => toggleSort('orderDate')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>Tanggal</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-3 px-4 font-semibold">Pelanggan &amp; Paket</th>
                <th className="py-3 px-4 font-semibold text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('portions')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 ml-auto"
                  >
                    <span>Porsi</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-3 px-4 font-semibold text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('totalPayment')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 ml-auto"
                  >
                    <span>Total &amp; Sisa Tagihan</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-3 px-4 font-semibold">Status &amp; Bayar</th>
                <th className="py-3 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableOrders.slice(0, 15).map((ord) => {
                const paid =
                  ord.paymentStatus === 'Lunas'
                    ? ord.totalPayment
                    : Math.max(0, ord.downPayment || 0);
                const debt =
                  ord.paymentStatus === 'Lunas' ? 0 : Math.max(0, ord.totalPayment - paid);
                return (
                  <tr key={ord.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono tabular-nums font-bold text-slate-900">
                      {ord.orderNumber}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                      {formatTanggalIndonesia(ord.orderDate)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{ord.customerName}</div>
                      <div className="text-[11px] text-slate-500">{ord.packageName}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {ord.portions.toLocaleString('id-ID')} pax
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <div className="font-bold text-slate-900">
                        {formatRupiah(ord.totalPayment)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {debt > 0 ? `Sisa: ${formatRupiah(debt)}` : 'Lunas Rp 0'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{ord.status}</div>
                      <div
                        className={`text-[11px] font-semibold ${
                          ord.paymentStatus === 'Lunas'
                            ? 'text-emerald-700'
                            : ord.paymentStatus === 'DP Masuk'
                            ? 'text-sky-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {ord.paymentStatus} ({ord.paymentMethod || 'Transfer Bank'})
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {ord.status !== 'Dibatalkan' && ord.paymentStatus !== 'Lunas' ? (
                        <button
                          type="button"
                          disabled={confirmingOrderId === ord.id}
                          onClick={() => handleQuickMarkPaid(ord)}
                          className="rounded-md bg-emerald-700 hover:bg-emerald-800 px-2.5 py-1 text-[11px] font-semibold text-white whitespace-nowrap"
                        >
                          {confirmingOrderId === ord.id ? 'Menyimpan...' : 'Verifikasi Lunas'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onNavigateModule('catering')}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline"
                        >
                          Detail
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {tableOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                    Tidak ada pesanan pada periode / filter pencarian saat ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Paid Notifications & Unpaid Verification Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              <span>Notifikasi Pembayaran Masuk</span>
            </h2>
            <span className="text-xs font-mono tabular-nums font-semibold text-emerald-800">
              {paidNotifications.length} Terverifikasi
            </span>
          </div>
          {paidNotifications.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              Belum ada notifikasi pembayaran baru.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {paidNotifications.slice(0, 5).map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{item.customerName}</div>
                    <div className="font-mono tabular-nums text-[11px] text-slate-500">
                      {item.orderNumber} · {item.paymentMethod} · {item.paidAt}
                    </div>
                  </div>
                  <div className="font-mono tabular-nums font-bold text-emerald-700 shrink-0">
                    {formatRupiah(item.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span>Antrean Verifikasi Pembayaran ({unpaidQueue.length})</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigateModule('catering')}
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              Lihat Semua →
            </button>
          </div>
          {unpaidQueue.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              Seluruh pesanan aktif pada periode ini sudah berstatus Lunas.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {unpaidQueue.slice(0, 5).map((ord) => {
                const paid =
                  ord.paymentStatus === 'Lunas'
                    ? ord.totalPayment
                    : Math.max(0, ord.downPayment || 0);
                const debt = Math.max(0, ord.totalPayment - paid);
                return (
                  <div key={ord.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{ord.customerName}</div>
                      <div className="font-mono tabular-nums text-[11px] text-slate-500">
                        {ord.orderNumber} · Sisa {formatRupiah(debt)} ({ord.paymentStatus})
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={confirmingOrderId === ord.id}
                      onClick={() => handleQuickMarkPaid(ord)}
                      className="rounded-md bg-emerald-700 hover:bg-emerald-800 px-2.5 py-1.5 text-[11px] font-semibold text-white shrink-0"
                    >
                      {confirmingOrderId === ord.id ? 'Memproses...' : 'Verifikasi Lunas'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
