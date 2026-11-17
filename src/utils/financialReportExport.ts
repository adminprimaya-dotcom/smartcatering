import { ErpStateSnapshot, FinanceEntry, SiteContentSettings } from '../types/erp';
import { computeDashboardMetrics, formatRupiah, formatTanggalIndonesia } from './calculations';

export interface FinancialReportSummary {
  pendapatanCatering: number;
  pendapatanSekolah: number;
  totalPendapatan: number;
  pengeluaranOperasional: number;
  labaBersih: number;
  marginLabaPercent: number;
  totalPiutang: number;
  totalUtang: number;
  saldoKasDanBank: number;
  byAccount: {
    accountMethod: string;
    totalMasuk: number;
    totalKeluar: number;
    saldoBersih: number;
    count: number;
  }[];
}

export function computeFinancialReportSummary(
  entries: FinanceEntry[],
  fullSnapshot: ErpStateSnapshot
): FinancialReportSummary {
  const metrics = computeDashboardMetrics(fullSnapshot);

  const pendapatanCatering = entries
    .filter((f) => f.type === 'Pendapatan Catering')
    .reduce((acc, f) => acc + f.amount, 0);

  const pendapatanSekolah = entries
    .filter((f) => f.type === 'Pendapatan Sekolah Rakyat')
    .reduce((acc, f) => acc + f.amount, 0);

  const totalPendapatan = pendapatanCatering + pendapatanSekolah;

  const pengeluaranOperasional = entries
    .filter((f) => f.type === 'Pengeluaran Operasional')
    .reduce((acc, f) => acc + f.amount, 0);

  const labaBersih = totalPendapatan - pengeluaranOperasional;
  const marginLabaPercent =
    totalPendapatan > 0 ? Math.round((labaBersih / totalPendapatan) * 1000) / 10 : 0;

  const totalPiutang = entries
    .filter((f) => f.type === 'Piutang Pelanggan' && f.settlementStatus === 'Belum Lunas')
    .reduce((acc, f) => acc + f.amount, 0);

  const totalUtang = entries
    .filter((f) => f.type === 'Utang Supplier' && f.settlementStatus === 'Belum Lunas')
    .reduce((acc, f) => acc + f.amount, 0);

  const accountNames: FinanceEntry['accountMethod'][] = [
    'QRIS',
    'Bank Mandiri ERP',
    'Bank BRI Sekolah Rakyat',
    'Bank BCA Corporate',
    'Kas Tunai',
  ];

  const byAccount = accountNames.map((accName) => {
    const matching = entries.filter((f) => f.accountMethod === accName);
    const totalMasuk = matching
      .filter((f) => f.type === 'Pendapatan Catering' || f.type === 'Pendapatan Sekolah Rakyat')
      .reduce((s, f) => s + f.amount, 0);
    const totalKeluar = matching
      .filter((f) => f.type === 'Pengeluaran Operasional' || f.type === 'Utang Supplier')
      .reduce((s, f) => s + f.amount, 0);
    return {
      accountMethod: accName,
      totalMasuk,
      totalKeluar,
      saldoBersih: totalMasuk - totalKeluar,
      count: matching.length,
    };
  });

  return {
    pendapatanCatering,
    pendapatanSekolah,
    totalPendapatan,
    pengeluaranOperasional,
    labaBersih,
    marginLabaPercent,
    totalPiutang: Math.max(totalPiutang, metrics.totalPiutang),
    totalUtang: Math.max(totalUtang, metrics.totalUtang),
    saldoKasDanBank: metrics.saldoKasDanBank,
    byAccount,
  };
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildOfficialFinancialReportHtml(params: {
  entries: FinanceEntry[];
  snapshot: ErpStateSnapshot;
  siteSettings?: SiteContentSettings;
  adminName?: string;
  adminRole?: string;
  filterLabel?: string;
}): string {
  const {
    entries,
    snapshot,
    siteSettings,
    adminName = 'Ir. Pratama Wijaya, MBA',
    adminRole = 'Super Admin & Direktur Keuangan',
    filterLabel = 'Seluruh Unit Usaha (Catering Komersial & Sekolah Rakyat)',
  } = params;

  const summary = computeFinancialReportSummary(entries, snapshot);
  const brandTitle = siteSettings?.erpSystemTitle || 'SMART CATERING & SEKOLAH RAKYAT MANAGEMENT SYSTEM';
  const address =
    siteSettings?.companyAddress ||
    'Jl. Proklamasi No. 42, Menteng, Jakarta Pusat 10320';
  const phone = siteSettings?.whatsappDisplay || '0811-9823-401';
  const docNumber = `LPJ-KEU/${new Date().getFullYear()}/XI/00${entries.length}`;
  const printedDate = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(new Date());

  const rowsHtml = entries
    .map(
      (f, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td class="mono">${escapeHtml(f.referenceCode)}</td>
        <td>${escapeHtml(formatTanggalIndonesia(f.transactionDate))}</td>
        <td><strong>${escapeHtml(f.type)}</strong><br/><span style="color:#475569;font-size:11px;">${escapeHtml(f.category)}</span></td>
        <td>${escapeHtml(f.description)}</td>
        <td>${escapeHtml(f.accountMethod)}</td>
        <td style="text-align:center;">${escapeHtml(f.settlementStatus)}</td>
        <td class="mono" style="text-align:right;font-weight:700;color:${
          f.type.startsWith('Pendapatan') ? '#047857' : f.type === 'Pengeluaran Operasional' ? '#b91c1c' : '#0f172a'
        };">${escapeHtml(formatRupiah(f.amount))}</td>
      </tr>`
    )
    .join('');

  const accountRowsHtml = summary.byAccount
    .map(
      (acc) => `
      <tr>
        <td><strong>${escapeHtml(acc.accountMethod)}</strong></td>
        <td style="text-align:center;">${acc.count} transaksi</td>
        <td class="mono" style="text-align:right;color:#047857;">${escapeHtml(formatRupiah(acc.totalMasuk))}</td>
        <td class="mono" style="text-align:right;color:#b91c1c;">${escapeHtml(formatRupiah(acc.totalKeluar))}</td>
        <td class="mono" style="text-align:right;font-weight:700;">${escapeHtml(formatRupiah(acc.saldoBersih))}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Laporan Keuangan Resmi - ${escapeHtml(brandTitle)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 32px 40px;
      font-size: 12px;
      line-height: 1.5;
    }
    .header-kop {
      border-bottom: 3px double #0f172a;
      padding-bottom: 16px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      color: #065f46;
      letter-spacing: -0.02em;
      margin: 0 0 4px 0;
      text-transform: uppercase;
    }
    .brand-sub {
      font-size: 11px;
      color: #475569;
      margin: 0;
    }
    .doc-meta {
      text-align: right;
      font-size: 11px;
      color: #334155;
    }
    .report-banner {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 22px;
    }
    .report-banner h1 {
      font-size: 15px;
      margin: 0 0 4px 0;
      color: #0f172a;
      text-transform: uppercase;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .kpi-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px 14px;
      background: #ffffff;
    }
    .kpi-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .kpi-val {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }
    h2.section-title {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      color: #0f172a;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 6px;
      margin: 22px 0 12px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 11.5px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      vertical-align: top;
    }
    th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10.5px;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-variant-numeric: tabular-nums;
    }
    .sign-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      margin-top: 36px;
      text-align: center;
      page-break-inside: avoid;
    }
    .sign-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px;
    }
    .sign-space {
      height: 56px;
    }
    @media print {
      body { padding: 12px; }
    }
  </style>
