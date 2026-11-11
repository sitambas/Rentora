'use client';
import { useState, type FormEvent } from 'react';
import { PAYMENT_METHODS, formatDate, formatINR, periodLabel, type Invoice, type PaymentMethod, type Property, type Unit } from '@rentora/shared';
import { api } from '@/lib/api';
import { useAction, useQuery } from '@/lib/hooks';
import { Field, Sheet, Skeleton, useToast } from './ui';

const today = () => new Date().toISOString().slice(0, 10);

export function RecordPaymentSheet({ invoice, onClose, onDone }: { invoice: Invoice; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { busy, run } = useAction();
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [reference, setReference] = useState('');
  const [err, setErr] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api(`/invoices/${invoice.id}/record`, { body: { method, reference: reference || undefined } });
      toast(`${formatINR(invoice.amount)} recorded for ${invoice.unit.name}`);
      onDone(); onClose();
    }, setErr);
  };
  return (
    <Sheet title="Record rent payment" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="card flat">
          <div className="row between"><span className="muted">{invoice.unit.name} · {invoice.tenant.name}</span><b className="num">{formatINR(invoice.amount)}</b></div>
          <div className="muted sm">{periodLabel(invoice.period)} · due {formatDate(invoice.dueDate)}</div>
        </div>
        <Field label="Paid by" id="rm"><div className="input"><select id="rm" value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}>
          {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div></Field>
        <Field label="Reference (optional)" id="rr" hint="UTR, cheque number or receipt number."><div className="input"><input id="rr" value={reference} onChange={e => setReference(e.target.value)} /></div></Field>
        {err && <div className="err">{err}</div>}
        <button className="btn btn-good btn-block" disabled={busy}>Mark as received</button>
      </form>
    </Sheet>
  );
}

export function AddPropertySheet({ onClose, onDone }: { onClose: () => void; onDone: (p: Property) => void }) {
  const toast = useToast();
  const { busy, run } = useAction();
  const [f, setF] = useState({ name: '', address: '', city: '', managerPhone: '' });
  const [err, setErr] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const p = await api<Property>('/properties', { body: { ...f, managerPhone: f.managerPhone || null } });
      toast(`${p.name} added`); onDone(p); onClose();
    }, setErr);
  };
  return (
    <Sheet title="Add a property" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Field label="Property name" id="pn"><div className="input"><input id="pn" placeholder="Westside Courtyard" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div></Field>
        <Field label="Street address" id="pa"><div className="input"><input id="pa" value={f.address} onChange={e => setF({ ...f, address: e.target.value })} /></div></Field>
        <Field label="City" id="pc"><div className="input"><input id="pc" value={f.city} onChange={e => setF({ ...f, city: e.target.value })} /></div></Field>
        <Field label="Manager’s mobile (optional)" id="pm" hint="They need a Rentora manager account first."><div className="input"><input id="pm" inputMode="tel" value={f.managerPhone} onChange={e => setF({ ...f, managerPhone: e.target.value })} /></div></Field>
        {err && <div className="err">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>Add property</button>
      </form>
    </Sheet>
  );
}

export function AddUnitSheet({ onClose, onDone, propertyId }: { onClose: () => void; onDone: () => void; propertyId?: string }) {
  const toast = useToast();
  const props = useQuery<Property[]>('/properties');
  const { busy, run } = useAction();
  const [f, setF] = useState({ propertyId: propertyId ?? '', name: '', rent: '', deposit: '' });
  const [err, setErr] = useState('');
  const pid = f.propertyId || props.data?.[0]?.id || '';
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const u = await api<Unit>('/units', { body: { propertyId: pid, name: f.name, rent: f.rent, deposit: f.deposit || undefined } });
      toast(`${u.name} added to ${u.property.name}`); onDone(); onClose();
    }, setErr);
  };
  return (
    <Sheet title="Add a unit" onClose={onClose}>
      {!props.data ? <Skeleton /> : props.data.length === 0 ? <div className="empty">Add a property first, then add its units.</div> : (
        <form className="stack" onSubmit={submit}>
          <Field label="Property" id="up"><div className="input"><select id="up" value={pid} onChange={e => setF({ ...f, propertyId: e.target.value })}>
            {props.data.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div></Field>
          <Field label="Unit name" id="un"><div className="input"><input id="un" placeholder="Unit 102" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div></Field>
          <div className="grid2">
            <Field label="Rent / month (₹)" id="ur"><div className="input"><input id="ur" inputMode="numeric" value={f.rent} onChange={e => setF({ ...f, rent: e.target.value.replace(/\D/g, '') })} /></div></Field>
            <Field label="Deposit (₹)" id="ud" hint="Defaults to 2 months."><div className="input"><input id="ud" inputMode="numeric" value={f.deposit} onChange={e => setF({ ...f, deposit: e.target.value.replace(/\D/g, '') })} /></div></Field>
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>Add unit</button>
        </form>
      )}
    </Sheet>
  );
}

