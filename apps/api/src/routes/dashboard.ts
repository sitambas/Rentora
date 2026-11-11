import { Router } from 'express';
import { daysBetween, periodOf, shiftPeriod, type Dashboard } from '@rentora/shared';
import { db } from '../db';
import { me, requireRole } from '../lib/auth';
import { handle } from '../lib/http';
import { invoiceInclude, propertyScope, toInvoice } from '../lib/domain';

export const dashboard = Router();

dashboard.get('/', requireRole('OWNER', 'MANAGER'), handle(async (req): Promise<Dashboard> => {
  const u = me(req);
  const now = new Date();
  const period = periodOf(now);
  const scope = { lease: { unit: { property: propertyScope(u) } } };
  const periods = Array.from({ length: 6 }, (_, i) => shiftPeriod(period, i - 5));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const soon = new Date(today); soon.setDate(soon.getDate() + 45);

  const [paidByPeriod, overdueRows, activityRows, unitCount, occupiedCount, openTickets, pendingApplications, expiringRows] = await Promise.all([
    db.invoice.groupBy({ by: ['period'], where: { ...scope, period: { in: periods }, paidAt: { not: null } }, _sum: { amount: true } }),
    db.invoice.findMany({ where: { ...scope, paidAt: null, dueDate: { lt: today } }, include: invoiceInclude, orderBy: { dueDate: 'asc' } }),
    db.invoice.findMany({ where: { ...scope, paidAt: { not: null } }, include: invoiceInclude, orderBy: { paidAt: 'desc' }, take: 6 }),
    db.unit.count({ where: { property: propertyScope(u) } }),
    db.unit.count({ where: { property: propertyScope(u), status: 'OCCUPIED' } }),
    db.maintenanceTicket.count({ where: { unit: { property: propertyScope(u) }, status: { not: 'RESOLVED' } } }),
    db.application.count({ where: { unit: { property: propertyScope(u) }, status: 'PENDING' } }),
    db.lease.findMany({
      where: { status: 'ACTIVE', endDate: { gte: today, lte: soon }, unit: { property: propertyScope(u) } },
      include: { tenant: true, unit: { include: { property: true } } },
      orderBy: { endDate: 'asc' }
    })
  ]);

  const sum = (p: string) => paidByPeriod.find(r => r.period === p)?._sum.amount ?? 0;
  const overdue = overdueRows.map(i => toInvoice(i, now));

  return {
    period,
    collected: sum(period),
    collectedPrev: sum(shiftPeriod(period, -1)),
    overdueAmount: overdue.reduce((a, i) => a + i.amount, 0),
    overdueCount: overdue.length,
    unitCount,
    occupiedCount,
    openTickets,
    pendingApplications,
    flow: periods.map(p => ({ period: p, amount: sum(p) })),
    activity: activityRows.map(i => toInvoice(i, now)),
    overdue,
    expiring: expiringRows.map(l => ({
      leaseId: l.id,
      unit: { id: l.unit.id, name: l.unit.name },
      property: { id: l.unit.property.id, name: l.unit.property.name },
      tenant: { id: l.tenant.id, name: l.tenant.name },
      rent: l.rent,
      endDate: l.endDate.toISOString(),
      daysLeft: daysBetween(now, l.endDate)
    }))
  };
}));
