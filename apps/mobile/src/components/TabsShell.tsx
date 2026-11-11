import { Pressable } from 'react-native';
import { Redirect, Tabs, useRouter } from 'expo-router';
import type { Role } from '@/lib/shared';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@/lib/hooks';
import type { Notification } from '@/lib/shared';
import { Icon, Loading, useColors, type IconName } from './ui';

export interface TabDef { name: string; title: string; icon: IconName }

/** Bottom tabs for one role; sends people who are signed out, or in the wrong role, to the right place. */
export function TabsShell({ allow, tabs }: { allow: Role[]; tabs: TabDef[] }) {
  const c = useColors();
  const router = useRouter();
  const { user, loading } = useAuth();
  const notes = useQuery<Notification[]>(user ? '/notifications' : null, { pollMs: 30000 });
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  if (!allow.includes(user.role)) return <Redirect href="/" />;
  const unread = notes.data?.some(n => !n.readAt);

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: c.brand, tabBarInactiveTintColor: c.muted,
      tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
      headerStyle: { backgroundColor: c.surface }, headerTintColor: c.ink, headerTitleStyle: { fontWeight: '700' },
      headerRight: () => (
        <Pressable onPress={() => router.push('/notifications')} style={{ paddingHorizontal: 16 }} accessibilityLabel={unread ? 'Notifications, unread' : 'Notifications'}>
          <Icon name={unread ? 'notifications' : 'notifications-outline'} size={22} color={unread ? c.bad : c.ink} />
        </Pressable>
      )
    }}>
      {tabs.map(t => (
        <Tabs.Screen key={t.name} name={t.name} options={{
          title: t.title,
          tabBarIcon: ({ color, size }) => <Icon name={t.icon} size={size - 2} color={String(color)} />
        }} />
      ))}
    </Tabs>
  );
}
