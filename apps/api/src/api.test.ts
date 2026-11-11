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
