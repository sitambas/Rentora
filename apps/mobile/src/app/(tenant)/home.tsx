import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { daysBetween, formatDate, formatINR, periodLabel, timeAgo, type Lease, type TenantHome } from '@/lib/shared';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { payInvoice } from '@/lib/actions';
import { Button, Card, Icon, Load, Pill, Row, Screen, T, TicketPill, TileIcon, useColors } from '@/components/ui';

export default function Home() {
  const c = useColors();
  const router = useRouter();
  const q = useQuery<TenantHome>('/home');
  const [breakdown, setBreakdown] = useState(false);

  const toggleAutopay = async (h: TenantHome) => {
    try { const l = await api<Lease>('/leases/mine', { method: 'PATCH', body: { autopay: !h.lease.autopay } }); q.setData({ ...h, lease: l }); }
    catch (e) { Alert.alert('Could not change auto-pay', (e as Error).message); }
  };

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Load q={q}>{h => {
        const inv = h.invoice, paid = inv?.status === 'PAID';
        const dueIn = inv && !paid ? daysBetween(new Date(), inv.dueDate) : 0;
        const glass = { backgroundColor: 'rgba(255,255,255,0.16)' };
        return <>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
            <TileIcon name="location-outline" round />
            <View style={{ flex: 1 }}><T v="eyebrow">Your home</T><T v="h3" lines={1}>{h.property.name} · {h.unit.name}</T></View>
            <Pill label="Active" tone="good" />
          </Card>

          {inv && (
            <View style={{ backgroundColor: c.brand, borderRadius: 20, padding: 18, gap: 14 }}>
              <Row between>
                <T v="eyebrow" color={c.brandInk}>{periodLabel(inv.period)} rent</T>
                <Pressable onPress={() => toggleAutopay(h)} style={[glass, { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }]} accessibilityRole="switch" accessibilityState={{ checked: h.lease.autopay }}>
                  <T v="sm" color={c.brandInk} style={{ fontWeight: '700' }}>Auto-pay {h.lease.autopay ? 'on' : 'off'}</T>
                </Pressable>
              </Row>
              <View>
                <T v="big" color={c.brandInk}>{formatINR(inv.amount)}</T>
                <T v="sm" color={c.brandInk} style={{ opacity: 0.85 }}>
                  {paid ? `Paid ${inv.paidAt ? formatDate(inv.paidAt) : ''} · ${inv.reference ?? ''}` : inv.status === 'OVERDUE' ? `Overdue since ${formatDate(inv.dueDate)}` : dueIn <= 0 ? 'Due today' : `Due in ${dueIn} days (${formatDate(inv.dueDate)})`}
                </T>
              </View>
              {!paid && (
                <Pressable onPress={() => payInvoice(inv, q.reload)} style={{ backgroundColor: c.surface, borderRadius: 14, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }} accessibilityRole="button">
                  <Icon name="flash" color={c.brand} /><T v="h3" color={c.brand}>Pay now ({formatINR(inv.amount)})</T>
                </Pressable>
              )}
              {breakdown && <View style={[glass, { borderRadius: 12, padding: 12, gap: 6 }]}>
                {inv.items.map(i => <Row between key={i.label}><T color={c.brandInk}>{i.label}</T><T color={c.brandInk} style={{ fontWeight: '700' }}>{formatINR(i.amount)}</T></Row>)}
              </View>}
              <Row>
                <Pressable onPress={() => setBreakdown(b => !b)} style={[glass, { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }]}><T v="sm" color={c.brandInk} style={{ fontWeight: '700' }}>{breakdown ? 'Hide' : 'View'} breakdown</T></Pressable>
                <Pressable onPress={() => Alert.alert('Split rent', h.lease.coTenantNames.length ? `Your share is ${formatINR(inv.amount / (h.lease.coTenantNames.length + 1))}, split with ${h.lease.coTenantNames.join(', ')}.` : 'Ask your manager to add your roommate to the lease to split rent.')}
                  style={[glass, { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }]}><T v="sm" color={c.brandInk} style={{ fontWeight: '700' }}>Split rent</T></Pressable>
              </Row>
            </View>
          )}

          {h.parcels.map(p => (
            <Card key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TileIcon name="cube-outline" tone="good" round />
              <View style={{ flex: 1 }}><T v="h3">Package in locker {p.locker}</T><T v="sm">{p.carrier} · {timeAgo(p.deliveredAt)} · PIN {p.pin}</T></View>
              <Button title="Copy PIN" kind="soft" small onPress={async () => { await Clipboard.setStringAsync(p.pin); Alert.alert('Copied', `Locker PIN ${p.pin}`); }} />
            </Card>
          ))}

          <Card>
            <Row between><T v="h3">Maintenance & support</T><Pill label={`${h.tickets.length} active`} tone="info" /></Row>
            {h.tickets.map(t => (
              <Card flat key={t.id} style={{ gap: 4, padding: 12 }}>
                <Row between><T v="h3" style={{ flex: 1 }}>{t.title}</T><TicketPill status={t.status} /></Row>
                <T v="sm">{t.scheduledFor ? `Visit ${formatDate(t.scheduledFor, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : `Raised ${timeAgo(t.createdAt)}`}{t.assignee ? ` · ${t.assignee}` : ''}</T>
              </Card>
            ))}
            <Button title="New maintenance request" icon="add" kind="soft" onPress={() => router.push('/new-request')} />
          </Card>

          <Row style={{ alignItems: 'stretch' }}>
            <Card style={{ flex: 1 }}>
              <TileIcon name="document-text-outline" />
              <T v="h3">Lease</T><T v="sm">Until {formatDate(h.lease.endDate)}</T><T v="sm">Deposit {formatINR(h.lease.deposit)}</T>
            </Card>
            <Card style={{ flex: 1 }}>
              <TileIcon name="chatbubble-outline" tone="good" />
              <T v="h3">{h.manager?.role === 'MANAGER' ? 'Manager' : 'Landlord'}</T><T v="sm" lines={1}>{h.manager?.name ?? 'Not assigned'}</T>
              {h.manager && <Button title="Message" small onPress={() => router.push(`/chat/${h.manager!.id}`)} />}
            </Card>
          </Row>

          {h.notices.length > 0 && (
            <Card>
              <T v="h3">Building notices</T>
              {h.notices.map(n => (
                <View key={n.id} style={{ gap: 2 }}>
                  {n.eventAt && <T v="eyebrow" color={c.warn}>{formatDate(n.eventAt, { weekday: 'long', day: 'numeric', month: 'short' })}</T>}
                  <T v="h3">{n.title}</T><T v="muted">{n.body}</T>
                </View>
              ))}
            </Card>
          )}
        </>;
      }}</Load>
    </Screen>
  );
}
