import { View } from 'react-native';
import { formatDate, formatINR, periodLabel, type Invoice } from '@/lib/shared';
import { useQuery } from '@/lib/hooks';
import { payInvoice } from '@/lib/actions';
import { Button, Card, Divider, Empty, InvoicePill, Load, Row, Screen, T, TileIcon, useColors } from '@/components/ui';

export default function MyPayments() {
  const c = useColors();
  const q = useQuery<Invoice[]>('/invoices');
  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Load q={q}>{list => {
        const open = list.filter(i => i.status !== 'PAID'), paid = list.filter(i => i.status === 'PAID');
        return <>
          {open.map(i => (
            <Card key={i.id} style={{ borderLeftWidth: 4, borderLeftColor: i.status === 'OVERDUE' ? c.bad : c.warn }}>
              <Row between><T v="h3">{periodLabel(i.period)}</T><InvoicePill inv={i} /></Row>
              <Row between><T v="muted">Due {formatDate(i.dueDate)}</T><T v="mid">{formatINR(i.amount)}</T></Row>
              <Button title="Pay now" icon="flash" onPress={() => payInvoice(i, q.reload)} />
            </Card>
          ))}
          {open.length === 0 && <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><TileIcon name="checkmark" tone="good" /><T>You are all paid up.</T></Card>}
          <Card>
            <T v="eyebrow">History</T>
            {paid.length === 0 ? <Empty text="No payments yet." /> : paid.map((i, n) => (
              <View key={i.id} style={{ gap: 12 }}>
                {n > 0 && <Divider />}
                <Row>
                  <TileIcon name="checkmark" tone="good" round />
                  <View style={{ flex: 1 }}><T v="h3">{periodLabel(i.period)}</T><T v="sm">{i.paidAt && formatDate(i.paidAt)} · {i.method?.replace('_', ' ')}{i.reference ? ` · ${i.reference}` : ''}</T></View>
                  <T v="h3">{formatINR(i.amount)}</T>
                </Row>
              </View>
            ))}
          </Card>
        </>;
      }}</Load>
    </Screen>
  );
}
