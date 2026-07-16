/**
 * Supabase Storage for cached art — plain REST with the service-role key
 * (server-side only). The bucket is public: URLs are stable, CDN-cacheable,
 * and later double as the Instacart landing-page image_url.
 *
 * The static trio needs no DB table — its art lives at
 * `kitchens/<kitchenId>/<dishId>-<ts>.<ext>` and `listKitchenArt` reads the
 * bucket directly, so generation ships without another prod migration.
 */

import { env } from '../env.js';

export class ArtStorageError extends Error {}

function bucketBase(): { base: string; bucket: string; serviceKey: string } {
  const serviceKey = env().SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new ArtStorageError('SUPABASE_SERVICE_ROLE_KEY is not configured');
  return { base: env().SUPABASE_URL.replace(/\/$/, ''), bucket: env().EATS_ART_BUCKET, serviceKey };
}

export function publicUrl(path: string): string {
  const { base, bucket } = bucketBase();
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

export async function uploadArt(path: string, bytes: Buffer, contentType: string): Promise<string> {
  const { base, bucket, serviceKey } = bucketBase();

  const response = await fetch(`${base}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${serviceKey}`,
      'content-type': contentType,
      'x-upsert': 'true',
    },
    body: new Uint8Array(bytes),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ArtStorageError(`Storage upload failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  return publicUrl(path);
}

/** `<dishId>-<unixMs>.<ext>` — dishId may contain hyphens; the ts is digits. */
const ART_FILE = /^(.+)-(\d+)\.(png|jpe?g|webp)$/i;

/** Pure: `{ dishId: newest filename }` from a list of `kitchens/<id>/` names. */
export function newestPerDish(names: string[]): Record<string, string> {
  const newest = new Map<string, { ts: number; name: string }>();
  for (const name of names) {
    const match = ART_FILE.exec(name);
    if (!match) continue;
    const dishId = match[1];
    const tsRaw = match[2];
    if (!dishId || !tsRaw) continue;
    const ts = Number(tsRaw);
    const current = newest.get(dishId);
    if (!current || ts > current.ts) newest.set(dishId, { ts, name });
  }
  const out: Record<string, string> = {};
  for (const [dishId, { name }] of newest) out[dishId] = name;
  return out;
}

/** Cached art for one kitchen: `{ dishId: publicUrl }`, newest tile per dish. */
export async function listKitchenArt(kitchenId: string): Promise<Record<string, string>> {
  const { base, bucket, serviceKey } = bucketBase();
  const response = await fetch(`${base}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      prefix: `kitchens/${kitchenId}/`,
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ArtStorageError(`Storage list failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const rows = (await response.json()) as Array<{ name?: string }>;
  const names = rows.map((row) => row.name ?? '').filter(Boolean);
  const out: Record<string, string> = {};
  for (const [dishId, filename] of Object.entries(newestPerDish(names))) {
    out[dishId] = publicUrl(`kitchens/${kitchenId}/${filename}`);
  }
  return out;
}
