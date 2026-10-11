export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-2xl border border-line bg-surface p-8 text-sm text-ink-muted" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        {label}
      </div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-field p-8 text-center">
      <p className="text-lg font-semibold text-ink">{title}</p>
      <p className="mt-2 max-w-md text-sm text-ink-muted">{description}</p>
    </div>
  );
}

export function ErrorState({ title, description }: { title: string; description: string }) {
  const isPermissionDenied = /permission denied|row-level security|42501|OSA administrator permission required/i.test(description);

  return (
    <div className="rounded-2xl border border-error/20 bg-error-soft p-6 text-error" role="alert">
      <p className="text-lg font-semibold">{isPermissionDenied ? 'Permission denied' : title}</p>
      <p className="mt-2 text-sm">{isPermissionDenied ? 'Your account is not permitted to view or change this data. Confirm your OSA role and database policies.' : description}</p>
    </div>
  );
}
