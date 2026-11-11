'use client';
import { useState, type FormEvent } from 'react';
import { DOCUMENT_MAX_BYTES, DOCUMENT_TYPES, ID_TYPES, PAYMENT_METHODS, formatBytes, formatDate, formatINR, periodLabel, type IdType, type Invoice, type PaymentMethod, type Property, type Unit } from '@rentora/shared';
import { api, uploadDocument } from '@/lib/api';
import { useAction, useQuery } from '@/lib/hooks';
import { Field, Icon, Sheet, Skeleton, useToast } from './ui';

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

const BLANK_TENANT = {
  name: '', phone: '', email: '', dateOfBirth: '', occupation: '', employer: '', permanentAddress: '',
  idType: '' as IdType | '', idNumber: '', emergencyName: '', emergencyRelation: '', emergencyPhone: '',
  startDate: '', months: '11', rent: '', deposit: '', occupants: '1', notes: ''
};

/** Adds a tenant to a unit with their full details. Pass `unit` to fix the unit; leave it out to choose a vacant one. */
export function MoveInSheet({ unit, onClose, onDone }: { unit?: Unit; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { busy, run } = useAction();
  const vacant = useQuery<Unit[]>(unit ? null : '/units?status=VACANT');
  const [unitId, setUnitId] = useState(unit?.id ?? '');
  const [f, setF] = useState({ ...BLANK_TENANT, startDate: today(), rent: unit ? String(unit.rent) : '', deposit: unit ? String(unit.deposit) : '' });
  const [coTenants, setCoTenants] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ phone: string; tempPassword: string | null; failed: string[] } | null>(null);
  const [agreement, setAgreement] = useState<File[]>([]);
  const [aadhaar, setAadhaar] = useState<File[]>([]);
  const set = (k: keyof typeof f, digits = false) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: digits ? e.target.value.replace(/\D/g, '') : e.target.value });

  const options = vacant.data ?? [];
  const chosen = unit ?? options.find(u => u.id === unitId);
  const pickUnit = (id: string) => {
    const u = options.find(x => x.id === id);
    setUnitId(id);
    if (u) setF(prev => ({ ...prev, rent: String(u.rent), deposit: String(u.deposit) }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!chosen) { setErr('Choose the unit the tenant is moving into.'); return; }
    run(async () => {
      const names = coTenants.map(n => n.trim()).filter(Boolean);
      const r = await api<{ leaseId: string; tempPassword: string | null }>('/leases', {
        body: {
          unitId: chosen.id, name: f.name, phone: f.phone, email: f.email.trim() || null,
          dateOfBirth: f.dateOfBirth || null, occupation: f.occupation, employer: f.employer, permanentAddress: f.permanentAddress,
          idType: f.idType || null, idNumber: f.idNumber, emergencyName: f.emergencyName, emergencyRelation: f.emergencyRelation, emergencyPhone: f.emergencyPhone,
          startDate: f.startDate, months: f.months, rent: f.rent, deposit: f.deposit, occupants: f.occupants || undefined, notes: f.notes,
          coTenantNames: names
        }
      });
      // The lease exists now; upload the files one by one and report any that fail instead of undoing the move-in.
      const failed: string[] = [];
      for (const [kind, files] of [['AGREEMENT', agreement], ['ID_PROOF', aadhaar]] as const) {
        for (const file of files) {
          try { await uploadDocument(r.leaseId, kind, file); }
          catch (e) { failed.push(`${file.name}: ${(e as Error).message}`); }
        }
      }
      toast(`${f.name} moved in to ${chosen.name}`);
      onDone();
      if (r.tempPassword || failed.length) setDone({ phone: f.phone, tempPassword: r.tempPassword, failed }); else onClose();
    }, setErr);
  };

  const input = (k: keyof typeof f, id: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, digits = false) =>
    <div className="input"><input id={id} value={f[k]} onChange={set(k, digits)} {...props} /></div>;

  return (
    <Sheet title={unit ? `Add tenant · ${unit.name}` : 'Add a tenant'} onClose={onClose}>
      {done ? <>
        {done.failed.length > 0 && (
          <div className="alert warn" role="alert">
            <b>{done.failed.length === 1 ? 'One document' : `${done.failed.length} documents`} didn’t upload</b>
            <ul className="muted sm" style={{ margin: 0, paddingLeft: 18 }}>{done.failed.map(m => <li key={m}>{m}</li>)}</ul>
            <span className="muted sm">The tenant was added. Upload these from the unit page under Documents.</span>
          </div>
        )}
        {done.tempPassword && <TempPasswordNote phone={done.phone} password={done.tempPassword} />}
        <button className="btn btn-primary" onClick={onClose}>Done</button>
      </> : (
        !unit && !vacant.data ? <Skeleton /> : !unit && options.length === 0 ? (
          <div className="empty">Every unit has a tenant. Add a unit on the Properties page first.</div>
        ) : (
        <form className="stack" onSubmit={submit} noValidate>
          {!unit && (
            <Field label="Unit" id="tu"><div className="input"><select id="tu" value={unitId} onChange={e => pickUnit(e.target.value)}>
              <option value="">Choose a vacant unit</option>
              {options.map(u => <option key={u.id} value={u.id}>{u.property.name} · {u.name} · {formatINR(u.rent)}/mo</option>)}
            </select></div></Field>
          )}

          <div className="eyebrow">Tenant</div>
          <Field label="Full name" id="tn">{input('name', 'tn', { autoComplete: 'off' })}</Field>
          <div className="grid2">
            <Field label="Mobile" id="tp" hint="Their Rentora login.">{input('phone', 'tp', { inputMode: 'tel', placeholder: '98765 43210' })}</Field>
            <Field label="Email" id="te" hint="Optional">{input('email', 'te', { type: 'email' })}</Field>
            <Field label="Date of birth" id="td" hint="Optional">{input('dateOfBirth', 'td', { type: 'date', max: today() })}</Field>
            <Field label="Occupation" id="to" hint="Optional">{input('occupation', 'to', { placeholder: 'Software engineer' })}</Field>
          </div>
          <Field label="Employer or college" id="tw" hint="Optional">{input('employer', 'tw')}</Field>
          <Field label="Permanent address" id="ta" hint="Optional">
            <textarea id="ta" className="input" rows={2} value={f.permanentAddress} onChange={set('permanentAddress')} />
          </Field>

          <div className="eyebrow">ID proof</div>
          <div className="grid2">
            <Field label="ID type" id="ti"><div className="input"><select id="ti" value={f.idType} onChange={set('idType')}>
              <option value="">None</option>
              {(Object.entries(ID_TYPES) as [IdType, string][]).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></div></Field>
            <Field label="ID number" id="tx">{input('idNumber', 'tx', { disabled: !f.idType, placeholder: f.idType === 'AADHAAR' ? '1234 5678 9012' : f.idType === 'PAN' ? 'ABCDE1234F' : '', autoComplete: 'off' })}</Field>
          </div>

          <div className="eyebrow">Emergency contact</div>
          <div className="grid2">
            <Field label="Name" id="en" hint="Optional">{input('emergencyName', 'en')}</Field>
            <Field label="Relation" id="er" hint="Optional">{input('emergencyRelation', 'er', { placeholder: 'Father' })}</Field>
          </div>
          <Field label="Mobile" id="ep" hint="Optional">{input('emergencyPhone', 'ep', { inputMode: 'tel' })}</Field>

          <div className="eyebrow">Lease</div>
          <div className="grid2">
            <Field label="Move-in date" id="ms">{input('startDate', 'ms', { type: 'date' })}</Field>
            <Field label="Lease length (months)" id="mm">{input('months', 'mm', { inputMode: 'numeric' }, true)}</Field>
            <Field label="Rent / month (₹)" id="mr">{input('rent', 'mr', { inputMode: 'numeric' }, true)}</Field>
            <Field label="Deposit (₹)" id="md">{input('deposit', 'md', { inputMode: 'numeric' }, true)}</Field>
          </div>
          <Field label="People living in the unit" id="mo">{input('occupants', 'mo', { inputMode: 'numeric' }, true)}</Field>

          <div className="field">
            <label>Co-tenants on the lease</label>
            {coTenants.map((n, i) => (
              <div key={i} className="row" style={{ gap: 6 }}>
                <div className="input"><input aria-label={`Co-tenant ${i + 1} name`} value={n} placeholder="Full name"
                  onChange={e => setCoTenants(c => c.map((x, j) => (j === i ? e.target.value : x)))} /></div>
                <button type="button" className="icon-btn" aria-label={`Remove co-tenant ${i + 1}`} onClick={() => setCoTenants(c => c.filter((_, j) => j !== i))}><Icon name="x" size={16} /></button>
              </div>
            ))}
            {coTenants.length < 4 && (
              <button type="button" className="btn btn-line btn-sm" style={{ alignSelf: 'flex-start' }}
                onClick={() => { setCoTenants(c => [...c, '']); setF(prev => ({ ...prev, occupants: String(Math.max(Number(prev.occupants) || 1, coTenants.length + 2)) })); }}>
                <Icon name="plus" size={15} />Add co-tenant</button>
            )}
          </div>
          <div className="eyebrow">Documents</div>
          <FilePick id="fa" label="Rental agreement" hint="Signed agreement as a PDF or photos of each page." files={agreement} onChange={setAgreement} />
          <FilePick id="fi" label="Aadhaar card" hint="Front and back, as photos or a PDF." files={aadhaar} onChange={setAadhaar} />

          <Field label="Notes" id="mn" hint="Optional. Only you and your managers see this.">
            <textarea id="mn" className="input" rows={2} placeholder="Pets, parking slot, police verification status…" value={f.notes} onChange={set('notes')} />
          </Field>

          {err && <div className="err" role="alert">{err}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? (agreement.length + aadhaar.length ? 'Adding and uploading…' : 'Adding…') : 'Add tenant & create lease'}</button>
        </form>
        )
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

/** Checks a file before upload; returns a message when it can't be used. */
export function fileProblem(file: File): string | null {
  if (!(DOCUMENT_TYPES as readonly string[]).includes(file.type)) return `${file.name} isn’t a PDF or photo (JPG, PNG, WebP).`;
  if (file.size > DOCUMENT_MAX_BYTES) return `${file.name} is ${formatBytes(file.size)}. The limit is ${formatBytes(DOCUMENT_MAX_BYTES)}.`;
  return null;
}

/** Lets the owner pick one or more files and shows them before they are uploaded. */
export function FilePick({ id, label, hint, files, onChange, max = 5 }: { id: string; label: string; hint?: string; files: File[]; onChange: (f: File[]) => void; max?: number }) {
  const [problem, setProblem] = useState('');
  const add = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    const bad = picked.map(fileProblem).filter(Boolean);
    const good = picked.filter(f => !fileProblem(f));
    const next = [...files, ...good].slice(0, max);
    setProblem([...bad, files.length + good.length > max ? `Up to ${max} files here.` : ''].filter(Boolean).join(' '));
    onChange(next);
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} className="row" style={{ gap: 8 }}>
          <Icon name="file" size={16} />
          <span className="grow ell sm">{f.name}</span>
          <span className="muted sm">{formatBytes(f.size)}</span>
          <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
        </div>
      ))}
      {files.length < max && (
        <label className="btn btn-line btn-sm" style={{ alignSelf: 'flex-start', cursor: 'pointer' }}>
          <Icon name="plus" size={15} />{files.length ? 'Add another file' : 'Choose file'}
          <input id={id} type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only"
            onChange={e => { add(e.target.files); e.target.value = ''; }} />
        </label>
      )}
      {problem ? <span className="err sm">{problem}</span> : hint && <span className="hint">{hint}</span>}
    </div>
  );
}
