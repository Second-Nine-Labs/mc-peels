/**
 * Supabase Storage upload for cached art — plain REST with the service-role
 * key (server-side only). The bucket is public: the returned URL is stable,
 * CDN-cacheable, and later doubles as the Instacart landing-page image_url.
 */

import { env } from '../env.js';

export class ArtStorageError extends Error {}

export async function uploadArt(path: string, bytes: Buffer, contentType: string): Promise<string> {
  const serviceKey = env().SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new ArtStorageError('SUPABASE_SERVICE_ROLE_KEY is not configured');

  const base = env().SUPABASE_URL.replace(/\/$/, '');
  const bucket = env().EATS_ART_BUCKET;

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

  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
