'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { homeFor, useAuth } from '@/lib/auth';
import { Icon, LogoMark } from '@/components/ui';

// Accounts created by `npm run db:seed`; shown only in development builds.
const DEMO = process.env.NODE_ENV !== 'production'
  ? [{ label: 'Owner (Alex S.)', phone: '9876500001' }, { label: 'Manager (Priya N.)', phone: '9876500002' }, { label: 'Tenant (Unit 304)', phone: '9876500010' }]
  : [];

export default function Login() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) router.replace(homeFor(user.role)); }, [user, router]);

  async function submit(e: FormEvent, creds?: { phone: string; password: string }) {
    e.preventDefault();
    const c = creds ?? { phone, password };
    if (!c.phone.trim() || !c.password) { setError('Enter your mobile number and password.'); return; }
    setBusy(true); setError('');
    try {
      const u = await login(c.phone, c.password);
      router.replace(homeFor(u.role));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="stack" style={{ alignItems: 'center', gap: 8, textAlign: 'center' }}>
          <div className="row" style={{ font: '800 26px var(--f-display)', letterSpacing: '-.02em' }}><LogoMark size={44} />Rentora</div>
          <div className="muted">Rent management for owners, managers and tenants</div>
        </div>
        <div className="field">
          <label htmlFor="phone">Mobile number</label>
          <div className="input"><Icon name="phone" size={17} /><input id="phone" inputMode="tel" autoComplete="username" placeholder="98765 43210" value={phone} onChange={e => setPhone(e.target.value)} /></div>
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="input"><Icon name="lock" size={17} />
            <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} />
            <button type="button" className="muted" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}><Icon name="eye" /></button>
          </div>
        </div>
        {error && <div className="err" role="alert">{error}</div>}
        <button className="btn btn-primary btn-block" style={{ height: 48 }} disabled={busy}>{busy ? 'Signing in…' : <>Sign in <Icon name="arrow" size={17} /></>}</button>
        <div className="muted sm" style={{ textAlign: 'center' }}>Tenants get their login from their landlord or manager.</div>
        {DEMO.length > 0 && <>
          <div className="divider">DEMO ACCOUNTS · PASSWORD demo1234</div>
          <div className="row wrap" style={{ justifyContent: 'center', gap: 8 }}>
            {DEMO.map(d => (
              <button key={d.phone} type="button" className="demo-chip" disabled={busy}
                onClick={e => { setPhone(d.phone); setPassword('demo1234'); submit(e, { phone: d.phone, password: 'demo1234' }); }}>{d.label}</button>
            ))}
          </div>
        </>}
        <div className="row" style={{ justifyContent: 'center', gap: 6 }}>
          <span className="muted">Own or manage property?</span><Link href="/signup" className="link">Create an account</Link>
        </div>
      </form>
    </div>
  );
}
