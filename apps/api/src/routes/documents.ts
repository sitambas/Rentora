// Lease documents: rental agreements, Aadhaar cards and other files. Staff upload them; staff and the tenant can view them.
import { Router, raw } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { DOCUMENT_KINDS, DOCUMENT_MAX_BYTES, type DocumentKind, type TenantDocument } from '@rentora/shared';
import type { Prisma } from '@prisma/client';
import { db } from '../db';
import { env } from '../env';
import { isStaff, me, requireRole } from '../lib/auth';
import type { AuthUser } from '../lib/auth';
import { HttpError, badRequest, conflict, handle, notFound, parse } from '../lib/http';
import { propertyScope } from '../lib/domain';

export const documents = Router();
const staff = requireRole('OWNER', 'MANAGER');
const MAX_PER_LEASE = 20;
const kinds = Object.keys(DOCUMENT_KINDS) as [DocumentKind, ...DocumentKind[]];

type Row = Prisma.DocumentGetPayload<{ include: { uploadedBy: true } }>;
const toDocument = (d: Row): TenantDocument => ({
  id: d.id, leaseId: d.leaseId, kind: d.kind, fileName: d.fileName, mimeType: d.mimeType, size: d.size,
  createdAt: d.createdAt.toISOString(), uploadedBy: { id: d.uploadedBy.id, name: d.uploadedBy.name }
});

/** Staff can reach leases in their properties; a tenant only their own leases. */
async function leaseFor(u: AuthUser, leaseId: string) {
  const lease = await db.lease.findFirst({
    where: isStaff(u) ? { id: leaseId, unit: { property: propertyScope(u) } } : { id: leaseId, tenantId: u.id }
  });
  if (!lease) throw notFound('Lease');
  return lease;
}

/** Works out the real file type from its first bytes, so a renamed file can't pretend to be a PDF or image. */
function sniff(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  return null;
}

const cleanName = (name: string, ext: string) => {
  const base = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/^[.\s]+/, '').trim().slice(0, 120) || `document.${ext}`;
  return /\.[a-z0-9]{2,5}$/i.test(base) ? base : `${base}.${ext}`;
};

documents.get('/', handle(async req => {
  const { leaseId } = parse(z.object({ leaseId: z.string({ required_error: 'Say which lease.' }) }), req.query);
  await leaseFor(me(req), leaseId);
  const rows = await db.document.findMany({ where: { leaseId }, include: { uploadedBy: true }, orderBy: { createdAt: 'desc' } });
  return rows.map(toDocument);
}));

// The file is the raw request body; its details come in the query string.
documents.post('/', staff, raw({ type: () => true, limit: DOCUMENT_MAX_BYTES }), handle(async req => {
  const q = parse(z.object({
    leaseId: z.string({ required_error: 'Say which lease.' }),
    kind: z.enum(kinds, { errorMap: () => ({ message: 'Choose what kind of document this is.' }) }),
    name: z.string().default('')
  }), req.query);
  const lease = await leaseFor(me(req), q.leaseId);
  const body = req.body;
  if (!Buffer.isBuffer(body) || body.length === 0) throw badRequest('Choose a file to upload.');
  const type = sniff(body);
  if (!type) throw badRequest('Upload a PDF or a photo (JPG, PNG or WebP).');
  if (await db.document.count({ where: { leaseId: lease.id } }) >= MAX_PER_LEASE) {
    throw conflict(`A lease can hold up to ${MAX_PER_LEASE} documents. Delete one first.`);
  }
  const storageKey = `${randomUUID()}.${type.ext}`;
  await mkdir(env.uploadsDir, { recursive: true });
  await writeFile(join(env.uploadsDir, storageKey), body, { flag: 'wx' });
  try {
    const doc = await db.document.create({
      data: { leaseId: lease.id, kind: q.kind, fileName: cleanName(q.name, type.ext), mimeType: type.mime, size: body.length, storageKey, uploadedById: me(req).id },
      include: { uploadedBy: true }
    });
    return toDocument(doc);
  } catch (e) {
    await unlink(join(env.uploadsDir, storageKey)).catch(() => undefined);
    throw e;
  }
}));

documents.get('/:id/file', async (req, res, next) => {
  try {
    const doc = await db.document.findUnique({ where: { id: req.params.id } });
    if (!doc) throw notFound('Document');
    await leaseFor(me(req), doc.leaseId);
    const bytes = await readFile(join(env.uploadsDir, doc.storageKey)).catch(() => { throw new HttpError(410, 'This file is missing from the server. Upload it again.'); });
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(bytes);
  } catch (e) { next(e); }
});

documents.delete('/:id', staff, handle(async req => {
  const doc = await db.document.findUnique({ where: { id: req.params.id } });
  if (!doc) throw notFound('Document');
  await leaseFor(me(req), doc.leaseId);
  await db.document.delete({ where: { id: doc.id } });
  await unlink(join(env.uploadsDir, doc.storageKey)).catch(() => undefined);
  return { ok: true };
}));

