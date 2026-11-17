export const DEFAULT_ADMIN_USERNAME = 'admin';
export const DEFAULT_RECOVERY_EMAIL = 'adminzikrul@gmail.com';
export const RESET_CODE_TTL_MS = 15 * 60 * 1000;
export const MAX_RESET_ATTEMPTS = 5;

export interface AdminLoginAccountShape {
  username: string;
  email: string;
  password: string;
}

export interface ResetTokenValidationTarget {
  code: string;
  expiresAtMs: number;
  used: boolean;
  attempts: number;
}

export function resolveRecoveryEmail(accountEmail?: string): string {
  const cleaned = String(accountEmail || '').trim().toLowerCase();
  if (cleaned && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    return cleaned;
  }
  return DEFAULT_RECOVERY_EMAIL;
}

export function validateAdminCredentialsMatch(
  input: { identifier: string; password: string },
  account: AdminLoginAccountShape
): boolean {
  const cleanId = String(input.identifier || '').trim().toLowerCase();
  const rawPass = String(input.password || '');
  if (!cleanId || !rawPass) return false;

  const matchesIdentifier =
    cleanId === account.username.trim().toLowerCase() ||
    cleanId === account.email.trim().toLowerCase();

  if (!matchesIdentifier) return false;
  return rawPass === account.password;
}

export function validateNewPasswordInput(
  newPassword: string,
  confirmPassword: string
): { valid: boolean; cleanedPassword?: string; error?: string } {
  const cleaned = String(newPassword || '').trim();
  const cleanedConfirm = String(confirmPassword || '').trim();

  if (cleaned.length < 6) {
    return {
      valid: false,
      error: 'Kata sandi baru minimal terdiri dari 6 karakter demi keamanan akun.',
    };
  }
  if (cleaned !== cleanedConfirm) {
    return {
      valid: false,
      error: 'Konfirmasi kata sandi baru tidak cocok.',
    };
  }
  return { valid: true, cleanedPassword: cleaned };
}

export function verifyResetTokenRecord(
  record: ResetTokenValidationTarget | null,
  submittedCode: string,
  nowMs: number
): { valid: boolean; error?: string } {
  if (!record) {
    return {
      valid: false,
      error: 'Belum ada permintaan reset kata sandi yang aktif. Silakan kirim ulang kode ke email.',
    };
  }
  if (record.used) {
    return {
      valid: false,
      error: 'Kode reset kata sandi ini sudah digunakan. Silakan minta kode baru.',
    };
  }
  if (record.attempts >= MAX_RESET_ATTEMPTS) {
    return {
      valid: false,
      error: 'Terlalu banyak percobaan kode yang salah. Silakan kirim ulang kode verifikasi baru.',
    };
  }
  if (nowMs > record.expiresAtMs) {
    return {
      valid: false,
      error: 'Kode reset kata sandi telah kedaluwarsa (lebih dari 15 menit). Silakan kirim ulang.',
    };
  }
  const cleanCode = String(submittedCode || '').replace(/\s+/g, '');
  if (!cleanCode || cleanCode !== record.code) {
    return {
      valid: false,
      error: 'Kode verifikasi reset kata sandi tidak sesuai.',
    };
  }
  return { valid: true };
}

export function buildPasswordResetEmailContent(params: {
  toEmail: string;
  code: string;
  appTitle: string;
  expiresMinutes?: number;
}): {
  to: string;
  subject: string;
  text: string;
  html: string;
  mailtoUrl: string;
} {
  const expiresMinutes = params.expiresMinutes ?? 15;
  const to = resolveRecoveryEmail(params.toEmail);
  const subject = `[${params.appTitle}] Kode Reset Kata Sandi Admin`;
  const text = [
    `Permintaan Reset Kata Sandi Admin - ${params.appTitle}`,
    '',
    `Kode Verifikasi Reset Anda: ${params.code}`,
    `Berlaku selama: ${expiresMinutes} menit`,
    '',
    'Masukkan kode di atas pada formulir Lupa Kata Sandi untuk membuat kata sandi admin baru.',
    'Jika Anda tidak meminta reset kata sandi, abaikan email ini.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; color: #0f172a;">
      <h2 style="margin: 0 0 8px; font-size: 18px; color: #0f2634;">Reset Kata Sandi Admin</h2>
      <p style="margin: 0 0 16px; font-size: 13px; color: #475569;">${params.appTitle}</p>
      <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.5;">Gunakan kode verifikasi berikut untuk mereset kata sandi akun admin Anda:</p>
      <div style="background: #f8fafc; border: 1px dashed #1a6d7e; border-radius: 10px; padding: 14px; text-align: center; margin: 16px 0;">
        <span style="font-family: monospace; font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #c43e24;">${params.code}</span>
      </div>
      <p style="margin: 0; font-size: 12px; color: #64748b;">Kode ini berlaku selama ${expiresMinutes} menit. Jika Anda tidak melakukan permintaan ini, abaikan pesan ini.</p>
    </div>
  `.trim();

  const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;

  return { to, subject, text, html, mailtoUrl };
}
