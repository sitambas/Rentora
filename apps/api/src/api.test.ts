// End-to-end API tests. Run with `npm test`; they use the database in .env.test, which is wiped and re-seeded.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from './app';
import { db } from './db';

let server: Server;
let base = '';
const tokens: Record<string, string> = {};

async function call(method: string, path: string, opts: { as?: string; body?: unknown } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(opts.as ? { authorization: `Bearer ${tokens[opts.as]}` } : {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  });
  const data = await res.json();
  return { status: res.status, data };
}

before(async () => {
  if (!process.env.DATABASE_URL?.includes('test')) throw new Error('Tests must run against a test database (DATABASE_URL should contain "test").');
  execSync('npx prisma migrate deploy', { stdio: 'ignore', env: process.env });
  execSync('npx tsx prisma/test-data.ts', { stdio: 'ignore', env: process.env });
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (const [who, phone] of [['owner', '9876500001'], ['manager', '9876500002'], ['tenant', '9876500010']]) {
    const r = await call('POST', '/auth/login', { body: { phone, password: 'demo1234' } });
    assert.equal(r.status, 200, `login ${who}`);
    tokens[who] = r.data.token;
  }
});

after(async () => {
  server?.close();
  await db.$disconnect();
});

test('login rejects a wrong password and accepts +91 formatting', async () => {
  assert.equal((await call('POST', '/auth/login', { body: { phone: '9876500001', password: 'nope' } })).status, 401);
  const ok = await call('POST', '/auth/login', { body: { phone: '+91 98765 00001', password: 'demo1234' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.role, 'OWNER');
});

test('requests without a token are refused', async () => {
  assert.equal((await call('GET', '/dashboard')).status, 401);
});

test('owner dashboard reflects the seeded portfolio', async () => {
  const { status, data } = await call('GET', '/dashboard', { as: 'owner' });
  assert.equal(status, 200);
  assert.equal(data.unitCount, 8);
  assert.equal(data.occupiedCount, 7);
  assert.equal(data.flow.length, 6);
  assert.ok(data.expiring.some((e: { unit: { name: string } }) => e.unit.name === 'Unit 201'));
});

test('manager only sees the properties they manage', async () => {
  const { data } = await call('GET', '/properties', { as: 'manager' });
  assert.deepEqual(data.map((p: { name: string }) => p.name).sort(), ['Grandview Residences', 'Westside Courtyard']);
});

test('tenants cannot reach owner endpoints', async () => {
  assert.equal((await call('GET', '/dashboard', { as: 'tenant' })).status, 403);
  assert.equal((await call('GET', '/units', { as: 'tenant' })).status, 403);
});

test('tenant pays the open invoice and the owner is notified', async () => {
  const home = await call('GET', '/home', { as: 'tenant' });
  assert.equal(home.status, 200);
  const inv = home.data.invoice;
  assert.notEqual(inv.status, 'PAID');
  assert.equal(inv.amount, 35000);

  const paid = await call('POST', `/invoices/${inv.id}/pay`, { as: 'tenant', body: { method: 'UPI' } });
  assert.equal(paid.status, 200);
  assert.equal(paid.data.status, 'PAID');
  assert.equal((await call('POST', `/invoices/${inv.id}/pay`, { as: 'tenant', body: { method: 'UPI' } })).status, 409);

  const notes = await call('GET', '/notifications', { as: 'manager' });
  assert.ok(notes.data.some((n: { title: string }) => n.title.includes('Unit 304')));
});

test('owner reminds and records payment for an overdue tenant', async () => {
  const overdue = await call('GET', '/units?status=OVERDUE', { as: 'owner' });
  const unit = overdue.data.find((u: { name: string }) => u.name === 'Apt 4B');
  assert.ok(unit, 'Apt 4B should be overdue');
  const invId = unit.openInvoice.id;
  assert.equal((await call('POST', `/invoices/${invId}/remind`, { as: 'owner' })).status, 200);
  assert.equal((await call('POST', `/invoices/${invId}/remind`, { as: 'owner' })).status, 429);
  const rec = await call('POST', `/invoices/${invId}/record`, { as: 'owner', body: { method: 'CASH' } });
  assert.equal(rec.data.status, 'PAID');
});

test('approving an application moves the applicant in and closes other applications', async () => {
  const apps = await call('GET', '/applications', { as: 'manager' });
  assert.equal(apps.data.length, 4);
  const best = apps.data[0];
  assert.equal(best.creditScore, 760);
  const r = await call('POST', `/applications/${best.id}/approve`, { as: 'manager', body: {} });
  assert.equal(r.status, 200);
  assert.match(r.data.tempPassword, /^rent-\d{4}-[a-z]{2}$/);
  assert.equal((await call('GET', '/applications', { as: 'manager' })).data.length, 0);

  const login = await call('POST', '/auth/login', { body: { phone: best.phone, password: r.data.tempPassword } });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.role, 'TENANT');
});

test('maintenance request flows from tenant to manager and back', async () => {
  const t = await call('POST', '/tickets', { as: 'tenant', body: { title: 'Kitchen tap leaking', description: 'Drips all night' } });
  assert.equal(t.status, 200);
  assert.equal(t.data.unit.name, 'Unit 304');
  const upd = await call('PATCH', `/tickets/${t.data.id}`, { as: 'manager', body: { scheduledFor: new Date(Date.now() + 86400000).toISOString(), assignee: 'Ravi (plumber)' } });
  assert.equal(upd.data.status, 'SCHEDULED');
  const notes = await call('GET', '/notifications', { as: 'tenant' });
  assert.ok(notes.data.some((n: { body: string }) => n.body.includes('Kitchen tap leaking')));
});

test('messages only go to connected people', async () => {
  const convos = await call('GET', '/messages', { as: 'tenant' });
  const priya = convos.data.find((c: { user: { name: string } }) => c.user.name === 'Priya Nair');
  assert.ok(priya);
  const sent = await call('POST', `/messages/${priya.user.id}`, { as: 'tenant', body: { body: 'Thanks!' } });
  assert.equal(sent.status, 200);
  const marcus = await db.user.findFirstOrThrow({ where: { name: 'Marcus Vance' } });
  assert.equal((await call('POST', `/messages/${marcus.id}`, { as: 'tenant', body: { body: 'hi' } })).status, 403);
});

test('staff edit a unit; duplicate names and outsiders are refused', async () => {
  const { data: list } = await call('GET', '/units?q=Apt 3A', { as: 'owner' });
  const unit = list.find((u: { name: string }) => u.name === 'Apt 3A');
  const edited = await call('PATCH', `/units/${unit.id}`, { as: 'owner', body: { name: 'Apt 3A-East', rent: '45000', deposit: 90000 } });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.name, 'Apt 3A-East');
  assert.equal(edited.data.rent, 45000);
  assert.equal(edited.data.lease.rent, 42000, 'the current lease keeps its rent');
  assert.equal((await call('PATCH', `/units/${unit.id}`, { as: 'owner', body: { name: 'Apt 4B' } })).status, 409);
  assert.equal((await call('PATCH', `/units/${unit.id}`, { as: 'owner', body: { rent: 0 } })).status, 400);
  assert.equal((await call('PATCH', `/units/${unit.id}`, { as: 'manager', body: { rent: 1 } })).status, 403);
  assert.equal((await call('PATCH', `/units/${unit.id}`, { as: 'tenant', body: { rent: 1 } })).status, 403);
});

