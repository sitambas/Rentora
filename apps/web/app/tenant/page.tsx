'use client';
import Link from 'next/link';
import { useState } from 'react';
import { daysBetween, formatDate, formatINR, periodLabel, timeAgo, type Lease, type Parcel, type TenantHome } from '@rentora/shared';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { PaySheet } from '@/components/PaySheet';
import { BuildingArt, ErrorCard, Icon, Skeleton, TicketPill, useToast } from '@/components/ui';

export default function TenantHomePage() {
  const q = useQuery<TenantHome>('/home');
  const toast = useToast();
  const [paying, setPaying] = useState(false);
  const [breakdown, setBreakdown] = useState(false);

  if (q.error && !q.data) return <ErrorCard message={q.error.includes('lease') ? 'You do not have an active lease yet. Ask your landlord to add you to a unit.' : q.error} onRetry={q.reload} />;
  if (!q.data) return <><Skeleton h={70} /><Skeleton h={220} /><Skeleton h={120} /></>;
  const h = q.data, inv = h.invoice;
  const paid = inv?.status === 'PAID';
  const dueIn = inv && !paid ? daysBetween(new Date(), inv.dueDate) : 0;
  const leaseLeft = daysBetween(new Date(), h.lease.endDate);

  const copyPin = (p: Parcel) => navigator.clipboard?.writeText(p.pin).then(() => toast(`Locker PIN ${p.pin} copied`), () => toast(`Locker PIN: ${p.pin}`));
  const toggleAutopay = async () => {
    try {
      const l = await api<Lease>('/leases/mine', { method: 'PATCH', body: { autopay: !h.lease.autopay } });
      q.setData({ ...h, lease: l }); toast(`Auto-pay turned ${l.autopay ? 'on' : 'off'}`);
    } catch (e) { toast((e as Error).message, 'bad'); }
  };
  const split = () => {
    if (!inv) return;
    const others = h.lease.coTenantNames.length;
    toast(others ? `Your share is ${formatINR(inv.amount / (others + 1))} split with ${h.lease.coTenantNames.join(', ')}` : 'Add a co-tenant to your lease to split rent. Ask your manager.');
  };

  return (
    <>
      <div className="card row" style={{ padding: '12px 14px' }}>
        <span className="tile-ic" style={{ background: 'var(--brand-soft)', color: 'var(--brand)', borderRadius: '50%' }}><Icon name="pin" size={17} /></span>
        <div className="grow"><div className="eyebrow">Your home</div><b className="h3 ell" style={{ display: 'block' }}>{h.property.name} · {h.unit.name}</b></div>
        <span className="pill dot p-good">Active</span>
      </div>

      <div className="dash">
        <div className="stack">
          {inv ? (
            <div className="rent-card">
              <div className="row between wrap"><span className="eyebrow row" style={{ gap: 6 }}><Icon name="cal" size={14} />{periodLabel(inv.period)} rent</span>
                <button className="pill glass" onClick={toggleAutopay}>{h.lease.autopay ? 'Auto-pay on' : 'Auto-pay off'}</button></div>
              {paid ? (
                <div className="row" style={{ gap: 12 }}><span className="tile-ic glass" style={{ borderRadius: '50%', width: 44, height: 44 }}><Icon name="check" size={22} /></span>
                  <div><div className="big num">{formatINR(inv.amount)}</div><div className="sm" style={{ opacity: .85 }}>Paid {inv.paidAt && formatDate(inv.paidAt)} · {inv.reference}</div></div></div>
              ) : <>
                <div><div className="big num">{formatINR(inv.amount)}</div>
                  <div className="sm row" style={{ gap: 5, opacity: .9, marginTop: 4 }}><Icon name="cal" size={13} />
                    {inv.status === 'OVERDUE' ? `Overdue since ${formatDate(inv.dueDate)}` : dueIn <= 0 ? 'Due today' : `Due in ${dueIn} day${dueIn === 1 ? '' : 's'} (${formatDate(inv.dueDate)})`}</div></div>
                <div className="paybox"><button onClick={() => setPaying(true)}><Icon name="bolt" size={17} />Pay now <span className="num">({formatINR(inv.amount)})</span></button></div>
              </>}
              {breakdown && <div className="breakdown">{inv.items.map(i => <div key={i.label}><span>{i.label}</span><b className="num">{formatINR(i.amount)}</b></div>)}</div>}
              <div className="grid2" style={{ gap: 8 }}>
                <button className="btn btn-sm glass" onClick={() => setBreakdown(b => !b)}><Icon name="file" size={14} />{breakdown ? 'Hide' : 'View'} breakdown</button>
                <button className="btn btn-sm glass" onClick={split}><Icon name="users" size={14} />Split rent</button>
              </div>
            </div>
          ) : <div className="card empty">No rent bills yet.</div>}

          {h.parcels.map(p => (
            <div className="card row" key={p.id}>
              <span className="tile-ic" style={{ background: 'var(--good-soft)', color: 'var(--good)', borderRadius: '50%' }}><Icon name="box" size={18} /></span>
              <div className="grow"><b className="h3 ell" style={{ display: 'block', fontSize: 14 }}>Package in locker {p.locker}</b><div className="muted sm">{p.carrier} · {timeAgo(p.deliveredAt)} · PIN <b className="num">{p.pin}</b></div></div>
              <button className="btn btn-soft btn-sm" onClick={() => copyPin(p)}><Icon name="copy" size={14} />Copy PIN</button>
            </div>
          ))}

          <div className="card">
            <div className="row between"><b className="h3 row" style={{ gap: 6 }}><Icon name="wrench" size={16} />Maintenance & support</b><span className="pill p-info">{h.tickets.length} active</span></div>
            {h.tickets.map(t => (
              <div className="card flat" key={t.id} style={{ gap: 4 }}>
                <div className="row between"><b>{t.title}</b><TicketPill status={t.status} /></div>
                <div className="muted sm">{t.scheduledFor ? `Visit ${formatDate(t.scheduledFor, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : `Raised ${timeAgo(t.createdAt)}`}{t.assignee && ` · ${t.assignee}`}</div>
              </div>
            ))}
            <Link className="btn btn-soft btn-block" href="/tenant/requests?new=1"><Icon name="plus" size={16} />New maintenance request</Link>
          </div>
        </div>

        <div className="stack">
          <div className="grid2">
            <div className="card">
              <div className="row between"><span className="tile-ic" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}><Icon name="file" size={17} /></span>
                <span className="sm" style={{ color: leaseLeft < 45 ? 'var(--warn)' : 'var(--good)', fontWeight: 600 }}>{leaseLeft < 45 ? `${leaseLeft} days left` : 'Active'}</span></div>
              <div><b className="h3">Lease</b><div className="muted sm">Until {formatDate(h.lease.endDate)}</div><div className="muted sm">Deposit {formatINR(h.lease.deposit)}</div></div>
            </div>
            <div className="card">
              <div className="row between"><span className="tile-ic" style={{ background: 'var(--good-soft)', color: 'var(--good)' }}><Icon name="chat" size={17} /></span></div>
              <div><b className="h3">{h.manager?.role === 'MANAGER' ? 'Property manager' : 'Landlord'}</b><div className="muted sm ell">{h.manager?.name ?? 'Not assigned'}</div></div>
              {h.manager && <Link className="btn btn-primary btn-sm" href={`/tenant/messages?with=${h.manager.id}`}><Icon name="send" size={14} />Message</Link>}
            </div>
          </div>
          <div className="card">
            <div className="row between"><b className="h3">Building notices</b><span className="muted sm">{h.property.name}</span></div>
            {h.notices.length === 0 ? <div className="empty">No notices from your building.</div> : <>
              <div className="hero"><BuildingArt seed={h.property.id} tall />
                <div className="hero-txt"><div><div className="eyebrow" style={{ color: 'hsl(42 95% 72%)' }}>{h.notices[0].eventAt ? formatDate(h.notices[0].eventAt, { weekday: 'long', day: 'numeric', month: 'short' }) : 'Latest notice'}</div>
                  <b className="h3" style={{ color: '#fff' }}>{h.notices[0].title}</b></div></div></div>
              <div className="list">{h.notices.map(n => <div className="li" key={n.id}><div className="grow"><b>{n.title}</b><div className="muted sm">{n.body}</div></div></div>)}</div>
            </>}
          </div>
        </div>
      </div>
      {paying && inv && <PaySheet invoice={inv} onClose={() => setPaying(false)} onDone={q.reload} />}
    </>
  );
}
