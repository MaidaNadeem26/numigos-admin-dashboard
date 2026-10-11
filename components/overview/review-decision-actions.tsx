'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { createClient } from '@/lib/supabase/client';

type DecisionAction = 'approve' | 'reject' | 'request_changes';
const defaultActions: DecisionAction[] = ['approve', 'request_changes', 'reject'];

export function ReviewDecisionActions({ entityType, entityId, availableActions }: { entityType: 'society' | 'event'; entityId: string; availableActions?: string[] }) {
  const router = useRouter();
  const [selectedAction, setSelectedAction] = useState<DecisionAction | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const actions = (availableActions ?? defaultActions).filter((action): action is DecisionAction => defaultActions.includes(action as DecisionAction));

  const decide = async () => {
    if (!selectedAction) return;
    if (selectedAction !== 'approve' && !notes.trim()) {
      setError('Notes are required for this decision.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    const supabase = createClient();
    const args = { action: selectedAction, notes: notes.trim() || null };
    const result = entityType === 'event'
      ? await supabase.rpc('decide_event', { ...args, event_id: entityId })
      : await supabase.rpc('decide_society', { ...args, society_id: entityId });

    setIsSubmitting(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    setNotice(`Decision recorded: ${selectedAction.replace('_', ' ')}.`);
    setSelectedAction(null);
    setNotes('');
    router.refresh();
  };

  const actionLabel = selectedAction?.replace('_', ' ') ?? '';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {notice ? <span role="status" className="text-xs text-success">{notice}</span> : null}
      {actions.includes('approve') ? <button type="button" onClick={() => { setSelectedAction('approve'); setError(''); }} className="osa-button bg-brand px-3 py-2 text-xs font-semibold text-white shadow-[0_5px_12px_rgba(30,93,75,0.16)] hover:bg-brand-strong">Approve</button> : null}
      {actions.includes('request_changes') ? <button type="button" onClick={() => { setSelectedAction('request_changes'); setError(''); }} className="osa-button border border-warning/25 bg-warning-soft px-3 py-2 text-xs font-semibold text-warning">Request changes</button> : null}
      {actions.includes('reject') ? <button type="button" onClick={() => { setSelectedAction('reject'); setError(''); }} className="osa-button border border-error/25 bg-error-soft px-3 py-2 text-xs font-semibold text-error">Reject</button> : null}
      <ConfirmDialog
        open={selectedAction !== null}
        title={`Confirm ${actionLabel}`}
        description={`This decision will be recorded in the OSA audit log for this ${entityType}.`}
        confirmLabel={isSubmitting ? 'Saving...' : selectedAction === 'approve' ? 'Approve' : selectedAction === 'reject' ? 'Reject' : 'Request changes'}
        onCancel={() => { if (!isSubmitting) setSelectedAction(null); }}
        onConfirm={() => { void decide(); }}
      >
        <label className="grid gap-2 text-sm font-medium text-ink" htmlFor={`decision-notes-${entityType}-${entityId}`}>
          Notes {selectedAction !== 'approve' ? '(required)' : '(optional)'}
          <textarea
            id={`decision-notes-${entityType}-${entityId}`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            maxLength={2000}
            className="osa-field min-h-24 w-full resize-y px-4 py-3 text-sm text-ink outline-none"
          />
        </label>
        {error ? <p className="mt-3 text-sm text-error" role="alert">{error}</p> : null}
      </ConfirmDialog>
    </div>
  );
}
