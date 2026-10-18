'use client';

import { type ReactNode } from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-3 sm:p-4 backdrop-blur-sm">
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xl">
        <h3 id="confirm-dialog-title" className="text-lg sm:text-xl font-semibold text-ink">{title}</h3>
        <p id="confirm-dialog-description" className="mt-2 text-sm text-ink-muted leading-relaxed">{description}</p>
        {children ? <div className="mt-4">{children}</div> : null}

        <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
          <button type="button" onClick={onCancel} className="osa-button w-full sm:w-auto border border-line bg-surface px-4 py-2.5 sm:py-2 text-sm text-ink hover:bg-field transition">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className="osa-button w-full sm:w-auto bg-error px-4 py-2.5 sm:py-2 text-sm font-medium text-white hover:opacity-90 transition">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
