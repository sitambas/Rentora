import { Router } from 'express';
import { z } from 'zod';
import { normalizePhone, type Property, type Unit } from '@rentora/shared';
import type { Prisma } from '@prisma/client';
import { db } from '../db';
import { me, requireRole } from '../lib/auth';
import { badRequest, conflict, forbidden, handle, notFound, parse } from '../lib/http';
import { invoiceInclude, propertyScope, toInvoice, toTicket, toUnit, ticketInclude, unitForUser, unitInclude } from '../lib/domain';

export const properties = Router();
export const units = Router();

const staff = requireRole('OWNER', 'MANAGER');

/* ---------- properties ---------- */

const propertyInclude = { units: { select: { status: true, rent: true } }, manager: true } satisfies Prisma.PropertyInclude;
const toProperty = (p: Prisma.PropertyGetPayload<{ include: typeof propertyInclude }>): Property => ({
  id: p.id,
  name: p.name,
  address: p.address,
  city: p.city,
  unitCount: p.units.length,
  occupiedCount: p.units.filter(u => u.status === 'OCCUPIED').length,
  monthlyRent: p.units.filter(u => u.status === 'OCCUPIED').reduce((a, u) => a + u.rent, 0),
  manager: p.manager ? { id: p.manager.id, name: p.manager.name } : null
});

async function managerIdFrom(phone: string | null | undefined) {
  if (phone === undefined) return undefined;
  if (phone === null || phone === '') return null;
  const p = normalizePhone(phone);
  if (!p) throw badRequest('Enter the manager’s 10-digit mobile number.');
  const m = await db.user.findUnique({ where: { phone: p } });
  if (!m || m.role !== 'MANAGER') throw badRequest('No property manager account uses that number. Ask them to sign up as a manager first.');
  return m.id;
}

properties.get('/', staff, handle(async req => {
  const rows = await db.property.findMany({ where: propertyScope(me(req)), include: propertyInclude, orderBy: { name: 'asc' } });
  return rows.map(toProperty);
}));

const propertyBody = z.object({
  name: z.string().trim().min(2, 'Enter the property name.'),
  address: z.string().trim().min(3, 'Enter the street address.'),
  city: z.string().trim().min(2, 'Enter the city.'),
  managerPhone: z.string().nullable().optional()
});

properties.post('/', requireRole('OWNER'), handle(async req => {
  const body = parse(propertyBody, req.body);
  const p = await db.property.create({
    data: { name: body.name, address: body.address, city: body.city, ownerId: me(req).id, managerId: await managerIdFrom(body.managerPhone) ?? null },
    include: propertyInclude
  });
  return toProperty(p);
}));

properties.patch('/:id', requireRole('OWNER'), handle(async req => {
  const body = parse(propertyBody.partial(), req.body);
  const p = await db.property.findUnique({ where: { id: req.params.id } });
  if (!p) throw notFound('Property');
  if (p.ownerId !== me(req).id) throw forbidden();
  const { managerPhone, ...rest } = body;
  const updated = await db.property.update({
    where: { id: p.id },
    data: { ...rest, managerId: await managerIdFrom(managerPhone) },
    include: propertyInclude
  });
  return toProperty(updated);
}));

/* ---------- units ---------- */

units.get('/', staff, handle(async (req): Promise<Unit[]> => {
  const q = parse(z.object({
    status: z.enum(['VACANT', 'OCCUPIED', 'OVERDUE']).optional(),
    propertyId: z.string().optional(),
    q: z.string().optional()
  }), req.query);
  const where: Prisma.UnitWhereInput = { property: propertyScope(me(req)) };
  if (q.propertyId) where.propertyId = q.propertyId;
  if (q.status === 'VACANT' || q.status === 'OCCUPIED') where.status = q.status;
  if (q.q?.trim()) {
    const s = { contains: q.q.trim(), mode: 'insensitive' as const };
    where.OR = [
      { name: s },
      { property: { name: s } },
      { leases: { some: { status: 'ACTIVE', OR: [{ tenant: { name: s } }, { coTenantNames: { has: q.q.trim() } }] } } }
    ];
  }
  const rows = await db.unit.findMany({ where, include: unitInclude, orderBy: [{ property: { name: 'asc' } }, { name: 'asc' }] });
  let list = rows.map(toUnit);
  if (q.status === 'OVERDUE') list = list.filter(u => u.openInvoice?.status === 'OVERDUE');
  return list;
}));

units.get('/:id', staff, handle(async req => {
  await unitForUser(me(req), req.params.id);
  const unit = await db.unit.findUniqueOrThrow({ where: { id: req.params.id }, include: unitInclude });
  const [invoices, tickets] = await Promise.all([
    db.invoice.findMany({ where: { lease: { unitId: unit.id } }, include: invoiceInclude, orderBy: { dueDate: 'desc' }, take: 12 }),
    db.maintenanceTicket.findMany({ where: { unitId: unit.id }, include: ticketInclude, orderBy: { createdAt: 'desc' }, take: 10 })
  ]);
  return { ...toUnit(unit), invoices: invoices.map(i => toInvoice(i)), tickets: tickets.map(toTicket) };
}));

const unitBody = z.object({
  propertyId: z.string(),
  name: z.string().trim().min(1, 'Enter the unit name, e.g. Unit 102.'),
  rent: z.coerce.number().int().positive('Enter the monthly rent.'),
  deposit: z.coerce.number().int().min(0).optional()
});

units.post('/', staff, handle(async req => {
  const body = parse(unitBody, req.body);
  const prop = await db.property.findFirst({ where: { id: body.propertyId, ...propertyScope(me(req)) } });
  if (!prop) throw notFound('Property');
  if (await db.unit.findUnique({ where: { propertyId_name: { propertyId: prop.id, name: body.name } } })) {
    throw conflict(`${prop.name} already has a unit called ${body.name}.`);
  }
  const u = await db.unit.create({
    data: { propertyId: prop.id, name: body.name, rent: body.rent, deposit: body.deposit ?? body.rent * 2 },
    include: unitInclude
  });
  return toUnit(u);
}));

units.patch('/:id', staff, handle(async req => {
  const body = parse(unitBody.omit({ propertyId: true }).partial(), req.body);
  await unitForUser(me(req), req.params.id);
  const u = await db.unit.update({ where: { id: req.params.id }, data: body, include: unitInclude });
  return toUnit(u);
}));
