import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text as RNText, TextInput, useColorScheme, View,
  type StyleProp, type TextStyle, type ViewStyle
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { daysBetween, initials, TICKET_STATUS_LABEL, type Invoice, type TicketStatus } from '@/lib/shared';

/* ---------- theme ---------- */
const light = {
  bg: '#EEF1F8', surface: '#FFFFFF', sunk: '#F5F7FC', ink: '#0F1730', muted: '#647089', line: '#E2E7F1',
  brand: '#1F4FD8', brandInk: '#FFFFFF', brandSoft: '#E8EEFF',
  good: '#0E9A63', goodSoft: '#DCF5E9', warn: '#B86E00', warnSoft: '#FFF0D4', bad: '#D23A3A', badSoft: '#FDE5E5'
};
const dark: typeof light = {
  bg: '#080C18', surface: '#121A2C', sunk: '#0D1424', ink: '#E7ECF7', muted: '#8C97B1', line: '#232D45',
  brand: '#6B8CFF', brandInk: '#0A1024', brandSoft: '#1A2550',
  good: '#3DD69A', goodSoft: '#103327', warn: '#F2B44B', warnSoft: '#382A0F', bad: '#FF7A7A', badSoft: '#3B191D'
};
export type Colors = typeof light;
export const useColors = (): Colors => (useColorScheme() === 'dark' ? dark : light);

export type IconName = ComponentProps<typeof Ionicons>['name'];
export const Icon = ({ name, size = 18, color }: { name: IconName; size?: number; color?: string }) => {
  const c = useColors();
  return <Ionicons name={name} size={size} color={color ?? c.ink} />;
};

/* ---------- text ---------- */
type Variant = 'h1' | 'h2' | 'h3' | 'big' | 'mid' | 'body' | 'muted' | 'sm' | 'eyebrow';
const TYPE: Record<Variant, TextStyle> = {
  h1: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  h2: { fontSize: 17, fontWeight: '700' },
  h3: { fontSize: 15, fontWeight: '700' },
  big: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  mid: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  body: { fontSize: 14 },
  muted: { fontSize: 14 },
  sm: { fontSize: 12 },
  eyebrow: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }
};
export function T({ v = 'body', color, style, children, lines }: { v?: Variant; color?: string; style?: StyleProp<TextStyle>; children: ReactNode; lines?: number }) {
  const c = useColors();
  const fallback = v === 'muted' || v === 'sm' || v === 'eyebrow' ? c.muted : c.ink;
  return <RNText numberOfLines={lines} style={[TYPE[v], { color: color ?? fallback }, style]}>{children}</RNText>;
}

/* ---------- layout ---------- */
export function Screen({ children, refreshing, onRefresh }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  const c = useColors();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.brand} /> : undefined}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, flat }: { children: ReactNode; style?: StyleProp<ViewStyle>; flat?: boolean }) {
  const c = useColors();
  return <View style={[{ backgroundColor: flat ? c.sunk : c.surface, borderColor: flat ? 'transparent' : c.line, borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 }, style]}>{children}</View>;
}

export const Row = ({ children, style, between }: { children: ReactNode; style?: StyleProp<ViewStyle>; between?: boolean }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, between && { justifyContent: 'space-between' }, style]}>{children}</View>
);

export function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }} />;
}

/* ---------- controls ---------- */
type Kind = 'primary' | 'soft' | 'line' | 'good' | 'danger';
export function Button({ title, onPress, kind = 'primary', icon, disabled, small, style }: {
  title: string; onPress: () => void; kind?: Kind; icon?: IconName; disabled?: boolean; small?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg = { primary: c.brand, soft: c.brandSoft, line: c.surface, good: c.good, danger: c.badSoft }[kind];
  const fg = { primary: c.brandInk, soft: c.brand, line: c.ink, good: c.surface, danger: c.bad }[kind];
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={title}
      style={({ pressed }) => [{
        height: small ? 36 : 46, paddingHorizontal: small ? 12 : 16, borderRadius: small ? 10 : 12, backgroundColor: bg,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
        borderWidth: kind === 'line' ? 1 : 0, borderColor: c.line
      }, style]}>
      {icon && <Ionicons name={icon} size={small ? 15 : 17} color={fg} />}
      <RNText style={{ color: fg, fontWeight: '700', fontSize: small ? 13 : 14 }}>{title}</RNText>
    </Pressable>
  );
}

