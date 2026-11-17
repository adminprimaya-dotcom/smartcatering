import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RECOVERY_EMAIL,
  buildPasswordResetEmailContent,
  resolveRecoveryEmail,
  validateAdminCredentialsMatch,
  validateNewPasswordInput,
  verifyResetTokenRecord,
} from './adminAuth.ts';

test('resolveRecoveryEmail defaults to adminzikrul@gmail.com when empty or invalid', () => {
  assert.equal(resolveRecoveryEmail(), DEFAULT_RECOVERY_EMAIL);
  assert.equal(resolveRecoveryEmail('invalid-email'), DEFAULT_RECOVERY_EMAIL);
  assert.equal(resolveRecoveryEmail('ADMINZIKRUL@GMAIL.COM'), 'adminzikrul@gmail.com');
});

test('validateAdminCredentialsMatch enforces exact current password without legacy fallback', () => {
  const account = {
    username: 'admin',
    email: 'adminzikrul@gmail.com',
    password: 'Zkldwi123',
  };

  assert.equal(
    validateAdminCredentialsMatch({ identifier: 'admin', password: 'Zkldwi123' }, account),
    true
  );
  assert.equal(
    validateAdminCredentialsMatch(
      { identifier: 'adminzikrul@gmail.com', password: 'Zkldwi123' },
      account
    ),
    true
  );
  assert.equal(
    validateAdminCredentialsMatch(
      { identifier: 'admin', password: 'SmartCatering2026!' },
      account
    ),
    false
  );
});

test('verifyResetTokenRecord enforces code match, expiry, usage, and retry limits', () => {
  const now = 1_700_000_000_000;
  const active = {
    code: '482915',
    expiresAtMs: now + 60_000,
    used: false,
    attempts: 0,
  };

  assert.equal(verifyResetTokenRecord(active, '482915', now).valid, true);
  assert.equal(verifyResetTokenRecord(active, '000000', now).valid, false);
  assert.equal(verifyResetTokenRecord({ ...active, used: true }, '482915', now).valid, false);
  assert.equal(verifyResetTokenRecord({ ...active, attempts: 5 }, '482915', now).valid, false);
  assert.equal(verifyResetTokenRecord(active, '482915', now + 120_000).valid, false);
});

test('validateNewPasswordInput and buildPasswordResetEmailContent validate reset flow cleanly', () => {
  assert.equal(validateNewPasswordInput('12345', '12345').valid, false);
  assert.equal(validateNewPasswordInput('Baru2026!', 'Beda2026!').valid, false);
  assert.deepEqual(validateNewPasswordInput('Baru2026!', 'Baru2026!'), {
    valid: true,
    cleanedPassword: 'Baru2026!',
  });

  const mail = buildPasswordResetEmailContent({
    toEmail: 'adminzikrul@gmail.com',
    code: '654321',
    appTitle: 'Smart Catering ERP',
  });
  assert.equal(mail.to, 'adminzikrul@gmail.com');
  assert.ok(mail.text.includes('654321'));
  assert.ok(mail.mailtoUrl.startsWith('mailto:adminzikrul%40gmail.com'));
});
