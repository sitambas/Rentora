import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { env } from '../env';
import { db } from '../db';
import { HttpError, forbidden } from './http';

export interface AuthUser { id: string; role: Role; name: string }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user?: AuthUser } }
}

const TOKEN_TTL = '30d';

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const checkPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export function signToken(user: { id: string; role: Role }) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: TOKEN_TTL });
}

/** Rejects requests without a valid bearer token; loads the user so deleted accounts lose access. */
export const DISABLED_MESSAGE = 'Your Rentora login has been turned off. Contact your landlord or property manager.';

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Sign in to continue.');
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    } catch {
      throw new HttpError(401, 'Your session has expired. Sign in again.');
    }
    const user = await db.user.findUnique({ where: { id: String(payload.sub) }, select: { id: true, role: true, name: true, disabledAt: true } });
    if (!user) throw new HttpError(401, 'This account no longer exists.');
    if (user.disabledAt) throw new HttpError(401, DISABLED_MESSAGE);
    req.user = { id: user.id, role: user.role, name: user.name };
    next();
  } catch (e) {
    next(e);
  }
}

export const requireRole = (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) return next(forbidden());
  next();
};

export const me = (req: Request): AuthUser => {
  if (!req.user) throw new HttpError(401, 'Sign in to continue.');
  return req.user;
};

export const isStaff = (u: AuthUser) => u.role === 'OWNER' || u.role === 'MANAGER';

/** A readable temporary password for new tenants, e.g. "rent-4821-kq". */
export function tempPassword() {
  const n = Math.floor(1000 + Math.random() * 9000);
  const s = Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 2).padEnd(2, 'x');
  return `rent-${n}-${s}`;
}
