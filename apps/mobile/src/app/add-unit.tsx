import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import type { Property } from '@/lib/shared';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { Button, Card, Chip, Empty, Field, Load, Screen, T, useColors } from '@/components/ui';

export default function AddUnit() {
  const c = useColors();
  const router = useRouter();
  const props = useQuery<Property[]>('/properties');
  const [propertyId, setPropertyId] = useState('');
  const [name, setName] = useState('');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const pid = propertyId || props.data?.[0]?.id || '';

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      await api('/units', { body: { propertyId: pid, name, rent, deposit: deposit || undefined } });
      router.back();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <Load q={props}>{list => list.length === 0 ? <Card><Empty text="Add a property on the Rentora website first." /></Card> : (
        <Card>
          <T v="sm" color={c.ink} style={{ fontWeight: '600' }}>Property</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {list.map(p => <Chip key={p.id} label={p.name} active={pid === p.id} onPress={() => setPropertyId(p.id)} />)}
          </ScrollView>
          <Field label="Unit name" placeholder="Unit 102" value={name} onChangeText={setName} />
          <Field label="Rent per month (₹)" keyboardType="number-pad" value={rent} onChangeText={v => setRent(v.replace(/\D/g, ''))} />
          <Field label="Deposit (₹)" hint="Leave empty for 2 months’ rent." keyboardType="number-pad" value={deposit} onChangeText={v => setDeposit(v.replace(/\D/g, ''))} />
          {!!err && <T v="sm" color={c.bad}>{err}</T>}
          <Button title="Add unit" onPress={submit} disabled={busy} />
        </Card>
      )}</Load>
    </Screen>
  );
}
