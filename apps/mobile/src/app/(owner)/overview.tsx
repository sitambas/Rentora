import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatCompactINR, formatINR, periodLabel, timeAgo, type Dashboard } from '@/lib/shared';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@/lib/hooks';
import { recordPayment, sendReminder } from '@/lib/actions';
import { Avatar, Button, Card, Icon, InvoicePill, Load, Pill, Row, Screen, T, TileIcon, useColors, type IconName } from '@/components/ui';

export default function Overview() {
  const c = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const q = useQuery<Dashboard>('/dashboard');

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Load q={q}>{d => {
        const hr = new Date().getHours();
        const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
        const occ = d.unitCount ? (d.occupiedCount / d.unitCount) * 100 : 0;
        const max = Math.max(...d.flow.map(f => f.amount), 1);
        const quick: [string, IconName, () => void, number?][] = [
          ['Record rent', 'wallet-outline', () => router.push('/payments')],
          ['Add unit', 'add', () => router.push('/add-unit')],
          ['Screen', 'clipboard-outline', () => router.push('/applications'), d.pendingApplications],
          ['Repairs', 'construct-outline', () => router.push('/maintenance'), d.openTickets]
        ];
        return <>
          <View style={{ gap: 4 }}>
            <T v="eyebrow">Financial command</T>
            <T v="h1">{greet}, {user?.name.split(' ')[0]}</T>
            <Pill label={`${d.unitCount} units · ${periodLabel(d.period)}`} tone="info" />
          </View>

          <Card>
            <Row between><T v="muted">Collected ({periodLabel(d.period, true)})</T><TileIcon name="wallet-outline" tone="good" /></Row>
            <T v="big">{formatINR(d.collected)}</T>
          </Card>
          <Row style={{ alignItems: 'stretch' }}>
            <Card style={{ flex: 1 }}>
              <T v="sm">Overdue</T>
              <T v="mid">{formatINR(d.overdueAmount)}</T>
              <Pill label={d.overdueCount ? `${d.overdueCount} late` : 'Nobody late'} tone={d.overdueCount ? 'warn' : 'good'} />
            </Card>
            <Card style={{ flex: 1 }}>
              <T v="sm">Occupancy</T>
              <T v="mid">{occ.toFixed(1)}%</T>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: c.sunk }}><View style={{ height: 6, borderRadius: 3, width: `${occ}%`, backgroundColor: c.brand }} /></View>
              <T v="sm">{d.occupiedCount}/{d.unitCount} units let</T>
            </Card>
          </Row>

          <Row style={{ alignItems: 'stretch' }}>
            {quick.map(([label, icon, go, badge], i) => (
              <Pressable key={label} onPress={go} style={{ flex: 1, backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, borderRadius: 16, alignItems: 'center', paddingVertical: 12, gap: 6 }} accessibilityRole="button" accessibilityLabel={label}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: i === 0 ? c.brand : c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={icon} size={19} color={i === 0 ? c.brandInk : c.brand} />
                </View>
                <T v="sm" color={c.ink}>{label}</T>
                {!!badge && <View style={{ position: 'absolute', top: 6, right: 8, backgroundColor: c.bad, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}><T v="sm" color="#fff" style={{ fontWeight: '800', fontSize: 10.5 }}>{badge}</T></View>}
              </Pressable>
            ))}
          </Row>

          {(d.overdue.length > 0 || d.expiring.length > 0) && <T v="eyebrow" color={c.bad}>● Action required</T>}
          {d.overdue.map(inv => (
            <Card key={inv.id} style={{ borderLeftWidth: 4, borderLeftColor: c.bad }}>
              <Row between><T v="h3" style={{ flex: 1 }}>{inv.unit.name} · Rent overdue</T><InvoicePill inv={inv} /></Row>
              <T v="sm">{inv.tenant.name} · {inv.property.name} · {formatINR(inv.amount)}{inv.remindedAt ? ` · reminded ${timeAgo(inv.remindedAt)}` : ''}</T>
              <Row>
                <Button title="Send reminder" icon="send" small style={{ flex: 1 }} onPress={() => sendReminder(inv, q.reload)} />
                <Button title="Record" icon="wallet-outline" kind="line" small onPress={() => recordPayment(inv, q.reload)} />
              </Row>
            </Card>
          ))}
          {d.expiring.map(x => (
            <Card key={x.leaseId} style={{ borderLeftWidth: 4, borderLeftColor: c.warn }}>
              <Row><TileIcon name="document-text-outline" tone="warn" />
                <View style={{ flex: 1 }}><T v="h3">{x.unit.name} lease expiring</T><T v="sm">{x.tenant.name} · {x.daysLeft} days left</T></View>
                <Button title="Open" kind="line" small onPress={() => router.push(`/unit/${x.unit.id}`)} />
              </Row>
            </Card>
          ))}

          <Card>
            <Row between><View><T v="eyebrow">Cash flow</T><T v="h2">Rent collected by month</T></View></Row>
            <Row style={{ alignItems: 'flex-end', height: 120, gap: 8 }}>
              {d.flow.map((f, i) => (
                <View key={f.period} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                  <T v="sm" style={{ fontSize: 10 }}>{formatCompactINR(f.amount).replace('₹', '')}</T>
                  <View style={{ width: '70%', height: Math.max(4, (f.amount / max) * 80), borderRadius: 6, backgroundColor: i === d.flow.length - 1 ? c.brand : c.brandSoft }} />
                  <T v="sm" color={i === d.flow.length - 1 ? c.brand : undefined}>{periodLabel(f.period, true)}</T>
                </View>
              ))}
            </Row>
          </Card>

          <Card>
            <T v="eyebrow">Recent payments</T>
            {d.activity.map(a => (
              <Row key={a.id}>
                <Avatar name={a.tenant.name} />
                <View style={{ flex: 1 }}><T v="h3" lines={1}>{a.unit.name} · {a.tenant.name}</T><T v="sm">{a.method?.replace('_', ' ')} · {a.paidAt && timeAgo(a.paidAt)}</T></View>
                <T v="h3" color={c.good}>+{formatINR(a.amount)}</T>
              </Row>
            ))}
          </Card>
        </>;
      }}</Load>
    </Screen>
  );
}
