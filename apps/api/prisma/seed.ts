// Demo data for local development. Wipes the database it points at, so never run it against production.
import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { periodOf, shiftPeriod } from '@rentora/shared';

const db = new PrismaClient();

export const DEMO_PASSWORD = 'demo1234';
export const DEMO = {
  owner: { name: 'Alex Sharma', phone: '9876500001' },
  manager: { name: 'Priya Nair', phone: '9876500002' },
  tenant: { name: 'Elena Rostova', phone: '9876500010' }
};

const day = (offset: number, base = new Date()) => { const d = new Date(base); d.setDate(d.getDate() + offset); d.setHours(12, 0, 0, 0); return d; };
const dueDate = (period: string) => { const [y, m] = period.split('-').map(Number); return new Date(y, m - 1, 5, 12); };

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed a production database.');
  await db.$transaction([
    db.notification.deleteMany(), db.message.deleteMany(), db.parcel.deleteMany(), db.application.deleteMany(),
    db.notice.deleteMany(), db.maintenanceTicket.deleteMany(), db.invoice.deleteMany(), db.lease.deleteMany(),
    db.unit.deleteMany(), db.property.deleteMany(), db.user.deleteMany()
  ]);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const owner = await db.user.create({ data: { ...DEMO.owner, email: 'alex@example.com', role: 'OWNER', passwordHash } });
  const manager = await db.user.create({ data: { ...DEMO.manager, email: 'priya@example.com', role: 'MANAGER', passwordHash } });

  const prop = (name: string, address: string, managed = false) =>
    db.property.create({ data: { name, address, city: 'Bengaluru', ownerId: owner.id, managerId: managed ? manager.id : null } });
  const oakwood = await prop('Oakwood Residences', '14 Lavelle Road');
  const highland = await prop('Highland Park Lofts', '220 Indiranagar 100 Ft Road');
  const grandview = await prop('Grandview Residences', '7 Palace Cross Road', true);
  const metro = await prop('Metro Tower', '1 MG Road');
  const westside = await prop('Westside Courtyard', '52 Malleshwaram 8th Cross', true);

  const now = new Date();
  const period = periodOf(now);
  let phoneSeq = 11;

  type Seat = {
    property: { id: string }; unit: string; rent: number; tenant?: string; co?: string[];
    startMonthsAgo?: number; endsInDays?: number; unpaidNow?: boolean; dueSoon?: boolean; items?: { label: string; amount: number }[];
    phone?: string; paidHow?: Prisma.InvoiceCreateManyInput['method'];
  };
  const seats: Seat[] = [
    { property: oakwood, unit: 'Apt 4B', rent: 35000, tenant: 'Marcus Vance', unpaidNow: true, startMonthsAgo: 8 },
    { property: oakwood, unit: 'Apt 3A', rent: 42000, tenant: 'Sophia Lin', startMonthsAgo: 14, paidHow: 'UPI' },
    { property: highland, unit: 'Unit 12B', rent: 48000, tenant: 'David Chen', co: ['Sarah Miller'], unpaidNow: true, startMonthsAgo: 4 },
    { property: grandview, unit: 'Unit 304', rent: 35000, tenant: DEMO.tenant.name, phone: DEMO.tenant.phone, startMonthsAgo: 10, dueSoon: true,
      items: [{ label: 'Base rent', amount: 31500 }, { label: 'Maintenance', amount: 2200 }, { label: 'Water & utilities', amount: 1300 }] },
    { property: grandview, unit: 'Unit 201', rent: 35000, tenant: 'Rahul Mehta', endsInDays: 18, startMonthsAgo: 11, paidHow: 'CARD' },
    { property: metro, unit: 'Penthouse 1', rent: 85000, tenant: 'David Kapoor', startMonthsAgo: 6, paidHow: 'NETBANKING' },
    { property: metro, unit: 'Unit 108', rent: 35000, tenant: 'Mateo Gomez', startMonthsAgo: 2, paidHow: 'UPI' },
    { property: westside, unit: 'Unit 101', rent: 32000 }
  ];

  let elenaUnitId = '', westsideUnitId = '';
  for (const s of seats) {
    const unit = await db.unit.create({
      data: { propertyId: s.property.id, name: s.unit, rent: s.rent, deposit: s.rent * 2, status: s.tenant ? 'OCCUPIED' : 'VACANT' }
    });
    if (!s.tenant) { westsideUnitId = unit.id; continue; }
    const tenant = await db.user.create({
      data: { name: s.tenant, phone: s.phone ?? `98765000${phoneSeq++}`, role: 'TENANT', passwordHash }
    });
    const start = new Date(now.getFullYear(), now.getMonth() - (s.startMonthsAgo ?? 6), 1, 12);
    const end = s.endsInDays ? day(s.endsInDays) : new Date(start.getFullYear() + 1, start.getMonth(), 0, 12);
    const lease = await db.lease.create({
      data: { unitId: unit.id, tenantId: tenant.id, startDate: start, endDate: end, rent: s.rent, deposit: s.rent * 2,
        coTenantNames: s.co ?? [], autopay: s.tenant === DEMO.tenant.name }
    });
    if (s.tenant === DEMO.tenant.name) elenaUnitId = unit.id;

    // Bill every month from the lease start (max 6 back) through this month.
    const months = Math.min(s.startMonthsAgo ?? 6, 5);
    const invoices: Prisma.InvoiceCreateManyInput[] = [];
    for (let k = months; k >= 0; k--) {
      const p = shiftPeriod(period, -k);
      const items = s.items ?? [{ label: 'Rent', amount: s.rent }];
      const isNow = k === 0;
      const unpaid = isNow && (s.unpaidNow || s.dueSoon);
      const due = isNow && s.dueSoon ? day(3) : dueDate(p);
      const paidAt = unpaid ? null : isNow ? new Date(now.getTime() - (2 + invoices.length * 3) * 3600_000) : day(-1 - Math.floor(Math.random() * 3), dueDate(p));
      invoices.push({
        leaseId: lease.id, period: p, dueDate: due, amount: items.reduce((a, i) => a + i.amount, 0), items,
        paidAt, method: paidAt ? (s.paidHow ?? 'UPI') : null,
        reference: paidAt ? `RNT-${p.replace('-', '')}-${unit.id.slice(-6).toUpperCase()}` : null,
        remindedAt: s.co && unpaid ? day(-1) : null
      });
    }
    await db.invoice.createMany({ data: invoices });
  }

  await db.maintenanceTicket.create({
    data: { unitId: elenaUnitId, createdById: (await db.user.findUniqueOrThrow({ where: { phone: DEMO.tenant.phone } })).id,
      title: 'AC filter replacement', description: 'Bedroom AC is blowing warm air and smells dusty.',
      status: 'SCHEDULED', scheduledFor: day(1), assignee: 'Apex HVAC (Marcus)' }
  });

  for (const [name, credit, income] of [['Ananya Rao', 760, 140000], ['Kabir Singh', 731, 110000], ['Meera Iyer', 712, 96000], ['Arjun Das', 688, 88000]] as const) {
    await db.application.create({ data: { unitId: westsideUnitId, name, phone: `9123400${credit}`, creditScore: credit, monthlyIncome: income } });
  }

  await db.notice.create({
    data: { propertyId: grandview.id, title: 'Resident mixer on the rooftop', body: 'Join your neighbours at the rooftop pavilion this Saturday at 6:30 PM. Snacks and music provided.', eventAt: day(2) }
  });
  await db.notice.create({
    data: { propertyId: grandview.id, title: 'Water tank cleaning', body: 'Water supply will be off from 10 AM to 1 PM on Monday while the overhead tanks are cleaned.', eventAt: day(4) }
  });
  await db.parcel.create({ data: { unitId: elenaUnitId, carrier: 'BlueDart', locker: '7', pin: '482916' } });

  const elena = await db.user.findUniqueOrThrow({ where: { phone: DEMO.tenant.phone } });
  await db.message.createMany({
    data: [
      { senderId: manager.id, recipientId: elena.id, body: 'Hi Elena, the AC technician is confirmed for tomorrow at 10.', createdAt: day(-1), readAt: day(-1) },
      { senderId: elena.id, recipientId: manager.id, body: 'Great, thank you! I will be home.', createdAt: new Date(day(-1).getTime() + 600_000) }
    ]
  });
  await db.notification.createMany({
    data: [
      { userId: owner.id, title: 'Rent overdue: Apt 4B', body: 'Marcus Vance has not paid this month’s rent.', tone: 'bad' },
      { userId: owner.id, title: 'Lease expiring: Unit 201', body: 'Rahul Mehta’s lease ends in 18 days.', tone: 'warn' },
      { userId: owner.id, title: 'New application: Unit 101', body: 'Ananya Rao applied with a credit score of 760.', tone: 'info' },
      { userId: elena.id, title: 'Package delivered', body: 'BlueDart parcel is in locker 7.', tone: 'info' }
    ]
  });

  console.log(`Seeded demo data. Sign in with password "${DEMO_PASSWORD}":`);
  console.log(`  Owner   ${DEMO.owner.phone} (${DEMO.owner.name})`);
  console.log(`  Manager ${DEMO.manager.phone} (${DEMO.manager.name})`);
  console.log(`  Tenant  ${DEMO.tenant.phone} (${DEMO.tenant.name})`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
