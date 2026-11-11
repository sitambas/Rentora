import { useEffect } from 'react';
import { View } from 'react-native';
import { timeAgo, type Notification } from '@/lib/shared';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { Card, Divider, Empty, Load, Row, Screen, T, useColors } from '@/components/ui';

export default function Notifications() {
  const c = useColors();
  const q = useQuery<Notification[]>('/notifications');
  // Opening this screen marks everything read; the list keeps showing what was new on this visit.
  useEffect(() => { api('/notifications/read-all', { method: 'POST' }).catch(() => {}); }, []);
  const dot = { info: c.brand, good: c.good, warn: c.warn, bad: c.bad };
  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Load q={q}>{list => list.length === 0 ? <Card><Empty text="You are all caught up." /></Card> : (
        <Card>
          {list.map((n, i) => (
            <View key={n.id} style={{ gap: 12 }}>
              {i > 0 && <Divider />}
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, marginTop: 6, backgroundColor: dot[n.tone], opacity: n.readAt ? 0.35 : 1 }} />
                <View style={{ flex: 1 }}><T v="h3">{n.title}</T><T v="muted">{n.body}</T></View>
                <T v="sm">{timeAgo(n.createdAt)}</T>
              </Row>
            </View>
          ))}
        </Card>
      )}</Load>
    </Screen>
  );
}
