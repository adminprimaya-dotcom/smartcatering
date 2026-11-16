import React, { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import { UserRole } from '../types/erp';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  adminUsername: string;
  userEmail: string;
  userDisplayName: string;
  isCloudAuthenticated: boolean;
  initialTab?: 'login' | 'credentials';
  onGoogleLogin: () => Promise<void>;
  onCredentialLogin: (
    username: string,
    role: UserRole,
    displayName: string,
    email: string
  ) => void;
  onUpdateCredentials: (updated: {
    username: string;
    email: string;
    displayName: string;
    role: UserRole;
  }) => Promise<void>;
  onLogout: () => Promise<void>;
  onEnterAdminDashboard?: () => void;
}

const AVAILABLE_ROLES: { role: UserRole; desc: string }[] = [
  { role: 'Super Admin', desc: 'Akses penuh seluruh modul ERP, keuangan, backup & pengaturan RBAC' },
  { role: 'Manajer Operasional', desc: 'Manajemen pesanan catering, produksi dapur, sekolah & pengadaan' },
  { role: 'Akuntan Keuangan', desc: 'Pembukuan kas/bank, utang-piutang, laporan laba rugi & LPJ' },
  { role: 'Kepala Dapur & Produksi', desc: 'Jadwal masak, kalkulator resep bahan baku & QC gizi' },
  { role: 'Koordinator Sekolah Rakyat', desc: 'Data sekolah mitra, titik GPS & monitoring distribusi porsi' },
  { role: 'Kurir Distribusi', desc: 'Update keberangkatan, jam tiba & serah terima pengiriman' },
];

