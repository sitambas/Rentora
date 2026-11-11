'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { timeAgo, type Notification, type Role } from '@rentora/shared';
import { useAuth, homeFor } from '@/lib/auth';
import { useQuery } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Avatar, Icon, LogoMark, Sheet, Skeleton, type IconName } from './ui';

interface NavItem { href: string; label: string; icon: IconName; mobile?: boolean }

const STAFF_NAV: NavItem[] = [
  { href: '/owner', label: 'Overview', icon: 'home', mobile: true },
  { href: '/owner/properties', label: 'Properties', icon: 'building', mobile: true },
  { href: '/owner/tenants', label: 'Tenants', icon: 'users', mobile: true },
  { href: '/owner/payments', label: 'Payments', icon: 'card', mobile: true },
  { href: '/owner/maintenance', label: 'Maintenance', icon: 'wrench' },
  { href: '/owner/applications', label: 'Applications', icon: 'clipboard' },
  { href: '/owner/messages', label: 'Messages', icon: 'chat' },
  { href: '/owner/community', label: 'Notices & parcels', icon: 'megaphone' },
  { href: '/owner/account', label: 'Account', icon: 'user', mobile: true }
];
const TENANT_NAV: NavItem[] = [
  { href: '/tenant', label: 'Home', icon: 'home', mobile: true },
  { href: '/tenant/payments', label: 'Payments', icon: 'card', mobile: true },
  { href: '/tenant/requests', label: 'Requests', icon: 'wrench', mobile: true },
  { href: '/tenant/messages', label: 'Messages', icon: 'chat', mobile: true },
  { href: '/tenant/account', label: 'Account', icon: 'user', mobile: true }
];

const ROLE_LABEL: Record<Role, string> = { OWNER: 'Owner', MANAGER: 'Manager', TENANT: 'Tenant' };

export function Shell({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [showNotes, setShowNotes] = useState(false);
  const notes = useQuery<Notification[]>(user ? '/notifications' : null, { pollMs: 30000 });

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (!allow.includes(user.role)) router.replace(homeFor(user.role));
  }, [user, loading, allow, router]);

  if (loading || !user || !allow.includes(user.role)) {
    return <div className="main"><Skeleton h={60} /><Skeleton h={200} /></div>;
  }

  const nav = user.role === 'TENANT' ? TENANT_NAV : STAFF_NAV;
  const active = (href: string) => href === path || (href !== '/owner' && href !== '/tenant' && path.startsWith(href + '/'));
  const current = [...nav].sort((a, b) => b.href.length - a.href.length).find(n => path === n.href || path.startsWith(n.href + '/'));
  const unread = notes.data?.filter(n => !n.readAt).length ?? 0;

  const openNotes = async () => {
    setShowNotes(true);
    if (unread) { await api('/notifications/read-all', { method: 'POST' }).catch(() => {}); notes.reload(); }
  };

  return (
    <div className="shell">
      <aside className="side" aria-label="Main">
        <div className="brand"><LogoMark size={34} />Rentora</div>
        {nav.map(n => (
          <Link key={n.href} href={n.href} aria-current={active(n.href) ? 'page' : undefined}>
            <Icon name={n.icon} size={19} />{n.label}
          </Link>
        ))}
        <div style={{ marginTop: 'auto' }} className="row card flat">
          <Avatar name={user.name} size={34} />
          <div className="grow"><b className="ell" style={{ display: 'block' }}>{user.name}</b><span className="muted sm">{ROLE_LABEL[user.role]}</span></div>
        </div>
      </aside>
      <div className="col">
        <header className="hdr">
          <span className="hdr-logo"><LogoMark size={32} /></span>
          <div className="hdr-title"><small>Rentora · {ROLE_LABEL[user.role]}</small><b>{current?.label ?? 'Rentora'}</b></div>
          <button className="icon-btn" onClick={openNotes} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
            <Icon name="bell" size={20} />{unread > 0 && <span className="badge-dot" />}
          </button>
          <Link href={user.role === 'TENANT' ? '/tenant/account' : '/owner/account'} aria-label="Account"><Avatar name={user.name} /></Link>
        </header>
        <main className="main">{children}</main>
        <nav className="tabbar" aria-label="Main">
          {nav.filter(n => n.mobile).map(n => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? 'page' : undefined}>
              <span className="nav-ic"><Icon name={n.icon} size={19} /></span>{n.label}
            </Link>
          ))}
        </nav>
      </div>
      {showNotes && (
        <Sheet title="Notifications" onClose={() => setShowNotes(false)}>
          {!notes.data ? <Skeleton /> : notes.data.length === 0 ? <div className="empty">You are all caught up.</div> : (
            <div className="list">
              {notes.data.map(n => (
                <div key={n.id} className="li" style={{ alignItems: 'flex-start' }}>
                  <span className={`pill p-${n.tone === 'info' ? 'info' : n.tone}`} style={{ width: 10, height: 10, padding: 0, marginTop: 5 }} />
                  <div className="grow"><b>{n.title}</b><div className="muted sm">{n.body}</div></div>
                  <span className="muted sm" style={{ whiteSpace: 'nowrap' }}>{timeAgo(n.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

export function PageHead({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="row between wrap">
      <div style={{ flex: '1 1 220px', minWidth: 0 }}><h1 className="h1" style={{ fontSize: 24 }}>{title}</h1>{sub && <div className="muted">{sub}</div>}</div>
      {action}
    </div>
  );
}
