// Maintenance tickets, notices, rental applications and smart-locker parcels.
import { Router } from 'express';
import { z } from 'zod';
import { formatDate, normalizePhone, type Application, type Notice, type Parcel } from '@rentora/shared';
import type { Prisma } from '@prisma/client';
import { db } from '../db';
import { hashPassword, isStaff, me, requireRole, tempPassword } from '../lib/auth';
import { badRequest, conflict, forbidden, handle, notFound, parse } from '../lib/http';
import { activeLeaseFor, moveIn, notify, propertyScope, staffIds, ticketInclude, toTicket, unitForUser } from '../lib/domain';

export const tickets = Router();
export const notices = Router();
export const applications = Router();
export const parcels = Router();

const staff = requireRole('OWNER', 'MANAGER');

/* ---------- maintenance ---------- */

tickets.get('/', handle(async req => {
  const u = me(req);
  const q = parse(z.object({ status: z.enum(['open', 'resolved', 'all']).default('open') }), req.query);
  const where: Prisma.MaintenanceTicketWhereInput = isStaff(u)
    ? { unit: { property: propertyScope(u) } }
    : { unitId: (await activeLeaseFor(u.id))?.unitId ?? '__none__' };
  if (q.status === 'open') where.status = { not: 'RESOLVED' };
  if (q.status === 'resolved') where.status = 'RESOLVED';
  const rows = await db.maintenanceTicket.findMany({ where, include: ticketInclude, orderBy: { createdAt: 'desc' }, take: 100 });
  return rows.map(toTicket);
}));

tickets.post('/', handle(async req => {
  const u = me(req);
  const body = parse(z.object({
    title: z.string().trim().min(3, 'Describe what needs fixing.').max(120),
    description: z.string().trim().max(2000).default(''),
    unitId: z.string().optional()
  }), req.body);
  let unitId = body.unitId;
  if (u.role === 'TENANT') {
    const lease = await activeLeaseFor(u.id);
    if (!lease) throw badRequest('You need an active lease to raise a request.');
    unitId = lease.unitId;
  }
  if (!unitId) throw badRequest('Choose the unit this request is for.');
  const unit = await unitForUser(u, unitId);
  const t = await db.maintenanceTicket.create({
    data: { unitId, createdById: u.id, title: body.title, description: body.description },
    include: ticketInclude
  });
  await notify(staffIds(unit.property).filter(id => id !== u.id), {
    title: `New request: ${unit.name}`, body: body.title, tone: 'warn'
  });
  return toTicket(t);
}));