export function EditUnitSheet({ unit, onClose, onDone }: { unit: Unit; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { busy, run } = useAction();
  const [f, setF] = useState({ name: unit.name, rent: String(unit.rent), deposit: String(unit.deposit) });
  const [err, setErr] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api<Unit>(`/units/${unit.id}`, { method: 'PATCH', body: { name: f.name, rent: f.rent, deposit: f.deposit || 0 } });
      toast('Unit updated'); onDone(); onClose();
    }, setErr);
  };
  return (
    <Sheet title={`Edit ${unit.name}`} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Field label="Unit name" id="eun"><div className="input"><input id="eun" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div></Field>
        <div className="grid2">
          <Field label="Rent / month (₹)" id="eur"><div className="input"><input id="eur" inputMode="numeric" value={f.rent} onChange={e => setF({ ...f, rent: e.target.value.replace(/\D/g, '') })} /></div></Field>
          <Field label="Deposit (₹)" id="eud"><div className="input"><input id="eud" inputMode="numeric" value={f.deposit} onChange={e => setF({ ...f, deposit: e.target.value.replace(/\D/g, '') })} /></div></Field>
        </div>
        {unit.lease && <div className="muted sm">New rent and deposit apply to the next lease. To change {unit.lease.tenant.name}’s rent, renew their lease.</div>}
        {err && <div className="err">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>Save changes</button>
      </form>
    </Sheet>
  );
}

/** Shows a new tenant's temporary password once, so the owner can pass it on. */
export function TempPasswordNote({ phone, password }: { phone: string; password: string }) {
  const toast = useToast();
  const copy = () => navigator.clipboard?.writeText(`Rentora login\nMobile: ${phone}\nPassword: ${password}`).then(() => toast('Login details copied'), () => toast('Copy failed. Select the text instead.', 'bad'));
  return (
    <div className="card flat">
      <b>Share these login details with the tenant</b>
      <div className="num" style={{ userSelect: 'all' }}>Mobile: {phone}<br />Temporary password: <b>{password}</b></div>
      <div className="hint">This password is shown only once. Ask them to change it after signing in.</div>
      <button type="button" className="btn btn-soft btn-sm" onClick={copy}>Copy login details</button>
    </div>
  );
}

export function MoveInSheet({ unit, onClose, onDone }: { unit: Unit; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { busy, run } = useAction();
  const [f, setF] = useState({ name: '', phone: '', email: '', coTenant: '', startDate: today(), months: '11', rent: String(unit.rent), deposit: String(unit.deposit) });
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ phone: string; tempPassword: string | null } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await api<{ tempPassword: string | null }>('/leases', {
        body: { unitId: unit.id, name: f.name, phone: f.phone, email: f.email || null, startDate: f.startDate, months: f.months, rent: f.rent, deposit: f.deposit,
          coTenantNames: f.coTenant.trim() ? [f.coTenant.trim()] : [] }
      });
      toast(`${f.name} moved in to ${unit.name}`);
      onDone();
      if (r.tempPassword) setDone({ phone: f.phone, tempPassword: r.tempPassword }); else onClose();
    }, setErr);
  };
  return (
    <Sheet title={`Add tenant · ${unit.name}`} onClose={onClose}>
      {done?.tempPassword ? <><TempPasswordNote phone={done.phone} password={done.tempPassword} /><button className="btn btn-primary" onClick={onClose}>Done</button></> : (
        <form className="stack" onSubmit={submit}>
          <Field label="Tenant’s full name" id="mn"><div className="input"><input id="mn" value={f.name} onChange={set('name')} /></div></Field>
          <div className="grid2">
            <Field label="Mobile" id="mp"><div className="input"><input id="mp" inputMode="tel" value={f.phone} onChange={set('phone')} /></div></Field>
            <Field label="Email (optional)" id="me"><div className="input"><input id="me" type="email" value={f.email} onChange={set('email')} /></div></Field>
          </div>
          <Field label="Co-tenant (optional)" id="mc"><div className="input"><input id="mc" placeholder="Name of a roommate on the lease" value={f.coTenant} onChange={set('coTenant')} /></div></Field>
          <div className="grid2">
            <Field label="Move-in date" id="ms"><div className="input"><input id="ms" type="date" value={f.startDate} onChange={set('startDate')} /></div></Field>
            <Field label="Lease length (months)" id="mm"><div className="input"><input id="mm" inputMode="numeric" value={f.months} onChange={set('months')} /></div></Field>
            <Field label="Rent / month (₹)" id="mr"><div className="input"><input id="mr" inputMode="numeric" value={f.rent} onChange={set('rent')} /></div></Field>
            <Field label="Deposit (₹)" id="md"><div className="input"><input id="md" inputMode="numeric" value={f.deposit} onChange={set('deposit')} /></div></Field>
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>Create lease</button>
        </form>
      )}
    </Sheet>
  );
}

export function RenewSheet({ leaseId, tenant, rent, endDate, onClose, onDone }: { leaseId: string; tenant: string; rent: number; endDate: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { busy, run } = useAction();
  const [months, setMonths] = useState('12');
  const [newRent, setNewRent] = useState(String(rent));
  const [err, setErr] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api(`/leases/${leaseId}/renew`, { body: { months, rent: newRent } });
      toast(`Lease renewed for ${tenant}`); onDone(); onClose();
    }, setErr);
  };
  return (
    <Sheet title={`Renew lease · ${tenant}`} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="muted">Current lease ends {formatDate(endDate)}.</div>
        <div className="grid2">
          <Field label="Extend by (months)" id="rnm"><div className="input"><input id="rnm" inputMode="numeric" value={months} onChange={e => setMonths(e.target.value)} /></div></Field>
          <Field label="New rent / month (₹)" id="rnr"><div className="input"><input id="rnr" inputMode="numeric" value={newRent} onChange={e => setNewRent(e.target.value)} /></div></Field>
        </div>
        {err && <div className="err">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>Renew lease</button>
      </form>
    </Sheet>
  );
}
