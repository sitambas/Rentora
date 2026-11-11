import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { formatDate, formatINR, periodLabel, periodOf, type Invoice } from '@/lib/shared';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { recordPayment } from '@/lib/actions';
import { Avatar, Button, Card, Chip, Divider, Empty, InvoicePill, Load, Row, Screen, T, useColors } from '@/components/ui';

type Status = 'UNPAID' | 'OVERDUE' | 'PAID' | 'ALL';

export default function Payments() {
  const c = useColors();
  const [status, setStatus] = useState<Status>('UNPAID');
  const q = useQuery<Invoice[]>(`/invoices${status === 'ALL' ? '' : `?status=${status}`}`);

  const generate = async () => {
    try {
      const r = await api<{ label: string }>('/invoices/generate', { body: { period: periodOf(new Date()) } });
      Alert.alert('Billing', r.label); q.reload();
    } catch (e) { Alert.alert('Could not bill rent', (e as Error).message); }
  };

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {([['UNPAID', 'Unpaid'], ['OVERDUE', 'Overdue'], ['PAID', 'Paid'], ['ALL', 'All']] as const).map(([k, l]) =>
          <Chip key={k} label={l} active={status === k} onPress={() => setStatus(k)} />)}
      </ScrollView>
      <Button title={`Bill ${periodLabel(periodOf(new Date()), true)} rent for all leases`} icon="refresh" kind="line" small onPress={generate} />
      <Load q={q}>{list => list.length === 0 ? <Card><Empty text="No invoices here." /></Card> : (
        <Card>
          <Row between><T v="eyebrow">{list.length} invoices</T><T v="h3">{formatINR(list.reduce((a, i) => a + i.amount, 0))}</T></Row>
          {list.map(i => (
            <View key={i.id} style={{ gap: 12 }}>
              <Divider />
              <Row>
                <Avatar name={i.tenant.name} size={34} />
                <View style={{ flex: 1 }}>
                  <T v="h3" lines={1}>{i.unit.name} · {i.tenant.name}</T>
                  <T v="sm">{periodLabel(i.period)} · {i.paidAt ? `paid ${formatDate(i.paidAt)}` : `due ${formatDate(i.dueDate)}`}</T>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <T v="h3" color={i.status === 'PAID' ? c.good : undefined}>{formatINR(i.amount)}</T>
                  {i.status === 'PAID' ? <InvoicePill inv={i} /> : <Button title="Record" kind="soft" small style={{ height: 28 }} onPress={() => recordPayment(i, q.reload)} />}
                </View>
              </Row>
            </View>
          ))}
        </Card>
      )}</Load>
    </Screen>
  );
}
