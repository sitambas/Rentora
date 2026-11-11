'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatDate, formatINR, type Property, type Unit } from '@rentora/shared';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@/lib/hooks';
import { PageHead } from '@/components/Shell';
import { AddPropertySheet, AddUnitSheet, MoveInSheet } from '@/components/StaffSheets';
import { Avatar, BuildingArt, ErrorCard, Icon, InvoicePill, Skeleton } from '@/components/ui';

type Filter = 'ALL' | 'OCCUPIED' | 'VACANT' | 'OVERDUE';
const rank = (u: Unit) => (u.openInvoice?.status === 'OVERDUE' ? 0 : u.status === 'VACANT' ? 1 : u.openInvoice ? 2 : 3);

export default function Properties() {
  const { user } = useAuth();
  const props = useQuery<Property[]>('/properties');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const units = useQuery<Unit[]>(`/units${debounced ? `?q=${encodeURIComponent(debounced)}` : ''}`);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [propertyId, setPropertyId] = useState('');
  const [urgent, setUrgent] = useState(true);
  const [sheet, setSheet] = useState<'property' | 'unit' | null>(null);
  const [moveIn, setMoveIn] = useState<Unit | null>(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 250); return () => clearTimeout(t); }, [q]);

  const all = units.data ?? [];
  const inProp = propertyId ? all.filter(u => u.property.id === propertyId) : all;
  const counts = {
    ALL: inProp.length,
    OCCUPIED: inProp.filter(u => u.status === 'OCCUPIED').length,
    VACANT: inProp.filter(u => u.status === 'VACANT').length,
    OVERDUE: inProp.filter(u => u.openInvoice?.status === 'OVERDUE').length
  };
  const list = useMemo(() => {
    let l = inProp.filter(u => filter === 'ALL' || (filter === 'OVERDUE' ? u.openInvoice?.status === 'OVERDUE' : u.status === filter));
    if (urgent) l = [...l].sort((a, b) => rank(a) - rank(b));
    return l;
  }, [inProp, filter, urgent]);

  const occupied = inProp.filter(u => u.status === 'OCCUPIED');
  const avg = occupied.reduce((a, u) => a + u.rent, 0) / Math.max(1, occupied.length);
  const reload = () => { props.reload(); units.reload(); };

  return (
    <>
      <PageHead title="Properties" sub={props.data && `${props.data.length} properties · ${all.length} units`}
        action={<div className="row">
          {user?.role === 'OWNER' && <button className="btn btn-line btn-sm" onClick={() => setSheet('property')}><Icon name="building" size={15} />Add property</button>}
          <button className="btn btn-primary btn-sm" onClick={() => setSheet('unit')}><Icon name="plus" size={15} />Add unit</button>
        </div>} />

      {props.data && props.data.length > 1 && (
        <div className="chips" role="group" aria-label="Property">
          <button className="chip" aria-pressed={!propertyId} onClick={() => setPropertyId('')}>All properties</button>
          {props.data.map(p => (
            <button key={p.id} className="chip" aria-pressed={propertyId === p.id} onClick={() => setPropertyId(p.id)}>{p.name}<span>{p.unitCount}</span></button>
          ))}
        </div>
      )}

      <div className="search"><Icon name="search" /><input type="search" placeholder="Search property, unit or tenant" aria-label="Search units" value={q} onChange={e => setQ(e.target.value)} /></div>
      <div className="chips" role="group" aria-label="Status">
        {([['ALL', 'All units'], ['OCCUPIED', 'Occupied'], ['VACANT', 'Vacant'], ['OVERDUE', 'Overdue']] as const).map(([k, l]) => (
          <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}<span>{counts[k]}</span></button>
        ))}
      </div>

      {units.error && !units.data ? <ErrorCard message={units.error} onRetry={units.reload} /> : !units.data ? <><Skeleton h={110} /><Skeleton h={200} /></> : <>
        <div className="card">
          <div className="row between"><b className="h3">Portfolio health</b>
            <span className={`pill dot ${counts.OVERDUE ? 'p-warn' : 'p-good'}`}>{counts.OVERDUE ? `${counts.OVERDUE} overdue` : 'All rent current'}</span></div>
          <div className="stat3">
            <div><b className="num">{inProp.length}</b><small>Total units</small></div>
            <div><b className="num" style={{ color: 'var(--brand)' }}>{inProp.length ? ((counts.OCCUPIED / inProp.length) * 100).toFixed(1) : 0}%</b><small>Occupancy</small></div>
            <div><b className="num" style={{ color: 'var(--brand)' }}>{formatINR(avg)}</b><small>Avg rent / mo</small></div>
          </div>
        </div>

        <div className="row between">
          <div><div className="h2">Units & leases</div><div className="muted sm">Showing {list.length} of {inProp.length}</div></div>
          <button className="link sm" onClick={() => setUrgent(u => !u)}>{urgent ? 'Sorted by urgency' : 'Sort by urgency'}</button>
        </div>

        {list.length === 0 ? (
          <div className="card empty">{all.length === 0 && !debounced ? 'No units yet. Add your first unit to start tracking rent.' : `No units match${debounced ? ` “${debounced}”` : ''}.`}</div>
        ) : (
          <div className="grid-cards">{list.map(u => <UnitCard key={u.id} u={u} onMoveIn={() => setMoveIn(u)} />)}</div>
        )}
      </>}

      {sheet === 'property' && <AddPropertySheet onClose={() => setSheet(null)} onDone={reload} />}
      {sheet === 'unit' && <AddUnitSheet propertyId={propertyId || undefined} onClose={() => setSheet(null)} onDone={reload} />}
      {moveIn && <MoveInSheet unit={moveIn} onClose={() => setMoveIn(null)} onDone={reload} />}
    </>
  );
}