tickets.patch('/:id', staff, handle(async req => {
  const body = parse(z.object({
    status: z.enum(['OPEN', 'SCHEDULED', 'IN_PROGRESS', 'RESOLVED']).optional(),
    scheduledFor: z.coerce.date().nullable().optional(),
    assignee: z.string().trim().max(120).nullable().optional()
  }), req.body);
  const t = await db.maintenanceTicket.findUnique({ where: { id: req.params.id }, include: ticketInclude });
  if (!t) throw notFound('Request');
  await unitForUser(me(req), t.unitId);
  const status = body.status ?? (body.scheduledFor ? 'SCHEDULED' : undefined);
  const updated = await db.maintenanceTicket.update({ where: { id: t.id }, data: { ...body, status }, include: ticketInclude });
  if (t.createdById !== me(req).id) {
    const when = updated.scheduledFor ? ` for ${formatDate(updated.scheduledFor, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : '';
    const msg = updated.status === 'RESOLVED' ? `“${t.title}” is marked resolved.`
      : updated.status === 'SCHEDULED' ? `“${t.title}” is scheduled${when}${updated.assignee ? ` with ${updated.assignee}` : ''}.`
      : `“${t.title}” is now ${updated.status.toLowerCase().replace('_', ' ')}.`;
    await notify([t.createdById], { title: 'Maintenance update', body: msg, tone: updated.status === 'RESOLVED' ? 'good' : 'info' });
  }
  return toTicket(updated);
}));

/* ---------- notices ---------- */

const toNotice = (n: Prisma.NoticeGetPayload<{ include: { property: true } }>): Notice => ({
  id: n.id, title: n.title, body: n.body, eventAt: n.eventAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString(),
  property: { id: n.property.id, name: n.property.name }
});

notices.get('/', handle(async req => {
  const u = me(req);
  const where: Prisma.NoticeWhereInput = isStaff(u)
    ? { property: propertyScope(u) }
    : { propertyId: (await activeLeaseFor(u.id))?.unit.propertyId ?? '__none__' };
  const rows = await db.notice.findMany({ where, include: { property: true }, orderBy: { createdAt: 'desc' }, take: 50 });
  return rows.map(toNotice);
}));

notices.post('/', staff, handle(async req => {
  const body = parse(z.object({
    propertyId: z.string(),
    title: z.string().trim().min(3).max(120),
    body: z.string().trim().min(3).max(2000),
    eventAt: z.coerce.date().nullable().optional()
  }), req.body);
  const prop = await db.property.findFirst({ where: { id: body.propertyId, ...propertyScope(me(req)) } });
  if (!prop) throw notFound('Property');
  const n = await db.notice.create({ data: { ...body, eventAt: body.eventAt ?? null }, include: { property: true } });
  const tenants = await db.lease.findMany({ where: { status: 'ACTIVE', unit: { propertyId: prop.id } }, select: { tenantId: true } });
  await notify(tenants.map(t => t.tenantId), { title: `Notice: ${body.title}`, body: `${prop.name}: ${body.body.slice(0, 140)}`, tone: 'info' });
  return toNotice(n);
}));

notices.delete('/:id', staff, handle(async req => {
  const n = await db.notice.findFirst({ where: { id: req.params.id, property: propertyScope(me(req)) } });
  if (!n) throw notFound('Notice');
  await db.notice.delete({ where: { id: n.id } });
  return { ok: true };
}));

/* ---------- applications ---------- */

const appInclude = { unit: { include: { property: true } } } satisfies Prisma.ApplicationInclude;
const toApplication = (a: Prisma.ApplicationGetPayload<{ include: typeof appInclude }>): Application => ({
  id: a.id, name: a.name, phone: a.phone, creditScore: a.creditScore, monthlyIncome: a.monthlyIncome, status: a.status,
  createdAt: a.createdAt.toISOString(),
  unit: { id: a.unit.id, name: a.unit.name },
  property: { id: a.unit.property.id, name: a.unit.property.name }
});

applications.get('/', staff, handle(async req => {
  const q = parse(z.object({ unitId: z.string().optional(), status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING') }), req.query);
  const rows = await db.application.findMany({
    where: { status: q.status, unitId: q.unitId, unit: { property: propertyScope(me(req)) } },
    include: appInclude,
    orderBy: [{ creditScore: 'desc' }, { createdAt: 'asc' }]
  });
  return rows.map(toApplication);
}));

applications.post('/', staff, handle(async req => {
  const body = parse(z.object({
    unitId: z.string(),
    name: z.string().trim().min(2),
    phone: z.string(),
    creditScore: z.coerce.number().int().min(300).max(900),
    monthlyIncome: z.coerce.number().int().min(0)
  }), req.body);
  const phone = normalizePhone(body.phone);
  if (!phone) throw badRequest('Enter a 10-digit Indian mobile number.');
  const unit = await unitForUser(me(req), body.unitId);
  if (unit.status !== 'VACANT') throw conflict(`${unit.name} is not vacant.`);
  const a = await db.application.create({ data: { ...body, phone }, include: appInclude });
  return toApplication(a);
}));

applications.post('/:id/approve', staff, handle(async req => {
  const body = parse(z.object({ startDate: z.coerce.date().optional(), months: z.coerce.number().int().min(1).max(60).default(11) }), req.body ?? {});
  const a = await db.application.findUnique({ where: { id: req.params.id }, include: appInclude });
  if (!a) throw notFound('Application');
  const unit = await unitForUser(me(req), a.unitId);
  if (a.status !== 'PENDING') throw conflict('This application has already been decided.');
  const r = await moveIn({
    unitId: unit.id, name: a.name, phone: a.phone, startDate: body.startDate ?? new Date(), months: body.months,
    rent: unit.rent, deposit: unit.deposit
  }, hashPassword, tempPassword);
  await db.$transaction([
    db.application.update({ where: { id: a.id }, data: { status: 'APPROVED' } }),
    db.application.updateMany({ where: { unitId: unit.id, status: 'PENDING', id: { not: a.id } }, data: { status: 'REJECTED' } })
  ]);
  return { leaseId: r.lease.id, tenantId: r.tenant.id, tempPassword: r.tempPassword };
}));

applications.post('/:id/reject', staff, handle(async req => {
  const a = await db.application.findUnique({ where: { id: req.params.id } });
  if (!a) throw notFound('Application');
  await unitForUser(me(req), a.unitId);
  if (a.status !== 'PENDING') throw conflict('This application has already been decided.');
  await db.application.update({ where: { id: a.id }, data: { status: 'REJECTED' } });
  return { ok: true };
}));

/* ---------- parcels ---------- */

const toParcel = (p: Prisma.ParcelGetPayload<{ include: { unit: true } }>): Parcel => ({
  id: p.id, carrier: p.carrier, locker: p.locker, pin: p.pin, deliveredAt: p.deliveredAt.toISOString(),
  collectedAt: p.collectedAt?.toISOString() ?? null, unit: { id: p.unit.id, name: p.unit.name }
});

parcels.get('/', handle(async req => {
  const u = me(req);
  const where: Prisma.ParcelWhereInput = isStaff(u)
    ? { unit: { property: propertyScope(u) }, collectedAt: null }
    : { unitId: (await activeLeaseFor(u.id))?.unitId ?? '__none__', collectedAt: null };
  const rows = await db.parcel.findMany({ where, include: { unit: true }, orderBy: { deliveredAt: 'desc' } });
  return rows.map(toParcel);
}));

parcels.post('/', staff, handle(async req => {
  const body = parse(z.object({ unitId: z.string(), carrier: z.string().trim().min(2).max(60), locker: z.string().trim().min(1).max(20) }), req.body);
  const unit = await unitForUser(me(req), body.unitId);
  const pin = String(Math.floor(100000 + Math.random() * 900000));
  const p = await db.parcel.create({ data: { ...body, pin }, include: { unit: true } });
  const lease = await db.lease.findFirst({ where: { unitId: unit.id, status: 'ACTIVE' } });
  if (lease) await notify([lease.tenantId], { title: 'Package delivered', body: `${body.carrier} parcel is in locker ${body.locker}. Your PIN is in the app.`, tone: 'info' });
  return toParcel(p);
}));

parcels.post('/:id/collect', handle(async req => {
  const p = await db.parcel.findUnique({ where: { id: req.params.id } });
  if (!p) throw notFound('Parcel');
  await unitForUser(me(req), p.unitId).catch(() => { throw forbidden(); });
  const updated = await db.parcel.update({ where: { id: p.id }, data: { collectedAt: p.collectedAt ?? new Date() }, include: { unit: true } });
  return toParcel(updated);
}));
