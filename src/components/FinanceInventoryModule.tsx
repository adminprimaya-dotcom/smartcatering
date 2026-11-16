import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  DatabaseBackup,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Lock,
  Package,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  Upload,
  User,
  Wallet,
  X,
} from 'lucide-react';
import {
  ErpStateSnapshot,
  FinanceEntry,
  InventoryItem,
  PromotionItem,
  SiteContentSettings,
  UserProfileRecord,
  UserRole,
} from '../types/erp';
import { formatRupiah, formatTanggalIndonesia } from '../utils/calculations';
import {
  computeFinancialReportSummary,
  downloadProfessionalFinancialCsv,
  downloadProfessionalFinancialExcel,
  downloadProfessionalFinancialHtml,
} from '../utils/financialReportExport';

interface FinanceInventoryModuleProps {
  activeSection: 'keuangan' | 'stok' | 'pemasaran' | 'backup';
  ownerId: string;
  state: ErpStateSnapshot;
  currentRole: UserRole;
  siteSettings?: SiteContentSettings;
  adminUsername?: string;
  adminEmail?: string;
  adminDisplayName?: string;
  onUpdateAdminCredentials?: (updated: {
    username: string;
    email: string;
    displayName: string;
    role: UserRole;
  }) => Promise<void>;
  onSaveFinance: (entry: FinanceEntry) => Promise<void>;
  onDeleteFinance: (id: string) => Promise<void>;
  onSaveInventory: (item: InventoryItem) => Promise<void>;
  onDeleteInventory: (id: string) => Promise<void>;
  onSavePromotion: (promo: PromotionItem) => Promise<void>;
  onDeletePromotion: (id: string) => Promise<void>;
  onSaveUser: (user: UserProfileRecord) => Promise<void>;
  onRestoreBackup: (snapshot: ErpStateSnapshot) => Promise<void>;
}

