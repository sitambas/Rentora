import { useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { Unit } from '@/lib/shared';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { Button, Card, Field, Load, Screen, T, useColors } from '@/components/ui';

export default function EditUnit() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery<Unit>(`/units/${id}`);
  const [form, setForm] = useState<{ name: string; rent: string; deposit: string } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Fill the form once the unit loads.
  useEffect(() => {
    if (q.data && !form) setForm({ name: q.data.name, rent: String(q.data.rent), deposit: String(q.data.deposit) });
  }, [q.data, form]);

  const submit = async () => {
    if (!form) return;
    setBusy(true); setErr('');
    try {
      await api(`/units/${id}`, { method: 'PATCH', body: { name: form.name, rent: form.rent, deposit: form.deposit || 0 } });
      router.back();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <Load q={q}>{u => !form ? null : (
        <Card>
          <Stack.Screen options={{ title: `Edit ${u.name}` }} />
          <Field label="Unit name" value={form.name} onChangeText={name => setForm({ ...form, name })} />
          <Field label="Rent per month (₹)" keyboardType="number-pad" value={form.rent} onChangeText={v => setForm({ ...form, rent: v.replace(/\D/g, '') })} />
          <Field label="Deposit (₹)" keyboardType="number-pad" value={form.deposit} onChangeText={v => setForm({ ...form, deposit: v.replace(/\D/g, '') })} />
          {u.lease && <T v="sm">New rent and deposit apply to the next lease. To change {u.lease.tenant.name}’s rent, renew their lease on the Rentora website.</T>}
          {!!err && <T v="sm" color={c.bad}>{err}</T>}
          <Button title={busy ? 'Saving…' : 'Save changes'} onPress={submit} disabled={busy} />
        </Card>
      )}</Load>
    </Screen>
  );
}
