'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatDate, timeAgo, type Conversation, type Message, type Role } from '@rentora/shared';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { Avatar, ErrorCard, Icon, Skeleton, useToast } from './ui';

const ROLE: Record<Role, string> = { OWNER: 'Owner', MANAGER: 'Property manager', TENANT: 'Tenant' };
type Thread = { user: { id: string; name: string; role: Role; phone: string }; messages: Message[] };

export function MessagesView({ basePath }: { basePath: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const withId = params.get('with');
  const convos = useQuery<Conversation[]>('/messages', { pollMs: 15000 });
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    setWide(mq.matches);
    const on = (e: MediaQueryListEvent) => setWide(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  // On wide screens the first conversation opens beside the list; on phones the list shows until one is picked.
  const selected = withId ?? (wide ? convos.data?.[0]?.user.id : undefined);

  if (convos.error && !convos.data) return <ErrorCard message={convos.error} onRetry={convos.reload} />;
  if (!convos.data) return <Skeleton h={320} />;
  if (convos.data.length === 0) return <div className="card empty">No one to message yet. Contacts appear once there is an active lease.</div>;

  const open = (id: string) => router.replace(`${basePath}?with=${id}`);

  return (
    <div className="inbox">
      <div className="card" data-hide-mobile={withId ? 'true' : undefined}>
        <div className="list">
          {convos.data.map(c => (
            <button key={c.user.id} className="li" style={{ textAlign: 'left', background: c.user.id === selected ? 'var(--sunk)' : undefined, borderRadius: 12, paddingInline: 8 }} onClick={() => open(c.user.id)}>
              <Avatar name={c.user.name} />
              <div className="grow">
                <div className="row between"><b className="ell">{c.user.name}</b>{c.lastAt && <span className="muted sm">{timeAgo(c.lastAt)}</span>}</div>
                <div className="muted sm ell">{c.lastMessage ?? ROLE[c.user.role]}</div>
              </div>
              {c.unread > 0 && <span className="pill p-bad">{c.unread}</span>}
            </button>
          ))}
        </div>
      </div>
      {selected ? <ThreadView key={selected} userId={selected} onBack={() => router.replace(basePath)} onSent={convos.reload} /> : null}
      <style>{`@media (max-width: 899px) { [data-hide-mobile="true"] { display: none !important } }`}</style>
    </div>
  );
}

function ThreadView({ userId, onBack, onSent }: { userId: string; onBack: () => void; onSent: () => void }) {
  const toast = useToast();
  const q = useQuery<Thread>(`/messages/${userId}`, { pollMs: 5000 });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const count = q.data?.messages.length ?? 0;
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [count]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !q.data) return;
    setSending(true);
    try {
      const m = await api<Message>(`/messages/${userId}`, { body: { body } });
      q.setData({ ...q.data, messages: [...q.data.messages, m] });
      setText('');
      onSent();
    } catch (err) {
      toast((err as Error).message, 'bad');
    } finally {
      setSending(false);
    }
  };

  if (q.error && !q.data) return <ErrorCard message={q.error} onRetry={q.reload} />;
  if (!q.data) return <Skeleton h={320} />;
  const u = q.data.user;
  let lastDay = '';
  return (
    <div className="card" style={{ minHeight: 420 }}>
      <div className="row">
        <button className="icon-btn" onClick={onBack} aria-label="Back to conversations"><Icon name="back" /></button>
        <Avatar name={u.name} />
        <div className="grow"><b>{u.name}</b><div className="muted sm">{ROLE[u.role]} · {u.phone}</div></div>
        <a className="icon-btn" href={`tel:+91${u.phone}`} aria-label={`Call ${u.name}`}><Icon name="phone" /></a>
      </div>
      <div className="chat" style={{ flex: 1, maxHeight: '55vh' }}>
        {q.data.messages.length === 0 && <div className="empty">No messages yet. Say hello.</div>}
        {q.data.messages.map(m => {
          const d = formatDate(m.createdAt, { day: 'numeric', month: 'short' });
          const showDay = d !== lastDay; lastDay = d;
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {showDay && <div className="muted sm" style={{ textAlign: 'center', margin: '6px 0' }}>{d}</div>}
              <div className={`msg ${m.mine ? 'me' : 'them'}`}>{m.body}<small>{new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</small></div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form className="row" onSubmit={send}>
        <div className="input grow"><input aria-label="Message" placeholder="Write a message" value={text} onChange={e => setText(e.target.value)} autoComplete="off" /></div>
        <button className="btn btn-primary" disabled={sending || !text.trim()} aria-label="Send"><Icon name="send" size={16} /></button>
      </form>
    </div>
  );
}
