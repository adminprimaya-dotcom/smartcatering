import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  History,
  KeyRound,
  Lock,
  Package,
  Plus,
  Printer,
  QrCode,
  ScanLine,
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
  PaidNotificationItem,
  PaymentMethodType,
  PromotionItem,
  SiteContentSettings,
  UserProfileRecord,
  UserRole,
} from '../types/erp';
import {
  computeDashboardMetrics,
  formatRupiah,
  formatTanggalIndonesia,
  getJakartaTodayIso,
} from '../utils/calculations';
import {
  computeFinancialReportSummary,
  downloadProfessionalFinancialCsv,
  downloadProfessionalFinancialExcel,
  downloadProfessionalFinancialHtml,
} from '../utils/financialReportExport';

type FinanceSubmenuKey =
  | 'ringkasan'
  | 'pendapatan_catering'
  | 'pendapatan_sekolah'
  | 'pengeluaran'
  | 'kas_tunai'
  | 'rekening_bank'
  | 'qris'
  | 'utang_supplier'
  | 'piutang_pelanggan'
  | 'buku_kas'
  | 'laba_rugi'
  | 'arus_kas';

interface CorrectionAuditItem {
  timestamp: string;
  actor: string;
  previousAmount: number;
  newAmount: number;
  previousAccount: string;
  newAccount: string;
  note: string;
}

interface FinanceInventoryModuleProps {
  activeSection: 'keuangan' | 'stok' | 'pemasaran' | 'backup';
  ownerId: string;
  state: ErpStateSnapshot;
  paidNotifications?: PaidNotificationItem[];
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
  onSaveSiteSettings?: (nextSettings: SiteContentSettings) => Promise<void>;
  onSaveFinance: (entry: FinanceEntry) => Promise<void>;
  onDeleteFinance: (id: string) => Promise<void>;
  onSaveInventory: (item: InventoryItem) => Promise<void>;
  onDeleteInventory: (id: string) => Promise<void>;
  onSavePromotion: (promo: PromotionItem) => Promise<void>;
  onDeletePromotion: (id: string) => Promise<void>;
  onSaveUser: (user: UserProfileRecord) => Promise<void>;
  onDeleteUser?: (id: string) => Promise<void>;
  onRestoreBackup: (snapshot: ErpStateSnapshot) => Promise<void>;
}

const FINANCE_SUBMENUS: Array<{ key: FinanceSubmenuKey; label: string }> = [
  { key: 'ringkasan', label: '1. Ringkasan Keuangan' },
  { key: 'pendapatan_catering', label: '2. Pendapatan Catering' },
  { key: 'pendapatan_sekolah', label: '3. Pendapatan Sekolah Rakyat' },
  { key: 'pengeluaran', label: '4. Pengeluaran Operasional' },
  { key: 'kas_tunai', label: '5. Kas Tunai' },
  { key: 'rekening_bank', label: '6. Rekening Bank' },
  { key: 'qris', label: '7. QRIS' },
  { key: 'utang_supplier', label: '8. Utang Supplier' },
  { key: 'piutang_pelanggan', label: '9. Piutang Pelanggan' },
  { key: 'buku_kas', label: '10. Buku Kas' },
  { key: 'laba_rugi', label: '11. Laporan Laba Rugi' },
  { key: 'arus_kas', label: '12. Laporan Arus Kas' },
];

const BANK_ACCOUNTS: FinanceEntry['accountMethod'][] = [
  'Bank Mandiri ERP',
  'Bank BRI Sekolah Rakyat',
  'Bank BCA Corporate',
];

