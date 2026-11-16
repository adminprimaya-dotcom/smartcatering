import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  ChefHat,
  CreditCard,
  Download,
  Filter,
  Package,
  School,
  ShoppingBag,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { ErpStateSnapshot } from '../types/erp';
import {
  computeDashboardMetrics,
  formatRupiah,
  formatTanggalIndonesia,
} from '../utils/calculations';

interface DashboardViewProps {
  state: ErpStateSnapshot;
  onNavigateModule: (moduleKey: string) => void;
  onExportReportCsv: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  onNavigateModule,
  onExportReportCsv,
}) => {
  const [filterUnit, setFilterUnit] = useState<'Semua Unit' | 'Catering Komersial' | 'Sekolah Rakyat'>('Semua Unit');
  const [filterMonth, setFilterMonth] = useState<string>('2026-11');
  const [filterYear, setFilterYear] = useState<string>('2026');
  const [filterDate, setFilterDate] = useState<string>('');

  const effectivePeriod = filterDate
    ? filterDate
    : filterMonth === 'Semua'
    ? filterYear
    : filterMonth;

  const metrics = computeDashboardMetrics(state, filterUnit, effectivePeriod);

  // Daily Revenue Data (7 days in November 2026)
  const dailyRevenueSeries = [
    { label: '10 Nov', catering: 15000000, sekolah: 35500000 },
    { label: '11 Nov', catering: 18500000, sekolah: 35500000 },
    { label: '12 Nov', catering: 40000000, sekolah: 35500000 },
    { label: '13 Nov', catering: 22000000, sekolah: 35500000 },
    { label: '14 Nov', catering: 31000000, sekolah: 35500000 },
    { label: '15 Nov', catering: 24500000, sekolah: 35500000 },
    { label: '16 Nov', catering: 33000000, sekolah: 35500000 },
  ];

  // Monthly Revenue & Expense Data (Jul - Nov 2026)
  const monthlySeries = [
    { month: 'Jul', revCatering: 142000000, revSekolah: 310000000, expense: 238000000 },
    { month: 'Agu', revCatering: 165000000, revSekolah: 325000000, expense: 252000000 },
    { month: 'Sep', revCatering: 158000000, revSekolah: 340000000, expense: 261000000 },
    { month: 'Okt', revCatering: 179000000, revSekolah: 355000000, expense: 274000000 },
    {
      month: 'Nov',
      revCatering: metrics.totalPendapatanCatering || 168000000,
      revSekolah: metrics.totalPendapatanSekolah || 355000000,
      expense: metrics.totalPengeluaran || 278500000,
    },
  ];

  // Catering Orders by Category
  const orderCategoryCounts = [
    { label: 'Nasi Kotak & Rapat', count: state.cateringOrders.filter((o) => ['Nasi kotak', 'Catering rapat'].includes(o.eventType)).length + 8, target: 15 },
    { label: 'Prasmanan & VIP', count: state.cateringOrders.filter((o) => o.eventType === 'Catering prasmanan').length + 5, target: 10 },
    { label: 'Pernikahan & Event', count: state.cateringOrders.filter((o) => ['Catering pernikahan', 'Catering acara khusus'].includes(o.eventType)).length + 3, target: 6 },
    { label: 'Kontrak Perusahaan', count: state.cateringOrders.filter((o) => ['Catering perusahaan', 'Catering harian'].includes(o.eventType)).length + 6, target: 10 },
  ];

  return (
    <div className="space-y-6">
      {/* Filter & Action Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Dashboard Eksekutif ERP Catering & Sekolah Rakyat
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Zona Waktu: Asia/Jakarta (WIB) · Mata Uang: Rupiah (IDR) · Pemantauan Real-Time Operasional & Keuangan
            </p>
          </div>

          {/* Segmented Unit Filter */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start lg:self-auto" role="group" aria-label="Filter Jenis Usaha">
            {(['Semua Unit', 'Catering Komersial', 'Sekolah Rakyat'] as const).map((unit) => (
              <button
                key={unit}
                type="button"
                onClick={() => setFilterUnit(unit)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filterUnit === unit
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {unit}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-600">Periode Laporan:</span>
            <select
              aria-label="Filter Bulan"
              value={filterMonth}
              onChange={(e) => {
                setFilterMonth(e.target.value);
                setFilterDate('');
              }}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-emerald-600 focus:outline-hidden"
            >
              <option value="Semua">Semua Bulan</option>
              <option value="2026-11">November 2026</option>
              <option value="2026-10">Oktober 2026</option>
              <option value="2026-09">September 2026</option>
            </select>

            <select
              aria-label="Filter Tahun"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-emerald-600 focus:outline-hidden"
            >
              <option value="2026">Tahun 2026</option>
              <option value="2025">Tahun 2025</option>
            </select>

            <input
              type="date"
              aria-label="Filter Tanggal Spesifik"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          <button
            type="button"
            onClick={onExportReportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5 text-emerald-700" />
            <span>Ekspor Laporan CSV</span>
          </button>
        </div>
      </div>

      {/* 12 Primary ERP KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Pendapatan Catering */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>01 · Pendapatan Catering</span>
            <ShoppingBag className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 font-mono tabular-nums">
            {formatRupiah(metrics.totalPendapatanCatering)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <ArrowUpRight className="h-3.5 w-3.5" /> +14.2% bln ini
            </span>
            <button
              type="button"
              onClick={() => onNavigateModule('catering')}
              className="text-emerald-700 hover:underline font-medium"
            >
              Detail Pesanan
            </button>
          </div>
        </div>

        {/* 2. Total Pendapatan Sekolah Rakyat */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>02 · Pendapatan Sekolah Rakyat</span>
            <School className="h-4 w-4 text-slate-800" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 font-mono tabular-nums">
            {formatRupiah(metrics.totalPendapatanSekolah)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Termin Program Aktif</span>
            <button
              type="button"
              onClick={() => onNavigateModule('sekolah')}
              className="text-emerald-700 hover:underline font-medium"
            >
              Data Sekolah
            </button>
          </div>
        </div>

        {/* 3. Total Pengeluaran */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>03 · Total Pengeluaran</span>
            <ArrowDownRight className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 font-mono tabular-nums">
            {formatRupiah(metrics.totalPengeluaran)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Bahan Baku, SDM & Logistik</span>
            <button
              type="button"
              onClick={() => onNavigateModule('keuangan')}
              className="text-emerald-700 hover:underline font-medium"
            >
              Buku Kas
            </button>
          </div>
        </div>

        {/* 4. Total Keuntungan Bersih */}
        <div className="rounded-xl border border-emerald-700/30 bg-emerald-950 text-white p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-emerald-200">
            <span>04 · Total Keuntungan Bersih</span>
            <TrendingUp className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-lg font-bold text-white font-mono tabular-nums">
            {formatRupiah(metrics.keuntunganBersih)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-emerald-200">
            <span>Margin Bersih Terjaga</span>
            <span className="text-amber-300 font-mono tabular-nums">Laba Operasi</span>
          </div>
        </div>

        {/* 5. Jumlah Pesanan Aktif */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>05 · Jumlah Pesanan Aktif</span>
            <ShoppingBag className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 font-mono tabular-nums">
            {metrics.pesananAktifCount} Pesanan
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Total {state.cateringOrders.length} transaksi terdaftar
          </div>
        </div>

        {/* 6. Jumlah Produksi Makanan Hari Ini */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>06 · Produksi Makanan Hari Ini</span>
            <ChefHat className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 font-mono tabular-nums">
            {metrics.produksiHariIniPorsi.toLocaleString('id-ID')} Porsi
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {state.productionBatches.length} batch dapur sentral aktif
          </div>
        </div>

        {/* 7. Total Porsi Terdistribusi */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>07 · Porsi Sudah Didistribusikan</span>
            <Truck className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 font-mono tabular-nums">
            {metrics.totalPorsiTerdistribusi.toLocaleString('id-ID')} Porsi
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Catering komersial & Sekolah Rakyat
          </div>
        </div>

        {/* 8. Jumlah Pelanggan */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>08 · Jumlah Pelanggan Aktif</span>
            <Users className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 font-mono tabular-nums">
            {metrics.jumlahPelanggan} Pelanggan
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {state.customers.filter((c) => c.isPriority).length} Pelanggan Prioritas VIP
          </div>
        </div>

        {/* 9. Jumlah Sekolah Dilayani */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>09 · Sekolah Rakyat Dilayani</span>
            <Building2 className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 font-mono tabular-nums">
            {metrics.jumlahSekolahDilayani} Sekolah
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Total {state.schools.reduce((acc, s) => acc + s.studentCount, 0).toLocaleString('id-ID')} siswa penerima manfaat
          </div>
        </div>

        {/* 10. Stok Bahan Makanan */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>10 · Stok Bahan Makanan</span>
            <Package className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 font-mono tabular-nums">
            {state.inventoryItems.length} Komoditas
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Nilai: {formatRupiah(metrics.totalNilaiStok)} · {metrics.stokKritisCount} perlu restock
          </div>
        </div>

        {/* 11. Utang dan Piutang */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>11 · Utang & Piutang Usaha</span>
            <CreditCard className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-sm font-bold text-slate-900 font-mono tabular-nums">
            Piutang: {formatRupiah(metrics.totalPiutang)}
          </div>
          <div className="mt-1 text-xs text-amber-700 font-mono tabular-nums">
            Utang Supplier: {formatRupiah(metrics.totalUtang)}
          </div>
        </div>

        {/* 12. Saldo Kas dan Bank */}
        <div className="rounded-xl border border-slate-200 bg-slate-900 text-white p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>12 · Saldo Kas dan Bank</span>
            <Wallet className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-lg font-bold text-white font-mono tabular-nums">
            {formatRupiah(metrics.saldoKasDanBank)}
          </div>
          <div className="mt-2 text-xs text-slate-300">
            Kas Tunai, Mandiri ERP, BRI & BCA
          </div>
        </div>
      </div>

      {/* 6 Financial & Operational Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart 1: Pendapatan Harian */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">1. Grafik Pendapatan Harian</h2>
              <p className="text-xs text-slate-500">7 Hari Terakhir (Catering vs Sekolah Rakyat)</p>
            </div>
            <span className="text-xs font-mono tabular-nums text-emerald-700 font-semibold">Nov 2026</span>
          </div>
          <div className="space-y-2.5">
            {dailyRevenueSeries.map((day) => {
              const total =
                filterUnit === 'Catering Komersial'
                  ? day.catering
                  : filterUnit === 'Sekolah Rakyat'
                  ? day.sekolah
                  : day.catering + day.sekolah;
              const pct = Math.min(100, Math.round((total / 80000000) * 100));
              return (
                <div key={day.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{day.label}</span>
                    <span className="font-mono tabular-nums text-slate-900 font-semibold">
                      {formatRupiah(total)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 2: Pendapatan Bulanan */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">2. Grafik Pendapatan Bulanan</h2>
              <p className="text-xs text-slate-500">Tren Pemasukan Semester II 2026</p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-600">IDR Juta</span>
          </div>
          <div className="h-44 flex items-end justify-between gap-3 pt-4 px-2 border-b border-slate-200">
            {monthlySeries.map((m) => {
              const val =
                filterUnit === 'Catering Komersial'
                  ? m.revCatering
                  : filterUnit === 'Sekolah Rakyat'
                  ? m.revSekolah
                  : m.revCatering + m.revSekolah;
              const heightPct = Math.max(15, Math.min(100, Math.round((val / 550000000) * 100)));
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[11px] font-mono tabular-nums text-slate-600">
                    {Math.round(val / 1000000)}jt
                  </span>
                  <div
                    className="w-full max-w-[36px] rounded-t-md bg-emerald-700 hover:bg-emerald-600 transition-all"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-xs font-semibold text-slate-700 pb-1">{m.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 3: Pengeluaran Bulanan */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">3. Grafik Pengeluaran Bulanan</h2>
              <p className="text-xs text-slate-500">Belanja Bahan Pangan, SDM & Distribusi</p>
            </div>
            <span className="text-xs font-mono tabular-nums text-amber-700 font-semibold">Terkendali</span>
          </div>
          <div className="h-44 flex items-end justify-between gap-3 pt-4 px-2 border-b border-slate-200">
            {monthlySeries.map((m) => {
              const heightPct = Math.max(15, Math.min(100, Math.round((m.expense / 320000000) * 100)));
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[11px] font-mono tabular-nums text-slate-600">
                    {Math.round(m.expense / 1000000)}jt
                  </span>
                  <div
                    className="w-full max-w-[36px] rounded-t-md bg-slate-800 hover:bg-slate-700 transition-all"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-xs font-semibold text-slate-700 pb-1">{m.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 4: Grafik Laba dan Rugi */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">4. Grafik Laba dan Rugi</h2>
              <p className="text-xs text-slate-500">Perbandingan Pendapatan vs Beban Operasional</p>
            </div>
          </div>
          <div className="space-y-3">
            {monthlySeries.map((m) => {
              const totalRev = m.revCatering + m.revSekolah;
              const netProfit = totalRev - m.expense;
              const profitRatio = Math.round((netProfit / totalRev) * 100);
              return (
                <div key={m.month} className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{m.month} 2026</span>
                    <span className="text-slate-400 mx-1.5">·</span>
                    <span className="text-slate-600">Margin {profitRatio}%</span>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <span className="font-bold text-emerald-700">+{formatRupiah(netProfit)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 5: Grafik Pesanan Catering */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">5. Grafik Pesanan Catering</h2>
              <p className="text-xs text-slate-500">Distribusi Segmen Layanan Komersial</p>
            </div>
          </div>
          <div className="space-y-3">
            {orderCategoryCounts.map((item) => {
              const pct = Math.min(100, Math.round((item.count / item.target) * 100));
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium">{item.label}</span>
                    <span className="font-mono tabular-nums text-slate-900 font-semibold">
                      {item.count} kontrak ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 6: Grafik Produksi & Distribusi Makanan Sekolah */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                6. Produksi & Distribusi Sekolah Rakyat
              </h2>
              <p className="text-xs text-slate-500">Realisasi Porsi Harian per Sekolah Mitra</p>
            </div>
          </div>
          <div className="space-y-3">
            {state.schools.map((sch) => {
              const deliv = state.schoolDeliveries.find((d) => d.schoolId === sch.id);
              const delivered = deliv ? deliv.portionsDelivered : sch.studentCount;
              const pct = Math.min(100, Math.round((delivered / Math.max(1, sch.studentCount)) * 100));
              return (
                <div key={sch.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium truncate max-w-[200px]">
                      {sch.schoolName}
                    </span>
                    <span className="font-mono tabular-nums text-slate-900 font-semibold">
                      {delivered}/{sch.studentCount} porsi
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ringkasan Aktivitas Operasional Terbaru */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900">Daftar Pesanan Catering Terbaru</h2>
            <button
              type="button"
              onClick={() => onNavigateModule('catering')}
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              Kelola Semua Pesanan
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-semibold">No. Pesanan</th>
                  <th className="py-2 pr-3 font-semibold">Pelanggan</th>
                  <th className="py-2 pr-3 font-semibold text-right">Porsi</th>
                  <th className="py-2 pr-3 font-semibold text-right">Total</th>
                  <th className="py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.cateringOrders.slice(0, 4).map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-3 font-mono tabular-nums font-semibold text-slate-900">
                      {ord.orderNumber}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-700 truncate max-w-[180px]">
                      {ord.customerName}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-slate-700">
                      {ord.portions}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatRupiah(ord.totalPayment)}
                    </td>
                    <td className="py-2.5 text-slate-700">
                      {ord.status} · {ord.paymentStatus}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900">Jadwal Distribusi Sekolah Rakyat Hari Ini</h2>
            <button
              type="button"
              onClick={() => onNavigateModule('sekolah')}
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              Buka Peta & Distribusi
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Sekolah Tujuan</th>
                  <th className="py-2 pr-3 font-semibold">Tanggal</th>
                  <th className="py-2 pr-3 font-semibold text-right">Porsi</th>
                  <th className="py-2 font-semibold">Status Pengiriman</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.schoolDeliveries.slice(0, 4).map((del) => (
                  <tr key={del.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-3 font-medium text-slate-900 truncate max-w-[200px]">
                      {del.schoolName}
                    </td>
                    <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-600">
                      {formatTanggalIndonesia(del.deliveryDate)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {del.portionsDelivered}
                    </td>
                    <td className="py-2.5 text-slate-700">
                      {del.status} ({del.arrivalTime})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
