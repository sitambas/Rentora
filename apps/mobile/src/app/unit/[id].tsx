import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { formatDate, formatINR, periodLabel, type Invoice, type Ticket, type Unit } from '@/lib/shared';
import { useQuery } from '@/lib/hooks';
import { recordPayment, sendReminder } from '@/lib/actions';
import { Avatar, Button, Card, Divider, Empty, InvoicePill, Load, Row, Screen, T, TicketPill, useColors } from '@/components/ui';

type Detail = Unit & { invoices: Invoice[]; tickets: Ticket[] };

export default function UnitScreen() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery<Detail>(`/units/${id}`);

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Load q={q}>{u => {
        const lease = u.lease, inv = u.openInvoice;
        return <>
          <Stack.Screen options={{ title: `${u.name} · ${u.property.name}` }} />
          {lease ? (
            <Card>
              <Row><Avatar name={lease.tenant.name} size={46} />
                <View style={{ flex: 1 }}><T v="h2">{[lease.tenant.name, ...lease.coTenantNames].join(' & ')}</T><T v="muted">{lease.tenant.phone}</T></View></Row>
              <Card flat style={{ gap: 8 }}>
                {[['Lease', `${formatDate(lease.startDate)} – ${formatDate(lease.endDate)}`], ['Rent', formatINR(lease.rent)], ['Deposit', formatINR(lease.deposit)], ['Auto-pay', lease.autopay ? 'On' : 'Off']].map(([k, v]) => (
                  <Row between key={k}><T v="muted">{k}</T><T v="h3">{v}</T></Row>
                ))}
              </Card>
              <Button title="Message tenant" icon="chatbubble-outline" kind="soft" onPress={() => router.push(`/chat/${lease.tenant.id}`)} />
            </Card>
          ) : (
            <Card>
              <T v="h2">Vacant</T>
              <T v="muted">Rent {formatINR(u.rent)}/mo · deposit {formatINR(u.deposit)}</T>
              {u.pendingApplications > 0 && <Button title={`Review ${u.pendingApplications} applications`} onPress={() => router.push('/applications')} />}
            </Card>
          )}

          {inv && (
            <Card style={{ borderLeftWidth: 4, borderLeftColor: inv.status === 'OVERDUE' ? c.bad : c.warn }}>
              <Row between><T v="h3">{periodLabel(inv.period)} rent</T><InvoicePill inv={inv} /></Row>
              <Row between><T v="muted">Due {formatDate(inv.dueDate)}</T><T v="mid">{formatINR(inv.amount)}</T></Row>
              <Row>
                <Button title="Remind" icon="send" small style={{ flex: 1 }} onPress={() => sendReminder(inv, q.reload)} />
                <Button title="Record payment" icon="wallet-outline" kind="good" small style={{ flex: 1 }} onPress={() => recordPayment(inv, q.reload)} />
              </Row>
            </Card>
          )}

          <Card>
            <T v="eyebrow">Ledger</T>
            {u.invoices.length === 0 ? <Empty text="No invoices yet." /> : u.invoices.map((i, n) => (
              <View key={i.id} style={{ gap: 12 }}>
                {n > 0 && <Divider />}
                <Row between>
                  <View style={{ flex: 1 }}><T v="h3">{periodLabel(i.period)}</T><T v="sm">{i.paidAt ? `Paid ${formatDate(i.paidAt)} · ${i.method?.replace('_', ' ')}` : `Due ${formatDate(i.dueDate)}`}</T></View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}><T v="h3">{formatINR(i.amount)}</T><InvoicePill inv={i} /></View>
                </Row>
              </View>
            ))}
          </Card>

          <Card>
            <T v="eyebrow">Maintenance</T>
            {u.tickets.length === 0 ? <Empty text="No requests for this unit." /> : u.tickets.map(t => (
              <Row between key={t.id}><View style={{ flex: 1 }}><T v="h3">{t.title}</T><T v="sm">{formatDate(t.createdAt)} · {t.createdBy.name}</T></View><TicketPill status={t.status} /></Row>
            ))}
          </Card>
        </>;
      }}</Load>
    </Screen>
  );
}
