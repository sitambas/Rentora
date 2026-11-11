'use client';
import { useState, type FormEvent } from 'react';
import { TICKET_STATUS_LABEL, formatDate, timeAgo, type Ticket, type TicketStatus, type Unit } from '@rentora/shared';
import { api } from '@/lib/api';
import { useAction, useQuery } from '@/lib/hooks';
import { PageHead } from '@/components/Shell';
import { ErrorCard, Field, Icon, Sheet, Skeleton, TicketPill, useToast } from '@/components/ui';

const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export default function Maintenance() {
  const [status, setStatus] = useState<'open' | 'resolved' | 'all'>('open');
  const q = useQuery<Ticket[]>(`/tickets?status=${status}`);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHead title="Maintenance" sub="Requests from tenants and your own work orders"
        action={<button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Icon name="plus" size={15} />New request</button>} />
      <div className="chips" role="group" aria-label="Status">
        {([['open', 'Open'], ['resolved', 'Resolved'], ['all', 'All']] as const).map(([k, l]) => (
          <button key={k} className="chip" aria-pressed={status === k} onClick={() => setStatus(k)}>{l}</button>
        ))}
      </div>
      {q.error && !q.data ? <ErrorCard message={q.error} onRetry={q.reload} /> : !q.data ? <Skeleton h={240} /> : q.data.length === 0 ? (
        <div className="card empty">{status === 'open' ? 'No open requests. Nice.' : 'Nothing here yet.'}</div>
      ) : (
        <div className="grid-cards">
          {q.data.map(t => (
            <div className="card" key={t.id}>
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div className="grow"><div className="eyebrow">{t.property.name} · {t.unit.name}</div><div className="h3">{t.title}</div></div>
                <TicketPill status={t.status} />
              </div>
              {t.description && <div className="muted">{t.description}</div>}
              <div className="muted sm">Raised by {t.createdBy.name} · {timeAgo(t.createdAt)}
                {t.scheduledFor && <> · visit {formatDate(t.scheduledFor, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</>}
                {t.assignee && <> · {t.assignee}</>}</div>
              <button className="btn btn-line btn-sm" onClick={() => setEditing(t)}>Update</button>
            </div>
          ))}
        </div>
      )}
      {editing && <UpdateSheet t={editing} onClose={() => setEditing(null)} onDone={q.reload} />}
      {creating && <CreateSheet onClose={() => setCreating(false)} onDone={q.reload} />}
    </>
  );
}

function UpdateSheet({ t, onClose, onDone }: { t: Ticket; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { busy, run } = useAction();
  const [status, setStatus] = useState<TicketStatus>(t.status);
  const [when, setWhen] = useState(toLocalInput(t.scheduledFor));
  const [assignee, setAssignee] = useState(t.assignee ?? '');
  const [err, setErr] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api(`/tickets/${t.id}`, { method: 'PATCH', body: { status, scheduledFor: when ? new Date(when).toISOString() : null, assignee: assignee || null } });
      toast('Request updated. The tenant has been notified.'); onDone(); onClose();
    }, setErr);
  };
  return (
    <Sheet title={t.title} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="muted">{t.unit.name} · {t.property.name}</div>
        <Field label="Status" id="ts"><div className="input"><select id="ts" value={status} onChange={e => setStatus(e.target.value as TicketStatus)}>
          {(Object.keys(TICKET_STATUS_LABEL) as TicketStatus[]).map(s => <option key={s} value={s}>{TICKET_STATUS_LABEL[s]}</option>)}</select></div></Field>
        <Field label="Visit time" id="tw"><div className="input"><input id="tw" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /></div></Field>
        <Field label="Assigned to" id="ta"><div className="input"><input id="ta" placeholder="e.g. Apex HVAC (Marcus)" value={assignee} onChange={e => setAssignee(e.target.value)} /></div></Field>
        {err && <div className="err">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>Save</button>
      </form>
    </Sheet>
  );
}

function CreateSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const units = useQuery<Unit[]>('/units');
  const { busy, run } = useAction();
  const [unitId, setUnitId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState('');
  const uid = unitId || units.data?.[0]?.id || '';
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => { await api('/tickets', { body: { unitId: uid, title, description } }); toast('Request created'); onDone(); onClose(); }, setErr);
  };
  return (
    <Sheet title="New maintenance request" onClose={onClose}>
      {!units.data ? <Skeleton /> : (
        <form className="stack" onSubmit={submit}>
          <Field label="Unit" id="cu"><div className="input"><select id="cu" value={uid} onChange={e => setUnitId(e.target.value)}>
            {units.data.map(u => <option key={u.id} value={u.id}>{u.property.name} · {u.name}</option>)}</select></div></Field>
          <Field label="What needs doing?" id="ct"><div className="input"><input id="ct" value={title} onChange={e => setTitle(e.target.value)} /></div></Field>
          <Field label="Details (optional)" id="cd"><textarea id="cd" className="input" value={description} onChange={e => setDescription(e.target.value)} /></Field>
          {err && <div className="err">{err}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>Create request</button>
        </form>
      )}
    </Sheet>
  );
}
