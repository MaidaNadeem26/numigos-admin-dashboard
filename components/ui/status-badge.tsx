type StatusBadgeProps = {
  label: string;
};

const statusMap: Record<string, string> = {
  Approved: 'success',
  'Approved by OSA': 'success',
  Completed: 'success',
  Attended: 'success',
  Verified: 'success',
  'Pending Approval': 'accent',
  'Pending OSA Review': 'accent',
  Registered: 'accent',
  'Changes Requested': 'warning',
  'Changes Requested by OSA': 'warning',
  Rejected: 'error',
  'Rejected by OSA': 'error',
  Absent: 'error',
  Cancelled: 'error',
  Draft: 'muted',
  Unverified: 'warning',
};

export function StatusBadge({ label }: StatusBadgeProps) {
  const variant = statusMap[label] ?? 'muted';

  const classes = {
    success: 'border border-success/20 bg-success-soft text-success',
    accent: 'border border-accent-gold/70 bg-accent-gold text-accent-ink',
    warning: 'border border-warning/20 bg-warning-soft text-warning',
    error: 'border border-error/20 bg-error-soft text-error',
    muted: 'border border-line bg-home-chip text-ink-muted',
  }[variant];

  return (
    <span className={`osa-status-badge inline-flex items-center px-2.5 py-1 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}
