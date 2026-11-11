'use client';
import Link from 'next/link';
import { use, useState } from 'react';
import { formatDate, formatINR, periodLabel, type Invoice, type Ticket, type Unit } from '@rentora/shared';
import { api } from '@/lib/api';
import { useAction, useQuery } from '@/lib/hooks';
import { EditUnitSheet, MoveInSheet, RecordPaymentSheet, RenewSheet } from '@/components/StaffSheets';
import { Avatar, BuildingArt, ErrorCard, Icon, InvoicePill, Sheet, Skeleton, TicketPill, useToast } from '@/components/ui';

type Detail = Unit & { invoices: Invoice[]; tickets: Ticket[] };

export default function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useQuery<Detail>(`/units/${id}`);
  const toast = useToast();
  const { busy, run } = useAction();
  const [sheet, setSheet] = useState<'record' | 'renew' | 'end' | 'movein' | 'edit' | null>(null);

  if (q.error && !q.data) return <ErrorCard message={q.error} onRetry={q.reload} />;
  if (!q.data) return <><Skeleton h={200} /><Skeleton h={160} /></>;
  const u = q.data, lease = u.lease, inv = u.openInvoice;

  const remind = () => run(async () => {
    await api(`/invoices/${inv!.id}/remind`, { method: 'POST' });
    toast(`Reminder sent to ${inv!.tenant.name}`); q.reload();
  }, m => toast(m, 'bad'));
  const endLease = () => run(async () => {
    await api(`/leases/${lease!.id}/end`, { method: 'POST' });
    toast(`${u.name} is now vacant`); setSheet(null); q.reload();
  }, m => toast(m, 'bad'));

  return (
    <>
      <div className="row between">
        <Link href="/owner/properties" className="row muted sm" style={{ gap: 6 }}><Icon name="back" size={15} />All properties</Link>
        <button className="btn btn-line btn-sm" onClick={() => setSheet('edit')}><Icon name="edit" size={15} />Edit unit</button>
      </div>
      <div className="hero" style={{ aspectRatio: '21/7' }}>
        <BuildingArt seed={u.property.id} tall />
        <div className="hero-txt"><div className="grow"><div className="eyebrow" style={{ color: '#fff', opacity: .8 }}>{u.property.name}</div><div className="h1" style={{ color: '#fff' }}>{u.name}</div></div>
          <span className={`pill dot ${u.status === 'VACANT' ? 'p-info' : 'p-good'}`}>{u.status === 'VACANT' ? 'Vacant' : 'Occupied'}</span></div>
      </div>

      <div className="dash">
        <div className="stack">
          {lease ? (
            <div className="card">
              <div className="row"><Avatar name={lease.tenant.name} size={44} />
                <div className="grow"><div className="h2">{[lease.tenant.name, ...lease.coTenantNames].join(' & ')}</div><div className="muted">{lease.tenant.phone}</div></div>
                <Link className="btn btn-soft btn-sm" href={`/owner/messages?with=${lease.tenant.id}`}><Icon name="chat" size={15} />Message</Link>
              </div>
              <div className="card flat" style={{ gap: 8 }}>
                {[['Lease', `${formatDate(lease.startDate)} – ${formatDate(lease.endDate)}`], ['Monthly rent', formatINR(lease.rent)], ['Security deposit', formatINR(lease.deposit)], ['Auto-pay', lease.autopay ? 'On' : 'Off']].map(([k, v]) => (
                  <div key={k} className="row between"><span className="muted">{k}</span><b className="num">{v}</b></div>
                ))}
              </div>
              <div className="row wrap">
                <button className="btn btn-line btn-sm" onClick={() => setSheet('renew')}><Icon name="file" size={15} />Renew lease</button>
                <button className="btn btn-danger btn-sm" onClick={() => setSheet('end')}>End lease</button>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="h2">No tenant</div>
              <div className="muted">Rent {formatINR(u.rent)}/mo · deposit {formatINR(u.deposit)}</div>
              <div className="row wrap">
                <button className="btn btn-primary btn-sm" onClick={() => setSheet('movein')}><Icon name="plus" size={15} />Add tenant</button>
                {u.pendingApplications > 0 && <Link className="btn btn-soft btn-sm" href={`/owner/applications?unitId=${u.id}`}>Review {u.pendingApplications} application{u.pendingApplications === 1 ? '' : 's'}</Link>}
              </div>
            </div>
          )}

          {inv && (
            <div className={`alert ${inv.status === 'OVERDUE' ? '' : 'warn'}`}>
              <div className="row between wrap"><b className="h3">{periodLabel(inv.period)} rent</b><InvoicePill inv={inv} /></div>
              <div className="row between"><span className="muted">Due {formatDate(inv.dueDate)}</span><b className="mid num">{formatINR(inv.amount)}</b></div>
              <div className="row">
                <button className="btn btn-primary btn-sm grow" disabled={busy} onClick={remind}><Icon name="send" size={15} />Send reminder</button>
                <button className="btn btn-good btn-sm grow" onClick={() => setSheet('record')}><Icon name="wallet" size={15} />Record payment</button>
              </div>
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <div className="eyebrow">Ledger</div>
            {u.invoices.length === 0 ? <div className="empty">No invoices yet.</div> : (
              <div className="list">
                {u.invoices.map(i => (
                  <div key={i.id} className="li">
                    <div className="grow"><b>{periodLabel(i.period)}</b><div className="muted sm">{i.paidAt ? `Paid ${formatDate(i.paidAt)} · ${i.method?.replace('_', ' ')}` : `Due ${formatDate(i.dueDate)}`}{i.reference ? ` · ${i.reference}` : ''}</div></div>
                    <div className="stack" style={{ gap: 4, alignItems: 'flex-end' }}><span className="amt num">{formatINR(i.amount)}</span><InvoicePill inv={i} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card">
            <div className="row between"><span className="eyebrow">Maintenance</span><Link className="link sm" href="/owner/maintenance">All requests</Link></div>
            {u.tickets.length === 0 ? <div className="empty">No requests for this unit.</div> : (
              <div className="list">{u.tickets.map(t => (
                <div key={t.id} className="li"><div className="grow"><b>{t.title}</b><div className="muted sm">{formatDate(t.createdAt)} · {t.createdBy.name}</div></div><TicketPill status={t.status} /></div>
              ))}</div>
            )}
          </div>
        </div>
      </div>

      {sheet === 'record' && inv && <RecordPaymentSheet invoice={inv} onClose={() => setSheet(null)} onDone={q.reload} />}
      {sheet === 'renew' && lease && <RenewSheet leaseId={lease.id} tenant={lease.tenant.name} rent={lease.rent} endDate={lease.endDate} onClose={() => setSheet(null)} onDone={q.reload} />}
      {sheet === 'edit' && <EditUnitSheet unit={u} onClose={() => setSheet(null)} onDone={q.reload} />}
      {sheet === 'movein' && <MoveInSheet unit={u} onClose={() => setSheet(null)} onDone={q.reload} />}
      {sheet === 'end' && lease && (
        <Sheet title="End this lease?" onClose={() => setSheet(null)}>
          <p className="muted" style={{ margin: 0 }}>{lease.tenant.name} will lose access to {u.name} in Rentora and the unit will be marked vacant. Unpaid invoices stay on record.</p>
          <div className="row"><button className="btn btn-line grow" onClick={() => setSheet(null)}>Keep lease</button><button className="btn btn-danger grow" disabled={busy} onClick={endLease}>End lease</button></div>
        </Sheet>
      )}
    </>
  );
}
