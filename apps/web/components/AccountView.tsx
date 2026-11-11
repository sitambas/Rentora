'use client';
import { useEffect, useState, type FormEvent } from 'react';
import type { User } from '@rentora/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAction } from '@/lib/hooks';
import { PageHead } from './Shell';
import { Avatar, Field, Icon, useToast } from './ui';

const ROLE = { OWNER: 'Owner', MANAGER: 'Property manager', TENANT: 'Tenant' } as const;
const THEME_KEY = 'rentora.theme';

export function AccountView() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const profile = useAction();
  const pw = useAction();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [theme, setTheme] = useState('');

  useEffect(() => { try { setTheme(localStorage.getItem(THEME_KEY) ?? ''); } catch { /* ignore */ } }, []);
  const changeTheme = (v: string) => {
    setTheme(v);
    if (v) document.documentElement.dataset.theme = v; else delete document.documentElement.dataset.theme;
    try { v ? localStorage.setItem(THEME_KEY, v) : localStorage.removeItem(THEME_KEY); } catch { /* ignore */ }
  };

  if (!user) return null;

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    profile.run(async () => {
      const u = await api<User>('/auth/me', { method: 'PATCH', body: { name, email: email || null } });
      setUser(u); toast('Profile saved');
    }, m => toast(m, 'bad'));
  };
  const savePassword = (e: FormEvent) => {
    e.preventDefault();
    setPwErr('');
    pw.run(async () => {
      await api('/auth/password', { body: { current, next } });
      setCurrent(''); setNext(''); toast('Password changed');
    }, setPwErr);
  };

  return (
    <>
      <PageHead title="Account" />
      <div className="card row"><Avatar name={user.name} size={56} /><div className="grow"><div className="h2">{user.name}</div><div className="muted">{ROLE[user.role]} · {user.phone}</div></div></div>
      <div className="dash">
        <form className="card" onSubmit={saveProfile}>
          <b className="h3">Profile</b>
          <Field label="Full name" id="an"><div className="input"><input id="an" value={name} onChange={e => setName(e.target.value)} /></div></Field>
          <Field label="Email" id="ae"><div className="input"><input id="ae" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div></Field>
          <Field label="Mobile number" id="ap" hint="Contact your property manager to change your number."><div className="input"><input id="ap" value={user.phone} disabled /></div></Field>
          <button className="btn btn-primary" disabled={profile.busy}>Save profile</button>
        </form>
        <div className="stack">
          <form className="card" onSubmit={savePassword}>
            <b className="h3">Change password</b>
            <Field label="Current password" id="pc"><div className="input"><input id="pc" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} /></div></Field>
            <Field label="New password" id="pn" hint="At least 8 characters."><div className="input"><input id="pn" type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} /></div></Field>
            {pwErr && <div className="err">{pwErr}</div>}
            <button className="btn btn-line" disabled={pw.busy || !current || !next}>Change password</button>
          </form>
          <div className="card">
            <div className="row between"><b className="h3">Appearance</b>
              <div className="input" style={{ width: 'auto', minHeight: 36 }}><select aria-label="Appearance" value={theme} onChange={e => changeTheme(e.target.value)} style={{ height: 34 }}>
                <option value="">Match system</option><option value="light">Light</option><option value="dark">Dark</option></select></div></div>
          </div>
          <button className="btn btn-danger" onClick={logout}><Icon name="logout" size={17} />Sign out</button>
        </div>
      </div>
    </>
  );
}
