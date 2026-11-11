'use client';
import { useState } from 'react';
import { formatINR, periodLabel, type Invoice } from '@rentora/shared';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { Field, Sheet, useToast } from './ui';

type Method = 'UPI' | 'CARD' | 'NETBANKING';

export function PaySheet({ invoice, onClose, onDone }: { invoice: Invoice; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { busy, run } = useAction();
  const [method, setMethod] = useState<Method>('UPI');
  const [err, setErr] = useState('');
  const pay = () => run(async () => {
    const r = await api<Invoice>(`/invoices/${invoice.id}/pay`, { body: { method } });
    toast(`${formatINR(r.amount)} paid · receipt ${r.reference}`); onDone(); onClose();
  }, setErr);
  return (
    <Sheet title={`Pay ${periodLabel(invoice.period)} rent`} onClose={onClose}>
      <div className="card flat" style={{ gap: 8 }}>
        {invoice.items.map(i => <div key={i.label} className="row between"><span className="muted">{i.label}</span><b className="num">{formatINR(i.amount)}</b></div>)}
        <div className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}><b>Total</b><b className="mid num">{formatINR(invoice.amount)}</b></div>
      </div>
      <Field label="Pay with" id="pm"><div className="input"><select id="pm" value={method} onChange={e => setMethod(e.target.value as Method)}>
        <option value="UPI">UPI</option><option value="CARD">Debit / credit card</option><option value="NETBANKING">NetBanking</option></select></div></Field>
      <div className="hint">Test mode: no money moves. The payment is recorded straight away until a payment gateway is connected.</div>
      {err && <div className="err">{err}</div>}
      <button className="btn btn-primary btn-block" style={{ height: 48 }} disabled={busy} onClick={pay}>Pay {formatINR(invoice.amount)}</button>
    </Sheet>
  );
}
