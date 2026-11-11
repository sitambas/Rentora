'use client';
import Link from 'next/link';
import { useState } from 'react';
import { formatDate, formatINR, type Unit } from '@rentora/shared';
import { useQuery } from '@/lib/hooks';
import { PageHead } from '@/components/Shell';
import { Avatar, ErrorCard, Icon, InvoicePill, Skeleton } from '@/components/ui';

export default function Tenants() {
  const q = useQuery<Unit[]>('/units?status=OCCUPIED');
  const [search, setSearch] = useState('');
  if (q.error && !q.data) return <ErrorCard message={q.error} onRetry={q.reload} />;
  const s = search.trim().toLowerCase();
  const list = (q.data ?? []).filter(u => !s || [u.lease?.tenant.name, ...(u.lease?.coTenantNames ?? []), u.name, u.property.name, u.lease?.tenant.phone].join(' ').toLowerCase().includes(s));
  const late = list.filter(u => u.openInvoice?.status === 'OVERDUE').length;

  return (
    <>
      <PageHead title="Tenants" sub={q.data && `${q.data.length} active lease${q.data.length === 1 ? '' : 's'}${late ? ` · ${late} late` : ''}`} />
      <div className="search"><Icon name="search" /><input type="search" placeholder="Search by name, unit or phone" aria-label="Search tenants" value={search} onChange={e => setSearch(e.target.value)} /></div>
      {!q.data ? <Skeleton h={300} /> : list.length === 0 ? <div className="card empty">{q.data.length ? 'No tenants match your search.' : 'No active leases yet. Add a tenant from a vacant unit on the Properties page.'}</div> : (
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
                  </div>
                  {u.openInvoice ? <InvoicePill inv={u.openInvoice} /> : <span className="pill dot p-good">Current</span>}
                  <Link className="icon-btn" href={`/owner/messages?with=${l.tenant.id}`} aria-label={`Message ${l.tenant.name}`}><Icon name="chat" size={17} /></Link>
                  <a className="icon-btn" href={`tel:+91${l.tenant.phone}`} aria-label={`Call ${l.tenant.name} on ${l.tenant.phone}`} title={l.tenant.phone}><Icon name="phone" size={17} /></a>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
