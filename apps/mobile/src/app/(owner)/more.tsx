import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { Avatar, Card, Divider, Icon, Row, Screen, T, TileIcon, useColors, type IconName } from '@/components/ui';

const ITEMS: [string, string, IconName, Href][] = [
  ['Maintenance', 'Requests and work orders', 'construct-outline', '/maintenance'],
  ['Applications', 'Screen applicants for vacant units', 'clipboard-outline', '/applications'],
  ['Messages', 'Tenants and co-managers', 'chatbubbles-outline', '/messages'],
  ['Notices & parcels', 'Announcements and locker deliveries', 'megaphone-outline', '/community'],
  ['Account', 'Profile, password and sign out', 'person-circle-outline', '/account']
];

export default function More() {
  const c = useColors();
  const router = useRouter();
  const { user } = useAuth();
  return (
    <Screen>
      {user && <Card><Row><Avatar name={user.name} size={48} /><View><T v="h2">{user.name}</T><T v="muted">{user.role === 'OWNER' ? 'Owner' : 'Property manager'} · {user.phone}</T></View></Row></Card>}
      <Card>
        {ITEMS.map(([title, sub, icon, href], i) => (
          <View key={title} style={{ gap: 12 }}>
            {i > 0 && <Divider />}
            <Pressable onPress={() => router.push(href)} accessibilityRole="button">
              <Row><TileIcon name={icon} /><View style={{ flex: 1 }}><T v="h3">{title}</T><T v="sm">{sub}</T></View><Icon name="chevron-forward" color={c.muted} /></Row>
            </Pressable>
          </View>
        ))}
      </Card>
      <T v="sm" style={{ textAlign: 'center' }}>Add properties, move tenants in and renew leases from the Rentora website.</T>
    </Screen>
  );
}
