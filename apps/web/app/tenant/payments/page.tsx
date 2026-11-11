'use client';
import { useState } from 'react';
import { formatDate, formatINR, periodLabel, type Invoice } from '@rentora/shared';
import { useQuery } from '@/lib/hooks';
import { PageHead } from '@/components/Shell';
import { PaySheet } from '@/components/PaySheet';
import { ErrorCard, Icon, InvoicePill, Skeleton } from '@/components/ui';

export default function TenantPayments() {
  const q = useQuery<Invoice[]>('/invoices');
  const [paying, setPaying] = useState<Invoice | null>(null);
  if (q.error && !q.data) return <ErrorCard message={q.error} onRetry={q.reload} />;
  if (!q.data) return <Skeleton h={300} />;
  const open = q.data.filter(i => i.status !== 'PAID');
  const paid = q.data.filter(i => i.status === 'PAID');
  const paidTotal = paid.reduce((a, i) => a + i.amount, 0);

  return (
    <>
      <PageHead title="Payments" sub={`${formatINR(paidTotal)} paid across ${paid.length} month${paid.length === 1 ? '' : 's'}`} />
      {open.map(i => (
        <div key={i.id} className={`alert ${i.status === 'OVERDUE' ? '' : 'warn'}`}>
          <div className="row between wrap"><b className="h3">{periodLabel(i.period)}</b><InvoicePill inv={i} /></div>
          <div className="row between"><span className="muted">Due {formatDate(i.dueDate)}</span><b className="mid num">{formatINR(i.amount)}</b></div>
          <button className="btn btn-primary" onClick={() => setPaying(i)}><Icon name="bolt" size={16} />Pay now</button>
        </div>
      ))}
      {open.length === 0 && <div className="card row"><span className="tile-ic" style={{ background: 'var(--good-soft)', color: 'var(--good)' }}><Icon name="check" /></span><div>You are all paid up.</div></div>}
      <div className="card">
        <div className="eyebrow">History</div>
        {paid.length === 0 ? <div className="empty">No payments yet.</div> : (
          <div className="list">{paid.map(i => (
            <div className="li" key={i.id}>
              <span className="tile-ic" style={{ background: 'var(--good-soft)', color: 'var(--good)', borderRadius: '50%' }}><Icon name="check" size={16} /></span>
              <div className="grow"><b>{periodLabel(i.period)}</b><div className="muted sm">{i.paidAt && formatDate(i.paidAt)} · {i.method?.replace('_', ' ')}{i.reference && ` · ${i.reference}`}</div></div>
              <div className="amt num">{formatINR(i.amount)}</div>
            </div>
          ))}</div>
        )}
      </div>
      {paying && <PaySheet invoice={paying} onClose={() => setPaying(null)} onDone={q.reload} />}
    </>
  );
}
