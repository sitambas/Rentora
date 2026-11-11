import { Linking, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatINR, type Unit } from '@/lib/shared';
import { useQuery } from '@/lib/hooks';
import { Avatar, Card, Divider, Empty, Icon, InvoicePill, Load, Pill, Row, Screen, T, useColors } from '@/components/ui';

export default function Tenants() {
  const c = useColors();
  const router = useRouter();
  const q = useQuery<Unit[]>('/units?status=OCCUPIED');
  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Load q={q}>{units => units.length === 0 ? <Card><Empty text="No active leases yet." /></Card> : (
        <Card>
          {units.map((u, i) => {
            const l = u.lease!;
            return (
              <View key={u.id} style={{ gap: 12 }}>
                {i > 0 && <Divider />}
                <Row>
                  <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }} onPress={() => router.push(`/unit/${u.id}`)}>
                    <Avatar name={l.tenant.name} />
                    <View style={{ flex: 1 }}>
                      <T v="h3" lines={1}>{[l.tenant.name, ...l.coTenantNames].join(' & ')}</T>
                      <T v="sm" lines={1}>{u.name} · {u.property.name} · {formatINR(l.rent)}/mo</T>
                    </View>
                  </Pressable>
                  {u.openInvoice ? <InvoicePill inv={u.openInvoice} /> : <Pill label="Current" tone="good" />}
                  <Pressable onPress={() => router.push(`/chat/${l.tenant.id}`)} hitSlop={8} accessibilityLabel={`Message ${l.tenant.name}`}><Icon name="chatbubble-outline" color={c.brand} /></Pressable>
                  <Pressable onPress={() => Linking.openURL(`tel:+91${l.tenant.phone}`)} hitSlop={8} accessibilityLabel={`Call ${l.tenant.name}`}><Icon name="call-outline" color={c.brand} /></Pressable>
                </Row>
              </View>
            );
          })}
        </Card>
      )}</Load>
    </Screen>
  );
}