export const FinanceInventoryModule: React.FC<FinanceInventoryModuleProps> = ({
  activeSection,
  ownerId,
  state,
  currentRole,
  siteSettings,
  adminUsername = 'admin',
  adminEmail = 'primayaadmin@gmail.com',
  adminDisplayName = 'Ir. Pratama Wijaya, MBA',
  onUpdateAdminCredentials,
  onSaveFinance,
  onDeleteFinance,
  onSaveInventory,
  onDeleteInventory,
  onSavePromotion,
  onDeletePromotion,
  onSaveUser,
  onRestoreBackup,
}) => {
  const [feedback, setFeedback] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Financial Report Filter & Official Document Preview State
  const [finFilterType, setFinFilterType] = useState<'Semua' | FinanceEntry['type']>('Semua');
  const [finFilterStatus, setFinFilterStatus] = useState<'Semua' | 'Lunas' | 'Belum Lunas'>('Semua');
  const [finSearch, setFinSearch] = useState('');
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);

  // Admin Credential Changer Form State
  const [credUsername, setCredUsername] = useState(adminUsername);
  const [credDisplayName, setCredDisplayName] = useState(adminDisplayName);
  const [credEmail, setCredEmail] = useState(adminEmail);
  const [credCurrentPassword, setCredCurrentPassword] = useState('SmartCatering2026!');
  const [credNewPassword, setCredNewPassword] = useState('');
  const [credConfirmPassword, setCredConfirmPassword] = useState('');
  const [showCredCurrentPwd, setShowCredCurrentPwd] = useState(false);
  const [showCredNewPwd, setShowCredNewPwd] = useState(false);
  const [credError, setCredError] = useState('');
  const [credSuccess, setCredSuccess] = useState('');
  const [savingCreds, setSavingCreds] = useState(false);

  useEffect(() => {
    setCredUsername(adminUsername);
    setCredDisplayName(adminDisplayName);
    setCredEmail(adminEmail);
  }, [adminUsername, adminDisplayName, adminEmail]);

  const handleSaveAdminCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredError('');
    setCredSuccess('');

    const cleanedUsername = credUsername.trim().replace(/\s+/g, '');
    if (cleanedUsername.length < 3) {
      setCredError('Username baru minimal harus 3 karakter tanpa spasi.');
      return;
    }
    if (!credCurrentPassword) {
      setCredError('Masukkan kata sandi saat ini untuk konfirmasi keamanan.');
      return;
    }
    if (credNewPassword && credNewPassword.length < 6) {
      setCredError('Kata sandi baru minimal harus 6 karakter.');
      return;
    }
    if (credNewPassword && credNewPassword !== credConfirmPassword) {
      setCredError('Konfirmasi kata sandi baru tidak sama.');
      return;
    }

    setSavingCreds(true);
    try {
      const res = await fetch('/api/admin/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: credCurrentPassword,
          newUsername: cleanedUsername,
          newDisplayName: credDisplayName.trim(),
          newEmail: credEmail.trim(),
          newPassword: credNewPassword || undefined,
          confirmPassword: credConfirmPassword || undefined,
          newRole: currentRole,
        }),
      });
      const data = await res.json();
      if (!data.updated) {
        setCredError(data.error || 'Gagal memperbarui username dan kata sandi.');
        return;
      }

      if (onUpdateAdminCredentials && data.account) {
        await onUpdateAdminCredentials({
          username: data.account.username,
          email: data.account.email,
          displayName: data.account.displayName,
          role: data.account.role as UserRole,
        });
      }

      if (credNewPassword) {
        setCredCurrentPassword(credNewPassword);
      }
      setCredNewPassword('');
      setCredConfirmPassword('');
      const msg =
        data.message ||
        `Berhasil! Username admin kini @${cleanedUsername}${
          credNewPassword ? ' beserta kata sandi baru.' : '.'
        }`;
      setCredSuccess(msg);
      notify(msg);
    } catch {
      setCredError('Terjadi gangguan jaringan saat menyimpan pengaturan akun admin.');
    } finally {
      setSavingCreds(false);
    }
  };

  // Finance Form State
  const [showFinForm, setShowFinForm] = useState(false);
  const [finDate, setFinDate] = useState('2026-11-16');
  const [finType, setFinType] = useState<FinanceEntry['type']>('Pendapatan Catering');
  const [finCategory, setFinCategory] = useState('Pelunasan Invoice Catering');
  const [finDesc, setFinDesc] = useState('');
  const [finAmount, setFinAmount] = useState(15000000);
  const [finAccount, setFinAccount] = useState<FinanceEntry['accountMethod']>('Bank Mandiri ERP');
  const [finStatus, setFinStatus] = useState<FinanceEntry['settlementStatus']>('Lunas');

  // Inventory Form State
  const [showInvForm, setShowInvForm] = useState(false);
  const [invCode, setInvCode] = useState(`BHN-00${state.inventoryItems.length + 1}`);
  const [invName, setInvName] = useState('');
  const [invCategory, setInvCategory] = useState('Bahan Pokok');
  const [invQty, setInvQty] = useState(250);
  const [invMin, setInvMin] = useState(100);
  const [invUnit, setInvUnit] = useState('kg');
  const [invCost, setInvCost] = useState(15000);
  const [invSupplier, setInvSupplier] = useState('');

  // Promotion Form State
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoTitle, setPromoTitle] = useState('');
  const [promoSegment, setPromoSegment] = useState('Catering Rapat & Perusahaan');
  const [promoDisc, setPromoDisc] = useState(10);
  const [promoMax, setPromoMax] = useState(2000000);
  const [promoValid, setPromoValid] = useState('2026-12-31');

  // New User RBAC Form State
  const [showUserForm, setShowUserForm] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('Staf Operasional');
  const [newUserDept, setNewUserDept] = useState('Operasional & Distribusi');

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 4000);
  };

  // Finance Submit
  const handleFinanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finDesc.trim()) {
      notify('Mohon isi deskripsi transaksi pembukuan.');
      return;
    }
    await onSaveFinance({
      id: `fin-${Date.now()}`,
      ownerId,
      transactionDate: finDate,
      referenceCode: `TRX-${finDate.replace(/[^0-9]/g, '')}-${state.financeEntries.length + 1}`,
      type: finType,
      category: finCategory.trim(),
      description: finDesc.trim(),
      amount: Number(finAmount),
      accountMethod: finAccount,
      settlementStatus: finStatus,
    });
    setShowFinForm(false);
    setFinDesc('');
    notify('Jurnal transaksi keuangan berhasil disimpan ke Cloud Firestore.');
  };

  // Inventory Submit
  const handleInventorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invName.trim() || !invSupplier.trim()) {
      notify('Mohon isi nama bahan makanan dan nama pemasok (supplier).');
      return;
    }
    await onSaveInventory({
      id: `inv-${Date.now()}`,
      ownerId,
      itemCode: invCode.trim() || `BHN-${Date.now()}`,
      name: invName.trim(),
      category: invCategory.trim(),
      stockQty: Number(invQty),
      minStock: Number(invMin),
      unit: invUnit.trim(),
      unitCost: Number(invCost),
      supplierName: invSupplier.trim(),
      lastRestockDate: '2026-11-16',
    });
    setShowInvForm(false);
    setInvName('');
    setInvSupplier('');
    notify('Komoditas stok bahan makanan berhasil ditambahkan.');
  };

  // Promotion Submit
  const handlePromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim() || !promoTitle.trim()) {
      notify('Mohon lengkapi kode voucher dan nama program promosi.');
      return;
    }
    await onSavePromotion({
      id: `promo-${Date.now()}`,
      ownerId,
      promoCode: promoCode.trim().toUpperCase(),
      title: promoTitle.trim(),
      targetSegment: promoSegment.trim(),
      discountPercent: Number(promoDisc),
      maxDiscountAmount: Number(promoMax),
      validUntil: promoValid,
      active: true,
      usageCount: 0,
    });
    setShowPromoForm(false);
    setPromoCode('');
    setPromoTitle('');
    notify('Kampanye promosi & kode voucher berhasil diterbitkan.');
  };

  // User RBAC Submit
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      notify('Mohon isi nama lengkap dan alamat email pengguna.');
      return;
    }
    await onSaveUser({
      id: `usr-${Date.now()}`,
      ownerId,
      displayName: newUserName.trim(),
      email: newUserEmail.trim(),
      role: newUserRole,
      department: newUserDept.trim(),
      status: 'Aktif',
    });
    setShowUserForm(false);
    setNewUserName('');
    setNewUserEmail('');
    notify('Hak akses pengguna (RBAC) berhasil ditambahkan.');
  };

  // Backup Download JSON
  const handleDownloadBackup = () => {
    const backupPayload = {
      app: 'Smart Catering & Sekolah Rakyat Management System',
      exportedAt: new Date().toISOString(),
      timezone: 'Asia/Jakarta',
      currency: 'IDR',
      data: state,
    };
    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-smart-catering-sekolah-rakyat-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('File Backup JSON seluruh database berhasil diunduh.');
  };

  // Restore JSON Upload
  const handleFileRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const snapshot: ErpStateSnapshot = parsed.data || parsed;
      if (!Array.isArray(snapshot.menuItems) || !Array.isArray(snapshot.schools)) {
        notify('Format file backup tidak valid. Pastikan menggunakan file backup JSON resmi.');
        return;
      }
      await onRestoreBackup(snapshot);
      notify('Seluruh data berhasil di-restore dan disinkronkan ke Cloud Firestore.');
    } catch {
      notify('Gagal membaca file backup JSON.');
    }
  };

  const filteredFinanceEntries = state.financeEntries.filter((f) => {
    const matchType = finFilterType === 'Semua' || f.type === finFilterType;
    const matchStatus = finFilterStatus === 'Semua' || f.settlementStatus === finFilterStatus;
    const q = finSearch.trim().toLowerCase();
    const matchSearch =
      !q ||
      f.referenceCode.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q) ||
      f.accountMethod.toLowerCase().includes(q);
    return matchType && matchStatus && matchSearch;
  });

  const financialSummary = computeFinancialReportSummary(filteredFinanceEntries, state);
  const currentFilterLabel =
    finFilterType === 'Semua' && finFilterStatus === 'Semua'
      ? 'Seluruh Unit Usaha (Catering Komersial & Sekolah Rakyat)'
      : `Filter Akun: ${finFilterType} · Status: ${finFilterStatus}`;

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900">
          {feedback}
        </div>
      )}

      {/* SECTION 1: KEUANGAN, AKUNTANSI & PELAPORAN RESMI */}
      {activeSection === 'keuangan' && (
        <div className="space-y-6">
          {/* Executive Financial Header & Multi-Format Professional Export Center */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="bg-slate-900 px-5 py-4 text-white flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold shrink-0">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold tracking-tight">
                    Pembukuan, Laba Rugi & Pusat Unduhan Laporan Keuangan Profesional
                  </h1>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Standar Akuntansi Indonesia · Unduh Dokumen Resmi Siap Cetak/PDF, Spreadsheet Excel (.XLS), atau Jurnal CSV
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setReportPreviewOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap"
                >
                  <Printer className="h-3.5 w-3.5 text-amber-400" />
                  <span>Pratinjau & Cetak PDF Resmi</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadProfessionalFinancialHtml({
                      entries: filteredFinanceEntries,
                      snapshot: state,
                      siteSettings,
                      adminName: adminDisplayName,
                      adminRole: currentRole,
                      filterLabel: currentFilterLabel,
                    });
                    notify(
                      'Dokumen Laporan Keuangan Resmi (.HTML Siap Cetak/PDF) berhasil diunduh.'
                    );
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white transition-colors whitespace-nowrap"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Unduh Laporan Resmi (.HTML/PDF)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadProfessionalFinancialExcel({
                      entries: filteredFinanceEntries,
                      snapshot: state,
                      siteSettings,
                      adminName: adminDisplayName,
                      adminRole: currentRole,
                      filterLabel: currentFilterLabel,
                    });
                    notify(
                      'Spreadsheet Akuntansi Lengkap (.XLS Microsoft Excel) berhasil diunduh.'
                    );
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 px-3.5 py-2 text-xs font-bold text-slate-950 transition-colors whitespace-nowrap"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Unduh Excel (.XLS)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadProfessionalFinancialCsv({
                      entries: filteredFinanceEntries,
                      snapshot: state,
                      siteSettings,
                    });
                    notify('File CSV Jurnal & Rekap Laba Rugi berhasil diunduh.');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white transition-colors whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Unduh CSV</span>
                </button>
              </div>
            </div>

            {/* 4 Executive Financial KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-slate-50/70 border-b border-slate-200 text-xs">
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
                <span className="text-slate-500 font-semibold block">
                  Total Pendapatan Bruto
                </span>
                <span className="font-mono tabular-nums text-lg font-extrabold text-emerald-700 block">
                  {formatRupiah(financialSummary.totalPendapatan)}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Catering: {formatRupiah(financialSummary.pendapatanCatering)} · Sekolah:{' '}
                  {formatRupiah(financialSummary.pendapatanSekolah)}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
                <span className="text-slate-500 font-semibold block">
                  Total Beban & Pengeluaran
                </span>
                <span className="font-mono tabular-nums text-lg font-extrabold text-red-700 block">
                  {formatRupiah(financialSummary.pengeluaranOperasional)}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Bahan baku dapur, logistik & operasional
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
                <span className="text-slate-500 font-semibold block">
                  Laba Bersih Operasional (Net Profit)
                </span>
                <span className="font-mono tabular-nums text-lg font-extrabold text-slate-900 block">
                  {formatRupiah(financialSummary.labaBersih)}
                </span>
                <span className="text-[11px] text-emerald-700 font-semibold block">
                  Margin Laba Bersih: {financialSummary.marginLabaPercent}%
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
                <span className="text-slate-500 font-semibold block">
                  Posisi Saldo Kas & Bank Terpadu
                </span>
                <span className="font-mono tabular-nums text-lg font-extrabold text-slate-900 block">
                  {formatRupiah(financialSummary.saldoKasDanBank)}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Piutang: {formatRupiah(financialSummary.totalPiutang)} · Utang:{' '}
                  {formatRupiah(financialSummary.totalUtang)}
                </span>
              </div>
            </div>

            {/* Executive Income Statement & Account Position Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-5">
              {/* Left 7 cols: Ringkasan Laporan Laba Rugi */}
              <div className="lg:col-span-7 rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    I. Ikhtisar Laporan Laba Rugi (Income Statement)
                  </span>
                  <span className="text-[11px] text-slate-500">Standar PSAK Indonesia</span>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-slate-700">
                        1. Pendapatan Usaha Catering Komersial
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700">
                        {formatRupiah(financialSummary.pendapatanCatering)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-slate-700">
                        2. Pendapatan Penyediaan Makanan Sekolah Rakyat
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700">
                        {formatRupiah(financialSummary.pendapatanSekolah)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/90">
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        Total Pendapatan Operasional Bruto
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-extrabold text-slate-900">
                        {formatRupiah(financialSummary.totalPendapatan)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-slate-700">
                        3. Beban Pokok Produksi Dapur & Operasional Distribusi
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-red-700">
                        ({formatRupiah(financialSummary.pengeluaranOperasional)})
                      </td>
                    </tr>
                    <tr className="bg-emerald-50/70">
                      <td className="py-3 px-4 font-extrabold text-emerald-950">
                        LABA BERSIH OPERASIONAL (NET PROFIT)
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-sm font-extrabold text-emerald-800">
                        {formatRupiah(financialSummary.labaBersih)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Right 5 cols: Rekapitulasi Saldo Rekening Bank & Kas */}
              <div className="lg:col-span-5 rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    II. Posisi Arus Kas per Rekening Bank
                  </span>
                  <span className="text-[11px] text-slate-500">4 Rekening Aktif</span>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] text-slate-500">
                      <th className="py-2 px-3 font-semibold">Rekening</th>
                      <th className="py-2 px-3 font-semibold text-right">Masuk</th>
                      <th className="py-2 px-3 font-semibold text-right">Keluar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {financialSummary.byAccount.map((acc) => (
                      <tr key={acc.accountMethod}>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-900">{acc.accountMethod}</div>
                          <div className="text-[11px] text-slate-500">{acc.count} jurnal</div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                          {formatRupiah(acc.totalMasuk)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-red-700 font-semibold">
                          {formatRupiah(acc.totalKeluar)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Filter & Action Toolbar for Journal Entries */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={finSearch}
                  onChange={(e) => setFinSearch(e.target.value)}
                  placeholder="Cari kode referensi atau uraian..."
                  aria-label="Cari jurnal keuangan"
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <select
                aria-label="Filter Jenis Akun Keuangan"
                value={finFilterType}
                onChange={(e) =>
                  setFinFilterType(e.target.value as 'Semua' | FinanceEntry['type'])
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800"
              >
                <option value="Semua">Semua Jenis Akun ({state.financeEntries.length})</option>
                <option value="Pendapatan Catering">Pendapatan Catering</option>
                <option value="Pendapatan Sekolah Rakyat">Pendapatan Sekolah Rakyat</option>
                <option value="Pengeluaran Operasional">Pengeluaran Operasional</option>
                <option value="Utang Supplier">Utang Supplier</option>
                <option value="Piutang Pelanggan">Piutang Pelanggan</option>
              </select>

              <select
                aria-label="Filter Status Penyelesaian"
                value={finFilterStatus}
                onChange={(e) =>
                  setFinFilterStatus(e.target.value as 'Semua' | 'Lunas' | 'Belum Lunas')
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800"
              >
                <option value="Semua">Semua Status</option>
                <option value="Lunas">Status: Lunas</option>
                <option value="Belum Lunas">Status: Belum Lunas</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowFinForm((prev) => !prev)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Catat Jurnal Transaksi Baru</span>
            </button>
          </div>

          {showFinForm && (
            <form
              onSubmit={handleFinanceSubmit}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <h2 className="text-sm font-bold text-slate-900">Input Jurnal Pembukuan Keuangan Baru</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="fin-date" className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Transaksi
                  </label>
                  <input
                    id="fin-date"
                    type="date"
                    value={finDate}
                    onChange={(e) => setFinDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="fin-type" className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Akun Transaksi
                  </label>
                  <select
                    id="fin-type"
                    value={finType}
                    onChange={(e) => setFinType(e.target.value as FinanceEntry['type'])}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="Pendapatan Catering">Pendapatan Catering</option>
                    <option value="Pendapatan Sekolah Rakyat">Pendapatan Sekolah Rakyat</option>
                    <option value="Pengeluaran Operasional">Pengeluaran Operasional</option>
                    <option value="Utang Supplier">Utang Supplier</option>
                    <option value="Piutang Pelanggan">Piutang Pelanggan</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="fin-amt" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nominal (IDR)
                  </label>
                  <input
                    id="fin-amt"
                    type="number"
                    min={1000}
                    value={finAmount}
                    onChange={(e) => setFinAmount(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="fin-cat" className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori Pembukuan
                  </label>
                  <input
                    id="fin-cat"
                    type="text"
                    value={finCategory}
                    onChange={(e) => setFinCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="fin-acc" className="block text-xs font-semibold text-slate-700 mb-1">
                    Rekening Kas / Bank
                  </label>
                  <select
                    id="fin-acc"
                    value={finAccount}
                    onChange={(e) => setFinAccount(e.target.value as FinanceEntry['accountMethod'])}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="Bank Mandiri ERP">Bank Mandiri ERP</option>
                    <option value="Bank BRI Sekolah Rakyat">Bank BRI Sekolah Rakyat</option>
                    <option value="Bank BCA Corporate">Bank BCA Corporate</option>
                    <option value="Kas Tunai">Kas Tunai</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="fin-stat" className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Penyelesaian
                  </label>
                  <select
                    id="fin-stat"
                    value={finStatus}
                    onChange={(e) =>
                      setFinStatus(e.target.value as FinanceEntry['settlementStatus'])
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="Lunas">Lunas</option>
                    <option value="Belum Lunas">Belum Lunas</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="fin-desc" className="block text-xs font-semibold text-slate-700 mb-1">
                  Uraian / Keterangan Bukti Transaksi
                </label>
                <input
                  id="fin-desc"
                  type="text"
                  value={finDesc}
                  onChange={(e) => setFinDesc(e.target.value)}
                  placeholder="Contoh: Pembayaran pengadaan beras pandan wangi 1 ton..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFinForm(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white"
                >
                  Simpan Jurnal Keuangan
                </button>
              </div>
            </form>
          )}

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-3 px-4 font-semibold">No. Referensi & Tanggal</th>
                    <th className="py-3 px-4 font-semibold">Jenis & Kategori Akun</th>
                    <th className="py-3 px-4 font-semibold">Uraian Transaksi</th>
                    <th className="py-3 px-4 font-semibold">Rekening</th>
                    <th className="py-3 px-4 font-semibold text-right">Nominal (IDR)</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFinanceEntries.map((fin) => (
                    <tr key={fin.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-mono tabular-nums font-bold text-slate-900">
                          {fin.referenceCode}
                        </div>
                        <div className="text-slate-500">
                          {formatTanggalIndonesia(fin.transactionDate)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{fin.type}</div>
                        <div className="text-slate-500">{fin.category}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-xs">{fin.description}</td>
                      <td className="py-3 px-4 text-slate-700">{fin.accountMethod}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatRupiah(fin.amount)}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() =>
                            onSaveFinance({
                              ...fin,
                              settlementStatus:
                                fin.settlementStatus === 'Lunas' ? 'Belum Lunas' : 'Lunas',
                            })
                          }
                          className="font-semibold text-emerald-700 hover:underline"
                        >
                          {fin.settlementStatus}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteFinance(fin.id)}
                          aria-label={`Hapus transaksi ${fin.referenceCode}`}
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

          {/* Modal Pratinjau & Cetak PDF Laporan Keuangan Resmi */}
          {reportPreviewOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
              role="dialog"
              aria-modal="true"
              aria-labelledby="official-report-modal-title"
            >
              <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between gap-4 no-print">
                  <div>
                    <h2 id="official-report-modal-title" className="text-base font-bold">
                      Pratinjau Dokumen Resmi Laporan Pertanggungjawaban Keuangan
                    </h2>
                    <p className="text-xs text-slate-300">
                      Siap dicetak ke PDF (Ctrl+P / Tombol Cetak) atau diunduh sebagai Dokumen Resmi & Spreadsheet Excel
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white transition-colors"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Cetak / Simpan PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadProfessionalFinancialHtml({
                          entries: filteredFinanceEntries,
                          snapshot: state,
                          siteSettings,
                          adminName: adminDisplayName,
                          adminRole: currentRole,
                          filterLabel: currentFilterLabel,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 px-3.5 py-2 text-xs font-bold text-slate-950 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Unduh File Dokumen (.HTML)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportPreviewOpen(false)}
                      aria-label="Tutup pratinjau laporan"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-xs text-slate-900">
                  {/* Kop Surat Resmi */}
                  <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                      <h3 className="text-base font-extrabold text-emerald-800 uppercase tracking-tight">
                        {siteSettings?.erpSystemTitle ||
                          'SMART CATERING & SEKOLAH RAKYAT MANAGEMENT SYSTEM'}
                      </h3>
                      <p className="text-slate-600 mt-0.5">
                        {siteSettings?.companyAddress ||
                          'Jl. Proklamasi No. 42, Menteng, Jakarta Pusat 10320'}
                      </p>
                      <p className="text-slate-500">
                        WhatsApp Resmi: {siteSettings?.whatsappDisplay || '0811-9823-401'} · Standar Akuntansi Keuangan Indonesia
                      </p>
                    </div>
                    <div className="sm:text-right font-mono text-[11px] text-slate-600 space-y-0.5">
                      <div>
                        <strong>No. Dokumen:</strong> LPJ-KEU/2026/XI/00{filteredFinanceEntries.length}
                      </div>
                      <div>
                        <strong>Zona Waktu:</strong> Asia/Jakarta (WIB)
                      </div>
                      <div>
                        <strong>Mata Uang:</strong> Rupiah (IDR)
                      </div>
                    </div>
                  </div>

                  {/* Ringkasan Laba Rugi */}
                  <div className="space-y-2">
                    <h4 className="font-bold uppercase tracking-wider text-slate-700">
                      I. Ringkasan Eksekutif Laporan Laba Rugi
                    </h4>
                    <table className="w-full border border-slate-300 border-collapse text-xs">
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="py-2 px-3 font-medium">Pendapatan Usaha Catering Komersial</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                            {formatRupiah(financialSummary.pendapatanCatering)}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="py-2 px-3 font-medium">Pendapatan Program Sekolah Rakyat</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                            {formatRupiah(financialSummary.pendapatanSekolah)}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <td className="py-2 px-3 font-bold">Total Pendapatan Operasional Bruto</td>
                          <td className="py-2 px-3 text-right font-mono font-extrabold">
                            {formatRupiah(financialSummary.totalPendapatan)}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="py-2 px-3 font-medium">Beban Pokok Produksi & Operasional</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-red-700">
                            ({formatRupiah(financialSummary.pengeluaranOperasional)})
                          </td>
                        </tr>
                        <tr className="bg-emerald-50">
                          <td className="py-2.5 px-3 font-extrabold text-emerald-950">
                            LABA BERSIH OPERASIONAL (MARGIN {financialSummary.marginLabaPercent}%)
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-sm font-extrabold text-emerald-800">
                            {formatRupiah(financialSummary.labaBersih)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Tabel Jurnal */}
                  <div className="space-y-2">
                    <h4 className="font-bold uppercase tracking-wider text-slate-700">
                      II. Rincian Jurnal Transaksi ({filteredFinanceEntries.length} Transaksi)
                    </h4>
                    <table className="w-full border border-slate-300 border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300">
                          <th className="py-2 px-2.5 text-left">Referensi</th>
                          <th className="py-2 px-2.5 text-left">Tanggal</th>
                          <th className="py-2 px-2.5 text-left">Akun & Kategori</th>
                          <th className="py-2 px-2.5 text-left">Uraian</th>
                          <th className="py-2 px-2.5 text-left">Rekening</th>
                          <th className="py-2 px-2.5 text-right">Nominal (IDR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredFinanceEntries.map((fin) => (
                          <tr key={fin.id}>
                            <td className="py-2 px-2.5 font-mono font-semibold">{fin.referenceCode}</td>
                            <td className="py-2 px-2.5">{formatTanggalIndonesia(fin.transactionDate)}</td>
                            <td className="py-2 px-2.5">
                              <span className="font-semibold">{fin.type}</span> · {fin.category}
                            </td>
                            <td className="py-2 px-2.5">{fin.description}</td>
                            <td className="py-2 px-2.5">{fin.accountMethod}</td>
                            <td className="py-2 px-2.5 text-right font-mono font-bold">
                              {formatRupiah(fin.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Blok Pengesahan */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 text-center">
                    <div className="rounded-lg border border-slate-200 p-4 space-y-10">
                      <div>
                        <div className="text-slate-500">Disiapkan Oleh,</div>
                        <div className="font-bold text-slate-800">Divisi Akuntansi Keuangan</div>
                      </div>
                      <div>
                        <div className="font-bold underline">Dra. Ratna Sari, Ak., CA</div>
                        <div className="text-[11px] text-slate-500">Akuntan Keuangan Senior</div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-4 space-y-10">
                      <div>
                        <div className="text-slate-500">Diperiksa Oleh,</div>
                        <div className="font-bold text-slate-800">Manajemen Operasional</div>
                      </div>
                      <div>
                        <div className="font-bold underline">Hendra Gunawan, S.T.</div>
                        <div className="text-[11px] text-slate-500">Manajer Operasional ERP</div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-4 space-y-10">
                      <div>
                        <div className="text-slate-500">Disahkan & Disetujui Oleh,</div>
                        <div className="font-bold text-slate-800">{currentRole}</div>
                      </div>
                      <div>
                        <div className="font-bold underline">{adminDisplayName}</div>
                        <div className="text-[11px] text-slate-500">Pimpinan Utama Smart Catering</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: STOK & PENGADAAN BAHAN MAKANAN */}
      {activeSection === 'stok' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-700" />
                <span>Manajemen Stok & Pengadaan Bahan Makanan</span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Gudang Logistik Dapur Sentral, Pemantauan Stok Minimum, Restock Cepat & Daftar Supplier
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowInvForm((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Komoditas Bahan Baku</span>
            </button>
          </div>

          {showInvForm && (
            <form
              onSubmit={handleInventorySubmit}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <h2 className="text-sm font-bold text-slate-900">
                Formulir Pengadaan & Registrasi Bahan Baku Baru
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="inv-code" className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode Barang
                  </label>
                  <input
                    id="inv-code"
                    type="text"
                    value={invCode}
                    onChange={(e) => setInvCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="inv-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Bahan Makanan / Kemasan
                  </label>
                  <input
                    id="inv-name"
                    type="text"
                    value={invName}
                    onChange={(e) => setInvName(e.target.value)}
                    placeholder="Contoh: Telur Ayam Negeri Grade A"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="inv-cat" className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori Gudang
                  </label>
                  <input
                    id="inv-cat"
                    type="text"
                    value={invCategory}
                    onChange={(e) => setInvCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="inv-qty" className="block text-xs font-semibold text-slate-700 mb-1">
                    Stok Saat Ini
                  </label>
                  <input
                    id="inv-qty"
                    type="number"
                    min={0}
                    value={invQty}
                    onChange={(e) => setInvQty(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="inv-min" className="block text-xs font-semibold text-slate-700 mb-1">
                    Batas Stok Minimum
                  </label>
                  <input
                    id="inv-min"
                    type="number"
                    min={0}
                    value={invMin}
                    onChange={(e) => setInvMin(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="inv-unit" className="block text-xs font-semibold text-slate-700 mb-1">
                    Satuan (kg, liter, kotak)
                  </label>
                  <input
                    id="inv-unit"
                    type="text"
                    value={invUnit}
                    onChange={(e) => setInvUnit(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="inv-cost" className="block text-xs font-semibold text-slate-700 mb-1">
                    Harga Satuan (IDR)
                  </label>
                  <input
                    id="inv-cost"
                    type="number"
                    min={100}
                    value={invCost}
                    onChange={(e) => setInvCost(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="inv-sup" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Supplier / Mitra Pengadaan
                </label>
                <input
                  id="inv-sup"
                  type="text"
                  value={invSupplier}
                  onChange={(e) => setInvSupplier(e.target.value)}
                  placeholder="Contoh: Koperasi Peternak Ayam Blitar"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInvForm(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white"
                >
                  Simpan Stok Bahan
                </button>
              </div>
            </form>
          )}

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-3 px-4 font-semibold">Kode & Nama Bahan</th>
                    <th className="py-3 px-4 font-semibold">Supplier Pengadaan</th>
                    <th className="py-3 px-4 font-semibold text-right">Stok Tersedia</th>
                    <th className="py-3 px-4 font-semibold text-right">Batas Min.</th>
                    <th className="py-3 px-4 font-semibold text-right">Nilai Persediaan</th>
                    <th className="py-3 px-4 font-semibold">Status & Restock</th>
                    <th className="py-3 px-4 font-semibold text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.inventoryItems.map((item) => {
                    const isLow = item.stockQty <= item.minStock;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">
                            {item.itemCode} · {item.name}
                          </div>
                          <div className="text-slate-500">{item.category}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800">{item.supplierName}</div>
                          <div className="text-slate-400">
                            Restock: {formatTanggalIndonesia(item.lastRestockDate)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                          {item.stockQty.toLocaleString('id-ID')} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                          {item.minStock.toLocaleString('id-ID')} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatRupiah(item.stockQty * item.unitCost)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                isLow
                                  ? 'text-red-700 font-bold'
                                  : 'text-emerald-700 font-semibold'
                              }
                            >
                              {isLow ? 'Stok Kritis (Perlu PO)' : 'Stok Aman'}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                onSaveInventory({
                                  ...item,
                                  stockQty: item.stockQty + 100,
                                  lastRestockDate: '2026-11-16',
                                })
                              }
                              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-100"
                            >
                              +100 {item.unit}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => onDeleteInventory(item.id)}
                            aria-label={`Hapus bahan ${item.name}`}
                            className="text-red-600 hover:text-red-800 font-semibold inline-flex items-center gap-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Hapus
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: PEMASARAN & PROMOSI */}
      {activeSection === 'pemasaran' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Tag className="h-5 w-5 text-emerald-700" />
                <span>Manajemen Pemasaran, Promosi & Retensi Pelanggan</span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Kampanye Voucher Diskon Catering Komersial, Paket Kontrak Korporasi & Loyalitas Pelanggan
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPromoForm((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Buat Kampanye Promosi</span>
            </button>
          </div>

          {showPromoForm && (
            <form
              onSubmit={handlePromoSubmit}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <h2 className="text-sm font-bold text-slate-900">Terbitkan Kode Voucher Promosi Baru</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="pr-code" className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode Promo
                  </label>
                  <input
                    id="pr-code"
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Contoh: BUMN2026"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono uppercase text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="pr-title" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Program Promosi
                  </label>
                  <input
                    id="pr-title"
                    type="text"
                    value={promoTitle}
                    onChange={(e) => setPromoTitle(e.target.value)}
                    placeholder="Diskon Kontrak Catering Rapat"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="pr-seg" className="block text-xs font-semibold text-slate-700 mb-1">
                    Segmen Pelanggan Sasaran
                  </label>
                  <input
                    id="pr-seg"
                    type="text"
                    value={promoSegment}
                    onChange={(e) => setPromoSegment(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="pr-disc" className="block text-xs font-semibold text-slate-700 mb-1">
                    Persentase Diskon (%)
                  </label>
                  <input
                    id="pr-disc"
                    type="number"
                    min={1}
                    max={90}
                    value={promoDisc}
                    onChange={(e) => setPromoDisc(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="pr-max" className="block text-xs font-semibold text-slate-700 mb-1">
                    Maksimal Potongan (IDR)
                  </label>
                  <input
                    id="pr-max"
                    type="number"
                    min={0}
                    value={promoMax}
                    onChange={(e) => setPromoMax(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="pr-val" className="block text-xs font-semibold text-slate-700 mb-1">
                    Berlaku Sampai Tanggal
                  </label>
                  <input
                    id="pr-val"
                    type="date"
                    value={promoValid}
                    onChange={(e) => setPromoValid(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPromoForm(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white"
                >
                  Simpan Kampanye Promo
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {state.promotions.map((pr) => (
              <div
                key={pr.id}
                className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono tabular-nums font-bold text-emerald-800 text-sm">
                      KODE: {pr.promoCode}
                    </span>
                    <span className="text-slate-500">
                      Berlaku s/d {formatTanggalIndonesia(pr.validUntil)}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{pr.title}</h3>
                  <p className="text-xs text-slate-600">Segmen: {pr.targetSegment}</p>
                  <p className="text-xs font-mono tabular-nums text-slate-800">
                    Diskon {pr.discountPercent}% · Maks. Potongan {formatRupiah(pr.maxDiscountAmount)} · Digunakan {pr.usageCount}x
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <button
                    type="button"
                    onClick={() => onSavePromotion({ ...pr, active: !pr.active })}
                    className="font-semibold text-emerald-700 hover:underline"
                  >
                    Status: {pr.active ? 'Kampanye Aktif' : 'Nonaktif'} (Klik untuk ubah)
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePromotion(pr.id)}
                    className="text-red-600 hover:text-red-800 font-semibold"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 4: BACKUP, RESTORE, PENGATURAN AKUN ADMIN & RBAC */}
      {activeSection === 'backup' && (
        <div className="space-y-6">
          {/* Card 1: Pengaturan Akun Admin (Ganti Username & Kata Sandi) */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="border-b border-slate-200 bg-slate-900 px-5 py-4 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold shrink-0">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold tracking-tight">
                    Pengaturan Akun Admin: Ganti Username & Kata Sandi
                  </h1>
                  <p className="text-xs text-slate-300">
                    Kelola identitas login utama, username, dan kata sandi akses sistem dengan mudah & aman
                  </p>
                </div>
              </div>
              <div className="rounded-lg bg-slate-800 px-3.5 py-2 text-xs text-slate-200 shrink-0">
                Username Aktif:{' '}
                <span className="font-mono font-bold text-amber-400">@{adminUsername}</span> ·{' '}
                <span className="font-semibold text-emerald-300">{currentRole}</span>
              </div>
            </div>

            <form onSubmit={handleSaveAdminCredentials} className="p-5 space-y-5">
              {credError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
                  {credError}
                </div>
              )}
              {credSuccess && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>{credSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Step 1: Identitas & Username */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Langkah 1 · Ubah Username & Profil Admin
                    </span>
                    <span className="text-[11px] text-slate-500">Tanpa spasi, min. 3 huruf</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="admin-new-username"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Username Admin Baru
                      </label>
                      <div className="relative">
                        <User className="h-4 w-4 text-emerald-700 absolute left-3 top-2.5" />
                        <input
                          id="admin-new-username"
                          type="text"
                          value={credUsername}
                          onChange={(e) => setCredUsername(e.target.value)}
                          placeholder="Contoh: admin_smart"
                          className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs font-mono font-semibold text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="admin-new-displayname"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Nama Tampilan Admin
                      </label>
                      <input
                        id="admin-new-displayname"
                        type="text"
                        value={credDisplayName}
                        onChange={(e) => setCredDisplayName(e.target.value)}
                        placeholder="Nama lengkap"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="admin-new-email"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Email Resmi Admin (Untuk Notifikasi & Pemulihan)
                    </label>
                    <input
                      id="admin-new-email"
                      type="email"
                      value={credEmail}
                      onChange={(e) => setCredEmail(e.target.value)}
                      placeholder="primayaadmin@gmail.com"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Step 2: Kata Sandi */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Langkah 2 · Ganti Kata Sandi (Password)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Kosongkan sandi baru bila hanya ganti username
                    </span>
                  </div>

                  <div>
                    <label
                      htmlFor="admin-current-pwd"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Kata Sandi Saat Ini (Wajib Diisi)
                    </label>
                    <div className="relative">
                      <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        id="admin-current-pwd"
                        type={showCredCurrentPwd ? 'text' : 'password'}
                        value={credCurrentPassword}
                        onChange={(e) => setCredCurrentPassword(e.target.value)}
                        placeholder="Masukkan kata sandi saat ini"
                        className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-10 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCredCurrentPwd((prev) => !prev)}
                        aria-label="Tampilkan kata sandi saat ini"
                        className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-800"
                      >
                        {showCredCurrentPwd ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="admin-new-pwd"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Kata Sandi Baru
                      </label>
                      <div className="relative">
                        <KeyRound className="h-4 w-4 text-emerald-700 absolute left-3 top-2.5" />
                        <input
                          id="admin-new-pwd"
                          type={showCredNewPwd ? 'text' : 'password'}
                          value={credNewPassword}
                          onChange={(e) => setCredNewPassword(e.target.value)}
                          placeholder="Min. 6 karakter"
                          className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCredNewPwd((prev) => !prev)}
                          aria-label="Tampilkan kata sandi baru"
                          className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-800"
                        >
                          {showCredNewPwd ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="admin-confirm-pwd"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Konfirmasi Kata Sandi Baru
                      </label>
                      <input
                        id="admin-confirm-pwd"
                        type={showCredNewPwd ? 'text' : 'password'}
                        value={credConfirmPassword}
                        onChange={(e) => setCredConfirmPassword(e.target.value)}
                        placeholder="Ulangi kata sandi baru"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  Perubahan username dan kata sandi langsung aktif untuk sesi login berikutnya.
                </p>
                <button
                  type="submit"
                  disabled={savingCreds}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>
                    {savingCreds
                      ? 'Menyimpan Perubahan...'
                      : 'Simpan Username & Kata Sandi Admin'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <DatabaseBackup className="h-5 w-5 text-emerald-700" />
                  <span>Backup & Restore Database Cloud</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Keamanan Data Cloud Firestore Permanen, Ekspor/Impor Snapshot JSON & Matriks Role-Based Access Control
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Unduh Backup Database (.JSON)</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  onChange={handleFileRestore}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  <Upload className="h-4 w-4 text-emerald-700" />
                  <span>Restore Data dari File JSON</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-slate-500 block">Menu & Produk</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 text-sm">
                  {state.menuItems.length} dokumen
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-slate-500 block">Pesanan Catering</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 text-sm">
                  {state.cateringOrders.length} dokumen
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-slate-500 block">Sekolah Rakyat</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 text-sm">
                  {state.schools.length} dokumen
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-slate-500 block">Jurnal Keuangan</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 text-sm">
                  {state.financeEntries.length} dokumen
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-slate-500 block">Komoditas Stok</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 text-sm">
                  {state.inventoryItems.length} dokumen
                </span>
              </div>
            </div>
          </div>

          {/* RBAC User Management */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  <span>Daftar Pengguna & Matriks Role-Based Access Control (RBAC)</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Peran aktif Anda saat ini: <span className="font-semibold text-emerald-800">{currentRole}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUserForm((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tambah Personel RBAC</span>
              </button>
            </div>

            {showUserForm && (
              <form
                onSubmit={handleUserSubmit}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Nama lengkap personel"
                    aria-label="Nama lengkap personel"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                  />
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="Email korporat"
                    aria-label="Email korporat"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                  />
                  <select
                    aria-label="Pilih Peran RBAC"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                  >
                    <option value="Super Admin">Super Admin</option>
                    <option value="Manajer Operasional">Manajer Operasional</option>
                    <option value="Akuntan Keuangan">Akuntan Keuangan</option>
                    <option value="Kepala Dapur & Produksi">Kepala Dapur & Produksi</option>
                    <option value="Koordinator Sekolah Rakyat">Koordinator Sekolah Rakyat</option>
                    <option value="Kurir Distribusi">Kurir Distribusi</option>
                    <option value="Staf Operasional">Staf Operasional</option>
                  </select>
                  <input
                    type="text"
                    value={newUserDept}
                    onChange={(e) => setNewUserDept(e.target.value)}
                    placeholder="Divisi / Departemen"
                    aria-label="Divisi / Departemen"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowUserForm(false)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white"
                  >
                    Simpan Personel
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-3 font-semibold">Nama Pengguna</th>
                    <th className="py-2.5 px-3 font-semibold">Email Terdaftar</th>
                    <th className="py-2.5 px-3 font-semibold">Peran RBAC</th>
                    <th className="py-2.5 px-3 font-semibold">Departemen</th>
                    <th className="py-2.5 px-3 font-semibold">Status Akses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.users.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{u.displayName}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600">{u.email}</td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-800">{u.role}</td>
                      <td className="py-2.5 px-3 text-slate-700">{u.department}</td>
                      <td className="py-2.5 px-3 text-slate-700">{u.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
