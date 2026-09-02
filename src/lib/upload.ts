import i18n from '@/src/i18n';
import { supabase } from '@/src/lib/supabase';
import { PHOTO_MAX_BYTES, photoExt } from '@/src/lib/limits';

async function uploadPublicImage(path: string, uri: string, upsert = false) {
  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > PHOTO_MAX_BYTES) {
    throw new Error(i18n.t('profile.photoTooLarge'));
  }
  const ext = photoExt(path);

  const { error } = await supabase.storage.from('apartment-photos').upload(path, buffer, {
    contentType: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg',
    upsert,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('apartment-photos').getPublicUrl(path);
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
