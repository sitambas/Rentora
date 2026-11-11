'use client';
import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatDate, timeAgo, type Ticket } from '@rentora/shared';
import { api } from '@/lib/api';
import { useAction, useQuery } from '@/lib/hooks';
import { PageHead } from '@/components/Shell';
import { ErrorCard, Field, Icon, Sheet, Skeleton, TicketPill, useToast } from '@/components/ui';

function Requests() {
  const params = useSearchParams();
  const [status, setStatus] = useState<'open' | 'all'>('open');
  const q = useQuery<Ticket[]>(`/tickets?status=${status}`);
  const [creating, setCreating] = useState(params.get('new') === '1');

  return (
    <>
      <PageHead title="Maintenance requests" sub="Tell your manager what needs fixing"
        action={<button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Icon name="plus" size={15} />New request</button>} />
      <div className="chips" role="group" aria-label="Status">
        <button className="chip" aria-pressed={status === 'open'} onClick={() => setStatus('open')}>Open</button>
        <button className="chip" aria-pressed={status === 'all'} onClick={() => setStatus('all')}>All</button>
      </div>
      {q.error && !q.data ? <ErrorCard message={q.error} onRetry={q.reload} /> : !q.data ? <Skeleton h={200} /> : q.data.length === 0 ? (
        <div className="card empty">No {status === 'open' ? 'open ' : ''}requests.</div>
      ) : (
        <div className="grid-cards">{q.data.map(t => (
          <div className="card" key={t.id}>
            <div className="row between"><b className="h3">{t.title}</b><TicketPill status={t.status} /></div>
            {t.description && <div className="muted">{t.description}</div>}
            <div className="muted sm">Raised {timeAgo(t.createdAt)}{t.scheduledFor && ` · visit ${formatDate(t.scheduledFor, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`}{t.assignee && ` · ${t.assignee}`}</div>
          </div>
        ))}</div>
      )}
      {creating && <NewRequest onClose={() => setCreating(false)} onDone={q.reload} />}
    </>
  );
}

function NewRequest({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { busy, run } = useAction();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => { await api('/tickets', { body: { title, description } }); toast('Request sent to your property manager'); onDone(); onClose(); }, setErr);
  };
  return (
    <Sheet title="New maintenance request" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Field label="What needs fixing?" id="rt"><div className="input"><input id="rt" placeholder="e.g. Kitchen tap leaking" value={title} onChange={e => setTitle(e.target.value)} /></div></Field>
        <Field label="Details (optional)" id="rd"><textarea id="rd" className="input" placeholder="When did it start? Best time to visit?" value={description} onChange={e => setDescription(e.target.value)} /></Field>
        {err && <div className="err">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}><Icon name="send" size={16} />Submit request</button>
      </form>
    </Sheet>
  );
}

export default function Page() {
  return <Suspense fallback={<Skeleton h={200} />}><Requests /></Suspense>;
}
