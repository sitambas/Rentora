import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate, timeAgo, type Ticket } from '@/lib/shared';
import { useQuery } from '@/lib/hooks';
import { Button, Card, Chip, Empty, Load, Row, Screen, T, TicketPill } from '@/components/ui';

export default function Requests() {
  const router = useRouter();
  const [status, setStatus] = useState<'open' | 'all'>('open');
  const q = useQuery<Ticket[]>(`/tickets?status=${status}`);
  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Button title="New maintenance request" icon="add" onPress={() => router.push('/new-request')} />
      <Row><Chip label="Open" active={status === 'open'} onPress={() => setStatus('open')} /><Chip label="All" active={status === 'all'} onPress={() => setStatus('all')} /></Row>
      <Load q={q}>{list => list.length === 0 ? <Card><Empty text="No requests." /></Card> : <>
        {list.map(t => (
          <Card key={t.id}>
            <Row between><T v="h3" style={{ flex: 1 }}>{t.title}</T><TicketPill status={t.status} /></Row>
            {!!t.description && <T v="muted">{t.description}</T>}
            <View><T v="sm">Raised {timeAgo(t.createdAt)}{t.scheduledFor ? ` · visit ${formatDate(t.scheduledFor, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}{t.assignee ? ` · ${t.assignee}` : ''}</T></View>
          </Card>
        ))}
      </>}</Load>
    </Screen>
  );
}
