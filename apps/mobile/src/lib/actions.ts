import { Alert } from 'react-native';
import { formatINR, periodLabel, type Invoice, type PaymentMethod } from './shared';
import { api } from './api';

const fail = (e: unknown) => Alert.alert('Could not finish that', (e as Error).message);

export async function sendReminder(inv: Invoice, done: () => void) {
  try {
    await api(`/invoices/${inv.id}/remind`, { method: 'POST' });
    Alert.alert('Reminder sent', `${inv.tenant.name} has been notified about ${formatINR(inv.amount)}.`);
    done();
  } catch (e) { fail(e); }
}

/** Staff records a payment received outside the app. */
export function recordPayment(inv: Invoice, done: () => void) {
  const record = async (method: PaymentMethod) => {
    try {
      await api(`/invoices/${inv.id}/record`, { body: { method } });
      Alert.alert('Payment recorded', `${formatINR(inv.amount)} from ${inv.tenant.name} for ${periodLabel(inv.period)}.`);
      done();
    } catch (e) { fail(e); }
  };
  Alert.alert(`Record ${formatINR(inv.amount)}`, `${inv.unit.name} · ${inv.tenant.name}\nHow was it paid?`, [
    { text: 'UPI', onPress: () => record('UPI') },
    { text: 'Bank transfer', onPress: () => record('BANK_TRANSFER') },
    { text: 'Cash', onPress: () => record('CASH') },
    { text: 'Cancel', style: 'cancel' }
  ]);
}

/** Tenant pays their own invoice (test mode until a payment gateway is connected). */
export function payInvoice(inv: Invoice, done: () => void) {
  const pay = async (method: 'UPI' | 'CARD' | 'NETBANKING') => {
    try {
      const r = await api<Invoice>(`/invoices/${inv.id}/pay`, { body: { method } });
      Alert.alert('Payment successful', `${formatINR(r.amount)} paid. Receipt ${r.reference}.`);
      done();
    } catch (e) { fail(e); }
  };
  Alert.alert(`Pay ${formatINR(inv.amount)}`, `${periodLabel(inv.period)} rent.\nTest mode: no money moves yet.`, [
    { text: 'UPI', onPress: () => pay('UPI') },
    { text: 'Card', onPress: () => pay('CARD') },
    { text: 'NetBanking', onPress: () => pay('NETBANKING') },
    { text: 'Cancel', style: 'cancel' }
  ]);
}
