import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate, formatINR, type Unit } from '@/lib/shared';
import { useQuery } from '@/lib/hooks';
import { Avatar, Button, Card, Chip, Empty, Icon, InvoicePill, Load, Pill, Row, Screen, T, useColors } from '@/components/ui';

type Filter = 'ALL' | 'OCCUPIED' | 'VACANT' | 'OVERDUE';
const rank = (u: Unit) => (u.openInvoice?.status === 'OVERDUE' ? 0 : u.status === 'VACANT' ? 1 : u.openInvoice ? 2 : 3);

export default function Properties() {
  const c = useColors();
  const router = useRouter();
  const q = useQuery<Unit[]>('/units');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');

  const all = q.data ?? [];
  const counts = {
    ALL: all.length, OCCUPIED: all.filter(u => u.status === 'OCCUPIED').length,
    VACANT: all.filter(u => u.status === 'VACANT').length, OVERDUE: all.filter(u => u.openInvoice?.status === 'OVERDUE').length
  };
  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all
      .filter(u => filter === 'ALL' || (filter === 'OVERDUE' ? u.openInvoice?.status === 'OVERDUE' : u.status === filter))
      .filter(u => !s || [u.name, u.property.name, u.lease?.tenant.name, ...(u.lease?.coTenantNames ?? [])].join(' ').toLowerCase().includes(s))
      .sort((a, b) => rank(a) - rank(b));
  }, [all, filter, search]);

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Row style={{ height: 44, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: 12 }}>
        <Icon name="search" color={c.muted} />
        <TextInput style={{ flex: 1, color: c.ink, fontSize: 15 }} placeholder="Search property, unit or tenant" placeholderTextColor={c.muted} value={search} onChangeText={setSearch} accessibilityLabel="Search units" />
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {([['ALL', 'All units'], ['OCCUPIED', 'Occupied'], ['VACANT', 'Vacant'], ['OVERDUE', 'Overdue']] as const).map(([k, l]) =>
          <Chip key={k} label={l} count={counts[k]} active={filter === k} onPress={() => setFilter(k)} />)}
      </ScrollView>
      <Row between><T v="h2">Units & leases</T><Button title="Add unit" icon="add" small onPress={() => router.push('/add-unit')} /></Row>
      <Load q={q}>{() => list.length === 0 ? <Card><Empty text={all.length ? 'No units match.' : 'No units yet. Add your first unit.'} /></Card> : <>
        {list.map(u => (
          <Pressable key={u.id} onPress={() => router.push(`/unit/${u.id}`)} accessibilityRole="button" accessibilityLabel={`${u.property.name} ${u.name}`}>
            <Card>
              <Row between style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}><T v="eyebrow">{u.property.name}</T><T v="h2">{u.name}</T></View>
                {u.status === 'VACANT' ? <Pill label="Vacant" tone="info" /> : u.openInvoice ? <InvoicePill inv={u.openInvoice} /> : <Pill label="Paid" tone="good" />}
              </Row>
              <Card flat style={{ padding: 10 }}>
                {u.lease ? (
                  <Row><Avatar name={u.lease.tenant.name} size={30} />
                    <View style={{ flex: 1 }}><T v="h3" lines={1}>{[u.lease.tenant.name, ...u.lease.coTenantNames].join(' & ')}</T><T v="sm">Lease ends {formatDate(u.lease.endDate)}</T></View></Row>
                ) : <T v="h3">{u.pendingApplications ? `${u.pendingApplications} pending applications` : 'No applications yet'}</T>}
              </Card>
              <Row between>
                <View><T v="eyebrow" color={u.openInvoice?.status === 'OVERDUE' ? c.bad : undefined}>{u.status === 'VACANT' ? 'Target rent' : u.openInvoice ? 'Balance due' : 'Rent'}</T>
                  <T v="mid" style={{ fontSize: 18 }}>{formatINR(u.openInvoice?.amount ?? u.rent)}</T></View>
                <Icon name="chevron-forward" color={c.muted} />
              </Row>
            </Card>
          </Pressable>
        ))}
      </>}</Load>
    </Screen>
  );
}
