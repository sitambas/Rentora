import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { TICKET_STATUS_LABEL, formatDate, timeAgo, type Ticket, type TicketStatus } from '@/lib/shared';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { Button, Card, Chip, Empty, Load, Row, Screen, T, TicketPill } from '@/components/ui';

const NEXT: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['SCHEDULED', 'IN_PROGRESS', 'RESOLVED'],
  SCHEDULED: ['IN_PROGRESS', 'RESOLVED'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['OPEN']
};

export default function Maintenance() {
  const [status, setStatus] = useState<'open' | 'resolved' | 'all'>('open');
  const q = useQuery<Ticket[]>(`/tickets?status=${status}`);

  const update = (t: Ticket) => Alert.alert(t.title, 'Move this request to:', [
    ...NEXT[t.status].map(s => ({
      text: TICKET_STATUS_LABEL[s],
      onPress: async () => {
        try {
          // Scheduling from the phone books the visit for tomorrow at 10 AM; pick an exact time on the website.
          const when = new Date(); when.setDate(when.getDate() + 1); when.setHours(10, 0, 0, 0);
          await api(`/tickets/${t.id}`, { method: 'PATCH', body: { status: s, ...(s === 'SCHEDULED' && !t.scheduledFor ? { scheduledFor: when.toISOString() } : {}) } });
          q.reload();
        } catch (e) { Alert.alert('Could not update', (e as Error).message); }
      }
    })),
    { text: 'Cancel', style: 'cancel' as const }
  ]);

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {([['open', 'Open'], ['resolved', 'Resolved'], ['all', 'All']] as const).map(([k, l]) => <Chip key={k} label={l} active={status === k} onPress={() => setStatus(k)} />)}
      </ScrollView>
      <Load q={q}>{list => list.length === 0 ? <Card><Empty text={status === 'open' ? 'No open requests.' : 'Nothing here yet.'} /></Card> : <>
        {list.map(t => (
          <Card key={t.id}>
            <Row between style={{ alignItems: 'flex-start' }}><View style={{ flex: 1 }}><T v="eyebrow">{t.property.name} · {t.unit.name}</T><T v="h3">{t.title}</T></View><TicketPill status={t.status} /></Row>
            {!!t.description && <T v="muted">{t.description}</T>}
            <T v="sm">By {t.createdBy.name} · {timeAgo(t.createdAt)}{t.scheduledFor ? ` · visit ${formatDate(t.scheduledFor, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}{t.assignee ? ` · ${t.assignee}` : ''}</T>
            <Button title="Update status" kind="line" small onPress={() => update(t)} />
          </Card>
        ))}
      </>}</Load>
    </Screen>
  );
}
