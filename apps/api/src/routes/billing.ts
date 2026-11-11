import { Router, type Request } from 'express';
import { z } from 'zod';
import { formatINR, normalizePhone, periodLabel, periodOf } from '@rentora/shared';
import type { Prisma } from '@prisma/client';
import { db } from '../db';
import { hashPassword, isStaff, me, requireRole, tempPassword } from '../lib/auth';
import { HttpError, badRequest, conflict, forbidden, handle, notFound, parse } from '../lib/http';
import { activeLeaseFor, ensureInvoice, invoiceInclude, moveIn, notify, propertyScope, staffIds, toInvoice, toLease } from '../lib/domain';

export const leases = Router();
export const invoices = Router();

const staff = requireRole('OWNER', 'MANAGER');
const METHODS = ['UPI', 'CARD', 'NETBANKING', 'BANK_TRANSFER', 'CASH', 'CHEQUE'] as const;

/* ---------- leases ---------- */

const phoneField = z.string().transform((v, ctx) => {
  const p = normalizePhone(v);
  if (!p) ctx.addIssue({ code: 'custom', message: 'Enter a 10-digit Indian mobile number.' });
  return p ?? '';
});

leases.post('/', staff, handle(async req => {
  const body = parse(z.object({
    unitId: z.string(),
    name: z.string().trim().min(2, 'Enter the tenant’s full name.'),
    phone: phoneField,
    email: z.string().email().nullable().optional(),
    startDate: z.coerce.date(),
    months: z.coerce.number().int().min(1).max(60).default(11),
    rent: z.coerce.number().int().positive(),
    deposit: z.coerce.number().int().min(0),
    coTenantNames: z.array(z.string().trim().min(1)).max(4).optional()
  }), req.body);
  const unit = await db.unit.findFirst({ where: { id: body.unitId, property: propertyScope(me(req)) } });
  if (!unit) throw notFound('Unit');
  const r = await moveIn(body, hashPassword, tempPassword);
  return { leaseId: r.lease.id, tenantId: r.tenant.id, tempPassword: r.tempPassword };
}));

async function staffLease(req: Request) {
  const lease = await db.lease.findFirst({
    where: { id: req.params.id, unit: { property: propertyScope(me(req)) } },
    include: { tenant: true, unit: { include: { property: true } } }
  });
  if (!lease) throw notFound('Lease');
  return lease;
}

leases.post('/:id/renew', staff, handle(async req => {
  const body = parse(z.object({ months: z.coerce.number().int().min(1).max(60).default(12), rent: z.coerce.number().int().positive().optional() }), req.body);
  const lease = await staffLease(req);
  if (lease.status !== 'ACTIVE') throw conflict('Only an active lease can be renewed.');
  const end = new Date(lease.endDate);
  end.setMonth(end.getMonth() + body.months);
  const updated = await db.lease.update({ where: { id: lease.id }, data: { endDate: end, rent: body.rent ?? lease.rent }, include: { tenant: true } });
  if (body.rent) await db.unit.update({ where: { id: lease.unitId }, data: { rent: body.rent } });
  await notify([lease.tenantId], {
    title: 'Lease renewed',
    body: `Your lease for ${lease.unit.name} now runs until ${end.toDateString()} at ${formatINR(updated.rent)}/month.`,
    tone: 'good'
  });
  return toLease(updated);
}));

leases.post('/:id/end', staff, handle(async req => {
  const lease = await staffLease(req);
  if (lease.status !== 'ACTIVE') throw conflict('This lease has already ended.');
  await db.$transaction([
    db.lease.update({ where: { id: lease.id }, data: { status: 'ENDED', endDate: new Date() } }),
    db.unit.update({ where: { id: lease.unitId }, data: { status: 'VACANT' } })
  ]);
  await notify([lease.tenantId], { title: 'Lease ended', body: `Your lease for ${lease.unit.name} has been closed.`, tone: 'info' });
  return { ok: true };
}));

leases.patch('/mine', requireRole('TENANT'), handle(async req => {
  const body = parse(z.object({ autopay: z.boolean() }), req.body);
  const lease = await activeLeaseFor(me(req).id);
  if (!lease) throw notFound('Active lease');
  const updated = await db.lease.update({ where: { id: lease.id }, data: { autopay: body.autopay }, include: { tenant: true } });
  return toLease(updated);
}));

/* ---------- invoices ---------- */