</head>
<body>
  <div class="header-kop">
    <div>
      <p class="brand-title">${escapeHtml(brandTitle)}</p>
      <p class="brand-sub">${escapeHtml(address)}</p>
      <p class="brand-sub">Kontak Resmi / WhatsApp: ${escapeHtml(phone)} · Standar Akuntansi Keuangan Indonesia</p>
    </div>
    <div class="doc-meta">
      <div><strong>No. Dokumen:</strong> <span class="mono">${escapeHtml(docNumber)}</span></div>
      <div><strong>Tanggal Cetak:</strong> ${escapeHtml(printedDate)} WIB</div>
      <div><strong>Mata Uang:</strong> Rupiah (IDR)</div>
    </div>
  </div>

  <div class="report-banner">
    <h1>Laporan Pertanggungjawaban Keuangan, Laba Rugi & Jurnal Pembukuan</h1>
    <div><strong>Cakupan Laporan:</strong> ${escapeHtml(filterLabel)} · <strong>Total Transaksi Tercatat:</strong> ${entries.length} Jurnal</div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Total Pendapatan Bruto</div>
      <div class="kpi-val" style="color:#047857;">${escapeHtml(formatRupiah(summary.totalPendapatan))}</div>
      <div style="font-size:10px;color:#64748b;margin-top:3px;">Catering + Sekolah Rakyat</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Pengeluaran Operasional</div>
      <div class="kpi-val" style="color:#b91c1c;">${escapeHtml(formatRupiah(summary.pengeluaranOperasional))}</div>
      <div style="font-size:10px;color:#64748b;margin-top:3px;">Bahan Baku, Dapur & Logistik</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Laba Bersih Operasional</div>
      <div class="kpi-val" style="color:#065f46;">${escapeHtml(formatRupiah(summary.labaBersih))}</div>
      <div style="font-size:10px;color:#64748b;margin-top:3px;">Margin Laba Bersih: ${summary.marginLabaPercent}%</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Posisi Kas & Bank Terpadu</div>
      <div class="kpi-val" style="color:#0f172a;">${escapeHtml(formatRupiah(summary.saldoKasDanBank))}</div>
      <div style="font-size:10px;color:#64748b;margin-top:3px;">Piutang: ${escapeHtml(formatRupiah(summary.totalPiutang))}</div>
    </div>
  </div>

  <h2 class="section-title">I. Ringkasan Laporan Laba Rugi (Income Statement)</h2>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">Komponen Akun Keuangan</th>
        <th style="text-align:left;">Keterangan Sumber / Saluran</th>
        <th style="text-align:right;">Nominal (IDR)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>1. Pendapatan Usaha Catering Komersial</strong></td>
        <td>Kontrak korporasi, nasi kotak, prasmanan, rapat & acara khusus</td>
        <td class="mono" style="text-align:right;color:#047857;font-weight:700;">${escapeHtml(formatRupiah(summary.pendapatanCatering))}</td>
      </tr>
      <tr>
        <td><strong>2. Pendapatan Program Sekolah Rakyat</strong></td>
        <td>Pencairan dana penyediaan makanan bergizi siswa Sekolah Rakyat</td>
        <td class="mono" style="text-align:right;color:#047857;font-weight:700;">${escapeHtml(formatRupiah(summary.pendapatanSekolah))}</td>
      </tr>
      <tr style="background:#f8fafc;">
        <td colspan="2"><strong>TOTAL PENDAPATAN OPERASIONAL (1 + 2)</strong></td>
        <td class="mono" style="text-align:right;font-weight:800;color:#065f46;">${escapeHtml(formatRupiah(summary.totalPendapatan))}</td>
      </tr>
      <tr>
        <td><strong>3. Beban Pokok Produksi & Pengeluaran Operasional</strong></td>
        <td>Pengadaan bahan baku dapur sentral, distribusi armada & operasional</td>
        <td class="mono" style="text-align:right;color:#b91c1c;font-weight:700;">(${escapeHtml(formatRupiah(summary.pengeluaranOperasional))})</td>
      </tr>
      <tr style="background:#ecfdf5;">
        <td colspan="2"><strong>LABA BERSIH OPERASIONAL SEBELUM PAJAK (NET PROFIT)</strong></td>
        <td class="mono" style="text-align:right;font-weight:800;font-size:13px;color:#065f46;">${escapeHtml(formatRupiah(summary.labaBersih))}</td>
      </tr>
      <tr>
        <td><strong>4. Posisi Piutang Pelanggan & Utang Supplier Aktif</strong></td>
        <td>Piutang Pelanggan: ${escapeHtml(formatRupiah(summary.totalPiutang))} · Utang Supplier: ${escapeHtml(formatRupiah(summary.totalUtang))}</td>
        <td class="mono" style="text-align:right;font-weight:700;">Selisih: ${escapeHtml(formatRupiah(summary.totalPiutang - summary.totalUtang))}</td>
      </tr>
    </tbody>
  </table>

  <h2 class="section-title">II. Rekapitulasi Arus Kas per Rekening Bank & Kas Tunai</h2>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">Nama Rekening Kas / Bank</th>
        <th style="text-align:center;">Frekuensi</th>
        <th style="text-align:right;">Total Arus Masuk (Debit)</th>
        <th style="text-align:right;">Total Arus Keluar (Kredit)</th>
        <th style="text-align:right;">Surplus / Defisit Periode</th>
      </tr>
    </thead>
    <tbody>
      ${accountRowsHtml}
    </tbody>
  </table>

  <h2 class="section-title">III. Rincian Jurnal Transaksi Keuangan Lengkap</h2>
  <table>
    <thead>
      <tr>
        <th style="width:36px;text-align:center;">No</th>
        <th style="text-align:left;">No. Referensi</th>
        <th style="text-align:left;">Tanggal</th>
        <th style="text-align:left;">Jenis & Kategori Akun</th>
        <th style="text-align:left;">Uraian Bukti Transaksi</th>
        <th style="text-align:left;">Rekening</th>
        <th style="text-align:center;">Status</th>
        <th style="text-align:right;">Nominal (IDR)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="sign-grid">
    <div class="sign-box">
      <div>Disiapkan Oleh,</div>
      <div style="font-weight:700;color:#475569;">Divisi Akuntansi & Keuangan</div>
      <div class="sign-space"></div>
      <div style="font-weight:800;text-decoration:underline;">Dra. Ratna Sari, Ak., CA</div>
      <div style="font-size:10.5px;color:#64748b;">Akuntan Keuangan Senior</div>
    </div>
    <div class="sign-box">
      <div>Diperiksa Oleh,</div>
      <div style="font-weight:700;color:#475569;">Manajemen Operasional & Distribusi</div>
      <div class="sign-space"></div>
      <div style="font-weight:800;text-decoration:underline;">Hendra Gunawan, S.T.</div>
      <div style="font-size:10.5px;color:#64748b;">Manajer Operasional ERP</div>
    </div>
    <div class="sign-box">
      <div>Disahkan & Disetujui Oleh,</div>
      <div style="font-weight:700;color:#475569;">${escapeHtml(adminRole)}</div>
      <div class="sign-space"></div>
      <div style="font-weight:800;text-decoration:underline;">${escapeHtml(adminName)}</div>
      <div style="font-size:10.5px;color:#64748b;">Pimpinan Utama Smart Catering</div>
    </div>
  </div>
