import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny, type output } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const forbidden = (msg = 'You do not have access to this.') => new HttpError(403, msg);
export const notFound = (what = 'Item') => new HttpError(404, `${what} not found.`);
export const conflict = (msg: string) => new HttpError(409, msg);

/** Wraps an async handler: its return value is sent as JSON, thrown errors go to the error middleware. */
export const handle = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).then(data => { if (!res.headersSent) res.json(data ?? { ok: true }); }).catch(next);
  };

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): output<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw badRequest(r.error.issues[0]?.message ?? 'Invalid request.', r.error.flatten());
  }
  return r.data;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Invalid request.', details: err.flatten() });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Request body is not valid JSON.' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
}
