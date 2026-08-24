import { supabase } from '@/src/lib/supabase';

async function uploadPublicImage(path: string, uri: string, upsert = false) {
  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  const ext = path.split('.').pop() || 'jpg';

  const { error } = await supabase.storage.from('apartment-photos').upload(path, buffer, {
    contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
    upsert,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('apartment-photos').getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadApartmentPhoto(userId: string, uri: string) {
  const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
  return uploadPublicImage(`${userId}/${Date.now()}.${ext}`, uri);
}

export async function uploadProfilePhoto(userId: string, uri: string) {
  const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
  return uploadPublicImage(`avatars/${userId}.${ext}`, uri, true);
}
