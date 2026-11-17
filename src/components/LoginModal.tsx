import React, { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  ShieldCheck,
  User,
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

const AVAILABLE_ROLES: UserRole[] = [
  'Super Admin',
  'Manajer Operasional',
  'Akuntan Keuangan',
  'Kepala Dapur & Produksi',
  'Koordinator Sekolah Rakyat',
  'Kurir Distribusi',
];

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

  // Login State — always starts empty so username/password are never exposed automatically
  const [identifierInput, setIdentifierInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  // Change Username & Password State — fields start empty
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setIdentifierInput('');
      setPasswordInput('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNewUsername('');
      setNewDisplayName(userDisplayName);
      setNewEmail(userEmail);
      setAuthError('');
      setAuthSuccess('');
    }
  }, [isOpen, initialTab, userDisplayName, userEmail]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (!identifierInput.trim() || !passwordInput.trim()) {
      setAuthError('Mohon masukkan username/email dan kata sandi akun admin.');
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
          role: selectedRole,
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
      setIdentifierInput('');
      setPasswordInput('');
      if (onEnterAdminDashboard) onEnterAdminDashboard();
      onClose();
    } catch {
      setAuthError('Gagal memverifikasi akun admin. Periksa koneksi server Anda.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    const cleanedUsername = (newUsername.trim() || adminUsername).replace(/\s+/g, '');
    if (cleanedUsername.length < 3) {
      setAuthError('Username baru minimal 3 karakter tanpa spasi.');
      return;
    }
    if (!currentPassword) {
      setAuthError('Masukkan kata sandi saat ini untuk verifikasi keamanan.');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setAuthError('Kata sandi baru minimal 6 karakter.');
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
          newDisplayName: newDisplayName.trim() || userDisplayName,
          newEmail: newEmail.trim() || userEmail,
          newPassword: newPassword || undefined,
          confirmPassword: confirmPassword || undefined,
          newRole: currentRole,
        }),
      });
      const data = await res.json();
      if (!data.updated) {
        setAuthError(data.error || 'Gagal memperbarui username dan kata sandi.');
        return;
      }

      const acc = data.account;
      await onUpdateCredentials({
        username: acc.username,
        email: acc.email,
        displayName: acc.displayName,
        role: acc.role as UserRole,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNewUsername('');
      setAuthSuccess('Username dan kata sandi berhasil diperbarui.');
    } catch {
      setAuthError('Terjadi kendala jaringan saat menyimpan perubahan.');
    } finally {
      setSavingCredentials(false);
    }
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
        err instanceof Error ? err.message : 'Gagal menghubungkan Google Sign-In.'
      );
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        {/* Clean Minimal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-white">
              <Building2 className="h-4 w-4" />
            </div>
            <h2 id="login-modal-title" className="text-sm font-bold text-slate-900">
              {activeTab === 'login' ? 'Akses Panel Admin' : 'Ubah Username & Kata Sandi'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {authError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800">
              {authError}
            </div>
          )}

          {authSuccess && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
              <span>{authSuccess}</span>
            </div>
          )}

          {activeTab === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Username atau Email
                </label>
                <div className="relative">
                  <User className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="login-identifier"
                    type="text"
                    autoComplete="off"
                    value={identifierInput}
                    onChange={(e) => setIdentifierInput(e.target.value)}
                    placeholder="Masukkan username atau email"
                    className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Kata Sandi
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    className="w-full rounded-lg border border-slate-300 pl-9 pr-10 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-role"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Peran Akses
                </label>
                <div className="relative">
                  <ShieldCheck className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <select
                    id="login-role"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                    className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 bg-white focus:border-emerald-600 focus:outline-hidden"
                  >
                    {AVAILABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loadingSubmit}
                  className="w-full rounded-lg bg-emerald-700 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors"
                >
                  {loadingSubmit ? 'Memproses...' : 'Masuk ke Dashboard Admin'}
                </button>
                <button
                  type="button"
                  onClick={handleGoogleClick}
                  disabled={loadingGoogle}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <LogIn className="h-3.5 w-3.5 text-emerald-700" />
                  <span>{loadingGoogle ? 'Menghubungkan...' : 'Masuk dengan Google'}</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCredentialsSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="cred-new-username"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Username Baru
                </label>
                <div className="relative">
                  <User className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="cred-new-username"
                    type="text"
                    autoComplete="off"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Ketik username baru"
                    className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="cred-current-password"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Kata Sandi Saat Ini
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="cred-current-password"
                    type={showCurrentPwd ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Masukkan kata sandi saat ini"
                    className="w-full rounded-lg border border-slate-300 pl-9 pr-10 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPwd((prev) => !prev)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
                  >
                    {showCurrentPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="cred-new-password"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Kata Sandi Baru
                </label>
                <div className="relative">
                  <KeyRound className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="cred-new-password"
                    type={showNewPwd ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full rounded-lg border border-slate-300 pl-9 pr-10 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd((prev) => !prev)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
                  >
                    {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
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
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang kata sandi baru"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                {isCloudAuthenticated ? (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    Logout Cloud
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    disabled={savingCredentials}
                    className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    {savingCredentials ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
