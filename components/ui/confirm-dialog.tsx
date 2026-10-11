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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4 backdrop-blur-sm">
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <h3 id="confirm-dialog-title" className="text-xl font-semibold text-ink">{title}</h3>
        <p id="confirm-dialog-description" className="mt-2 text-sm text-ink-muted">{description}</p>
        {children ? <div className="mt-4">{children}</div> : null}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="osa-button border border-line bg-surface px-4 py-2 text-sm text-ink">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className="osa-button bg-error px-4 py-2 text-sm font-medium text-white">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
