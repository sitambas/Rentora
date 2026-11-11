'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { homeFor, useAuth } from '@/lib/auth';
import { Field, Icon, LogoMark } from '@/components/ui';

export default function Signup() {
  const { register } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<'OWNER' | 'MANAGER'>('OWNER');
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const u = await register({ ...f, email: f.email || undefined, role });
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
        <div className="row" style={{ font: '800 22px var(--f-display)' }}><LogoMark size={36} />Create your account</div>
        <div className="seg" role="group" aria-label="Account type">
          <button type="button" aria-pressed={role === 'OWNER'} onClick={() => setRole('OWNER')}><Icon name="building" size={15} />I own property</button>
          <button type="button" aria-pressed={role === 'MANAGER'} onClick={() => setRole('MANAGER')}><Icon name="users" size={15} />I manage property</button>
        </div>
        <Field label="Full name" id="name"><div className="input"><input id="name" autoComplete="name" value={f.name} onChange={set('name')} /></div></Field>
        <Field label="Mobile number" id="phone"><div className="input"><input id="phone" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={f.phone} onChange={set('phone')} /></div></Field>
        <Field label="Email (optional)" id="email"><div className="input"><input id="email" type="email" autoComplete="email" value={f.email} onChange={set('email')} /></div></Field>
        <Field label="Password" id="password" hint="At least 8 characters."><div className="input"><input id="password" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} /></div></Field>
        {role === 'MANAGER' && <div className="hint">After you sign up, give your mobile number to the owner so they can assign you to their properties.</div>}
        {error && <div className="err" role="alert">{error}</div>}
        <button className="btn btn-primary btn-block" style={{ height: 48 }} disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <div className="row" style={{ justifyContent: 'center', gap: 6 }}><span className="muted">Already have an account?</span><Link href="/login" className="link">Sign in</Link></div>
      </form>
    </div>
  );
}
