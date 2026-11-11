import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate, timeAgo, type Notice, type Parcel } from '@/lib/shared';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { Button, Card, Divider, Empty, Load, Row, Screen, T, TileIcon } from '@/components/ui';

export default function Community() {
  const router = useRouter();
  const notices = useQuery<Notice[]>('/notices');
  const parcels = useQuery<Parcel[]>('/parcels');
  const collect = async (p: Parcel) => {
    try { await api(`/parcels/${p.id}/collect`, { method: 'POST' }); parcels.reload(); }
    catch (e) { Alert.alert('Could not update', (e as Error).message); }
  };
  const refresh = () => { notices.refresh(); parcels.refresh(); };

  return (
    <Screen refreshing={notices.refreshing} onRefresh={refresh}>
      <Card>
        <Row between><T v="h3">Building notices</T><Button title="Post" icon="megaphone-outline" small onPress={() => router.push('/post-notice')} /></Row>
        <Load q={notices}>{list => list.length === 0 ? <Empty text="No notices yet." /> : <>
          {list.map((n, i) => (
            <View key={n.id} style={{ gap: 10 }}>
              {i > 0 && <Divider />}
              <T v="eyebrow">{n.property.name}{n.eventAt ? ` · ${formatDate(n.eventAt, { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}</T>
              <T v="h3">{n.title}</T><T v="muted">{n.body}</T><T v="sm">Posted {timeAgo(n.createdAt)}</T>
            </View>
          ))}
        </>}</Load>
      </Card>
      <Card>
        <T v="h3">Parcels waiting</T>
        <Load q={parcels}>{list => list.length === 0 ? <Empty text="No parcels in lockers." /> : <>
          {list.map(p => (
            <Row key={p.id}><TileIcon name="cube-outline" tone="good" />
              <View style={{ flex: 1 }}><T v="h3">{p.unit.name} · locker {p.locker}</T><T v="sm">{p.carrier} · {timeAgo(p.deliveredAt)}</T></View>
              <Button title="Collected" kind="line" small onPress={() => collect(p)} />
            </Row>
          ))}
        </>}</Load>
        <T v="sm">Log new deliveries from the Rentora website.</T>
      </Card>
    </Screen>
  );
}
