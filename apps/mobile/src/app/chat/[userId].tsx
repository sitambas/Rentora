import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Message, Role } from '@/lib/shared';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { Empty, ErrorView, Icon, Loading, T, useColors } from '@/components/ui';

type Thread = { user: { id: string; name: string; role: Role; phone: string }; messages: Message[] };

export default function Chat() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const q = useQuery<Thread>(`/messages/${userId}`, { pollMs: 5000 });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const list = useRef<FlatList<Message>>(null);

  const send = async () => {
    const body = text.trim();
    if (!body || !q.data) return;
    setSending(true); setErr('');
    try {
      const m = await api<Message>(`/messages/${userId}`, { body: { body } });
      q.setData({ ...q.data, messages: [...q.data.messages, m] });
      setText('');
    } catch (e) { setErr((e as Error).message); }
    finally { setSending(false); }
  };

  if (q.error && !q.data) return <View style={{ padding: 16 }}><ErrorView message={q.error} onRetry={q.reload} /></View>;
  if (!q.data) return <Loading />;
  const u = q.data.user;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{
        title: u.name,
        headerRight: () => <Pressable onPress={() => Linking.openURL(`tel:+91${u.phone}`)} accessibilityLabel={`Call ${u.name}`}><Icon name="call-outline" color={c.brand} size={22} /></Pressable>
      }} />
      <FlatList
        ref={list}
        data={q.data.messages}
        keyExtractor={m => m.id}
        contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Empty text="No messages yet. Say hello." />}
        renderItem={({ item: m }) => (
          <View style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', maxWidth: '80%', backgroundColor: m.mine ? c.brand : c.surface, borderRadius: 16, borderBottomRightRadius: m.mine ? 4 : 16, borderBottomLeftRadius: m.mine ? 16 : 4, paddingHorizontal: 12, paddingVertical: 9 }}>
            <T color={m.mine ? c.brandInk : c.ink}>{m.body}</T>
            <T v="sm" color={m.mine ? c.brandInk : c.muted} style={{ opacity: 0.75, fontSize: 10.5, marginTop: 2 }}>{new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</T>
          </View>
        )}
      />
      {!!err && <T v="sm" color={c.bad} style={{ paddingHorizontal: 16 }}>{err}</T>}
      <View style={{ flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 12 + insets.bottom, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line }}>
        <TextInput style={{ flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: c.sunk, paddingHorizontal: 12, color: c.ink, fontSize: 15 }}
          placeholder="Write a message" placeholderTextColor={c.muted} value={text} onChangeText={setText} multiline accessibilityLabel="Message" />
        <Pressable onPress={send} disabled={sending || !text.trim()} accessibilityLabel="Send"
          style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center', opacity: sending || !text.trim() ? 0.5 : 1 }}>
          <Icon name="send" color={c.brandInk} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
