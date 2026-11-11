import { Alert, Share, View } from 'react-native';
import { formatINR, timeAgo, type Application } from '@/lib/shared';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { Avatar, Button, Card, Divider, Empty, Load, Pill, Row, Screen, T } from '@/components/ui';

const tone = (s: number): 'good' | 'info' | 'warn' | 'bad' => (s >= 750 ? 'good' : s >= 700 ? 'info' : s >= 650 ? 'warn' : 'bad');

export default function Applications() {
  const q = useQuery<Application[]>('/applications');

  const approve = (a: Application) => Alert.alert(`Approve ${a.name}?`, `Creates an 11-month lease for ${a.unit.name} from today and declines the other applicants.`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Approve', onPress: async () => {
        try {
          const r = await api<{ tempPassword: string | null }>(`/applications/${a.id}/approve`, { body: {} });
          q.reload();
          if (r.tempPassword) {
            const msg = `Welcome to Rentora!\nMobile: ${a.phone}\nTemporary password: ${r.tempPassword}`;
            Alert.alert(`${a.name} is moving in`, `Share these login details. The password is shown only once.\n\n${msg}`, [
              { text: 'Share', onPress: () => Share.share({ message: msg }) }, { text: 'Done' }
            ]);
          }
        } catch (e) { Alert.alert('Could not approve', (e as Error).message); }
      }
    }
  ]);
  const reject = async (a: Application) => {
    try { await api(`/applications/${a.id}/reject`, { method: 'POST' }); q.reload(); }
    catch (e) { Alert.alert('Could not decline', (e as Error).message); }
  };

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Load q={q}>{list => list.length === 0 ? <Card><Empty text="No pending applications." /></Card> : (
        <Card>
          {list.map((a, i) => (
            <View key={a.id} style={{ gap: 10 }}>
              {i > 0 && <Divider />}
              <Row>
                <Avatar name={a.name} />
                <View style={{ flex: 1 }}><T v="h3">{a.name}</T><T v="sm">{a.property.name} · {a.unit.name} · {formatINR(a.monthlyIncome)}/mo · {timeAgo(a.createdAt)}</T></View>
                <Pill label={`Credit ${a.creditScore}`} tone={tone(a.creditScore)} />
              </Row>
              <Row><Button title="Decline" kind="line" small style={{ flex: 1 }} onPress={() => reject(a)} /><Button title="Approve" small style={{ flex: 1 }} onPress={() => approve(a)} /></Row>
            </View>
          ))}
        </Card>
      )}</Load>
    </Screen>
  );
}
