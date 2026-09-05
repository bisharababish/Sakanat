import i18n from '@/src/i18n';
import { supabase } from '@/src/lib/supabase';
import { PHOTO_MAX_BYTES, photoExt } from '@/src/lib/limits';

const ID_DOCS_BUCKET = 'id-docs';
const PUBLIC_BUCKET = 'apartment-photos';
const SIGNED_TTL_SEC = 60 * 60;

function contentTypeFor(ext: string) {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

async function uploadPublicImage(path: string, uri: string, upsert = false) {
  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > PHOTO_MAX_BYTES) {
    throw new Error(i18n.t('profile.photoTooLarge'));
  }
  const ext = photoExt(path);
  const { error } = await supabase.storage.from(PUBLIC_BUCKET).upload(path, buffer, {
    contentType: contentTypeFor(ext),
    upsert,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadApartmentPhoto(userId: string, uri: string) {
  const ext = photoExt(uri);
  return uploadPublicImage(`${userId}/${Date.now()}.${ext}`, uri);
}

export async function uploadProfilePhoto(userId: string, uri: string) {
  const ext = photoExt(uri);
  return uploadPublicImage(`avatars/${userId}.${ext}`, uri, true);
}

/** National / university cards — private bucket; returns storage path (not a public URL). */
export async function uploadIdDoc(userId: string, kind: 'national' | 'university', uri: string) {
  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > PHOTO_MAX_BYTES) {
    throw new Error(i18n.t('profile.photoTooLarge'));
  }
  const ext = photoExt(uri);
  const path = `${userId}/${kind}.${ext}`;
  const { error } = await supabase.storage.from(ID_DOCS_BUCKET).upload(path, buffer, {
    contentType: contentTypeFor(ext),
    upsert: true,
  });
  if (error) {
    if (/bucket|not found|row-level security/i.test(error.message)) {
      throw new Error(i18n.t('profile.idUploadDbMissing'));
    }
    throw error;
  }
  return path;
}

/** Resolves a signed (or legacy public) URL for an ID card path. */
export async function idDocUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  // Legacy public paths under apartment-photos/docs/...
  if (path.startsWith('docs/')) {
    const { data } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  const { data, error } = await supabase.storage
    .from(ID_DOCS_BUCKET)
    .createSignedUrl(path, SIGNED_TTL_SEC);
  if (!error && data?.signedUrl) return data.signedUrl;

  // Fallback: older uploads saved as docs/{userId}/...
  const legacy = path.includes('/') ? `docs/${path}` : `docs/${path}`;
  const { data: pub } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(legacy);
  return pub.publicUrl;
}
