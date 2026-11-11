// Access scoping, record → API shape mapping, and the business actions several routes share.
import type { Prisma, Role } from '@prisma/client';
import { invoiceStatus, maskId, periodOf, type IdType, type Invoice, type InvoiceItem, type Lease, type TenantDetails, type Ticket, type Unit } from '@rentora/shared';
import { db } from '../db';
import type { AuthUser } from './auth';
import { conflict, forbidden, notFound } from './http';

/* ---------- scope ---------- */

/** Properties a staff member can see: ones they own or manage. */
export const propertyScope = (u: AuthUser): Prisma.PropertyWhereInput =>
  ({ OR: [{ ownerId: u.id }, { managerId: u.id }] });

export async function activeLeaseFor(tenantId: string) {
  return db.lease.findFirst({
    where: { tenantId, status: 'ACTIVE' },
    include: { tenant: true, unit: { include: { property: true } } },
    orderBy: { startDate: 'desc' }
  });
}

/** Loads a unit and checks the user may act on it (staff of its property, or its current tenant). */
export async function unitForUser(u: AuthUser, unitId: string) {
  const unit = await db.unit.findUnique({ where: { id: unitId }, include: { property: true } });
  if (!unit) throw notFound('Unit');
  if (u.role === 'TENANT') {
    const lease = await activeLeaseFor(u.id);
    if (lease?.unitId !== unitId) throw forbidden();
  } else if (unit.property.ownerId !== u.id && unit.property.managerId !== u.id) {
    throw forbidden();
  }
  return unit;
}

export const staffIds = (p: { ownerId: string; managerId: string | null }) =>
  [p.ownerId, p.managerId].filter((x): x is string => !!x);

/* ---------- notifications ---------- */

export async function notify(userIds: string[], n: { title: string; body: string; tone?: 'info' | 'good' | 'warn' | 'bad' }) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  await db.notification.createMany({ data: ids.map(userId => ({ userId, title: n.title, body: n.body, tone: n.tone ?? 'info' })) });
}

/* ---------- serializers ---------- */

export const invoiceInclude = { lease: { include: { tenant: true, unit: { include: { property: true } } } } } satisfies Prisma.InvoiceInclude;
type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

export function toInvoice(i: InvoiceRow, now = new Date()): Invoice {
  return {
    id: i.id,
    period: i.period,
    dueDate: i.dueDate.toISOString(),
    amount: i.amount,
    items: i.items as unknown as InvoiceItem[],
    status: invoiceStatus(i.dueDate, i.paidAt, now),
    paidAt: i.paidAt?.toISOString() ?? null,
    method: i.method,
    reference: i.reference,
    remindedAt: i.remindedAt?.toISOString() ?? null,
    unit: { id: i.lease.unit.id, name: i.lease.unit.name },
    property: { id: i.lease.unit.property.id, name: i.lease.unit.property.name },
    tenant: { id: i.lease.tenant.id, name: i.lease.tenant.name, phone: i.lease.tenant.phone }
  };
}

type LeaseRow = Prisma.LeaseGetPayload<{ include: { tenant: true } }>;
export const toLease = (l: LeaseRow): Lease => ({
  id: l.id,
  startDate: l.startDate.toISOString(),
  endDate: l.endDate.toISOString(),
  rent: l.rent,
  deposit: l.deposit,
  autopay: l.autopay,
  coTenantNames: l.coTenantNames,
  occupants: l.occupants,
  notes: l.notes,
  tenant: { id: l.tenant.id, name: l.tenant.name, phone: l.tenant.phone, loginEnabled: !l.tenant.disabledAt },
  tenantDetails: tenantDetails(l.tenant, false)
});

export const tenantDetails = (t: LeaseRow['tenant'], fullId: boolean): TenantDetails => ({
  email: t.email,
  dateOfBirth: t.dateOfBirth?.toISOString().slice(0, 10) ?? null,
  occupation: t.occupation,
  employer: t.employer,
  permanentAddress: t.permanentAddress,
  idType: (t.idType as IdType | null) ?? null,
  idNumber: t.idNumber ? (fullId ? t.idNumber : maskId(t.idNumber)) : null,
  emergencyName: t.emergencyName,
  emergencyRelation: t.emergencyRelation,
  emergencyPhone: t.emergencyPhone
});

export const unitInclude = {
  property: true,
  leases: {
    where: { status: 'ACTIVE' },
    include: {
      tenant: true,
      invoices: { where: { paidAt: null }, orderBy: { dueDate: 'asc' }, take: 1, include: invoiceInclude }
    },
    take: 1
  },
  _count: { select: { applications: { where: { status: 'PENDING' } } } }
} satisfies Prisma.UnitInclude;
type UnitRow = Prisma.UnitGetPayload<{ include: typeof unitInclude }>;

export function toUnit(u: UnitRow): Unit {
  const lease = u.leases[0];
  const inv = lease?.invoices[0];
  return {
    id: u.id,
    name: u.name,
    rent: u.rent,
    deposit: u.deposit,
    status: u.status,
    property: { id: u.property.id, name: u.property.name },
    lease: lease ? toLease(lease) : null,
    openInvoice: inv ? toInvoice(inv) : null,
    pendingApplications: u._count.applications
  };
}