function UnitCard({ u, onMoveIn }: { u: Unit; onMoveIn: () => void }) {
  const inv = u.openInvoice;
  const lease = u.lease;
  return (
    <div className="card">
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div><div className="eyebrow row" style={{ gap: 5 }}><Icon name="building" size={12} />{u.property.name}</div><Link href={`/owner/units/${u.id}`} className="h2">{u.name}</Link></div>
        {u.status === 'VACANT' ? <span className="pill dot p-info">Vacant</span> : inv ? <InvoicePill inv={inv} /> : <span className="pill dot p-good">Paid</span>}
      </div>
      <div className="unit-body">
        <div className="thumb"><BuildingArt seed={u.property.id} /></div>
        {lease ? (
          <div className="grow">
            <div className="row" style={{ gap: 6 }}><Avatar name={lease.tenant.name} size={24} /><b className="h3 ell">{[lease.tenant.name, ...lease.coTenantNames].join(' & ')}</b></div>
            <div className="muted sm">{lease.coTenantNames.length ? 'Co-tenants' : 'Leaseholder'} · ends {formatDate(lease.endDate)}</div>
            {inv?.remindedAt && inv.status !== 'PAID' && <div className="sm" style={{ color: 'var(--warn)' }}>Reminder sent {formatDate(inv.remindedAt, { day: 'numeric', month: 'short' })}</div>}
          </div>
        ) : (
          <div className="grow"><b className="h3">{u.pendingApplications ? `${u.pendingApplications} pending application${u.pendingApplications === 1 ? '' : 's'}` : 'No applications yet'}</b>
            <div className="muted sm">Ready to let · deposit {formatINR(u.deposit)}</div></div>
        )}
      </div>
      <div className="row between">
        <div>
          <div className="eyebrow" style={inv?.status === 'OVERDUE' ? { color: 'var(--bad)' } : undefined}>{u.status === 'VACANT' ? 'Target rent' : inv ? 'Balance due' : 'Current rent'}</div>
          <div className="mid num" style={{ fontSize: 18 }}>{formatINR(inv?.amount ?? u.rent)}<span className="muted sm" style={{ fontWeight: 500 }}> /mo</span></div>
        </div>
        {u.status === 'VACANT' ? (
          u.pendingApplications ? <Link className="btn btn-primary btn-sm" href={`/owner/applications?unitId=${u.id}`}><Icon name="users" size={15} />Review ({u.pendingApplications})</Link>
            : <button className="btn btn-primary btn-sm" onClick={onMoveIn}><Icon name="plus" size={15} />Add tenant</button>
        ) : <Link className="btn btn-soft btn-sm" href={`/owner/units/${u.id}`}><Icon name="file" size={15} />Lease & ledger</Link>}
      </div>
    </div>
  );
}
