import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './env';
import { requireAuth } from './lib/auth';
import { errorHandler, notFound } from './lib/http';
import { auth } from './routes/auth';
import { dashboard } from './routes/dashboard';
import { properties, units } from './routes/properties';
import { invoices, leases } from './routes/billing';
import { applications, notices, parcels, tickets } from './routes/community';
import { home, messages, notifications } from './routes/people';
import { documents } from './routes/documents';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  // Browsers must come from an allowed origin; native apps and server-to-server calls send no Origin header.
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)) }));
  app.use(express.json({ limit: '200kb' }));
  if (!env.production && process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

  app.get('/health', (_req, res) => { res.json({ ok: true }); });

  app.use('/auth', auth);
  app.use(requireAuth);
  app.use('/dashboard', dashboard);
  app.use('/properties', properties);
  app.use('/units', units);
  app.use('/leases', leases);
  app.use('/documents', documents);
  app.use('/invoices', invoices);
  app.use('/tickets', tickets);
  app.use('/notices', notices);
  app.use('/applications', applications);
  app.use('/parcels', parcels);
  app.use('/messages', messages);
  app.use('/notifications', notifications);
  app.use('/home', home);

  app.use((_req, _res, next) => next(notFound('Endpoint')));
  app.use(errorHandler);
  return app;
}