export const ticketInclude = { unit: { include: { property: true } }, createdBy: true } satisfies Prisma.MaintenanceTicketInclude;
type TicketRow = Prisma.MaintenanceTicketGetPayload<{ include: typeof ticketInclude }>;
export const toTicket = (t: TicketRow): Ticket => ({
  id: t.id,
  title: t.title,
  description: t.description,
  status: t.status,
  scheduledFor: t.scheduledFor?.toISOString() ?? null,
  assignee: t.assignee,
  createdAt: t.createdAt.toISOString(),
  unit: { id: t.unit.id, name: t.unit.name },
  property: { id: t.unit.property.id, name: t.unit.property.name },
  createdBy: { id: t.createdBy.id, name: t.createdBy.name }
});

/* ---------- invoices & leases ---------- */

export const DUE_DAY = 5;

export function dueDateFor(period: string) {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, DUE_DAY, 12);
}

/** Creates the month's rent invoice for a lease if it does not exist yet. Returns true when created. */
export async function ensureInvoice(lease: { id: string; rent: number; startDate: Date; endDate: Date }, period: string, items?: InvoiceItem[]) {
  const [y, m] = period.split('-').map(Number);
  const monthStart = new Date(y, m - 1, 1), monthEnd = new Date(y, m, 0, 23, 59);
  if (lease.startDate > monthEnd || lease.endDate < monthStart) return false;
  const lineItems = items ?? [{ label: 'Rent', amount: lease.rent }];
  const amount = lineItems.reduce((a, i) => a + i.amount, 0);
  // A tenant who moves in after the 5th pays their first month on move-in day, not on a date already gone.
  let dueDate = dueDateFor(period);
  if (lease.startDate > dueDate) { dueDate = new Date(lease.startDate); dueDate.setHours(12, 0, 0, 0); }
  const res = await db.invoice.createMany({
    data: [{ leaseId: lease.id, period, dueDate, amount, items: lineItems as unknown as Prisma.InputJsonValue }],
    skipDuplicates: true
  });
  return res.count > 0;
}

/**
 * Moves a tenant into a vacant unit: finds or creates the tenant account, opens the lease,
 * marks the unit occupied and bills the first month. Returns a temporary password when an account was created.
 */
export type TenantProfile = Partial<{
  dateOfBirth: Date | null; occupation: string | null; employer: string | null; permanentAddress: string | null;
  idType: string | null; idNumber: string | null; emergencyName: string | null; emergencyRelation: string | null; emergencyPhone: string | null;
}>;

export async function moveIn(input: {
  unitId: string; name: string; phone: string; email?: string | null; password?: string;
  startDate: Date; months: number; rent: number; deposit: number; coTenantNames?: string[];
  occupants?: number; notes?: string | null; profile?: TenantProfile;
}, hash: (pw: string) => Promise<string>, makePassword: () => string) {
  const unit = await db.unit.findUnique({ where: { id: input.unitId }, include: { property: true } });
  if (!unit) throw notFound('Unit');
  if (unit.status !== 'VACANT') throw conflict(`${unit.name} already has a tenant.`);

  let tenant = await db.user.findUnique({ where: { phone: input.phone } });
  let temp: string | null = null;
  if (tenant && tenant.role !== 'TENANT') throw conflict('This phone number belongs to an owner or manager account.');
  if (tenant && await activeLeaseFor(tenant.id)) throw conflict(`${tenant.name} already has an active lease.`);
  if (!tenant) {
    temp = input.password ?? makePassword();
    tenant = await db.user.create({
      data: { name: input.name, phone: input.phone, email: input.email ?? null, role: 'TENANT', passwordHash: await hash(temp), ...input.profile }
    });
    if (input.password) temp = null;
  } else {
    // A returning tenant: keep their account, turn their login back on, refresh whatever details were given this time.
    const given = Object.fromEntries(Object.entries({ email: input.email, ...input.profile }).filter(([, v]) => v != null && v !== ''));
    tenant = await db.user.update({ where: { id: tenant.id }, data: { ...given, disabledAt: null } });
  }

  const endDate = new Date(input.startDate);
  endDate.setMonth(endDate.getMonth() + input.months);
  endDate.setDate(endDate.getDate() - 1);

  const lease = await db.$transaction(async tx => {
    const l = await tx.lease.create({
      data: {
        unitId: unit.id, tenantId: tenant!.id, startDate: input.startDate, endDate,
        rent: input.rent, deposit: input.deposit, coTenantNames: input.coTenantNames ?? [],
        occupants: input.occupants ?? 1 + (input.coTenantNames?.length ?? 0), notes: input.notes ?? null
      }
    });
    await tx.unit.update({ where: { id: unit.id }, data: { status: 'OCCUPIED', rent: input.rent, deposit: input.deposit } });
    return l;
  });
  await ensureInvoice(lease, periodOf(input.startDate));
  await notify([tenant.id], { title: `Welcome to ${unit.property.name}`, body: `Your lease for ${unit.name} starts ${input.startDate.toDateString()}.`, tone: 'good' });
  return { lease, tenant, tempPassword: temp };
}

export const roleLabel: Record<Role, string> = { OWNER: 'Owner', MANAGER: 'Property manager', TENANT: 'Tenant' };
