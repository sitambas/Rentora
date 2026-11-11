import { Router } from 'express';
import { z } from 'zod';
import { normalizePhone, type User } from '@rentora/shared';
import { db } from '../db';
import { DISABLED_MESSAGE, checkPassword, hashPassword, me, requireAuth, signToken } from '../lib/auth';
import { HttpError, badRequest, conflict, handle, parse } from '../lib/http';

export const auth = Router();

const phone = z.string().transform((v, ctx) => {
  const p = normalizePhone(v);
  if (!p) ctx.addIssue({ code: 'custom', message: 'Enter a 10-digit Indian mobile number.' });
  return p ?? '';
});

export const toUser = (u: { id: string; name: string; phone: string; email: string | null; role: User['role'] }): User =>
  ({ id: u.id, name: u.name, phone: u.phone, email: u.email, role: u.role });

auth.post('/login', handle(async req => {
  const body = parse(z.object({ phone, password: z.string().min(1, 'Enter your password.') }), req.body);
  const user = await db.user.findUnique({ where: { phone: body.phone } });
  if (!user || !(await checkPassword(body.password, user.passwordHash))) {
    throw new HttpError(401, 'That mobile number and password do not match.');
  }
  if (user.disabledAt) throw new HttpError(403, DISABLED_MESSAGE);
  return { token: signToken(user), user: toUser(user) };
}));

auth.post('/register', handle(async req => {
  const body = parse(z.object({
    name: z.string().trim().min(2, 'Enter your full name.'),
    phone,
    email: z.string().email().optional().nullable(),
    password: z.string().min(8, 'Use at least 8 characters.'),
    role: z.enum(['OWNER', 'MANAGER'])
  }), req.body);
  if (await db.user.findUnique({ where: { phone: body.phone } })) throw conflict('An account with this mobile number already exists. Sign in instead.');
  const user = await db.user.create({
    data: { name: body.name, phone: body.phone, email: body.email ?? null, role: body.role, passwordHash: await hashPassword(body.password) }
  });
  return { token: signToken(user), user: toUser(user) };
}));

auth.get('/me', requireAuth, handle(async req => {
  const user = await db.user.findUniqueOrThrow({ where: { id: me(req).id } });
  return toUser(user);
}));

auth.patch('/me', requireAuth, handle(async req => {
  const body = parse(z.object({ name: z.string().trim().min(2).optional(), email: z.string().email().nullable().optional() }), req.body);
  const user = await db.user.update({ where: { id: me(req).id }, data: body });
  return toUser(user);
}));

auth.post('/password', requireAuth, handle(async req => {
  const body = parse(z.object({ current: z.string(), next: z.string().min(8, 'Use at least 8 characters.') }), req.body);
  const user = await db.user.findUniqueOrThrow({ where: { id: me(req).id } });
  if (!(await checkPassword(body.current, user.passwordHash))) throw badRequest('Your current password is not correct.');
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.next) } });
  return { ok: true };
}));
