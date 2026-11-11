// Messages, notifications and the tenant's home screen.
import { Router } from 'express';
import { z } from 'zod';
import type { Conversation, Notification, TenantHome } from '@rentora/shared';
import { db } from '../db';
import { me, requireRole, type AuthUser } from '../lib/auth';
import { forbidden, handle, notFound, parse } from '../lib/http';
import { activeLeaseFor, invoiceInclude, propertyScope, ticketInclude, toInvoice, toLease, toTicket } from '../lib/domain';

export const messages = Router();
export const notifications = Router();
export const home = Router();

/* ---------- messages ---------- */

/** People this user may message: tenants talk to their property's owner and manager; staff talk to their tenants and co-staff. */
async function contactsOf(u: AuthUser) {
  if (u.role === 'TENANT') {
    const lease = await activeLeaseFor(u.id);
    if (!lease) return [];
    const p = lease.unit.property;
    return db.user.findMany({ where: { id: { in: [p.ownerId, p.managerId].filter((x): x is string => !!x) } } });
  }
  const props = await db.property.findMany({ where: propertyScope(u), select: { id: true, ownerId: true, managerId: true } });
  const staffIds = props.flatMap(p => [p.ownerId, p.managerId]).filter((x): x is string => !!x && x !== u.id);
  return db.user.findMany({
    where: {
      OR: [
        { id: { in: staffIds } },
        { leases: { some: { status: 'ACTIVE', unit: { propertyId: { in: props.map(p => p.id) } } } } }
      ]
    },
    orderBy: { name: 'asc' }
  });
}

messages.get('/', handle(async (req): Promise<Conversation[]> => {
  const u = me(req);
  const contacts = await contactsOf(u);
  const rows = await Promise.all(contacts.map(async c => {
    const [last, unread] = await Promise.all([
      db.message.findFirst({
        where: { OR: [{ senderId: u.id, recipientId: c.id }, { senderId: c.id, recipientId: u.id }] },
        orderBy: { createdAt: 'desc' }
      }),
      db.message.count({ where: { senderId: c.id, recipientId: u.id, readAt: null } })
    ]);
    return {
      user: { id: c.id, name: c.name, role: c.role },
      lastMessage: last?.body ?? null,
      lastAt: last?.createdAt.toISOString() ?? null,
      unread
    };
  }));
  return rows.sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? '') || a.user.name.localeCompare(b.user.name));
}));

async function contact(u: AuthUser, otherId: string) {
  const c = (await contactsOf(u)).find(x => x.id === otherId);
  if (!c) throw forbidden('You can only message people connected to your properties.');
  return c;
}

messages.get('/:userId', handle(async req => {
  const u = me(req);
  const other = await contact(u, req.params.userId);
  const rows = await db.message.findMany({
    where: { OR: [{ senderId: u.id, recipientId: other.id }, { senderId: other.id, recipientId: u.id }] },
    orderBy: { createdAt: 'asc' },
    take: 200
  });
  await db.message.updateMany({ where: { senderId: other.id, recipientId: u.id, readAt: null }, data: { readAt: new Date() } });
  return {
    user: { id: other.id, name: other.name, role: other.role, phone: other.phone },
    messages: rows.map(m => ({ id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), mine: m.senderId === u.id }))
  };
}));

messages.post('/:userId', handle(async req => {
  const u = me(req);
  const body = parse(z.object({ body: z.string().trim().min(1, 'Write a message first.').max(2000) }), req.body);
  const other = await contact(u, req.params.userId);
  const m = await db.message.create({ data: { senderId: u.id, recipientId: other.id, body: body.body } });
  return { id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), mine: true };
}));

/* ---------- notifications ---------- */

notifications.get('/', handle(async (req): Promise<Notification[]> => {
  const rows = await db.notification.findMany({ where: { userId: me(req).id }, orderBy: { createdAt: 'desc' }, take: 50 });
  return rows.map(n => ({ id: n.id, title: n.title, body: n.body, tone: n.tone, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() }));
}));

notifications.post('/read-all', handle(async req => {
  await db.notification.updateMany({ where: { userId: me(req).id, readAt: null }, data: { readAt: new Date() } });
  return { ok: true };
}));

/* ---------- tenant home ---------- */

home.get('/', requireRole('TENANT'), handle(async (req): Promise<TenantHome> => {
  const u = me(req);
  const lease = await activeLeaseFor(u.id);
  if (!lease) throw notFound('Active lease');
  const p = lease.unit.property;
  const [openInvoice, history, parcelRows, ticketRows, noticeRows, manager] = await Promise.all([
    db.invoice.findFirst({ where: { leaseId: lease.id, paidAt: null }, include: invoiceInclude, orderBy: { dueDate: 'asc' } }),
    db.invoice.findMany({ where: { lease: { tenantId: u.id }, paidAt: { not: null } }, include: invoiceInclude, orderBy: { paidAt: 'desc' }, take: 12 }),
    db.parcel.findMany({ where: { unitId: lease.unitId, collectedAt: null }, include: { unit: true }, orderBy: { deliveredAt: 'desc' } }),
    db.maintenanceTicket.findMany({ where: { unitId: lease.unitId, status: { not: 'RESOLVED' } }, include: ticketInclude, orderBy: { createdAt: 'desc' } }),
    db.notice.findMany({ where: { propertyId: p.id }, include: { property: true }, orderBy: { createdAt: 'desc' }, take: 5 }),
    db.user.findUnique({ where: { id: p.managerId ?? p.ownerId } })
  ]);
  // Show the next unpaid bill, or else the latest paid one so the card can say "Paid".
  const invoice = openInvoice ?? (history[0] ?? null);
  return {
    unit: { id: lease.unit.id, name: lease.unit.name },
    property: { id: p.id, name: p.name, address: p.address, city: p.city },
    lease: toLease(lease),
    invoice: invoice ? toInvoice(invoice) : null,
    history: history.map(i => toInvoice(i)),
    parcels: parcelRows.map(x => ({
      id: x.id, carrier: x.carrier, locker: x.locker, pin: x.pin, deliveredAt: x.deliveredAt.toISOString(),
      collectedAt: null, unit: { id: x.unit.id, name: x.unit.name }
    })),
    tickets: ticketRows.map(toTicket),
    notices: noticeRows.map(n => ({
      id: n.id, title: n.title, body: n.body, eventAt: n.eventAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString(),
      property: { id: n.property.id, name: n.property.name }
    })),
    manager: manager ? { id: manager.id, name: manager.name, phone: manager.phone, role: manager.role } : null
  };
}));