function parseAuditTrail(rawJson?: string): CorrectionAuditItem[] {
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const FinanceInventoryModule: React.FC<FinanceInventoryModuleProps> = ({
  activeSection,
  ownerId,
  state,
  paidNotifications = [],
  currentRole,
  siteSettings,
  adminUsername = 'admin',
  adminEmail = 'primayaadmin@gmail.com',
  adminDisplayName = 'Ir. Pratama Wijaya, MBA',
  onUpdateAdminCredentials,
  onSaveSiteSettings,
  onSaveFinance,
  onDeleteFinance,
  onSaveInventory,
  onDeleteInventory,
  onSavePromotion,
  onDeletePromotion,
  onSaveUser,
  onDeleteUser,
  onRestoreBackup,
}) => {
  const [feedback, setFeedback] = useState('');
  const [errorFeedback, setErrorFeedback] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 12 Finance Submenus State
  const [finSubMenu, setFinSubMenu] = useState<FinanceSubmenuKey>('ringkasan');

  // Financial Report Filter & Official Document Preview State
  const [finFilterType, setFinFilterType] = useState<'Semua' | FinanceEntry['type']>('Semua');
  const [finFilterStatus, setFinFilterStatus] = useState<'Semua' | 'Lunas' | 'Belum Lunas'>('Semua');
  const [finFilterMethod, setFinFilterMethod] = useState<'Semua' | 'QRIS' | 'Transfer Bank' | 'Tunai'>('Semua');
  const [finSearch, setFinSearch] = useState('');
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);

  // Payment History Table Filter State (QRIS, Transfer Bank, Tunai)
  const [paymentHistoryMethodFilter, setPaymentHistoryMethodFilter] = useState<'Semua' | PaymentMethodType>('Semua');
  const [paymentHistorySearch, setPaymentHistorySearch] = useState('');

  // Journal Correction Modal State
  const [correctingEntry, setCorrectingEntry] = useState<FinanceEntry | null>(null);
  const [corrAmount, setCorrAmount] = useState(0);
  const [corrDesc, setCorrDesc] = useState('');
  const [corrAccount, setCorrAccount] = useState<FinanceEntry['accountMethod']>('Bank Mandiri ERP');
  const [corrStatus, setCorrStatus] = useState<FinanceEntry['settlementStatus']>('Lunas');
  const [corrNote, setCorrNote] = useState('');
  const [corrSaving, setCorrSaving] = useState(false);

  // Expanded audit trail row ID
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  // Admin Credential Changer Form State
  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [credUsername, setCredUsername] = useState('');
  const [credDisplayName, setCredDisplayName] = useState('');
  const [credEmail, setCredEmail] = useState('');
  const [credCurrentPassword, setCredCurrentPassword] = useState('');
  const [credNewPassword, setCredNewPassword] = useState('');
  const [credConfirmPassword, setCredConfirmPassword] = useState('');
  const [showCredCurrentPwd, setShowCredCurrentPwd] = useState(false);
  const [showCredNewPwd, setShowCredNewPwd] = useState(false);
  const [credError, setCredError] = useState('');
  const [credSuccess, setCredSuccess] = useState('');
  const [savingCreds, setSavingCreds] = useState(false);

  // Payment Channels (Bank & QRIS) Form State
  const [showPaymentConfig, setShowPaymentConfig] = useState(false);
  const [payBank1Name, setPayBank1Name] = useState(siteSettings?.bankName || 'Bank Mandiri');
  const [payBank1Num, setPayBank1Num] = useState(siteSettings?.bankAccountNumber || '123-00-0987654-3');
  const [payBank1Holder, setPayBank1Holder] = useState(
    siteSettings?.bankAccountHolder || 'PT Smart Catering Nusantara'
  );
  const [payBank2Name, setPayBank2Name] = useState(siteSettings?.bank2Name || 'Bank BCA');
  const [payBank2Num, setPayBank2Num] = useState(siteSettings?.bank2AccountNumber || '522-0394-881');
  const [payBank2Holder, setPayBank2Holder] = useState(
    siteSettings?.bank2AccountHolder || 'PT Smart Catering Nusantara'
  );
  const [payQrisMerchant, setPayQrisMerchant] = useState(
    siteSettings?.qrisMerchantName || 'SMART CATERING NUSANTARA'
  );
  const [payQrisNmid, setPayQrisNmid] = useState(siteSettings?.qrisNmid || 'ID102026098765432');
  const [payQrisImageUrl, setPayQrisImageUrl] = useState(siteSettings?.qrisImageUrl || '');
  const [savingPaymentConfig, setSavingPaymentConfig] = useState(false);
  const qrisUploadInputRef = useRef<HTMLInputElement | null>(null);

  // Finance Form State
  const todayIso = getJakartaTodayIso();
  const [showFinForm, setShowFinForm] = useState(false);
  const [finDate, setFinDate] = useState(todayIso);
  const [finOrderRef, setFinOrderRef] = useState('');
  const [finType, setFinType] = useState<FinanceEntry['type']>('Pendapatan Catering');
  const [finCategory, setFinCategory] = useState('Pelunasan Invoice Catering');
  const [finDesc, setFinDesc] = useState('');
  const [finAmount, setFinAmount] = useState(1500000);
  const [finAccount, setFinAccount] = useState<FinanceEntry['accountMethod']>('Bank Mandiri ERP');
  const [finStatus, setFinStatus] = useState<FinanceEntry['settlementStatus']>('Lunas');

  // Inventory Form & Barcode/QR Camera Scanner State
  const [showInvForm, setShowInvForm] = useState(false);
  const [invCode, setInvCode] = useState(`BHN-${String(state.inventoryItems.length + 1).padStart(3, '0')}`);
  const [invName, setInvName] = useState('');
  const [invCategory, setInvCategory] = useState('Bahan Pokok');
  const [invQty, setInvQty] = useState(250);
  const [invMin, setInvMin] = useState(100);
  const [invUnit, setInvUnit] = useState('kg');
  const [invCost, setInvCost] = useState(15000);
  const [invSupplier, setInvSupplier] = useState('');

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [scannedCode, setScannedCode] = useState('');
  const [scanRestockQty, setScanRestockQty] = useState(50);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

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
    setErrorFeedback('');
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 4500);
  };

  const notifyError = (msg: string) => {
    setFeedback('');
    setErrorFeedback(msg);
    setTimeout(() => setErrorFeedback(''), 6000);
  };

  useEffect(() => {
    setCredDisplayName(adminDisplayName);
    setCredEmail(adminEmail);
  }, [adminDisplayName, adminEmail]);

  useEffect(() => {
    if (!siteSettings) return;
    setPayBank1Name(siteSettings.bankName);
    setPayBank1Num(siteSettings.bankAccountNumber);
    setPayBank1Holder(siteSettings.bankAccountHolder);
    setPayBank2Name(siteSettings.bank2Name || '');
    setPayBank2Num(siteSettings.bank2AccountNumber || '');
    setPayBank2Holder(siteSettings.bank2AccountHolder || '');
    setPayQrisMerchant(siteSettings.qrisMerchantName || '');
    setPayQrisNmid(siteSettings.qrisNmid || '');
    setPayQrisImageUrl(siteSettings.qrisImageUrl || '');
  }, [siteSettings]);

  // Camera Barcode / QR Scanner Lifecycle
  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (!scannerOpen) {
      stopCameraStream();
      return;
    }

    let cancelled = false;
    let rafId = 0;

    const startScanner = async () => {
      setScannerError('');
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerError(
          'Browser atau perangkat Anda tidak mendukung akses kamera langsung. Gunakan kolom input kode barcode manual di bawah.'
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const BarcodeDetectorCtor = (
          window as unknown as {
            BarcodeDetector?: new (opts?: { formats?: string[] }) => {
              detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
            };
          }
        ).BarcodeDetector;

        if (!BarcodeDetectorCtor) {
          setScannerError(
            'Kamera aktif. Detektor barcode otomatis belum didukung browser ini; ketik kode barcode/QR pada kolom input di bawah.'
          );
          return;
        }

        const detector = new BarcodeDetectorCtor({
          formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'],
        });

        const scanLoop = async () => {
          if (cancelled) return;
          const videoEl = videoRef.current;
          if (videoEl && videoEl.readyState >= 2) {
            try {
              const results = await detector.detect(videoEl);
              if (results.length > 0 && results[0].rawValue) {
                setScannedCode(results[0].rawValue.trim().toUpperCase());
              }
            } catch {
              // Ignore transient frame decode error
            }
          }
          rafId = requestAnimationFrame(scanLoop);
        };
        rafId = requestAnimationFrame(scanLoop);
      } catch {
        if (!cancelled) {
          setScannerError(
            'Izin kamera ditolak atau kamera tidak tersedia. Masukkan kode barcode/QR secara manual di bawah.'
          );
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      stopCameraStream();
    };
  }, [scannerOpen]);

  const matchedScannedItem = useMemo(() => {
    const clean = scannedCode.trim().toUpperCase();
    if (!clean) return null;
    return (
      state.inventoryItems.find(
        (i) => i.itemCode.trim().toUpperCase() === clean || i.id.toUpperCase() === clean
      ) || null
    );
  }, [scannedCode, state.inventoryItems]);

  const handleApplyScannedRestock = async () => {
    if (!matchedScannedItem) return;
    const qtyAdd = Math.max(1, Math.round(scanRestockQty));
    try {
      await onSaveInventory({
        ...matchedScannedItem,
        stockQty: matchedScannedItem.stockQty + qtyAdd,
        lastRestockDate: getJakartaTodayIso(),
      });
      notify(
        `Stok "${matchedScannedItem.name}" (${matchedScannedItem.itemCode}) berhasil ditambah +${qtyAdd} ${matchedScannedItem.unit}.`
      );
      setScannerOpen(false);
      setScannedCode('');
    } catch (err) {
      notifyError(
        `Gagal memperbarui stok: ${err instanceof Error ? err.message : 'Kesalahan server'}`
      );
    }
  };

  const handleRegisterScannedNewItem = () => {
    const clean = scannedCode.trim().toUpperCase();
    if (!clean) return;
    setInvCode(clean);
    setShowInvForm(true);
    setScannerOpen(false);
    notify(`Kode "${clean}" dimasukkan ke formulir tambah bahan baku.`);
  };

  const handleQrisFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPayQrisImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSavePaymentConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteSettings || !onSaveSiteSettings) {
      notifyError('Pengaturan pembayaran belum terhubung.');
      return;
    }
    setSavingPaymentConfig(true);
    try {
      await onSaveSiteSettings({
        ...siteSettings,
        bankName: payBank1Name.trim(),
        bankAccountNumber: payBank1Num.trim(),
        bankAccountHolder: payBank1Holder.trim(),
        bank2Name: payBank2Name.trim(),
        bank2AccountNumber: payBank2Num.trim(),
        bank2AccountHolder: payBank2Holder.trim(),
        qrisMerchantName: payQrisMerchant.trim(),
        qrisNmid: payQrisNmid.trim(),
        qrisImageUrl: payQrisImageUrl.trim(),
      });
      setShowPaymentConfig(false);
      notify(
        'Rekening Bank & QRIS Pembayaran berhasil disimpan dan langsung tampil di checkout pelanggan.'
      );
    } catch (err) {
      notifyError(
        `Gagal menyimpan pengaturan Bank & QRIS: ${err instanceof Error ? err.message : 'Error'}`
      );
    } finally {
      setSavingPaymentConfig(false);
    }
  };

  const handleSaveAdminCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredError('');
    setCredSuccess('');

    const cleanedUsername = (credUsername.trim() || adminUsername).replace(/\s+/g, '');
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
          newDisplayName: credDisplayName.trim() || adminDisplayName,
          newEmail: credEmail.trim() || adminEmail,
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

      setCredCurrentPassword('');
      setCredNewPassword('');
      setCredConfirmPassword('');
      setCredUsername('');
      setShowCredentialForm(false);
      const msg = data.message || 'Username dan kata sandi berhasil diperbarui.';
      setCredSuccess(msg);
      notify(msg);
    } catch {
      setCredError('Terjadi gangguan jaringan saat menyimpan pengaturan akun admin.');
    } finally {
      setSavingCreds(false);
    }
  };

  // Prefill journal defaults when switching submenu
  const handleSelectFinanceSubmenu = (key: FinanceSubmenuKey) => {
    setFinSubMenu(key);
    if (key === 'pendapatan_catering') {
      setFinType('Pendapatan Catering');
      setFinCategory('Pelunasan Pesanan Catering');
    } else if (key === 'pendapatan_sekolah') {
      setFinType('Pendapatan Sekolah Rakyat');
      setFinCategory('Kontrak Sekolah Rakyat');
    } else if (key === 'pengeluaran') {
      setFinType('Pengeluaran Operasional');
      setFinCategory('Pengadaan Bahan Baku');
    } else if (key === 'kas_tunai') {
      setFinAccount('Kas Tunai');
    } else if (key === 'rekening_bank') {
      setFinAccount('Bank Mandiri ERP');
    } else if (key === 'qris') {
      setFinAccount('QRIS');
    } else if (key === 'utang_supplier') {
      setFinType('Utang Supplier');
      setFinCategory('Tagihan Pemasok Bahan');
      setFinStatus('Belum Lunas');
    } else if (key === 'piutang_pelanggan') {
      setFinType('Piutang Pelanggan');
      setFinCategory('Piutang Tagihan Catering');
      setFinStatus('Belum Lunas');
    }
  };

  // When selecting an order in Finance form, prefill details cleanly
  const handleSelectOrderRefForFinance = (orderNum: string) => {
    setFinOrderRef(orderNum);
    if (!orderNum) return;
    const matched = state.cateringOrders.find((o) => o.orderNumber === orderNum);
    if (matched) {
      setFinType('Pendapatan Catering');
      const isDpOnly = matched.paymentStatus === 'Belum Bayar' && matched.totalPayment > 0;
      setFinCategory(isDpOnly ? 'DP Pesanan Catering' : 'Pelunasan Pesanan Catering');
      setFinAmount(
        matched.remainingBalance > 0 ? matched.remainingBalance : matched.totalPayment
      );
      setFinDesc(
        `Penerimaan Pembayaran Pesanan ${matched.orderNumber} — ${matched.customerName}`
      );
      if (matched.paymentMethod === 'QRIS') setFinAccount('QRIS');
      else if (matched.paymentMethod === 'Pembayaran Tunai') setFinAccount('Kas Tunai');
      else setFinAccount('Bank Mandiri ERP');
    }
  };

  // Finance Submit with duplicate check & error handling
  const handleFinanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finDesc.trim()) {
      notifyError('Mohon isi deskripsi transaksi pembukuan.');
      return;
    }

    const cleanOrderRef = finOrderRef.trim().toUpperCase();
    const cleanAmount = Math.max(0, Math.round(Number(finAmount)));

    // Anti-double-counting guard for linked orders
    if (cleanOrderRef && finType === 'Pendapatan Catering') {
      const duplicateExists = state.financeEntries.some(
        (existing) =>
          (existing.orderRef?.toUpperCase() === cleanOrderRef ||
            existing.referenceCode.toUpperCase() === `LUNAS-${cleanOrderRef}`) &&
          existing.type === 'Pendapatan Catering' &&
          existing.category.toLowerCase() === finCategory.trim().toLowerCase() &&
          existing.amount === cleanAmount
      );
      if (duplicateExists) {
        notifyError(
          `Pencegahan pencatatan ganda: Jurnal ${finCategory} untuk pesanan ${cleanOrderRef} senilai ${formatRupiah(
            cleanAmount
          )} sudah tercatat sebelumnya.`
        );
        return;
      }
    }

    const seq = state.financeEntries.length + 1;
    const refCode = `TRX-${finDate.replace(/[^0-9]/g, '')}-${String(seq).padStart(3, '0')}`;

    try {
      await onSaveFinance({
        id: `fin-${Date.now()}`,
        ownerId,
        transactionDate: finDate,
        referenceCode: refCode,
        orderRef: cleanOrderRef || undefined,
        type: finType,
        category: finCategory.trim() || 'Operasional',
        description: finDesc.trim(),
        amount: cleanAmount,
        accountMethod: finAccount,
        settlementStatus: finStatus,
        reconciled: false,
      });
      setShowFinForm(false);
      setFinDesc('');
      setFinOrderRef('');
      notify(`Jurnal transaksi ${refCode} berhasil disimpan dan diaudit.`);
    } catch (err) {
      notifyError(
        `Gagal menyimpan jurnal keuangan: ${err instanceof Error ? err.message : 'Kesalahan server'}`
      );
    }
  };

  const handleToggleSettlementStatus = async (fin: FinanceEntry) => {
    if (fin.reconciled) {
      notifyError(
        `Jurnal ${fin.referenceCode} telah direkonsiliasi dan terkunci. Gunakan tombol Koreksi untuk penyesuaian beraudit.`
      );
      return;
    }
    try {
      await onSaveFinance({
        ...fin,
        settlementStatus: fin.settlementStatus === 'Lunas' ? 'Belum Lunas' : 'Lunas',
      });
      notify(
        `Status transaksi ${fin.referenceCode} diperbarui menjadi ${
          fin.settlementStatus === 'Lunas' ? 'Belum Lunas' : 'Lunas'
        }.`
      );
    } catch (err) {
      notifyError(
        `Gagal mengubah status transaksi: ${err instanceof Error ? err.message : 'Kesalahan server'}`
      );
    }
  };

  const handleReconcileEntry = async (fin: FinanceEntry) => {
    if (fin.reconciled) return;
    try {
      await onSaveFinance({
        ...fin,
        settlementStatus: 'Lunas',
        reconciled: true,
        reconciledAt: new Date().toISOString(),
        reconciledBy: `${adminDisplayName} (${currentRole})`,
      });
      notify(
        `Transaksi ${fin.referenceCode} berhasil direkonsiliasi & dikunci agar tidak terhapus sembarangan.`
      );
    } catch (err) {
      notifyError(
        `Gagal merekonsiliasi transaksi: ${err instanceof Error ? err.message : 'Kesalahan server'}`
      );
    }
  };

  const openCorrectionModal = (fin: FinanceEntry) => {
    setCorrectingEntry(fin);
    setCorrAmount(fin.amount);
    setCorrDesc(fin.description);
    setCorrAccount(fin.accountMethod);
    setCorrStatus(fin.settlementStatus);
    setCorrNote('');
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingEntry) return;
    if (corrNote.trim().length < 5) {
      notifyError('Alasan koreksi transaksi wajib diisi minimal 5 karakter untuk jejak audit.');
      return;
    }

    setCorrSaving(true);
    try {
      const existingTrail = parseAuditTrail(correctingEntry.auditTrailJson);
      const newAuditRecord: CorrectionAuditItem = {
        timestamp: new Date().toISOString(),
        actor: `${adminDisplayName} (${currentRole})`,
        previousAmount: correctingEntry.amount,
        newAmount: Math.max(0, Math.round(Number(corrAmount))),
        previousAccount: correctingEntry.accountMethod,
        newAccount: corrAccount,
        note: corrNote.trim().slice(0, 160),
      };
      const nextTrail = [newAuditRecord, ...existingTrail].slice(0, 6);
      const auditJson = JSON.stringify(nextTrail).slice(0, 1950);

      await onSaveFinance({
        ...correctingEntry,
        amount: newAuditRecord.newAmount,
        description: corrDesc.trim() || correctingEntry.description,
        accountMethod: corrAccount,
        settlementStatus: corrStatus,
        correctionNote: corrNote.trim().slice(0, 280),
        auditTrailJson: auditJson,
      });
      setCorrectingEntry(null);
      notify(
        `Koreksi transaksi ${correctingEntry.referenceCode} berhasil disimpan beserta riwayat audit.`
      );
    } catch (err) {
      notifyError(
        `Gagal menyimpan koreksi transaksi: ${err instanceof Error ? err.message : 'Kesalahan server'}`
      );
    } finally {
      setCorrSaving(false);
    }
  };

  // Inventory Submit
  const handleInventorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invName.trim() || !invSupplier.trim()) {
      notifyError('Mohon isi nama bahan makanan dan nama pemasok (supplier).');
      return;
    }
    try {
      await onSaveInventory({
        id: `inv-${Date.now()}`,
        ownerId,
        itemCode: invCode.trim() || `BHN-${Date.now().toString().slice(-4)}`,
        name: invName.trim(),
        category: invCategory.trim(),
        stockQty: Number(invQty),
        minStock: Number(invMin),
        unit: invUnit.trim(),
        unitCost: Number(invCost),
        supplierName: invSupplier.trim(),
        lastRestockDate: getJakartaTodayIso(),
      });
      setShowInvForm(false);
      setInvName('');
      setInvSupplier('');
      setInvCode(`BHN-${String(state.inventoryItems.length + 2).padStart(3, '0')}`);
      notify('Komoditas stok bahan makanan berhasil ditambahkan ke Cloud Firestore.');
    } catch (err) {
      notifyError(
        `Gagal menambahkan stok bahan: ${err instanceof Error ? err.message : 'Kesalahan server'}`
      );
    }
  };

  // Promotion Submit
  const handlePromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim() || !promoTitle.trim()) {
      notifyError('Mohon lengkapi kode voucher dan nama program promosi.');
      return;
    }
    try {
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
    } catch (err) {
      notifyError(
        `Gagal menerbitkan promosi: ${err instanceof Error ? err.message : 'Kesalahan server'}`
      );
    }
  };

  // User RBAC Submit
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      notifyError('Mohon isi nama lengkap dan alamat email pengguna.');
      return;
    }
    try {
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
    } catch (err) {
      notifyError(
        `Gagal menambah akun pengguna: ${err instanceof Error ? err.message : 'Kesalahan server'}`
      );
    }
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

  // Restore JSON Upload (Delegates confirmation & notice to App.tsx ConfirmActionModal)
  const handleFileRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const snapshot: ErpStateSnapshot = parsed.data || parsed;
      if (!Array.isArray(snapshot.menuItems) || !Array.isArray(snapshot.schools)) {
        notifyError('Format file backup tidak valid. Pastikan menggunakan file backup JSON resmi.');
        return;
      }
      await onRestoreBackup(snapshot);
    } catch {
      notifyError('Gagal membaca file backup JSON.');
    }
  };

  const matchesJournalPaymentMethod = (accountMethod: FinanceEntry['accountMethod']): boolean => {
    if (finFilterMethod === 'Semua') return true;
    if (finFilterMethod === 'QRIS') return accountMethod === 'QRIS';
    if (finFilterMethod === 'Tunai') return accountMethod === 'Kas Tunai';
    return BANK_ACCOUNTS.includes(accountMethod);
  };

  // Submenu + toolbar filtered finance entries
  const filteredFinanceEntries = useMemo(() => {
    return state.financeEntries.filter((f) => {
      // Submenu scoping first
      if (finSubMenu === 'pendapatan_catering' && f.type !== 'Pendapatan Catering') return false;
      if (finSubMenu === 'pendapatan_sekolah' && f.type !== 'Pendapatan Sekolah Rakyat') return false;
      if (finSubMenu === 'pengeluaran' && f.type !== 'Pengeluaran Operasional') return false;
      if (finSubMenu === 'kas_tunai' && f.accountMethod !== 'Kas Tunai') return false;
      if (finSubMenu === 'rekening_bank' && !BANK_ACCOUNTS.includes(f.accountMethod)) return false;
      if (finSubMenu === 'qris' && f.accountMethod !== 'QRIS') return false;
      if (finSubMenu === 'utang_supplier' && f.type !== 'Utang Supplier') return false;
      if (finSubMenu === 'piutang_pelanggan' && f.type !== 'Piutang Pelanggan') return false;

      const matchType = finFilterType === 'Semua' || f.type === finFilterType;
      const matchStatus = finFilterStatus === 'Semua' || f.settlementStatus === finFilterStatus;
      const matchMethod = matchesJournalPaymentMethod(f.accountMethod);
      const q = finSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        f.referenceCode.toLowerCase().includes(q) ||
        (f.orderRef && f.orderRef.toLowerCase().includes(q)) ||
        f.description.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.accountMethod.toLowerCase().includes(q);
      return matchType && matchStatus && matchMethod && matchSearch;
    });
  }, [state.financeEntries, finSubMenu, finFilterType, finFilterStatus, finFilterMethod, finSearch]);

  // Core Unified Accounting Metrics (Separated balances & zero hardcoded constants)
  const coreMetrics = useMemo(() => computeDashboardMetrics(state, 'Semua Unit', 'all'), [state]);

  // Per-bank exact breakdown
  const perBankBreakdown = useMemo(() => {
    return BANK_ACCOUNTS.map((bankName) => {
      const entries = state.financeEntries.filter((f) => f.accountMethod === bankName);
      const debitIn = entries
        .filter(
          (f) =>
            (f.type === 'Pendapatan Catering' || f.type === 'Pendapatan Sekolah Rakyat') &&
            f.settlementStatus === 'Lunas'
        )
        .reduce((s, f) => s + f.amount, 0);
      const creditOut = entries
        .filter((f) => f.type === 'Pengeluaran Operasional' && f.settlementStatus === 'Lunas')
        .reduce((s, f) => s + f.amount, 0);
      return {
        bankName,
        debitIn,
        creditOut,
        netBalance: debitIn - creditOut,
        txCount: entries.length,
      };
    });
  }, [state.financeEntries]);

  // Order receivables (Belum Bayar or remaining balance on DP orders, excluding Dibatalkan)
  const orderReceivables = useMemo(() => {
    return state.cateringOrders
      .filter((o) => o.status !== 'Dibatalkan' && o.paymentStatus !== 'Lunas')
      .map((o) => {
        const dpPaid = Math.max(0, o.downPayment || 0);
        const remaining = Math.max(0, o.totalPayment - dpPaid);
        return {
          ...o,
          dpPaid,
          remaining,
        };
      })
      .filter((o) => o.remaining > 0);
  }, [state.cateringOrders]);

  // Chronological Buku Kas Umum (Lunas inflows & outflows across Kas, Bank, QRIS)
  const bukuKasRows = useMemo(() => {
    const settled = state.financeEntries
      .filter(
        (f) =>
          f.settlementStatus === 'Lunas' &&
          (f.type === 'Pendapatan Catering' ||
            f.type === 'Pendapatan Sekolah Rakyat' ||
            f.type === 'Pengeluaran Operasional')
      )
      .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));

    let running = 0;
    return settled.map((f) => {
      const isDebit = f.type !== 'Pengeluaran Operasional';
      const debit = isDebit ? f.amount : 0;
      const kredit = isDebit ? 0 : f.amount;
      running += debit - kredit;
      return {
        entry: f,
        debit,
        kredit,
        runningBalance: running,
      };
    });
  }, [state.financeEntries]);

  // Expense breakdown by category for Laba Rugi & Pengeluaran submenu
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    state.financeEntries
      .filter((f) => f.type === 'Pengeluaran Operasional')
      .forEach((f) => {
        const key = f.category || 'Lainnya';
        map.set(key, (map.get(key) || 0) + f.amount);
      });
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [state.financeEntries]);

  // Cash flow summary per channel (Kas Tunai, Rekening Bank, QRIS)
  const cashFlowByChannel = useMemo(() => {
    const channels: Array<{
      label: string;
      matcher: (m: FinanceEntry['accountMethod']) => boolean;
      orderPaymentMatcher: (pm?: PaymentMethodType) => boolean;
    }> = [
      {
        label: 'Kas Tunai',
        matcher: (m) => m === 'Kas Tunai',
        orderPaymentMatcher: (pm) => pm === 'Pembayaran Tunai',
      },
      {
        label: 'Rekening Bank (Mandiri, BRI, BCA)',
        matcher: (m) => BANK_ACCOUNTS.includes(m),
        orderPaymentMatcher: (pm) => !pm || pm === 'Transfer Bank',
      },
      {
        label: 'QRIS Digital',
        matcher: (m) => m === 'QRIS',
        orderPaymentMatcher: (pm) => pm === 'QRIS',
      },
    ];

    const linkedOrderRefs = new Set<string>();
    state.financeEntries.forEach((f) => {
      if (f.orderRef) linkedOrderRefs.add(f.orderRef.trim().toUpperCase());
      if (f.referenceCode.startsWith('LUNAS-')) {
        linkedOrderRefs.add(f.referenceCode.replace('LUNAS-', '').trim().toUpperCase());
      }
      if (f.referenceCode.startsWith('DP-')) {
        linkedOrderRefs.add(f.referenceCode.replace('DP-', '').trim().toUpperCase());
      }
    });

    return channels.map((ch) => {
      const ledgerIn = state.financeEntries
        .filter(
          (f) =>
            (f.type === 'Pendapatan Catering' || f.type === 'Pendapatan Sekolah Rakyat') &&
            f.settlementStatus === 'Lunas' &&
            ch.matcher(f.accountMethod)
        )
        .reduce((s, f) => s + f.amount, 0);

      const unlinkedOrderCash = state.cateringOrders
        .filter(
          (o) =>
            o.status !== 'Dibatalkan' &&
            !linkedOrderRefs.has(o.orderNumber.trim().toUpperCase()) &&
            ch.orderPaymentMatcher(o.paymentMethod)
        )
        .reduce((s, o) => {
          if (o.paymentStatus === 'Lunas') return s + o.totalPayment;
          if (o.paymentStatus === 'DP Masuk') return s + Math.max(0, o.downPayment || 0);
          return s;
        }, 0);

      const cashIn = ledgerIn + unlinkedOrderCash;
      const cashOut = state.financeEntries
        .filter(
          (f) =>
            f.type === 'Pengeluaran Operasional' &&
            f.settlementStatus === 'Lunas' &&
            ch.matcher(f.accountMethod)
        )
        .reduce((s, f) => s + f.amount, 0);

      return {
        channel: ch.label,
        cashIn,
        cashOut,
        netCashFlow: cashIn - cashOut,
      };
    });
  }, [state.financeEntries, state.cateringOrders]);

  // Payment History Rows built from cateringOrders + paidNotifications (Preserved Request #8)
  const orderHistoryRows = state.cateringOrders
    .filter(
      (ord) =>
        ord.status !== 'Dibatalkan' &&
        (ord.paymentStatus === 'Lunas' ||
          ord.paymentStatus === 'DP Masuk' ||
          (ord.downPayment || 0) > 0)
    )
    .map((ord) => {
      const matchedNotif = paidNotifications.find(
        (n) => n.orderNumber === ord.orderNumber || n.orderId === ord.id
      );
      const rawMethod: PaymentMethodType =
        ord.paymentMethod || matchedNotif?.paymentMethod || 'Transfer Bank';
      const paidAmount =
        ord.paymentStatus === 'Lunas'
          ? ord.totalPayment
          : Math.max(0, ord.downPayment || 0);
      return {
        id: `pay-${ord.id}`,
        orderNumber: ord.orderNumber,
        dateLabel: matchedNotif?.paidAt || formatTanggalIndonesia(ord.orderDate),
        customerName: ord.customerName,
        packageLabel: ord.packageName,
        paymentMethod: rawMethod,
        paidAmount,
        remainingBalance: ord.paymentStatus === 'Lunas' ? 0 : Math.max(0, ord.remainingBalance || 0),
        paymentStatus: ord.paymentStatus,
      };
    });

  const extraNotifRows = paidNotifications
    .filter((n) => !orderHistoryRows.some((r) => r.orderNumber === n.orderNumber))
    .map((n) => ({
      id: `pay-notif-${n.id}`,
      orderNumber: n.orderNumber,
      dateLabel: n.paidAt,
      customerName: n.customerName,
      packageLabel: n.note || 'Pembayaran Pesanan Catering',
      paymentMethod: n.paymentMethod || 'Transfer Bank',
      paidAmount: n.amount,
      remainingBalance: 0,
      paymentStatus: 'Lunas' as const,
    }));

  const allPaymentHistoryRows = [...extraNotifRows, ...orderHistoryRows];

  const paymentMethodCounts = {
    Semua: allPaymentHistoryRows.length,
    QRIS: allPaymentHistoryRows.filter((r) => r.paymentMethod === 'QRIS').length,
    'Transfer Bank': allPaymentHistoryRows.filter((r) => r.paymentMethod === 'Transfer Bank').length,
    'Pembayaran Tunai': allPaymentHistoryRows.filter(
      (r) => r.paymentMethod === 'Pembayaran Tunai'
    ).length,
  };

  const filteredPaymentHistoryRows = allPaymentHistoryRows.filter((row) => {
    const matchMethod =
      paymentHistoryMethodFilter === 'Semua' || row.paymentMethod === paymentHistoryMethodFilter;
    const q = paymentHistorySearch.trim().toLowerCase();
    const matchQuery =
      !q ||
      row.orderNumber.toLowerCase().includes(q) ||
      row.customerName.toLowerCase().includes(q) ||
      row.packageLabel.toLowerCase().includes(q);
    return matchMethod && matchQuery;
  });

  const filteredPaymentHistoryTotal = filteredPaymentHistoryRows.reduce(
    (sum, row) => sum + row.paidAmount,
    0
  );

  const financialSummary = computeFinancialReportSummary(filteredFinanceEntries, state);
  const currentFilterLabel =
    finSubMenu !== 'ringkasan'
      ? `Submenu: ${FINANCE_SUBMENUS.find((s) => s.key === finSubMenu)?.label || finSubMenu}`
      : finFilterType === 'Semua' && finFilterStatus === 'Semua' && finFilterMethod === 'Semua'
      ? 'Seluruh Unit Usaha (Catering Komersial & Sekolah Rakyat)'
      : `Filter Akun: ${finFilterType} · Status: ${finFilterStatus} · Metode: ${finFilterMethod}`;

  // Helper to render the Journal Table with Reconciliation & Audit Correction
  const renderJournalTable = (rows: FinanceEntry[], emptyMsg: string) => (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <th className="py-3 px-4 font-semibold">No. Referensi &amp; Pesanan</th>
              <th className="py-3 px-4 font-semibold">Jenis &amp; Kategori Akun</th>
              <th className="py-3 px-4 font-semibold">Uraian &amp; Riwayat Koreksi</th>
              <th className="py-3 px-4 font-semibold">Rekening</th>
              <th className="py-3 px-4 font-semibold text-right">Nominal (IDR)</th>
              <th className="py-3 px-4 font-semibold">Status &amp; Rekonsiliasi</th>
              <th className="py-3 px-4 font-semibold text-right">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((fin) => {
              const auditItems = parseAuditTrail(fin.auditTrailJson);
              const isAuditExpanded = expandedAuditId === fin.id;
              return (
                <React.Fragment key={fin.id}>
                  <tr className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-mono tabular-nums font-bold text-slate-900">
                        {fin.referenceCode}
                      </div>
                      <div className="text-slate-500">
                        {formatTanggalIndonesia(fin.transactionDate)}
                      </div>
                      {fin.orderRef && (
                        <div className="text-[11px] font-mono text-emerald-700 font-semibold mt-0.5">
                          Ref Pesanan: {fin.orderRef}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{fin.type}</div>
                      <div className="text-slate-500">{fin.category}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-xs">
                      <div>{fin.description}</div>
                      {fin.correctionNote && (
                        <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 mt-1">
                          Koreksi: {fin.correctionNote}
                        </div>
                      )}
                      {auditItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedAuditId(isAuditExpanded ? null : fin.id)
                          }
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline"
                        >
                          <History className="h-3 w-3" />
                          <span>
                            {isAuditExpanded ? 'Tutup' : 'Lihat'} Riwayat Audit ({auditItems.length})
                          </span>
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{fin.accountMethod}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                      {formatRupiah(fin.amount)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        {fin.reconciled ? (
                          <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                            <Lock className="h-3 w-3" />
                            <span>{fin.settlementStatus} · Terrekonsiliasi</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleSettlementStatus(fin)}
                            className={`font-semibold hover:underline block ${
                              fin.settlementStatus === 'Lunas'
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {fin.settlementStatus} (Klik ubah)
                          </button>
                        )}
                        {fin.reconciledBy && (
                          <div className="text-[10px] text-slate-400">
                            Oleh: {fin.reconciledBy}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        {!fin.reconciled && (
                          <button
                            type="button"
                            onClick={() => handleReconcileEntry(fin)}
                            className="rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800"
                          >
                            Rekonsiliasi
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openCorrectionModal(fin)}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white hover:bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700"
                        >
                          <Edit3 className="h-3 w-3" /> Koreksi
                        </button>
                        {fin.reconciled ? (
                          <span
                            title="Transaksi yang sudah direkonsiliasi tidak boleh dihapus"
                            className="inline-flex items-center gap-1 text-[11px] text-slate-400 cursor-not-allowed px-1.5"
                          >
                            <Lock className="h-3 w-3" /> Terkunci
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onDeleteFinance(fin.id)}
                            aria-label={`Hapus transaksi ${fin.referenceCode}`}
                            className="text-red-600 hover:text-red-800 font-semibold px-1"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isAuditExpanded && auditItems.length > 0 && (
                    <tr className="bg-slate-50/90">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="text-[11px] font-bold text-slate-700 mb-1.5">
                          Riwayat Koreksi Jurnal {fin.referenceCode}:
                        </div>
                        <div className="space-y-1">
                          {auditItems.map((aud, i) => (
                            <div
                              key={`${fin.id}-aud-${i}`}
                              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 border-l-2 border-amber-500 pl-2.5"
                            >
                              <span className="font-mono text-slate-500">
                                {new Date(aud.timestamp).toLocaleString('id-ID', {
                                  timeZone: 'Asia/Jakarta',
                                })}
                              </span>
                              <span className="font-semibold text-slate-800">{aud.actor}</span>
                              <span>
                                Nominal: {formatRupiah(aud.previousAmount)} →{' '}
                                <strong>{formatRupiah(aud.newAmount)}</strong>
                              </span>
                              <span>
                                Akun: {aud.previousAccount} → {aud.newAccount}
                              </span>
                              <span className="text-amber-800 font-medium">Alasan: {aud.note}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 px-4 text-center text-xs text-slate-500">
                  {emptyMsg}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {errorFeedback && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-900 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-700 shrink-0" />
          <span>{errorFeedback}</span>
        </div>
      )}

      {/* SECTION 1: KEUANGAN, AKUNTANSI & PELAPORAN RESMI (12 SUBMENUS) */}
      {activeSection === 'keuangan' && (
        <div className="space-y-5">
          {/* Executive Financial Header & Multi-Format Professional Export Center */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="bg-slate-900 px-5 py-4 text-white flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold shrink-0">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold tracking-tight">
                    Sistem Keuangan, Pembukuan &amp; Pelaporan Akuntansi Teraudit
                  </h1>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Pemisahan Saldo Kas, Bank, QRIS, Piutang &amp; Utang · Rekonsiliasi Terkunci · 12 Submenu Akuntansi Enterprise
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setReportPreviewOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap"
                >
                  <Printer className="h-3.5 w-3.5 text-amber-400" />
                  <span>Pratinjau &amp; PDF</span>
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
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition-colors whitespace-nowrap"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Unduh Resmi (.HTML)</span>
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
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 px-3 py-2 text-xs font-bold text-slate-950 transition-colors whitespace-nowrap"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Excel (.XLS)</span>
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
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* Separated Balances Bar (Kas Tunai | Rekening Bank | QRIS | Piutang Pelanggan | Utang Supplier) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4 bg-slate-50/70 border-b border-slate-200 text-xs">
              <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                <span className="text-[11px] font-semibold text-slate-500 block">
                  Saldo Kas Tunai
                </span>
                <span className="font-mono tabular-nums text-base font-extrabold text-slate-900 mt-0.5 block">
                  {formatRupiah(coreMetrics.saldoKasTunai)}
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                <span className="text-[11px] font-semibold text-slate-500 block">
                  Saldo Rekening Bank
                </span>
                <span className="font-mono tabular-nums text-base font-extrabold text-slate-900 mt-0.5 block">
                  {formatRupiah(coreMetrics.saldoRekeningBank)}
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                <span className="text-[11px] font-semibold text-slate-500 block">
                  Saldo Dompet QRIS
                </span>
                <span className="font-mono tabular-nums text-base font-extrabold text-emerald-700 mt-0.5 block">
                  {formatRupiah(coreMetrics.saldoQris)}
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                <span className="text-[11px] font-semibold text-slate-500 block">
                  Piutang Pelanggan
                </span>
                <span className="font-mono tabular-nums text-base font-extrabold text-amber-700 mt-0.5 block">
                  {formatRupiah(coreMetrics.totalPiutang)}
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3.5 col-span-2 sm:col-span-1">
                <span className="text-[11px] font-semibold text-slate-500 block">
                  Utang Supplier
                </span>
                <span className="font-mono tabular-nums text-base font-extrabold text-red-700 mt-0.5 block">
                  {formatRupiah(coreMetrics.totalUtang)}
                </span>
              </div>
            </div>

            {/* 12 Finance Submenu Navigation */}
            <div className="px-4 py-3 bg-white flex flex-wrap gap-1.5" role="tablist" aria-label="12 Submenu Keuangan">
              {FINANCE_SUBMENUS.map((sub) => {
                const active = finSubMenu === sub.key;
                return (
                  <button
                    key={sub.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => handleSelectFinanceSubmenu(sub.key)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submenu-specific contextual panels */}
          {finSubMenu === 'rekening_bank' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {perBankBreakdown.map((bk) => (
                <div key={bk.bankName} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{bk.bankName}</span>
                    <span className="text-slate-500">{bk.txCount} transaksi</span>
                  </div>
                  <div className="font-mono tabular-nums text-lg font-extrabold text-slate-900">
                    {formatRupiah(bk.netBalance)}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                    <span>Masuk: {formatRupiah(bk.debitIn)}</span>
                    <span>Keluar: {formatRupiah(bk.creditOut)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {finSubMenu === 'pengeluaran' && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-900">Rekapitulasi Pengeluaran Operasional per Kategori</h2>
                <span className="font-mono font-bold text-red-700">
                  Total: {formatRupiah(coreMetrics.totalPengeluaran)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {expenseByCategory.map((item) => (
                  <div key={item.category} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-slate-600 font-medium truncate">{item.category}</div>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">
                      {formatRupiah(item.amount)}
                    </div>
                  </div>
                ))}
                {expenseByCategory.length === 0 && (
                  <div className="text-slate-500 col-span-full">Belum ada pengeluaran tercatat.</div>
                )}
              </div>
            </div>
          )}

          {finSubMenu === 'piutang_pelanggan' && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-amber-50/60 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold text-slate-900">
                    Daftar Piutang Pesanan Catering (Belum Bayar / Sisa Pelunasan DP)
                  </h2>
                  <p className="text-[11px] text-slate-600">
                    Uang yang belum dibayar atau baru DP tidak dihitung sebagai uang kas masuk sebelum diverifikasi lunas.
                  </p>
                </div>
                <span className="font-mono text-xs font-extrabold text-amber-800">
                  Total Sisa Tagihan Order: {formatRupiah(orderReceivables.reduce((s, o) => s + o.remaining, 0))}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <th className="py-2.5 px-4 font-semibold">No. Pesanan</th>
                      <th className="py-2.5 px-4 font-semibold">Pelanggan</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Total Tagihan</th>
                      <th className="py-2.5 px-4 font-semibold text-right">DP Masuk</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Sisa Piutang</th>
                      <th className="py-2.5 px-4 font-semibold">Status Pembayaran</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orderReceivables.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{ord.orderNumber}</td>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-900">{ord.customerName}</div>
                          <div className="text-[11px] text-slate-500">{ord.whatsapp}</div>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono">{formatRupiah(ord.totalPayment)}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-emerald-700">
                          {formatRupiah(ord.dpPaid)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-800">
                          {formatRupiah(ord.remaining)}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-amber-700">{ord.paymentStatus}</td>
                      </tr>
                    ))}
                    {orderReceivables.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500">
                          Seluruh pesanan catering aktif sudah lunas (Rp 0 piutang pesanan).
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pengaturan Rekening Bank & QRIS Pembayaran Pelanggan (shown in ringkasan, rekening_bank, qris) */}
          {(finSubMenu === 'ringkasan' || finSubMenu === 'rekening_bank' || finSubMenu === 'qris') &&
            onSaveSiteSettings &&
            siteSettings && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-emerald-700" />
                      <span>Rekening Bank &amp; QRIS Pembayaran Pelanggan</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Bank Utama: <span className="font-semibold text-slate-800">{siteSettings.bankName || '-'}</span> ({siteSettings.bankAccountNumber || '-'})
                      {siteSettings.bank2Name ? ` · Bank 2: ${siteSettings.bank2Name} (${siteSettings.bank2AccountNumber})` : ''}
                      {' · '}QRIS: <span className="font-semibold text-emerald-700">{siteSettings.qrisMerchantName || 'Belum diisi'}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPaymentConfig((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 text-xs font-semibold text-emerald-900 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Building2 className="h-3.5 w-3.5 text-emerald-700" />
                    <span>{showPaymentConfig ? 'Tutup Pengaturan Bank & QRIS' : 'Atur Rekening Bank & QRIS'}</span>
                  </button>
                </div>

                {showPaymentConfig && (
                  <form
                    onSubmit={handleSavePaymentConfig}
                    className="border-t border-slate-200 pt-4 space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="fin-bank1-name" className="block text-xs font-semibold text-slate-700 mb-1">
                          Nama Bank Utama (Bank 1)
                        </label>
                        <input
                          id="fin-bank1-name"
                          type="text"
                          value={payBank1Name}
                          onChange={(e) => setPayBank1Name(e.target.value)}
                          placeholder="Bank Mandiri"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                        />
                      </div>
                      <div>
                        <label htmlFor="fin-bank1-num" className="block text-xs font-semibold text-slate-700 mb-1">
                          No. Rekening Bank 1
                        </label>
                        <input
                          id="fin-bank1-num"
                          type="text"
                          value={payBank1Num}
                          onChange={(e) => setPayBank1Num(e.target.value)}
                          placeholder="123-00-0987654-3"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                        />
                      </div>
                      <div>
                        <label htmlFor="fin-bank1-holder" className="block text-xs font-semibold text-slate-700 mb-1">
                          Atas Nama Rekening 1
                        </label>
                        <input
                          id="fin-bank1-holder"
                          type="text"
                          value={payBank1Holder}
                          onChange={(e) => setPayBank1Holder(e.target.value)}
                          placeholder="PT Smart Catering Nusantara"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="fin-bank2-name" className="block text-xs font-semibold text-slate-700 mb-1">
                          Nama Bank Kedua (Opsional)
                        </label>
                        <input
                          id="fin-bank2-name"
                          type="text"
                          value={payBank2Name}
                          onChange={(e) => setPayBank2Name(e.target.value)}
                          placeholder="Bank BCA / BRI"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                        />
                      </div>
                      <div>
                        <label htmlFor="fin-bank2-num" className="block text-xs font-semibold text-slate-700 mb-1">
                          No. Rekening Bank 2
                        </label>
                        <input
                          id="fin-bank2-num"
                          type="text"
                          value={payBank2Num}
                          onChange={(e) => setPayBank2Num(e.target.value)}
                          placeholder="522-0394-881"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                        />
                      </div>
                      <div>
                        <label htmlFor="fin-bank2-holder" className="block text-xs font-semibold text-slate-700 mb-1">
                          Atas Nama Rekening 2
                        </label>
                        <input
                          id="fin-bank2-holder"
                          type="text"
                          value={payBank2Holder}
                          onChange={(e) => setPayBank2Holder(e.target.value)}
                          placeholder="PT Smart Catering Nusantara"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <QrCode className="h-4 w-4 text-emerald-700" />
                        <span>Pengaturan QRIS Usaha</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                        <div>
                          <label htmlFor="fin-qris-merchant" className="block text-xs font-semibold text-slate-700 mb-1">
                            Nama Merchant QRIS
                          </label>
                          <input
                            id="fin-qris-merchant"
                            type="text"
                            value={payQrisMerchant}
                            onChange={(e) => setPayQrisMerchant(e.target.value)}
                            placeholder="SMART CATERING NUSANTARA"
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                          />
                        </div>
                        <div>
                          <label htmlFor="fin-qris-nmid" className="block text-xs font-semibold text-slate-700 mb-1">
                            NMID / ID Merchant QRIS
                          </label>
                          <input
                            id="fin-qris-nmid"
                            type="text"
                            value={payQrisNmid}
                            onChange={(e) => setPayQrisNmid(e.target.value)}
                            placeholder="ID102026098765432"
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900"
                          />
                        </div>
                        <div>
                          <label htmlFor="fin-qris-img" className="block text-xs font-semibold text-slate-700 mb-1">
                            Upload Gambar QR QRIS atau URL
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              id="fin-qris-img"
                              type="text"
                              value={payQrisImageUrl}
                              onChange={(e) => setPayQrisImageUrl(e.target.value)}
                              placeholder="Tempel URL gambar QRIS..."
                              className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-mono text-slate-900"
                            />
                            <input
                              ref={qrisUploadInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleQrisFileSelect}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => qrisUploadInputRef.current?.click()}
                              className="rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-2.5 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap"
                            >
                              Upload QR
                            </button>
                          </div>
                        </div>
                      </div>
                      {payQrisImageUrl && (
                        <div className="flex items-center gap-3 pt-1">
                          <img
                            src={payQrisImageUrl}
                            alt="Pratinjau QRIS"
                            className="h-20 w-20 rounded-lg border border-slate-300 bg-white object-contain p-1"
                          />
                          <div className="text-[11px] text-slate-600 space-y-1">
                            <div className="font-semibold text-slate-800">Pratinjau QRIS Aktif</div>
                            <button
                              type="button"
                              onClick={() => setPayQrisImageUrl('')}
                              className="text-red-600 hover:underline font-semibold"
                            >
                              Hapus Gambar QR
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowPaymentConfig(false)}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={savingPaymentConfig}
                        className="rounded-lg bg-emerald-700 hover:bg-emerald-800 px-5 py-2 text-xs font-semibold text-white"
                      >
                        {savingPaymentConfig ? 'Menyimpan...' : 'Simpan Rekening Bank & QRIS'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

          {/* DEDICATED REPORT SUBMENU: 10. BUKU KAS */}
          {finSubMenu === 'buku_kas' && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Buku Kas Umum (Mutasi Debit, Kredit &amp; Saldo Berjalan)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Menampilkan transaksi berstatus Lunas secara kronologis dari Kas Tunai, Bank, dan QRIS.
                  </p>
                </div>
                <div className="text-right font-mono text-xs">
                  <div className="text-slate-500">Saldo Akhir Buku Kas</div>
                  <div className="text-sm font-extrabold text-emerald-700">
                    {formatRupiah(
                      bukuKasRows.length > 0 ? bukuKasRows[bukuKasRows.length - 1].runningBalance : 0
                    )}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <th className="py-3 px-4 font-semibold">Tanggal</th>
                      <th className="py-3 px-4 font-semibold">Referensi</th>
                      <th className="py-3 px-4 font-semibold">Uraian Transaksi</th>
                      <th className="py-3 px-4 font-semibold">Rekening</th>
                      <th className="py-3 px-4 font-semibold text-right">Debit (Masuk)</th>
                      <th className="py-3 px-4 font-semibold text-right">Kredit (Keluar)</th>
                      <th className="py-3 px-4 font-semibold text-right">Saldo Berjalan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bukuKasRows.map((row) => (
                      <tr key={row.entry.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 whitespace-nowrap text-slate-600">
                          {formatTanggalIndonesia(row.entry.transactionDate)}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                          {row.entry.referenceCode}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">{row.entry.description}</td>
                        <td className="py-2.5 px-4 text-slate-600">{row.entry.accountMethod}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-emerald-700 font-semibold">
                          {row.debit > 0 ? formatRupiah(row.debit) : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-red-700 font-semibold">
                          {row.kredit > 0 ? formatRupiah(row.kredit) : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(row.runningBalance)}
                        </td>
                      </tr>
                    ))}
                    {bukuKasRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          Belum ada mutasi kas Lunas tercatat pada periode ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DEDICATED REPORT SUBMENU: 11. LAPORAN LABA RUGI */}
          {finSubMenu === 'laba_rugi' && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Laporan Laba Rugi Operasional (Income Statement)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Pendapatan diakui berdasarkan penerimaan aktual terverifikasi dikurangi seluruh biaya operasional.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReportPreviewOpen(true)}
                  className="rounded-lg bg-slate-900 text-white px-3.5 py-2 text-xs font-semibold hover:bg-slate-800 whitespace-nowrap"
                >
                  Buka Cetak LPJ Resmi
                </button>
              </div>
              <table className="w-full border border-slate-200 border-collapse text-xs">
                <tbody>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <td colSpan={2} className="py-2 px-4 font-bold uppercase text-slate-700">
                      Pendapatan Usaha (Revenue)
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2.5 px-4">Pendapatan Catering Komersial (Pembayaran Diterima)</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">
                      {formatRupiah(coreMetrics.totalPendapatanCatering)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2.5 px-4">Pendapatan Program Sekolah Rakyat</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">
                      {formatRupiah(coreMetrics.totalPendapatanSekolah)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-emerald-50/40">
                    <td className="py-2.5 px-4 font-bold text-slate-900">
                      Total Penerimaan Pendapatan Operasional
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-extrabold text-emerald-800">
                      {formatRupiah(coreMetrics.totalPembayaranDiterima)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <td colSpan={2} className="py-2 px-4 font-bold uppercase text-slate-700">
                      Beban &amp; Pengeluaran Operasional
                    </td>
                  </tr>
                  {expenseByCategory.map((ex) => (
                    <tr key={ex.category} className="border-b border-slate-100">
                      <td className="py-2 px-4 text-slate-700">Beban · {ex.category}</td>
                      <td className="py-2 px-4 text-right font-mono text-red-700">
                        ({formatRupiah(ex.amount)})
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b border-slate-200 bg-red-50/30">
                    <td className="py-2.5 px-4 font-bold text-slate-900">
                      Total Beban &amp; Pengeluaran Operasional
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-red-700">
                      ({formatRupiah(coreMetrics.totalPengeluaran)})
                    </td>
                  </tr>
                  <tr className="bg-slate-900 text-white">
                    <td className="py-3 px-4 font-extrabold">
                      KEUNTUNGAN BERSIH (LABA BERSIH OPERASIONAL)
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm font-extrabold text-emerald-400">
                      {formatRupiah(coreMetrics.keuntunganBersih)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* DEDICATED REPORT SUBMENU: 12. LAPORAN ARUS KAS */}
          {finSubMenu === 'arus_kas' && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Laporan Arus Kas Terpisah per Saluran (Cash Flow Statement)
                </h2>
                <p className="text-xs text-slate-500">
                  Memisahkan arus uang masuk aktual dan uang keluar pada Kas Tunai, Rekening Bank, dan QRIS.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border border-slate-200 border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                      <th className="py-2.5 px-4 text-left font-semibold">Saluran Kas / Bank</th>
                      <th className="py-2.5 px-4 text-right font-semibold">Arus Kas Masuk (Lunas)</th>
                      <th className="py-2.5 px-4 text-right font-semibold">Arus Kas Keluar (Lunas)</th>
                      <th className="py-2.5 px-4 text-right font-semibold">Arus Kas Bersih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cashFlowByChannel.map((row) => (
                      <tr key={row.channel} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{row.channel}</td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700">
                          {formatRupiah(row.cashIn)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-red-700">
                          ({formatRupiah(row.cashOut)})
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900">
                          {formatRupiah(row.netCashFlow)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-900 text-white font-bold">
                      <td className="py-3 px-4">TOTAL POSISI SALDO KAS, BANK &amp; QRIS</td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-300">
                        {formatRupiah(cashFlowByChannel.reduce((s, r) => s + r.cashIn, 0))}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-red-300">
                        ({formatRupiah(cashFlowByChannel.reduce((s, r) => s + r.cashOut, 0))})
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-emerald-400">
                        {formatRupiah(coreMetrics.saldoKasDanBank)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Filter & Action Toolbar for Journal Entries (shown for ledger-based submenus) */}
          {finSubMenu !== 'buku_kas' && finSubMenu !== 'laba_rugi' && finSubMenu !== 'arus_kas' && (
            <>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2.5 flex-1">
                  <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                    <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={finSearch}
                      onChange={(e) => setFinSearch(e.target.value)}
                      placeholder="Cari no. referensi, pesanan, atau uraian..."
                      aria-label="Cari jurnal keuangan"
                      className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                    />
                  </div>

                  {finSubMenu === 'ringkasan' && (
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
                  )}

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

                  <select
                    aria-label="Filter Metode Pembayaran Jurnal"
                    value={finFilterMethod}
                    onChange={(e) =>
                      setFinFilterMethod(
                        e.target.value as 'Semua' | 'QRIS' | 'Transfer Bank' | 'Tunai'
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800"
                  >
                    <option value="Semua">Semua Metode Bayar</option>
                    <option value="QRIS">QRIS</option>
                    <option value="Transfer Bank">Transfer Bank</option>
                    <option value="Tunai">Tunai</option>
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
                  <h2 className="text-sm font-bold text-slate-900">
                    Input Jurnal Pembukuan Keuangan Baru (Anti-Duplikasi Pesanan)
                  </h2>
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
                      <label htmlFor="fin-order-ref" className="block text-xs font-semibold text-slate-700 mb-1">
                        Referensi Pesanan (Opsional)
                      </label>
                      <select
                        id="fin-order-ref"
                        value={finOrderRef}
                        onChange={(e) => handleSelectOrderRefForFinance(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                      >
                        <option value="">-- Transaksi Umum / Non-Pesanan --</option>
                        {state.cateringOrders
                          .filter((o) => o.status !== 'Dibatalkan')
                          .map((ord) => (
                            <option key={ord.id} value={ord.orderNumber}>
                              {ord.orderNumber} · {ord.customerName} ({ord.paymentStatus})
                            </option>
                          ))}
                      </select>
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
                        Rekening Kas / Bank / QRIS
                      </label>
                      <select
                        id="fin-acc"
                        value={finAccount}
                        onChange={(e) => setFinAccount(e.target.value as FinanceEntry['accountMethod'])}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                      >
                        <option value="QRIS">QRIS</option>
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
                    <div className="sm:col-span-2">
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

              {renderJournalTable(
                filteredFinanceEntries,
                'Belum ada jurnal transaksi pada submenu atau filter ini.'
              )}
            </>
          )}

          {/* Riwayat Pembayaran Transaksi Pelanggan dengan Filter QRIS, Transfer Bank & Tunai (Preserved Request #8) */}
          {(finSubMenu === 'ringkasan' || finSubMenu === 'pendapatan_catering' || finSubMenu === 'qris') && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Riwayat Pembayaran Transaksi (QRIS, Transfer Bank &amp; Tunai)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                    {filteredPaymentHistoryRows.length} transaksi · Total Masuk:{' '}
                    <span className="font-bold text-emerald-700">
                      {formatRupiah(filteredPaymentHistoryTotal)}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div
                    role="group"
                    aria-label="Filter metode pembayaran riwayat"
                    className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
                  >
                    {(
                      [
                        { key: 'Semua', label: `Semua (${paymentMethodCounts.Semua})` },
                        { key: 'QRIS', label: `QRIS (${paymentMethodCounts.QRIS})` },
                        {
                          key: 'Transfer Bank',
                          label: `Transfer Bank (${paymentMethodCounts['Transfer Bank']})`,
                        },
                        {
                          key: 'Pembayaran Tunai',
                          label: `Tunai (${paymentMethodCounts['Pembayaran Tunai']})`,
                        },
                      ] as const
                    ).map((tab) => {
                      const active = paymentHistoryMethodFilter === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setPaymentHistoryMethodFilter(tab.key)}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                            active
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative min-w-[200px]">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      aria-label="Cari riwayat pembayaran"
                      value={paymentHistorySearch}
                      onChange={(e) => setPaymentHistorySearch(e.target.value)}
                      placeholder="Cari nomor pesanan atau nama..."
                      className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {filteredPaymentHistoryRows.length === 0 ? (
                <div className="p-8 text-center space-y-2.5 text-xs text-slate-500">
                  <p className="font-semibold text-slate-700">
                    Belum ada riwayat pembayaran untuk filter{' '}
                    {paymentHistoryMethodFilter === 'Pembayaran Tunai'
                      ? 'Tunai'
                      : paymentHistoryMethodFilter}
                    .
                  </p>
                  {(paymentHistoryMethodFilter !== 'Semua' || paymentHistorySearch.trim() !== '') && (
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentHistoryMethodFilter('Semua');
                        setPaymentHistorySearch('');
                      }}
                      className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      Tampilkan Semua Transaksi
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <th className="py-3 px-4 font-semibold">No. Pesanan &amp; Waktu</th>
                        <th className="py-3 px-4 font-semibold">Pelanggan &amp; Keterangan</th>
                        <th className="py-3 px-4 font-semibold">Metode Pembayaran</th>
                        <th className="py-3 px-4 font-semibold text-right">Dibayar (IDR)</th>
                        <th className="py-3 px-4 font-semibold text-right">Sisa Piutang</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPaymentHistoryRows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <div className="font-mono tabular-nums font-bold text-slate-900">
                              {row.orderNumber}
                            </div>
                            <div className="text-[11px] text-slate-500">{row.dateLabel}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{row.customerName}</div>
                            <div className="text-[11px] text-slate-500 truncate max-w-xs">
                              {row.packageLabel}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                            {row.paymentMethod === 'Pembayaran Tunai' ? 'Tunai' : row.paymentMethod}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-700 whitespace-nowrap">
                            {formatRupiah(row.paidAmount)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                            {row.remainingBalance > 0 ? formatRupiah(row.remainingBalance) : 'Rp 0'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`font-semibold ${
                                row.paymentStatus === 'Lunas' ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {row.paymentStatus === 'Lunas' ? 'Lunas' : 'DP Masuk'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Modal Koreksi Jurnal dengan Jejak Audit Wajib */}
          {correctingEntry && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
              role="dialog"
              aria-modal="true"
              aria-labelledby="correction-modal-title"
            >
              <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
                <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
                  <div>
                    <h2 id="correction-modal-title" className="text-sm font-bold">
                      Koreksi Transaksi Keuangan ({correctingEntry.referenceCode})
                    </h2>
                    <p className="text-[11px] text-slate-300">
                      Setiap koreksi disimpan permanen ke riwayat audit transaksi dan Log Audit Sistem.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCorrectingEntry(null)}
                    aria-label="Tutup koreksi"
                    className="rounded-lg p-1 text-slate-400 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveCorrection} className="p-5 space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="corr-amount" className="block font-semibold text-slate-700 mb-1">
                        Nominal Terkoreksi (IDR)
                      </label>
                      <input
                        id="corr-amount"
                        type="number"
                        min={0}
                        value={corrAmount}
                        onChange={(e) => setCorrAmount(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="corr-account" className="block font-semibold text-slate-700 mb-1">
                        Rekening Kas / Bank
                      </label>
                      <select
                        id="corr-account"
                        value={corrAccount}
                        onChange={(e) =>
                          setCorrAccount(e.target.value as FinanceEntry['accountMethod'])
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                      >
                        <option value="QRIS">QRIS</option>
                        <option value="Bank Mandiri ERP">Bank Mandiri ERP</option>
                        <option value="Bank BRI Sekolah Rakyat">Bank BRI Sekolah Rakyat</option>
                        <option value="Bank BCA Corporate">Bank BCA Corporate</option>
                        <option value="Kas Tunai">Kas Tunai</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="corr-desc" className="block font-semibold text-slate-700 mb-1">
                      Uraian Transaksi
                    </label>
                    <input
                      id="corr-desc"
                      type="text"
                      value={corrDesc}
                      onChange={(e) => setCorrDesc(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                    />
                  </div>

                  <div>
                    <label htmlFor="corr-status" className="block font-semibold text-slate-700 mb-1">
                      Status Penyelesaian
                    </label>
                    <select
                      id="corr-status"
                      value={corrStatus}
                      onChange={(e) =>
                        setCorrStatus(e.target.value as FinanceEntry['settlementStatus'])
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    >
                      <option value="Lunas">Lunas</option>
                      <option value="Belum Lunas">Belum Lunas</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="corr-note" className="block font-semibold text-slate-700 mb-1">
                      Alasan Koreksi Wajib (Min. 5 karakter)
                    </label>
                    <textarea
                      id="corr-note"
                      rows={2}
                      required
                      value={corrNote}
                      onChange={(e) => setCorrNote(e.target.value)}
                      placeholder="Contoh: Penyesuaian selisih biaya transfer bank atau salah input nominal nota..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setCorrectingEntry(null)}
                      className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={corrSaving}
                      className="rounded-lg bg-slate-900 hover:bg-slate-800 px-4 py-2 font-semibold text-white disabled:opacity-60"
                    >
                      {corrSaving ? 'Menyimpan Koreksi...' : 'Simpan Koreksi & Catat Audit'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

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
                      Siap dicetak ke PDF (Ctrl+P / Tombol Cetak) atau diunduh sebagai Dokumen Resmi &amp; Spreadsheet Excel
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
                      <span>Unduh Dokumen (.HTML)</span>
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
                          <td className="py-2 px-3 font-medium">Beban Pokok Produksi &amp; Operasional</td>
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

                  <div className="space-y-2">
                    <h4 className="font-bold uppercase tracking-wider text-slate-700">
                      II. Rincian Jurnal Transaksi ({filteredFinanceEntries.length} Transaksi)
                    </h4>
                    <table className="w-full border border-slate-300 border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300">
                          <th className="py-2 px-2.5 text-left">Referensi</th>
                          <th className="py-2 px-2.5 text-left">Tanggal</th>
                          <th className="py-2 px-2.5 text-left">Akun &amp; Kategori</th>
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
                        <div className="text-slate-500">Disahkan &amp; Disetujui Oleh,</div>
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

      {/* SECTION 2: STOK & PENGADAAN BAHAN MAKANAN (+ CAMERA BARCODE / QR SCANNER) */}
      {activeSection === 'stok' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-700" />
                <span>Manajemen Stok &amp; Pengadaan Bahan Makanan</span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Gudang Logistik Dapur Sentral, Pemindaian Barcode/QR Kamera, Pemantauan Stok Minimum &amp; Supplier
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setScannedCode('');
                  setScannerOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap"
              >
                <Camera className="h-4 w-4 text-emerald-400" />
                <span>Scan Barcode / QR</span>
              </button>
              <button
                type="button"
                onClick={() => setShowInvForm((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Komoditas Bahan Baku</span>
              </button>
            </div>
          </div>

          {showInvForm && (
            <form
              onSubmit={handleInventorySubmit}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <h2 className="text-sm font-bold text-slate-900">
                Formulir Pengadaan &amp; Registrasi Bahan Baku Baru
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="inv-code" className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode Barang / Barcode
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
                    <th className="py-3 px-4 font-semibold">Kode &amp; Nama Bahan</th>
                    <th className="py-3 px-4 font-semibold">Supplier Pengadaan</th>
                    <th className="py-3 px-4 font-semibold text-right">Stok Tersedia</th>
                    <th className="py-3 px-4 font-semibold text-right">Batas Min.</th>
                    <th className="py-3 px-4 font-semibold text-right">Nilai Persediaan</th>
                    <th className="py-3 px-4 font-semibold">Status &amp; Restock</th>
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
                              onClick={async () => {
                                try {
                                  await onSaveInventory({
                                    ...item,
                                    stockQty: item.stockQty + 100,
                                    lastRestockDate: getJakartaTodayIso(),
                                  });
                                  notify(`Stok "${item.name}" ditambah +100 ${item.unit}.`);
                                } catch (err) {
                                  notifyError(
                                    `Gagal menambah stok: ${err instanceof Error ? err.message : 'Error'}`
                                  );
                                }
                              }}
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
                  {state.inventoryItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Belum ada data bahan baku di Cloud Firestore. Klik &ldquo;Scan Barcode / QR&rdquo; atau &ldquo;Tambah Komoditas Bahan Baku&rdquo;.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal Pemindai Barcode / QR Kamera untuk Input Stok Cepat */}
          {scannerOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
              role="dialog"
              aria-modal="true"
              aria-labelledby="barcode-scanner-title"
            >
              <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
                <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ScanLine className="h-5 w-5 text-emerald-400" />
                    <div>
                      <h2 id="barcode-scanner-title" className="text-sm font-bold">
                        Pemindai Kamera Barcode &amp; QR Code Bahan Baku
                      </h2>
                      <p className="text-[11px] text-slate-300">
                        Arahkan kamera ke label barcode/QR kemasan untuk restock instan atau tambah barang baru.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScannerOpen(false)}
                    aria-label="Tutup pemindai"
                    className="rounded-lg p-1 text-slate-400 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-5 space-y-4 text-xs">
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
                    <video
                      ref={videoRef}
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-6 border-2 border-emerald-400/70 rounded-lg" />
                  </div>

                  {scannerError && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                      {scannerError}
                    </div>
                  )}

                  <div>
                    <label htmlFor="manual-barcode-input" className="block font-semibold text-slate-700 mb-1">
                      Hasil Scan / Input Kode Barcode Manual
                    </label>
                    <input
                      id="manual-barcode-input"
                      type="text"
                      value={scannedCode}
                      onChange={(e) => setScannedCode(e.target.value.toUpperCase())}
                      placeholder="Contoh: BHN-001 atau 8992761123456"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold text-slate-900"
                    />
                  </div>

                  {scannedCode.trim() !== '' && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      {matchedScannedItem ? (
                        <>
                          <div>
                            <div className="text-[11px] font-bold uppercase text-emerald-700">
                              Barang Ditemukan di Gudang
                            </div>
                            <div className="text-sm font-bold text-slate-900 mt-0.5">
                              {matchedScannedItem.itemCode} · {matchedScannedItem.name}
                            </div>
                            <div className="text-slate-600 mt-0.5">
                              Stok Saat Ini:{' '}
                              <strong className="font-mono">
                                {matchedScannedItem.stockQty} {matchedScannedItem.unit}
                              </strong>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              value={scanRestockQty}
                              onChange={(e) => setScanRestockQty(Number(e.target.value))}
                              aria-label="Jumlah restock"
                              className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono font-bold text-slate-900"
                            />
                            <button
                              type="button"
                              onClick={handleApplyScannedRestock}
                              className="flex-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 py-2 font-bold text-white"
                            >
                              Tambah +{scanRestockQty} {matchedScannedItem.unit}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-900">
                              Kode &ldquo;{scannedCode}&rdquo; belum terdaftar
                            </div>
                            <div className="text-slate-500">
                              Daftarkan kode barcode ini sebagai bahan baku baru.
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleRegisterScannedNewItem}
                            className="rounded-lg bg-slate-900 hover:bg-slate-800 px-3.5 py-2 font-semibold text-white whitespace-nowrap"
                          >
                            Daftarkan Bahan Baru
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: PEMASARAN & PROMOSI */}
      {activeSection === 'pemasaran' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Tag className="h-5 w-5 text-emerald-700" />
                <span>Manajemen Pemasaran, Promosi &amp; Retensi Pelanggan</span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Kampanye Voucher Diskon Catering Komersial, Paket Kontrak Korporasi &amp; Loyalitas Pelanggan
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
                    onClick={async () => {
                      try {
                        await onSavePromotion({ ...pr, active: !pr.active });
                        notify(
                          `Promo ${pr.promoCode} kini ${!pr.active ? 'Aktif' : 'Nonaktif'}.`
                        );
                      } catch (err) {
                        notifyError(
                          `Gagal mengubah status promo: ${
                            err instanceof Error ? err.message : 'Error'
                          }`
                        );
                      }
                    }}
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

      {/* SECTION 4: KELOLA AKUN PENGGUNA (SUPER ADMIN) & BACKUP */}
      {activeSection === 'backup' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-700" />
                  <span>Kelola Akun Pengguna, Hak Akses (RBAC) &amp; Backup Manual</span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pemulihan backup hanya dijalankan atas tindakan eksplisit Super Admin dengan konfirmasi keamanan.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowUserForm((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tambah Akun Baru</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCredUsername('');
                    setCredCurrentPassword('');
                    setCredNewPassword('');
                    setCredConfirmPassword('');
                    setShowCredentialForm((prev) => !prev);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors whitespace-nowrap"
                >
                  <KeyRound className="h-3.5 w-3.5 text-emerald-700" />
                  <span>{showCredentialForm ? 'Tutup Ubah Sandi' : 'Ubah Sandi & Username'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5 text-slate-600" />
                  <span>Backup (.JSON)</span>
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
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors whitespace-nowrap"
                >
                  <Upload className="h-3.5 w-3.5 text-slate-600" />
                  <span>Restore Manual</span>
                </button>
              </div>
            </div>

            {showCredentialForm && (
              <form
                onSubmit={handleSaveAdminCredentials}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Ubah Username &amp; Kata Sandi Admin
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowCredentialForm(false)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Batal
                  </button>
                </div>

                {credError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    {credError}
                  </div>
                )}
                {credSuccess && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                    {credSuccess}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label
                      htmlFor="admin-new-username"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Username Baru
                    </label>
                    <div className="relative">
                      <User className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        id="admin-new-username"
                        type="text"
                        autoComplete="off"
                        value={credUsername}
                        onChange={(e) => setCredUsername(e.target.value)}
                        placeholder="Ketik username baru"
                        className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="admin-current-pwd"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Kata Sandi Saat Ini
                    </label>
                    <div className="relative">
                      <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        id="admin-current-pwd"
                        type={showCredCurrentPwd ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={credCurrentPassword}
                        onChange={(e) => setCredCurrentPassword(e.target.value)}
                        placeholder="Kata sandi saat ini"
                        className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 py-2 text-xs text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCredCurrentPwd((prev) => !prev)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
                      >
                        {showCredCurrentPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="admin-new-pwd"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Kata Sandi Baru
                    </label>
                    <div className="relative">
                      <KeyRound className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        id="admin-new-pwd"
                        type={showCredNewPwd ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={credNewPassword}
                        onChange={(e) => setCredNewPassword(e.target.value)}
                        placeholder="Min. 6 karakter"
                        className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 py-2 text-xs text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCredNewPwd((prev) => !prev)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
                      >
                        {showCredNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="admin-confirm-pwd"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Ulangi Sandi Baru
                    </label>
                    <input
                      id="admin-confirm-pwd"
                      type={showCredNewPwd ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={credConfirmPassword}
                      onChange={(e) => setCredConfirmPassword(e.target.value)}
                      placeholder="Ulangi kata sandi"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingCreds}
                    className="rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-semibold text-white"
                  >
                    {savingCreds ? 'Menyimpan...' : 'Simpan Sandi & Username'}
                  </button>
                </div>
              </form>
            )}

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
                    placeholder="Nama lengkap pengguna"
                    aria-label="Nama lengkap personel"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="Email akun"
                    aria-label="Email korporat"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                  <select
                    aria-label="Pilih Peran RBAC"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="Super Admin">Super Admin</option>
                    <option value="Manajer Operasional">Manajer Operasional</option>
                    <option value="Akuntan Keuangan">Akuntan Keuangan</option>
                    <option value="Kepala Dapur & Produksi">Kepala Dapur &amp; Produksi</option>
                    <option value="Koordinator Sekolah Rakyat">Koordinator Sekolah Rakyat</option>
                    <option value="Kurir Distribusi">Kurir Distribusi</option>
                    <option value="Staf Operasional">Staf Operasional</option>
                  </select>
                  <input
                    type="text"
                    value={newUserDept}
                    onChange={(e) => setNewUserDept(e.target.value)}
                    placeholder="Divisi / Bagian"
                    aria-label="Divisi / Departemen"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowUserForm(false)}
                    className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white"
                  >
                    Simpan Akun Baru
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
                    <th className="py-2.5 px-3 font-semibold">Jabatan / Hak Akses</th>
                    <th className="py-2.5 px-3 font-semibold">Departemen</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Tindakan Super Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-semibold text-slate-900">{u.displayName}</td>
                      <td className="py-3 px-3 font-mono tabular-nums text-slate-600">{u.email}</td>
                      <td className="py-3 px-3 font-semibold text-emerald-800">{u.role}</td>
                      <td className="py-3 px-3 text-slate-700">{u.department}</td>
                      <td className="py-3 px-3 text-slate-700">{u.status}</td>
                      <td className="py-3 px-3 text-right">
                        {currentRole === 'Super Admin' ? (
                          <button
                            type="button"
                            onClick={async () => {
                              if (onDeleteUser) {
                                await onDeleteUser(u.id);
                              }
                            }}
                            aria-label={`Hapus akun ${u.displayName}`}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 hover:bg-red-600 hover:text-white px-2.5 py-1 text-xs font-semibold text-red-700 transition-colors whitespace-nowrap"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Hapus Akun</span>
                          </button>
                        ) : (
                          <span className="text-slate-400">Khusus Super Admin</span>
                        )}
                      </td>
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
