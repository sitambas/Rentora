'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatDate, formatINR, periodLabel, periodOf, shiftPeriod, type Invoice } from '@rentora/shared';
import { api } from '@/lib/api';
import { useAction, useQuery } from '@/lib/hooks';
import { PageHead } from '@/components/Shell';
import { RecordPaymentSheet } from '@/components/StaffSheets';
import { Avatar, ErrorCard, Icon, InvoicePill, Skeleton, useToast } from '@/components/ui';

type Status = 'ALL' | 'UNPAID' | 'OVERDUE' | 'PAID';

function Payments() {
  const params = useSearchParams();
  const toast = useToast();
  const [status, setStatus] = useState<Status>((params.get('status') as Status) ?? 'ALL');
  const [period, setPeriod] = useState('');
  const qs = new URLSearchParams();
  if (status !== 'ALL') qs.set('status', status);
  if (period) qs.set('period', period);
  const q = useQuery<Invoice[]>(`/invoices${qs.size ? `?${qs}` : ''}`);
  const [recording, setRecording] = useState<Invoice | null>(null);
  const { busy, run } = useAction();
  const cur = periodOf(new Date());
  const periods = Array.from({ length: 6 }, (_, i) => shiftPeriod(cur, -i));

  const generate = () => run(async () => {
    const r = await api<{ label: string }>('/invoices/generate', { body: { period: cur } });
    toast(r.label); q.reload();
  }, m => toast(m, 'bad'));

  const list = q.data ?? [];
  const total = list.reduce((a, i) => a + i.amount, 0);

  return (
    <>
      <PageHead title="Payments" sub="Rent invoices across your properties"
        action={<button className="btn btn-line btn-sm" disabled={busy} onClick={generate}><Icon name="refresh" size={15} />Bill {periodLabel(cur, true)} rent</button>} />
      <div className="row wrap">
        <div className="chips grow" role="group" aria-label="Status">
          {([['ALL', 'All'], ['UNPAID', 'Unpaid'], ['OVERDUE', 'Overdue'], ['PAID', 'Paid']] as const).map(([k, l]) => (
            <button key={k} className="chip" aria-pressed={status === k} onClick={() => setStatus(k)}>{l}</button>
          ))}
        </div>
        <div className="input" style={{ width: 'auto', minHeight: 36 }}>
          <select aria-label="Month" value={period} onChange={e => setPeriod(e.target.value)} style={{ height: 34 }}>
            <option value="">All months</option>
            {periods.map(p => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>
        </div>
      </div>

      {q.error && !q.data ? <ErrorCard message={q.error} onRetry={q.reload} /> : !q.data ? <Skeleton h={300} /> : (
        <div className="card">
          <div className="row between"><span className="eyebrow">{list.length} invoice{list.length === 1 ? '' : 's'}</span><b className="num">{formatINR(total)}</b></div>
          {list.length === 0 ? <div className="empty">No invoices match these filters.</div> : (
            <div className="list">
              {list.map(i => (
                <div className="li" key={i.id}>
                  <Avatar name={i.tenant.name} />
                  <div className="grow">
                    <div className="h3 ell" style={{ fontSize: 14 }}>{i.unit.name} · {i.tenant.name}</div>
                    <div className="muted sm ell">{periodLabel(i.period)} · {i.paidAt ? `paid ${formatDate(i.paidAt)} by ${i.method?.replace('_', ' ').toLowerCase()}` : `due ${formatDate(i.dueDate)}`}</div>
                  </div>
                  <div className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                    <span className="amt num" style={i.status === 'PAID' ? { color: 'var(--good)' } : undefined}>{formatINR(i.amount)}</span>
                    {i.status === 'PAID' ? <InvoicePill inv={i} /> : <button className="btn btn-soft btn-sm" style={{ height: 28 }} onClick={() => setRecording(i)}>Record</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {recording && <RecordPaymentSheet invoice={recording} onClose={() => setRecording(null)} onDone={q.reload} />}
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<Skeleton h={300} />}><Payments /></Suspense>;
}
