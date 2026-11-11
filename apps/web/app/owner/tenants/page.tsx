'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { ID_TYPES, formatDate, formatINR, type Unit } from '@rentora/shared';
import { useQuery } from '@/lib/hooks';
import { PageHead } from '@/components/Shell';
import { MoveInSheet } from '@/components/StaffSheets';
import { Avatar, ErrorCard, Icon, InvoicePill, Sheet, Skeleton, useToast } from '@/components/ui';

export default function Tenants() {
  const q = useQuery<Unit[]>('/units?status=OCCUPIED');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState<Unit | null>(null);
  if (q.error && !q.data) return <ErrorCard message={q.error} onRetry={q.reload} />;
  const s = search.trim().toLowerCase();
  const list = (q.data ?? []).filter(u => !s || [u.lease?.tenant.name, ...(u.lease?.coTenantNames ?? []), u.name, u.property.name, u.lease?.tenant.phone].join(' ').toLowerCase().includes(s));
  const late = list.filter(u => u.openInvoice?.status === 'OVERDUE').length;

  return (
    <>
      <PageHead title="Tenants" sub={q.data && `${q.data.length} active lease${q.data.length === 1 ? '' : 's'}${late ? ` · ${late} late` : ''}`}
        action={<button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Icon name="plus" size={15} />Add tenant</button>} />
      <div className="search"><Icon name="search" /><input type="search" placeholder="Search by name, unit or phone" aria-label="Search tenants" value={search} onChange={e => setSearch(e.target.value)} /></div>
      {!q.data ? <Skeleton h={300} /> : list.length === 0 ? <div className="card empty">{q.data.length ? 'No tenants match your search.' : 'No tenants yet. Choose Add tenant to move someone into a vacant unit.'}</div> : (
        <div className="card">
          <div className="list">
            {list.map(u => {
              const l = u.lease!;
              return (
                <div className="li" key={u.id}>
                  <Avatar name={l.tenant.name} />
                  <div className="grow">
                    <Link href={`/owner/units/${u.id}`} className="h3 ell" style={{ display: 'block', fontSize: 14 }}>{[l.tenant.name, ...l.coTenantNames].join(' & ')}</Link>
                    <div className="muted sm ell">{u.name} · {u.property.name} · {formatINR(l.rent)}/mo · until {formatDate(l.endDate, { month: 'short', year: 'numeric' })}</div>
                    {(l.tenantDetails.occupation || l.tenantDetails.idType) && <div className="muted sm ell">{[l.tenantDetails.occupation, l.tenantDetails.idType && `${ID_TYPES[l.tenantDetails.idType]} ${l.tenantDetails.idNumber ?? ''}`.trim()].filter(Boolean).join(' · ')}</div>}
                  </div>
                  {!l.tenant.loginEnabled ? <span className="pill p-muted" title="This tenant can’t sign in">Login off</span>
                    : u.openInvoice ? <InvoicePill inv={u.openInvoice} /> : <span className="pill dot p-good">Current</span>}
                  <Link className="icon-btn wide-only" href={`/owner/messages?with=${l.tenant.id}`} aria-label={`Message ${l.tenant.name}`}><Icon name="chat" size={17} /></Link>
                  <a className="icon-btn wide-only" href={`tel:+91${l.tenant.phone}`} aria-label={`Call ${l.tenant.name} on ${l.tenant.phone}`} title={l.tenant.phone}><Icon name="phone" size={17} /></a>
                  <button className="icon-btn" onClick={() => setManaging(u)} aria-label={`Manage ${l.tenant.name}`} title="Manage tenant"><Icon name="more" size={18} /></button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {adding && <MoveInSheet onClose={() => setAdding(false)} onDone={q.reload} />}
      {managing && <ManageTenantSheet unit={managing} onClose={() => setManaging(null)} onDone={q.reload} />}
    </>
  );
}

function ManageTenantSheet({ unit, onClose, onDone }: { unit: Unit; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { busy, run } = useAction();
  const [confirm, setConfirm] = useState<'login' | 'remove' | null>(null);
  const [err, setErr] = useState('');
  const lease = unit.lease!;
  const t = lease.tenant;
  const due = unit.openInvoice && unit.openInvoice.status !== 'PAID' ? unit.openInvoice : null;

  const setLogin = (enabled: boolean) => run(async () => {
    await api(`/leases/${lease.id}/login`, { body: { enabled } });
    toast(enabled ? `${t.name} can sign in again` : `${t.name} can no longer sign in`);
    onDone(); onClose();
  }, setErr);
  const remove = () => run(async () => {
    await api(`/leases/${lease.id}/end`, { body: { disableLogin: true } });
    toast(`${t.name} removed. ${unit.name} is now vacant.`);
    onDone(); onClose();
  }, setErr);

  return (
    <Sheet title={t.name} onClose={onClose}>
      <div className="muted" style={{ marginTop: -8 }}>{unit.name} · {unit.property.name} · {t.phone}</div>

      {confirm === 'remove' ? (
        <>
          <div className="alert">
            <b>Remove {t.name} from {unit.name}?</b>
            <ul className="muted" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
              <li>The lease ends today and {unit.name} becomes vacant.</li>
              <li>{t.name} can no longer sign in.</li>
              <li>Payment history stays on record{due ? `, including the unpaid ${formatINR(due.amount)} bill` : ''}.</li>
            </ul>
          </div>
          {err && <div className="err" role="alert">{err}</div>}
          <div className="row"><button className="btn btn-line grow" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="btn btn-danger grow" disabled={busy} onClick={remove}>{busy ? 'Removing…' : 'Remove tenant'}</button></div>
        </>
      ) : confirm === 'login' ? (
        <>
          <div className="alert warn">
            <b>Turn off {t.name}’s login?</b>
            <span className="muted">They’ll be signed out everywhere and can’t pay rent or raise requests in Rentora. Their lease and bills stay as they are, and you can turn it back on any time.</span>
          </div>
          {err && <div className="err" role="alert">{err}</div>}
          <div className="row"><button className="btn btn-line grow" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="btn btn-danger grow" disabled={busy} onClick={() => setLogin(false)}>{busy ? 'Turning off…' : 'Turn off login'}</button></div>
        </>
      ) : (
        <div className="list">
          <Link className="li" href={`/owner/units/${unit.id}`}><Icon name="file" /><div className="grow"><b>Lease, details & ledger</b></div><Icon name="arrow" size={16} /></Link>
          <Link className="li" href={`/owner/messages?with=${t.id}`}><Icon name="chat" /><div className="grow"><b>Message</b></div><Icon name="arrow" size={16} /></Link>
          <a className="li" href={`tel:+91${t.phone}`}><Icon name="phone" /><div className="grow"><b>Call</b><div className="muted sm">{t.phone}</div></div></a>
          {t.loginEnabled ? (
            <button className="li" onClick={() => setConfirm('login')}><Icon name="lock" />
              <div className="grow"><b>Turn off login</b><div className="muted sm">Keep the lease, stop them signing in.</div></div></button>
          ) : (
            <button className="li" disabled={busy} onClick={() => setLogin(true)}><Icon name="check" />
              <div className="grow"><b>Turn login back on</b><div className="muted sm">Their login is off. They can sign in with their existing password.</div></div></button>
          )}
          <button className="li" style={{ color: 'var(--bad)' }} onClick={() => setConfirm('remove')}><Icon name="logout" />
            <div className="grow"><b>Remove tenant</b><div className="muted sm">End the lease, free the unit and turn off login.</div></div></button>
          {err && <div className="err" role="alert">{err}</div>}
        </div>
      )}
    </Sheet>
  );
}