export function Chip({ label, count, active, onPress }: { label: string; count?: number; active: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityState={{ selected: active }}
      style={{ height: 34, paddingHorizontal: 13, borderRadius: 17, borderWidth: 1, borderColor: active ? c.brand : c.line, backgroundColor: active ? c.brand : c.surface, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <RNText style={{ color: active ? c.brandInk : c.ink, fontWeight: '600', fontSize: 13 }}>{label}</RNText>
      {count !== undefined && <RNText style={{ color: active ? c.brandInk : c.muted, fontWeight: '700', fontSize: 11 }}>{count}</RNText>}
    </Pressable>
  );
}

export function Field({ label, hint, ...props }: ComponentProps<typeof TextInput> & { label: string; hint?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <T v="sm" color={c.ink} style={{ fontWeight: '600' }}>{label}</T>
      <TextInput placeholderTextColor={c.muted} {...props}
        style={[{ minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.sunk, paddingHorizontal: 13, color: c.ink, fontSize: 15 },
          props.multiline && { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' }, props.style]} />
      {hint && <T v="sm">{hint}</T>}
    </View>
  );
}

/* ---------- status ---------- */
type Tone = 'good' | 'warn' | 'bad' | 'info' | 'muted';
export function Pill({ label, tone }: { label: string; tone: Tone }) {
  const c = useColors();
  const [bg, fg] = { good: [c.goodSoft, c.good], warn: [c.warnSoft, c.warn], bad: [c.badSoft, c.bad], info: [c.brandSoft, c.brand], muted: [c.sunk, c.muted] }[tone];
  return <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' }}><RNText style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{label}</RNText></View>;
}

export function InvoicePill({ inv }: { inv: Invoice }) {
  if (inv.status === 'PAID') return <Pill label="Paid" tone="good" />;
  if (inv.status === 'OVERDUE') { const d = daysBetween(inv.dueDate, new Date()); return <Pill label={`Overdue ${d}d`} tone="bad" />; }
  const d = daysBetween(new Date(), inv.dueDate);
  return <Pill label={d <= 0 ? 'Due today' : `Due in ${d}d`} tone="warn" />;
}

export const TicketPill = ({ status }: { status: TicketStatus }) =>
  <Pill label={TICKET_STATUS_LABEL[status]} tone={status === 'RESOLVED' ? 'good' : status === 'SCHEDULED' ? 'warn' : status === 'IN_PROGRESS' ? 'info' : 'bad'} />;

const AV = ['#1F4FD8', '#0E9A63', '#B8579B', '#D9792B', '#6A4BD6', '#2A8AA8', '#C0443F'];
export function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const bg = AV[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AV.length];
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
    <RNText style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.36 }}>{initials(name)}</RNText></View>;
}

export function TileIcon({ name, tone = 'info', round }: { name: IconName; tone?: Tone; round?: boolean }) {
  const c = useColors();
  const [bg, fg] = { good: [c.goodSoft, c.good], warn: [c.warnSoft, c.warn], bad: [c.badSoft, c.bad], info: [c.brandSoft, c.brand], muted: [c.sunk, c.ink] }[tone];
  return <View style={{ width: 38, height: 38, borderRadius: round ? 19 : 11, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={name} size={18} color={fg} /></View>;
}

/* ---------- states ---------- */
export function Loading() {
  const c = useColors();
  return <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={c.brand} /></View>;
}
export const Empty = ({ text }: { text: string }) => <T v="muted" style={{ textAlign: 'center', paddingVertical: 20 }}>{text}</T>;
export function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <Card><Row><TileIcon name="alert-circle-outline" tone="bad" /><T style={{ flex: 1 }}>{message}</T></Row><Button title="Try again" kind="line" small onPress={onRetry} /></Card>;
}

/** Renders loading / error / content for a query in one line. */
export function Load<D>({ q, children }: { q: { data: D | null; error: string | null; reload: () => void }; children: (d: D) => ReactNode }) {
  if (q.error && !q.data) return <ErrorView message={q.error} onRetry={q.reload} />;
  if (!q.data) return <Loading />;
  return <>{children(q.data)}</>;
}
