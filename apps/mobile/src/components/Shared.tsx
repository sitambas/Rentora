// Screens used by both owners and tenants: conversation list and account.
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { timeAgo, type Conversation, type User } from '@/lib/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@/lib/hooks';
import { Avatar, Button, Card, Divider, Empty, Field, Load, Pill, Row, Screen, T } from './ui';

const ROLE = { OWNER: 'Owner', MANAGER: 'Property manager', TENANT: 'Tenant' } as const;

export function ConversationList() {
  const router = useRouter();
  const q = useQuery<Conversation[]>('/messages', { pollMs: 15000 });
  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Load q={q}>{list => list.length === 0 ? <Card><Empty text="No one to message yet. Contacts appear once there is an active lease." /></Card> : (
        <Card>
          {list.map((c, i) => (
            <View key={c.user.id} style={{ gap: 12 }}>
              {i > 0 && <Divider />}
              <Pressable onPress={() => router.push(`/chat/${c.user.id}`)} accessibilityRole="button" accessibilityLabel={`Chat with ${c.user.name}`}>
                <Row>
                  <Avatar name={c.user.name} />
                  <View style={{ flex: 1 }}>
                    <Row between><T v="h3" lines={1} style={{ flex: 1 }}>{c.user.name}</T>{c.lastAt && <T v="sm">{timeAgo(c.lastAt)}</T>}</Row>
                    <T v="sm" lines={1}>{c.lastMessage ?? ROLE[c.user.role]}</T>
                  </View>
                  {c.unread > 0 && <Pill label={String(c.unread)} tone="bad" />}
                </Row>
              </Pressable>
            </View>
          ))}
        </Card>
      )}</Load>
    </Screen>
  );
}

export function AccountScreen() {
  const { user, setUser, logout } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const save = async () => {
    setBusy(true);
    try { setUser(await api<User>('/auth/me', { method: 'PATCH', body: { name, email: email || null } })); Alert.alert('Profile saved'); }
    catch (e) { Alert.alert('Could not save', (e as Error).message); }
    finally { setBusy(false); }
  };
  const changePassword = async () => {
    setBusy(true);
    try { await api('/auth/password', { body: { current, next } }); setCurrent(''); setNext(''); Alert.alert('Password changed'); }
    catch (e) { Alert.alert('Could not change password', (e as Error).message); }
    finally { setBusy(false); }
  };
  const signOut = () => Alert.alert('Sign out?', undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: async () => { await logout(); router.replace('/login'); } }
  ]);

  return (
    <Screen>
      <Card><Row><Avatar name={user.name} size={52} /><View><T v="h2">{user.name}</T><T v="muted">{ROLE[user.role]} · {user.phone}</T></View></Row></Card>
      <Card>
        <T v="h3">Profile</T>
        <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" />
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Button title="Save profile" onPress={save} disabled={busy} />
      </Card>
      <Card>
        <T v="h3">Change password</T>
        <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="password" />
        <Field label="New password" hint="At least 8 characters." value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" />
        <Button title="Change password" kind="line" onPress={changePassword} disabled={busy || !current || !next} />
      </Card>
      <Button title="Sign out" icon="log-out-outline" kind="danger" onPress={signOut} />
    </Screen>
  );
}