test('adding a tenant stores their details; ID is masked in lists and full on the unit page', async () => {
  const { data: props } = await call('GET', '/properties', { as: 'owner' });
  const { data: unit } = await call('POST', '/units', { as: 'owner', body: { propertyId: props[0].id, name: 'Unit 909', rent: 30000 } });
  const base = { unitId: unit.id, name: 'Kavya Iyer', phone: '98765 00077', startDate: '2026-12-20', months: 11, rent: 30000, deposit: 60000 };

  const badAadhaar = await call('POST', '/leases', { as: 'owner', body: { ...base, idType: 'AADHAAR', idNumber: '1234' } });
  assert.equal(badAadhaar.status, 400);
  assert.match(badAadhaar.data.error, /12 digits/);
  const samePhone = await call('POST', '/leases', { as: 'owner', body: { ...base, emergencyPhone: '9876500077' } });
  assert.equal(samePhone.status, 400);

  const ok = await call('POST', '/leases', {
    as: 'owner',
    body: {
      ...base, email: 'kavya@example.com', dateOfBirth: '1996-04-18', occupation: 'Designer', employer: 'Studio Nine',
      permanentAddress: '12 Lake Road, Kochi', idType: 'AADHAAR', idNumber: '1234 5678 9012',
      emergencyName: 'Ravi Iyer', emergencyRelation: 'Father', emergencyPhone: '+91 98450 11111',
      coTenantNames: ['Meera Iyer'], notes: 'Two-wheeler parking', occupants: ''
    }
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.ok(ok.data.tempPassword);

  const { data: listed } = await call('GET', '/units?status=OCCUPIED&q=Kavya', { as: 'owner' });
  const lease = listed[0].lease;
  assert.equal(lease.tenantDetails.idNumber, '••••••••9012');
  assert.equal(lease.occupants, 2, 'tenant plus one co-tenant');
  assert.equal(lease.notes, 'Two-wheeler parking');

  const { data: detail } = await call('GET', `/units/${unit.id}`, { as: 'owner' });
  assert.equal(detail.openInvoice.dueDate.slice(0, 10), '2026-12-20', 'a mid-month move-in is billed on move-in day, not the 5th');
  assert.deepEqual(detail.lease.tenantDetails, {
    email: 'kavya@example.com', dateOfBirth: '1996-04-18', occupation: 'Designer', employer: 'Studio Nine',
    permanentAddress: '12 Lake Road, Kochi', idType: 'AADHAAR', idNumber: '123456789012',
    emergencyName: 'Ravi Iyer', emergencyRelation: 'Father', emergencyPhone: '9845011111'
  });
});

test('owner turns a tenant login off and on, then removes the tenant; re-adding restores access', async () => {
  const login = (phone: string, password = 'demo1234') => call('POST', '/auth/login', { body: { phone, password } });
  const { data: units } = await call('GET', '/units?q=Sophia', { as: 'owner' });
  const unit = units[0];
  const leaseId = unit.lease.id;
  const sophia = await login('9876500012');
  tokens.sophia = sophia.data.token;
  assert.equal((await call('GET', '/home', { as: 'sophia' })).status, 200);

  // Managers can't touch leases outside their properties.
  assert.equal((await call('POST', `/leases/${leaseId}/login`, { as: 'manager', body: { enabled: false } })).status, 404);
  assert.equal((await call('POST', `/leases/${leaseId}/login`, { as: 'tenant', body: { enabled: false } })).status, 403);

  assert.equal((await call('POST', `/leases/${leaseId}/login`, { as: 'owner', body: { enabled: false } })).status, 200);
  assert.equal((await call('GET', '/home', { as: 'sophia' })).status, 401, 'existing session stops working');
  const blocked = await login('9876500012');
  assert.equal(blocked.status, 403);
  assert.match(blocked.data.error, /turned off/);
  const { data: listed } = await call('GET', '/units?q=Sophia', { as: 'owner' });
  assert.equal(listed[0].lease.tenant.loginEnabled, false);
  assert.equal(listed[0].status, 'OCCUPIED', 'lease is untouched');

  assert.equal((await call('POST', `/leases/${leaseId}/login`, { as: 'owner', body: { enabled: true } })).status, 200);
  assert.equal((await login('9876500012')).status, 200);

  assert.equal((await call('POST', `/leases/${leaseId}/end`, { as: 'owner', body: { disableLogin: true } })).status, 200);
  assert.equal((await login('9876500012')).status, 403);
  const { data: after } = await call('GET', `/units/${unit.id}`, { as: 'owner' });
  assert.equal(after.status, 'VACANT');
  assert.ok(after.invoices.length > 0, 'payment history is kept');
  assert.equal((await call('POST', `/leases/${leaseId}/login`, { as: 'owner', body: { enabled: true } })).status, 409);

  const back = await call('POST', '/leases', { as: 'owner', body: { unitId: unit.id, name: 'Sophia Lin', phone: '9876500012', startDate: '2026-12-01', months: 11, rent: 42000, deposit: 84000 } });
  assert.equal(back.status, 200);
  assert.equal(back.data.tempPassword, null, 'returning tenant keeps their password');
  assert.equal((await login('9876500012')).status, 200);
});

test('lease documents: owner uploads, tenant can view their own, others are refused, fakes and big files rejected', async () => {
  const upload = (as: string, leaseId: string, kind: string, name: string, bytes: Buffer, type = 'application/pdf') =>
    fetch(`${base}/documents?${new URLSearchParams({ leaseId, kind, name })}`, {
      method: 'POST', headers: { authorization: `Bearer ${tokens[as]}`, 'content-type': type }, body: new Uint8Array(bytes)
    }).then(async r => ({ status: r.status, data: await r.json() }));
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(2000, 32)]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

  const { data: home } = await call('GET', '/home', { as: 'tenant' });
  const leaseId = home.lease.id;

  const agreement = await upload('owner', leaseId, 'AGREEMENT', 'Agreement 2026.pdf', pdf);
  assert.equal(agreement.status, 200, JSON.stringify(agreement.data));
  assert.equal(agreement.data.mimeType, 'application/pdf');
  const aadhaar = await upload('manager', leaseId, 'ID_PROOF', '../../aadhaar front', png, 'image/png');
  assert.equal(aadhaar.status, 200);
  assert.equal(aadhaar.data.fileName, 'aadhaar front.png', 'path characters stripped, extension added');

  const fake = await upload('owner', leaseId, 'OTHER', 'virus.pdf', Buffer.from('<script>alert(1)</script>'));
  assert.equal(fake.status, 400);
  assert.equal((await upload('owner', leaseId, 'OTHER', 'big.pdf', Buffer.concat([pdf, Buffer.alloc(11 * 1024 * 1024)]))).status, 413);
  assert.equal((await upload('tenant', leaseId, 'OTHER', 'mine.pdf', pdf)).status, 403, 'tenants cannot upload');

  const { data: list } = await call('GET', `/documents?leaseId=${leaseId}`, { as: 'tenant' });
  assert.equal(list.length, 2);
  const file = await fetch(`${base}/documents/${agreement.data.id}/file`, { headers: { authorization: `Bearer ${tokens.tenant}` } });
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'application/pdf');
  assert.ok(Buffer.from(await file.arrayBuffer()).equals(pdf));

  // Another tenant can't see Elena's documents.
  const { data: other } = await call('POST', '/auth/login', { body: { phone: '9876500011', password: 'demo1234' } });
  tokens.other = other.token;
  assert.equal((await call('GET', `/documents?leaseId=${leaseId}`, { as: 'other' })).status, 404);
  assert.equal((await fetch(`${base}/documents/${agreement.data.id}/file`, { headers: { authorization: `Bearer ${tokens.other}` } })).status, 404);

  assert.equal((await call('DELETE', `/documents/${aadhaar.data.id}`, { as: 'tenant' })).status, 403);
  assert.equal((await call('DELETE', `/documents/${aadhaar.data.id}`, { as: 'owner' })).status, 200);
  assert.equal((await call('GET', `/documents?leaseId=${leaseId}`, { as: 'owner' })).data.length, 1);
});
