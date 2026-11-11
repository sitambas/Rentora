'use client';
import Link from 'next/link';
import { useState } from 'react';
import { formatCompactINR, formatINR, periodLabel, timeAgo, type Dashboard, type Invoice } from '@rentora/shared';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { AddUnitSheet, RecordPaymentSheet, RenewSheet } from '@/components/StaffSheets';
import { Avatar, ErrorCard, FlowChart, Icon, InvoicePill, Skeleton, useToast } from '@/components/ui';

export default function Overview() {
  const { user } = useAuth();
  const toast = useToast();
  const q = useQuery<Dashboard>('/dashboard');
  const [recording, setRecording] = useState<Invoice | null>(null);
  const [addUnit, setAddUnit] = useState(false);
  const [renew, setRenew] = useState<Dashboard['expiring'][number] | null>(null);

  if (q.error && !q.data) return <ErrorCard message={q.error} onRetry={q.reload} />;
  if (!q.data) return <><Skeleton h={80} /><Skeleton h={140} /><Skeleton h={240} /></>;
  const d = q.data;
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const occ = d.unitCount ? (d.occupiedCount / d.unitCount) * 100 : 0;
  const change = d.collectedPrev ? ((d.collected - d.collectedPrev) / d.collectedPrev) * 100 : null;
  const avg = d.flow.reduce((a, f) => a + f.amount, 0) / Math.max(1, d.flow.filter(f => f.amount).length);

  const remind = async (inv: Invoice) => {
    try { await api(`/invoices/${inv.id}/remind`, { method: 'POST' }); toast(`Reminder sent to ${inv.tenant.name}`); q.reload(); }
    catch (e) { toast((e as Error).message, 'bad'); }
  };

  return (
    <>
      <div className="stack" style={{ gap: 4 }}>
        <div className="eyebrow">Financial command</div>
        <h1 className="h1">{greet}, {user?.name.split(' ')[0]}</h1>
        <div><span className="pill dot p-info">{d.unitCount} units · {periodLabel(d.period)}</span></div>
      </div>

      <div className="dash">
        <div className="stack">
          <div className="card">
            <div className="row between"><span className="muted">Collected ({periodLabel(d.period, true)})</span>
              <span className="tile-ic" style={{ background: 'var(--good-soft)', color: 'var(--good)' }}><Icon name="wallet" /></span></div>
            <div className="big num">{formatINR(d.collected)}</div>
            {change !== null && <div className="row sm">
              <span className={`pill ${change >= 0 ? 'p-good' : 'p-bad'}`}><Icon name="trend" size={12} /> {Math.abs(change).toFixed(1)}%</span>
              <span className="muted">{change >= 0 ? 'more' : 'less'} than last month so far</span></div>}
          </div>
          <div className="grid2">
            <div className="card">
              <div className="row between"><span className="muted sm">Overdue</span><span className="tile-ic" style={{ background: 'var(--warn-soft)', color: 'var(--warn)', width: 30, height: 30 }}><Icon name="alert" size={16} /></span></div>
              <div className="mid num">{formatINR(d.overdueAmount)}</div>
              <span className={`pill dot ${d.overdueCount ? 'p-warn' : 'p-good'}`} style={{ alignSelf: 'flex-start' }}>{d.overdueCount ? `${d.overdueCount} tenant${d.overdueCount === 1 ? '' : 's'} late` : 'Nobody late'}</span>
            </div>
            <div className="card">
              <div className="row between"><span className="muted sm">Occupancy</span><span className="tile-ic" style={{ background: 'var(--brand-soft)', color: 'var(--brand)', width: 30, height: 30 }}><Icon name="building" size={16} /></span></div>
              <div className="mid num">{occ.toFixed(1)}%</div>
              <div className="stack" style={{ gap: 5 }}><div className="bar"><i style={{ width: `${occ}%` }} /></div><span className="muted sm num">{d.occupiedCount}/{d.unitCount} units let</span></div>
            </div>
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <div className="eyebrow">Quick actions</div>
            <div className="qa">
              <Link href="/owner/payments?status=UNPAID"><span className="qi"><Icon name="wallet" size={19} /></span>Record rent</Link>
              <button onClick={() => setAddUnit(true)}><span className="qi"><Icon name="plus" size={19} /></span>Add unit</button>
              <Link href="/owner/applications"><span className="qi"><Icon name="clipboard" size={19} /></span>Screen{d.pendingApplications > 0 && <span className="badge">{d.pendingApplications}</span>}</Link>
              <Link href="/owner/maintenance"><span className="qi"><Icon name="wrench" size={19} /></span>Repairs{d.openTickets > 0 && <span className="badge">{d.openTickets}</span>}</Link>
            </div>
          </div>

          {(d.overdue.length > 0 || d.expiring.length > 0) && (
            <div className="stack" style={{ gap: 8 }}>
              <div className="row between"><span className="eyebrow" style={{ color: 'var(--bad)' }}>● Action required</span><span className="muted sm">{d.overdue.length + d.expiring.length} items</span></div>
              {d.overdue.map(inv => {
                const recent = inv.remindedAt && Date.now() - new Date(inv.remindedAt).getTime() < 12 * 3600_000;
                return (
                  <div className="alert" key={inv.id}>
                    <div className="row" style={{ alignItems: 'flex-start' }}>
                      <span className="tile-ic" style={{ background: 'var(--bad-soft)', color: 'var(--bad)' }}><Icon name="alert" /></span>
                      <div className="grow">
                        <div className="row between wrap" style={{ gap: 6 }}><b className="h3">{inv.unit.name} · Rent overdue</b><InvoicePill inv={inv} /></div>
                        <div className="muted sm">{inv.tenant.name} · {inv.property.name} · <span className="num">{formatINR(inv.amount)}</span></div>
                        {inv.remindedAt && <div className="muted sm">Last reminder {timeAgo(inv.remindedAt)}</div>}
                      </div>
                    </div>
                    <div className="row">
                      <button className="btn btn-primary btn-sm grow" disabled={!!recent} onClick={() => remind(inv)}><Icon name={recent ? 'check' : 'send'} size={15} />{recent ? 'Reminder sent' : 'Send reminder'}</button>
                      <button className="btn btn-line btn-sm" onClick={() => setRecording(inv)}><Icon name="wallet" size={15} />Record</button>
                      <a className="btn btn-line btn-sm" href={`tel:+91${inv.tenant.phone}`} aria-label={`Call ${inv.tenant.name} on ${inv.tenant.phone}`}><Icon name="phone" size={15} /></a>
                    </div>
                  </div>
                );
              })}
              {d.expiring.map(x => (
                <div className="alert warn" key={x.leaseId}>
                  <div className="row">
                    <span className="tile-ic" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}><Icon name="file" /></span>
                    <div className="grow"><b className="h3">{x.unit.name} lease expiring</b><div className="muted sm">{x.tenant.name} · {x.daysLeft} day{x.daysLeft === 1 ? '' : 's'} remaining</div></div>
                    <button className="btn btn-line btn-sm" onClick={() => setRenew(x)}>Renew <Icon name="arrow" size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <div className="row between wrap"><div><div className="eyebrow">Cash flow</div><div className="h2">Rent collected by month</div></div>
              <span className="pill p-info"><Icon name="trend" size={12} /> Avg {formatCompactINR(avg)}/mo</span></div>
            <FlowChart points={d.flow.map(f => ({ label: periodLabel(f.period, true), value: f.amount }))} />
          </div>
          <div className="card">
            <div className="row between"><span className="eyebrow">Recent payments</span><Link className="link sm" href="/owner/payments?status=PAID">View all</Link></div>
            {d.activity.length === 0 ? <div className="empty">No payments yet.</div> : (
              <div className="list">
                {d.activity.map(a => (
                  <div className="li" key={a.id}>
                    <Avatar name={a.tenant.name} />
                    <div className="grow"><div className="h3 ell" style={{ fontSize: 14 }}>{a.unit.name} · {a.tenant.name}</div><div className="muted sm">{a.method?.replace('_', ' ')} · {a.paidAt && timeAgo(a.paidAt)}</div></div>
                    <div className="amt num" style={{ color: 'var(--good)' }}>+{formatINR(a.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {recording && <RecordPaymentSheet invoice={recording} onClose={() => setRecording(null)} onDone={q.reload} />}
      {addUnit && <AddUnitSheet onClose={() => setAddUnit(false)} onDone={q.reload} />}
      {renew && <RenewSheet leaseId={renew.leaseId} tenant={renew.tenant.name} rent={renew.rent} endDate={renew.endDate} onClose={() => setRenew(null)} onDone={q.reload} />}
    </>
  );
}