</body>
</html>`;
}

export function downloadProfessionalFinancialHtml(params: {
  entries: FinanceEntry[];
  snapshot: ErpStateSnapshot;
  siteSettings?: SiteContentSettings;
  adminName?: string;
  adminRole?: string;
  filterLabel?: string;
}): void {
  const html = buildOfficialFinancialReportHtml(params);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Laporan-Keuangan-Resmi-Smart-Catering-${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadProfessionalFinancialExcel(params: {
  entries: FinanceEntry[];
  snapshot: ErpStateSnapshot;
  siteSettings?: SiteContentSettings;
  adminName?: string;
  adminRole?: string;
  filterLabel?: string;
}): void {
  const html = buildOfficialFinancialReportHtml(params);
  // Prepend UTF-8 BOM so Microsoft Excel & LibreOffice Calc render Indonesian currency and tables cleanly
  const blob = new Blob(['\uFEFF', html], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Laporan-Akuntansi-Lengkap-Smart-Catering-${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadProfessionalFinancialCsv(params: {
  entries: FinanceEntry[];
  snapshot: ErpStateSnapshot;
  siteSettings?: SiteContentSettings;
}): void {
  const { entries, snapshot, siteSettings } = params;
  const summary = computeFinancialReportSummary(entries, snapshot);
  const brandTitle =
    siteSettings?.erpSystemTitle || 'SMART CATERING & SEKOLAH RAKYAT MANAGEMENT SYSTEM';

  const summaryRows = [
    [`"LAPORAN KEUANGAN & JURNAL AKUNTANSI RESMI - ${brandTitle.replace(/"/g, '""')}"`],
    [`"Tanggal Unduh"`, `"${new Date().toISOString().slice(0, 10)}"`, `"Zona Waktu"`, `"Asia/Jakarta (WIB)"`],
    [],
    [`"RINGKASAN EKSEKUTIF LABA RUGI"`, `"NOMINAL (IDR)"`],
    [`"Total Pendapatan Catering Komersial"`, String(summary.pendapatanCatering)],
    [`"Total Pendapatan Program Sekolah Rakyat"`, String(summary.pendapatanSekolah)],
    [`"Total Pendapatan Operasional Bruto"`, String(summary.totalPendapatan)],
    [`"Total Pengeluaran Operasional"`, String(summary.pengeluaranOperasional)],
    [`"Laba Bersih Operasional (Net Profit)"`, String(summary.labaBersih)],
    [`"Margin Laba Bersih (%)"`, `${summary.marginLabaPercent}%`],
    [`"Total Piutang Pelanggan"`, String(summary.totalPiutang)],
    [`"Total Utang Supplier"`, String(summary.totalUtang)],
    [`"Posisi Saldo Kas & Bank Terpadu"`, String(summary.saldoKasDanBank)],
    [],
    [
      `"No"`,
      `"Tanggal Transaksi"`,
      `"Kode Referensi"`,
      `"Jenis Akun"`,
      `"Kategori Pembukuan"`,
      `"Uraian Bukti Transaksi"`,
      `"Rekening Kas/Bank"`,
      `"Status Penyelesaian"`,
      `"Nominal (IDR)"`,
    ],
  ];

  const detailRows = entries.map((f, index) => [
    String(index + 1),
    f.transactionDate,
    f.referenceCode,
    `"${f.type.replace(/"/g, '""')}"`,
    `"${f.category.replace(/"/g, '""')}"`,
    `"${f.description.replace(/"/g, '""')}"`,
    `"${f.accountMethod.replace(/"/g, '""')}"`,
    f.settlementStatus,
    String(f.amount),
  ]);

  const csvBody = [...summaryRows, ...detailRows].map((r) => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csvBody], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Jurnal-dan-Laba-Rugi-Smart-Catering-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
