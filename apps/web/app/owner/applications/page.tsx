'use client';
import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatINR, timeAgo, type Application, type Unit } from '@rentora/shared';
import { api } from '@/lib/api';
import { useAction, useQuery } from '@/lib/hooks';
import { PageHead } from '@/components/Shell';
import { TempPasswordNote } from '@/components/StaffSheets';
import { Avatar, ErrorCard, Field, Icon, Sheet, Skeleton, useToast } from '@/components/ui';

const scoreTone = (s: number) => (s >= 750 ? 'p-good' : s >= 700 ? 'p-info' : s >= 650 ? 'p-warn' : 'p-bad');

function Applications() {
  const unitId = useSearchParams().get('unitId');
  const toast = useToast();
  const q = useQuery<Application[]>(`/applications${unitId ? `?unitId=${unitId}` : ''}`);
  const { busy, run } = useAction();
  const [approved, setApproved] = useState<{ phone: string; password: string; name: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<Application | null>(null);

  const approve = (a: Application) => run(async () => {
    const r = await api<{ tempPassword: string | null }>(`/applications/${a.id}/approve`, { body: {} });
    setConfirm(null);
    toast(`${a.name} approved for ${a.unit.name}`);
    if (r.tempPassword) setApproved({ phone: a.phone, password: r.tempPassword, name: a.name });
    q.reload();
  }, m => toast(m, 'bad'));
  const reject = (a: Application) => run(async () => {
    await api(`/applications/${a.id}/reject`, { method: 'POST' });
    toast(`${a.name}’s application declined`); q.reload();
  }, m => toast(m, 'bad'));

  const byUnit = new Map<string, Application[]>();
  for (const a of q.data ?? []) byUnit.set(`${a.property.name} · ${a.unit.name}`, [...(byUnit.get(`${a.property.name} · ${a.unit.name}`) ?? []), a]);

  return (
    <>
      <PageHead title="Applications" sub="Screen applicants for vacant units"
        action={<button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Icon name="plus" size={15} />Add applicant</button>} />
      {q.error && !q.data ? <ErrorCard message={q.error} onRetry={q.reload} /> : !q.data ? <Skeleton h={240} /> : q.data.length === 0 ? (
        <div className="card empty">No pending applications. Add walk-in applicants for any vacant unit.</div>
      ) : [...byUnit].map(([label, apps]) => (
        <div className="card" key={label}>
          <div className="row between"><b className="h3">{label}</b><span className="muted sm">{apps.length} pending</span></div>
          <div className="list">
            {apps.map(a => (
              <div className="li wrap" key={a.id}>
                <Avatar name={a.name} />
                <div className="grow"><b>{a.name}</b><div className="muted sm">{a.phone} · income {formatINR(a.monthlyIncome)}/mo · applied {timeAgo(a.createdAt)}</div></div>
                <span className={`pill ${scoreTone(a.creditScore)}`}>Credit {a.creditScore}</span>
                <div className="row">
                  <button className="btn btn-line btn-sm" disabled={busy} onClick={() => reject(a)}>Decline</button>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => setConfirm(a)}>Approve</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {confirm && (
        <Sheet title={`Approve ${confirm.name}?`} onClose={() => setConfirm(null)}>
          <p className="muted" style={{ margin: 0 }}>This creates an 11-month lease for {confirm.unit.name} starting today, bills the first month and declines the other applicants for this unit.</p>
          <div className="row"><button className="btn btn-line grow" onClick={() => setConfirm(null)}>Cancel</button><button className="btn btn-primary grow" disabled={busy} onClick={() => approve(confirm)}>Approve and create lease</button></div>
        </Sheet>
      )}
      {approved && (
        <Sheet title={`${approved.name} is moving in`} onClose={() => setApproved(null)}>
          <TempPasswordNote phone={approved.phone} password={approved.password} />
          <button className="btn btn-primary" onClick={() => setApproved(null)}>Done</button>
        </Sheet>
      )}
      {adding && <AddApplicant unitId={unitId} onClose={() => setAdding(false)} onDone={q.reload} />}
    </>
  );
}

function AddApplicant({ unitId, onClose, onDone }: { unitId: string | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const units = useQuery<Unit[]>('/units?status=VACANT');
  const { busy, run } = useAction();
  const [f, setF] = useState({ unitId: unitId ?? '', name: '', phone: '', creditScore: '', monthlyIncome: '' });
  const [err, setErr] = useState('');
  const uid = f.unitId || units.data?.[0]?.id || '';
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => { await api('/applications', { body: { ...f, unitId: uid } }); toast(`${f.name} added`); onDone(); onClose(); }, setErr);
  };
  return (
    <Sheet title="Add applicant" onClose={onClose}>
      {!units.data ? <Skeleton /> : units.data.length === 0 ? <div className="empty">You have no vacant units right now.</div> : (
        <form className="stack" onSubmit={submit}>
          <Field label="Unit" id="au"><div className="input"><select id="au" value={uid} onChange={set('unitId')}>
            {units.data.map(u => <option key={u.id} value={u.id}>{u.property.name} · {u.name}</option>)}</select></div></Field>
          <Field label="Full name" id="an"><div className="input"><input id="an" value={f.name} onChange={set('name')} /></div></Field>
          <Field label="Mobile" id="ap"><div className="input"><input id="ap" inputMode="tel" value={f.phone} onChange={set('phone')} /></div></Field>
          <div className="grid2">
            <Field label="Credit score" id="ac" hint="300–900"><div className="input"><input id="ac" inputMode="numeric" value={f.creditScore} onChange={set('creditScore')} /></div></Field>
            <Field label="Monthly income (₹)" id="ai"><div className="input"><input id="ai" inputMode="numeric" value={f.monthlyIncome} onChange={set('monthlyIncome')} /></div></Field>
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>Add applicant</button>
        </form>
      )}
    </Sheet>
  );
}

export default function Page() {
  return <Suspense fallback={<Skeleton h={240} />}><Applications /></Suspense>;
}