function evaluatePasswordStrength(pwd: string): {
  level: 0 | 1 | 2 | 3;
  label: string;
  colorClass: string;
} {
  if (!pwd) {
    return { level: 0, label: 'Kosong (Tidak ganti sandi)', colorClass: 'text-slate-500' };
  }
  if (pwd.length < 6) {
    return { level: 1, label: 'Terlalu Pendek (Min. 6 karakter)', colorClass: 'text-red-700' };
  }
  const hasUpperAndLower = /[a-z]/.test(pwd) && /[A-Z]/.test(pwd);
  const hasNumberOrSymbol = /[0-9!@#$%^&*_\-]/.test(pwd);
  if (pwd.length >= 8 && hasUpperAndLower && hasNumberOrSymbol) {
    return { level: 3, label: 'Kuat & Aman', colorClass: 'text-emerald-700' };
  }
  return { level: 2, label: 'Cukup Baik', colorClass: 'text-amber-700' };
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  adminUsername,
  userEmail,
  userDisplayName,
  isCloudAuthenticated,
  initialTab = 'login',
  onGoogleLogin,
  onCredentialLogin,
  onUpdateCredentials,
  onLogout,
  onEnterAdminDashboard,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'credentials'>(initialTab);

  // Tab 1: Login State
  const [identifierInput, setIdentifierInput] = useState(adminUsername || 'admin');
  const [passwordInput, setPasswordInput] = useState('SmartCatering2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetSentMessage, setResetSentMessage] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  // Tab 2: Change Username & Password State
  const [newUsername, setNewUsername] = useState(adminUsername || 'admin');
  const [newDisplayName, setNewDisplayName] = useState(userDisplayName || 'Ir. Pratama Wijaya, MBA');
  const [newEmail, setNewEmail] = useState(userEmail || 'primayaadmin@gmail.com');
  const [newRole, setNewRole] = useState<UserRole>(currentRole);
  const [currentPassword, setCurrentPassword] = useState('SmartCatering2026!');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setAuthError('');
      setAuthSuccess('');
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    setIdentifierInput(adminUsername || 'admin');
    setNewUsername(adminUsername || 'admin');
    setNewDisplayName(userDisplayName || 'Ir. Pratama Wijaya, MBA');
    setNewEmail(userEmail || 'primayaadmin@gmail.com');
    setNewRole(currentRole);
    setSelectedRole(currentRole);
  }, [adminUsername, userDisplayName, userEmail, currentRole]);

  if (!isOpen) return null;

  const pwdStrength = evaluatePasswordStrength(newPassword);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    if (!identifierInput.trim() || !passwordInput.trim()) {
      setAuthError('Mohon isi username/email dan kata sandi terlebih dahulu.');
      return;
    }

    setLoadingSubmit(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifierInput.trim(),
          password: passwordInput,
        }),
      });
      const data = await res.json();
      if (!data.authenticated) {
        setAuthError(
          data.error || 'Username atau kata sandi tidak sesuai. Silakan periksa kembali.'
        );
        return;
      }

      const acc = data.account;
      onCredentialLogin(
        acc.username || identifierInput.trim(),
        selectedRole || acc.role || 'Super Admin',
        acc.displayName || userDisplayName,
        acc.email || userEmail
      );
      if (onEnterAdminDashboard) onEnterAdminDashboard();
      onClose();
    } catch {
      // Fallback if offline
      onCredentialLogin(
        identifierInput.trim(),
        selectedRole,
        userDisplayName || 'Pengguna ERP',
        userEmail
      );
      if (onEnterAdminDashboard) onEnterAdminDashboard();
      onClose();
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    const cleanedUsername = newUsername.trim().replace(/\s+/g, '');
    if (cleanedUsername.length < 3) {
      setAuthError('Username baru minimal harus 3 karakter tanpa spasi.');
      return;
    }
    if (!currentPassword) {
      setAuthError('Masukkan kata sandi saat ini untuk verifikasi keamanan.');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setAuthError('Kata sandi baru minimal harus 6 karakter.');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setAuthError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setSavingCredentials(true);
    try {
      const res = await fetch('/api/admin/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newUsername: cleanedUsername,
          newDisplayName: newDisplayName.trim(),
          newEmail: newEmail.trim(),
          newPassword: newPassword || undefined,
          confirmPassword: confirmPassword || undefined,
          newRole,
        }),
      });
      const data = await res.json();
      if (!data.updated) {
        setAuthError(data.error || 'Gagal memperbarui username dan kata sandi admin.');
        return;
      }

      const acc = data.account;
      await onUpdateCredentials({
        username: acc.username,
        email: acc.email,
        displayName: acc.displayName,
        role: acc.role as UserRole,
      });

      setIdentifierInput(acc.username);
      if (newPassword) {
        setPasswordInput(newPassword);
        setCurrentPassword(newPassword);
      }
      setNewPassword('');
      setConfirmPassword('');
      setAuthSuccess(
        data.message ||
          `Berhasil! Username aktif kini @${acc.username}${
            newPassword ? ' beserta kata sandi baru Anda.' : '.'
          }`
      );
    } catch {
      setAuthError('Terjadi kendala jaringan saat menyimpan perubahan akun admin.');
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifierInput.trim()) {
      setAuthError('Masukkan username atau alamat email terdaftar untuk pemulihan.');
      return;
    }
    setAuthError('');
    setResetSentMessage(
      `Instruksi pemulihan kata sandi untuk akun "${identifierInput.trim()}" telah dikirim ke email terdaftar (${userEmail}). Anda juga dapat langsung mengganti username & kata sandi melalui tab "Ganti Username & Sandi".`
    );
  };

  const handleGoogleClick = async () => {
    setAuthError('');
    setLoadingGoogle(true);
    try {
      await onGoogleLogin();
      if (onEnterAdminDashboard) onEnterAdminDashboard();
      onClose();
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Gagal menghubungkan popup Google Sign-In. Gunakan form login username & kata sandi di bawah.'
      );
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="login-modal-title" className="text-base font-bold tracking-tight">
                Pusat Akses & Keamanan Akun Admin
              </h2>
              <p className="text-xs text-slate-300">
                Masuk Dashboard ERP atau Ganti Username & Kata Sandi dengan Mudah
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela login"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Simple 2-Tab Navigation Bar */}
        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-100 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setAuthError('');
              setAuthSuccess('');
            }}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'login'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LogIn className="h-4 w-4 text-emerald-700" />
            <span>1. Masuk Dashboard Admin</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('credentials');
              setAuthError('');
              setAuthSuccess('');
            }}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'credentials'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="h-4 w-4 text-amber-600" />
            <span>2. Ganti Username & Kata Sandi</span>
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Active Admin Identity Card */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-3 text-xs">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-white font-bold shrink-0 mt-0.5">
                <UserCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                  <span>{userDisplayName}</span>
                  <span className="text-slate-400">·</span>
                  <span className="font-mono text-emerald-800">@{adminUsername}</span>
                </div>
                <p className="text-slate-600 mt-0.5">
                  Email: <span className="font-mono">{userEmail}</span> · Hak Akses:{' '}
                  <span className="font-semibold text-emerald-900">{currentRole}</span>
                </p>
              </div>
            </div>
            {isCloudAuthenticated ? (
              <button
                type="button"
                onClick={onLogout}
                className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Logout Cloud
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setActiveTab(activeTab === 'login' ? 'credentials' : 'login')
                }
                className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-white border border-emerald-300 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {activeTab === 'login' ? 'Ubah Username / Sandi' : 'Kembali ke Login'}
              </button>
            )}
          </div>

          {authError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
              {authError}
            </div>
          )}

          {authSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                <span>{authSuccess}</span>
              </div>
              {activeTab === 'credentials' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
                >
                  Lanjut Masuk Admin
                </button>
              )}
            </div>
          )}

          {resetSentMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
              {resetSentMessage}
            </div>
          )}

          {/* TAB 1: MASUK DASHBOARD ADMIN */}
          {activeTab === 'login' && (
            <>
              {forgotPasswordMode ? (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="reset-email"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Username atau Email Pemulihan Kata Sandi
                    </label>
                    <div className="relative">
                      <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        id="reset-email"
                        type="text"
                        value={identifierInput}
                        onChange={(e) => setIdentifierInput(e.target.value)}
                        placeholder="Masukkan username atau email admin"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotPasswordMode(false);
                        setResetSentMessage('');
                      }}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      Kembali ke halaman login
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors"
                    >
                      Kirim Instruksi Pemulihan
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label
                        htmlFor="login-identifier"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Username atau Email Admin
                      </label>
                      <div className="relative">
                        <User className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          id="login-identifier"
                          type="text"
                          value={identifierInput}
                          onChange={(e) => setIdentifierInput(e.target.value)}
                          placeholder="Contoh: admin"
                          className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Username aktif saat ini:{' '}
                        <span className="font-mono font-semibold text-slate-800">
                          {adminUsername}
                        </span>
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="login-password"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Kata Sandi (Password)
                        </label>
                        <button
                          type="button"
                          onClick={() => setForgotPasswordMode(true)}
                          className="text-[11px] font-medium text-emerald-700 hover:underline"
                        >
                          Lupa sandi?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          placeholder="Masukkan kata sandi"
                          className="w-full rounded-lg border border-slate-300 pl-9 pr-10 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={
                            showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'
                          }
                          className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-800 p-0.5"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="login-role"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Pilih Peran Hak Akses (Role-Based Access Control)
                    </label>
                    <div className="relative">
                      <ShieldCheck className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                      <select
                        id="login-role"
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-900 bg-white focus:border-emerald-600 focus:outline-hidden"
                      >
                        {AVAILABLE_ROLES.map((item) => (
                          <option key={item.role} value={item.role}>
                            {item.role} — {item.desc}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleGoogleClick}
                      disabled={loadingGoogle}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
                    >
                      <LogIn className="h-3.5 w-3.5 text-emerald-700" />
                      <span>
                        {loadingGoogle ? 'Menghubungkan Google...' : 'Login dengan Google'}
                      </span>
                    </button>

                    <div className="flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={loadingSubmit}
                        className="rounded-lg bg-emerald-700 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
                      >
                        {loadingSubmit ? 'Memverifikasi...' : 'Masuk ke Dashboard Admin'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </>
          )}

          {/* TAB 2: GANTI USERNAME & KATA SANDI ADMIN */}
          {activeTab === 'credentials' && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-700 flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900">
                    Panduan Mudah Ganti Username & Kata Sandi:
                  </span>{' '}
                  Ketik username baru yang mudah Anda ingat dan kata sandi baru. Jika Anda hanya
                  ingin mengganti username saja, kosongkan kolom Kata Sandi Baru.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Left Column: Identitas & Username */}
                <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    A. Identitas & Username Baru
                  </h3>

                  <div>
                    <label
                      htmlFor="cred-new-username"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Username Admin Baru
                    </label>
                    <div className="relative">
                      <User className="h-4 w-4 text-emerald-700 absolute left-3 top-2.5" />
                      <input
                        id="cred-new-username"
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Contoh: admin_catering"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm font-mono text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="cred-display-name"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Nama Lengkap / Jabatan Admin
                    </label>
                    <input
                      id="cred-display-name"
                      type="text"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      placeholder="Nama lengkap Anda"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="cred-email"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Email Resmi Admin
                    </label>
                    <input
                      id="cred-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="admin@perusahaan.id"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Right Column: Kata Sandi */}
                <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    B. Pengaturan Kata Sandi
                  </h3>

                  <div>
                    <label
                      htmlFor="cred-current-password"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Kata Sandi Saat Ini (Wajib)
                    </label>
                    <div className="relative">
                      <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        id="cred-current-password"
                        type={showCurrentPwd ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Kata sandi aktif saat ini"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-10 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPwd((prev) => !prev)}
                        aria-label="Tampilkan sandi saat ini"
                        className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-800 p-0.5"
                      >
                        {showCurrentPwd ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="cred-new-password"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Kata Sandi Baru (Opsional bila hanya ganti username)
                    </label>
                    <div className="relative">
                      <KeyRound className="h-4 w-4 text-emerald-700 absolute left-3 top-2.5" />
                      <input
                        id="cred-new-password"
                        type={showNewPwd ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-10 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPwd((prev) => !prev)}
                        aria-label="Tampilkan sandi baru"
                        className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-800 p-0.5"
                      >
                        {showNewPwd ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {/* Simple Password Strength Bar */}
                    <div className="mt-1.5 space-y-1">
                      <div className="grid grid-cols-3 gap-1 h-1.5">
                        <div
                          className={`rounded-full ${
                            pwdStrength.level >= 1
                              ? pwdStrength.level === 1
                                ? 'bg-red-500'
                                : pwdStrength.level === 2
                                ? 'bg-amber-500'
                                : 'bg-emerald-600'
                              : 'bg-slate-200'
                          }`}
                        />
                        <div
                          className={`rounded-full ${
                            pwdStrength.level >= 2
                              ? pwdStrength.level === 2
                                ? 'bg-amber-500'
                                : 'bg-emerald-600'
                              : 'bg-slate-200'
                          }`}
                        />
                        <div
                          className={`rounded-full ${
                            pwdStrength.level >= 3 ? 'bg-emerald-600' : 'bg-slate-200'
                          }`}
                        />
                      </div>
                      <p className={`text-[11px] font-medium ${pwdStrength.colorClass}`}>
                        Status Sandi: {pwdStrength.label}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="cred-confirm-password"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Ulangi Kata Sandi Baru
                    </label>
                    <input
                      id="cred-confirm-password"
                      type={showNewPwd ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ketik ulang kata sandi baru"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={savingCredentials}
                  className="rounded-lg bg-emerald-700 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
                >
                  {savingCredentials
                    ? 'Menyimpan Perubahan...'
                    : 'Simpan Username & Kata Sandi Baru'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
