'use client';
import { useState, type FormEvent } from 'react';
import { formatDate, timeAgo, type Notice, type Parcel, type Property, type Unit } from '@rentora/shared';
import { api } from '@/lib/api';
import { useAction, useQuery } from '@/lib/hooks';
import { PageHead } from '@/components/Shell';
import { ErrorCard, Field, Icon, Sheet, Skeleton, useToast } from '@/components/ui';

export default function Community() {
  const notices = useQuery<Notice[]>('/notices');
  const parcels = useQuery<Parcel[]>('/parcels');
  const toast = useToast();
  const { busy, run } = useAction();
  const [sheet, setSheet] = useState<'notice' | 'parcel' | null>(null);

  const remove = (n: Notice) => run(async () => { await api(`/notices/${n.id}`, { method: 'DELETE' }); toast('Notice removed'); notices.reload(); }, m => toast(m, 'bad'));
  const collect = (p: Parcel) => run(async () => { await api(`/parcels/${p.id}/collect`, { method: 'POST' }); toast(`Parcel for ${p.unit.name} marked collected`); parcels.reload(); }, m => toast(m, 'bad'));

  return (
    <>
      <PageHead title="Notices & parcels" sub="Building announcements and smart-locker deliveries" />
      <div className="dash">
        <div className="card">
          <div className="row between"><b className="h3">Building notices</b><button className="btn btn-primary btn-sm" onClick={() => setSheet('notice')}><Icon name="megaphone" size={15} />Post notice</button></div>
          {notices.error && !notices.data ? <ErrorCard message={notices.error} onRetry={notices.reload} /> : !notices.data ? <Skeleton /> : notices.data.length === 0 ? <div className="empty">No notices yet. Tenants of the building get a notification when you post one.</div> : (
            <div className="list">{notices.data.map(n => (
              <div className="li" key={n.id} style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div className="eyebrow">{n.property.name}{n.eventAt && ` · ${formatDate(n.eventAt, { weekday: 'short', day: 'numeric', month: 'short' })}`}</div>
                  <b>{n.title}</b><div className="muted">{n.body}</div><div className="muted sm">Posted {timeAgo(n.createdAt)}</div>
                </div>
                <button className="icon-btn" disabled={busy} onClick={() => remove(n)} aria-label={`Remove notice ${n.title}`}><Icon name="x" size={16} /></button>
              </div>
            ))}</div>
          )}
        </div>
        <div className="card">
          <div className="row between"><b className="h3">Parcels waiting</b><button className="btn btn-soft btn-sm" onClick={() => setSheet('parcel')}><Icon name="box" size={15} />Log delivery</button></div>
          {parcels.error && !parcels.data ? <ErrorCard message={parcels.error} onRetry={parcels.reload} /> : !parcels.data ? <Skeleton /> : parcels.data.length === 0 ? <div className="empty">No parcels waiting in lockers.</div> : (
            <div className="list">{parcels.data.map(p => (
              <div className="li" key={p.id}>
                <span className="tile-ic" style={{ background: 'var(--good-soft)', color: 'var(--good)' }}><Icon name="box" size={17} /></span>
                <div className="grow"><b>{p.unit.name} · locker {p.locker}</b><div className="muted sm">{p.carrier} · {timeAgo(p.deliveredAt)}</div></div>
                <button className="btn btn-line btn-sm" disabled={busy} onClick={() => collect(p)}>Collected</button>
              </div>
            ))}</div>
          )}
        </div>
      </div>
      {sheet === 'notice' && <NoticeSheet onClose={() => setSheet(null)} onDone={notices.reload} />}
      {sheet === 'parcel' && <ParcelSheet onClose={() => setSheet(null)} onDone={parcels.reload} />}
    </>
  );
}

function NoticeSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const props = useQuery<Property[]>('/properties');
  const { busy, run } = useAction();
  const [f, setF] = useState({ propertyId: '', title: '', body: '', eventAt: '' });
  const [err, setErr] = useState('');
  const pid = f.propertyId || props.data?.[0]?.id || '';
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api('/notices', { body: { ...f, propertyId: pid, eventAt: f.eventAt ? new Date(f.eventAt).toISOString() : null } });
      toast('Notice posted. Tenants have been notified.'); onDone(); onClose();
    }, setErr);
  };
  return (
    <Sheet title="Post a notice" onClose={onClose}>
      {!props.data ? <Skeleton /> : (
        <form className="stack" onSubmit={submit}>
          <Field label="Building" id="np"><div className="input"><select id="np" value={pid} onChange={e => setF({ ...f, propertyId: e.target.value })}>
            {props.data.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div></Field>
          <Field label="Title" id="nt"><div className="input"><input id="nt" placeholder="Water tank cleaning" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></div></Field>
          <Field label="Message" id="nb"><textarea id="nb" className="input" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} /></Field>
          <Field label="Event date (optional)" id="ne"><div className="input"><input id="ne" type="datetime-local" value={f.eventAt} onChange={e => setF({ ...f, eventAt: e.target.value })} /></div></Field>
          {err && <div className="err">{err}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>Post notice</button>
        </form>
      )}
    </Sheet>
  );
}

function ParcelSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const units = useQuery<Unit[]>('/units?status=OCCUPIED');
  const { busy, run } = useAction();
  const [f, setF] = useState({ unitId: '', carrier: '', locker: '' });
  const [err, setErr] = useState('');
  const uid = f.unitId || units.data?.[0]?.id || '';
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api('/parcels', { body: { ...f, unitId: uid } });
      toast('Delivery logged. The tenant gets the locker PIN in their app.'); onDone(); onClose();
    }, setErr);
  };
  return (
    <Sheet title="Log a delivery" onClose={onClose}>
      {!units.data ? <Skeleton /> : (
        <form className="stack" onSubmit={submit}>
          <Field label="Unit" id="pu"><div className="input"><select id="pu" value={uid} onChange={e => setF({ ...f, unitId: e.target.value })}>
            {units.data.map(u => <option key={u.id} value={u.id}>{u.property.name} · {u.name} ({u.lease?.tenant.name})</option>)}</select></div></Field>
          <div className="grid2">
            <Field label="Carrier" id="pc"><div className="input"><input id="pc" placeholder="BlueDart" value={f.carrier} onChange={e => setF({ ...f, carrier: e.target.value })} /></div></Field>
            <Field label="Locker" id="pl"><div className="input"><input id="pl" placeholder="7" value={f.locker} onChange={e => setF({ ...f, locker: e.target.value })} /></div></Field>
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>Log delivery</button>
        </form>
      )}
    </Sheet>
  );
}
