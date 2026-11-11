import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { Button, Card, Field, Screen, T, useColors } from '@/components/ui';

export default function NewRequest() {
  const c = useColors();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      await api('/tickets', { body: { title, description } });
      Alert.alert('Request sent', 'Your property manager has been notified.');
      router.back();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <Card>
        <Field label="What needs fixing?" placeholder="e.g. Kitchen tap leaking" value={title} onChangeText={setTitle} />
        <Field label="Details (optional)" placeholder="When did it start? Best time to visit?" value={description} onChangeText={setDescription} multiline />
        {!!err && <T v="sm" color={c.bad}>{err}</T>}
        <Button title="Submit request" icon="send" onPress={submit} disabled={busy} />
      </Card>
    </Screen>
  );
}
