import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import type { Property } from '@/lib/shared';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { Button, Card, Chip, Field, Load, Screen, T, useColors } from '@/components/ui';

export default function PostNotice() {
  const c = useColors();
  const router = useRouter();
  const props = useQuery<Property[]>('/properties');
  const [propertyId, setPropertyId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const pid = propertyId || props.data?.[0]?.id || '';

  const submit = async () => {
    setBusy(true); setErr('');
    try { await api('/notices', { body: { propertyId: pid, title, body } }); router.back(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <Load q={props}>{list => (
        <Card>
          <T v="sm" color={c.ink} style={{ fontWeight: '600' }}>Building</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {list.map(p => <Chip key={p.id} label={p.name} active={pid === p.id} onPress={() => setPropertyId(p.id)} />)}
          </ScrollView>
          <Field label="Title" placeholder="Water tank cleaning" value={title} onChangeText={setTitle} />
          <Field label="Message" value={body} onChangeText={setBody} multiline />
          <T v="sm">Every tenant in the building gets a notification.</T>
          {!!err && <T v="sm" color={c.bad}>{err}</T>}
          <Button title="Post notice" icon="megaphone-outline" onPress={submit} disabled={busy} />
        </Card>
      )}</Load>
    </Screen>
  );
}