invoices.get('/', handle(async req => {
  const u = me(req);
  const q = parse(z.object({ status: z.enum(['DUE', 'OVERDUE', 'PAID', 'UNPAID']).optional(), period: z.string().regex(/^\d{4}-\d{2}$/).optional() }), req.query);
  const where: Prisma.InvoiceWhereInput = isStaff(u)
    ? { lease: { unit: { property: propertyScope(u) } } }
    : { lease: { tenantId: u.id } };
  if (q.period) where.period = q.period;
  if (q.status === 'PAID') where.paidAt = { not: null };
  if (q.status && q.status !== 'PAID') where.paidAt = null;
  const rows = await db.invoice.findMany({ where, include: invoiceInclude, orderBy: [{ paidAt: { sort: 'desc', nulls: 'first' } }, { dueDate: 'desc' }], take: 200 });
  const now = new Date();
  let list = rows.map(i => toInvoice(i, now));
  if (q.status === 'DUE' || q.status === 'OVERDUE') list = list.filter(i => i.status === q.status);
  return list;
}));

invoices.post('/generate', staff, handle(async req => {
  const body = parse(z.object({ period: z.string().regex(/^\d{4}-\d{2}$/).optional() }), req.body ?? {});
  const period = body.period ?? periodOf(new Date());
  const active = await db.lease.findMany({ where: { status: 'ACTIVE', unit: { property: propertyScope(me(req)) } } });
  let created = 0;
  for (const l of active) if (await ensureInvoice(l, period)) created++;
  return { period, created, label: `${created} invoice${created === 1 ? '' : 's'} created for ${periodLabel(period)}` };
}));

async function loadInvoice(id: string) {
  const inv = await db.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!inv) throw notFound('Invoice');
  return inv;
}
const canStaff = (inv: Awaited<ReturnType<typeof loadInvoice>>, userId: string) =>
  staffIds(inv.lease.unit.property).includes(userId);

invoices.post('/:id/record', staff, handle(async req => {
  const body = parse(z.object({ method: z.enum(METHODS), reference: z.string().trim().max(80).optional() }), req.body);
  const inv = await loadInvoice(req.params.id);
  if (!canStaff(inv, me(req).id)) throw forbidden();
  if (inv.paidAt) throw conflict('This invoice is already paid.');
  const updated = await db.invoice.update({
    where: { id: inv.id },
    data: { paidAt: new Date(), method: body.method, reference: body.reference || null },
    include: invoiceInclude
  });
  await notify([inv.lease.tenantId], { title: 'Payment received', body: `${formatINR(inv.amount)} for ${periodLabel(inv.period)} rent was recorded. Thank you!`, tone: 'good' });
  return toInvoice(updated);
}));

invoices.post('/:id/remind', staff, handle(async req => {
  const inv = await loadInvoice(req.params.id);
  if (!canStaff(inv, me(req).id)) throw forbidden();
  if (inv.paidAt) throw conflict('This invoice is already paid.');
  if (inv.remindedAt && Date.now() - inv.remindedAt.getTime() < 12 * 3600 * 1000) {
    throw new HttpError(429, `A reminder was already sent to ${inv.lease.tenant.name} in the last 12 hours.`);
  }
  const updated = await db.invoice.update({ where: { id: inv.id }, data: { remindedAt: new Date() }, include: invoiceInclude });
  const status = toInvoice(updated).status;
  await notify([inv.lease.tenantId], {
    title: status === 'OVERDUE' ? 'Rent overdue' : 'Rent reminder',
    body: `${formatINR(inv.amount)} for ${periodLabel(inv.period)} ${status === 'OVERDUE' ? 'is overdue' : 'is due'} for ${inv.lease.unit.name}. Pay from the Rentora app.`,
    tone: status === 'OVERDUE' ? 'bad' : 'warn'
  });
  return toInvoice(updated);
}));

/**
 * Tenant pays their own invoice. There is no payment gateway yet, so this records the payment directly
 * with a generated reference. Swap this for a gateway order + webhook (e.g. Razorpay) before going live.
 */
invoices.post('/:id/pay', requireRole('TENANT'), handle(async req => {
  const body = parse(z.object({ method: z.enum(['UPI', 'CARD', 'NETBANKING']) }), req.body);
  const inv = await loadInvoice(req.params.id);
  if (inv.lease.tenantId !== me(req).id) throw forbidden();
  if (inv.paidAt) throw conflict('This invoice is already paid.');
  if (inv.amount <= 0) throw badRequest('Nothing to pay on this invoice.');
  const reference = `RNT-${inv.period.replace('-', '')}-${inv.id.slice(-6).toUpperCase()}`;
  const updated = await db.invoice.update({ where: { id: inv.id }, data: { paidAt: new Date(), method: body.method, reference }, include: invoiceInclude });
  await notify(staffIds(inv.lease.unit.property), {
    title: `Rent received: ${inv.lease.unit.name}`,
    body: `${inv.lease.tenant.name} paid ${formatINR(inv.amount)} for ${periodLabel(inv.period)}.`,
    tone: 'good'
  });
  return toInvoice(updated);
}));
