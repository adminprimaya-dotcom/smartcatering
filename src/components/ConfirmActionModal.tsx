import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  isSubmitting?: boolean;
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: (reason?: string) => Promise<void> | void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'danger',
  requireReason = false,
  reasonLabel = 'Alasan / Catatan Audit',
  reasonPlaceholder = 'Tuliskan alasan tindakan ini...',
  isSubmitting = false,
  errorMessage = '',
  onCancel,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setLocalError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requireReason && reason.trim().length < 5) {
      setLocalError('Mohon tuliskan alasan minimal 5 karakter sebelum melanjutkan.');
      return;
    }
    setLocalError('');
    await onConfirm(requireReason ? reason.trim() : undefined);
  };

  const iconBg =
    variant === 'danger'
      ? 'bg-red-50 text-red-700 border-red-200'
      : variant === 'warning'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  const btnStyle =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700 text-white'
      : 'bg-emerald-700 hover:bg-emerald-800 text-white';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <form
        onSubmit={handleConfirm}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${iconBg}`}>
              {variant === 'primary' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : variant === 'warning' ? (
                <Info className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
            </div>
            <h2 id="confirm-modal-title" className="text-sm font-bold text-slate-900">
              {title}
            </h2>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            aria-label="Tutup dialog"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">{description}</p>

          {requireReason && (
            <div>
              <label
                htmlFor="confirm-reason-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                {reasonLabel} <span className="text-red-600">*</span>
              </label>
              <textarea
                id="confirm-reason-input"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={reasonPlaceholder}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
              />
            </div>
          )}

          {(localError || errorMessage) && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
              {localError || errorMessage}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3.5">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-60 ${btnStyle}`}
          >
            {isSubmitting ? 'Memproses ke Server...' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};
