// Types and helpers shared by the API, web app and mobile app.
// Keep this package free of runtime dependencies so Metro and Next can both bundle it.

export type Role = 'OWNER' | 'MANAGER' | 'TENANT';
export type UnitStatus = 'VACANT' | 'OCCUPIED';
export type InvoiceStatus = 'DUE' | 'OVERDUE' | 'PAID';
export type TicketStatus = 'OPEN' | 'SCHEDULED' | 'IN_PROGRESS' | 'RESOLVED';
export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PaymentMethod = 'UPI' | 'CARD' | 'NETBANKING' | 'BANK_TRANSFER' | 'CASH' | 'CHEQUE';
export type Tone = 'info' | 'good' | 'warn' | 'bad';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Card' },
  { value: 'NETBANKING', label: 'NetBanking' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer (NEFT/IMPS)' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' }
];

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Open',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved'
};

export interface Ref { id: string; name: string }

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: Role;
}

export interface AuthResponse { token: string; user: User }

export interface InvoiceItem { label: string; amount: number }

export interface Invoice {
  id: string;
  period: string; // YYYY-MM
  dueDate: string;
  amount: number;
  items: InvoiceItem[];
  status: InvoiceStatus;
  paidAt: string | null;
  method: PaymentMethod | null;
  reference: string | null;
  remindedAt: string | null;
  unit: Ref;
  property: Ref;
  tenant: Ref & { phone: string };
}

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  unitCount: number;
  occupiedCount: number;
  monthlyRent: number;
  manager: Ref | null;
}

export interface Lease {
  id: string;
  startDate: string;
  endDate: string;
  rent: number;
  deposit: number;
  autopay: boolean;
  coTenantNames: string[];
  tenant: Ref & { phone: string };
}

export interface Unit {
  id: string;
  name: string;
  rent: number;
  deposit: number;
  status: UnitStatus;
  property: Ref;
  lease: Lease | null;
  openInvoice: Invoice | null;
  pendingApplications: number;
}

export interface ExpiringLease { leaseId: string; unit: Ref; property: Ref; tenant: Ref; endDate: string; daysLeft: number }

export interface Dashboard {
  period: string;
  collected: number;
  collectedPrev: number;
  overdueAmount: number;
  overdueCount: number;
  unitCount: number;
  occupiedCount: number;
  openTickets: number;
  pendingApplications: number;
  flow: { period: string; amount: number }[];
  activity: Invoice[];
  overdue: Invoice[];
  expiring: ExpiringLease[];
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  scheduledFor: string | null;
  assignee: string | null;
  createdAt: string;
  unit: Ref;
  property: Ref;
  createdBy: Ref;
}

export interface Message { id: string; body: string; createdAt: string; mine: boolean }

export interface Conversation {
  user: Ref & { role: Role };
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
}

export interface Notice { id: string; title: string; body: string; eventAt: string | null; createdAt: string; property: Ref }

export interface Application {
  id: string;
  name: string;
  phone: string;
  creditScore: number;
  monthlyIncome: number;
  status: ApplicationStatus;
  createdAt: string;
  unit: Ref;
  property: Ref;
}

export interface Parcel { id: string; carrier: string; locker: string; pin: string; deliveredAt: string; collectedAt: string | null; unit: Ref }

export interface Notification { id: string; title: string; body: string; tone: Tone; readAt: string | null; createdAt: string }

export interface TenantHome {
  unit: Ref;
  property: Ref & { address: string; city: string };
  lease: Lease;
  invoice: Invoice | null;
  history: Invoice[];
  parcels: Parcel[];
  tickets: Ticket[];
  notices: Notice[];
  manager: (Ref & { phone: string; role: Role }) | null;
}

export interface ApiErrorBody { error: string; details?: unknown }

/* ---------- helpers ---------- */

export function formatINR(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

/** ₹2,32,000 → "₹2.32L"; under a lakh stays in thousands. */
export function formatCompactINR(n: number): string {
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2).replace(/\.?0+$/, '')}L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return formatINR(n);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function periodOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function periodLabel(period: string, short = false): string {
  const [y, m] = period.split('-').map(Number);
  const name = MONTHS[m - 1];
  return short ? name.slice(0, 3) : `${name} ${y}`;
}

export function shiftPeriod(period: string, months: number): string {
  const [y, m] = period.split('-').map(Number);
  return periodOf(new Date(y, m - 1 + months, 1));
}

export function invoiceStatus(dueDate: Date | string, paidAt: Date | string | null, now: Date = new Date()): InvoiceStatus {
  if (paidAt) return 'PAID';
  const due = new Date(dueDate);
  const endOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1);
  return now >= endOfDue ? 'OVERDUE' : 'DUE';
}

export function daysBetween(from: Date | string, to: Date | string): number {
  const a = new Date(from), b = new Date(to);
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

export function formatDate(d: Date | string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  return new Date(d).toLocaleDateString('en-IN', opts);
}

export function timeAgo(d: Date | string, now: Date = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(d, { day: 'numeric', month: 'short' });
}

export function initials(name: string): string {
  return name.split(/[\s&]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/** Indian mobile number: 10 digits starting 6-9, optional +91. Returns the bare 10 digits or null. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}
